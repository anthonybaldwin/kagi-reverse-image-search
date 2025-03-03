// Apply Kagi theme from storage
function applyKagiTheme() {
    chrome.storage.sync.get(['kagiTheme'], function(result) {
        if (result.kagiTheme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
    });
}

// Apply theme when page loads
document.addEventListener('DOMContentLoaded', function() {
    applyKagiTheme();
});
