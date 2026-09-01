export function cleanText(value: string | null | undefined, maxLength = 500) {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function cleanMultilineText(value: string | null | undefined, maxLength = 10_000) {
  return (value ?? "")
    .split(/\r?\n/)
    .map(line => line.replace(/[\t ]+/g, " ").trim())
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1]))
    .join("\n")
    .trim()
    .slice(0, maxLength);
}

export function parseCount(value: string | null | undefined) {
  const text = cleanText(value, 40).toLowerCase();
  const match = text.match(/([\d.,]+)\s*([kmb])?/);
  if (!match) return null;

  const suffix = match[2];
  if (!suffix) {
    const digits = match[1].replace(/\D/g, "");
    return digits ? Number.parseInt(digits, 10) : null;
  }

  const normalized = match[1].replace(/,/g, ".");
  const numeric = Number.parseFloat(normalized);
  if (!Number.isFinite(numeric)) return null;

  const multiplier = suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : 1_000_000_000;
  return Math.round(numeric * multiplier);
}

export function canonicalUrl(href: string) {
  try {
    return new URL(href, location.origin).href;
  } catch {
    return "";
  }
}

export function clampInteger(value: number | undefined, fallback: number, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}

export function directMainChild(main: HTMLElement, element: Element | null) {
  if (!element) return null;
  let current: Element = element;
  while (current.parentElement && current.parentElement !== main) current = current.parentElement;
  return current.parentElement === main ? current as HTMLElement : null;
}
