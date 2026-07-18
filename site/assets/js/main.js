// Copyright © 2026 Michael Shields
// SPDX-License-Identifier: CC-BY-4.0

(function () {
  "use strict";

  function pad(value) {
    return value < 10 ? "0" + value : "" + value;
  }

  function utcParts() {
    var date = new Date();
    return {
      ymd:
        "" +
        date.getUTCFullYear() +
        pad(date.getUTCMonth() + 1) +
        pad(date.getUTCDate()),
      year: "" + date.getUTCFullYear(),
      month: pad(date.getUTCMonth() + 1),
      day: pad(date.getUTCDate()),
    };
  }

  function setText(id, text) {
    var element = document.getElementById(id);
    if (element) element.textContent = text;
  }

  function renderUtcDate() {
    var parts = utcParts();
    setText("gcv-date", parts.ymd);
    setText("gcv-date-val", parts.ymd);
    setText("gcv-year", parts.year);
    setText("gcv-month", parts.month);
    setText("gcv-day", parts.day);

    var version = document.getElementById("gcv-version");
    if (version) {
      version.setAttribute("aria-label", "Example version " + parts.ymd + ".1");
    }

    var today = document.getElementById("gcv-today");
    if (today) {
      today.innerHTML =
        '<span class="pulse"></span>Today is <span class="mono">' +
        parts.ymd +
        '</span> in UTC. The first commit pushed today would be <span class="mono">' +
        parts.ymd +
        ".1</span>.";
    }
  }

  function scheduleUtcRollover() {
    var date = new Date();
    var next = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + 1,
      0,
      0,
      1,
    );
    setTimeout(function () {
      renderUtcDate();
      scheduleUtcRollover();
    }, next - date.getTime());
  }

  if (document.getElementById("gcv-date")) {
    renderUtcDate();
    scheduleUtcRollover();
  }

  function fallbackCopy(text) {
    var active = document.activeElement;
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.setAttribute("aria-hidden", "true");
    textarea.style.position = "fixed";
    textarea.style.inset = "0 auto auto -9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    var copied = false;
    try {
      copied =
        typeof document.execCommand === "function" &&
        document.execCommand("copy");
    } catch (_error) {
      copied = false;
    } finally {
      textarea.remove();
      if (active && typeof active.focus === "function") {
        active.focus({ preventScroll: true });
      }
    }
    return copied;
  }

  async function copyText(text) {
    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
      return;
    }
    if (!fallbackCopy(text)) throw new Error("copy unavailable");
  }

  var copyResetTimers = new WeakMap();

  function setCopyState(button, state, label, announcement) {
    var oldTimer = copyResetTimers.get(button);
    if (oldTimer) clearTimeout(oldTimer);

    button.dataset.state = state;
    button.querySelector(".copy-label").textContent = label;
    var status = button.parentElement.querySelector(".copy-status");
    status.textContent = "";
    if (announcement) {
      setTimeout(function () {
        status.textContent = announcement;
      }, 0);
    }

    if (state === "success" || state === "error") {
      copyResetTimers.set(
        button,
        setTimeout(function () {
          button.dataset.state = "idle";
          button.querySelector(".copy-label").textContent = "Copy";
        }, 2200),
      );
    }
  }

  document.querySelectorAll(".copy").forEach(function (button) {
    button.addEventListener("click", async function () {
      if (button.disabled) return;
      var restoreFocus = document.activeElement === button;
      button.disabled = true;
      setCopyState(button, "copying", "Copying", "");
      try {
        await copyText(button.getAttribute("data-copy"));
        setCopyState(button, "success", "Copied", "Copied to clipboard.");
      } catch (_error) {
        setCopyState(
          button,
          "error",
          "Try again",
          "Couldn’t copy. Select the command and copy it manually.",
        );
      } finally {
        button.disabled = false;
        if (restoreFocus) button.focus({ preventScroll: true });
      }
    });
  });

  var scrollInstructions = "horizontal-scroll-instructions";
  var scrollRegions = document.querySelectorAll(
    ".code pre, .prose pre, .prose table",
  );

  function describeCode(region) {
    if (region.hasAttribute("aria-label")) return;
    var code = region.closest(".code");
    var title = code && code.querySelector(".bar > span:first-child");
    region.setAttribute(
      "aria-label",
      title
        ? "Scrollable code example: " + title.textContent.trim()
        : "Scrollable code example",
    );
    region.dataset.scrollLabel = "true";
  }

  function setScrollDescription(region, enabled) {
    var ids = (region.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .filter(Boolean)
      .filter(function (id) {
        return id !== scrollInstructions;
      });
    if (enabled) ids.push(scrollInstructions);
    if (ids.length) region.setAttribute("aria-describedby", ids.join(" "));
    else region.removeAttribute("aria-describedby");
  }

  function updateScrollRegion(region) {
    var scrollable = region.scrollWidth > region.clientWidth + 1;
    if (scrollable) {
      if (!region.hasAttribute("tabindex")) {
        region.tabIndex = 0;
        region.dataset.scrollTabindex = "true";
      }
      if (region.tagName === "PRE") describeCode(region);
      setScrollDescription(region, true);
      region.dataset.horizontalScroll = "true";
      return;
    }

    if (region.dataset.scrollTabindex === "true") {
      region.removeAttribute("tabindex");
      delete region.dataset.scrollTabindex;
    }
    if (region.dataset.scrollLabel === "true") {
      region.removeAttribute("aria-label");
      delete region.dataset.scrollLabel;
    }
    setScrollDescription(region, false);
    delete region.dataset.horizontalScroll;
  }

  function updateScrollRegions() {
    scrollRegions.forEach(updateScrollRegion);
  }

  scrollRegions.forEach(function (region) {
    region.addEventListener("keydown", function (event) {
      if (
        (event.key !== "ArrowLeft" && event.key !== "ArrowRight") ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }
      var oldPosition = region.scrollLeft;
      region.scrollLeft += event.key === "ArrowRight" ? 48 : -48;
      if (region.scrollLeft !== oldPosition) event.preventDefault();
    });
  });

  requestAnimationFrame(updateScrollRegions);
  window.addEventListener("resize", updateScrollRegions, { passive: true });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(updateScrollRegions);
  }

  var tocLinks = Array.from(
    document.querySelectorAll('.page-toc a[href^="#"]'),
  );
  if (tocLinks.length) {
    var headingIds = [];
    tocLinks.forEach(function (link) {
      var id = decodeURIComponent(new URL(link.href).hash.slice(1));
      if (id && !headingIds.includes(id)) headingIds.push(id);
    });
    var headings = headingIds
      .map(function (id) {
        return document.getElementById(id);
      })
      .filter(Boolean);
    var tocFrame = 0;

    function updateToc() {
      tocFrame = 0;
      var header = document.querySelector(".site-header");
      var threshold = (header ? header.getBoundingClientRect().bottom : 0) + 24;
      var current = headings[0];
      headings.forEach(function (heading) {
        if (heading.getBoundingClientRect().top <= threshold) current = heading;
      });
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2
      ) {
        current = headings[headings.length - 1];
      }
      tocLinks.forEach(function (link) {
        var id = decodeURIComponent(new URL(link.href).hash.slice(1));
        if (current && id === current.id) {
          link.setAttribute("aria-current", "location");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    function queueTocUpdate() {
      if (!tocFrame) tocFrame = requestAnimationFrame(updateToc);
    }

    updateToc();
    document.addEventListener("scroll", queueTocUpdate, { passive: true });
    window.addEventListener("resize", queueTocUpdate, { passive: true });
    window.addEventListener("hashchange", queueTocUpdate);
    tocLinks.forEach(function (link) {
      link.addEventListener("click", queueTocUpdate);
    });
  }
})();
