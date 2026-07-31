// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: CC-BY-4.0

// Figure 4: two geometrically matched shallow-history cases. Both contain
// the same B <- A1 <- T path and the same unavailable history beyond B.
// Only B's date changes: an older B is a safe stopping point, while a
// same-date B must be counted and leaves its unavailable parents unresolved.

"use strict";

let bottomContainer;

window.figure = {
  id: "fig-4",
  title: "Whether a shallow clone can prove a target’s cohort",
  desc:
    "Two matched shallow-history cases show target T, same-date commit A1, " +
    "boundary B, and unavailable parent history beyond a shallow cut. " +
    "Top: B is older than T, so the walk prunes at B before unavailable " +
    "history matters and exit code 0 is permitted. Bottom: B shares T's " +
    "date and counts, but its parents are unavailable; hidden same-date " +
    "commits may exist, so exit code 4 is required.",
  draw({ GitgraphJS, container, h }) {
    const topContainer = container.ownerDocument.createElement("div");
    bottomContainer = container.ownerDocument.createElement("div");
    container.append(topContainer, bottomContainer);

    const drawCase = (host, key, boundaryStyle) => {
      const gitgraph = GitgraphJS.createGitgraph(host, {
        orientation: GitgraphJS.Orientation.Horizontal,
        reverseArrow: true,
        template: h.template(GitgraphJS, { commit: { spacing: 132 } }),
      });
      const path = gitgraph.branch(key);
      path.commit({
        hash: `fig-4-${key}-b`,
        subject: "B",
        dotText: "B",
        style: { dot: boundaryStyle },
      });
      path.commit({
        hash: `fig-4-${key}-a1`,
        subject: "A1",
        dotText: "A1",
        style: { dot: h.dot.counted },
      });
      path.commit({
        hash: `fig-4-${key}-t`,
        subject: "T",
        dotText: "T",
        style: { dot: h.dot.emphasis },
      });
    };

    drawCase(topContainer, "provable", h.dot.pruned);
    drawCase(bottomContainer, "incomplete", h.dot.counted);
  },
  annotate({ svg, h }) {
    const bottomSvg = bottomContainer.querySelector("svg");

    const annotateCase = (
      scene,
      { status, exit, boundaryLabel, lines, provable },
    ) => {
      const R = h.DOT_RADIUS;
      const boundary = h.center(scene, "B");
      const a1 = h.center(scene, "A1");
      const target = h.center(scene, "T");
      const o = h.overlay(scene);

      h.backDots(scene, ["B", "A1", "T"]);
      if (provable) h.dashDot(scene, "B");
      const key = provable ? "provable" : "incomplete";
      const parentMarker = h.marker(scene, `fig-4-${key}-parent-arrow`);
      const countMarker = h.marker(
        scene,
        `fig-4-${key}-count-arrow`,
        h.C.count,
      );
      h.replaceParentArrow(scene, {
        child: "T",
        parent: "A1",
        overlay: o,
        markerEnd: countMarker,
        color: h.C.count,
      });
      h.replaceParentArrow(scene, {
        child: "A1",
        parent: "B",
        overlay: o,
        markerEnd: provable ? parentMarker : countMarker,
        color: provable ? h.C.borderStrong : h.C.count,
      });

      const cutX = boundary.x - 52;
      const hiddenNearX = cutX - 36;
      const hiddenFarX = cutX - 80;
      const panel = {
        x: boundary.x - 174,
        y: boundary.y - 104,
        width: target.x - boundary.x + 286,
        height: 226,
      };
      // Matched panel frame and status row.
      h.rect(o, {
        ...panel,
        rx: 10,
        fill: "none",
        stroke: h.C.border,
        strokeWidth: 1,
      });
      h.pill(o, {
        x: panel.x + 16,
        y: panel.y + 14,
        width: 104,
        height: 24,
        label: status,
        size: 10.5,
        fill: provable ? h.C.countSoft : h.C.bgSunk,
        stroke: provable ? h.C.count : h.C.borderStrong,
      });
      h.text(o, {
        x: panel.x + 136,
        y: panel.y + 31,
        content: exit,
        size: 11,
        fill: h.C.textSoft,
        weight: 600,
      });
      h.arrow(o, {
        x1: panel.x + 16,
        y1: panel.y + 48,
        x2: panel.x + panel.width - 16,
        y2: panel.y + 48,
        stroke: h.C.border,
        width: 1,
      });

      // The dotted rail and question-mark commits make the absent parent
      // history visible without pretending its topology or dates are known.
      h.arrow(o, {
        x1: hiddenFarX,
        y1: boundary.y,
        x2: cutX - 5,
        y2: boundary.y,
        stroke: h.C.border,
        width: 1.5,
        dash: "2 4",
      });
      h.arrow(o, {
        x1: cutX + 5,
        y1: boundary.y,
        x2: boundary.x - R - 2,
        y2: boundary.y,
        stroke: h.C.border,
        width: 1.5,
        dash: "2 4",
      });
      for (const x of [hiddenFarX, hiddenNearX]) {
        h.rect(o, {
          x: x - 12,
          y: boundary.y - 12,
          width: 24,
          height: 24,
          rx: 12,
          fill: h.C.bgSunk,
          stroke: h.C.border,
          strokeWidth: 1.5,
          dash: "3 3",
        });
        h.text(o, {
          x,
          y: boundary.y + 4,
          content: "?",
          size: 12,
          fill: h.C.textSoft,
          anchor: "middle",
        });
      }

      // A vertical interruption is easier to scan as a shallow boundary
      // than a special commit shape, while B remains visibly a real commit.
      h.arrow(o, {
        x1: cutX,
        y1: boundary.y - 28,
        x2: cutX,
        y2: boundary.y + 28,
        stroke: h.C.borderStrong,
        width: 1.5,
        dash: "4 3",
      });
      h.text(o, {
        x: cutX,
        y: boundary.y - 36,
        content: "SHALLOW CUT",
        size: 9,
        fill: h.C.textSoft,
        anchor: "middle",
        weight: 600,
      });

      // Shared semantic labels keep the topology self-contained.
      const labelY = boundary.y + 42;
      h.text(o, {
        x: (hiddenFarX + hiddenNearX) / 2,
        y: labelY,
        content: "hidden history",
        size: 9.5,
        fill: h.C.textSoft,
        anchor: "middle",
      });
      h.text(o, {
        x: boundary.x,
        y: labelY,
        content: boundaryLabel,
        size: 9.5,
        fill: h.C.textSoft,
        anchor: "middle",
      });
      h.text(o, {
        x: a1.x,
        y: labelY,
        content: "same date as T",
        size: 9.5,
        fill: h.C.textSoft,
        anchor: "middle",
      });
      h.text(o, {
        x: target.x,
        y: labelY,
        content: "target",
        size: 9.5,
        fill: h.C.textSoft,
        anchor: "middle",
      });

      // A short proof summary explains why the visually small date change at
      // B changes the required result.
      const summaryY = boundary.y + 66;
      h.arrow(o, {
        x1: panel.x + 16,
        y1: summaryY,
        x2: panel.x + panel.width - 16,
        y2: summaryY,
        stroke: h.C.border,
        width: 1,
      });
      h.text(o, {
        x: panel.x + 18,
        y: summaryY + 22,
        content: lines[0],
        size: 10.5,
        fill: h.C.textSoft,
      });
      h.text(o, {
        x: panel.x + 18,
        y: summaryY + 42,
        content: lines[1],
        size: 10.5,
        fill: provable ? h.C.live : h.C.text,
        weight: 600,
      });
    };

    annotateCase(svg, {
      status: "PROVABLE",
      exit: "exit 0 permitted",
      boundaryLabel: "older than T",
      lines: [
        "Older B is pruned before hidden parents are needed.",
        "Every parent path is proven.",
      ],
      provable: true,
    });
    annotateCase(bottomSvg, {
      status: "INCOMPLETE",
      exit: "exit 4 required",
      boundaryLabel: "same date as T",
      lines: [
        "B counts, but its parents are unavailable.",
        "Hidden same-date commits may exist.",
      ],
      provable: false,
    });

    // Each local panel has identical geometry; align them exactly and keep a
    // compact gutter between cases.
    const topBox = svg.getBBox();
    const bottomBox = bottomSvg.getBBox();
    h.embed(svg, bottomSvg, {
      dx: topBox.x - bottomBox.x,
      dy: topBox.y + topBox.height + 22 - bottomBox.y,
    });
  },
};
