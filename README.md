# Kagi Reverse Image Search

A browser extension that lets you select any area on a webpage and search it using Kagi Reverse Image Search.

<a href="https://youtu.be/5lFQnl0vSeM" target="_blank">
  <img src="https://img.shields.io/badge/Watch-Demo-red?style=flat&logo=youtube" alt="Watch Demo"/>
</a>

## Features

- **Area Selection**: Click and drag to select any region on a webpage. The page dims around your selection and a live badge shows its size.
- **Instant Search**: Automatically uploads to Kagi's reverse image search
- **Right-click Search**: "Search this image with Kagi" on any image, or "Select an area to search with Kagi" anywhere on a page
- **Keyboard Shortcut**: Quick activation with Ctrl+Shift+K (Cmd+Shift+K on Mac)
- **Privacy Pass Compatible**: Works seamlessly with Kagi's Privacy Pass
- **Light/Dark Mode**: Automatically matches your Kagi theme preference
- **HiDPI aware**: Captures at your display's native resolution, including page zoom

## Installation

This extension is not on the Chrome Web Store. Install in developer mode:

1. Download or clone this repository
2. Open your browser and go to the extensions page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** and select this extension's folder
5. The extension icon will appear in your toolbar

## Usage

1. Click the extension icon or press **Ctrl+Shift+K** (Cmd+Shift+K on Mac)
2. The page dims and a hint appears at the top: selection mode is active
3. Click and drag to select an area (crosshair guides follow your cursor)
4. Release to capture and search
5. Press **Escape** (or the shortcut again) to cancel selection

To search an existing image without selecting, right-click it and choose **Search this image with Kagi**.

## Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|---------------|-----|
| Activate / cancel selection mode | Ctrl+Shift+K | Cmd+Shift+K |
| Cancel selection | Escape | Escape |

Customize shortcuts at `chrome://extensions/shortcuts`

## Requirements

- Chromium-based browser (Chrome, Edge, Brave, Vivaldi, Opera)
- Kagi account for search results

## Incognito

To use the extension in Incognito windows, open `chrome://extensions`, click **Details** on the extension and turn on **Allow in Incognito**. A search started from an Incognito window then runs in that window with your Incognito Kagi session, not your regular one.

## Limitations

The extension cannot run on:
- Browser internal pages (`chrome://`, `edge://`, etc.)
- Other extensions' pages
- The Chrome Web Store
- PDF viewer and certain special pages

If you see "Cannot run on this page", try refreshing the page first.

## Privacy

This extension:
- Only activates when you click the icon, use the shortcut, or pick it from the context menu
- Only captures the area you select (or the image you right-clicked)
- Sends images directly to Kagi (no third parties)
- Stores nothing permanently (theme preference only; the image is cleared as soon as it is handed to Kagi)

## License

ISC
