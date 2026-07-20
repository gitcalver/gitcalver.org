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
    "curl -fsSLO https://github.com/gitcalver/sh/releases/download/v20260719.1/gitcalver.sh\nchmod +x gitcalver.sh",
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
  assert.equal(
    await desktopPage.evaluate(
      () =>
        CSS.supports("scroll-target-group", "auto") &&
        CSS.supports("selector(a:target-current)"),
    ),
    true,
    "the test browser supports the native scrollspy contract",
  );
  assert.equal(
    await desktopToc
      .locator("nav > ul")
      .evaluate((list) => getComputedStyle(list).scrollTargetGroup),
    "auto",
    "the TOC establishes a native scroll target group",
  );
  const goLink = desktopToc.getByRole("link", { name: "Go", exact: true });
  await goLink.focus();
  await desktopPage.keyboard.press("Enter");
  await desktopPage.waitForFunction(() => location.hash === "#go");
  assert.equal(
    await desktopPage
      .locator("#go")
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
    javaScriptEnabled: false,
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
  const overflow = await table.evaluate((element) => ({
    active: document.activeElement === element,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  assert.equal(overflow.active, true, "overflowing table accepts focus");
  assert(
    overflow.scrollWidth > overflow.clientWidth,
    "table content overflows horizontally",
  );
  await table.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  assert(
    (await table.evaluate((element) => element.scrollLeft)) > 0,
    "table accepts horizontal scrolling",
  );
  await overflowPage.goto(`${worker.base}/getting-started`);
  const codeExample = overflowPage.locator(".prose pre").first();
  assert.equal(
    await codeExample.getAttribute("tabindex"),
    "0",
    "rendered code examples enter the keyboard order",
  );
  assert.equal(
    await codeExample.getAttribute("aria-label"),
    "Code example",
    "rendered code examples have an accessible label",
  );
  assert.match(
    await codeExample.getAttribute("aria-describedby"),
    /horizontal-scroll-instructions/,
    "rendered code examples expose keyboard instructions",
  );
  await overflowContext.close();

  const rolloverContext = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1280, height: 900 },
  });
  const rolloverPage = await rolloverContext.newPage();
  await rolloverPage.clock.install({
    time: new Date("2026-12-31T23:59:59.500Z"),
  });
  await rolloverPage.goto(`${worker.base}/`);
  assert.equal(
    await rolloverPage.locator("#gcv-date").textContent(),
    "20261231",
    "the client renders the current UTC date",
  );
  await rolloverPage.clock.fastForward(1600);
  assert.equal(
    await rolloverPage.locator("#gcv-date").textContent(),
    "20270101",
    "the example rolls over after UTC midnight",
  );
  assert.equal(
    await rolloverPage.locator("#gcv-date-val").textContent(),
    "20270101",
    "the legend rolls over with the example",
  );
  assert.equal(
    await rolloverPage.locator("#gcv-version").getAttribute("aria-label"),
    "Example version 20270101.1",
    "the accessible version label rolls over",
  );
  assert.match(
    await rolloverPage.locator("#gcv-today").textContent(),
    /Today is 20270101 in UTC.*20270101\.1/s,
    "the explanatory sentence rolls over",
  );
  await rolloverContext.close();

  console.log(
    "interaction tests OK (copy success/fallback/failure, TOCs, CSS scrollspy contract, rendered overflow, UTC rollover)",
  );
} finally {
  if (browser) await browser.close();
  await worker.stop();
}
