// Tabs with reader mode enabled — persists for tab lifetime
const readerTabs = new Set();
let fontPref = 'sans'; // global default

const FONTS = {
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  serif: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif",
  mono: "'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', Menlo, Consolas, monospace"
};

// Load saved font pref
chrome.storage.local.get('clarity_font', (r) => {
  if (r.clarity_font) fontPref = r.clarity_font;
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'toggle') {
    const tabId = msg.tabId;
    if (readerTabs.has(tabId)) {
      readerTabs.delete(tabId);
      chrome.tabs.reload(tabId);
      sendResponse({ active: false, font: fontPref });
    } else {
      readerTabs.add(tabId);
      injectReader(tabId);
      sendResponse({ active: true, font: fontPref });
    }
  } else if (msg.type === 'query') {
    sendResponse({ active: readerTabs.has(msg.tabId), font: fontPref });
  } else if (msg.type === 'setFont') {
    fontPref = msg.font;
    chrome.storage.local.set({ clarity_font: fontPref });
    // Apply to the tab immediately if reader is active
    if (readerTabs.has(msg.tabId)) {
      applyFont(msg.tabId, fontPref);
    }
    sendResponse({ ok: true });
  }
  return true;
});

// Re-inject reader mode on every navigation within a reader tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (readerTabs.has(tabId) && changeInfo.status === 'complete') {
    injectReader(tabId);
  }
});

// Clean up when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  readerTabs.delete(tabId);
});

function injectReader(tabId) {
  chrome.scripting.executeScript({
    target: { tabId },
    files: ['src/content/reader-mode.js']
  }).then(() => {
    applyFont(tabId, fontPref);
  }).catch(() => {});

  chrome.scripting.insertCSS({
    target: { tabId },
    files: ['styles/reader-mode.css']
  }).catch(() => {});
}

function applyFont(tabId, font) {
  const family = FONTS[font] || FONTS.sans;
  chrome.scripting.executeScript({
    target: { tabId },
    func: (f) => {
      const root = document.getElementById('clarity-reader-root');
      if (!root) return;
      // Set on root and propagate to all children
      root.style.setProperty('font-family', f, 'important');
      for (const el of root.querySelectorAll('.clarity-reader-content, .clarity-reader-content p, .clarity-reader-content li, .clarity-reader-content blockquote, .clarity-reader-content td, .clarity-reader-content th')) {
        el.style.setProperty('font-family', f, 'important');
      }
    },
    args: [family]
  }).catch(() => {});
}
