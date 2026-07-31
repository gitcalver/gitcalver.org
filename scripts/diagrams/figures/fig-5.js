// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: CC-BY-4.0

// Figure 5: publication continuity under the same reparenting topology as
// Figure 2. C4, the previous canonical tag's target, is no longer M's
// first-parent ancestor, but it is still reachable through M's second parent
// with an unchanged date, so step 5 passes. A contrast panel shows a target
// that is reachable but later-dated than the publishing commit, which still
// fails the check.

"use strict";

// prettier (run by render.mjs on the finalized markup) is whitespace-
// sensitive for known HTML inline elements but not for SVG <tspan>, so it
// reformats sibling tspans onto their own indented lines — whitespace a
// browser then renders as a literal space. That's invisible for the site's
// existing tspan usage (a single highlighted word always ends the sentence),
// but fig-5's captions resume plain text right after the highlighted word.
// Laying each run out as its own positioned <text> (monospace advance is a
// fixed 0.6em; see render.mjs's header comment) sidesteps the reflow because
// stray whitespace between sibling elements outside a text-layout context
// isn't rendered at all.
function flowText(h, parent, { x, y, size, runs }) {
  const ADVANCE = 0.6;
  let cursor = x;
  for (const run of runs) {
    h.text(parent, { x: cursor, y, content: run.text, size, ...run });
    cursor += run.text.length * size * ADVANCE;
  }
}

window.figure = {
  id: "fig-5",
  title: "Publication continuity under the reparenting topology",
  desc:
    "The same graph as Figure 2: the previous canonical tag’s target C4 " +
    "is no longer the publishing commit M’s first-parent ancestor, but it " +
    "is still reachable through M’s second parent with an unchanged date, " +
    "so step 5 passes. A reachable target with a later date than the " +
    "publishing commit still fails the check.",
  draw({ GitgraphJS, container, h }) {
    const gitgraph = GitgraphJS.createGitgraph(container, {
      orientation: GitgraphJS.Orientation.Horizontal,
      reverseArrow: true,
      template: h.template(GitgraphJS, {}),
    });

    // Two independent roots (no shared ancestor drawn): main carries the
    // C1..C4 chain, feature the orphan F1-F2 pair the "..." stub continues.
    const main = gitgraph.branch("main");
    const feature = gitgraph.branch("feature");

    main.commit({
      hash: "fig-5-c1",
      subject: "C1",
      dotText: "C1",
      style: { dot: h.dot.neutral },
    });
    main.commit({
      hash: "fig-5-c2",
      subject: "C2",
      dotText: "C2",
      style: { dot: h.dot.neutral },
    });
    feature.commit({
      hash: "fig-5-f1",
      subject: "F1",
      dotText: "F1",
      style: { dot: h.dot.neutral },
    });
    main.commit({
      hash: "fig-5-c3",
      subject: "C3",
      dotText: "C3",
      style: { dot: h.dot.neutral },
    });
    feature.commit({
      hash: "fig-5-f2",
      subject: "F2",
      dotText: "F2",
      style: { dot: h.dot.neutral },
    });
    main.commit({
      hash: "fig-5-c4",
      subject: "C4",
      dotText: "C4",
      style: { dot: h.dot.emphasis },
    });
    feature.merge({
      branch: main,
      commitOptions: {
        hash: "fig-5-m",
        subject: "M",
        dotText: "M",
        style: { dot: h.dot.emphasis },
      },
    });
  },
  annotate({ svg, h }) {
    const R = h.DOT_RADIUS;
    const at = (name) => h.center(svg, name);
    const c4 = at("C4");
    const f1 = at("F1");
    const f2 = at("F2");
    const m = at("M");
    const o = h.overlay(svg);

    // The dashed stub left of F1: an off-screen, earlier orphan ancestor.
    h.arrow(o, {
      x1: f1.x - R - 16,
      y1: f1.y,
      x2: f1.x - R - 2,
      y2: f1.y,
      dash: "2 3",
    });
    h.text(o, {
      x: f1.x - R - 46,
      y: f1.y + 5,
      content: "...",
      size: 14,
      fill: h.C.textSoft,
    });

    // The 2nd-parent edge (M -> C4) is the one step 5 relies on; recolor it
    // and its label to match the check below.
    h.recolorArrow(svg, "M", "C4", h.C.count);

    h.text(o, {
      x: (m.x + f2.x) / 2 - 4,
      y: (m.y + f2.y) / 2 - 10,
      content: "1st parent",
      size: 10.5,
      fill: h.C.textSoft,
      anchor: "middle",
    });
    h.text(o, {
      x: c4.x + 0.62 * (m.x - c4.x) + 8,
      y: c4.y + 0.62 * (m.y - c4.y) - 16,
      content: "2nd parent",
      size: 10.5,
      fill: h.C.count,
    });

    const graphBottom = Math.max(f1.y, f2.y, m.y) + R;
    const left = f1.x - R - 46 - 10;

    h.text(o, {
      x: left,
      y: graphBottom + 30,
      content:
        "C4 = target of the previously published canonical tag · M = " +
        "publishing commit",
      size: 11.5,
      fill: h.C.textSoft,
    });

    h.check(o, { x: left, y: graphBottom + 43 });
    flowText(h, o, {
      x: left + 26,
      y: graphBottom + 52,
      size: 12.5,
      runs: [
        { text: "M reaches C4 (2nd parent, non-later date): step 5 " },
        { text: "passes", fill: h.C.count, weight: 600 },
        { text: "." },
      ],
    });

    const contrastY = graphBottom + 90;
    h.text(o, {
      x: left,
      y: contrastY,
      content: "Contrast — a target that fails step 5",
      size: 13,
      weight: 600,
    });

    // A minimal M -> D1 pair drawn as overlay boxes, matching the original
    // figure's own hand-placed callout rather than a second gitgraph scene.
    const mY = contrastY + 15;
    const mBox = { x: left + 34, y: mY, width: 58, height: 30 };
    const d1Box = { x: mBox.x + 122, y: mY, width: 58, height: 30 };
    h.rect(o, {
      ...mBox,
      fill: h.dot.counted.color,
      stroke: h.dot.counted.strokeColor,
      strokeWidth: h.dot.counted.strokeWidth,
    });
    h.text(o, {
      x: mBox.x + mBox.width / 2,
      y: mBox.y + mBox.height / 2 + 4,
      content: "M",
      size: 12,
      anchor: "middle",
    });
    h.rect(o, {
      ...d1Box,
      fill: h.dot.rejected.color,
      stroke: h.dot.rejected.strokeColor,
      strokeWidth: h.dot.rejected.strokeWidth,
    });
    h.text(o, {
      x: d1Box.x + d1Box.width / 2,
      y: d1Box.y + d1Box.height / 2 + 4,
      content: "D1",
      size: 12,
      anchor: "middle",
    });
    h.arrow(o, {
      x1: mBox.x + mBox.width,
      y1: mY + mBox.height / 2,
      x2: d1Box.x - 7,
      y2: mY + mBox.height / 2,
      stroke: h.C.error,
      width: 1.5,
    });
    h.arrowhead(o, {
      x: d1Box.x,
      y: mY + mBox.height / 2,
      deg: 0,
      color: h.C.error,
    });

    h.cross(o, { x: d1Box.x + d1Box.width + 20, y: mY + 3 });
    h.text(o, {
      x: d1Box.x + d1Box.width + 46,
      y: mY + 20,
      content: "later date than M, still reachable",
      size: 11,
      fill: h.C.error,
    });

    flowText(h, o, {
      x: left,
      y: mY + d1Box.height + 32,
      size: 12.5,
      runs: [
        { text: "D1 is later-dated than M: step 5 " },
        { text: "fails", fill: h.C.error, weight: 600 },
        { text: " despite being reachable." },
      ],
    });
  },
};
