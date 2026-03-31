chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.action === "DOWNLOAD_VIDEO" && message.url) {
    const filename = message.filename || `element-capture-${Date.now()}.webm`;
    chrome.downloads.download(
      { url: message.url, filename, saveAs: false },
      (downloadId) => {
        const ok = !chrome.runtime.lastError && !!downloadId;
        sendResponse({
          ok,
          downloadId,
          error: chrome.runtime.lastError?.message || null,
        });
      },
    );
    return true;
  }
  if (
    message &&
    message.action === "DOWNLOAD_FILES" &&
    Array.isArray(message.files)
  ) {
    const results = [];
    let pending = message.files.length;
    if (!pending) {
      sendResponse({ ok: true, results });
      return false;
    }
    message.files.forEach((f) => {
      const name = f.filename || `element-capture-${Date.now()}.webm`;
      chrome.downloads.download(
        { url: f.url, filename: name, saveAs: false },
        (downloadId) => {
          const ok = !chrome.runtime.lastError && !!downloadId;
          results.push({
            ok,
            downloadId,
            error: chrome.runtime.lastError?.message || null,
            filename: name,
          });
          pending -= 1;
          if (pending === 0)
            sendResponse({ ok: results.every((r) => r.ok), results });
        },
      );
    });
    return true;
  }
});
