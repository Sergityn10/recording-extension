export class Reproductor {
  constructor(
    videoElement,
    {
      options = { mimeType: "video/webm; codecs=vp9" },
      startBeginning = false,
    },
  ) {
    console.log(videoElement);
    this.video = videoElement;
    this.options = options;
    this.recorder = null;
    this.chunks = [];
    this.isRecording = false;
    this.startBeginning = startBeginning; //Booleano que nos comenta si al empezar a grabar, el video debe de empezar desde el inicio
  }

  iniciarGrabacion() {
    if (this.isRecording) return;

    const stream = this.video.captureStream(60);
    this.recorder = new MediaRecorder(stream, this.options);
    this.chunks = [];

    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };

    this.recorder.onstop = () => {
      const blob = new Blob(this.chunks, {
        type: this.options.mimeType || "video/webm",
      });
      const url = URL.createObjectURL(blob);
      chrome.runtime.sendMessage({
        action: "DOWNLOAD_VIDEO",
        url: url, // La URL en formato Data de la grabación
      });
      this.chunks = [];
      // this.descargar();
      this.isRecording = false;
    };
    if (this.startBeginning) {
      this.video.currentTime = 0;
      this.video.pause();
    }
    this.recorder.start();
    this.video.play();
    this.isRecording = true;
  }

  detenerGrabacion() {
    if (this.recorder && this.isRecording) {
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
