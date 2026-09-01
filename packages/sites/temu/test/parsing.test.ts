import assert from "node:assert/strict";
import test from "node:test";
import {
  currentSearchQuery,
  isAuthenticationRequired,
  isSecurityVerification,
  isTemuHostname,
  normalizeTemuUrl,
  parseMoneyCandidates,
  parseRating,
  parseReviewCount,
  productIdFromUrl
} from "../src/api/parsing";

test("recognizes Temu hosts without accepting lookalikes", () => {
  assert.equal(isTemuHostname("www.temu.com"), true);
  assert.equal(isTemuHostname("temu.com"), true);
  assert.equal(isTemuHostname("temu.com.example.org"), false);
  assert.equal(isTemuHostname("eviltemu.com"), false);
});

test("extracts product ids from supported URL shapes", () => {
  assert.equal(productIdFromUrl("https://www.temu.com/goods.html?goods_id=601099512345678"), "601099512345678");
  assert.equal(productIdFromUrl("https://www.temu.com/example-product-g-601099598765432.html"), "601099598765432");
  assert.equal(productIdFromUrl("https://www.temu.com/product/601099500000001"), "601099500000001");
});

test("normalizes Temu product links and rejects foreign URLs", () => {
  assert.equal(
    normalizeTemuUrl(
      "/example-g-601099598765432.html?refer_page_name=search_result&foo=bar#reviews",
      "https://www.temu.com/search_result.html"
    ),
    "https://www.temu.com/example-g-601099598765432.html?foo=bar"
  );
  assert.equal(normalizeTemuUrl("https://temu.com.example.org/goods.html?goods_id=601099512345678"), "");
});

test("parses localized prices without confusing thousands and decimals", () => {
  assert.deepEqual(parseMoneyCandidates("€19.48")[0], { amount: 19.48, currency: "EUR", formatted: "€19.48" });
  assert.equal(parseMoneyCandidates("19,48 EUR")[0]?.amount, 19.48);
  assert.equal(parseMoneyCandidates("$1,299.00")[0]?.amount, 1299);
  assert.equal(parseMoneyCandidates("1.299,00 €")[0]?.amount, 1299);
});

test("parses ratings, compact review counts, and search queries", () => {
  assert.equal(parseRating("Rated 4.8 out of 5 stars"), 4.8);
  assert.equal(parseReviewCount("4.8 · 1.2K reviews"), 1200);
  assert.equal(parseReviewCount("$19.48 $29.99 · 1.2K reviews"), 1200);
  assert.equal(currentSearchQuery("https://www.temu.com/search_result.html?search_key=usb+c+hub"), "usb c hub");
});

test("recognizes Temu security verification pages", () => {
  assert.equal(isSecurityVerification("Security Verification — Slide to complete the puzzle"), true);
  assert.equal(isSecurityVerification("", "https://www.temu.com/bgn_verification.html?verifyCode=abc"), true);
  assert.equal(isSecurityVerification("<script src='https://static.kwcdn.com/upload-static/assets/chl/js/challenge.js'></script>"), true);
  assert.equal(isSecurityVerification("Search results for usb c hub"), false);
});

test("recognizes Temu login redirects without matching ordinary page text", () => {
  assert.equal(isAuthenticationRequired("", "https://www.temu.com/login.html?from=%2Fsearch_result.html"), true);
  assert.equal(isAuthenticationRequired("Sign in / Register Email or phone number Trouble signing in?"), true);
  assert.equal(isAuthenticationRequired("Sign in to receive member discounts", "https://www.temu.com/"), false);
});
