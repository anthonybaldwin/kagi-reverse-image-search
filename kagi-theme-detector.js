'use strict';

/**
 * Detect if a color is dark based on luminance
 */
function isDarkColor(colorString) {
  if (!colorString || typeof colorString !== 'string') {
    return false;
  }

  const rgbMatch = colorString.match(/\d+/g);
  if (!rgbMatch || rgbMatch.length < 3) {
    return false;
  }

  const [r, g, b] = rgbMatch.map(Number);

  // Calculate relative luminance (ITU-R BT.709)
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance < 128;
}

/**
 * Detect and store Kagi theme preference (runs once per page load)
 */
function detectKagiTheme() {
  try {
    // Verify we're on Kagi
    if (!window.location.hostname.includes('kagi.com')) {
      return;
    }

    // Determine theme
    let isDark = false;
    const classList = document.body.classList;

    // Check for explicit theme classes first
    if (classList.contains('dark-theme') || classList.contains('dark')) {
      isDark = true;
    } else if (classList.contains('light-theme') || classList.contains('light')) {
      isDark = false;
    } else {
      // Fall back to computed background color
      const computedStyle = window.getComputedStyle(document.body);
      const backgroundColor = computedStyle.backgroundColor;
      isDark = isDarkColor(backgroundColor);
    }

    const theme = isDark ? 'dark' : 'light';

    // Store theme preference
    chrome.storage.sync.set({ kagiTheme: theme });
  } catch (error) {
    // Silently fail - extension context may be invalidated
  }
}

// Detect theme once when page is ready
if (document.readyState === 'complete') {
  detectKagiTheme();
} else {
  window.addEventListener('load', detectKagiTheme, { once: true });
}
