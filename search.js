'use strict';

// Constants
const KAGI_UPLOAD_URL = 'https://kagi.com/reverse/upload';
const KAGI_REVERSE_URL = 'https://kagi.com/reverse';

// DOM elements
const searchButton = document.getElementById('searchButton');
const selectedImage = document.getElementById('selectedImage');
const loadingElement = document.getElementById('loading');
const imageContainer = document.querySelector('.image-container');

/**
 * Safely convert a data URL to a Blob
 */
function dataUrlToBlob(dataUrl) {
  try {
    if (!dataUrl || typeof dataUrl !== 'string') {
      throw new Error('Invalid data URL');
    }

    const parts = dataUrl.split(',');
    if (parts.length !== 2) {
      throw new Error('Malformed data URL');
    }

    // Extract MIME type safely
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

    // Decode base64
    const byteString = atob(parts[1]);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);

    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }

    return new Blob([arrayBuffer], { type: mimeType });
  } catch (error) {
    console.error('Error converting data URL to blob:', error);
    return null;
  }
}

/**
 * Show error state with fallback options
 */
function showErrorState(errorMessage, imageData) {
  const container = document.querySelector('.button-container') || searchButton.parentNode;

  container.innerHTML = `
    <div class="error-state">
      <h2>Upload Error</h2>
      <p class="error-message">${escapeHtml(errorMessage)}</p>
      <p>You can download the image and upload it manually:</p>
      <div class="error-actions">
        <a href="${imageData}" download="screenshot.png" class="button">Download Image</a>
        <button id="openKagiBtn" class="button button-secondary">Open Kagi Reverse Search</button>
      </div>
    </div>
  `;

  // Add event listener for Kagi button
  const openKagiBtn = document.getElementById('openKagiBtn');
  if (openKagiBtn) {
    openKagiBtn.addEventListener('click', () => {
      window.open(KAGI_REVERSE_URL, '_blank');
    });
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Show loading indicator
 */
function showLoadingIndicator(message) {
  const indicator = document.createElement('div');
  indicator.id = 'uploadIndicator';
  indicator.className = 'upload-indicator';
  indicator.textContent = message;
  document.body.appendChild(indicator);
  return indicator;
}

/**
 * Remove loading indicator
 */
function removeLoadingIndicator() {
  const indicator = document.getElementById('uploadIndicator');
  if (indicator && indicator.parentNode) {
    indicator.parentNode.removeChild(indicator);
  }
}

/**
 * Initialize the search page
 */
function init() {
  // Get image data from storage
  chrome.storage.local.get(['imageData'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Storage error:', chrome.runtime.lastError);
      loadingElement.textContent = 'Error: Could not load image data';
      loadingElement.classList.add('error');
      return;
    }

    const imageData = result.imageData;

    if (!imageData) {
      loadingElement.textContent = 'Error: No image found. Please try capturing again.';
      loadingElement.classList.add('error');
      return;
    }

    // Display the image
    selectedImage.src = imageData;
    selectedImage.onload = () => {
      loadingElement.style.display = 'none';
      imageContainer.style.display = 'block';
      searchButton.style.display = 'inline-block';
    };

    selectedImage.onerror = () => {
      loadingElement.textContent = 'Error: Could not display image';
      loadingElement.classList.add('error');
    };

    // Set up search button
    searchButton.addEventListener('click', () => handleSearch(imageData));

    // Clean up stored image data after loading
    chrome.storage.local.remove(['imageData'], () => {
      if (chrome.runtime.lastError) {
        console.warn('Could not clear stored image:', chrome.runtime.lastError);
      }
    });
  });
}

/**
 * Handle search button click
 */
function handleSearch(imageData) {
  // Disable button and show loading
  searchButton.disabled = true;
  searchButton.textContent = 'Uploading...';
  const indicator = showLoadingIndicator('Preparing image...');

  // Convert to blob
  const blob = dataUrlToBlob(imageData);
  if (!blob) {
    removeLoadingIndicator();
    searchButton.disabled = false;
    searchButton.textContent = 'Search with Kagi';
    showErrorState('Failed to process image data', imageData);
    return;
  }

  // Create FormData
  const formData = new FormData();
  formData.append('file', blob, 'screenshot.png');

  // Update indicator
  indicator.textContent = 'Uploading to Kagi...';

  // Upload to Kagi
  fetch(KAGI_UPLOAD_URL, {
    method: 'POST',
    body: formData,
    headers: {
      'Origin': 'https://kagi.com',
      'Referer': KAGI_REVERSE_URL
    },
    credentials: 'include'
  })
    .then((response) => {
      removeLoadingIndicator();

      if (response.ok) {
        // Redirect to results
        window.location.href = response.url;
      } else {
        throw new Error(`Upload failed (status ${response.status})`);
      }
    })
    .catch((error) => {
      console.error('Upload error:', error);
      removeLoadingIndicator();
      searchButton.disabled = false;
      searchButton.textContent = 'Search with Kagi';
      showErrorState(error.message || 'Upload failed', imageData);
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
