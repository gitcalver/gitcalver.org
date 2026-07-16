// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: MIT

// Lighthouse CI config for `make lighthouse` (and the Lighthouse CI job). lhci
// serves the Hugo build output (site/public) from its own static server and
// audits the rendered pages against the full `lighthouse:recommended` preset.
module.exports = {
  ci: {
    collect: {
      staticDistDir: "./site/public",
      // Audit our own pages explicitly rather than letting staticDistDir
      // auto-discover every *.html: go.html is a <meta refresh> stub that
      // bounces to pkg.go.dev, so auto-discovery would audit pkg.go.dev's page
      // (its CSS, JS, caching) instead of ours. lhci rewrites the host:port.
      url: [
        "http://localhost/index.html",
        "http://localhost/compatibility/index.html",
        "http://localhost/getting-started/index.html",
        "http://localhost/spec/0.1/index.html",
      ],
      // Median of several runs steadies the variable performance metrics.
      numberOfRuns: 3,
      settings: {
        // GitHub runners launch Chrome with no usable sandbox.
        chromeFlags: "--no-sandbox",
      },
    },
    assert: {
      preset: "lighthouse:recommended",
      assertions: {
        // robots.txt carries a `Content-Signal:` line (the Cloudflare content-
        // signals policy), which make check-html requires. Lighthouse's
        // validator doesn't know that directive and reports the whole file
        // invalid, so this audit can never pass here. check-html already guards
        // robots.txt's contents.
        "robots-txt": "off",
        // Experimental "insights" audit whose critical-path scoring flags the
        // single render-blocking stylesheet — the same signal as
        // render-blocking-resources, which the preset itself only warns on. Keep
        // it visible but non-blocking rather than hard-failing on an
        // experimental scorer.
        "network-dependency-tree-insight": ["warn", { minScore: 0.9 }],
        // The "gitcalver" logo link is announced as "gitcalver home" (aria-
        // label) — a good name. axe flags it only because the visible "gcv"
        // monogram is rendered as text, so it wants the name to literally
        // contain "gcv gitcalver". Folding the monogram into the name would make
        // screen readers say "gcv gitcalver", which is worse, so warn instead of
        // degrading the spoken label.
        "label-content-name-mismatch": ["warn", { minScore: 0.9 }],
      },
    },
  },
};
