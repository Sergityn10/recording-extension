document.getElementById("toggle").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  const video = document.createElement("video");
  const message = {
    action: "record",
  };
  const recording = false;
  try {
    await chrome.tabs.sendMessage(tab.id, message);

    return;
  } catch (_) {
    console.log("error");
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["scripts/codilink.js"],
    });
    await chrome.tabs.sendMessage(tab.id, message);
  }
});
