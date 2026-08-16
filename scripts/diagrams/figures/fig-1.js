// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: CC-BY-4.0

// Figure 1: the backward date-cohort walk, centered on target T. Parents are
// consistently to the left of their children: same-date A1 and A2 are counted
// and keep the walk going, older B1 stops only its path, and later C1 rejects
// the entire calculation.

"use strict";
window.figure = {
  id: "fig-1",
  title: "Computing a target’s date cohort: count, prune, or reject",
  desc:
    "The walk starts by counting target T, then follows child-to-parent " +
    "arrows from right to left. Same-date A1 and A2 are counted and " +
    "continued through. Older B1 is not counted and prunes only its path. " +
    "Later C1 rejects the entire calculation.",
  draw({ GitgraphJS, container, h }) {
    const gitgraph = GitgraphJS.createGitgraph(container, {
      orientation: GitgraphJS.Orientation.Horizontal,
      reverseArrow: true,
      template: h.template(GitgraphJS, { commit: { spacing: 144 } }),
    });

    const main = gitgraph.branch("main");
    for (const name of ["A2", "A1"]) {
      main.commit({
        hash: `fig-1-${name.toLowerCase()}`,
        subject: name,
        dotText: name,
        style: { dot: h.dot.counted },
      });
    }
    main.commit({
      hash: "fig-1-t",
      subject: "T",
      dotText: "T",
      style: { dot: h.dot.emphasis },
    });
  },
  annotate({ svg, h }) {
    const R = h.DOT_RADIUS;
    const at = (name) => h.center(svg, name);
    const A2 = at("A2");
    const A1 = at("A1");
    const T = at("T");
    const B1 = { x: A1.x, y: T.y - 110 };
    const C1 = { x: A1.x, y: T.y + 110 };
    const o = h.overlay(svg);

    const edgePoint = (from, to, distance) => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy) || 1;
      return {
        x: from.x + (dx / length) * distance,
        y: from.y + (dy / length) * distance,
      };
    };

    const parentArrow = (parent, { color, marker }) => {
      const start = edgePoint(T, parent, R + 2);
      const end = edgePoint(parent, T, R + 3);
      h.arrow(o, {
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        stroke: color,
        end: marker,
      });
    };

    h.backDots(svg, ["A2", "A1", "T"]);
    const countMarker = h.marker(svg, "fig-1-count-arrow", h.C.count);
    for (const [child, parent] of [
      ["A1", "A2"],
      ["T", "A1"],
    ]) {
      h.replaceParentArrow(svg, {
        child,
        parent,
        overlay: o,
        markerEnd: countMarker,
        color: h.C.count,
      });
    }
    const parentMarker = h.marker(svg, "fig-1-parent-arrow");
    const errorMarker = h.marker(svg, "fig-1-error-arrow", h.C.error);
    parentArrow(B1, { color: h.C.borderStrong, marker: parentMarker });
    parentArrow(C1, { color: h.C.error, marker: errorMarker });

    const commitCircle = (
      label,
      center,
      { stroke, strokeWidth = 1.5, dash, fill = h.C.bgSunk },
    ) => {
      h.el(o, "circle", {
        id: `fig-1-${label.toLowerCase()}`,
        cx: center.x,
        cy: center.y,
        r: R,
        fill,
        stroke,
        "stroke-width": strokeWidth,
        "stroke-dasharray": dash,
      });
      h.text(o, {
        x: center.x,
        y: center.y + 4,
        content: label,
        size: 13,
        fill: dash ? h.C.textSoft : h.C.text,
        anchor: "middle",
      });
    };

    commitCircle("B1", B1, {
      stroke: h.C.border,
      dash: "4 3",
    });
    commitCircle("C1", C1, {
      stroke: h.C.error,
      strokeWidth: 2,
    });

    // Explicit traversal grammar: all arrowheads point from a child toward
    // its parent, which is always farther left.
    h.text(o, {
      x: (A1.x + T.x) / 2,
      y: B1.y - 70,
      content: "walk: child -> parent (right to left)",
      size: 10.5,
      fill: h.C.textSoft,
      anchor: "middle",
      weight: 600,
    });

    const sameX = (A2.x + A1.x) / 2;
    h.pill(o, {
      x: sameX - 44,
      y: T.y - 58,
      width: 88,
      height: 24,
      label: "same date",
      size: 10.5,
    });
    h.pill(o, {
      x: sameX - 66,
      y: T.y + 26,
      width: 132,
      height: 24,
      label: "count + continue",
      size: 10.5,
    });

    h.pill(o, {
      x: T.x + R + 12,
      y: T.y - 30,
      width: 94,
      height: 24,
      label: "target date",
      size: 10.5,
    });
    h.pill(o, {
      x: T.x + R + 12,
      y: T.y + 6,
      width: 76,
      height: 24,
      label: "count T",
      size: 10.5,
    });

    h.pill(o, {
      x: B1.x - 45,
      y: B1.y - 50,
      width: 90,
      height: 24,
      label: "older date",
      size: 10.5,
      fill: h.C.bgSunk,
      stroke: h.C.border,
      labelFill: h.C.textSoft,
      dash: "4 3",
    });
    h.pill(o, {
      x: B1.x - 140,
      y: B1.y - 12,
      width: 116,
      height: 24,
      label: "no count + prune",
      size: 10.5,
      fill: h.C.bgSunk,
      stroke: h.C.border,
      labelFill: h.C.textSoft,
      dash: "4 3",
    });

    h.pill(o, {
      x: C1.x - 158,
      y: C1.y - 12,
      width: 134,
      height: 24,
      label: "reject calculation",
      size: 10.5,
      fill: h.C.bgSunk,
      stroke: h.C.error,
      labelFill: h.C.error,
    });
    h.pill(o, {
      x: C1.x - 45,
      y: C1.y + 28,
      width: 90,
      height: 24,
      label: "later date",
      size: 10.5,
      fill: h.C.bgSunk,
      stroke: h.C.error,
      labelFill: h.C.error,
    });
  },
};
