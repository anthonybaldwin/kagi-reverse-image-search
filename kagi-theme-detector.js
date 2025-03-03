// Content script to detect Kagi.com's theme and store it
function detectKagiTheme() {
  try {
    // Check if we're on Kagi.com
    if (!window.location.hostname.includes('kagi.com')) {
      return;
    }
    
    // Get the computed style of the body
    const computedStyle = getComputedStyle(document.body);
    const backgroundColor = computedStyle.backgroundColor;
    
    // Check if the body has a class indicating the theme
    const bodyClassList = document.body.classList;
    let isDark = false;
    
    // First check for common class names
    if (bodyClassList.contains('dark-theme') || bodyClassList.contains('dark')) {
      isDark = true;
    } else if (bodyClassList.contains('light-theme') || bodyClassList.contains('light')) {
      isDark = false;
    } else {
      // If no specific class is found, check the computed style
      isDark = isDarkColor(backgroundColor);
    }
    
    const theme = isDark ? 'dark' : 'light';
    
// Store the theme preference
    try {
      chrome.storage.sync.set({ 'kagiTheme': theme }, function() {
        if (chrome.runtime.lastError) {
          console.log('Note: Could not store theme due to extension context change. This is normal during page refresh.');
        } else {
          console.log('Kagi theme detected and stored: ' + theme);
        }
      });
    } catch (storageError) {
      // This is likely due to extension context invalidation during page refresh
      console.log('Note: Could not access storage. This is normal during page refresh.');
    }
  } catch (error) {
    console.error('Error detecting Kagi theme:', error);
  }
}

// Helper function to determine if a color is dark
function isDarkColor(color) {
  // Convert the color to RGB and check its brightness
  const rgb = color.match(/\d+/g);
  if (!rgb) return false;
  
  const [r, g, b] = rgb.map(Number);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128;
}

// Run the detection when the page is fully loaded
if (document.readyState === 'complete') {
  detectKagiTheme();
} else {
  window.addEventListener('load', detectKagiTheme);
}

// Also run the detection when the DOM content is loaded
document.addEventListener('DOMContentLoaded', detectKagiTheme);

// Run the detection periodically to catch theme changes
const intervalId = setInterval(() => {
  try {
    detectKagiTheme();
  } catch (error) {
    // If we get an extension context invalidated error, clear the interval
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.log('Extension context changed, clearing theme detection interval');
      clearInterval(intervalId);
    } else {
      console.error('Error in theme detection interval:', error);
    }
  }
}, 5000);

// Clean up when the page is unloaded
window.addEventListener('unload', () => {
  clearInterval(intervalId);
});
