import { cleanText } from "../api/parsing";

export function elementText(root: ParentNode, selectors: string[], maxLength = 1_000) {
  for (const selector of selectors) {
    const text = cleanText(root.querySelector<HTMLElement>(selector)?.innerText, maxLength);
    if (text) return text;
  }
  return "";
}

export function deliveryText(value: string) {
  const patterns = [
    /(?:delivery|arrives?|ships?)\b[^.!|]{0,160}/i,
    /(?:доставк\w*|прибудет)\b[^.!|]{0,160}/i,
    /(?:Lieferung|livraison|consegna)\b[^.!|]{0,160}/i
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern)?.[0];
    if (match) return cleanText(match, 180);
  }
  return "";
}

export function objectValue(record: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    if (record[name] !== undefined && record[name] !== null) return record[name];
  }
  return undefined;
}

export function scalarText(value: unknown, maxLength = 500) {
  return typeof value === "string" || typeof value === "number"
    ? cleanText(value, maxLength)
    : "";
}
