# Kagi Reverse Image Search

A browser extension that lets you select any area on a webpage and search it using Kagi Reverse Image Search.

<a href="https://youtu.be/5lFQnl0vSeM" target="_blank">
  <img src="https://img.shields.io/badge/Watch-Demo-red?style=flat&logo=youtube" alt="Watch Demo"/>
</a>

## Features

- **Area Selection**: Click and drag to select any region on a webpage
- **Instant Search**: Automatically uploads to Kagi's reverse image search
- **Keyboard Shortcut**: Quick activation with Ctrl+Shift+K (Cmd+Shift+K on Mac)
- **Privacy Pass Compatible**: Works seamlessly with Kagi's Privacy Pass
- **Light/Dark Mode**: Automatically matches your Kagi theme preference

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
2. A yellow flash indicates selection mode is active
3. Click and drag to select an area
4. Release to capture and search
5. Press **Escape** to cancel selection

## Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|---------------|-----|
| Activate selection mode | Ctrl+Shift+K | Cmd+Shift+K |
| Cancel selection | Escape | Escape |

Customize shortcuts at `chrome://extensions/shortcuts`

## Requirements

- Chromium-based browser (Chrome, Edge, Brave, Vivaldi, Opera)
- Kagi account for search results

## Limitations

The extension cannot run on:
- Browser internal pages (`chrome://`, `edge://`, etc.)
- Other extensions' pages
- The Chrome Web Store
- PDF viewer and certain special pages

If you see "Unable to activate", try refreshing the page first.

## Privacy

This extension:
- Only activates when you click the icon or use the shortcut
- Only captures the area you select
- Sends images directly to Kagi (no third parties)
- Stores nothing permanently (theme preference only)

## License

ISC
