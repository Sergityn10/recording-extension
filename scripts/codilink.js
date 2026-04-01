(async () => {
  const src = chrome.runtime.getURL("./../reproductor.js");
  const { Reproductor } = await import(src);
  const markup = document.querySelector("#markup");
  const script = document.querySelector("#script");
  const style = document.querySelector("#style");
  let listTargetElements = [markup, script, style];
  let reproductores = [];
  chrome.runtime.onMessage.addListener(async (msg) => {
    const videoElement = document.createElement("video");
    if (msg && msg.action === "record") {
      if (reproductores.length === 0) {
        for (let i = 0; i < 1; i++) {
          reproductores[i] = await new Promise((resolve) => {
            resolve(new Reproductor(listTargetElements[i], {}));
          });
          if (reproductores[i].isRecording) reproductores[i].detenerGrabacion();
          else reproductores[i].iniciarGrabacion();
        }
      }
      return { ok: true };
    }
    return;
  });
})();
