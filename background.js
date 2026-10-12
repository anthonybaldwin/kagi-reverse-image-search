'use strict';

// Constants
const KAGI_REVERSE_URL = 'https://kagi.com/reverse';
const UPLOAD_PAGE = 'upload.html';
const CAPTURE_DELAY_MS = 60; // let the page repaint after the selection UI is hidden
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MENU_SELECT_AREA = 'kagi-ris-select-area';
const MENU_SEARCH_IMAGE = 'kagi-ris-search-image';

// Restricted URL patterns where extension cannot run
const RESTRICTED_URL_PATTERNS = [
  'chrome://',
  'chrome-extension://',
  'chrome-search://',
  'chrome-devtools://',
  'devtools://',
  'view-source:',
  'about:',
  'data:',
  'file:',
  'edge://',
  'brave://',
  'opera://',
  'vivaldi://',
  'https://chrome.google.com/webstore',
  'https://chromewebstore.google.com',
  'https://microsoftedge.microsoft.com/addons',
  'https://addons.opera.com'
];

/**
 * Check if a URL is restricted (browser internal pages)
 */
function isRestrictedUrl(url) {
  if (!url) return true;
  return RESTRICTED_URL_PATTERNS.some((pattern) => url.startsWith(pattern));
}

/**
 * Show a system notification to the user
 */
function notify(message, title = 'Kagi Reverse Image Search') {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
    priority: 1
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Turn selection mode on (or off) in the given tab, injecting the content
 * script first if the page was loaded before the extension was installed.
 */
async function activateSelection(tab) {
  if (!tab || !tab.id || isRestrictedUrl(tab.url || '')) {
    notify('Cannot run on this page. Try a regular webpage.');
    return false;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'toggleSelectionMode' });
    return true;
  } catch (_) {
    // No content script in this tab yet - fall through and inject it
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    await chrome.tabs.sendMessage(tab.id, { action: 'toggleSelectionMode' });
    return true;
  } catch (error) {
    console.error('Cannot activate on this page:', error);
    notify('Cannot run on this page. Try refreshing it first.');
    return false;
  }
}

/**
 * Extension icon click / keyboard shortcut
 */
chrome.action.onClicked.addListener((tab) => {
  activateSelection(tab);
});

/**
 * Context menu entries
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_SELECT_AREA,
      title: 'Select an area to search with Kagi',
      contexts: ['page', 'frame', 'selection', 'link', 'image', 'video']
    });
    chrome.contextMenus.create({
      id: MENU_SEARCH_IMAGE,
      title: 'Search this image with Kagi',
      contexts: ['image']
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_SELECT_AREA) {
    activateSelection(tab);
  } else if (info.menuItemId === MENU_SEARCH_IMAGE && info.srcUrl) {
    searchImageUrl(info.srcUrl, tab);
  }
});

/**
 * Messages from the content script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.action === 'captureSelectedArea' && sender.tab) {
    captureSelectedArea(message.area, message.viewport, sender.tab)
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error('Capture failed:', error);
        sendResponse({ success: false, error: error.message || 'Capture failed' });
      });
    return true; // keep the channel open for the async response
  }

  return false;
});

/**
 * Screenshot the visible tab, crop it to the selection and hand it to the upload page
 */
async function captureSelectedArea(area, viewport, tab) {
  if (!area || !(area.width > 0) || !(area.height > 0)) {
    throw new Error('Invalid selection area');
  }

  // Give the page a moment to repaint without the selection UI
  await sleep(CAPTURE_DELAY_MS);

  let dataUrl;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  } catch (error) {
    console.error('captureVisibleTab failed:', error);
    throw new Error('Failed to capture the screen. Please try again.');
  }
  if (!dataUrl) {
    throw new Error('No image data captured');
  }

  const cropped = await cropImage(dataUrl, area, viewport);
  await openUploadPage(cropped, 'selection.png', tab);
}

/**
 * Crop a screenshot (data URL) to a CSS-pixel area of the viewport.
 * Runs entirely in the service worker, so nothing has to be injected into the page.
 */
async function cropImage(dataUrl, area, viewport) {
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);

  try {
    // Screenshots are in device pixels; the selection is in CSS pixels.
    // devicePixelRatio already includes page zoom. If the content script could
    // not report it, fall back to comparing the screenshot with the viewport.
    let scale = viewport && viewport.dpr > 0 ? viewport.dpr : 0;
    if (!scale && viewport && viewport.width > 0) {
      scale = bitmap.width / viewport.width;
    }
    scale = scale || 1;

    const sx = clamp(Math.round(area.x * scale), 0, bitmap.width);
    const sy = clamp(Math.round(area.y * scale), 0, bitmap.height);
    const sw = clamp(Math.round(area.width * scale), 0, bitmap.width - sx);
    const sh = clamp(Math.round(area.height * scale), 0, bitmap.height - sy);

    if (sw < 1 || sh < 1) {
      throw new Error('Selection is outside the visible area');
    }

    const canvas = new OffscreenCanvas(sw, sh);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);

    const out = await canvas.convertToBlob({ type: 'image/png' });
    return blobToDataUrl(out);
  } finally {
    bitmap.close();
  }
}

/**
 * Fetch an image (from the "Search this image" context menu) and send it to Kagi
 */
async function searchImageUrl(srcUrl, tab) {
  try {
    let dataUrl = srcUrl;
    let filename = 'image.png';

    if (!srcUrl.startsWith('data:')) {
      const response = await fetch(srcUrl, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const type = blob.type || '';
      if (type && !type.startsWith('image/') && type !== 'application/octet-stream') {
        throw new Error(`Not an image (${type})`);
      }
      if (blob.size > MAX_IMAGE_BYTES) {
        throw new Error('Image is too large');
      }
      filename = 'image.' + extensionForMime(type);
      dataUrl = await blobToDataUrl(blob);
    }

    await openUploadPage(dataUrl, filename, tab);
  } catch (error) {
    console.error('Image search failed:', error);
    notify('Could not load that image. Try selecting the area on the page instead.');
  }
}

function extensionForMime(type) {
  switch (type) {
    case 'image/jpeg': return 'jpg';
    case 'image/gif': return 'gif';
    case 'image/webp': return 'webp';
    case 'image/avif': return 'avif';
    case 'image/svg+xml': return 'svg';
    case 'image/bmp': return 'bmp';
    default: return 'png';
  }
}

/**
 * Stash the image and open the upload page next to the source tab
 */
async function openUploadPage(dataUrl, filename, sourceTab) {
  if (!dataUrl) {
    throw new Error('No image to search');
  }

  try {
    await chrome.storage.local.set({
      pendingUpload: { dataUrl, filename, createdAt: Date.now() }
    });
  } catch (error) {
    console.error('Could not store image:', error);
    throw new Error('Image is too large to hand off. Try a smaller selection.');
  }

  const createProperties = { url: chrome.runtime.getURL(UPLOAD_PAGE) };
  if (sourceTab && typeof sourceTab.index === 'number') {
    createProperties.index = sourceTab.index + 1;
    createProperties.windowId = sourceTab.windowId;
  }
  await chrome.tabs.create(createProperties);
}

/**
 * Convert a Blob to a base64 data URL (FileReader-free, works in service workers)
 */
async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return `data:${blob.type || 'image/png'};base64,${btoa(binary)}`;
}
