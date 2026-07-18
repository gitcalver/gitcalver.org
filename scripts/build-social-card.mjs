// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: MIT

import assert from "node:assert/strict";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

const repo = path.resolve(import.meta.dirname, "..");
const source = path.join(repo, "site", "assets", "images", "social-card.svg");
const output = path.join(repo, "site", "static", "social-card.png");
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
let browser;

try {
  browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: { width: 1200, height: 630 },
  });
  await page.goto(pathToFileURL(source).href);
  await page.evaluate(() => document.fonts.ready);

  const dimensions = await page.locator("svg").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return [rect.width, rect.height];
  });
  assert.deepEqual(dimensions, [1200, 630], "social card dimensions");
  assert.equal(
    await page.evaluate(
      () =>
        document.fonts.size === 4 &&
        [...document.fonts].every((font) => font.status === "loaded"),
    ),
    true,
    "social card fonts loaded",
  );

  await page
    .locator("svg")
    .screenshot({ animations: "disabled", path: output });
  console.log(`wrote ${path.relative(repo, output)} (1200×630)`);
} finally {
  if (browser) await browser.close();
}
