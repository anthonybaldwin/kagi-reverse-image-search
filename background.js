'use strict';

// Constants
const KAGI_REVERSE_URL = 'https://kagi.com/reverse';
const UI_HIDE_DELAY_MS = 150;

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
  'https://microsoftedge.microsoft.com/addons',
  'https://addons.opera.com'
];

/**
 * Check if a URL is restricted (browser internal pages)
 */
function isRestrictedUrl(url) {
  if (!url || url === '') return true;
  return RESTRICTED_URL_PATTERNS.some(pattern => url.startsWith(pattern));
}

/**
 * Show a notification to the user
 */
function showNotification(message, title = 'Kagi Reverse Image Search') {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message,
    priority: 2
  });
}

/**
 * Handle extension icon click
 */
chrome.action.onClicked.addListener(async (tab) => {
  const url = tab.url || '';

  if (isRestrictedUrl(url)) {
    showNotification('Cannot run on this page. Try a regular webpage.');
    return;
  }

  // Try to send message to existing content script
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'toggleSelectionMode' });
  } catch (error) {
    // Content script not loaded - try to inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content.css']
      });

      // Now try sending the message again
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleSelectionMode' });
    } catch (injectError) {
      // Cannot inject - page doesn't allow it
      console.error('Cannot activate on this page:', injectError.message);
      showNotification('Cannot run on this page. Try refreshing first.');
    }
  }
});

/**
 * Listen for messages from content script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'searchImage') {
    searchImageWithKagi(message.imageUrl);
    sendResponse({ success: true });
    return false;
  }

  if (message.action === 'captureSelectedArea') {
    captureSelectedArea(message.area, sender.tab.id, sendResponse);
    return true; // Keep channel open for async response
  }

  return false;
});

/**
 * Capture selected area of the screen
 */
function captureSelectedArea(area, tabId, sendResponse) {
  // Validate area dimensions
  if (!area || area.width <= 0 || area.height <= 0) {
    sendResponse({ success: false, error: 'Invalid selection area' });
    return;
  }

  // First, hide the selection UI
  chrome.tabs.sendMessage(tabId, { action: 'hideSelectionUI' }, () => {
    // Ignore any errors here - UI might already be hidden
    if (chrome.runtime.lastError) {
      // Silently continue
    }

    // Wait for UI to hide before capturing
    setTimeout(() => {
      chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error('Error capturing tab:', chrome.runtime.lastError);
          sendResponse({ success: false, error: 'Failed to capture screen. Please try again.' });
          return;
        }

        if (!dataUrl) {
          sendResponse({ success: false, error: 'No image data captured' });
          return;
        }

        // Process the image in the tab context
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          function: processImageInTab,
          args: [dataUrl, area]
        }).then((results) => {
          if (results && results[0] && results[0].result) {
            const result = results[0].result;

            if (result.success) {
              searchImageWithKagi(result.croppedDataUrl);
              sendResponse({ success: true });
            } else {
              console.error('Image processing error:', result.error);
              sendResponse({ success: false, error: result.error || 'Failed to process image' });
            }
          } else {
            sendResponse({ success: false, error: 'Failed to process captured image' });
          }
        }).catch((error) => {
          console.error('Script execution error:', error);
          sendResponse({ success: false, error: 'Failed to process image: ' + error.message });
        });
      });
    }, UI_HIDE_DELAY_MS);
  });
}

/**
 * Process image in tab context (injected function)
 */
function processImageInTab(dataUrl, area) {
  return new Promise((resolve) => {
    try {
      const img = new Image();

      img.onload = function () {
        try {
          // Validate dimensions
          if (area.width <= 0 || area.height <= 0) {
            resolve({ success: false, error: 'Invalid selection dimensions' });
            return;
          }

          // Create canvas for cropping
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            resolve({ success: false, error: 'Failed to create canvas context' });
            return;
          }

          // Account for device pixel ratio
          const dpr = window.devicePixelRatio || 1;
          canvas.width = area.width * dpr;
          canvas.height = area.height * dpr;

          // Draw the cropped region
          ctx.drawImage(
            img,
            area.x * dpr, area.y * dpr, area.width * dpr, area.height * dpr,
            0, 0, canvas.width, canvas.height
          );

          const croppedDataUrl = canvas.toDataURL('image/png');
          resolve({ success: true, croppedDataUrl: croppedDataUrl });
        } catch (error) {
          resolve({ success: false, error: 'Canvas operation failed: ' + error.message });
        }
      };

      img.onerror = function () {
        resolve({ success: false, error: 'Failed to load captured image' });
      };

      img.src = dataUrl;
    } catch (error) {
      resolve({ success: false, error: 'Image processing failed: ' + error.message });
    }
  });
}

/**
 * Search image with Kagi using form-based upload
 */
function searchImageWithKagi(imageUrl) {
  if (!imageUrl) {
    showNotification('No image to search');
    return;
  }

  if (!imageUrl.startsWith('data:')) {
    chrome.tabs.create({ url: KAGI_REVERSE_URL });
    showNotification('Please upload the image manually on the Kagi page.');
    return;
  }

  // Use form-based upload (works with Privacy Pass)
  chrome.storage.local.set({ imageData: imageUrl }, () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('upload.html') });
  });
}
