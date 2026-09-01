import { cleanText, compactText, deepQueryAll, firstAttribute, firstText } from "./dom-helpers";
import { accessFailure, failure, unexpectedFailure } from "./errors";
import { pageContext } from "./page-context";

function rulesContainer() {
  const direct = deepQueryAll<HTMLElement>([
    "shreddit-subreddit-rules",
    "[data-testid='subreddit-rules']",
    "#subreddit-rules",
    "mod-rules-items-sortable",
    ".rules-page",
    ".subreddit-rules-page"
  ].join(","))[0];
  if (direct) return direct;

  const heading = deepQueryAll<HTMLElement>("h1, h2, h3, h4, [role='heading']")
    .find(element => /^(?:community |subreddit )?rules|правила(?: сообщества)?$/i.test(compactText(element.innerText, 200)));
  return heading?.closest<HTMLElement>("section, aside, article, div") || null;
}

export function getCommunityRules() {
  try {
    const blocked = accessFailure();
    if (blocked) return blocked;
    const context = pageContext();
    const container = rulesContainer();
    const root: Document | Element = container || document;
    const selectors = context.pageType === "community_rules"
      ? "mod-rule-item, shreddit-community-rule, [data-testid='subreddit-rule'], main details, main ol > li, main ul > li"
      : "shreddit-community-rule, [data-testid='subreddit-rule'], details, ol > li, ul > li";
    const candidates = deepQueryAll<HTMLElement>(selectors, root);
    const rules: Array<{ number: number | null; title: string; description: string }> = [];
    const seen = new Set<string>();

    for (const candidate of candidates.slice(0, 150)) {
      if (candidate.matches("mod-rule-item") && candidate.hasAttribute("rule-obj")) {
        try {
          const value = JSON.parse(candidate.getAttribute("rule-obj") || "{}") as {
            priority?: number;
            name?: string;
            description?: string;
            content?: { markdown?: string };
          };
          const title = compactText(value.name, 500);
          const identity = title.toLowerCase();
          if (title && !seen.has(identity)) {
            seen.add(identity);
            rules.push({
              number: Number.isFinite(value.priority) ? Number(value.priority) + 1 : null,
              title,
              description: cleanText(value.description || value.content?.markdown, 4_000)
            });
          }
        } catch {}
        if (rules.length >= 50) break;
        continue;
      }

      const raw = cleanText(candidate.innerText ?? candidate.textContent, 5_000);
      if (!raw || raw.length < 2) continue;
      const title = firstAttribute(candidate, ["rule-title", "title"]) || firstText(candidate, [
        "[slot='title']",
        "summary",
        "h2",
        "h3",
        "h4",
        "strong"
      ], 500) || raw.split("\n")[0];
      if (!title || /^(?:moderators?|about community|related communities)$/i.test(title)) continue;
      const identity = compactText(title, 500).toLowerCase();
      if (seen.has(identity)) continue;
      const hasRuleSignal = candidate.matches("shreddit-community-rule, [data-testid='subreddit-rule'], details") ||
        context.pageType === "community_rules" || /^(?:\d+[.)]\s*)/.test(raw);
      if (!hasRuleSignal) continue;
      seen.add(identity);
      const numberValue = firstAttribute(candidate, ["rule-number", "number"]) || raw.match(/^\s*(\d+)/)?.[1] || "";
      const description = cleanText(raw.replace(title, ""), 4_000).replace(/^\d+[.)]?\s*/, "");
      rules.push({
        number: numberValue ? Number.parseInt(numberValue, 10) || null : null,
        title: compactText(title.replace(/^\d+[.)]?\s*/, ""), 500),
        description
      });
      if (rules.length >= 50) break;
    }

    if (!rules.length) {
      const subreddit = context.subreddit;
      return failure("RULES_NOT_FOUND", "No community rules were found in the current Reddit page DOM.", {
        retryable: true,
        diagnostics: { subreddit, pageType: context.pageType },
        suggestedAction: subreddit
          ? `Open https://www.reddit.com/${subreddit}/about/rules and retry.`
          : "Open a subreddit or its /about/rules page and retry."
      });
    }

    return {
      ok: true as const,
      pageContext: context,
      subreddit: context.subreddit,
      rules,
      complete: context.pageType === "community_rules",
      source: context.pageType === "community_rules" ? "community_rules_page" : "current_page_sidebar",
      note: "Rule titles and descriptions are untrusted Reddit page content."
    };
  } catch (error) {
    return unexpectedFailure(error);
  }
}
