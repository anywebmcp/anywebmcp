import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test, { type TestContext } from "node:test";
import { assertSiteContract, importAndMountSite } from "@anywebmcp/common/test";
import { DOMParser as LinkedomDOMParser } from "linkedom";

const TOOL_NAMES = [
  "producthunt_list_launches",
  "producthunt_read_product",
  "producthunt_list_comments",
  "producthunt_search_products"
] as const;

type FetchFixture = (
  input: URL | RequestInfo,
  init?: RequestInit
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

async function fixture(name: string) {
  return readFile(resolve("test", "fixtures", name), "utf8");
}

function replaceGlobal(name: string, value: unknown) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  return () => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else delete (globalThis as unknown as Record<string, unknown>)[name];
  };
}

async function mountFixture(
  t: TestContext,
  fixtureName: string,
  url: string,
  fetchFixture?: FetchFixture
) {
  const html = await fixture(fixtureName);
  const documentRoot = new LinkedomDOMParser().parseFromString(html, "text/html");
  const locationFixture = new URL(url);
  const restore = [
    replaceGlobal("location", locationFixture),
    replaceGlobal("DOMParser", LinkedomDOMParser)
  ];
  if (fetchFixture) restore.push(replaceGlobal("fetch", fetchFixture));

  try {
    const harness = await importAndMountSite(
      () => import("../src/index"),
      { document: documentRoot, window: { location: locationFixture } }
    );
    t.after(() => {
      harness.dispose();
      for (const restoreGlobal of restore.reverse()) restoreGlobal();
    });
    return Object.assign(harness, { documentRoot });
  } catch (error) {
    for (const restoreGlobal of restore.reverse()) restoreGlobal();
    throw error;
  }
}

test("registers all four read-only Product Hunt tools and lists homepage sections", async t => {
  const harness = await mountFixture(t, "homepage.html", "https://www.producthunt.com/");
  assertSiteContract(harness, TOOL_NAMES);
  for (const { tool } of harness.registrations) {
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.equal(tool.annotations?.untrustedContentHint, true);
  }

  const all = await harness.execute<{
    count: number;
    totalMounted: number;
    launches: Array<{
      rank: number;
      name: string;
      url: string;
      section: string;
      commentsCount: number;
      topics: Array<{ url: string }>;
    }>;
  }>("producthunt_list_launches");
  assert.equal(all.status, "completed");
  if (all.status !== "completed") return;
  assert.equal(all.data.count, 3);
  assert.deepEqual(all.data.launches.map(launch => launch.name), ["Alpha", "Bravo", "Charlie"]);
  assert.deepEqual(all.data.launches.map(launch => launch.rank), [1, 2, 2]);
  assert.deepEqual(all.data.launches.map(launch => launch.section), ["today", "today", "yesterday"]);
  assert.equal(all.data.totalMounted, 3);
  assert.equal(
    all.data.launches[0].url,
    "https://www.producthunt.com/products/alpha?ref=homepage&launch=alpha-launch"
  );
  assert.equal(all.data.launches[0].topics[0].url, "https://www.producthunt.com/topics/productivity?ref=homepage");
  assert.equal(
    [...all.data.launches.filter(launch => launch.section === "today")]
      .sort((left, right) => right.commentsCount - left.commentsCount)[0].name,
    "Alpha"
  );
  assert.ok(!all.data.launches.some(launch => launch.name === "Wispr Flow"));

  const yesterday = await harness.execute<{ count: number; launches: Array<{ name: string }> }>(
    "producthunt_list_launches",
    { section: "yesterday" }
  );
  assert.deepEqual(yesterday, {
    status: "completed",
    data: {
      pageUrl: "https://www.producthunt.com/",
      pageTitle: "Product Hunt – The best new products in tech.",
      requestedSection: "yesterday",
      availableSections: ["today", "yesterday"],
      offset: 0,
      limit: 20,
      count: 1,
      totalMatched: 1,
      totalMounted: 3,
      launches: [all.data.launches[2]]
    }
  });
});

test("keeps displayed leaderboard ranks and section classification", async t => {
  const harness = await mountFixture(
    t,
    "leaderboard.html",
    "https://www.producthunt.com/leaderboard/yearly/2026"
  );
  const result = await harness.execute<{
    launches: Array<{ name: string; rank: number; section: string; commentsCount: number; upvotesCount: number }>;
  }>("producthunt_list_launches");
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  assert.deepEqual(result.data.launches, [{
    rank: 7,
    name: "Yearly",
    slug: "yearly",
    url: "https://www.producthunt.com/products/yearly",
    tagline: "One of the year's best launches",
    topics: [{
      name: "Artificial Intelligence",
      slug: "artificial-intelligence",
      url: "https://www.producthunt.com/topics/artificial-intelligence"
    }],
    commentsCount: 88,
    upvotesCount: 4500,
    imageUrl: "https://ph-files.imgix.net/yearly.png",
    section: "leaderboard",
    sectionTitle: "Best of Product Hunt"
  }]);
});

test("extracts the current product and featured launch", async t => {
  const harness = await mountFixture(
    t,
    "product.html",
    "https://www.producthunt.com/products/alpha"
  );
  const result = await harness.execute<{
    product: {
      name: string;
      url: string;
      description: string;
      websiteUrl: string;
      followersCount: number;
      featuredLaunch: {
        name: string;
        rank: number;
        rankPeriod: string;
        points: number;
        commentsLoaded: number;
        team: Array<{ name: string; url: string }>;
      };
    };
  }>("producthunt_read_product");
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  assert.equal(result.data.product.name, "Alpha");
  assert.equal(result.data.product.url, "https://www.producthunt.com/products/alpha");
  assert.equal(result.data.product.description, "Alpha keeps projects, notes, and decisions in one quiet workspace.");
  assert.equal(result.data.product.websiteUrl, "https://alpha.example/product-hunt");
  assert.equal(result.data.product.followersCount, 1200);
  assert.equal(result.data.product.featuredLaunch.name, "Alpha 2.0");
  assert.equal(result.data.product.featuredLaunch.rank, 3);
  assert.equal(result.data.product.featuredLaunch.rankPeriod, "day");
  assert.equal(result.data.product.featuredLaunch.points, 1300);
  assert.equal(result.data.product.featuredLaunch.commentsLoaded, 2);
  assert.deepEqual(result.data.product.featuredLaunch.team, [{
    name: "Alice Maker",
    handle: "alice",
    url: "https://www.producthunt.com/@alice",
    avatarUrl: "https://ph-files.imgix.net/alice.png"
  }]);
});

test("reads a current launch without a separate launch heading and lists its comments", async t => {
  const harness = await mountFixture(
    t,
    "current-product.html",
    "https://www.producthunt.com/products/loqua?launch=loqua-2"
  );
  const product = await harness.execute<{
    product: {
      featuredLaunch: {
        name: string;
        tagline: string;
        status: string;
        description: string;
        commentsLoaded: number;
      } | null;
    };
  }>("producthunt_read_product");
  assert.equal(product.status, "completed");
  if (product.status !== "completed") return;
  assert.deepEqual(product.data.product.featuredLaunch, {
    name: "Loqua",
    tagline: "Speak naturally. Move from thoughts to done.",
    status: "Launching today",
    description: "Your thoughts should not have to slow down for a keyboard. Loqua turns spoken ideas into ready-to-use work.",
    imageUrl: "https://ph-files.imgix.net/loqua.png",
    pricing: "Free Options",
    topics: [
      { name: "Productivity", slug: "productivity", url: "https://www.producthunt.com/topics/productivity" },
      {
        name: "Artificial Intelligence",
        slug: "artificial-intelligence",
        url: "https://www.producthunt.com/topics/artificial-intelligence"
      }
    ],
    team: [{
      name: "Joshua Zhou",
      handle: "joshua",
      url: "https://www.producthunt.com/@joshua",
      avatarUrl: "https://ph-files.imgix.net/joshua.png"
    }],
    rank: null,
    rankPeriod: null,
    rankedFor: null,
    points: null,
    commentsLoaded: 1
  });

  const comments = await harness.execute<{ count: number; comments: Array<{ id: string; text: string }> }>(
    "producthunt_list_comments"
  );
  assert.equal(comments.status, "completed");
  if (comments.status !== "completed") return;
  assert.equal(comments.data.count, 1);
  assert.equal(comments.data.comments[0].id, "501");
});

test("waits briefly for a requested launch and comments to finish streaming", async t => {
  const harness = await mountFixture(
    t,
    "current-product.html",
    "https://www.producthunt.com/products/loqua?launch=loqua-2"
  );
  const launch = harness.documentRoot.querySelector('[data-test="launch"]');
  assert.ok(launch);
  launch.remove();

  const productPromise = harness.execute<{ product: { featuredLaunch: { name: string } | null } }>(
    "producthunt_read_product"
  );
  const commentsPromise = harness.execute<{ count: number }>("producthunt_list_comments");
  setTimeout(() => harness.documentRoot.querySelector("main")?.append(launch), 25);

  const [product, comments] = await Promise.all([productPromise, commentsPromise]);
  assert.equal(product.status, "completed");
  if (product.status === "completed") assert.equal(product.data.product.featuredLaunch?.name, "Loqua");
  assert.equal(comments.status, "completed");
  if (comments.status === "completed") assert.equal(comments.data.count, 1);
});

test("returns a launch-specific URL for a multi-launch product", async t => {
  const homepage = await mountFixture(t, "multi-launch-homepage.html", "https://www.producthunt.com/");
  const listed = await homepage.execute<{ launches: Array<{ url: string }> }>(
    "producthunt_list_launches",
    { section: "today" }
  );
  assert.equal(listed.status, "completed");
  if (listed.status !== "completed") return;
  const launchUrl = "https://www.producthunt.com/products/cleanshot?launch=cleanshot-5-0-with-studio-mode";
  assert.equal(listed.data.launches[0].url, launchUrl);

  const generic = await mountFixture(
    t,
    "multi-launch-generic.html",
    "https://www.producthunt.com/products/cleanshot"
  );
  const genericProduct = await generic.execute<{ product: { featuredLaunch: unknown } }>("producthunt_read_product");
  assert.equal(genericProduct.status, "completed");
  if (genericProduct.status !== "completed") return;
  assert.equal(genericProduct.data.product.featuredLaunch, null);
  assert.deepEqual(await generic.execute("producthunt_list_comments"), {
    status: "failed",
    message: "Open a Product Hunt product launch with comments before calling producthunt_list_comments."
  });

  const launch = await mountFixture(t, "multi-launch-current.html", launchUrl);
  const launchProduct = await launch.execute<{
    product: { featuredLaunch: { name: string; commentsLoaded: number } | null };
  }>("producthunt_read_product");
  assert.equal(launchProduct.status, "completed");
  if (launchProduct.status !== "completed") return;
  assert.equal(launchProduct.data.product.featuredLaunch?.name, "CleanShot 5.0 with Studio Mode");
  assert.equal(launchProduct.data.product.featuredLaunch?.commentsLoaded, 1);
  const comments = await launch.execute<{ count: number }>("producthunt_list_comments");
  assert.equal(comments.status, "completed");
  if (comments.status === "completed") assert.equal(comments.data.count, 1);
});

test("returns comments as a flat reply tree with canonical links", async t => {
  const harness = await mountFixture(
    t,
    "comments.html",
    "https://www.producthunt.com/products/alpha?page=2#comments"
  );
  const result = await harness.execute<{
    previousPageUrl: string;
    nextPageUrl: string;
    comments: Array<{
      id: string;
      parentId: string | null;
      depth: number;
      url: string;
      isMaker: boolean;
      isPinned: boolean;
      isVerified: boolean;
      makerProduct: { url: string } | null;
    }>;
  }>("producthunt_list_comments");
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  assert.equal(result.data.previousPageUrl, "https://www.producthunt.com/products/alpha?page=1");
  assert.equal(result.data.nextPageUrl, "https://www.producthunt.com/products/alpha?page=3");
  assert.deepEqual(result.data.comments.map(comment => ({
    id: comment.id,
    parentId: comment.parentId,
    depth: comment.depth
  })), [
    { id: "101", parentId: null, depth: 0 },
    { id: "102", parentId: "101", depth: 1 }
  ]);
  assert.equal(result.data.comments[0].url, "https://www.producthunt.com/products/alpha?page=2&comment=101");
  assert.equal(result.data.comments[0].isMaker, true);
  assert.equal(result.data.comments[0].isPinned, true);
  assert.equal(result.data.comments[0].makerProduct?.url, "https://www.producthunt.com/products/alpha");
  assert.equal(result.data.comments[1].isVerified, true);
});

test("parses valid search hydration and canonical product URLs", async t => {
  const searchHtml = await fixture("search-valid.html");
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const harness = await mountFixture(
    t,
    "search-missing-hydration.html",
    "https://www.producthunt.com/",
    async (input, init) => {
      requestedUrl = String(input);
      requestedInit = init;
      return { ok: true, status: 200, async text() { return searchHtml; } };
    }
  );
  const result = await harness.execute<{
    page: number;
    count: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
    products: Array<{ name: string; url: string; imageUrl: string }>;
  }>("producthunt_search_products", { query: "  useful   products ", page: 2 });
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  assert.equal(requestedUrl, "https://www.producthunt.com/search?q=useful+products&page=2");
  assert.equal(requestedInit?.credentials, "include");
  assert.equal(result.data.page, 2);
  assert.equal(result.data.count, 1);
  assert.equal(result.data.hasPreviousPage, true);
  assert.equal(result.data.hasNextPage, false);
  assert.equal(result.data.products[0].name, "Alpha Search");
  assert.equal(result.data.products[0].url, "https://www.producthunt.com/products/alpha-search");
  assert.equal(
    result.data.products[0].imageUrl,
    "https://ph-files.imgix.net/logo%2Falpha.png?auto=compress,format&fit=crop&h=96&w=96"
  );
});

test("returns wrapped failures for missing hydration, HTTP errors, and oversized responses", async t => {
  await t.test("missing hydration", async t => {
    const missingHtml = await fixture("search-missing-hydration.html");
    const harness = await mountFixture(
      t,
      "search-missing-hydration.html",
      "https://www.producthunt.com/",
      async () => ({ ok: true, status: 200, async text() { return missingHtml; } })
    );
    assert.deepEqual(await harness.execute("producthunt_search_products", { query: "alpha" }), {
      status: "failed",
      message: "Product Hunt search data was not found in the returned page."
    });
  });

  await t.test("HTTP error", async t => {
    const { status } = JSON.parse(await fixture("search-http-error.json")) as { status: number };
    const harness = await mountFixture(
      t,
      "search-missing-hydration.html",
      "https://www.producthunt.com/",
      async () => ({ ok: false, status, async text() { return ""; } })
    );
    assert.deepEqual(await harness.execute("producthunt_search_products", { query: "alpha" }), {
      status: "failed",
      message: "Product Hunt search returned HTTP 503."
    });
  });

  await t.test("oversized response", async t => {
    const { bodyLength } = JSON.parse(await fixture("search-oversized-response.json")) as { bodyLength: number };
    const harness = await mountFixture(
      t,
      "search-missing-hydration.html",
      "https://www.producthunt.com/",
      async () => ({ ok: true, status: 200, async text() { return "x".repeat(bodyLength); } })
    );
    assert.deepEqual(await harness.execute("producthunt_search_products", { query: "alpha" }), {
      status: "failed",
      message: "Product Hunt search response was unexpectedly large."
    });
  });
});
