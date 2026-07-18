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

export async function startWorker() {
  const state = await mkdtemp(path.join(os.tmpdir(), "gitcalver-worker-"));
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

  async function stop() {
    if (child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      if (child.exitCode === null) await exited;
    }
    await rm(state, { recursive: true, force: true });
  }

  const deadline = Date.now() + 20_000;
  try {
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(`Wrangler exited before serving requests:\n${output}`);
      }
      try {
        const result = await response("/");
        if (result.status === 200) return { base, response, stop };
      } catch {
        // The local socket is not accepting requests yet.
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });
    }
    throw new Error(`Wrangler did not become ready:\n${output}`);
  } catch (error) {
    await stop();
    throw error;
  }
}
