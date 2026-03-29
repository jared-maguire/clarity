// Tabs with reader mode enabled — persisted to survive service worker restarts
let readerTabs = new Set();
let fontPref = 'sans';

const FONTS = {
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  serif: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif",
  mono: "'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', Menlo, Consolas, monospace"
};

// Restore state from storage on service worker startup
chrome.storage.session.get(['clarity_reader_tabs', 'clarity_font'], (r) => {
  if (r.clarity_reader_tabs) readerTabs = new Set(r.clarity_reader_tabs);
  if (r.clarity_font) fontPref = r.clarity_font;
});

function saveTabState() {
  chrome.storage.session.set({ clarity_reader_tabs: [...readerTabs] });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'toggle') {
    const tabId = msg.tabId;
    if (readerTabs.has(tabId)) {
      readerTabs.delete(tabId);
      saveTabState();
      chrome.tabs.reload(tabId);
      sendResponse({ active: false, font: fontPref });
    } else {
      readerTabs.add(tabId);
      saveTabState();
      injectReader(tabId);
      sendResponse({ active: true, font: fontPref });
    }
  } else if (msg.type === 'query') {
    sendResponse({ active: readerTabs.has(msg.tabId), font: fontPref });
  } else if (msg.type === 'setFont') {
    fontPref = msg.font;
    chrome.storage.session.set({ clarity_font: fontPref });
    chrome.storage.local.set({ clarity_font: fontPref });
    if (readerTabs.has(msg.tabId)) {
      applyFont(msg.tabId, fontPref);
    }
    sendResponse({ ok: true });
  }
  return true;
});

// On navigation in a reader tab:
// 1. At 'loading': hide the page so user sees black instead of raw content flash
// 2. At 'complete': inject reader mode, then reveal
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!readerTabs.has(tabId)) return;

  if (changeInfo.status === 'loading') {
    chrome.scripting.insertCSS({
      target: { tabId },
      css: 'html { visibility: hidden !important; background: #0e0e0e !important; }'
    }).catch(() => {});
  }

  if (changeInfo.status === 'complete') {
    injectReader(tabId);
  }
});

// Clean up when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  readerTabs.delete(tabId);
  saveTabState();
});

function injectReader(tabId) {
  chrome.scripting.insertCSS({
    target: { tabId },
    files: ['styles/reader-mode.css']
  }).catch(() => {});

  chrome.scripting.executeScript({
    target: { tabId },
    files: ['src/content/reader-mode.js']
  }).then(() => {
    applyFont(tabId, fontPref);
    chrome.scripting.insertCSS({
      target: { tabId },
      css: 'html { visibility: visible !important; }'
    }).catch(() => {});
  }).catch(() => {});
}

function applyFont(tabId, font) {
  const family = FONTS[font] || FONTS.sans;
  chrome.scripting.executeScript({
    target: { tabId },
    func: (f) => {
      const root = document.getElementById('clarity-reader-root');
      if (!root) return;
      root.style.setProperty('font-family', f, 'important');
      for (const el of root.querySelectorAll('.clarity-reader-content, .clarity-reader-content p, .clarity-reader-content li, .clarity-reader-content blockquote, .clarity-reader-content td, .clarity-reader-content th')) {
        el.style.setProperty('font-family', f, 'important');
      }
    },
    args: [family]
  }).catch(() => {});
}
