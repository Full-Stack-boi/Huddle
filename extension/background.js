// background.js
// Listens for clicks on the extension icon and sends a message to the active tab to toggle the sidebar
// Also manages tab-specific room sessions inside chrome.storage.session

chrome.action.onClicked.addListener((tab) => {
  // Ensure we only send messages to valid tabs
  if (tab.id) {
    chrome.tabs
      .sendMessage(tab.id, { type: "HUDDLE_TOGGLE_SIDEBAR" })
      .catch((err) => {
        console.log("Huddle content script not loaded on this page.", err);
      });
  }
});

// Manage tab-specific session storage to prevent hosts/joiners conflicts across tabs
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab && sender.tab.id;
  if (!tabId) return;

  const key = `huddle_tab_session_${tabId}`;

  if (message.type === "HUDDLE_SET_SESSION") {
    if (chrome.storage && chrome.storage.session) {
      chrome.storage.session.set({
        [key]: {
          roomCode: message.roomCode,
          isHost: message.isHost
        }
      }, () => {
        sendResponse({ success: true });
      });
    } else {
      // Fallback if session storage isn't available
      sendResponse({ success: false, error: "chrome.storage.session unavailable" });
    }
    return true; // Keep response channel open
  }

  if (message.type === "HUDDLE_GET_SESSION") {
    if (chrome.storage && chrome.storage.session) {
      chrome.storage.session.get(key, (result) => {
        const session = result[key] || { roomCode: null, isHost: false };
        sendResponse(session);
      });
    } else {
      sendResponse({ roomCode: null, isHost: false });
    }
    return true; // Keep response channel open
  }

  if (message.type === "HUDDLE_CLEAR_SESSION") {
    if (chrome.storage && chrome.storage.session) {
      chrome.storage.session.remove(key, () => {
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: false });
    }
    return true; // Keep response channel open
  }
});
