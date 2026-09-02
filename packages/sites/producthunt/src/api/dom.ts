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

type HydratedLaunch = {
  name: string;
  tagline: string;
  launchSlug: string;
  productSlug: string;
};

const PRODUCT_PATH = /^\/products\/([^/?#]+)/;
const RANKED_TITLE = /^\s*(\d+)\.\s+(.+?)\s*$/;
const POST_MARKER = '"__typename":"Post"';
const PRODUCT_MARKER = '"product":{"__typename":"Product"';

const HOMEPAGE_SECTIONS: Record<string, Exclude<LaunchSection, "all">> = {
  "homepage-section-today": "today",
  "homepage-section-yesterday": "yesterday",
  "homepage-section-last-week": "last_week",
  "homepage-section-last-month": "last_month"
};

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

function jsonStringField(source: string, name: string) {
  const match = source.match(new RegExp(`"${name}":"((?:\\\\.|[^"\\\\])*)"`));
  if (!match) return "";
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return "";
  }
}

function hydratedLaunches() {
  const launches: HydratedLaunch[] = [];
  const seen = new Set<string>();

  for (const script of Array.from(document.querySelectorAll("script"))) {
    const source = script.textContent ?? "";
    if (!source.includes("ApolloSSRDataTransport") || !source.includes(POST_MARKER)) continue;

    let start = source.indexOf(POST_MARKER);
    while (start >= 0) {
      const next = source.indexOf(POST_MARKER, start + POST_MARKER.length);
      const segment = source.slice(start, next >= 0 ? next : source.length);
      const productAt = segment.indexOf(PRODUCT_MARKER);

      // Feed posts keep scalar launch fields before their direct product object.
      // Nested Post shapes (comments, recommendations, and other page data) are
      // deliberately ignored instead of being mistaken for launch-list entries.
      if (productAt > 0 && !segment.slice(POST_MARKER.length, productAt).includes("{")) {
        const postFields = segment.slice(0, productAt);
        const productFields = segment.slice(productAt, segment.indexOf("}", productAt) + 1);
        const launchSlug = jsonStringField(postFields, "slug");
        const productSlug = jsonStringField(productFields, "slug");
        const name = cleanText(jsonStringField(postFields, "name"), 200);
        const tagline = cleanText(jsonStringField(postFields, "tagline"), 300);
        const key = `${productSlug}\n${launchSlug}`;

        if (/^[a-z0-9-]+$/i.test(launchSlug) && /^[a-z0-9-]+$/i.test(productSlug) && !seen.has(key)) {
          seen.add(key);
          launches.push({ name, tagline, launchSlug, productSlug });
        }
      }

      start = next;
    }
  }

  return launches;
}

function launchUrl(href: string, name: string, tagline: string, productSlug: string, hydration: HydratedLaunch[]) {
  const matches = hydration.filter(launch => launch.productSlug === productSlug);
  const exact = matches.find(launch => launch.name === name && launch.tagline === tagline);
  const selected = exact ?? (matches.length === 1 ? matches[0] : null);
  const url = new URL(href, location.origin);
  if (selected) url.searchParams.set("launch", selected.launchSlug);
  return url.href;
}

function readLaunch(
  section: HTMLElement,
  sectionTitle: string,
  group: LaunchGroup,
  fallbackRank: number,
  hydration: HydratedLaunch[]
): ProductHuntLaunch | null {
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
  const name = cleanText(titleMatch?.[2] ?? rawTitle, 200);
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
    name,
    slug: pathMatch[1],
    url: launchUrl(href, name, tagline, pathMatch[1], hydration),
    tagline,
    topics,
    commentsCount: parseCount(commentsButton?.textContent),
    upvotesCount: parseCount(voteButton?.textContent),
    imageUrl: image?.currentSrc || image?.src || "",
    section: group,
    sectionTitle
  };
}

function directHeading(container: HTMLElement) {
  return Array.from(container.children).find((child): child is HTMLElement => child.matches("h1, h2"));
}

function homepageLaunches(main: HTMLElement, hydration: HydratedLaunch[]) {
  const containers = Array.from(main.querySelectorAll<HTMLElement>('[data-test^="homepage-section-"]'))
    .filter(container => HOMEPAGE_SECTIONS[container.getAttribute("data-test") ?? ""]);
  if (!containers.length) return null;

  const launches: ProductHuntLaunch[] = [];
  for (const container of containers) {
    const group = HOMEPAGE_SECTIONS[container.getAttribute("data-test") ?? ""];
    const sectionTitle = cleanText(directHeading(container)?.textContent, 200);
    let rank = 0;

    for (const child of Array.from(container.children)) {
      if (child.tagName !== "SECTION") continue;
      const launch = readLaunch(child as HTMLElement, sectionTitle, group, rank + 1, hydration);
      if (!launch) continue;
      rank += 1;
      launches.push(launch);
    }
  }
  return launches;
}

function otherLaunches(main: HTMLElement, hydration: HydratedLaunch[]) {
  const sectionTitle = cleanText(main.querySelector("h1")?.textContent, 200);
  const group = classifySection(sectionTitle);
  const launches: ProductHuntLaunch[] = [];

  for (const section of Array.from(main.querySelectorAll<HTMLElement>("section[data-container], section"))) {
    if (section.closest("article") || section.querySelector("section[data-container]")) continue;
    const launch = readLaunch(section, sectionTitle, group, launches.length + 1, hydration);
    if (launch) launches.push(launch);
  }
  return launches;
}

export function listLaunches(input: ListLaunchesInput = {}) {
  const main = document.querySelector("main");
  if (!main) {
    return {
      ok: false,
      pageUrl: location.href,
      pageTitle: document.title,
      count: 0,
      totalMatched: 0,
      launches: [],
      error: "Product Hunt's main content is not available on this page."
    };
  }

  const hydration = hydratedLaunches();
  const launches = homepageLaunches(main, hydration) ?? otherLaunches(main, hydration);

  const requestedSection = input.section ?? "all";
  const filtered = requestedSection === "all"
    ? launches
    : launches.filter(launch => launch.section === requestedSection);
  const offset = clampInteger(input.offset, 0, 0, 1_000);
  const limit = clampInteger(input.limit, 20, 1, 50);
  const availableSections = Array.from(new Set(launches.map(launch => launch.section)));

  return {
    ok: true,
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
