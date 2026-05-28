// background.js
// Listens for clicks on the extension icon and sends a message to the active tab to toggle the sidebar

chrome.action.onClicked.addListener((tab) => {
  // Ensure we only send messages to valid tabs
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: "HUDDLE_TOGGLE_SIDEBAR" }).catch((err) => {
      console.log("Huddle content script not loaded on this page.", err);
    });
  }
});
