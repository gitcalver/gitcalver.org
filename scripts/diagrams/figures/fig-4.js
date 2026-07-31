// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: CC-BY-4.0

// Figure 4: whether a shallow clone can prove a target's cohort, as two
// stacked mini-graphs. Top: target T merges a same-date parent A1 (itself
// rooted in a boundary strictly older than the target, so no hidden history
// beyond it can share the date) and a parent B1 that is itself an older
// boundary. Bottom: the same T <- A1 chain, but A1's boundary shares the
// target's date, so history beyond it is unknown and the implementation must
// refuse rather than guess.

"use strict";

const NS = "http://www.w3.org/2000/svg";

const LABEL_T = "T";
const LABEL_A1 = "A1";
const LABEL_B1 = "B1";
const LABEL_BOUNDARY_OLDER = "boundary, older";
const LABEL_BOUNDARY_SAME = "boundary, same date";
const HEADING_TOP = "Provable—exit code 0 permitted";
const HEADING_BOTTOM = "Not provable—exit code 4 required";
const CAPTION_TOP = "every path ends at a root or an older date";
const CAPTION_BOTTOM = "boundary shares the target’s date—unproven";

// A wide custom-dot pill for a shallow-clone boundary commit, matching the
// technique in fig-1's batch pill: the dot's own (R, R) anchor sits at the
// pill's center, so it slots into the gitgraph rail like any other commit.
function boundaryPill(container, h, { label, width, height, fill, stroke, strokeWidth, dash, fontSize }) {
  return () => {
    const R = h.DOT_RADIUS;
    const g = container.ownerDocument.createElementNS(NS, "g");
    g.setAttribute("data-dot-label", label);
    h.rect(g, {
      x: R - width / 2,
      y: R - height / 2,
      width,
      height,
      rx: 6,
      fill,
      stroke,
      strokeWidth,
      dash,
    });
    h.text(g, {
      x: R,
      y: R + 4,
      content: label,
      size: fontSize,
      anchor: "middle",
    });
    return g;
  };
}

let topDiv;
let botDiv;

window.figure = {
  id: "fig-4",
  title: "Whether a shallow clone can prove a target’s cohort",
  desc:
    "Top: every path from the target reaches either a same-date commit " +
    "that keeps being explored, or a boundary strictly older than the " +
    "target, so the count is provable. Bottom: a boundary that shares the " +
    "target’s date leaves open whether hidden history beyond it " +
    "shares the date too, so the implementation must refuse with the " +
    "incomplete-history result.",
  draw({ GitgraphJS, container, h }) {
    topDiv = container.ownerDocument.createElement("div");
    botDiv = container.ownerDocument.createElement("div");
    container.append(topDiv, botDiv);

    const options = {
      orientation: GitgraphJS.Orientation.Horizontal,
      reverseArrow: true,
      template: h.template(GitgraphJS, { commit: { spacing: 130 } }),
    };

    // Top: T merges A1 (rooted in an older boundary) and B1 (itself a
    // pruned, older boundary). Horizontal orientation draws parents to the
    // left of children, so the whole graph mirrors the original's
    // left-to-right T -> A1 -> boundary flow.
    const top = GitgraphJS.createGitgraph(topDiv, options);
    const a = top.branch("a");
    a.commit({
      hash: "fig-4-top-boundary",
      subject: LABEL_BOUNDARY_OLDER,
      renderDot: boundaryPill(container, h, {
        label: LABEL_BOUNDARY_OLDER,
        width: 140,
        height: 30,
        fill: h.C.bgSunk,
        stroke: h.C.count,
        strokeWidth: 1.5,
        dash: "4 3",
        fontSize: 10.5,
      }),
    });
    a.commit({
      hash: "fig-4-top-a1",
      subject: LABEL_A1,
      dotText: LABEL_A1,
      style: { dot: h.dot.counted },
    });
    // B1 must be its own root, independent of A1 (the original draws no
    // relation between them). `top.branch("b")` with no `from` would default
    // `parentCommitHash` to the current HEAD (A1's commit, per
    // @gitgraph/core's `createBranch`), making gitgraph.js record and draw a
    // real B1 -> A1 parent arrow. Passing a `from` that never resolves to a
    // real ref or commit hash (per `createBranch`'s `parentCommitHash`
    // lookup) leaves `parentCommitHash` undefined, so B1 is committed with no
    // parents at all.
    const b = top.branch({ name: "b", from: "fig-4-top-b1-no-such-parent" });
    b.commit({
      hash: "fig-4-top-b1",
      subject: LABEL_B1,
      dotText: LABEL_B1,
      style: { dot: h.dot.pruned },
    });
    a.merge({
      branch: b,
      commitOptions: {
        hash: "fig-4-top-t",
        subject: LABEL_T,
        dotText: LABEL_T,
        style: { dot: h.dot.counted },
      },
    });

    // Bottom: the same T <- A1 chain, but A1's boundary shares the target's
    // date instead of being strictly older.
    const bot = GitgraphJS.createGitgraph(botDiv, options);
    const c = bot.branch("c");
    c.commit({
      hash: "fig-4-bot-boundary",
      subject: LABEL_BOUNDARY_SAME,
      renderDot: boundaryPill(container, h, {
        label: LABEL_BOUNDARY_SAME,
        width: 170,
        height: 30,
        fill: h.C.bgSunk,
        stroke: h.C.error,
        strokeWidth: 2,
        fontSize: 10.5,
      }),
    });
    c.commit({
      hash: "fig-4-bot-a1",
      subject: LABEL_A1,
      dotText: LABEL_A1,
      style: { dot: h.dot.counted },
    });
    c.commit({
      hash: "fig-4-bot-t",
      subject: LABEL_T,
      dotText: LABEL_T,
      style: { dot: h.dot.counted },
    });
  },
  annotate({ svg, h }) {
    const topSvg = svg;
    const botSvg = botDiv.querySelector("svg");

    // ---------- top scene (already the target svg; no dy offset needed) ----------
    const topBoundary = h.center(topSvg, LABEL_BOUNDARY_OLDER);
    const topA1 = h.center(topSvg, LABEL_A1);
    const rawTop = topSvg.getBBox();

    // B1 is a pruned, older-boundary parent: dash its ring and de-emphasize
    // its label to match the neutral/pruned styling used elsewhere.
    h.dashDot(topSvg, LABEL_B1);
    for (const node of topSvg.querySelectorAll("g > text")) {
      if (node.textContent !== LABEL_B1) continue;
      node.setAttribute("fill", h.C.textSoft);
      break;
    }

    const oTop = h.overlay(topSvg);

    // A1's generated parent arrow would land inside the wide boundary pill;
    // replace it with an arrowhead at the pill's right edge (parents sit to
    // the left of children in this horizontal, reverseArrow layout).
    h.pruneArrow(topSvg, LABEL_A1, LABEL_BOUNDARY_OLDER);
    h.arrowhead(oTop, { x: topBoundary.x + 70 + 4, y: topBoundary.y });

    const checkY = topBoundary.y - 15 - 8;
    h.check(oTop, { x: topBoundary.x - 70 + 21, y: checkY });
    const checkTopY = checkY - 7;

    h.text(oTop, {
      x: rawTop.x,
      y: Math.min(rawTop.y, checkTopY) - 14,
      content: HEADING_TOP,
      size: 12,
      weight: 600,
    });
    h.text(oTop, {
      x: topA1.x,
      y: rawTop.y + rawTop.height + 24,
      content: CAPTION_TOP,
      size: 10,
      fill: h.C.textSoft,
      anchor: "middle",
    });

    // ---------- bottom scene (annotated in its own local frame first) ----------
    const botBoundary = h.center(botSvg, LABEL_BOUNDARY_SAME);
    const botA1 = h.center(botSvg, LABEL_A1);
    const rawBot = botSvg.getBBox();

    const oBot = h.overlay(botSvg);
    h.pruneArrow(botSvg, LABEL_A1, LABEL_BOUNDARY_SAME);
    h.arrowhead(oBot, { x: botBoundary.x + 85 + 4, y: botBoundary.y });
    // The cross sits on the pill's far (left) side, clear of the parent
    // arrow that enters from the right (A1's side).
    h.cross(oBot, { x: botBoundary.x - 85 - 22, y: botBoundary.y - 7 });

    const headingBotLocalY = rawBot.y - 14;
    const captionBotLocalY = rawBot.y + rawBot.height + 24;

    // ---------- stack: embed the bottom scene below the top scene's caption ----------
    const topFull = topSvg.getBBox();
    const gap = 30;
    const dy = topFull.y + topFull.height + gap - rawBot.y;
    h.embed(topSvg, botSvg, { dx: 0, dy });

    const oFinal = h.overlay(topSvg);
    h.text(oFinal, {
      x: rawBot.x,
      y: headingBotLocalY + dy,
      content: HEADING_BOTTOM,
      size: 12,
      weight: 600,
    });
    h.text(oFinal, {
      x: botA1.x,
      y: captionBotLocalY + dy,
      content: CAPTION_BOTTOM,
      size: 10,
      fill: h.C.error,
      anchor: "middle",
    });
  },
};
