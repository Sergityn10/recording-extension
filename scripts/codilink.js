(async () => {
  const src = chrome.runtime.getURL("./../reproductor.js");
  const { Reproductor } = await import(src);
  const markup = document.querySelector("#markup");
  const script = document.querySelector("#script");
  const style = document.querySelector("#style");
  let reproductor = null;
  chrome.runtime.onMessage.addListener((msg) => {
    const videoElement = document.createElement("video");
    if (msg && msg.action === "record") {
      if (!reproductor)
        reproductor = new Reproductor(
          [markup, script, style],
          videoElement,
          {},
        );
      if (reproductor.isRecording) reproductor.detenerGrabacion();
      else reproductor.iniciarGrabacion();
      return { ok: true };
    } else if (msg.action === "stop") {
      reproductor.detenerGrabacion();
    }
    return;
  });
})();
