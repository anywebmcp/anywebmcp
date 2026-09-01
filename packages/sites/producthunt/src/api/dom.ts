import { canonicalUrl, clampInteger, cleanText, parseCount } from "./shared";

export type LaunchSection = "all" | "today" | "yesterday" | "last_week" | "last_month";

export type ListLaunchesInput = {
  section?: LaunchSection;
  offset?: number;
  limit?: number;
};

export type ProductHuntLaunch = {
  rank: number;
  name: string;
  slug: string;
  url: string;
  tagline: string;
  topics: Array<{ name: string; slug: string; url: string }>;
  commentsCount: number | null;
  upvotesCount: number | null;
  imageUrl: string;
  section: Exclude<LaunchSection, "all"> | "leaderboard" | "unknown";
  sectionTitle: string;
};

type LaunchGroup = ProductHuntLaunch["section"];

const PRODUCT_PATH = /^\/products\/([^/?#]+)/;
const RANKED_TITLE = /^\s*(\d+)\.\s+(.+?)\s*$/;

function classifySection(title: string): LaunchGroup {
  const normalized = title.toLowerCase();
  if (/launching today|today's top products/.test(normalized)) return "today";
  if (/yesterday/.test(normalized)) return "yesterday";
  if (/last week's top products/.test(normalized)) return "last_week";
  if (/last month's top products/.test(normalized)) return "last_month";
  if (/best of product hunt/.test(normalized) || location.pathname.startsWith("/leaderboard/")) {
    return "leaderboard";
  }
  return "unknown";
}

function directChildButton(section: HTMLElement, predicate: (button: HTMLButtonElement) => boolean) {
  return Array.from(section.children).find((child): child is HTMLButtonElement => {
    return child.tagName === "BUTTON" && predicate(child as HTMLButtonElement);
  });
}

function readLaunch(section: HTMLElement, sectionTitle: string, fallbackRank: number): ProductHuntLaunch | null {
  const titleLink = Array.from(section.querySelectorAll<HTMLAnchorElement>('a[href^="/products/"]')).find(link =>
    Array.from(link.children).some(child => child.hasAttribute("data-target"))
  );
  if (!titleLink) return null;

  const href = titleLink.getAttribute("href") ?? "";
  const pathMatch = href.match(PRODUCT_PATH);
  const rawTitle = cleanText(titleLink.textContent);
  const titleMatch = rawTitle.match(RANKED_TITLE);
  if (!pathMatch || !rawTitle) return null;

  const details = titleLink.parentElement?.parentElement;
  const tagline = cleanText(details?.children.item(1)?.textContent, 300);
  const topics = Array.from(section.querySelectorAll<HTMLAnchorElement>('a[href^="/topics/"]'))
    .map(link => {
      const topicHref = link.getAttribute("href") ?? "";
      const topicPath = topicHref.split("?", 1)[0];
      return {
        name: cleanText(link.textContent, 100),
        slug: topicPath.split("/").filter(Boolean).pop() ?? "",
        url: canonicalUrl(topicHref)
      };
    })
    .filter(topic => topic.name && topic.slug);

  const voteButton = section.querySelector<HTMLButtonElement>('button[data-test="vote-button"]');
  const commentsButton = directChildButton(section, button => !button.hasAttribute("data-test"));
  const image = section.querySelector<HTMLImageElement>(":scope > img");

  return {
    rank: titleMatch ? Number.parseInt(titleMatch[1], 10) : fallbackRank,
    name: cleanText(titleMatch?.[2] ?? rawTitle, 200),
    slug: pathMatch[1],
    url: canonicalUrl(href),
    tagline,
    topics,
    commentsCount: parseCount(commentsButton?.textContent),
    upvotesCount: parseCount(voteButton?.textContent),
    imageUrl: image?.currentSrc || image?.src || "",
    section: classifySection(sectionTitle),
    sectionTitle
  };
}

export function listLaunches(input: ListLaunchesInput = {}) {
  const main = document.querySelector("main");
  if (!main) {
    return {
      pageUrl: location.href,
      pageTitle: document.title,
      count: 0,
      totalMatched: 0,
      launches: [],
      error: "Product Hunt's main content is not available on this page."
    };
  }

  let sectionTitle = cleanText(main.querySelector("h1")?.textContent, 200);
  const launches: ProductHuntLaunch[] = [];
  const sectionCounts = new Map<string, number>();

  for (const element of Array.from(main.querySelectorAll<HTMLElement>("h1, h2, section"))) {
    if (element.matches("h1, h2")) {
      sectionTitle = cleanText(element.textContent, 200);
      continue;
    }

    const fallbackRank = (sectionCounts.get(sectionTitle) ?? 0) + 1;
    const launch = readLaunch(element, sectionTitle, fallbackRank);
    if (launch) {
      launches.push(launch);
      sectionCounts.set(sectionTitle, fallbackRank);
    }
  }

  const requestedSection = input.section ?? "all";
  const filtered = requestedSection === "all"
    ? launches
    : launches.filter(launch => launch.section === requestedSection);
  const offset = clampInteger(input.offset, 0, 0, 1_000);
  const limit = clampInteger(input.limit, 20, 1, 50);
  const availableSections = Array.from(new Set(launches.map(launch => launch.section)));

  return {
    pageUrl: location.href,
    pageTitle: document.title,
    requestedSection,
    availableSections,
    offset,
    limit,
    count: filtered.slice(offset, offset + limit).length,
    totalMatched: filtered.length,
    totalMounted: launches.length,
    launches: filtered.slice(offset, offset + limit)
  };
}
