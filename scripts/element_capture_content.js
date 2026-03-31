(function () {
  let panel;
  let toggleBtn;
  let selectBtn;
  let startBtn;
  let stopBtn;
  let countLabel;
  let overlay;
  let hoverBox;
  let selecting = false;
  const selected = new Set();
  let stream = null;
  let mainTrack = null;
  const recorders = [];
  const targets = [];
  const records = [];
  function ensureSupport() {
    const hasCrop = typeof window.CropTarget !== "undefined";
    return hasCrop;
  }
  function createPanel() {
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = "erc-panel";
    panel.style.position = "fixed";
    panel.style.top = "12px";
    panel.style.right = "12px";
    panel.style.zIndex = "999999999";
    panel.style.background = "#111";
    panel.style.color = "#fff";
    panel.style.padding = "10px";
    panel.style.borderRadius = "8px";
    panel.style.fontFamily =
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
    panel.style.fontSize = "13px";
    panel.style.boxShadow = "0 8px 24px rgba(0,0,0,.3)";
    panel.style.display = "none";

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "6px";
    row.style.alignItems = "center";

    toggleBtn = document.createElement("button");
    toggleBtn.textContent = "Cerrar";
    styleBtn(toggleBtn);
    toggleBtn.onclick = () => {
      panel.style.display = "none";
    };

    selectBtn = document.createElement("button");
    selectBtn.textContent = "Seleccionar";
    styleBtn(selectBtn);
    selectBtn.onclick = toggleSelecting;

    startBtn = document.createElement("button");
    startBtn.textContent = "Grabar";
    styleBtn(startBtn);
    startBtn.onclick = startRecording;

    stopBtn = document.createElement("button");
    stopBtn.textContent = "Detener";
    styleBtn(stopBtn);
    stopBtn.onclick = stopRecording;

    countLabel = document.createElement("span");
    countLabel.textContent = "0 seleccionados";
    countLabel.style.marginLeft = "6px";

    row.appendChild(toggleBtn);
    row.appendChild(selectBtn);
    row.appendChild(startBtn);
    row.appendChild(stopBtn);
    row.appendChild(countLabel);

    const hint = document.createElement("div");
    hint.textContent = "Haz clic en elementos para añadir/quitar";
    hint.style.opacity = "0.8";
    hint.style.marginTop = "6px";

    panel.appendChild(row);
    panel.appendChild(hint);
    document.documentElement.appendChild(panel);

    overlay = document.createElement("div");
    overlay.id = "erc-overlay";
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.right = "0";
    overlay.style.bottom = "0";
    overlay.style.zIndex = "999999998";
    overlay.style.pointerEvents = "none";
    overlay.style.display = "none";
    document.documentElement.appendChild(overlay);

    hoverBox = document.createElement("div");
    hoverBox.id = "erc-hover";
    hoverBox.style.position = "fixed";
    hoverBox.style.border = "2px solid #26a269";
    hoverBox.style.borderRadius = "4px";
    hoverBox.style.pointerEvents = "none";
    hoverBox.style.boxShadow =
      "0 0 0 2px rgba(38,162,105,.3) inset, 0 0 0 4px rgba(38,162,105,.15)";
    hoverBox.style.display = "none";
    overlay.appendChild(hoverBox);

    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("click", onClick, true);
  }
  function styleBtn(b) {
    b.style.background = "#1f6feb";
    b.style.color = "#fff";
    b.style.border = "0";
    b.style.borderRadius = "6px";
    b.style.padding = "6px 10px";
    b.style.cursor = "pointer";
  }
  function togglePanel() {
    createPanel();
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  }
  function updateCount() {
    countLabel.textContent = `${selected.size} seleccionados`;
  }
  function isInPanel(el) {
    return panel && (el === panel || panel.contains(el));
  }
  function onMouseMove(e) {
    if (!selecting) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isInPanel(el)) {
      hoverBox.style.display = "none";
      return;
    }
    const r = el.getBoundingClientRect();
    hoverBox.style.display = "block";
    hoverBox.style.left = r.left + "px";
    hoverBox.style.top = r.top + "px";
    hoverBox.style.width = r.width + "px";
    hoverBox.style.height = r.height + "px";
  }
  function onClick(e) {
    if (!selecting) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isInPanel(el)) return;
    e.preventDefault();
    e.stopPropagation();
    if (selected.has(el)) {
      selected.delete(el);
      el.style.outline = "";
    } else {
      selected.add(el);
      el.style.outline = "2px solid #d29922";
      el.style.outlineOffset = "2px";
    }
    updateCount();
  }
  function toggleSelecting() {
    selecting = !selecting;
    overlay.style.display = selecting ? "block" : "none";
    hoverBox.style.display = "none";
  }
  async function startRecording() {
    if (!ensureSupport()) {
      alert("Tu navegador no soporta Region Capture");
      return;
    }
    if (recorders.length) return;
    if (!selected.size) {
      alert("Selecciona al menos un elemento");
      return;
    }
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
    } catch (e) {
      return;
    }
    const vt = stream.getVideoTracks()[0];
    if (!vt) return;
    mainTrack = vt;
    targets.length = 0;
    selected.forEach((el) => targets.push(el));
    records.length = 0;
    const promises = [];
    for (let i = 0; i < targets.length; i++) {
      const el = targets[i];
      promises.push(CropTarget.fromElement(el));
    }
    let cropTargets;
    try {
      cropTargets = await Promise.all(promises);
    } catch (e) {
      stopStream();
      return;
    }
    for (let i = 0; i < targets.length; i++) {
      const track = mainTrack.clone();
      try {
        await track.cropTo(cropTargets[i]);
      } catch (e) {
        track.stop();
        continue;
      }
      const out = new MediaStream([track]);
      let mime = "video/webm;codecs=vp9";
      if (!MediaRecorder.isTypeSupported(mime)) mime = "video/webm;codecs=vp8";
      if (!MediaRecorder.isTypeSupported(mime)) mime = "video/webm";
      const rec = new MediaRecorder(out, {
        mimeType: mime,
        videoBitsPerSecond: 4_000_000,
      });
      const chunks = [];
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: mime });
        const filename = buildFilename(targets[i], i);
        const reader = new FileReader();
        reader.onloadend = () => {
          const url = reader.result;
          chrome.runtime.sendMessage({
            action: "DOWNLOAD_VIDEO",
            url,
            filename,
          });
        };
        reader.readAsDataURL(blob);
      };
      rec.start();
      recorders.push({ rec, track });
    }
  }
  function buildFilename(el, index) {
    const tag = (el.tagName || "el").toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls =
      el.className && typeof el.className === "string"
        ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
        : "";
    const base =
      `${tag}${id}${cls}`.replace(/[^a-z0-9#._-]+/gi, "-").slice(0, 40) ||
      `element-${index + 1}`;
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    return `captures/${base}-${ts}.webm`;
  }
  function stopStream() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
      mainTrack = null;
    }
  }
  function stopRecording() {
    if (!recorders.length) {
      stopStream();
      return;
    }
    recorders.forEach((r) => {
      try {
        r.rec.stop();
      } catch (_) {}
      try {
        r.track.stop();
      } catch (_) {}
    });
    recorders.length = 0;
    stopStream();
  }
  function init() {
    createPanel();
  }
  function togglePanelVisibility() {
    createPanel();
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  }
  init();
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.action === "TOGGLE_ELEMENT_CAPTURE_PANEL")
      togglePanelVisibility();
  });
})();
