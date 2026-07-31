// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: MIT

// Render the specification's figure SVGs from their gitgraph.js scene
// definitions, entirely offline: each figures/*.js scene runs against a jsdom
// window with analytic SVG geometry supplied by helpers.js, so the output is
// a deterministic function of the scene files — no browser involved. Results
// are normalized to the site's CSS custom properties and accessibility
// attributes and written to site/assets/diagrams/<id>.svg, which the
// {{< diagram >}} shortcode inlines.
//
//   node scripts/diagrams/render.mjs [fig-1 ...]  regenerate (all by default)
//     --check           byte-compare against the committed files; exit 1 stale
//     --preview FILE    also write a self-contained HTML page embedding the
//                       SVGs with the site's design tokens, for visual review
//     --screenshot DIR  also write light/dark PNGs of each figure via the
//                       package-lock-pinned Playwright browser (dev only;
//                       `make diagrams` itself needs no browser)

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { JSDOM } from "jsdom";
import prettier from "prettier";

const repo = path.resolve(import.meta.dirname, "..", "..");
const figuresDir = path.join(import.meta.dirname, "figures");
const outDir = path.join(repo, "site", "assets", "diagrams");

// Read just enough of a TrueType font to measure deterministic horizontal
// advances. Browser kerning is usually negative; a small final allowance
// keeps the analytic SVG bounds conservative without monospace-sized gaps.
function trueTypeMetrics(buffer) {
  const table = (wanted) => {
    const count = buffer.readUInt16BE(4);
    for (let index = 0; index < count; index += 1) {
      const record = 12 + index * 16;
      if (buffer.toString("ascii", record, record + 4) !== wanted) continue;
      return {
        offset: buffer.readUInt32BE(record + 8),
        length: buffer.readUInt32BE(record + 12),
      };
    }
    throw new Error(`TrueType table ${wanted} not found`);
  };

  const head = table("head");
  const hhea = table("hhea");
  const hmtx = table("hmtx");
  const cmap = table("cmap");
  const unitsPerEm = buffer.readUInt16BE(head.offset + 18);
  const metricCount = buffer.readUInt16BE(hhea.offset + 34);

  let format4 = null;
  const cmapCount = buffer.readUInt16BE(cmap.offset + 2);
  for (let index = 0; index < cmapCount; index += 1) {
    const record = cmap.offset + 4 + index * 8;
    const candidate = cmap.offset + buffer.readUInt32BE(record + 4);
    if (buffer.readUInt16BE(candidate) !== 4) continue;
    const platform = buffer.readUInt16BE(record);
    if (format4 === null || platform === 3) format4 = candidate;
    if (platform === 3) break;
  }
  assert.ok(format4 !== null, "IBM Plex Sans needs a format 4 cmap");

  const segmentCount = buffer.readUInt16BE(format4 + 6) / 2;
  const endCodes = format4 + 14;
  const startCodes = endCodes + segmentCount * 2 + 2;
  const deltas = startCodes + segmentCount * 2;
  const rangeOffsets = deltas + segmentCount * 2;

  const glyphFor = (codePoint) => {
    if (codePoint > 0xffff) return 0;
    for (let index = 0; index < segmentCount; index += 1) {
      const end = buffer.readUInt16BE(endCodes + index * 2);
      if (codePoint > end) continue;
      const start = buffer.readUInt16BE(startCodes + index * 2);
      if (codePoint < start) return 0;
      const delta = buffer.readInt16BE(deltas + index * 2);
      const rangeOffsetPosition = rangeOffsets + index * 2;
      const rangeOffset = buffer.readUInt16BE(rangeOffsetPosition);
      if (rangeOffset === 0) return (codePoint + delta) & 0xffff;
      const glyphPosition =
        rangeOffsetPosition + rangeOffset + (codePoint - start) * 2;
      if (glyphPosition + 2 > format4 + buffer.readUInt16BE(format4 + 2)) {
        return 0;
      }
      const glyph = buffer.readUInt16BE(glyphPosition);
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  };

  const advanceFor = (codePoint) => {
    const glyph = glyphFor(codePoint);
    const metric = Math.min(glyph, metricCount - 1);
    return buffer.readUInt16BE(hmtx.offset + metric * 4);
  };

  return (text, size) => {
    let advance = 0;
    for (const character of text)
      advance += advanceFor(character.codePointAt(0));
    return (advance / unitsPerEm) * size * 1.03 + size * 0.1;
  };
}

const sansTextWidth = trueTypeMetrics(
  await fs.readFile(path.join(repo, "fonts", "src", "IBMPlexSans-Text.ttf")),
);
const sansSemiboldWidth = trueTypeMetrics(
  await fs.readFile(
    path.join(repo, "fonts", "src", "IBMPlexSans-SemiBold.ttf"),
  ),
);

const umd = await fs.readFile(
  path.join(repo, "node_modules", "@gitgraph", "js", "lib", "gitgraph.umd.js"),
  "utf8",
);
const helpers = await fs.readFile(
  path.join(import.meta.dirname, "helpers.js"),
  "utf8",
);

const flags = new Set();
const options = { preview: null, screenshot: null };
const selected = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const pathValue = () => {
    const value = argv[i + 1];
    assert.ok(
      value !== undefined && !value.startsWith("--"),
      `${argv[i]} requires a path argument`,
    );
    i += 1;
    return value;
  };
  if (argv[i] === "--check") flags.add("check");
  else if (argv[i] === "--preview") options.preview = pathValue();
  else if (argv[i] === "--screenshot") options.screenshot = pathValue();
  else selected.push(argv[i]);
}

const available = (await fs.readdir(figuresDir))
  .filter((name) => name.endsWith(".js"))
  .map((name) => name.slice(0, -3))
  .sort();
const ids = selected.length > 0 ? selected : available;
for (const id of ids) {
  assert.ok(available.includes(id), `unknown figure ${id}`);
}

async function renderFigure(id) {
  const scene = await fs.readFile(path.join(figuresDir, `${id}.js`), "utf8");
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="container"></div></body></html>',
    { runScripts: "outside-only", pretendToBeVisual: true },
  );
  const { window } = dom;
  try {
    window.diagramTextWidth = (text, size, weight) =>
      (Number(weight) >= 550 ? sansSemiboldWidth : sansTextWidth)(text, size);
    window.eval(umd);
    window.eval(helpers);
    window.eval(scene);
    const figure = window.figure;
    assert.equal(figure.id, id, `${id}.js declares id ${figure.id}`);
    assert.ok(figure.title && figure.desc, `${id} needs a title and desc`);

    const container = window.document.getElementById("container");
    const context = {
      GitgraphJS: window.GitgraphJS,
      container,
      h: window.diagramHelpers,
    };
    figure.draw(context);
    // gitgraph.js debounces rendering to the next tick and finishes layout on
    // animation frames and mutation observers; let those settle before the
    // annotation pass reads commit positions back.
    const settle = () =>
      new Promise((resolve) =>
        window.setTimeout(
          () =>
            window.requestAnimationFrame(() =>
              window.requestAnimationFrame(() => window.setTimeout(resolve, 0)),
            ),
          0,
        ),
      );
    await settle();

    const svg = container.querySelector("svg");
    assert.ok(
      svg && svg.querySelector("circle, rect, path"),
      `${id} rendered nothing`,
    );
    if (figure.annotate) {
      figure.annotate({ ...context, svg });
      await settle();
    }
    const markup = window.diagramHelpers.finalize(svg, figure);
    return prettier.format(markup, { parser: "html" });
  } finally {
    window.close();
  }
}

function generatedFile(id, markup) {
  return (
    `<!-- Generated by scripts/diagrams/render.mjs from` +
    ` scripts/diagrams/figures/${id}.js; edit the scene, then run` +
    ` \`make diagrams\`. -->\n` +
    `<!-- Copyright © 2026 Michael Shields. SPDX-License-Identifier: CC-BY-4.0 -->\n` +
    markup
  );
}

await fs.mkdir(outDir, { recursive: true });
let stale = 0;
const rendered = new Map();
for (const id of ids) {
  const first = await renderFigure(id);
  const second = await renderFigure(id);
  assert.equal(first, second, `${id} did not render deterministically`);
  const contents = generatedFile(id, first);
  rendered.set(id, contents);
  const target = path.join(outDir, `${id}.svg`);
  if (flags.has("check")) {
    const committed = await fs.readFile(target, "utf8").catch(() => null);
    if (committed === contents) {
      console.log(`${id}.svg OK`);
    } else {
      console.log(
        `${id}.svg ${committed === null ? "missing" : "stale"}; run \`make diagrams\``,
      );
      stale += 1;
    }
  } else {
    await fs.writeFile(target, contents);
    console.log(`wrote ${path.relative(repo, target)}`);
  }
}

async function previewPage() {
  const mainCss = await fs.readFile(
    path.join(repo, "site", "assets", "css", "main.css"),
    "utf8",
  );
  const roots = [...mainCss.matchAll(/:root\s*\{([^}]*)\}/g)];
  assert.equal(roots.length, 2, "expected light and dark :root blocks");
  // Embed the fonts so the preview is self-contained wherever it's opened.
  const font = async (weight, file) => {
    const data = await fs.readFile(path.join(repo, "fonts", "src", file));
    return (
      `@font-face{font-family:"IBM Plex Sans";font-style:normal;` +
      `font-weight:${weight};src:url("data:font/ttf;base64,` +
      `${data.toString("base64")}")}`
    );
  };
  return (
    `<!doctype html><html><head><meta charset="utf-8"><style>` +
    (await font("400 450", "IBMPlexSans-Text.ttf")) +
    (await font("600", "IBMPlexSans-SemiBold.ttf")) +
    `:root{${roots[0][1]}}` +
    `@media (prefers-color-scheme: dark){:root{${roots[1][1]}}}` +
    // Open preview.html#dark to force dark mode where the browser's
    // prefers-color-scheme can't be toggled.
    `:root.dark{${roots[1][1]}}` +
    `body{background:var(--bg);color:var(--text);` +
    `font-family:"IBM Plex Sans",system-ui,sans-serif;` +
    `font-weight:450;padding:24px}` +
    `</style><script>` +
    `addEventListener("hashchange",sync);function sync(){` +
    `document.documentElement.classList.toggle("dark",location.hash==="#dark")}` +
    `</script></head><body onload="sync()">` +
    [...rendered]
      .map(
        ([id, contents]) =>
          `<section id="${id}-shot"><h2>${id}</h2>\n${contents}</section>`,
      )
      .join("\n") +
    `</body></html>`
  );
}

if (options.preview) {
  await fs.writeFile(options.preview, await previewPage());
  console.log(`wrote preview ${options.preview}`);
}

if (options.screenshot) {
  const { chromium } = await import("playwright");
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const page = await previewPage();
  await fs.mkdir(options.screenshot, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  try {
    for (const colorScheme of ["light", "dark"]) {
      const tab = await browser.newPage({ colorScheme });
      await tab.setContent(page);
      await tab.evaluate(() => document.fonts.ready);
      for (const id of rendered.keys()) {
        const file = path.join(options.screenshot, `${id}-${colorScheme}.png`);
        await tab.locator(`#${id}-shot svg`).screenshot({ path: file });
        console.log(`wrote ${file}`);
      }
      await tab.close();
    }
  } finally {
    await browser.close();
  }
}

if (stale > 0) {
  console.error(`${stale} diagram(s) out of date`);
  process.exit(1);
}
