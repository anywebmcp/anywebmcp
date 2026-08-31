import { postColumn, type RenderedPost } from "./posts";

export type PostContext = {
  role: "timeline" | "subject" | "ancestor" | "reply" | "related" | "unknown";
  section: "timeline" | "conversation" | "related";
  replyingTo: string[];
};

export function pageContext() {
  const column = postColumn();
  const path = location.pathname;
  const subjectPostId = path.match(/^\/(?:[^/]+\/status|i\/web\/status)\/(\d+)\/?$/)?.[1] ?? null;
  const tab = column?.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() ?? null;
  const sort = subjectPostId ? [...(column?.querySelectorAll("button") ?? [])]
    .map(button => button.textContent?.trim() ?? "")
    .find(text => /^(Relevant|Latest|Most recent|Most liked)$/.test(text)) ?? null : null;
  let kind = "other";
  if (subjectPostId) kind = "conversation";
  else if (path === "/home") kind = "home";
  else if (path === "/search" || path.startsWith("/explore")) kind = "search";
  else if (path.startsWith("/i/bookmarks")) kind = "bookmarks";
  else if (/^\/i\/lists\/\d+/.test(path)) kind = "list";
  else if (tab && /^\/[\w]+(?:\/(?:with_replies|media|likes|highlights|articles))?\/?$/.test(path) &&
    !/^\/(?:notifications|settings|messages|compose)(?:\/|$)/.test(path)) kind = "profile";
  return { url: location.href, kind, tab, sort, subjectPostId };
}

export type PostPage = ReturnType<typeof pageContext>;

export function pageKey(page: PostPage) {
  return JSON.stringify([page.url, page.tab, page.sort]);
}

function precedes(first: Element, second: Element) {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

export function withPostContext(items: RenderedPost[], page: PostPage, known: Map<string, PostContext>) {
  const subject = items.find(item => item.post.id === page.subjectPostId)?.element;
  const relatedHeading = [...(postColumn()?.querySelectorAll('h2, [role="heading"]') ?? [])]
    .find(heading => /^(Discover more|More posts|You might like)$/.test(heading.textContent?.trim() ?? ""));
  let previous: PostContext | undefined;

  return items.map(item => {
    const context: PostContext = {
      role: "timeline", section: "timeline", replyingTo: item.replyingTo
    };
    if (page.kind === "conversation") {
      context.section = "conversation";
      const saved = known.get(item.post.id);
      if (item.element === subject) context.role = "subject";
      else if (relatedHeading && precedes(relatedHeading, item.element)) context.role = "related";
      else if (subject) context.role = precedes(item.element, subject) ? "ancestor" : "reply";
      else if (saved && saved.role !== "unknown") context.role = saved.role;
      else if (previous?.role === "related") context.role = "related";
      else if (previous?.role === "reply" || previous?.role === "subject") context.role = "reply";
      else context.role = "unknown";
      if (context.role === "related") context.section = "related";
    } else if (item.replyingTo.length) context.role = "reply";
    previous = context;
    known.delete(item.post.id);
    known.set(item.post.id, context);
    return { ...item, post: { ...item.post, context } };
  });
}

export type ContextualPost = ReturnType<typeof withPostContext>[number];
