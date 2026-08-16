// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: CC-BY-4.0

// Figure 2: a before panel establishes two branches from one older common
// ancestor. Two matched after panels then score the same
// merge-then-fast-forward DAG by first-parent position and by the all-parent
// date cohort.

"use strict";

let beforeDiv;
let firstParentDiv;
let allParentsDiv;

window.figure = {
  id: "fig-2",
  title: "First-parent counting is fragile; all-parent counting is not",
  desc:
    "An older common ancestor O forks into main commits C1 through C4 and " +
    "unmerged feature commits F1 and F2; main points to C4 with a count of " +
    "4. After main is merged into feature and main fast-forwards to merge " +
    "M, M's first parent is F2 and its second parent is C4. A first-parent " +
    "position count reaches only M, F2, and F1, so it decreases from 4 to " +
    "3. The all-parent date cohort holds all seven same-date commits " +
    "reachable from M, so N increases from 4 to 7.",
  draw({ GitgraphJS, container, h }) {
    beforeDiv = container.ownerDocument.createElement("div");
    firstParentDiv = container.ownerDocument.createElement("div");
    allParentsDiv = container.ownerDocument.createElement("div");
    container.append(beforeDiv, firstParentDiv, allParentsDiv);

    const overrides = {
      branch: { spacing: 58 },
      commit: { spacing: 74 },
    };
    h.reparentingGraph(GitgraphJS, beforeDiv, {
      id: "fig-2-before",
      templateOverrides: overrides,
      merge: false,
      styleFor: (label) =>
        label === "O"
          ? h.dot.pruned
          : label.startsWith("C")
            ? h.dot.counted
            : h.dot.neutral,
    });
    h.reparentingGraph(GitgraphJS, firstParentDiv, {
      id: "fig-2-a",
      templateOverrides: overrides,
      styleFor: (label) =>
        label === "O"
          ? h.dot.pruned
          : ["F1", "F2", "M"].includes(label)
            ? label === "M"
              ? h.dot.emphasis
              : h.dot.counted
            : h.dot.pruned,
    });
    h.reparentingGraph(GitgraphJS, allParentsDiv, {
      id: "fig-2-b",
      templateOverrides: overrides,
      styleFor: (label) =>
        label === "O"
          ? h.dot.pruned
          : label === "M"
            ? h.dot.emphasis
            : h.dot.counted,
    });
  },
  annotate({ svg, h }) {
    const beforeSvg = svg;
    const firstSvg = firstParentDiv.querySelector("svg");
    const allSvg = allParentsDiv.querySelector("svg");

    function soften(svgNode, labels) {
      for (const node of svgNode.querySelectorAll("g > text")) {
        if (!labels.includes(node.textContent)) continue;
        node.setAttribute("fill", h.C.textSoft);
      }
    }

    function addBeforePanel(svgNode) {
      const at = (name) => h.center(svgNode, name);
      const O = at("O");
      const C1 = at("C1");
      const C4 = at("C4");
      const F1 = at("F1");
      const F2 = at("F2");
      const raw = svgNode.getBBox();
      const o = h.overlay(svgNode);

      h.backDots(
        svgNode,
        ["O", "C1", "C2", "C3", "C4", "F1", "F2"],
        h.C.bgSunk,
      );
      h.dashDot(svgNode, "O");
      soften(svgNode, ["O"]);

      const parentMarker = h.marker(svgNode, "fig-2-before-parent-arrow");
      const countMarker = h.marker(
        svgNode,
        "fig-2-before-count-arrow",
        h.C.count,
      );
      const countedEdges = new Set(["C2:C1", "C3:C2", "C4:C3"]);
      for (const [child, parent] of [
        ["C1", "O"],
        ["F1", "O"],
        ["C2", "C1"],
        ["C3", "C2"],
        ["C4", "C3"],
        ["F2", "F1"],
      ]) {
        const countedEdge = countedEdges.has(`${child}:${parent}`);
        h.replaceParentArrow(svgNode, {
          child,
          parent,
          overlay: o,
          markerEnd: countedEdge ? countMarker : parentMarker,
          color: countedEdge ? h.C.count : h.C.borderStrong,
        });
      }

      h.text(o, {
        x: O.x,
        y: O.y - h.DOT_RADIUS - 28,
        content: "older common ancestor · outside cohort",
        size: 9.5,
        fill: h.C.textSoft,
        anchor: "middle",
      });
      h.text(o, {
        x: C1.x,
        y: C1.y - h.DOT_RADIUS - 10,
        content: "SELECTED BRANCH",
        size: 9.5,
        fill: h.C.live,
        weight: 600,
        anchor: "middle",
      });
      h.text(o, {
        x: F1.x,
        y: F1.y + h.DOT_RADIUS + 29,
        content: "FEATURE BRANCH",
        size: 9.5,
        fill: h.C.textSoft,
        weight: 600,
        anchor: "middle",
      });
      h.pill(o, {
        x: C4.x - 68,
        y: C4.y + h.DOT_RADIUS + 12,
        width: 136,
        height: 26,
        label: "SELECTED TIP · N=4",
        size: 10,
      });
      h.pill(o, {
        x: F2.x - 49,
        y: F2.y - h.DOT_RADIUS - 38,
        width: 98,
        height: 25,
        label: "FEATURE TIP",
        size: 9.5,
        fill: h.C.bgSunk,
        stroke: h.C.borderStrong,
      });

      const headingY = raw.y - 52;
      h.pill(o, {
        x: raw.x,
        y: headingY - 15,
        width: 68,
        height: 25,
        label: "BEFORE",
        size: 10.5,
        fill: h.C.bgSunk,
        stroke: h.C.borderStrong,
      });
      h.text(o, {
        x: raw.x + 80,
        y: headingY + 3,
        content: "BRANCHES NOT MERGED",
        size: 12.5,
        weight: 600,
      });

      const footerY = Math.max(C4.y, F1.y, F2.y) + h.DOT_RADIUS + 67;
      h.text(o, {
        x: raw.x,
        y: footerY,
        content: "NEXT: MERGE MAIN INTO FEATURE, THEN FAST-FORWARD MAIN TO M",
        size: 10.5,
        fill: h.C.textSoft,
        weight: 600,
      });

      const full = svgNode.getBBox();
      const card = h.rect(svgNode, {
        x: full.x - 12,
        y: full.y - 12,
        width: full.width + 24,
        height: full.height + 24,
        rx: 12,
        fill: h.C.bgSunk,
        stroke: h.C.border,
        strokeWidth: 1,
      });
      svgNode.insertBefore(card, svgNode.firstChild);
      return { full: svgNode.getBBox() };
    }

    function addPanel(svgNode, options) {
      const {
        key,
        rule,
        counted,
        ignored,
        before,
        after,
        outcome,
        outcomeColor,
        countAll = false,
        dashExcluded = false,
      } = options;
      const at = (name) => h.center(svgNode, name);
      const O = at("O");
      const C1 = at("C1");
      const C4 = at("C4");
      const F1 = at("F1");
      const F2 = at("F2");
      const M = at("M");
      const raw = svgNode.getBBox();
      const o = h.overlay(svgNode);

      h.backDots(
        svgNode,
        ["O", "C1", "C2", "C3", "C4", "F1", "F2", "M"],
        h.C.bgSunk,
      );
      h.dashDot(svgNode, "O");
      soften(svgNode, ["O"]);
      const parentMarker = h.marker(svgNode, `fig-2-${key}-parent-arrow`);
      const countMarker = h.marker(
        svgNode,
        `fig-2-${key}-count-arrow`,
        h.C.count,
      );
      const countedEdges = new Set(["F2:F1", "M:F2"]);
      const boundaryEdges = new Set(["C1:O", "F1:O"]);
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
        const edge = `${child}:${parent}`;
        const countedEdge =
          !boundaryEdges.has(edge) && (countAll || countedEdges.has(edge));
        h.replaceParentArrow(svgNode, {
          child,
          parent,
          overlay: o,
          markerEnd: countedEdge ? countMarker : parentMarker,
          color: countedEdge ? h.C.count : h.C.borderStrong,
        });
      }

      if (dashExcluded) {
        for (const label of ["C1", "C2", "C3", "C4"]) h.dashDot(svgNode, label);
        soften(svgNode, ["C1", "C2", "C3", "C4"]);
      }

      h.text(o, {
        x: O.x,
        y: O.y - h.DOT_RADIUS - 10,
        content: "older common ancestor · outside cohort",
        size: 9.5,
        fill: h.C.textSoft,
        anchor: "middle",
      });

      h.text(o, {
        x: (F2.x + M.x) / 2,
        y: F2.y + 27,
        content: "1st parent",
        size: 9.5,
        fill: h.C.textSoft,
        anchor: "middle",
      });
      h.text(o, {
        x: C4.x + 0.55 * (M.x - C4.x),
        y: C4.y + 0.55 * (M.y - C4.y) - 10,
        content: "2nd parent",
        size: 9.5,
        fill: h.C.textSoft,
        anchor: "middle",
      });
      h.text(o, {
        x: C4.x,
        y: C4.y - h.DOT_RADIUS - 10,
        content: "old tip",
        size: 9.5,
        fill: h.C.textSoft,
        anchor: "middle",
      });
      h.text(o, {
        x: M.x,
        y: M.y - h.DOT_RADIUS - 10,
        content: "new tip",
        size: 9.5,
        fill: h.C.live,
        weight: 600,
        anchor: "middle",
      });

      const headingY = raw.y - 48;
      h.pill(o, {
        x: raw.x,
        y: headingY - 15,
        width: 68,
        height: 25,
        label: "AFTER",
        size: 10.5,
        fill: h.C.bgSunk,
        stroke: h.C.borderStrong,
      });
      h.text(o, {
        x: raw.x + 80,
        y: headingY + 3,
        content: rule,
        size: 12.5,
        weight: 600,
      });

      const resultX = raw.x + raw.width - 180;
      const resultY = headingY - 18;
      h.rect(o, {
        x: resultX,
        y: resultY,
        width: 180,
        height: 38,
        rx: 8,
        fill: h.C.bgSunk,
        stroke: outcomeColor,
        strokeWidth: 1.5,
      });
      h.text(o, {
        x: resultX + 11,
        y: resultY + 25,
        content: before,
        size: 18,
        weight: 600,
      });
      h.arrow(o, {
        x1: resultX + 38,
        y1: resultY + 19,
        x2: resultX + 64,
        y2: resultY + 19,
        stroke: outcomeColor,
        width: 1.5,
      });
      h.arrowhead(o, {
        x: resultX + 68,
        y: resultY + 19,
        deg: 0,
        color: outcomeColor,
      });
      h.text(o, {
        x: resultX + 78,
        y: resultY + 25,
        content: after,
        size: 18,
        fill: outcomeColor,
        weight: 600,
      });
      h.text(o, {
        x: resultX + 106,
        y: resultY + 23,
        content: outcome,
        size: 9.5,
        fill: outcomeColor === h.C.count ? h.C.live : outcomeColor,
        weight: 600,
      });

      const footerY = Math.max(F1.y, F2.y, M.y) + h.DOT_RADIUS + 24;
      h.pill(o, {
        x: raw.x,
        y: footerY,
        width: counted.width,
        height: 28,
        label: counted.label,
        size: 10.5,
      });
      if (ignored) {
        h.pill(o, {
          x: raw.x + counted.width + 12,
          y: footerY,
          width: ignored.width,
          height: 28,
          label: ignored.label,
          size: 10.5,
          fill: h.C.bgSunk,
          stroke: h.C.border,
          dash: "4 3",
          labelFill: h.C.textSoft,
        });
      }

      const full = svgNode.getBBox();
      const card = h.rect(svgNode, {
        x: full.x - 12,
        y: full.y - 12,
        width: full.width + 24,
        height: full.height + 24,
        rx: 12,
        fill: h.C.bgSunk,
        stroke: h.C.border,
        strokeWidth: 1,
      });
      svgNode.insertBefore(card, svgNode.firstChild);

      return { C1, full: svgNode.getBBox() };
    }

    const beforePanel = addBeforePanel(beforeSvg);
    const first = addPanel(firstSvg, {
      key: "a",
      rule: "FIRST-PARENT POSITION",
      counted: { label: "COUNTS  F1  F2  M", width: 184 },
      ignored: { label: "IGNORES  C1–C4", width: 170 },
      before: "4",
      after: "3",
      outcome: "DECREASES",
      outcomeColor: h.C.error,
      dashExcluded: true,
    });
    const second = addPanel(allSvg, {
      key: "b",
      rule: "ALL-PARENT DATE COHORT",
      counted: { label: "COUNTS ALL 7 REACHABLE COMMITS", width: 294 },
      before: "4",
      after: "7",
      outcome: "INCREASES",
      outcomeColor: h.C.count,
      countAll: true,
    });

    const gap = 18;
    const firstDy =
      beforePanel.full.y + beforePanel.full.height + gap - first.full.y;
    h.embed(beforeSvg, firstSvg, { dy: firstDy });
    const combined = beforeSvg.getBBox();
    const secondDy = combined.y + combined.height + gap - second.full.y;
    h.embed(beforeSvg, allSvg, { dy: secondDy });
  },
};
