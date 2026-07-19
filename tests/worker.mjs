// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: MIT

import assert from "node:assert/strict";
import { startWorker } from "./worker-server.mjs";

const worker = await startWorker();
const { response } = worker;

async function expectResponse(
  url,
  { status, location, contentType, cacheControl, bodyIncludes },
) {
  const result = await response(url);
  assert.equal(result.status, status, `${url} status`);
  if (location !== undefined) {
    assert.equal(result.headers.get("location"), location, `${url} location`);
  }
  if (contentType !== undefined) {
    assert.match(
      result.headers.get("content-type") ?? "",
      contentType,
      `${url} content-type`,
    );
  }
  if (cacheControl !== undefined) {
    assert.equal(
      result.headers.get("cache-control"),
      cacheControl,
      `${url} cache-control`,
    );
  }
  if (bodyIncludes !== undefined) {
    assert.match(await result.text(), bodyIncludes, `${url} body`);
  }
}

try {
  await expectResponse("/", {
    status: 200,
    contentType: /^text\/html\b/,
    cacheControl: "public, max-age=600",
    bodyIncludes: /GitCalVer/,
  });
  await expectResponse("/getting-started", {
    status: 200,
    contentType: /^text\/html\b/,
  });
  await expectResponse("/getting-started/", {
    status: 307,
    location: "/getting-started",
  });
  await expectResponse("/getting-started.html", {
    status: 307,
    location: "/getting-started",
  });
  await expectResponse("/spec", {
    status: 302,
    location: "/spec/0.2",
  });
  await expectResponse("/spec/0.1", {
    status: 200,
    contentType: /^text\/html\b/,
  });
  await expectResponse("/spec/0.1/", {
    status: 307,
    location: "/spec/0.1",
  });
  await expectResponse("/spec/0.2", {
    status: 200,
    contentType: /^text\/html\b/,
  });
  await expectResponse("/spec/0.2/", {
    status: 307,
    location: "/spec/0.2",
  });
  await expectResponse("/sh", {
    status: 302,
    location: "/gitcalver.sh",
  });
  await expectResponse("/gitcalver.sh", {
    status: 200,
    contentType: /^text\/plain\b/,
    cacheControl: "public, max-age=600",
    bodyIncludes: /^#!\/bin\/sh/,
  });
  await expectResponse("/go", {
    status: 200,
    contentType: /^text\/html\b/,
    bodyIncludes: /name="go-import"/,
  });
  await expectResponse("/go/example", {
    status: 301,
    location: "/go",
  });
  await expectResponse("/social-card.png", {
    status: 200,
    contentType: /^image\/png\b/,
  });

  const home = await response("/");
  const fontPath = (await home.text()).match(
    /url\((\/fonts\/[^)]+\.woff2)\)/,
  )?.[1];
  assert(fontPath, "home page contains a fingerprinted WOFF2 URL");
  await expectResponse(fontPath, {
    status: 200,
    contentType: /^font\/woff2\b/,
    cacheControl: "public, max-age=31536000, immutable",
  });

  await expectResponse("/_headers", { status: 404 });
  await expectResponse("/_redirects", { status: 404 });
  await expectResponse("/not-a-real-page", {
    status: 404,
    contentType: /^text\/html\b/,
    bodyIncludes: /data-page=not-found/,
  });
  console.log("worker smoke tests OK");
} finally {
  await worker.stop();
}
