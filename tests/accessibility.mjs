// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: MIT

import assert from "node:assert/strict";
import process from "node:process";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

import { startWorker } from "./worker-server.mjs";

const routes = [
  { path: "/", headerCurrent: [], footerCurrent: [] },
  {
    path: "/getting-started",
    headerCurrent: ["Get started"],
    footerCurrent: ["Get started"],
  },
  {
    path: "/compatibility",
    headerCurrent: [],
    footerCurrent: ["Compatibility"],
  },
  {
    path: "/spec/0.1",
    headerCurrent: ["Spec"],
    footerCurrent: ["Specification"],
  },
];
const viewports = [
  { width: 320, height: 800, gutter: 22 },
  { width: 1280, height: 900, gutter: 32 },
];
const colorSchemes = ["light", "dark"];
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const worker = await startWorker();
let browser;

function violationSummary(violations) {
  return violations
    .map(
      (violation) =>
        `${violation.id}: ${violation.nodes
          .flatMap((node) => node.target)
          .join(", ")} (${violation.helpUrl})`,
    )
    .join("\n");
}

try {
  browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });

  for (const route of routes) {
    for (const colorScheme of colorSchemes) {
      for (const viewport of viewports) {
        const label = `${route.path} at ${viewport.width}px in ${colorScheme} mode`;
        const context = await browser.newContext({
          colorScheme,
          reducedMotion: "no-preference",
          viewport: { width: viewport.width, height: viewport.height },
        });
        const page = await context.newPage();
        const navigation = await page.goto(`${worker.base}${route.path}`);
        assert(navigation?.ok(), `${label} responds successfully`);
        await page.evaluate(() => document.fonts.ready);

        // PR 7 owns keyboard-accessible overflow for code and tables. Keep that
        // one known rule isolated while this gate enforces the rest of Axe.
        const results = await new AxeBuilder({ page })
          .disableRules(["scrollable-region-focusable"])
          .analyze();
        assert.equal(
          results.violations.length,
          0,
          `${label} Axe violations:\n${violationSummary(results.violations)}`,
        );

        const metrics = await page.evaluate(() => {
          const bodyStyle = getComputedStyle(document.body);
          const mainWrap = document.querySelector("main > .wrap");
          const glyph = document.querySelector("header .brand .glyph");
          const githubIcon = document.querySelector("header .gh-link svg");
          assertElement(mainWrap);
          assertElement(glyph);
          assertElement(githubIcon);
          return {
            bodyFontFamily: bodyStyle.fontFamily,
            bodyFontSize: Number.parseFloat(bodyStyle.fontSize),
            bodyLineHeight: Number.parseFloat(bodyStyle.lineHeight),
            colorSchemeDark: matchMedia("(prefers-color-scheme: dark)").matches,
            documentWidth: document.documentElement.scrollWidth,
            githubIcon: dimensions(githubIcon),
            glyph: dimensions(glyph),
            gutter: Number.parseFloat(
              getComputedStyle(mainWrap).paddingInlineStart,
            ),
            navLinks: [...document.querySelectorAll("header .nav-links a")]
              .filter((element) => getComputedStyle(element).display !== "none")
              .map((element) => ({
                ...dimensions(element),
                text: element.textContent.trim(),
                whiteSpace: getComputedStyle(element).whiteSpace,
              })),
            sizedSvgCount: [...document.querySelectorAll("svg")].filter(
              (element) =>
                element.hasAttribute("width") && element.hasAttribute("height"),
            ).length,
            svgCount: document.querySelectorAll("svg").length,
          };

          function assertElement(element) {
            if (!(
              element instanceof HTMLElement || element instanceof SVGElement
            )) {
              throw new Error("expected rendered element");
            }
          }

          function dimensions(element) {
            const rect = element.getBoundingClientRect();
            return {
              bottom: rect.bottom,
              height: rect.height,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              width: rect.width,
            };
          }
        });

        assert.equal(
          metrics.colorSchemeDark,
          colorScheme === "dark",
          `${label} applies the requested color scheme`,
        );
        assert.equal(
          metrics.documentWidth,
          viewport.width,
          `${label} has no page-level horizontal overflow`,
        );
        assert.equal(metrics.gutter, viewport.gutter, `${label} main gutter`);
        assert.match(
          metrics.bodyFontFamily,
          /^"ibm plex sans"/i,
          `${label} body typeface`,
        );
        assert(
          metrics.bodyFontSize >= 16,
          `${label} body text is at least 16px`,
        );
        assert(
          metrics.bodyLineHeight / metrics.bodyFontSize >= 1.5,
          `${label} body line height is at least 1.5`,
        );
        assert.deepEqual(
          [metrics.glyph.width, metrics.glyph.height],
          [34, 30],
          `${label} monogram dimensions`,
        );
        assert.deepEqual(
          [metrics.githubIcon.width, metrics.githubIcon.height],
          [16, 16],
          `${label} GitHub icon dimensions`,
        );
        assert.equal(
          metrics.sizedSvgCount,
          metrics.svgCount,
          `${label} inline SVGs reserve stable dimensions`,
        );
        for (const link of metrics.navLinks) {
          assert.equal(
            link.whiteSpace,
            "nowrap",
            `${label} ${link.text} wraps`,
          );
          assert(
            link.width >= 24,
            `${label} ${link.text} target is wide enough`,
          );
          assert(
            link.height >= 24,
            `${label} ${link.text} target is tall enough`,
          );
          assert(
            link.left >= viewport.gutter - 0.5 &&
              link.right <= viewport.width - viewport.gutter + 0.5,
            `${label} ${link.text} stays inside the header gutter`,
          );
        }

        assert.equal(
          await page.getByRole("link", { name: "gitcalver home" }).count(),
          2,
          `${label} brands have concise accessible labels`,
        );
        assert.deepEqual(
          await page.locator('header [aria-current="page"]').allTextContents(),
          route.headerCurrent,
          `${label} header current-page state`,
        );
        assert.deepEqual(
          await page.locator('footer [aria-current="page"]').allTextContents(),
          route.footerCurrent,
          `${label} footer current-page state`,
        );

        await context.close();
      }
    }
  }

  const keyboardContext = await browser.newContext({
    colorScheme: "light",
    viewport: { width: viewports[0].width, height: viewports[0].height },
  });
  const keyboardPage = await keyboardContext.newPage();
  await keyboardPage.goto(`${worker.base}/`);
  await keyboardPage.keyboard.press("Tab");
  assert.equal(
    await keyboardPage.evaluate(() => document.activeElement?.className),
    "skip-link",
    "skip link is the first keyboard target",
  );
  const skipLink = await keyboardPage
    .locator(".skip-link")
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        bottom: rect.bottom,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        top: rect.top,
      };
    });
  assert(skipLink.top >= 0 && skipLink.bottom <= viewports[0].height);
  assert.equal(skipLink.outlineStyle, "solid", "skip link has a focus ring");
  assert.equal(skipLink.outlineWidth, "3px", "skip link focus ring is visible");
  await keyboardPage.keyboard.press("Enter");
  await keyboardPage.waitForFunction(
    () => document.activeElement?.id === "main-content",
  );
  assert.equal(
    new URL(keyboardPage.url()).hash,
    "#main-content",
    "skip link targets the main content",
  );
  await keyboardContext.close();

  const motionContext = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: viewports[1].width, height: viewports[1].height },
  });
  const motionPage = await motionContext.newPage();
  await motionPage.goto(`${worker.base}/`);
  const motion = await motionPage.evaluate(() => ({
    cardTransition: getComputedStyle(document.querySelector(".card"))
      .transitionDuration,
    pulseAnimation: getComputedStyle(document.querySelector(".today .pulse"))
      .animationName,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
  }));
  assert.equal(
    motion.scrollBehavior,
    "auto",
    "reduced motion disables smooth scroll",
  );
  assert.equal(
    motion.pulseAnimation,
    "none",
    "reduced motion disables the pulse",
  );
  assert(
    Number.parseFloat(motion.cardTransition) <= 0.001,
    "reduced motion minimizes transitions",
  );
  await motionContext.close();

  console.log("responsive accessibility tests OK (16 Axe scans)");
} finally {
  if (browser) await browser.close();
  await worker.stop();
}
