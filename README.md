# Clarity

A Chrome extension that provides a superclean dark reader mode. Toggle it on for a tab and it stays on — every page you navigate to in that tab is automatically converted to a clean, readable layout.

## Features

- **Persistent per-tab reader mode** — enable once, and every page you visit in that tab gets reader mode applied automatically until you disable it
- **Smart content extraction** — scores page elements by text density, paragraph count, semantic tags, and class/ID signals to find the main article content
- **Dark theme** — always white-on-dark (#0e0e0e background) for comfortable reading
- **Contrast fixer** — preserves original content styling but detects and overrides bad color combinations (dark-on-dark, light-on-light) to ensure readability
- **Font picker** — switch between Sans, Serif, and Mono fonts from the popup; preference persists across sessions
- **Clean layout** — large title, reading time estimate, comfortable spacing, styled code blocks, blockquotes, tables, and images

## Install

1. Clone this repo
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `clarity` directory
5. Pin the Clarity icon from the extensions menu (puzzle piece icon)

## Usage

1. Click the **Clarity** icon in the toolbar
2. Click **Enable** — the current page converts to reader mode
3. Click any link — the next page also gets reader mode
4. To stop, click the Clarity icon and click **Disable** (or close the tab)
5. Use the **Sans / Serif / Mono** buttons to change the reading font

## How it works

- **Background service worker** tracks which tabs have reader mode enabled
- On every navigation (`chrome.tabs.onUpdated`), the reader script is re-injected into active tabs
- **Content extraction** clones the best-scoring content element, strips scripts/ads/nav/forms, and renders it in a clean layout
- **Contrast fixer** runs three passes after rendering:
  1. Removes light backgrounds so the dark page background shows through
  2. Checks every text element against its effective background (WCAG AA 4.5:1 threshold)
  3. Safety net: forces any text darker than ~#555 to light

## File structure

```
clarity/
├── manifest.json                    # Extension manifest (Manifest V3)
├── icons/                           # Extension icons
├── src/
│   ├── background/
│   │   └── service-worker.js        # Tab tracking, font pref, script injection
│   ├── content/
│   │   └── reader-mode.js           # Content extraction, cleaning, contrast fixer
│   └── popup/
│       ├── popup.html               # Toggle + font picker UI
│       ├── popup.js                 # Popup logic
│       └── popup.css                # Popup styling
└── styles/
    └── reader-mode.css              # Reader layout and typography
```
