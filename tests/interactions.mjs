// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: MIT

import assert from "node:assert/strict";
import process from "node:process";

import { chromium } from "playwright";

import { startWorker } from "./worker-server.mjs";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const worker = await startWorker();
let browser;

async function waitForCopyState(page, selector, state) {
  await page.waitForFunction(
    ({ buttonSelector, expectedState }) =>
      document.querySelector(buttonSelector)?.dataset.state === expectedState,
    { buttonSelector: selector, expectedState: state },
  );
}

try {
  browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });

  const successContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await successContext.addInitScript(() => {
    window.__copiedText = null;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__copiedText = text;
        },
      },
    });
  });
  const successPage = await successContext.newPage();
  await successPage.goto(`${worker.base}/`);
  const firstCopy = successPage.locator(".copy").first();
  await firstCopy.focus();
  await successPage.keyboard.press("Enter");
  await waitForCopyState(successPage, ".copy", "success");
  assert.equal(
    await successPage.evaluate(() => window.__copiedText),
    "curl -fsSLO https://github.com/gitcalver/sh/releases/latest/download/gitcalver.sh\nchmod +x gitcalver.sh",
    "keyboard activation writes the exact install command",
  );
  assert.equal(
    await firstCopy.locator(".copy-label").textContent(),
    "Copied",
    "success is visible on the control",
  );
  await successPage.waitForFunction(
    () =>
      document.querySelector(".copy-status")?.textContent ===
      "Copied to clipboard.",
  );
  assert.equal(
    await firstCopy
      .locator(".copy-icon-success")
      .evaluate((element) => getComputedStyle(element).display),
    "block",
    "success uses the check icon",
  );
  assert.equal(
    await successPage.evaluate(() => document.activeElement?.className),
    "copy",
    "copy success preserves keyboard focus",
  );
  await successContext.close();

  const fallbackContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await fallbackContext.addInitScript(() => {
    window.__fallbackCopiedText = null;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    document.execCommand = (command) => {
      if (command !== "copy") return false;
      window.__fallbackCopiedText = document.activeElement?.value;
      return true;
    };
  });
  const fallbackPage = await fallbackContext.newPage();
  await fallbackPage.goto(`${worker.base}/`);
  const secondCopy = fallbackPage.locator(".copy").nth(1);
  await secondCopy.click();
  await fallbackPage.waitForFunction(
    () => document.querySelectorAll(".copy")[1]?.dataset.state === "success",
  );
  assert.equal(
    await fallbackPage.evaluate(() => window.__fallbackCopiedText),
    "./gitcalver.sh",
    "the synchronous fallback copies when the Clipboard API is denied",
  );
  assert.equal(
    await fallbackPage.evaluate(() => document.activeElement?.className),
    "copy",
    "fallback copy returns focus to the control",
  );
  await fallbackContext.close();

  const failureContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await failureContext.addInitScript(() => {
    window.__legacyFallbackAttempted = false;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("permission denied");
        },
      },
    });
    document.execCommand = () => {
      window.__legacyFallbackAttempted = true;
      return true;
    };
  });
  const failurePage = await failureContext.newPage();
  await failurePage.goto(`${worker.base}/`);
  const thirdCopy = failurePage.locator(".copy").nth(2);
  await thirdCopy.click();
  await failurePage.waitForFunction(
    () => document.querySelectorAll(".copy")[2]?.dataset.state === "error",
  );
  assert.equal(
    await thirdCopy.locator(".copy-label").textContent(),
    "Try again",
    "copy failure is visible on the control",
  );
  await failurePage.waitForFunction(
    () =>
      document.querySelectorAll(".copy-status")[2]?.textContent ===
      "Couldn’t copy. Select the command and copy it manually.",
  );
  assert.equal(await thirdCopy.isEnabled(), true, "failed copy can be retried");
  assert.equal(
    await failurePage.evaluate(() => window.__legacyFallbackAttempted),
    false,
    "a rejected modern copy does not attempt a late synchronous fallback",
  );
  assert.equal(
    await thirdCopy
      .locator(".copy-icon-error")
      .evaluate((element) => getComputedStyle(element).display),
    "block",
    "failure uses the error icon",
  );
  await failureContext.close();

  const desktopContext = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1280, height: 900 },
  });
  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto(`${worker.base}/getting-started`);
  const desktopToc = desktopPage.locator(".toc-desktop");
  assert.equal(await desktopToc.isVisible(), true, "desktop TOC is visible");
  assert.equal(
    await desktopPage.locator(".toc-mobile").isVisible(),
    false,
    "mobile TOC is hidden at desktop width",
  );
  assert.equal(
    await desktopToc.getByRole("link").count(),
    8,
    "desktop TOC contains each section",
  );
  const dockerLink = desktopToc.getByRole("link", { name: "Docker" });
  await dockerLink.focus();
  await desktopPage.keyboard.press("Enter");
  await desktopPage.waitForFunction(() => location.hash === "#docker");
  await desktopPage.waitForFunction(
    () =>
      document.querySelectorAll(
        '.page-toc a[href="#docker"][aria-current="location"]',
      ).length === 2,
  );
  assert.equal(
    await desktopPage
      .locator("#docker")
      .evaluate((heading) => heading.getBoundingClientRect().top >= 62),
    true,
    "TOC navigation leaves the heading below the sticky header",
  );
  await desktopContext.close();

  const mobileContext = await browser.newContext({
    viewport: { width: 320, height: 800 },
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${worker.base}/getting-started`);
  assert.equal(
    await mobilePage.locator(".toc-desktop").isVisible(),
    false,
    "desktop TOC is hidden at mobile width",
  );
  const mobileToc = mobilePage.locator(".toc-mobile");
  assert.equal(await mobileToc.isVisible(), true, "mobile TOC is visible");
  assert.equal(
    await mobileToc.evaluate((details) => details.open),
    false,
    "mobile TOC starts collapsed",
  );
  const summary = mobileToc.locator("summary");
  await summary.focus();
  await mobilePage.keyboard.press("Space");
  assert.equal(
    await mobileToc.evaluate((details) => details.open),
    true,
    "Space opens the mobile TOC",
  );
  await mobilePage.keyboard.press("Tab");
  assert.equal(
    await mobilePage.evaluate(() => document.activeElement?.textContent),
    "Shell script",
    "the first mobile TOC link follows its summary in keyboard order",
  );
  await mobileContext.close();

  const overflowContext = await browser.newContext({
    viewport: { width: 320, height: 800 },
  });
  const overflowPage = await overflowContext.newPage();
  await overflowPage.goto(`${worker.base}/compatibility`);
  await overflowPage.evaluate(() => document.fonts.ready);
  const table = overflowPage.locator(".prose table").first();
  await table.waitFor();
  await overflowPage.waitForFunction(
    () =>
      document.querySelector(".prose table")?.dataset.horizontalScroll ===
      "true",
  );
  assert.equal(
    await table.getAttribute("tabindex"),
    "0",
    "overflowing table enters the keyboard order",
  );
  assert.match(
    await table.getAttribute("aria-describedby"),
    /horizontal-scroll-instructions/,
    "overflowing table exposes keyboard instructions",
  );
  await table.focus();
  await overflowPage.keyboard.press("ArrowRight");
  await overflowPage.waitForFunction(
    () => document.querySelector(".prose table")?.scrollLeft > 0,
  );
  assert(
    (await table.evaluate((element) => element.scrollLeft)) > 0,
    "ArrowRight scrolls the focused table",
  );
  await overflowContext.close();

  console.log(
    "interaction tests OK (copy success/fallback/failure, TOCs, scrollspy, overflow)",
  );
} finally {
  if (browser) await browser.close();
  await worker.stop();
}
