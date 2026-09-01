import { canonicalUrl, cleanText, directMainChild, parseCount } from "./shared";

type LinkValue = {
  name: string;
  slug: string;
  url: string;
};

function productSlug() {
  return location.pathname.match(/^\/products\/([^/?#]+)/)?.[1] ?? "";
}

function linkValues(root: ParentNode, pathPrefix: "/categories/" | "/topics/"): LinkValue[] {
  const seen = new Set<string>();
  return Array.from(root.querySelectorAll<HTMLAnchorElement>(`a[href^="${pathPrefix}"]`))
    .map(link => {
      const href = link.getAttribute("href") ?? "";
      const path = href.split("?", 1)[0];
      const slug = path.split("/").filter(Boolean).pop() ?? "";
      return { name: cleanText(link.textContent, 100), slug, url: canonicalUrl(href) };
    })
    .filter(value => {
      if (!value.name || !value.slug || seen.has(value.slug)) return false;
      seen.add(value.slug);
      return true;
    });
}

function externalWebsite(header: HTMLElement) {
  return Array.from(header.querySelectorAll<HTMLAnchorElement>('a[href^="http"]'))
    .map(link => link.href)
    .find(href => {
      try {
        return new URL(href).hostname !== location.hostname;
      } catch {
        return false;
      }
    }) ?? "";
}

function productDescription(header: HTMLElement) {
  const categoryLink = header.querySelector('a[href^="/categories/"]');
  let categoryBlock: Element | null = categoryLink;
  while (categoryBlock?.parentElement && categoryBlock.parentElement !== header) {
    categoryBlock = categoryBlock.parentElement;
  }
  const description = categoryBlock?.nextElementSibling;
  if (description && description.tagName !== "UL") return cleanText(description.textContent, 2_000);

  return cleanText(Array.from(header.children).find(child => {
    return child.tagName === "DIV"
      && !child.querySelector("h1, h2")
      && !child.querySelector('a[href^="/categories/"]')
      && cleanText(child.textContent).length > 20;
  })?.textContent, 2_000);
}

function reviewValue(header: HTMLElement, slug: string, pattern: RegExp) {
  return Array.from(header.querySelectorAll<HTMLAnchorElement>(`a[href^="/products/${slug}/reviews"]`))
    .map(link => cleanText(link.textContent, 100))
    .find(text => pattern.test(text)) ?? "";
}

function profileLinks(root: ParentNode) {
  const seen = new Set<string>();
  return Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href^="/@"]'))
    .map(link => {
      const href = link.getAttribute("href") ?? "";
      const handle = href.slice(2).split(/[/?#]/, 1)[0];
      const image = link.querySelector<HTMLImageElement>("img");
      return {
        name: cleanText(link.textContent, 100) || cleanText(image?.alt, 100) || handle,
        handle,
        url: canonicalUrl(href),
        avatarUrl: image?.currentSrc || image?.src || ""
      };
    })
    .filter(profile => {
      if (!profile.handle || seen.has(profile.handle)) return false;
      seen.add(profile.handle);
      return true;
    });
}

function featuredLaunch(main: HTMLElement) {
  const comments = main.querySelector("#comments");
  const block = directMainChild(main, comments)
    ?? Array.from(main.children).find(child => {
      return child.querySelector("h2") && child.querySelector('a[href^="/topics/"]');
    }) as HTMLElement | undefined;
  if (!block) return null;

  const header = Array.from(block.querySelectorAll<HTMLElement>("section")).find(section => {
    return Boolean(section.querySelector(":scope > img") && section.querySelector("h2"));
  });
  const heading = header?.querySelector("h2");
  if (!header || !heading) return null;

  const headingContainer = heading.parentElement;
  const details = headingContainer?.parentElement;
  const image = header.querySelector<HTMLImageElement>(":scope > img");
  const badge = header.querySelector<HTMLImageElement>('img[alt*=" was ranked #"]');
  const badgeMatch = badge?.alt.match(/ranked #(\d+) of the (day|week|month) for (.+)$/i);
  const description = header.nextElementSibling;
  const topicsSection = Array.from(block.querySelectorAll<HTMLElement>("section")).find(section => {
    return Boolean(section.querySelector('a[href^="/topics/"]'));
  });
  const teamSection = Array.from(block.querySelectorAll<HTMLElement>("section")).find(section => {
    return Boolean(section.querySelector('a[href^="/@"]'));
  });
  const pricing = cleanText(topicsSection?.children.item(0)?.textContent, 200);
  const pointsButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(button => {
    return /upvote\s*•\s*[\d.,]+\s*points/i.test(cleanText(button.textContent, 100));
  });

  return {
    name: cleanText(heading.textContent, 200),
    tagline: cleanText(headingContainer?.nextElementSibling?.textContent ?? details?.children.item(1)?.textContent, 300),
    status: cleanText(heading.nextElementSibling?.textContent, 100),
    description: cleanText(description?.textContent, 5_000),
    imageUrl: image?.currentSrc || image?.src || "",
    pricing,
    topics: topicsSection ? linkValues(topicsSection, "/topics/") : [],
    team: teamSection ? profileLinks(teamSection) : [],
    rank: badgeMatch ? Number.parseInt(badgeMatch[1], 10) : null,
    rankPeriod: badgeMatch?.[2]?.toLowerCase() ?? null,
    rankedFor: badgeMatch?.[3] ?? null,
    points: parseCount(pointsButton?.textContent),
    commentsLoaded: block.querySelectorAll('[id^="comment-"][data-test^="comment-"]').length
  };
}

export function readProduct() {
  const main = document.querySelector<HTMLElement>("main");
  const slug = productSlug();
  const heading = main?.querySelector("h1");
  const header = main ? directMainChild(main, heading ?? null) : null;
  if (!main || !heading || !header || !slug) {
    return {
      ok: false,
      pageUrl: location.href,
      error: "Open a Product Hunt product page before calling producthunt_read_product."
    };
  }

  const ratingText = reviewValue(header, slug, /^\d+(?:\.\d+)?$/);
  const reviewsText = reviewValue(header, slug, /\breviews?\b/i);
  const followersText = Array.from(header.querySelectorAll("p"))
    .map(paragraph => cleanText(paragraph.textContent, 100))
    .find(text => /\bfollowers?\b/i.test(text)) ?? "";
  const launchesLink = header.querySelector<HTMLAnchorElement>(`a[href^="/products/${slug}/launches"]`);
  const logo = header.querySelector<HTMLImageElement>("img");

  return {
    ok: true,
    pageUrl: location.href,
    product: {
      name: cleanText(heading.textContent, 200),
      slug,
      url: canonicalUrl(`/products/${slug}`),
      tagline: cleanText(header.querySelector("h2")?.textContent, 300),
      description: productDescription(header),
      logoUrl: logo?.currentSrc || logo?.src || "",
      websiteUrl: externalWebsite(header),
      categories: linkValues(header, "/categories/"),
      rating: ratingText ? Number.parseFloat(ratingText) : null,
      reviewsCount: parseCount(reviewsText),
      followersCount: parseCount(followersText),
      launchesCount: parseCount(launchesLink?.textContent),
      featuredLaunch: featuredLaunch(main)
    }
  };
}
