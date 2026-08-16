// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: CC-BY-4.0

// Figure 3: one selected-chain step from m4 to M. M keeps m4 as its first
// parent and brings in sixteen same-date feature commits through its second
// parent, so its date cohort grows from 4 to 21. The middle N values are
// therefore unassigned.

"use strict";

const BATCH = "16 commits";

function batchDot(container, h) {
  return () => {
    const R = h.DOT_RADIUS;
    const g = container.ownerDocument.createElementNS(
      "http://www.w3.org/2000/svg",
      "g",
    );
    g.setAttribute("data-dot-label", BATCH);

    // Three offset cards make the collapsed batch read as several commits,
    // not as one unusually wide commit.
    for (const offset of [8, 4, 0]) {
      h.rect(g, {
        x: R - 64 - offset,
        y: R - 16 - offset / 2,
        width: 128,
        height: 32,
        rx: 8,
        fill: h.C.bgSunk,
        stroke: h.C.count,
        strokeWidth: 1,
      });
    }
    h.rect(g, {
      x: R - 64,
      y: R - 16,
      width: 128,
      height: 32,
      rx: 8,
      fill: h.C.countSoft,
      stroke: h.C.count,
      strokeWidth: 1.5,
    });
    h.text(g, {
      x: R,
      y: R + 4,
      content: BATCH,
      size: 11.5,
      weight: 600,
      anchor: "middle",
    });
    return g;
  };
}

window.figure = {
  id: "fig-3",
  title: "A merge grows the date cohort from 4 to 21",
  desc:
    "All commits shown share one UTC date. The selected chain advances from " +
    "m4, whose date cohort has four commits, to merge M. M keeps m4 as its " +
    "first parent and reaches sixteen additional feature commits through its " +
    "second parent. Including M itself gives N of 21. Values 5 through 20 " +
    "are unassigned, so reverse lookup for them returns not found.",
  draw({ GitgraphJS, container, h }) {
    const gitgraph = GitgraphJS.createGitgraph(container, {
      orientation: GitgraphJS.Orientation.Horizontal,
      reverseArrow: true,
      template: h.template(GitgraphJS, {
        branch: { spacing: 72 },
        commit: { spacing: 110 },
      }),
    });

    const main = gitgraph.branch("main");
    main.commit({
      hash: "fig-3-m1",
      subject: "m1",
      dotText: "m1",
      style: { dot: h.dot.counted },
    });
    const feature = main.branch("feature");
    for (const name of ["m2", "m3", "m4"]) {
      main.commit({
        hash: `fig-3-${name}`,
        subject: name,
        dotText: name,
        style: { dot: h.dot.counted },
      });
    }
    feature.commit({
      hash: "fig-3-batch",
      subject: BATCH,
      renderDot: batchDot(container, h),
    });

    // M is committed on main: m4 is its first parent and the feature batch
    // its second. This ordering is what keeps the sixteen feature commits
    // off the selected chain.
    main.merge({
      branch: feature,
      commitOptions: {
        hash: "fig-3-M",
        subject: "M",
        dotText: "M",
        style: { dot: h.dot.emphasis },
      },
    });
  },
  annotate({ svg, h }) {
    const R = h.DOT_RADIUS;
    const at = (name) => h.center(svg, name);
    const m1 = at("m1");
    const m4 = at("m4");
    const batch = at(BATCH);
    const M = at("M");
    const o = h.overlay(svg);

    h.backDots(svg, ["m1", "m2", "m3", "m4", "M"]);
    const parentMarker = h.marker(svg, "fig-3-parent-arrow");
    for (const [child, parent] of [
      ["m2", "m1"],
      ["m3", "m2"],
      ["m4", "m3"],
      [BATCH, "m1"],
      ["M", "m4"],
    ]) {
      h.replaceParentArrow(svg, {
        child,
        parent,
        overlay: o,
        markerEnd: parentMarker,
      });
    }
    h.replaceParentArrow(svg, {
      child: "M",
      parent: BATCH,
      overlay: o,
      markerEnd: parentMarker,
      parentRadius: 64,
    });

    h.text(o, {
      x: m1.x - R,
      y: m1.y - R - 24,
      content: "ALL COMMITS: SAME UTC DATE",
      size: 11,
      fill: h.C.textSoft,
      weight: 600,
    });
    h.text(o, {
      x: M.x + R + 58,
      y: m1.y - R - 24,
      content: "parent links point left",
      size: 10,
      fill: h.C.textSoft,
      anchor: "end",
    });
    h.text(o, {
      x: m1.x - R,
      y: m1.y - R - 8,
      content: "SELECTED CHAIN",
      size: 10,
      fill: h.C.live,
      weight: 600,
    });
    h.text(o, {
      x: batch.x,
      y: batch.y - 28,
      content: "FEATURE BRANCH",
      size: 10,
      fill: h.C.textSoft,
      weight: 600,
      anchor: "middle",
    });

    h.text(o, {
      x: (m4.x + M.x) / 2,
      y: m4.y - R - 9,
      content: "1st parent",
      size: 10,
      fill: h.C.live,
      anchor: "middle",
    });
    h.text(o, {
      x: (batch.x + M.x) / 2 + 18,
      y: batch.y + 30,
      content: "2nd parent",
      size: 10,
      fill: h.C.textSoft,
      anchor: "middle",
    });

    h.pill(o, {
      x: m4.x - 31,
      y: m4.y + R + 13,
      width: 62,
      label: "N=4",
      size: 11.5,
    });
    h.pill(o, {
      x: M.x - 35,
      y: M.y + R + 13,
      width: 70,
      label: "N=21",
      size: 11.5,
    });

    const left = m1.x - R;
    const right = M.x + R + 58;
    const width = right - left;
    const calcY = Math.max(batch.y + 48, M.y + R + 52);

    h.rect(o, {
      x: left,
      y: calcY,
      width,
      height: 94,
      rx: 10,
      fill: h.C.bgSunk,
      stroke: h.C.border,
      strokeWidth: 1,
    });
    h.text(o, {
      x: left + 16,
      y: calcY + 22,
      content: "WHY THE NEXT N IS 21",
      size: 11,
      fill: h.C.textSoft,
      weight: 600,
    });

    const tileY = calcY + 34;
    const tileH = 46;
    const tile = (x, tileWidth, number, label, emphasized = false) => {
      h.rect(o, {
        x,
        y: tileY,
        width: tileWidth,
        height: tileH,
        rx: 8,
        fill: emphasized ? h.C.countSoft : "none",
        stroke: emphasized ? h.C.count : h.C.border,
        strokeWidth: emphasized ? 1.5 : 1,
      });
      h.text(o, {
        x: x + 12,
        y: tileY + 22,
        content: number,
        size: 19,
        fill: emphasized ? h.C.count : h.C.text,
        weight: 600,
      });
      h.text(o, {
        x: x + 12,
        y: tileY + 38,
        content: label,
        size: 9.5,
        fill: h.C.textSoft,
      });
    };

    let x = left + 16;
    tile(x, 116, "4", "already reachable");
    x += 130;
    h.text(o, {
      x: x - 7,
      y: tileY + 29,
      content: "+",
      size: 18,
      anchor: "middle",
    });
    tile(x, 116, "16", "merged commits");
    x += 130;
    h.text(o, {
      x: x - 7,
      y: tileY + 29,
      content: "+",
      size: 18,
      anchor: "middle",
    });
    tile(x, 102, "1", "merge commit");
    x += 122;
    h.text(o, {
      x: x - 10,
      y: tileY + 29,
      content: "=",
      size: 18,
      anchor: "middle",
    });
    tile(x, 100, "21", "N(M)", true);

    const stripY = calcY + 116;
    h.text(o, {
      x: left,
      y: stripY,
      content: "ASSIGNED N VALUES",
      size: 11,
      fill: h.C.textSoft,
      weight: 600,
    });
    const blocksY = stripY + 12;
    h.pill(o, {
      x: left,
      y: blocksY,
      width: 150,
      height: 30,
      label: "1  2  3  4",
      size: 11.5,
    });
    h.pill(o, {
      x: left + 164,
      y: blocksY,
      width: 260,
      height: 30,
      label: "5–20  ·  UNASSIGNED",
      size: 11.5,
      fill: h.C.bgSunk,
      stroke: h.C.borderStrong,
      dash: "4 3",
      labelFill: h.C.textSoft,
    });
    h.pill(o, {
      x: left + 438,
      y: blocksY,
      width: 78,
      height: 30,
      label: "21",
      size: 11.5,
    });
    h.text(o, {
      x: left + 294,
      y: blocksY + 50,
      content: "reverse lookup in this gap: NOT FOUND",
      size: 11,
      fill: h.C.error,
      weight: 600,
      anchor: "middle",
    });
  },
};
