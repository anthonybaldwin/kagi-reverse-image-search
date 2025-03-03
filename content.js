// Global variables
let isSelectionMode = false;
let selectionBox = null;
let startX = 0;
let startY = 0;
let endX = 0;
let endY = 0;
let isDragging = false;

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleSelectionMode') {
    toggleSelectionMode();
    sendResponse({ success: true });
  } else if (message.action === 'getSelectionModeStatus') {
    sendResponse({ isSelectionMode: isSelectionMode });
  } else if (message.action === 'hideSelectionUI') {
    // Hide the selection box if it exists
    if (selectionBox && selectionBox.parentNode) {
      selectionBox.style.display = 'none';
    }
    sendResponse({ success: true });
  }
});

// Toggle selection mode
function toggleSelectionMode() {
  isSelectionMode = !isSelectionMode;
  
  if (isSelectionMode) {
    enableSelectionMode();
  } else {
    disableSelectionMode();
  }
}

// Create a transparent overlay to block hover effects
let selectionOverlay = null;

// Enable selection mode
function enableSelectionMode() {
  // Add event listeners for mouse actions
  document.addEventListener('mousedown', handleMouseDown, true);
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('mouseup', handleMouseUp, true);
  document.body.style.cursor = 'crosshair';
  
  // Create a transparent overlay to block hover effects
  selectionOverlay = document.createElement('div');
  selectionOverlay.className = 'kagi-selection-overlay';
  selectionOverlay.style.position = 'fixed';
  selectionOverlay.style.top = '0';
  selectionOverlay.style.left = '0';
  selectionOverlay.style.width = '100%';
  selectionOverlay.style.height = '100%';
  selectionOverlay.style.zIndex = '9990';
  selectionOverlay.style.backgroundColor = 'transparent';
  document.body.appendChild(selectionOverlay);
  
  // Add a style element to force cursor to remain crosshair
  const cursorStyle = document.createElement('style');
  cursorStyle.id = 'kagi-cursor-style';
  cursorStyle.textContent = `
    * {
      cursor: crosshair !important;
    }
    .kagi-selection-box, .kagi-selection-box * {
      cursor: crosshair !important;
    }
  `;
  document.head.appendChild(cursorStyle);
  
  // Only prevent hover-related events on the page elements
  const hoverEvents = [
    'mouseenter', 'mouseleave', 'mouseover', 'mouseout',
    'pointerover', 'pointerenter', 'pointerout', 'pointerleave'
  ];
  
  // Add event listeners to the document to prevent hover effects
  hoverEvents.forEach(eventType => {
    document.addEventListener(eventType, preventHoverEffects, true);
  });
  
  // Create and show flash animation
  showFlashAnimation();
  
  // Show a notification to the user
  showNotification('Selection mode enabled. Click and drag to select an area to search with Kagi.');
}

// Disable selection mode
function disableSelectionMode() {
  // Remove event listeners
  document.removeEventListener('mousedown', handleMouseDown, true);
  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('mouseup', handleMouseUp, true);
  document.body.style.cursor = '';
  
  // Remove hover event prevention
  const hoverEvents = [
    'mouseenter', 'mouseleave', 'mouseover', 'mouseout',
    'pointerover', 'pointerenter', 'pointerout', 'pointerleave'
  ];
  
  hoverEvents.forEach(eventType => {
    document.removeEventListener(eventType, preventHoverEffects, true);
  });
  
  // Remove selection overlay
  if (selectionOverlay && selectionOverlay.parentNode) {
    selectionOverlay.parentNode.removeChild(selectionOverlay);
    selectionOverlay = null;
  }
  
  // Remove cursor style
  const cursorStyle = document.getElementById('kagi-cursor-style');
  if (cursorStyle && cursorStyle.parentNode) {
    cursorStyle.parentNode.removeChild(cursorStyle);
  }
  
  // Remove selection box if it exists
  if (selectionBox && selectionBox.parentNode) {
    selectionBox.parentNode.removeChild(selectionBox);
    selectionBox = null;
  }
  
  // Show a notification to the user
  showNotification('Selection complete. Click the extension icon or use the shortcut to select again.');
  
  // Reset selection mode flag
  isSelectionMode = false;
}

// Show flash animation when entering selection mode
function showFlashAnimation() {
  const flash = document.createElement('div');
  flash.className = 'kagi-selection-mode-flash';
  document.body.appendChild(flash);
  
  // Remove the flash element after animation completes
  setTimeout(() => {
    if (flash && flash.parentNode) {
      flash.parentNode.removeChild(flash);
    }
  }, 500);
}

// Prevent hover effects during selection
function preventHoverEffects(event) {
  // Skip our own elements
  if (event.target.classList && 
      (event.target.classList.contains('kagi-selection-box') || 
       event.target.classList.contains('kagi-selection-mode-flash') ||
       event.target.classList.contains('kagi-image-search-notification') ||
       event.target.classList.contains('kagi-selection-overlay') ||
       event.target.closest('.kagi-selection-box'))) {
    return;
  }
  
  if (isSelectionMode) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
}

// Handle mouse down event
function handleMouseDown(event) {
  // Only proceed if left mouse button is pressed
  if (event.button !== 0) return;
  
  // Prevent default behavior
  event.preventDefault();
  event.stopPropagation();
  
  // Set starting coordinates
  startX = event.clientX;
  startY = event.clientY;
  
  // Create selection box if it doesn't exist
  if (!selectionBox) {
    selectionBox = document.createElement('div');
    selectionBox.className = 'kagi-selection-box';
    
    // Add corner elements for selection box
    const cornerTopRight = document.createElement('div');
    cornerTopRight.className = 'corner-top-right';
    selectionBox.appendChild(cornerTopRight);
    
    const cornerBottomLeft = document.createElement('div');
    cornerBottomLeft.className = 'corner-bottom-left';
    selectionBox.appendChild(cornerBottomLeft);
    
    document.body.appendChild(selectionBox);
  }
  
  // Position the selection box
  selectionBox.style.left = startX + 'px';
  selectionBox.style.top = startY + 'px';
  selectionBox.style.width = '0';
  selectionBox.style.height = '0';
  selectionBox.style.display = 'block';
  
  // Set dragging flag
  isDragging = true;
}

// Handle mouse move event
function handleMouseMove(event) {
  if (!isDragging) return;
  
  // Prevent default behavior
  event.preventDefault();
  event.stopPropagation();
  
  // Calculate current position
  endX = event.clientX;
  endY = event.clientY;
  
  // Calculate dimensions
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  
  // Calculate top-left position
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  
  // Update selection box
  selectionBox.style.left = left + 'px';
  selectionBox.style.top = top + 'px';
  selectionBox.style.width = width + 'px';
  selectionBox.style.height = height + 'px';
}

// Handle mouse up event
function handleMouseUp(event) {
  if (!isDragging) return;
  
  // Prevent default behavior
  event.preventDefault();
  event.stopPropagation();
  
  // Reset dragging flag
  isDragging = false;
  
  // Calculate final dimensions
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  
  // Only proceed if the selection has a meaningful size
  if (width > 10 && height > 10) {
    // Calculate the position relative to the viewport
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    
    // Capture the selected area
    captureSelectedArea(left, top, width, height);
  } else {
    // Remove the selection box if it's too small
    if (selectionBox && selectionBox.parentNode) {
      selectionBox.parentNode.removeChild(selectionBox);
      selectionBox = null;
    }
  }
}

// Capture the selected area
function captureSelectedArea(left, top, width, height) {
  try {
    // Send message to background script to capture the selected area
    chrome.runtime.sendMessage({
      action: 'captureSelectedArea',
      area: {
        x: left,
        y: top,
        width: width,
        height: height
      }
    }, (response) => {
      // Check for error in response
      if (chrome.runtime.lastError) {
        console.error("Error sending message:", chrome.runtime.lastError);
        showNotification('Error: ' + chrome.runtime.lastError.message);
      } else if (response && !response.success) {
        console.error("Error in response:", response.error);
        showNotification('Error: ' + (response.error || 'Unknown error'));
      }
      
      // Remove the selection box
      if (selectionBox && selectionBox.parentNode) {
        selectionBox.parentNode.removeChild(selectionBox);
        selectionBox = null;
      }
      
      // Disable selection mode and reset the flag
      disableSelectionMode();
      isSelectionMode = false;
    });
  } catch (error) {
    console.error("Error in captureSelectedArea:", error);
    showNotification('Error: ' + error.message);
    
    // Clean up
    if (selectionBox && selectionBox.parentNode) {
      selectionBox.parentNode.removeChild(selectionBox);
      selectionBox = null;
    }
    disableSelectionMode();
  }
}

// Show a notification to the user
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'kagi-image-search-notification';
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Remove the notification after a few seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 500);
  }, 3000);
}
