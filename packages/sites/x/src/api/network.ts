export type XPost = {
  id: string;
  url: string;
  author: string;
  handle: string;
  text: string;
  createdAt: string | null;
  metrics: {
    replies: number;
    reposts: number;
    likes: number;
    bookmarks: number;
  };
};

const state = {
  installed: false,
  transactionId: "",
  operations: new Set<string>(),
  posts: [] as XPost[]
};

function normalizePost(value: Record<string, any>): XPost | null {
  const tweet = value.__typename === "TweetWithVisibilityResults" ? value.tweet : value;
  const legacy = tweet?.legacy;
  const text = tweet?.note_tweet?.note_tweet_results?.result?.text ?? legacy?.full_text;
  const id = tweet?.rest_id ?? legacy?.id_str;
  if (!id || !text) return null;

  const user = tweet?.core?.user_results?.result;
  const handle = user?.core?.screen_name ?? user?.legacy?.screen_name ?? "";

  return {
    id,
    url: handle ? `https://x.com/${handle}/status/${id}` : `https://x.com/i/web/status/${id}`,
    author: user?.core?.name ?? user?.legacy?.name ?? "",
    handle: handle ? `@${handle}` : "",
    text,
    createdAt: legacy?.created_at ?? null,
    metrics: {
      replies: legacy?.reply_count ?? 0,
      reposts: legacy?.retweet_count ?? 0,
      likes: legacy?.favorite_count ?? 0,
      bookmarks: legacy?.bookmark_count ?? 0
    }
  };
}

function extractPosts(value: unknown, posts: XPost[] = []): XPost[] {
  if (!value || typeof value !== "object") return posts;
  if (Array.isArray(value)) {
    value.forEach(item => extractPosts(item, posts));
    return posts;
  }

  const record = value as Record<string, unknown>;
  const post = normalizePost(record);
  if (post) posts.push(post);
  Object.values(record).forEach(item => extractPosts(item, posts));
  return posts;
}

function mergePosts(posts: XPost[]) {
  const existing = new Map(state.posts.map(post => [post.id, post]));
  const next = posts.filter((post, index) => posts.findIndex(item => item.id === post.id) === index);
  next.forEach(post => existing.delete(post.id));
  state.posts = [...next, ...existing.values()].slice(0, 200);
}

async function captureResponse(response: Response) {
  const url = new URL(response.url);
  if (!url.pathname.includes("/graphql/")) return;

  state.operations.add(url.pathname.split("/").pop() ?? "unknown");
  try {
    mergePosts(extractPosts(await response.json()));
  } catch {}
}

function captureRequest(request: Request) {
  const transactionId = request.headers.get("x-client-transaction-id");
  if (transactionId) state.transactionId = transactionId;
}

export function installNetworkCapture() {
  if (state.installed) return;
  state.installed = true;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function(input, init) {
    try {
      captureRequest(new Request(input, init));
    } catch {}

    const response = await nativeFetch(input, init);
    void captureResponse(response.clone());
    return response;
  };
}

export function getCapturedPosts(limit: number) {
  return state.posts.slice(0, Math.max(1, Math.min(limit, 100)));
}

export function getNetworkStatus() {
  return {
    capturedOperations: [...state.operations],
    capturedPostCount: state.posts.length,
    hasTransactionId: Boolean(state.transactionId)
  };
}

export function getLastTransactionId() {
  return state.transactionId || null;
}
