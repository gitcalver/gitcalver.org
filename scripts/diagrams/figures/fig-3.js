// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: CC-BY-4.0

// Figure 3: target T's date-cohort walk. A2 <- A1 <- T is a same-date chain
// of counted commits, drawn with gitgraph.js. T's two other parents can't be
// drawn as a real octopus merge, so they're annotated boxes: B1, an
// older-dated safe boundary (pruned, not counted, nothing behind it visited),
// and C1, a later-dated parent that forces rejection.

"use strict";
window.figure = {
  id: "fig-3",
  title: "Computing a target’s date cohort: count, prune, or reject",
  desc:
    "From target T, a same-date parent A1 is counted and explored further " +
    "to A2. An older-dated parent B1 is a safe boundary: not counted, and " +
    "nothing behind it needs to be visited. A later-dated parent C1 " +
    "triggers rejection as a decreasing-history error.",
  draw({ GitgraphJS, container, h }) {
    const gitgraph = GitgraphJS.createGitgraph(container, {
      orientation: GitgraphJS.Orientation.Horizontal,
      reverseArrow: true,
      template: h.template(GitgraphJS, { commit: { spacing: 120 } }),
    });

    const main = gitgraph.branch("main");
    for (const name of ["A2", "A1", "T"]) {
      main.commit({
        hash: `fig-3-${name.toLowerCase()}`,
        subject: name,
        dotText: name,
        style: { dot: h.dot.counted },
      });
    }
  },
  annotate({ svg, h }) {
    const R = h.DOT_RADIUS;
    const BOX_W = 64;
    const BOX_H = 32;
    const at = (name) => h.center(svg, name);
    const A1 = at("A1");
    const T = at("T");
    const o = h.overlay(svg);

    // A point on the line from `from` toward `to`, `r` away from `from` —
    // used to land arrow endpoints on a dot's ring or a box's edge.
    const edgePoint = (from, to, r) => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: from.x + (dx / len) * r, y: from.y + (dy / len) * r };
    };

    const b1 = { x: T.x + 150, y: T.y - 78 };
    const c1 = { x: T.x, y: T.y + 98 };

    // Arrows and the dashed stub first, so the boxes drawn afterward paint
    // cleanly over where the arrowheads land, matching the original figure's
    // layering (its own <path> arrows precede the box/text elements).
    // Dashed stub past B1: elided safe history that never needs visiting.
    h.arrow(o, {
      x1: b1.x + BOX_W / 2,
      y1: b1.y,
      x2: b1.x + BOX_W / 2 + 30,
      y2: b1.y,
      dash: "2 3",
    });
    const bMarker = h.marker(svg, "fig-3-arrow");
    {
      const start = edgePoint(T, b1, R + 2);
      const end = edgePoint(b1, T, 26);
      h.arrow(o, { x1: start.x, y1: start.y, x2: end.x, y2: end.y, end: bMarker });
    }
    const cMarker = h.marker(svg, "fig-3-arrow-error", h.C.error);
    h.arrow(o, {
      x1: T.x,
      y1: T.y + R,
      x2: c1.x,
      y2: c1.y - BOX_H / 2 - 1,
      stroke: h.C.error,
      end: cMarker,
    });

    // "target" caption below T, nudged left of the T-C1 edge it would
    // otherwise straddle; "same date" near the T-A1 edge above the rail.
    h.text(o, {
      x: T.x - 8,
      y: T.y + R + 18,
      content: "target",
      size: 10,
      fill: h.C.textSoft,
      anchor: "end",
    });
    h.text(o, {
      x: (A1.x + T.x) / 2,
      y: T.y - R - 10,
      content: "same date",
      size: 10,
      fill: h.C.textSoft,
      anchor: "middle",
    });

    // B1: T's older, safe-boundary parent — gitgraph.js can't draw a
    // three-parent octopus merge, so an annotated dashed box up-right of T.
    h.rect(o, {
      x: b1.x - BOX_W / 2,
      y: b1.y - BOX_H / 2,
      width: BOX_W,
      height: BOX_H,
      stroke: h.C.border,
      dash: "4 3",
    });
    h.text(o, {
      x: b1.x,
      y: b1.y + 4,
      content: "B1",
      size: 13,
      fill: h.C.textSoft,
      anchor: "middle",
    });
    h.text(o, {
      x: b1.x,
      y: b1.y - BOX_H / 2 - 14,
      content: "older date—pruned",
      size: 10,
      fill: h.C.textSoft,
      anchor: "middle",
    });

    // C1: T's newer parent — a later date means rejection, not pruning.
    h.rect(o, {
      x: c1.x - BOX_W / 2,
      y: c1.y - BOX_H / 2,
      width: BOX_W,
      height: BOX_H,
      stroke: h.C.error,
      strokeWidth: 2,
    });
    h.text(o, {
      x: c1.x,
      y: c1.y + 4,
      content: "C1",
      size: 13,
      anchor: "middle",
    });
    h.text(o, {
      x: c1.x,
      y: c1.y + BOX_H / 2 + 18,
      content: "later date—rejected",
      size: 10,
      fill: h.C.error,
      anchor: "middle",
    });

    // Legend.
    const legendY = c1.y + BOX_H / 2 + 46;
    const legendX = A1.x - 120;
    const swatch = (x, label, options) => {
      h.rect(o, { x, y: legendY, width: 14, height: 14, rx: 0, ...options });
      h.text(o, {
        x: x + 20,
        y: legendY + 11,
        content: label,
        size: 10.5,
        fill: h.C.textSoft,
      });
    };
    swatch(legendX, "counted (same date)", {
      fill: h.C.countSoft,
      stroke: h.C.count,
    });
    swatch(legendX + 175, "pruned (older, safe)", {
      fill: h.C.bgSunk,
      stroke: h.C.border,
      dash: "2 2",
    });
    swatch(legendX + 175 + 165, "rejected (newer)", {
      fill: h.C.bgSunk,
      stroke: h.C.error,
      strokeWidth: 2,
    });
  },
};
