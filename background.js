// Global variables

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  // Extension initialization
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Check if the current tab is a valid tab for the extension
  const url = tab.url || '';
  
  // Don't run on chrome:// pages, chrome-extension:// pages, or other restricted URLs
  if (url.startsWith('chrome://') || 
      url.startsWith('chrome-extension://') || 
      url.startsWith('chrome-search://') ||
      url.startsWith('chrome-devtools://') ||
      url.startsWith('devtools://') ||
      url.startsWith('view-source:') ||
      url.startsWith('about:') ||
      url.startsWith('data:') ||
      url.startsWith('file:') ||
      url === '') {
    // Show a notification that the extension can't run on this page
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Kagi Reverse Image Search',
      message: 'This extension cannot be used on browser system pages.',
      priority: 2
    });
    return;
  }
  
  // Send message to content script to activate selection mode
  chrome.tabs.sendMessage(tab.id, { 
    action: 'toggleSelectionMode'
  }, (response) => {
    // Check if there was an error sending the message
    if (chrome.runtime.lastError) {
      console.error("Error sending message:", chrome.runtime.lastError);
      
      // Show a notification that the extension can't run on this page
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Kagi Reverse Image Search',
        message: 'This extension cannot be used on this page.',
        priority: 2
      });
    }
  });
});


// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'searchImage') {
    searchImageWithKagi(message.imageUrl);
    sendResponse({ success: true });
  } else if (message.action === 'captureSelectedArea') {
    captureSelectedArea(message.area, sender.tab.id, sendResponse);
    return true; // Keep the message channel open for async response
  }
  return true; // Keep the message channel open for async responses
});

// Capture selected area of the screen
function captureSelectedArea(area, tabId, sendResponse) {
  try {
    // First, hide the selection UI
    chrome.tabs.sendMessage(tabId, { action: 'hideSelectionUI' }, () => {
      // Wait a bit for the UI to hide
      setTimeout(() => {
        // Capture the visible tab
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
          if (chrome.runtime.lastError) {
            console.error("Error capturing tab:", chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
            return;
          }

          // We need to use the chrome.scripting API to execute a script in the context of the tab
          // This script will process the image data
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            function: processImageInTab,
            args: [dataUrl, area]
          }).then((results) => {
            if (results && results[0] && results[0].result) {
              const result = results[0].result;
              
              if (result.success) {
                // Search the image
                searchImageWithKagi(result.croppedDataUrl);
                sendResponse({ success: true });
              } else {
                console.error("Error in image processing:", result.error);
                sendResponse({ success: false, error: result.error });
              }
            } else {
              console.error("No results from script execution");
              sendResponse({ success: false, error: "Failed to process image" });
            }
          }).catch((error) => {
            console.error("Error executing script:", error);
            sendResponse({ success: false, error: error.message });
          });
        });
      }, 100); // Wait 100ms for the UI to hide
    });
  } catch (error) {
    console.error("Error in captureSelectedArea:", error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // Keep the message channel open for async response
}

// This function will be injected into the tab to process the image
function processImageInTab(dataUrl, area) {
  try {
    return new Promise((resolve) => {
      const img = new Image();
      
      img.onload = function() {
        try {
          // Create a canvas to crop the image
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Set canvas dimensions to the selected area
          canvas.width = area.width;
          canvas.height = area.height;
          
          // Draw the cropped image on the canvas
          ctx.drawImage(
            img,
            area.x, area.y, area.width, area.height,
            0, 0, area.width, area.height
          );
          
          // Convert the canvas to a data URL
          const croppedDataUrl = canvas.toDataURL('image/png');
          
          resolve({
            success: true,
            croppedDataUrl: croppedDataUrl
          });
        } catch (error) {
          resolve({
            success: false,
            error: error.message
          });
        }
      };
      
      img.onerror = function() {
        resolve({
          success: false,
          error: "Failed to load captured image"
        });
      };
      
      img.src = dataUrl;
    });
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Search image with Kagi
function searchImageWithKagi(imageUrl) {
  if (!imageUrl) return;
  
  // Create a blob from the data URL if it's a data URL
  if (imageUrl.startsWith('data:')) {
    try {
      // Convert data URL to blob
      const byteString = atob(imageUrl.split(',')[1]);
      const mimeType = imageUrl.split(',')[0].split(':')[1].split(';')[0];
      const arrayBuffer = new ArrayBuffer(byteString.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i);
      }
      
      const blob = new Blob([arrayBuffer], { type: mimeType });
      
      // Create a FormData object
      const formData = new FormData();
      formData.append('file', blob, 'screenshot.png');
      
      // Create a variable to track if we need to show the loading page
      let loadingTabId = null;
      let loadingTimeout = null;
      
      // Set a timeout to show the loading page if the upload takes more than 1 second
      loadingTimeout = setTimeout(() => {
        chrome.tabs.create({ url: chrome.runtime.getURL('loading.html') }, (tab) => {
          loadingTabId = tab.id;
        });
      }, 1000);
      
      // Make the POST request to Kagi's reverse image search
      fetch('https://kagi.com/reverse/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Origin': 'https://kagi.com',
          'Referer': 'https://kagi.com/reverse'
        },
        credentials: 'include' // Include cookies
      })
      .then(response => {
        // Clear the timeout since we got a response
        clearTimeout(loadingTimeout);
        
        if (response.ok) {
          // If successful, open a new tab with the response URL
          chrome.tabs.create({ url: response.url });
          
          // Close the loading tab if it was created
          if (loadingTabId) {
            chrome.tabs.remove(loadingTabId);
          }
        } else {
          throw new Error(`Upload failed with status ${response.status}`);
        }
      })
      .catch(error => {
        // Clear the timeout since we got an error
        clearTimeout(loadingTimeout);
        console.error('Upload error:', error);
        
        // If there's an error, show the search.html page as a fallback
        const reader = new FileReader();
        reader.onloadend = function() {
          if (loadingTabId) {
            // Update the loading tab to show the search page
            chrome.tabs.update(loadingTabId, { url: 'search.html' });
            chrome.storage.local.set({
              'imageData': reader.result,
              'searchTab': loadingTabId
            });
          } else {
            // Create a new tab with the search page
            chrome.tabs.create({ url: 'search.html' }, (tab) => {
              chrome.storage.local.set({
                'imageData': reader.result,
                'searchTab': tab.id
              });
            });
          }
        };
        reader.readAsDataURL(blob);
      });
      
      return;
    } catch (error) {
      console.error("Error creating blob:", error);
    }
  }
  
  // If we couldn't create a blob or it's not a data URL, open Kagi's reverse image search
  if (!imageUrl.startsWith('data:')) {
    chrome.tabs.create({ url: 'https://kagi.com/reverse/upload' }, (tab) => {
      // Show a notification to the user
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Kagi Reverse Image Search',
        message: 'Please upload the image manually on the Kagi page that just opened.',
        priority: 2
      });
    });
  }
}
