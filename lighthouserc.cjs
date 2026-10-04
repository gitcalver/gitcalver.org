// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: MIT

// Lighthouse CI config for `make lighthouse` (and the Lighthouse CI job). lhci
// serves the Hugo build output (site/public) from its own static server and
// audits the rendered pages against the full `lighthouse:recommended` preset.
module.exports = {
  ci: {
    collect: {
      staticDistDir: "./site/public",
      // List our own pages explicitly: staticDistDir auto-discovers every
      // *.html, and go.html is a <meta refresh> stub that bounces to
      // pkg.go.dev, so auto-discovery would audit pkg.go.dev's page (its CSS,
      // JS, caching) instead of ours. lhci rewrites the host:port.
      url: [
        "http://localhost/index.html",
        "http://localhost/compatibility/index.html",
        "http://localhost/getting-started/index.html",
        "http://localhost/spec/0.1/index.html",
        "http://localhost/spec/0.2/index.html",
        "http://localhost/spec/0.3/index.html",
      ],
      // lhci's default "optimistic" aggregation asserts on the best of these
      // runs, so a gate fails only if every run misses it: one noisy run can't
      // fail CI, and a regression must show in every run.
      numberOfRuns: 3,
      settings: {
        // GitHub runners launch Chrome with no usable sandbox.
        chromeFlags: "--no-sandbox",
      },
    },
    assert: {
      preset: "lighthouse:recommended",
      assertions: {
        "categories:performance": ["error", { minScore: 0.95 }],
        "categories:accessibility": ["error", { minScore: 1 }],
        "categories:best-practices": ["error", { minScore: 1 }],
        // robots.txt carries a `Content-Signal:` line (the Cloudflare content-
        // signals policy), which make check-html requires. Lighthouse's
        // validator doesn't know that directive and reports the whole file
        // invalid, so this audit can never pass here. check-html already guards
        // robots.txt's contents.
        "robots-txt": "off",
      },
    },
  },
};
