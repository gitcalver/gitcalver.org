// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: CC-BY-4.0

// Figure 5: publication continuity on the exact incident topology from
// Figure 2. The graph identifies the previous tag target and publishing tip;
// matched cards then expose step 5's two independent predicates.

"use strict";

window.figure = {
  id: "fig-5",
  title: "Publication continuity checks reachability and date",
  desc:
    "An older common ancestor O forks into the main and feature histories. " +
    "The publishing commit M reaches the previous canonical tag target C4 " +
    "through its second parent, and C4 has the same date as M. Both step 5 " +
    "conditions pass, so publication may continue to later checks. In the " +
    "contrast, M reaches D1 but D1 is later-dated than M, so the date " +
    "condition fails and step 5 blocks publication.",
  draw({ GitgraphJS, container, h }) {
    h.incidentGraph(GitgraphJS, container, {
      id: "fig-5",
      templateOverrides: {
        branch: { spacing: 62 },
        commit: { spacing: 76 },
      },
      styleFor: (label) =>
        label === "O"
          ? h.dot.pruned
          : ["C4", "M"].includes(label)
            ? h.dot.emphasis
            : h.dot.neutral,
    });
  },
  annotate({ svg, h }) {
    const R = h.DOT_RADIUS;
    const at = (name) => h.center(svg, name);
    const O = at("O");
    const C1 = at("C1");
    const C4 = at("C4");
    const F1 = at("F1");
    const F2 = at("F2");
    const M = at("M");
    const o = h.overlay(svg);

    h.backDots(svg, ["O", "C1", "C2", "C3", "C4", "F1", "F2", "M"]);
    h.dashDot(svg, "O");
    for (const node of svg.querySelectorAll("g > text")) {
      if (node.textContent === "O") node.setAttribute("fill", h.C.textSoft);
    }
    h.text(o, {
      x: O.x,
      y: O.y - R - 10,
      content: "older common ancestor",
      size: 9.5,
      fill: h.C.textSoft,
      anchor: "middle",
    });

    // Step 5 relies on the whole second-parent edge. Extract gitgraph's exact
    // final Bézier from the main rail and repaint that segment behind the
    // commit dots, so the highlight cannot double or drift from the rail.
    const mainRail = svg.querySelector("path[transform][stroke]");
    const railData = mainRail && mainRail.getAttribute("d");
    const curve =
      railData &&
      railData.match(
        /C\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*$/,
      );
    if (!mainRail || !curve)
      throw new Error("fig-5: main merge rail not found");
    const beforeCurve = railData.slice(0, curve.index);
    const start = beforeCurve.match(/(-?[\d.]+)\s+(-?[\d.]+)\s*$/);
    if (!start) throw new Error("fig-5: merge curve start not found");
    h.el(mainRail.parentElement, "path", {
      d: `M ${start[1]} ${start[2]} ${curve[0]}`,
      stroke: h.C.count,
      "stroke-width": 2.5,
      fill: "none",
      "stroke-linecap": "round",
      transform: mainRail.getAttribute("transform"),
    });
    const parentMarker = h.marker(svg, "fig-5-parent-arrow");
    const countMarker = h.marker(svg, "fig-5-count-arrow", h.C.count);
    for (const [child, parent] of [
      ["C1", "O"],
      ["F1", "O"],
      ["C2", "C1"],
      ["C3", "C2"],
      ["C4", "C3"],
      ["F2", "F1"],
      ["M", "F2"],
      ["M", "C4"],
    ]) {
      const highlighted = child === "M" && parent === "C4";
      h.replaceParentArrow(svg, {
        child,
        parent,
        overlay: o,
        markerEnd: highlighted ? countMarker : parentMarker,
        color: highlighted ? h.C.count : h.C.borderStrong,
      });
    }

    h.text(o, {
      x: (F2.x + M.x) / 2,
      y: F2.y + 27,
      content: "1st parent",
      size: 9.5,
      fill: h.C.textSoft,
      anchor: "middle",
    });
    h.text(o, {
      x: M.x + R + 9,
      y: (C4.y + M.y) / 2 + 4,
      content: "2nd parent",
      size: 9.5,
      fill: h.C.live,
      weight: 600,
    });
    h.text(o, {
      x: O.x - R,
      y: O.y - R - 30,
      content: "PARENT LINKS POINT LEFT",
      size: 10,
      fill: h.C.textSoft,
      weight: 600,
    });

    // Role badges make the otherwise abstract C4 and M labels concrete.
    h.pill(o, {
      x: C4.x - 79,
      y: C4.y - R - 25,
      width: 158,
      height: 25,
      label: "PREVIOUS TAG TARGET",
      size: 9.5,
      fill: h.C.bgSunk,
      stroke: h.C.count,
    });
    h.pill(o, {
      x: M.x - 68,
      y: M.y + R + 11,
      width: 136,
      height: 25,
      label: "PUBLISHING TIP",
      size: 9.5,
      fill: h.C.countSoft,
      stroke: h.C.count,
    });

    const graphBottom = M.y + R + 52;
    const left = O.x - R;
    const cardGap = 14;
    const cardWidth = 324;
    const cardHeight = 184;
    const passX = left;
    const failX = passX + cardWidth + cardGap;
    const cardY = graphBottom + 26;

    h.text(o, {
      x: left,
      y: graphBottom,
      content: "STEP 5 ASKS TWO QUESTIONS",
      size: 12,
      fill: h.C.textSoft,
      weight: 600,
    });

    function commitCircle(parent, { x, y, label, state }) {
      h.el(parent, "circle", {
        cx: x,
        cy: y,
        r: R,
        fill: state.color,
        stroke: state.strokeColor,
        "stroke-width": state.strokeWidth,
      });
      h.text(parent, {
        x,
        y: y + 4,
        content: label,
        size: 11.5,
        anchor: "middle",
      });
    }

    function relation(parent, { x, y, ancestor, color, note }) {
      const ancestorX = x + 42;
      const tipX = x + 126;
      commitCircle(parent, {
        x: ancestorX,
        y,
        label: ancestor,
        state: ancestor === "D1" ? h.dot.rejected : h.dot.emphasis,
      });
      commitCircle(parent, {
        x: tipX,
        y,
        label: "M",
        state: h.dot.emphasis,
      });
      h.arrow(parent, {
        x1: tipX - R,
        y1: y,
        x2: ancestorX + R + 5,
        y2: y,
        stroke: color,
        width: 2,
      });
      h.arrowhead(parent, {
        x: ancestorX + R,
        y,
        color,
      });
      h.text(parent, {
        x: x + 158,
        y: y + 4,
        content: note,
        size: 10,
        fill: color === h.C.count ? h.C.live : color,
        weight: 600,
      });
    }

    function conditionRow(
      parent,
      { x, y, passes, label, detail, color = passes ? h.C.count : h.C.error },
    ) {
      if (passes) h.check(parent, { x, y: y - 7, color });
      else h.cross(parent, { x: x + 2, y: y - 9, color });
      h.text(parent, {
        x: x + 27,
        y: y + 2,
        content: label,
        size: 10.5,
      });
      h.text(parent, {
        x: x + 198,
        y: y + 2,
        content: detail,
        size: 10,
        fill: color === h.C.count ? h.C.live : color,
        weight: 600,
      });
    }

    function outcomeCard({
      x,
      title,
      status,
      color,
      relationColor = color,
      ancestor,
      note,
      rows,
      footer,
    }) {
      h.rect(o, {
        x,
        y: cardY,
        width: cardWidth,
        height: cardHeight,
        rx: 12,
        fill: h.C.bgSunk,
        stroke: color,
        strokeWidth: 1.5,
      });
      h.text(o, {
        x: x + 16,
        y: cardY + 25,
        content: title,
        size: 11.5,
        weight: 600,
      });
      h.pill(o, {
        x: x + cardWidth - 75,
        y: cardY + 10,
        width: 59,
        height: 24,
        label: status,
        size: 10,
        fill: h.C.bgSunk,
        stroke: color,
        labelFill: color === h.C.count ? h.C.live : color,
      });
      relation(o, {
        x: x + 16,
        y: cardY + 61,
        ancestor,
        color: relationColor,
        note,
      });
      conditionRow(o, { x: x + 17, y: cardY + 99, ...rows[0] });
      conditionRow(o, { x: x + 17, y: cardY + 126, ...rows[1] });
      h.pill(o, {
        x: x + 16,
        y: cardY + 144,
        width: cardWidth - 32,
        height: 26,
        label: footer,
        size: 10.5,
        fill: color === h.C.count ? h.C.countSoft : h.C.bgSunk,
        stroke: color,
        labelFill: color === h.C.count ? h.C.live : color,
      });
    }

    outcomeCard({
      x: passX,
      title: "C4 · PREVIOUS TAG TARGET",
      status: "PASS",
      color: h.C.count,
      ancestor: "C4",
      note: "via 2nd parent",
      rows: [
        {
          passes: true,
          label: "reachable from M",
          detail: "YES",
        },
        {
          passes: true,
          label: "date no later than M",
          detail: "YES · SAME",
        },
      ],
      footer: "STEP 5 PASSES · CONTINUE",
    });
    outcomeCard({
      x: failX,
      title: "D1 · CONTRAST",
      status: "FAIL",
      color: h.C.error,
      relationColor: h.C.count,
      ancestor: "D1",
      note: "reachable",
      rows: [
        {
          passes: true,
          label: "reachable from M",
          detail: "YES",
          color: h.C.count,
        },
        {
          passes: false,
          label: "date no later than M",
          detail: "NO · LATER",
        },
      ],
      footer: "STEP 5 FAILS · BLOCK",
    });
  },
};
