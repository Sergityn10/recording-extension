(async () => {
  const src = chrome.runtime.getURL("./../reproductor.js");
  const { Reproductor } = await import(src);
  const markup = document.querySelector("#markup");
  const script = document.querySelector("#script");
  const style = document.querySelector("#style");
  const preview = document.querySelector("#editor-preview");
  const listTargetElements = {
    html: markup,
    js: script,
    css: style,
    preview: preview,
  };
  let grabacionMultiple = null;

  const STORAGE_KEY = "codilink-record-targets";
  function getSelectedTargets() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = JSON.parse(raw || "[]");
      const allowed = new Set(["html", "css", "js", "preview"]);
      const out = Array.isArray(arr) ? arr.filter((v) => allowed.has(v)) : [];
      if (out.length) return out;
    } catch (_) {}
    return ["html"];
  }
  function setSelectedTargets(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }
  function toggleTarget(target, checked) {
    const current = new Set(getSelectedTargets());
    if (checked) current.add(target);
    else current.delete(target);
    const out = Array.from(current);
    if (!out.length) out.push("html");
    setSelectedTargets(out);
  }
  function ensureSelectorUI() {
    if (document.getElementById("codilink-record-selector")) return;

    const container = document.createElement("div");
    container.id = "codilink-record-selector";
    container.style.position = "fixed";
    const POS_KEY = "codilink-record-selector-pos";
    const saved = (() => {
      try {
        return JSON.parse(localStorage.getItem(POS_KEY) || "null");
      } catch (_) {
        return null;
      }
    })();
    container.style.top =
      saved && typeof saved.top === "number" ? `${saved.top}px` : "12px";
    container.style.left =
      saved && typeof saved.left === "number" ? `${saved.left}px` : "auto";
    if (!saved || typeof saved.left !== "number") {
      container.style.right = "12px";
    }
    container.style.zIndex = "2147483647";
    container.style.background = "#111";
    container.style.color = "#fff";
    container.style.padding = "10px";
    container.style.borderRadius = "8px";
    container.style.fontFamily =
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
    container.style.fontSize = "13px";
    container.style.boxShadow = "0 8px 24px rgba(0,0,0,.3)";

    const title = document.createElement("div");
    title.textContent = "Grabar:";
    title.style.marginBottom = "6px";
    title.style.opacity = "0.9";

    const dragHandle = document.createElement("div");
    dragHandle.textContent = "Arrastrar";
    dragHandle.style.fontSize = "11px";
    dragHandle.style.opacity = "0.7";
    dragHandle.style.cursor = "move";
    dragHandle.style.userSelect = "none";
    dragHandle.style.marginBottom = "8px";
    dragHandle.style.paddingBottom = "6px";
    dragHandle.style.borderBottom = "1px solid rgba(255,255,255,.12)";

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "10px";
    row.style.alignItems = "center";

    const current = new Set(getSelectedTargets());
    const options = [
      { value: "html", label: "HTML" },
      { value: "css", label: "CSS" },
      { value: "js", label: "JS" },
      { value: "preview", label: "Preview" },
    ];

    for (const opt of options) {
      const label = document.createElement("label");
      label.style.display = "inline-flex";
      label.style.alignItems = "center";
      label.style.gap = "6px";
      label.style.cursor = "pointer";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "codilink-record-targets";
      input.value = opt.value;
      input.checked = current.has(opt.value);
      input.onchange = () => {
        toggleTarget(opt.value, input.checked);
      };

      const span = document.createElement("span");
      span.textContent = opt.label;

      label.appendChild(input);
      label.appendChild(span);
      row.appendChild(label);
    }

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;
    const onPointerMove = (ev) => {
      if (!dragging) return;
      const left = Math.max(
        0,
        Math.min(
          window.innerWidth - container.offsetWidth,
          ev.clientX - offsetX,
        ),
      );
      const top = Math.max(
        0,
        Math.min(
          window.innerHeight - container.offsetHeight,
          ev.clientY - offsetY,
        ),
      );
      container.style.left = `${left}px`;
      container.style.top = `${top}px`;
      container.style.right = "auto";
    };
    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      try {
        const left = parseFloat(container.style.left);
        const top = parseFloat(container.style.top);
        if (Number.isFinite(left) && Number.isFinite(top)) {
          localStorage.setItem(POS_KEY, JSON.stringify({ left, top }));
        }
      } catch (_) {}
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
    };
    dragHandle.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      const r = container.getBoundingClientRect();
      dragging = true;
      offsetX = ev.clientX - r.left;
      offsetY = ev.clientY - r.top;
      window.addEventListener("pointermove", onPointerMove, true);
      window.addEventListener("pointerup", onPointerUp, true);
    });

    container.appendChild(title);
    container.appendChild(dragHandle);
    container.appendChild(row);
    document.documentElement.appendChild(container);
  }

  ensureSelectorUI();
  chrome.runtime.onMessage.addListener(async (msg) => {
    const videoElement = document.createElement("video");
    if (msg && msg.action === "record") {
      ensureSelectorUI();

      if (grabacionMultiple) {
        grabacionMultiple.stop();
        grabacionMultiple = null;
        return { ok: true };
      }

      const selectedTargets = getSelectedTargets();
      const elements = selectedTargets
        .map((t) => listTargetElements[t])
        .filter(Boolean);
      if (!elements.length) return { ok: false, error: "TARGET_NOT_FOUND" };

      try {
        grabacionMultiple = await Reproductor.iniciarGrabacionMultiple(
          elements,
          {
            preferCurrentTab: true,
            filenamePrefix: "captures/codilink",
          },
        );
      } catch (e) {
        grabacionMultiple = null;
        return { ok: false, error: e?.message || "START_FAILED" };
      }
      return { ok: true };
    }
    return;
  });
})();
