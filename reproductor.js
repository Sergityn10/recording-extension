export class Reproductor {
  constructor(
    targetElement,
    { options = { mimeType: "video/webm;codecs=vp9" }, startBeginning = false },
  ) {
    this.targetElement = targetElement;
    console.log("Inicializado");
    // this.video = videoElement;
    this.options = options;
    this.recorder = null;
    this.chunks = [];
    this.isRecording = false;
    this.startBeginning = startBeginning; //Booleano que nos comenta si al empezar a grabar, el video debe de empezar desde el inicio
  }

  static _pickMimeType(preferred) {
    const candidates = [];
    if (preferred) candidates.push(preferred);
    candidates.push("video/webm;codecs=vp9");
    candidates.push("video/webm;codecs=vp8");
    candidates.push("video/webm");
    for (const c of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(c)) return c;
      } catch (_) {}
    }
    return "video/webm";
  }

  static _buildFilenameFromElement(el, index, prefix = "captures") {
    const tag = (el?.tagName || "el").toLowerCase();
    const id = el?.id ? `#${el.id}` : "";
    const cls =
      el?.className && typeof el.className === "string"
        ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
        : "";
    const base =
      `${tag}${id}${cls}`.replace(/[^a-z0-9#._-]+/gi, "-").slice(0, 40) ||
      `element-${index + 1}`;
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    return `${prefix}/${base}-${ts}.webm`;
  }

  static async iniciarGrabacionMultiple(
    elements,
    {
      fps = 30,
      mimeType,
      videoBitsPerSecond = 10_000_000,
      preferCurrentTab = true,
      filenamePrefix = "captures",
    } = {},
  ) {
    if (!Array.isArray(elements) || elements.length === 0) {
      throw new Error("No hay elementos para grabar");
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      preferCurrentTab,
      video: {
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: fps, max: fps },
      },
      audio: false,
    });
    const [track] = stream.getVideoTracks();
    if (!track) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error("No se pudo obtener la pista de video");
    }

    try {
      await track.applyConstraints({
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: fps, max: fps },
      });
    } catch (_) {}

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();

    const dpr = window.devicePixelRatio || 1;
    const chosenMime = Reproductor._pickMimeType(mimeType);

    const sessions = elements.map((el, index) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { alpha: false });
      const outStream = canvas.captureStream(fps);
      const rec = new MediaRecorder(outStream, {
        mimeType: chosenMime,
        videoBitsPerSecond,
      });
      const chunks = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: chosenMime });
        const url = URL.createObjectURL(blob);
        chrome.runtime.sendMessage({
          action: "DOWNLOAD_VIDEO",
          url,
          filename: Reproductor._buildFilenameFromElement(
            el,
            index,
            filenamePrefix,
          ),
        });
      };
      return { el, canvas, ctx, rec };
    });

    let rafId = 0;
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    const render = () => {
      const vw = video.videoWidth || 0;
      const vh = video.videoHeight || 0;

      const root = document.documentElement;
      const viewW = window.innerWidth || root?.clientWidth || 0;
      const viewH = window.innerHeight || root?.clientHeight || 0;
      const scaleX = vw && viewW ? vw / viewW : dpr;
      const scaleY = vh && viewH ? vh / viewH : dpr;

      for (const s of sessions) {
        const r = s.el.getBoundingClientRect();
        if (!r || r.width <= 0 || r.height <= 0) continue;
        if (!s.ctx) continue;

        const w = Math.max(1, Math.round(r.width * scaleX));
        const h = Math.max(1, Math.round(r.height * scaleY));
        if (s.canvas.width !== w) s.canvas.width = w;
        if (s.canvas.height !== h) s.canvas.height = h;

        if (!vw || !vh) continue;

        let sx = Math.round(r.left * scaleX);
        let sy = Math.round(r.top * scaleY);
        let sw = Math.round(r.width * scaleX);
        let sh = Math.round(r.height * scaleY);

        if (sw <= 0 || sh <= 0) continue;

        const sx2 = sx + sw;
        const sy2 = sy + sh;
        const csx = clamp(sx, 0, vw);
        const csy = clamp(sy, 0, vh);
        const csx2 = clamp(sx2, 0, vw);
        const csy2 = clamp(sy2, 0, vh);
        const csw = csx2 - csx;
        const csh = csy2 - csy;
        if (csw <= 0 || csh <= 0) continue;

        const dx = Math.round(((csx - sx) / sw) * w);
        const dy = Math.round(((csy - sy) / sh) * h);
        const dw = Math.round((csw / sw) * w);
        const dh = Math.round((csh / sh) * h);
        if (dw <= 0 || dh <= 0) continue;

        try {
          s.ctx.clearRect(0, 0, w, h);
          s.ctx.drawImage(video, csx, csy, csw, csh, dx, dy, dw, dh);
        } catch (_) {}
      }
      rafId = requestAnimationFrame(render);
    };

    for (const s of sessions) s.rec.start();
    rafId = requestAnimationFrame(render);

    const stop = () => {
      try {
        cancelAnimationFrame(rafId);
      } catch (_) {}

      for (const s of sessions) {
        try {
          if (s.rec && s.rec.state !== "inactive") s.rec.stop();
        } catch (_) {}
      }

      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch (_) {}
      try {
        video.pause();
        video.srcObject = null;
      } catch (_) {}
    };

    return { stop, stream, sessions };
  }

  async iniciarGrabacion() {
    // if (this.isRecording) return;

    const stream = await navigator.mediaDevices.getDisplayMedia({
      preferCurrentTab: true,
      video: {
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: 30, max: 30 },
      },
      audio: false,
    });
    const [track] = stream.getVideoTracks();

    if (track) {
      try {
        await track.applyConstraints({
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
        });
      } catch (_) {}
    }

    if ("RestrictionTarget" in self && "fromElement" in RestrictionTarget) {
      // Associate captureTarget with a new RestrictionTarget
      const captureTarget = this.targetElement;
      const restrictionTarget = await CropTarget.fromElement(captureTarget);
      await track.cropTo(restrictionTarget);
    }
    // this.video.srcObject = stream;
    // this.videoElement.play();

    const chosenMime = Reproductor._pickMimeType(this.options?.mimeType);
    const options = {
      ...this.options,
      mimeType: chosenMime,
      videoBitsPerSecond: this.options?.videoBitsPerSecond ?? 10_000_000,
    };
    this.recorder = new MediaRecorder(stream, options);
    this.chunks = [];

    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };

    this.recorder.onstop = () => {
      const blob = new Blob(this.chunks, {
        type: chosenMime || "video/webm",
      });
      const url = URL.createObjectURL(blob);
      chrome.runtime.sendMessage({
        action: "DOWNLOAD_VIDEO",
        url: url, // La URL en formato Data de la grabación
      });
      this.chunks = [];
      // this.descargar();
    };
    if (this.startBeginning) {
      // this.video.currentTime = 0;
      // this.video.pause();
    }
    console.log("Empieza a grabar");
    this.recorder.start();
    // this.video.play();
    this.isRecording = true;
  }

  detenerGrabacion() {
    if (this.recorder && this.isRecording) {
      this.isRecording = false;

      this.recorder.stop();
    }
  }

  descargar(nombre = "video_descargar.webm") {
    if (!this.chunks.length) return;
    const blob = new Blob(this.chunks, {
      type: this.options.mimeType || "video/webm",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
    this.chunks = [];
  }
}
