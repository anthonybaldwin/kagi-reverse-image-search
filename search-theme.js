'use strict';

/**
 * Apply Kagi theme from storage
 */
function applyKagiTheme() {
  try {
    chrome.storage.sync.get(['kagiTheme'], (result) => {
      if (chrome.runtime.lastError) {
        console.warn('Could not load theme preference:', chrome.runtime.lastError);
        return;
      }

      if (result.kagiTheme === 'dark') {
        document.body.classList.add('dark-theme');
      } else {
        document.body.classList.remove('dark-theme');
      }
    });
  } catch (error) {
    console.warn('Theme application error:', error);
  }
}

// Apply theme when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyKagiTheme);
} else {
  applyKagiTheme();
}
