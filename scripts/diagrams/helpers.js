// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: MIT

// Window-side library for the figure scenes in figures/: a shared gitgraph.js
// template bound to the site's design tokens, an annotation overlay (arrows,
// pills, checks, crosses), and the finalize pass that turns gitgraph.js output
// into the site's accessible, theme-aware inline SVG. Also provides the SVG
// geometry jsdom lacks (getBBox), computed analytically with conservative
// Inter bounds so rendering stays deterministic and browser-free.

"use strict";
(() => {
  const NS = "http://www.w3.org/2000/svg";
  const TEXT_BOUND_ADVANCE = 1.1;
  // Inter's hhea ascender and descender (1984 and 494 on a 2048 em).
  const TEXT_ASCENT = 0.969;
  const TEXT_DESCENT = 0.242;
  const TEXT_CENTRAL_HALF = 0.65;

  // Design tokens from site/assets/css/main.css. The rendered SVG keeps these
  // var() references, so figures follow the page's light/dark scheme.
  const C = {
    bg: "var(--bg)",
    text: "var(--text)",
    textSoft: "var(--text-soft)",
    border: "var(--border)",
    borderStrong: "var(--border-strong)",
    bgSunk: "var(--bg-sunk)",
    count: "var(--count)",
    countSoft: "var(--count-soft)",
    live: "var(--live)",
    error: "var(--error)",
    date: "var(--date)",
  };

  // Commit-dot styles matching the figure legend established in the spec:
  // counted (same date), neutral (uncounted), pruned (older boundary; add
  // dashDot), rejected (newer date), emphasis (the commits under discussion).
  const dot = {
    neutral: { color: C.bgSunk, strokeColor: C.borderStrong, strokeWidth: 1.5 },
    counted: { color: C.countSoft, strokeColor: C.count, strokeWidth: 1.5 },
    emphasis: { color: C.countSoft, strokeColor: C.count, strokeWidth: 2 },
    pruned: { color: C.bgSunk, strokeColor: C.border, strokeWidth: 1.5 },
    rejected: { color: C.bgSunk, strokeColor: C.error, strokeWidth: 2 },
  };

  const DOT_RADIUS = 16;

  function template(GitgraphJS, overrides = {}) {
    const merged = {
      colors: [C.borderStrong, C.borderStrong, C.borderStrong, C.borderStrong],
      arrow: { size: 6, offset: 0, color: C.borderStrong, ...overrides.arrow },
      branch: {
        lineWidth: 1.5,
        spacing: 56,
        mergeStyle: "bezier",
        label: { display: false },
        ...overrides.branch,
      },
      commit: {
        spacing: 72,
        hasTooltipInCompactMode: false,
        ...overrides.commit,
        message: { display: false, ...(overrides.commit || {}).message },
        dot: {
          size: DOT_RADIUS,
          font: "400 13px Inter, system-ui, sans-serif",
          ...(overrides.commit || {}).dot,
        },
      },
    };
    return GitgraphJS.templateExtend(GitgraphJS.TemplateName.Metro, merged);
  }

  // The merge-then-fast-forward topology shared by Figures 2 and 5. Keeping
  // it here prevents the two explanations from drifting: M's first parent is
  // F2, its second parent is C4, and the selected branch advances from C4 to
  // M without rewriting any commit.
  function reparentingGraph(
    GitgraphJS,
    container,
    { id, styleFor = () => dot.neutral, templateOverrides = {}, merge = true },
  ) {
    const gitgraph = GitgraphJS.createGitgraph(container, {
      orientation: GitgraphJS.Orientation.Horizontal,
      reverseArrow: true,
      template: template(GitgraphJS, templateOverrides),
    });
    const commit = (branch, label) =>
      branch.commit({
        hash: `${id}-${label.toLowerCase()}`,
        subject: label,
        dotText: label,
        style: { dot: styleFor(label) },
      });

    const base = gitgraph.branch("base");
    commit(base, "O");
    const main = base;
    const feature = base.branch("feature");

    // O is the older common ancestor outside the illustrated date cohort.
    // Interleaving the branch commits keeps both lanes easy to compare.
    commit(main, "C1");
    commit(feature, "F1");
    commit(main, "C2");
    commit(feature, "F2");
    commit(main, "C3");
    commit(main, "C4");
    if (merge) {
      feature.merge({
        branch: main,
        commitOptions: {
          hash: `${id}-m`,
          subject: "M",
          dotText: "M",
          style: { dot: styleFor("M") },
        },
      });
    }
    return gitgraph;
  }

  // ---------- analytic geometry ----------

  function translateOf(element) {
    const transform = element.getAttribute && element.getAttribute("transform");
    let x = 0;
    let y = 0;
    if (transform) {
      const pattern = /translate\(\s*(-?[\d.]+)\s*[,\s]\s*(-?[\d.]+)\s*\)/g;
      for (const match of transform.matchAll(pattern)) {
        x += Number(match[1]);
        y += Number(match[2]);
      }
      // The analytic geometry only models translation; fail loudly rather
      // than silently mis-measure a rotated or scaled element.
      if (/[a-z]/i.test(transform.replace(pattern, ""))) {
        throw new Error(`unsupported transform ${transform}`);
      }
    }
    return { x, y };
  }

  function fontSizeOf(element) {
    const attr = element.getAttribute("font-size");
    if (attr) return Number(attr);
    const style = element.getAttribute("style") || "";
    const match = style.match(/font:[^;]*?([\d.]+)px/);
    if (match) return Number(match[1]);
    return 13;
  }

  function fontWeightOf(element) {
    const attr = element.getAttribute("font-weight");
    if (attr) return Number(attr);
    const style = element.getAttribute("style") || "";
    const match = style.match(/font:\s*(\d+)/);
    return match ? Number(match[1]) : 400;
  }

  const SKIP = new Set(["defs", "clipPath", "marker", "title", "desc"]);

  function shapeBounds(element) {
    const name = element.localName;
    const num = (attribute, fallback = 0) => {
      const value = element.getAttribute(attribute);
      return value === null ? fallback : Number(value);
    };
    if (name === "circle") {
      const cx = num("cx");
      const cy = num("cy");
      const r = num("r");
      return { minX: cx - r, minY: cy - r, maxX: cx + r, maxY: cy + r };
    }
    if (name === "rect") {
      const x = num("x");
      const y = num("y");
      return {
        minX: x,
        minY: y,
        maxX: x + num("width"),
        maxY: y + num("height"),
      };
    }
    if (name === "line") {
      const x1 = num("x1");
      const y1 = num("y1");
      const x2 = num("x2");
      const y2 = num("y2");
      return {
        minX: Math.min(x1, x2),
        minY: Math.min(y1, y2),
        maxX: Math.max(x1, x2),
        maxY: Math.max(y1, y2),
      };
    }
    if (name === "path") {
      // Absolute M/L/Q/C only (all gitgraph.js and the overlay emit). Control
      // points are included, a conservative superset of the true bounds.
      const d = element.getAttribute("d") || "";
      const numberToken = /-?[\d.]+(?:e[+-]?\d+)?/g;
      const commands = d.replace(numberToken, " ").match(/[a-z]/gi) || [];
      if (commands.some((command) => !"MLQCZ".includes(command))) {
        throw new Error(`unsupported path command in ${d}`);
      }
      const numbers = d.match(numberToken);
      if (!numbers || numbers.length < 2) return null;
      const bounds = emptyBounds();
      for (let i = 0; i + 1 < numbers.length; i += 2) {
        extend(bounds, Number(numbers[i]), Number(numbers[i + 1]));
      }
      return bounds;
    }
    if (name === "text") {
      const size = fontSizeOf(element);
      const width =
        typeof window.diagramTextWidth === "function"
          ? window.diagramTextWidth(
              element.textContent,
              size,
              fontWeightOf(element),
            )
          : [...element.textContent].length * size * TEXT_BOUND_ADVANCE;
      const x = num("x");
      const y = num("y");
      const anchor = element.getAttribute("text-anchor") || "start";
      const minX =
        anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
      // gitgraph.js text is vertically centered (dominant-baseline: central);
      // overlay text sits on an alphabetic baseline like the site's figures.
      const central = element.getAttribute("dominant-baseline") === "central";
      const minY = central
        ? y - size * TEXT_CENTRAL_HALF
        : y - size * TEXT_ASCENT;
      const maxY = central
        ? y + size * TEXT_CENTRAL_HALF
        : y + size * TEXT_DESCENT;
      return { minX, minY, maxX: minX + width, maxY };
    }
    if (name === "use") {
      const reference = element.getAttribute("href");
      if (!reference || !reference.startsWith("#")) return null;
      const target = element.ownerDocument.getElementById(reference.slice(1));
      return target ? shapeBounds(target) : null;
    }
    return null;
  }

  function emptyBounds() {
    return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  }

  function extend(bounds, x, y) {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  }

  function union(into, other, dx, dy) {
    if (!other || other.minX === Infinity) return;
    into.minX = Math.min(into.minX, other.minX + dx);
    into.minY = Math.min(into.minY, other.minY + dy);
    into.maxX = Math.max(into.maxX, other.maxX + dx);
    into.maxY = Math.max(into.maxY, other.maxY + dy);
  }

  // Bounds of an element's contents in its own user space: the element's own
  // transform is excluded, descendants' transforms apply — getBBox semantics.
  function bboxBounds(element) {
    if (SKIP.has(element.localName)) return null;
    const shape = shapeBounds(element);
    if (shape) return shape;
    const bounds = emptyBounds();
    for (const child of element.children) {
      if (SKIP.has(child.localName)) continue;
      const inner = shapeBounds(child) || bboxBounds(child);
      if (!inner) continue;
      const { x, y } = translateOf(child);
      union(bounds, inner, x, y);
    }
    return bounds;
  }

  function getBBox(element) {
    const bounds = bboxBounds(element) || emptyBounds();
    if (bounds.minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
    return {
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY,
    };
  }

  window.SVGElement.prototype.getBBox = function () {
    return getBBox(this);
  };

  // ---------- scene helpers ----------

  function el(parent, name, attributes = {}) {
    const node = parent.ownerDocument.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined) node.setAttribute(key, String(value));
    }
    parent.appendChild(node);
    return node;
  }

  // The center of a commit dot, in root-SVG coordinates, looked up by its
  // dotText label (or a custom renderDot element's data-dot-label).
  function center(svg, label) {
    const candidates = [];
    for (const custom of svg.querySelectorAll("[data-dot-label]")) {
      if (custom.getAttribute("data-dot-label") === label) {
        candidates.push(custom);
      }
    }
    for (const text of svg.querySelectorAll("g > text")) {
      if (text.textContent !== label) continue;
      const group = text.parentElement;
      if (group.querySelector("use")) candidates.push(group);
    }
    for (const group of candidates) {
      // dot <g> is translated to the commit position; the circle sits at
      // (radius, radius) within it.
      let x = DOT_RADIUS;
      let y = DOT_RADIUS;
      for (
        let node = group;
        node && node.localName !== "svg";
        node = node.parentElement
      ) {
        const t = translateOf(node);
        x += t.x;
        y += t.y;
      }
      return { x, y };
    }
    throw new Error(`no commit dot labeled ${label}`);
  }

  // The commit <g> (dot + arrows) for a labeled dot.
  function commitGroup(svg, label) {
    for (const custom of svg.querySelectorAll("[data-dot-label]")) {
      if (custom.getAttribute("data-dot-label") === label) {
        return custom.parentElement;
      }
    }
    for (const node of svg.querySelectorAll("g > text")) {
      if (node.textContent !== label) continue;
      const group = node.parentElement;
      if (group.querySelector("use")) return group.parentElement;
    }
    throw new Error(`no commit dot labeled ${label}`);
  }

  // The generated arrow <g> from one commit toward one parent.
  function findArrow(svg, commitLabel, parentLabel) {
    const from = center(svg, commitLabel);
    const to = center(svg, parentLabel);
    const expected = {
      x: DOT_RADIUS + to.x - from.x,
      y: DOT_RADIUS + to.y - from.y,
    };
    for (const child of commitGroup(svg, commitLabel).children) {
      if (child.localName !== "g" || child.children.length !== 1) continue;
      const path = child.firstElementChild;
      if (path.localName !== "path" || !path.getAttribute("fill")) continue;
      const t = translateOf(child);
      if (Math.hypot(t.x - expected.x, t.y - expected.y) < 1) return child;
    }
    throw new Error(`no arrow from ${commitLabel} to ${parentLabel}`);
  }

  // Remove the generated arrow from one commit toward one parent, for edges
  // where the annotation pass draws its own arrowhead instead (for example
  // when the parent has a custom-rendered dot the arrow would land inside).
  function pruneArrow(svg, commitLabel, parentLabel) {
    findArrow(svg, commitLabel, parentLabel).remove();
  }

  // Recolor one parent edge's arrowhead, for edges the figure calls out.
  function recolorArrow(svg, commitLabel, parentLabel, color) {
    findArrow(svg, commitLabel, parentLabel).firstElementChild.setAttribute(
      "fill",
      color,
    );
  }

  // A free-standing arrowhead with its tip at (x, y), pointing at `deg`
  // degrees (0 points right), sized to match the generated parent arrows.
  // The rotation is baked into the path data because the analytic geometry
  // above models translation only.
  function arrowhead(parent, { x, y, deg = 180, color = C.borderStrong }) {
    const radians = (deg * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const point = (px, py) =>
      `${Math.round((x + px * cos - py * sin) * 100) / 100},` +
      `${Math.round((y + px * sin + py * cos) * 100) / 100}`;
    return el(parent, "path", {
      d: `M${point(0, 0)} L${point(-9, -4.5)} L${point(-9, 4.5)} Z`,
      fill: color,
    });
  }

  // Dash a dot's ring for the pruned style. The ring that paints the stroke
  // is the <use> carrying a stroke attribute, not the clip-path's reference
  // copy that precedes it in document order.
  function dashDot(svg, label) {
    for (const node of svg.querySelectorAll("g > text")) {
      if (node.textContent !== label) continue;
      const ring = node.parentElement.querySelector("use[stroke]");
      if (!ring) continue;
      ring.setAttribute("stroke-dasharray", "4 3");
      return;
    }
    throw new Error(`no commit dot labeled ${label}`);
  }

  function overlay(svg) {
    return el(svg, "g", {});
  }

  function marker(svg, id, color = C.borderStrong) {
    let defs = svg.querySelector(":scope > defs");
    if (!defs) {
      defs = svg.ownerDocument.createElementNS(NS, "defs");
      svg.prepend(defs);
    }
    const node = el(defs, "marker", {
      id,
      viewBox: "0 0 10 10",
      refX: 8,
      refY: 5,
      markerWidth: 6,
      markerHeight: 6,
      orient: "auto",
    });
    el(node, "path", { d: "M0,0 L10,5 L0,10 Z", fill: color });
    return `url(#${id})`;
  }

  function arrow(parent, options) {
    const {
      x1,
      y1,
      x2,
      y2,
      stroke = C.borderStrong,
      width = 1.5,
      dash,
      end,
    } = options;
    return el(parent, "path", {
      d: `M${x1},${y1} L${x2},${y2}`,
      stroke,
      "stroke-width": width,
      "stroke-dasharray": dash,
      fill: "none",
      "marker-end": end,
    });
  }

  // Gitgraph's branch rails run through each commit center. Counted fills are
  // translucent, so place an opaque surface-colored disk behind native dots
  // to make every rail stop visually at the circle boundary.
  function backDots(svg, labels, fill = C.bg) {
    for (const node of svg.querySelectorAll("g > text")) {
      if (!labels.includes(node.textContent)) continue;
      const group = node.parentElement;
      const paintedDot = group.querySelector(":scope > use");
      if (!paintedDot || group.querySelector(":scope > [data-dot-backing]")) {
        continue;
      }
      const backing = el(group, "circle", {
        cx: DOT_RADIUS,
        cy: DOT_RADIUS,
        r: DOT_RADIUS,
        fill,
        stroke: "none",
        "data-dot-backing": "true",
      });
      group.insertBefore(backing, paintedDot);
    }
  }

  // Replace gitgraph's clipped chevron with the same compact triangular
  // marker used by hand-drawn parent edges. Horizontal gitgraphs approach
  // every parent from the right, including the endpoint of a merge Bézier.
  function replaceParentArrow(
    svg,
    {
      child,
      parent,
      overlay: parentOverlay,
      markerEnd,
      color = C.borderStrong,
      parentRadius = DOT_RADIUS,
      width = 1.5,
    },
  ) {
    pruneArrow(svg, child, parent);
    const { x, y } = center(svg, parent);
    const gap = 3;
    const endX = x + parentRadius + gap;
    return arrow(parentOverlay, {
      x1: endX + 10,
      y1: y,
      x2: endX,
      y2: y,
      stroke: color,
      width,
      end: markerEnd,
    });
  }

  function text(parent, options) {
    const { x, y, content, size = 13, fill = C.text, anchor, weight } = options;
    const node = el(parent, "text", {
      x,
      y,
      "font-size": size,
      fill,
      "text-anchor": anchor,
      "font-weight": weight,
    });
    if (typeof content === "string") {
      node.textContent = content;
    } else {
      for (const span of content) {
        const tspan = parent.ownerDocument.createElementNS(NS, "tspan");
        if (span.fill) tspan.setAttribute("fill", span.fill);
        if (span.weight) tspan.setAttribute("font-weight", String(span.weight));
        tspan.textContent = span.text;
        node.appendChild(tspan);
      }
    }
    return node;
  }

  function rect(parent, options) {
    const {
      x,
      y,
      width,
      height,
      rx = 6,
      fill = C.bgSunk,
      stroke = C.borderStrong,
      strokeWidth = 1.5,
      dash,
    } = options;
    return el(parent, "rect", {
      x,
      y,
      width,
      height,
      rx,
      fill,
      stroke,
      "stroke-width": strokeWidth,
      "stroke-dasharray": dash,
    });
  }

  // A rounded count chip like the panel rows in the 0.3 figures.
  function pill(parent, options) {
    const {
      x,
      y,
      width,
      height = 26,
      label,
      size = 12,
      fill = C.countSoft,
      stroke = C.count,
      labelFill = C.text,
      dash,
    } = options;
    rect(parent, {
      x,
      y,
      width,
      height,
      rx: height / 2,
      fill,
      stroke,
      strokeWidth: 1,
      dash,
    });
    if (label) {
      text(parent, {
        x: x + width / 2,
        y: y + height / 2 + size * 0.34,
        content: label,
        size,
        fill: labelFill,
        anchor: "middle",
      });
    }
  }

  function check(parent, { x, y, color = C.count }) {
    return el(parent, "path", {
      d: `M${x},${y} L${x + 5},${y + 7} L${x + 18},${y - 7}`,
      stroke: color,
      "stroke-width": 2,
      fill: "none",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    });
  }

  function cross(parent, { x, y, color = C.error }) {
    return el(parent, "path", {
      d: `M${x},${y} L${x + 14},${y + 14} M${x + 14},${y} L${x},${y + 14}`,
      stroke: color,
      "stroke-width": 2,
      fill: "none",
      "stroke-linecap": "round",
    });
  }

  // Move a rendered graph's contents into another SVG under a translated
  // group, for figures composed of more than one gitgraph.js scene.
  function embed(targetSvg, sourceSvg, { dx = 0, dy = 0 }) {
    const group = el(targetSvg, "g", {
      transform: `translate(${dx}, ${dy})`,
    });
    while (sourceSvg.firstChild) group.appendChild(sourceSvg.firstChild);
    sourceSvg.remove();
    return group;
  }

  // ---------- finalize ----------

  function finalize(svg, figure) {
    const { id, title, desc } = figure;

    // Deterministic output: every id must come from the scene, not from
    // gitgraph.js's random commit hashes.
    for (const node of svg.querySelectorAll("[id]")) {
      const value = node.getAttribute("id");
      if (!value.startsWith(id) && !value.startsWith(`clip-${id}`)) {
        throw new Error(
          `${id}: element id ${value} is not scene-assigned; ` +
            "pass an explicit hash for every commit",
        );
      }
    }

    for (const node of svg.querySelectorAll("*")) {
      // SVG2 href is set alongside deprecated xlink:href; keep only href
      // (the standalone file declares no xlink namespace).
      node.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
      for (const attribute of [...node.attributes]) {
        if (attribute.value === "") node.removeAttribute(attribute.name);
      }
    }

    // Text defaults to the text token; gitgraph.js leaves dotText unfilled.
    for (const node of svg.querySelectorAll("text")) {
      if (!node.getAttribute("fill")) node.setAttribute("fill", C.text);
    }

    const box = getBBox(svg);
    const pad = 6;
    const width = Math.ceil(box.width + 2 * pad);
    const height = Math.ceil(box.height + 2 * pad);
    svg.setAttribute("role", "img");
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute(
      "viewBox",
      `${box.x - pad} ${box.y - pad} ${width} ${height}`,
    );
    svg.setAttribute("aria-labelledby", `${id}-title ${id}-desc`);
    svg.setAttribute(
      "style",
      "font-family:Inter,system-ui,sans-serif;" +
        "font-weight:400;font-synthesis:none",
    );

    const doc = svg.ownerDocument;
    const descNode = doc.createElementNS(NS, "desc");
    descNode.setAttribute("id", `${id}-desc`);
    descNode.textContent = desc;
    svg.prepend(descNode);
    const titleNode = doc.createElementNS(NS, "title");
    titleNode.setAttribute("id", `${id}-title`);
    titleNode.textContent = title;
    svg.prepend(titleNode);

    return svg.outerHTML;
  }

  window.diagramHelpers = {
    C,
    dot,
    DOT_RADIUS,
    template,
    reparentingGraph,
    center,
    dashDot,
    pruneArrow,
    recolorArrow,
    arrowhead,
    overlay,
    marker,
    arrow,
    backDots,
    replaceParentArrow,
    text,
    rect,
    pill,
    check,
    cross,
    embed,
    el,
    finalize,
  };
})();
