// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: CC-BY-4.0

// Figure 2: one shared commit graph, scored two ways. Four main-branch
// commits are merged into a feature branch and fast-forwarded back onto
// main; Panel A (0.2, first-parent-only) sees the count drop 4 to 3, Panel B
// (0.3, date cohort) sees it rise 4 to 7 on the exact same graph.

"use strict";
window.figure = {
  id: "fig-2",
  title: "The incident topology, scored two ways",
  desc:
    "A shared commit graph where four main-branch commits are merged into a " +
    "feature branch and the merge is fast-forwarded back onto main. Panel A " +
    "shows 0.2’s first-parent-only count dropping from 4 to 3. Panel B " +
    "shows 0.3’s date-cohort count rising from 4 to 7 on the exact same " +
    "graph, because every commit stays reachable.",
  draw({ GitgraphJS, container, h }) {
    const gitgraph = GitgraphJS.createGitgraph(container, {
      orientation: GitgraphJS.Orientation.Horizontal,
      reverseArrow: true,
      template: h.template(GitgraphJS, {
        branch: { spacing: 72 },
        commit: { spacing: 92 },
      }),
    });

    // main and feature are both created before any commit exists, so
    // neither has a parent: feature's own ancestry (before F1) is elided
    // from the figure, drawn as a dashed stub in annotate() instead of a
    // real fork edge.
    const main = gitgraph.branch("main");
    const feature = gitgraph.branch("feature");

    for (const name of ["C1", "C2", "C3", "C4"]) {
      main.commit({
        hash: `fig-2-${name}`,
        subject: name,
        dotText: name,
        style: { dot: h.dot.neutral },
      });
    }
    for (const name of ["F1", "F2"]) {
      feature.commit({
        hash: `fig-2-${name}`,
        subject: name,
        dotText: name,
        style: { dot: h.dot.neutral },
      });
    }
    // feature tip (F2) is the first parent, main tip (C4) the second.
    feature.merge({
      branch: main,
      commitOptions: {
        hash: "fig-2-M",
        subject: "M",
        dotText: "M",
        style: { dot: h.dot.neutral },
      },
    });
  },
  annotate({ svg, h }) {
    const R = h.DOT_RADIUS;
    const at = (name) => h.center(svg, name);
    const C1 = at("C1");
    const C4 = at("C4");
    const F1 = at("F1");
    const F2 = at("F2");
    const M = at("M");
    const o = h.overlay(svg);

    h.text(o, {
      x: C1.x - R - 4,
      y: C1.y - R - 18,
      content:
        "Seven same-date commits; Panel A and Panel B disagree on how many count",
      size: 11.5,
      fill: h.C.textSoft,
    });

    // F1's own ancestry is elided: a dashed stub trailing off to "..."
    // instead of a real parent edge.
    h.el(o, "path", {
      d: `M${F1.x - R - 4},${F1.y} L${F1.x - R - 26},${F1.y}`,
      stroke: h.C.borderStrong,
      "stroke-width": 1.5,
      "stroke-dasharray": "2 3",
      fill: "none",
    });
    h.text(o, {
      x: F1.x - R - 54,
      y: F1.y + 5,
      content: "...",
      size: 14,
      fill: h.C.textSoft,
    });

    // The generated merge arrows (reverseArrow: true, arrowhead at the
    // parent) already land correctly since every dot here is a plain
    // circle; just label the two parent edges.
    h.text(o, {
      x: (F2.x + M.x) / 2,
      y: F2.y + 28,
      content: "1st parent",
      size: 10.5,
      fill: h.C.textSoft,
      anchor: "middle",
    });
    h.text(o, {
      x: (C4.x + M.x) / 2,
      y: (C4.y + M.y) / 2 - 10,
      content: "2nd parent",
      size: 10.5,
      fill: h.C.textSoft,
      anchor: "middle",
    });

    const arrowEnd = h.marker(svg, "fig-2-arrow");
    const x0 = C1.x - R - 4;
    const graphBottom = Math.max(F1.y, F2.y, M.y) + R;
    // IBM Plex Mono's 0.6em advance (see helpers.js), used to place the
    // colored tail of a sentence directly after its plain lead-in as two
    // separate <text> elements: an h.text() tspan array would work too, but
    // the render pipeline's HTML pretty-printer inserts whitespace between
    // sibling tspans that a browser collapses into a visible extra space,
    // doubling the gap after the sentence's non-breaking space.
    const MONO_ADVANCE = 0.6;
    function sentence({ y, lead, tail, tailFill }) {
      h.text(o, { x: x0, y, content: lead, size: 13 });
      h.text(o, {
        x: x0 + lead.length * 13 * MONO_ADVANCE,
        y,
        content: tail,
        size: 13,
        fill: tailFill,
        weight: 600,
      });
    }

    // A row of chained count pills, mirroring the panel's mapping from
    // commit to running count.
    function pillRow({ y, height, size, width, gap, items }) {
      let x = x0;
      items.forEach((label, index) => {
        h.pill(o, { x, y, width, height, label, size });
        if (index < items.length - 1) {
          h.arrow(o, {
            x1: x + width,
            y1: y + height / 2,
            x2: x + width + gap,
            y2: y + height / 2,
            end: arrowEnd,
          });
        }
        x += width + gap;
      });
      return x - gap;
    }

    // Panel A — 0.2's first-parent-only count: only F1, F2, and M sit on
    // the first-parent chain, so C1-C4 don't count at all.
    const panelAY = graphBottom + 36;
    h.text(o, {
      x: x0,
      y: panelAY,
      content: "Panel A — 0.2 (position in date block, first-parent chain only)",
      size: 13,
      weight: 600,
    });
    const pillAY = panelAY + 12;
    const lastA = pillRow({
      y: pillAY,
      height: 26,
      size: 12,
      width: 64,
      gap: 14,
      items: ["F1=1", "F2=2", "M=3"],
    });
    h.pill(o, {
      x: lastA + 36,
      y: pillAY,
      width: 250,
      height: 26,
      label: "C1, C2, C3, C4 — not counted",
      size: 11.5,
      fill: "none",
      stroke: h.C.border,
      dash: "3 3",
      labelFill: h.C.textSoft,
    });
    sentence({
      y: panelAY + 60,
      lead: "Before the merge, C4’s own count was 4. ",
      tail: "4 to 3: decrease",
      tailFill: h.C.error,
    });

    // Panel B — 0.3's date-cohort count: every commit stays reachable, so
    // all seven still count, just through a different parent.
    const panelBY = panelAY + 90;
    h.text(o, {
      x: x0,
      y: panelBY,
      content: "Panel B — 0.3 (date cohort, all parents)",
      size: 13,
      weight: 600,
    });
    const pillBY = panelBY + 12;
    pillRow({
      y: pillBY,
      height: 26,
      size: 11.5,
      width: 58,
      gap: 14,
      items: ["C1=1", "C2=2", "C3=3", "C4=4", "F1=5", "F2=6", "M=7"],
    });
    sentence({
      y: panelBY + 63,
      lead: "Before the merge, C4’s own count was 4. ",
      tail: "4 to 7: increase",
      tailFill: h.C.count,
    });
  },
};
