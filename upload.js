'use strict';

const form = document.getElementById('uploadForm');
const fileInput = document.getElementById('fileInput');

/**
 * Convert data URL to File object
 */
function dataUrlToFile(dataUrl, filename) {
  try {
    const parts = dataUrl.split(',');
    if (parts.length !== 2) return null;

    const mimeMatch = parts[0].match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

    const byteString = atob(parts[1]);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);

    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }

    return new File([uint8Array], filename, { type: mimeType });
  } catch (e) {
    return null;
  }
}

/**
 * Initialize upload - submit immediately
 */
function init() {
  chrome.storage.local.get(['imageData'], (result) => {
    if (chrome.runtime.lastError || !result.imageData) {
      // Silently fail - just go to Kagi
      window.location.href = 'https://kagi.com/reverse';
      return;
    }

    const imageData = result.imageData;

    // Clear stored data
    chrome.storage.local.remove(['imageData']);

    // Convert to File and submit immediately
    const file = dataUrlToFile(imageData, 'screenshot.png');
    if (!file) {
      window.location.href = 'https://kagi.com/reverse';
      return;
    }

    // Set the file input and submit
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    form.submit();
  });
}

// Start immediately
init();
