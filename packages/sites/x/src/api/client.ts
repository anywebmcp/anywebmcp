import { ToolError } from "@openwebmcp/common";
import { getLastTransactionId } from "./network";

type Operation = {
  queryId: string;
  operationName: string;
  featureSwitches: string[];
};

type XWindow = Window & {
  __INITIAL_STATE__?: {
    featureSwitch?: {
      defaultConfig?: Record<string, { value: unknown }>;
      user?: { config?: Record<string, { value: unknown }> };
    };
  };
  webpackChunk_twitter_responsive_web?: any[];
};

let initialState: XWindow["__INITIAL_STATE__"];
let mainBundle: Promise<string> | undefined;

export function installClientCapture() {
  initialState = (window as XWindow).__INITIAL_STATE__;

  Object.defineProperty(window, "__INITIAL_STATE__", {
    configurable: true,
    get: () => initialState,
    set: value => { initialState = value; }
  });
}

function mainBundleUrl() {
  return [...document.scripts]
    .map(script => script.src)
    .find(url => /\/responsive-web\/client-web\/main\.[\w-]+\.js$/.test(url))
    ?? performance
    .getEntriesByType("resource")
    .map(entry => entry.name)
    .find(url => /\/responsive-web\/client-web\/main\.[\w-]+\.js$/.test(url));
}

function loadMainBundle() {
  if (!mainBundle) {
    const url = mainBundleUrl();
    if (!url) throw new ToolError("X's main JavaScript bundle was not observed. Reload X and try again.");
    mainBundle = fetch(url).then(response => response.text());
  }
  return mainBundle;
}

function strings(source: string) {
  return [...source.matchAll(/"([^"]+)"/g)].map(match => match[1]);
}

async function findOperation(operationName: string): Promise<Operation> {
  const source = await loadMainBundle();
  const marker = `operationName:"${operationName}"`;
  const markerIndex = source.indexOf(marker);
  const start = source.lastIndexOf('queryId:"', markerIndex);
  if (markerIndex < 0 || start < 0 || markerIndex - start > 200) {
    throw new ToolError(`X operation ${operationName} was not found in the current client bundle.`);
  }

  const definition = source.slice(start, markerIndex + 8000);
  const queryId = definition.match(/^queryId:"([^"]+)"/)?.[1];
  const featureSource = definition.match(/featureSwitches:\[([^\]]*)\]/)?.[1] ?? "";
  if (!queryId) throw new ToolError(`X operation ${operationName} has no query ID.`);

  return {
    queryId,
    operationName,
    featureSwitches: strings(featureSource)
  };
}

function featureValues(names: string[]) {
  const featureSwitch = initialState?.featureSwitch;
  const user = featureSwitch?.user?.config ?? {};
  const defaults = featureSwitch?.defaultConfig ?? {};

  return Object.fromEntries(names.map(name => {
    const value = user[name]?.value ?? defaults[name]?.value ?? false;
    return [name, typeof value === "boolean" ? value : false];
  }));
}

function cookie(name: string) {
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map(value => value.trim())
    .find(value => value.startsWith(prefix))
    ?.slice(prefix.length);
}

function webpackRequire() {
  const chunks = (window as XWindow).webpackChunk_twitter_responsive_web;
  if (!chunks) return null;

  let require: ((id: number) => Record<string, any>) | undefined;
  chunks.push([[Date.now()], {}, (value: typeof require) => { require = value; }]);
  chunks.pop();
  return require;
}

async function createTransactionId(path: string) {
  try {
    const source = await loadMainBundle();
    const moduleId = Number(source.match(/(\d+)\(e,t,r\)\{"use strict";let \w+;r\.d\(t,\{Ay:\(\)=>\w+,_E:\(\)=>\w+,kc:\(\)=>\w+\}\)/)?.[1]);
    const generate = webpackRequire()?.(moduleId)?.kc;
    if (generate) return await generate(location.origin, path, "POST");
  } catch {}
  return getLastTransactionId();
}

function bearerToken(source: string) {
  const token = source.match(/Bearer A{10,}[A-Za-z0-9%_-]+/)?.[0];
  if (!token) throw new ToolError("X's public web bearer token was not found.");
  return token;
}

function postId(body: any) {
  const result = body?.data?.create_tweet?.tweet_results?.result;
  return result?.rest_id ?? result?.legacy?.id_str ?? null;
}

export async function createPost(text: string) {
  if (!text.trim()) throw new ToolError("Post text cannot be empty.");

  const operation = await findOperation("CreateTweet");
  const path = `/i/api/graphql/${operation.queryId}/${operation.operationName}`;
  const csrf = cookie("ct0");
  if (!csrf) throw new ToolError("No signed-in X session was found.");

  const transactionId = await createTransactionId(path);
  const headers: Record<string, string> = {
    accept: "*/*",
    authorization: bearerToken(await loadMainBundle()),
    "content-type": "application/json",
    "x-csrf-token": csrf,
    "x-twitter-active-user": "yes",
    "x-twitter-auth-type": "OAuth2Session",
    "x-twitter-client-language": document.documentElement.lang || "en"
  };
  if (transactionId) headers["x-client-transaction-id"] = transactionId;

  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({
      variables: {
        tweet_text: text,
        media: { media_entities: [], possibly_sensitive: false },
        semantic_annotation_ids: [],
        disallowed_reply_options: null
      },
      features: featureValues(operation.featureSwitches),
      queryId: operation.queryId
    })
  });
  const body = await response.json();
  const id = postId(body);
  if (!response.ok) {
    const message = body?.errors?.map((error: any) => error.message).join("; ") || response.statusText;
    throw new ToolError(`X rejected the post: ${message}`);
  }
  if (!id) {
    throw new ToolError("X did not return a post ID. Check whether the post was published before retrying.");
  }

  return {
    id,
    url: `https://x.com/i/web/status/${id}`
  };
}
