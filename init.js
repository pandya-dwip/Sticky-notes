// StickyNote - Early Initialization script
// Runs in the <head> to detect side panel mode immediately and prevent layout flash

(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const sidePanelMode =
    urlParams.get("mode") === "sidepanel" ||
    window.innerWidth > 600 ||
    window.innerHeight > 500;

  if (sidePanelMode) {
    document.documentElement.classList.add("side-panel-mode");
  }
})();
