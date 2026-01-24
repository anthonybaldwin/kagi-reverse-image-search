'use strict';

// Prevent duplicate injection
if (window.__kagiReverseImageSearchLoaded) {
  // Script already loaded, don't re-execute
} else {
  window.__kagiReverseImageSearchLoaded = true;

  // State management
  const state = {
    isSelectionMode: false,
    isDragging: false,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0
  };

  // DOM elements (created lazily)
  let selectionBox = null;
  let selectionOverlay = null;
  let cursorStyle = null;

  // Constants
  const MIN_SELECTION_SIZE = 10;
  const NOTIFICATION_DURATION = 3500;
  const NOTIFICATION_FADE_DURATION = 400;

  // Hover events to block during selection
  const HOVER_EVENTS = [
    'mouseenter', 'mouseleave', 'mouseover', 'mouseout',
    'pointerover', 'pointerenter', 'pointerout', 'pointerleave'
  ];

  /**
   * Listen for messages from background script
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      switch (message.action) {
        case 'toggleSelectionMode':
          toggleSelectionMode();
          sendResponse({ success: true });
          break;

        case 'getSelectionModeStatus':
          sendResponse({ isSelectionMode: state.isSelectionMode });
          break;

        case 'hideSelectionUI':
          hideSelectionUI();
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    }
    return false;
  });

  /**
   * Toggle selection mode on/off
   */
  function toggleSelectionMode() {
    state.isSelectionMode = !state.isSelectionMode;

    if (state.isSelectionMode) {
      enableSelectionMode();
    } else {
      disableSelectionMode();
    }
  }

  /**
   * Enable selection mode
   */
  function enableSelectionMode() {
    // Add mouse event listeners
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseup', handleMouseUp, true);
    document.addEventListener('keydown', handleKeyDown, true);

    // Block hover effects
    HOVER_EVENTS.forEach(eventType => {
      document.addEventListener(eventType, preventHoverEffects, true);
    });

    // Create overlay to capture events
    createSelectionOverlay();

    // Add cursor style
    createCursorStyle();

    // Visual feedback
    showFlashAnimation();
    showNotification('Selection mode active. Drag to select an area, or press Escape to cancel.');
  }

  /**
   * Disable selection mode
   */
  function disableSelectionMode() {
    // Remove event listeners
    document.removeEventListener('mousedown', handleMouseDown, true);
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('mouseup', handleMouseUp, true);
    document.removeEventListener('keydown', handleKeyDown, true);

    // Remove hover blocking
    HOVER_EVENTS.forEach(eventType => {
      document.removeEventListener(eventType, preventHoverEffects, true);
    });

    // Clean up DOM elements
    removeSelectionOverlay();
    removeCursorStyle();
    removeSelectionBox();

    // Reset state
    state.isSelectionMode = false;
    state.isDragging = false;
    document.body.style.cursor = '';
  }

  /**
   * Hide selection UI (called before screen capture)
   */
  function hideSelectionUI() {
    if (selectionBox) {
      selectionBox.style.display = 'none';
    }
    if (selectionOverlay) {
      selectionOverlay.style.display = 'none';
    }
  }

  /**
   * Create selection overlay
   */
  function createSelectionOverlay() {
    if (selectionOverlay) return;

    selectionOverlay = document.createElement('div');
    selectionOverlay.className = 'kagi-selection-overlay';
    document.body.appendChild(selectionOverlay);
  }

  /**
   * Remove selection overlay
   */
  function removeSelectionOverlay() {
    if (selectionOverlay && selectionOverlay.parentNode) {
      selectionOverlay.parentNode.removeChild(selectionOverlay);
      selectionOverlay = null;
    }
  }

  /**
   * Create cursor style element
   */
  function createCursorStyle() {
    if (cursorStyle) return;

    cursorStyle = document.createElement('style');
    cursorStyle.id = 'kagi-cursor-style';
    cursorStyle.textContent = `
      * { cursor: crosshair !important; }
      .kagi-selection-box, .kagi-selection-box * { cursor: crosshair !important; }
    `;
    document.head.appendChild(cursorStyle);
    document.body.style.cursor = 'crosshair';
  }

  /**
   * Remove cursor style element
   */
  function removeCursorStyle() {
    if (cursorStyle && cursorStyle.parentNode) {
      cursorStyle.parentNode.removeChild(cursorStyle);
      cursorStyle = null;
    }
  }

  /**
   * Create selection box element
   */
  function createSelectionBox() {
    if (selectionBox) return;

    selectionBox = document.createElement('div');
    selectionBox.className = 'kagi-selection-box';

    // Add corner elements
    const cornerTopRight = document.createElement('div');
    cornerTopRight.className = 'corner-top-right';
    selectionBox.appendChild(cornerTopRight);

    const cornerBottomLeft = document.createElement('div');
    cornerBottomLeft.className = 'corner-bottom-left';
    selectionBox.appendChild(cornerBottomLeft);

    document.body.appendChild(selectionBox);
  }

  /**
   * Remove selection box element
   */
  function removeSelectionBox() {
    if (selectionBox && selectionBox.parentNode) {
      selectionBox.parentNode.removeChild(selectionBox);
      selectionBox = null;
    }
  }

  /**
   * Show flash animation when entering selection mode
   */
  function showFlashAnimation() {
    const flash = document.createElement('div');
    flash.className = 'kagi-selection-mode-flash';
    document.body.appendChild(flash);

    // Clean up after animation
    setTimeout(() => {
      if (flash && flash.parentNode) {
        flash.parentNode.removeChild(flash);
      }
    }, 500);
  }

  /**
   * Prevent hover effects during selection
   */
  function preventHoverEffects(event) {
    if (!state.isSelectionMode) return;

    // Allow our own elements
    const target = event.target;
    if (target && target.classList) {
      const isOurElement = target.classList.contains('kagi-selection-box') ||
        target.classList.contains('kagi-selection-mode-flash') ||
        target.classList.contains('kagi-image-search-notification') ||
        target.classList.contains('kagi-selection-overlay') ||
        target.closest('.kagi-selection-box');

      if (isOurElement) return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * Handle keydown events (Escape to cancel)
   */
  function handleKeyDown(event) {
    if (event.key === 'Escape' && state.isSelectionMode) {
      event.preventDefault();
      event.stopPropagation();
      disableSelectionMode();
      showNotification('Selection cancelled.');
    }
  }

  /**
   * Handle mouse down event
   */
  function handleMouseDown(event) {
    // Only handle left click
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    // Record start position
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.isDragging = true;

    // Create and position selection box
    createSelectionBox();
    selectionBox.style.left = state.startX + 'px';
    selectionBox.style.top = state.startY + 'px';
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';
    selectionBox.style.display = 'block';
  }

  /**
   * Handle mouse move event
   */
  function handleMouseMove(event) {
    if (!state.isDragging) return;

    event.preventDefault();
    event.stopPropagation();

    // Update end position
    state.endX = event.clientX;
    state.endY = event.clientY;

    // Calculate box dimensions
    const width = Math.abs(state.endX - state.startX);
    const height = Math.abs(state.endY - state.startY);
    const left = Math.min(state.startX, state.endX);
    const top = Math.min(state.startY, state.endY);

    // Update selection box
    if (selectionBox) {
      selectionBox.style.left = left + 'px';
      selectionBox.style.top = top + 'px';
      selectionBox.style.width = width + 'px';
      selectionBox.style.height = height + 'px';
    }
  }

  /**
   * Handle mouse up event
   */
  function handleMouseUp(event) {
    if (!state.isDragging) return;

    event.preventDefault();
    event.stopPropagation();

    state.isDragging = false;

    // Calculate final dimensions
    const width = Math.abs(state.endX - state.startX);
    const height = Math.abs(state.endY - state.startY);

    // Check minimum size
    if (width < MIN_SELECTION_SIZE || height < MIN_SELECTION_SIZE) {
      removeSelectionBox();
      showNotification('Selection too small. Please select a larger area.');
      return;
    }

    // Calculate selection area
    const left = Math.min(state.startX, state.endX);
    const top = Math.min(state.startY, state.endY);

    // Capture the selected area
    captureSelectedArea(left, top, width, height);
  }

  /**
   * Capture the selected area
   */
  function captureSelectedArea(left, top, width, height) {
    try {
      chrome.runtime.sendMessage({
        action: 'captureSelectedArea',
        area: { x: left, y: top, width: width, height: height }
      }, (response) => {
        // Handle extension context errors
        if (chrome.runtime.lastError) {
          console.error('Message error:', chrome.runtime.lastError);
          showNotification('Connection lost. Please refresh the page and try again.');
          cleanup();
          return;
        }

        // Handle response errors
        if (response && !response.success) {
          console.error('Capture error:', response.error);
          showNotification('Error: ' + (response.error || 'Unknown error occurred'));
        }

        cleanup();
      });
    } catch (error) {
      console.error('captureSelectedArea error:', error);
      showNotification('An error occurred. Please try again.');
      cleanup();
    }

    function cleanup() {
      removeSelectionBox();
      disableSelectionMode();
    }
  }

  /**
   * Show a notification toast
   */
  function showNotification(message) {
    // Remove any existing notifications
    const existing = document.querySelectorAll('.kagi-image-search-notification');
    existing.forEach(el => el.remove());

    // Create notification
    const notification = document.createElement('div');
    notification.className = 'kagi-image-search-notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    // Auto-remove after delay
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, NOTIFICATION_FADE_DURATION);
    }, NOTIFICATION_DURATION);
  }
}
