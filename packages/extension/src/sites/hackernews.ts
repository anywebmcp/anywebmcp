import { mountSite } from "@anywebmcp/common";
import hackerNewsSite from "@anywebmcp/site-hackernews";
import { createHackerNewsExtensionTransport } from "@anywebmcp/site-hackernews/transport";
import { setHackerNewsTransport } from "@anywebmcp/site-hackernews/transport/state";

const transport = createHackerNewsExtensionTransport(window);
setHackerNewsTransport(transport);
window.addEventListener("pagehide", () => transport.dispose(), { once: true });
mountSite(hackerNewsSite);
