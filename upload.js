'use strict';

const KAGI_REVERSE_URL = 'https://kagi.com/reverse';
const SLOW_UPLOAD_MS = 8000;

const form = document.getElementById('uploadForm');
const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const previewImage = document.getElementById('previewImage');
const statusText = document.getElementById('statusText');
const subText = document.getElementById('subText');
const fallback = document.getElementById('fallback');
const downloadLink = document.getElementById('downloadLink');

/**
 * Match the Kagi theme the user last used (detected by kagi-theme-detector.js)
 */
function applyTheme() {
  try {
    chrome.storage.sync.get(['kagiTheme'], (result) => {
      if (chrome.runtime.lastError) return;
      if (result.kagiTheme === 'dark' || result.kagiTheme === 'light') {
        document.documentElement.dataset.theme = result.kagiTheme;
      }
    });
  } catch (_) {
    // Fall back to prefers-color-scheme
  }
}

/**
 * Convert a data URL to a File object
 */
function dataUrlToFile(dataUrl, filename) {
  try {
    const comma = dataUrl.indexOf(',');
    if (comma < 0) return null;

    const header = dataUrl.slice(0, comma);
    const payload = dataUrl.slice(comma + 1);
    const mimeMatch = header.match(/^data:([^;,]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

    let bytes;
    if (/;base64$/i.test(header)) {
      const byteString = atob(payload);
      bytes = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        bytes[i] = byteString.charCodeAt(i);
      }
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(payload));
    }

    return new File([bytes], filename, { type: mimeType });
  } catch (error) {
    console.error('Could not decode image:', error);
    return null;
  }
}

function goToKagi() {
  window.location.replace(KAGI_REVERSE_URL);
}

/**
 * Read the pending image, show it, and submit it to Kagi straight away
 */
function init() {
  applyTheme();

  chrome.storage.local.get(['pendingUpload'], (result) => {
    const pending = result && result.pendingUpload;
    if (chrome.runtime.lastError || !pending || !pending.dataUrl) {
      // Nothing to upload (e.g. the user navigated back here) - just open Kagi
      goToKagi();
      return;
    }

    // One-shot: clear it so a reload/back navigation doesn't resubmit
    chrome.storage.local.remove(['pendingUpload']);

    const filename = pending.filename || 'selection.png';
    const file = dataUrlToFile(pending.dataUrl, filename);
    if (!file) {
      goToKagi();
      return;
    }

    previewImage.src = pending.dataUrl;
    previewImage.onload = () => preview.classList.add('show');
    downloadLink.href = pending.dataUrl;
    downloadLink.download = filename;

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    form.submit();

    // The page stays visible while the POST is in flight. If it drags on, offer a way out.
    setTimeout(() => {
      statusText.textContent = 'Still searching…';
      subText.textContent = 'Kagi is taking a while to respond.';
      fallback.classList.add('show');
    }, SLOW_UPLOAD_MS);
  });
}

init();
