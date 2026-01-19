'use strict';

const UPLOAD_DELAY_MS = 800; // Show preview before uploading

const errorEl = document.getElementById('error');
const spinnerEl = document.getElementById('spinner');
const previewSection = document.getElementById('previewSection');
const previewImage = document.getElementById('previewImage');
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
 * Show error state
 */
function showError(msg) {
  spinnerEl.classList.add('hidden');
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
}

/**
 * Initialize upload
 */
function init() {
  chrome.storage.local.get(['imageData'], (result) => {
    if (chrome.runtime.lastError) {
      showError('Could not load image data');
      return;
    }

    const imageData = result.imageData;
    if (!imageData) {
      showError('No image found. Please try again.');
      return;
    }

    // Clear stored data
    chrome.storage.local.remove(['imageData']);

    // Show preview
    previewImage.src = imageData;
    previewImage.onload = () => {
      previewSection.classList.remove('hidden');

      // Convert to File
      const file = dataUrlToFile(imageData, 'screenshot.png');
      if (!file) {
        showError('Failed to process image');
        return;
      }

      // Create a DataTransfer to set the file input
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;

      // Brief delay so user can see preview, then submit
      setTimeout(() => {
        form.submit();
      }, UPLOAD_DELAY_MS);
    };

    previewImage.onerror = () => {
      showError('Failed to load image preview');
    };
  });
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
