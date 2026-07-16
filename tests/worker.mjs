// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: MIT

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const repo = path.resolve(import.meta.dirname, "..");
const wrangler = path.join(repo, "node_modules", ".bin", "wrangler");
const state = await mkdtemp(path.join(os.tmpdir(), "gitcalver-worker-"));

async function unusedPort() {
  const server = net.createServer();
  server.unref();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const { port } = address;
  server.close();
  await once(server, "close");
  return port;
}

const port = await unusedPort();
let inspectorPort = await unusedPort();
while (inspectorPort === port) inspectorPort = await unusedPort();
const base = `http://127.0.0.1:${port}`;
let output = "";
const child = spawn(
  wrangler,
  [
    "dev",
    "--local",
    "--ip",
    "127.0.0.1",
    "--port",
    String(port),
    "--inspector-port",
    String(inspectorPort),
    "--persist-to",
    path.join(state, "state"),
    "--log-level",
    "error",
    "--show-interactive-dev-session=false",
  ],
  {
    cwd: repo,
    env: {
      ...process.env,
      NO_COLOR: "1",
      WRANGLER_LOG_PATH: path.join(state, "wrangler.log"),
      WRANGLER_SEND_METRICS: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

for (const stream of [child.stdout, child.stderr]) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    output += chunk;
  });
}

async function response(url) {
  return fetch(`${base}${url}`, { redirect: "manual" });
}

async function waitUntilReady() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Wrangler exited before serving requests:\n${output}`);
    }
    try {
      const result = await response("/");
      if (result.status === 200) return;
    } catch {
      // The local socket is not accepting requests yet.
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
  }
  throw new Error(`Wrangler did not become ready:\n${output}`);
}

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
  await waitUntilReady();
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
    location: "/spec/0.1",
  });
  await expectResponse("/spec/0.1", {
    status: 200,
    contentType: /^text\/html\b/,
  });
  await expectResponse("/spec/0.1/", {
    status: 307,
    location: "/spec/0.1",
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
  await expectResponse("/not-a-real-page", { status: 404 });
  console.log("worker smoke tests OK");
} finally {
  child.kill("SIGTERM");
  if (child.exitCode === null) await once(child, "exit");
  await rm(state, { recursive: true, force: true });
}
