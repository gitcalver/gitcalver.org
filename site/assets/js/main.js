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
})();
