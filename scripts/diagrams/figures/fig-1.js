// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: CC-BY-4.0

// Figure 1: a merge that jumps N from 4 to 21 in one step. Four counted
// main-branch commits, a batch of sixteen same-day feature commits, the merge
// M, and a number line showing that versions 5-20 were never assigned.

"use strict";
window.figure = {
  id: "fig-1",
  title: "A merge that jumps N from 4 to 21 in one step",
  desc:
    "Four main-branch commits carrying N 1 through 4 are followed by a merge " +
    "that brings in sixteen same-day feature commits plus the merge commit " +
    "itself, so N jumps to 21. Versions 5 through 20 for that date were " +
    "never assigned to any commit, and reverse lookup for any of them must " +
    "report that the version was not found.",
  draw({ GitgraphJS, container, h }) {
    const BATCH = "batch: 16 same-day commits";
    const R = h.DOT_RADIUS;

    const gitgraph = GitgraphJS.createGitgraph(container, {
      orientation: GitgraphJS.Orientation.Horizontal,
      reverseArrow: true,
      template: h.template(GitgraphJS, { commit: { spacing: 120 } }),
    });

    const main = gitgraph.branch("main");
    main.commit({
      hash: "fig-1-m1",
      subject: "m1",
      dotText: "m1",
      style: { dot: h.dot.counted },
    });
    const feature = main.branch("feature");
    for (const name of ["m2", "m3", "m4"]) {
      main.commit({
        hash: `fig-1-${name}`,
        subject: name,
        dotText: name,
        style: { dot: h.dot.counted },
      });
    }
    feature.commit({
      hash: "fig-1-batch",
      subject: BATCH,
      renderDot: () => {
        const g = container.ownerDocument.createElementNS(
          "http://www.w3.org/2000/svg",
          "g",
        );
        g.setAttribute("data-dot-label", BATCH);
        // An opaque backing so the branch rail doesn't show through the
        // translucent count tint.
        h.rect(g, {
          x: R - 90,
          y: R - 17,
          width: 180,
          height: 34,
          rx: 8,
          fill: "var(--bg)",
          stroke: "none",
          strokeWidth: 0,
        });
        h.rect(g, {
          x: R - 90,
          y: R - 17,
          width: 180,
          height: 34,
          rx: 8,
          fill: h.C.countSoft,
          stroke: h.C.count,
          dash: "5 3",
        });
        h.text(g, {
          x: R,
          y: R + 4,
          content: BATCH,
          size: 11,
          anchor: "middle",
        });
        return g;
      },
    });
    feature.merge({
      branch: main,
      commitOptions: {
        hash: "fig-1-M",
        subject: "M",
        dotText: "M",
        style: { dot: h.dot.counted },
      },
    });
  },
  annotate({ svg, h }) {
    const BATCH = "batch: 16 same-day commits";
    const R = h.DOT_RADIUS;
    const at = (name) => h.center(svg, name);
    const m4 = at("m4");
    const batch = at(BATCH);
    const M = at("M");
    const o = h.overlay(svg);

    // The generated first-parent arrow would land inside the batch pill;
    // replace it with an arrowhead at the pill's edge.
    h.pruneArrow(svg, "M", BATCH);
    h.arrowhead(o, { x: batch.x + 94, y: batch.y });

    ["m1", "m2", "m3", "m4"].forEach((name, index) => {
      const { x, y } = at(name);
      h.text(o, {
        x,
        y: y - R - 10,
        content: `N=${index + 1}`,
        size: 10.5,
        fill: h.C.textSoft,
        anchor: "middle",
      });
    });
    h.text(o, {
      x: M.x + R + 8,
      y: M.y + 4,
      content: "N=21",
      size: 10.5,
      fill: h.C.textSoft,
    });

    h.text(o, {
      x: (batch.x + 94 + M.x - R) / 2,
      y: batch.y + 30,
      content: "1st parent",
      size: 10.5,
      fill: h.C.textSoft,
      anchor: "middle",
    });
    h.text(o, {
      x: M.x - 64,
      y: m4.y + 24,
      content: "2nd parent",
      size: 10.5,
      fill: h.C.textSoft,
    });

    // The sparse sequence: a number line with a tick per assigned N and a
    // never-assigned 5-20 gap between m4 and M.
    const axisY = batch.y + R + 44;
    const axis = { stroke: h.C.borderStrong, width: 1.5 };
    h.arrow(o, { x1: at("m1").x - 20, y1: axisY, x2: M.x + 24, y2: axisY, ...axis });
    ["m1", "m2", "m3", "m4"].forEach((name, index) => {
      const { x } = at(name);
      h.arrow(o, { x1: x, y1: axisY - 7, x2: x, y2: axisY + 7, ...axis });
      h.text(o, {
        x,
        y: axisY - 15,
        content: String(index + 1),
        size: 11,
        anchor: "middle",
      });
    });
    h.arrow(o, { x1: M.x, y1: axisY - 7, x2: M.x, y2: axisY + 7, ...axis });
    h.text(o, { x: M.x, y: axisY - 15, content: "21", size: 11, anchor: "middle" });
    h.el(o, "path", {
      d: `M${m4.x},${axisY} L${M.x},${axisY}`,
      stroke: h.C.error,
      "stroke-width": 2,
      "stroke-dasharray": "1 5",
      "stroke-linecap": "round",
      fill: "none",
    });
    h.text(o, {
      x: (m4.x + M.x) / 2,
      y: axisY + 22,
      content: "5-20: no commit; reverse lookup MUST report not found",
      size: 11,
      fill: h.C.error,
      anchor: "middle",
    });
  },
};
