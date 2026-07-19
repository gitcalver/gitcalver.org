// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: MIT

import assert from "node:assert/strict";
import { Buffer } from "node:buffer";

import { startWorker } from "./worker-server.mjs";

const worker = await startWorker();
const { response } = worker;
const socialImage = "https://gitcalver.org/social-card.png";
const socialAlt = "GitCalVer: version numbers your git history already knows.";

function decodeHtml(value) {
  return value
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_match, decimal) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&#x([\da-f]+);/gi, (_match, hexadecimal) =>
      String.fromCodePoint(Number.parseInt(hexadecimal, 16)),
    );
}

function tags(html, name) {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
}

function attributes(tag) {
  const result = new Map();
  const pattern = /\s([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of tag.matchAll(pattern)) {
    result.set(
      match[1].toLowerCase(),
      decodeHtml(match[2] ?? match[3] ?? match[4] ?? ""),
    );
  }
  return result;
}

function matchingTags(html, tagName, attribute, value) {
  return tags(html, tagName).filter(
    (tag) => attributes(tag).get(attribute) === value,
  );
}

function oneAttribute(html, tagName, key, value, wanted) {
  const matches = matchingTags(html, tagName, key, value);
  assert.equal(matches.length, 1, `one ${tagName}[${key}="${value}"]`);
  return attributes(matches[0]).get(wanted);
}

function title(html) {
  const match = html.match(/<title>(.*?)<\/title>/i);
  assert(match, "document has a title");
  return decodeHtml(match[1]);
}

async function htmlResponse(path, status) {
  const result = await response(path);
  assert.equal(result.status, status, `${path} status`);
  assert.match(
    result.headers.get("content-type") ?? "",
    /^text\/html\b/,
    `${path} content-type`,
  );
  return result.text();
}

try {
  const indexedRoutes = [
    {
      path: "/",
      canonical: "https://gitcalver.org/",
      title: "gitcalver—calendar versioning from git history",
      type: "website",
    },
    {
      path: "/compatibility",
      canonical: "https://gitcalver.org/compatibility",
      title: "Compatibility—gitcalver",
      type: "article",
    },
    {
      path: "/getting-started",
      canonical: "https://gitcalver.org/getting-started",
      title: "Getting Started—gitcalver",
      type: "article",
    },
    {
      path: "/spec/0.1",
      canonical: "https://gitcalver.org/spec/0.1",
      title: "Specification—gitcalver",
      type: "article",
    },
    {
      path: "/spec/0.2",
      canonical: "https://gitcalver.org/spec/0.2",
      title: "Specification—gitcalver",
      type: "article",
    },
  ];

  for (const route of indexedRoutes) {
    const html = await htmlResponse(route.path, 200);
    const pageTitle = title(html);
    const description = oneAttribute(
      html,
      "meta",
      "name",
      "description",
      "content",
    );
    assert.equal(pageTitle, route.title, `${route.path} title`);
    assert(description, `${route.path} description is nonempty`);
    assert.equal(
      oneAttribute(html, "link", "rel", "canonical", "href"),
      route.canonical,
      `${route.path} canonical URL`,
    );
    assert.equal(
      oneAttribute(html, "meta", "property", "og:type", "content"),
      route.type,
      `${route.path} Open Graph type`,
    );
    assert.equal(
      oneAttribute(html, "meta", "property", "og:site_name", "content"),
      "gitcalver",
    );
    assert.equal(
      oneAttribute(html, "meta", "property", "og:title", "content"),
      pageTitle,
    );
    assert.equal(
      oneAttribute(html, "meta", "property", "og:description", "content"),
      description,
    );
    assert.equal(
      oneAttribute(html, "meta", "property", "og:url", "content"),
      route.canonical,
    );
    assert.equal(
      oneAttribute(html, "meta", "property", "og:image", "content"),
      socialImage,
    );
    assert.equal(
      oneAttribute(html, "meta", "property", "og:image:type", "content"),
      "image/png",
    );
    assert.equal(
      oneAttribute(html, "meta", "property", "og:image:width", "content"),
      "1200",
    );
    assert.equal(
      oneAttribute(html, "meta", "property", "og:image:height", "content"),
      "630",
    );
    assert.equal(
      oneAttribute(html, "meta", "property", "og:image:alt", "content"),
      socialAlt,
    );
    assert.equal(
      oneAttribute(html, "meta", "name", "twitter:card", "content"),
      "summary_large_image",
    );
    assert.equal(
      oneAttribute(html, "meta", "name", "twitter:title", "content"),
      pageTitle,
    );
    assert.equal(
      oneAttribute(html, "meta", "name", "twitter:description", "content"),
      description,
    );
    assert.equal(
      oneAttribute(html, "meta", "name", "twitter:image", "content"),
      socialImage,
    );
    assert.equal(
      oneAttribute(html, "meta", "name", "twitter:image:alt", "content"),
      socialAlt,
    );
    assert.equal(
      matchingTags(html, "meta", "name", "robots").length,
      0,
      `${route.path} remains indexable`,
    );
  }

  const imageResponse = await response("/social-card.png");
  assert.equal(imageResponse.status, 200, "social card status");
  assert.match(
    imageResponse.headers.get("content-type") ?? "",
    /^image\/png\b/,
    "social card content-type",
  );
  const image = Buffer.from(await imageResponse.arrayBuffer());
  assert.deepEqual(
    image.subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    "social card PNG signature",
  );
  assert.equal(image.readUInt32BE(16), 1200, "social card width");
  assert.equal(image.readUInt32BE(20), 630, "social card height");

  for (const path of ["/not-a-real-page", "/index.xml"]) {
    const html = await htmlResponse(path, 404);
    assert.match(html, /data-page=not-found/, `${path} uses the custom 404`);
    assert.equal(title(html), "Page not found—gitcalver");
    assert.equal(
      oneAttribute(html, "meta", "name", "robots", "content"),
      "noindex, nofollow",
    );
    assert.equal(
      matchingTags(html, "link", "rel", "canonical").length,
      0,
      `${path} has no canonical URL`,
    );
    assert.equal(
      tags(html, "meta").filter((tag) =>
        (attributes(tag).get("property") ?? "").startsWith("og:"),
      ).length,
      0,
      `${path} has no Open Graph metadata`,
    );
    assert.equal(
      tags(html, "meta").filter((tag) =>
        (attributes(tag).get("name") ?? "").startsWith("twitter:"),
      ).length,
      0,
      `${path} has no Twitter metadata`,
    );
  }

  const sitemap = await response("/sitemap.xml");
  assert.equal(sitemap.status, 200, "sitemap status");
  const sitemapBody = await sitemap.text();
  assert.doesNotMatch(sitemapBody, /\/404(?:<|\/)/, "404 omitted from sitemap");
  assert.doesNotMatch(
    sitemapBody,
    /index\.xml/,
    "removed RSS omitted from sitemap",
  );

  console.log("metadata and finishing route tests OK");
} finally {
  await worker.stop();
}
