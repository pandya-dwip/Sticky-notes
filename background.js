// StickyNote - Background Service Worker
// Manages switching between popup and side panel modes

// On install, default to popup mode
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["sidePanelEnabled"], (res) => {
    if (res.sidePanelEnabled === undefined) {
      chrome.storage.local.set({ sidePanelEnabled: false });
    }
    applySidePanelBehavior(res.sidePanelEnabled || false);
  });
});

// On startup, apply the saved preference
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(["sidePanelEnabled"], (res) => {
    applySidePanelBehavior(res.sidePanelEnabled || false);
  });
});

// Listen for preference changes from the popup/side panel UI
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.sidePanelEnabled) {
    applySidePanelBehavior(changes.sidePanelEnabled.newValue);
  }
});

function applySidePanelBehavior(enabled) {
  if (enabled) {
    // Side panel mode: disable popup so clicking the icon opens the side panel
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .then(() => {
        // Remove the popup so clicking the action icon triggers the side panel
        chrome.action.setPopup({ popup: "" });
      })
      .catch((err) => console.error("Failed to enable side panel:", err));
  } else {
    // Popup mode: restore popup behavior
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: false })
      .then(() => {
        chrome.action.setPopup({ popup: "popup.html" });
      })
      .catch((err) => console.error("Failed to disable side panel:", err));
  }
}
