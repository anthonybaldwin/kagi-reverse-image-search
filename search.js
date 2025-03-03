// DOM elements
const searchButton = document.getElementById('searchButton');
const selectedImage = document.getElementById('selectedImage');
const loadingElement = document.getElementById('loading');

// Get the image data from storage
chrome.storage.local.get(['imageData', 'imageBlob', 'searchTab'], function(result) {
    // Use imageData if available, otherwise try imageBlob (for backward compatibility)
    const imageData = result.imageData || result.imageBlob;
    
    if (imageData) {
        // Display the image
        selectedImage.src = imageData;
        
        // Hide loading message
        loadingElement.style.display = 'none';
        
        // Show search button
        searchButton.style.display = 'inline-block';
        
        // Set up search button
        searchButton.addEventListener('click', function() {
            // Create a loading indicator
            const loadingIndicator = document.createElement('div');
            loadingIndicator.textContent = 'Preparing image...';
            loadingIndicator.style.margin = '10px 0';
            loadingIndicator.style.fontStyle = 'italic';
            document.body.appendChild(loadingIndicator);
            
            // Disable the search button
            searchButton.disabled = true;
            
            // Convert data URL to blob
            const parts = imageData.split(',');
            const mime = parts[0].match(/:(.*?);/)[1];
            const binaryString = atob(parts[1]);
            const array = [];
            
            for (let i = 0; i < binaryString.length; i++) {
                array.push(binaryString.charCodeAt(i));
            }
            
            const blob = new Blob([new Uint8Array(array)], { type: mime });
            
            // Create a FormData object
            const formData = new FormData();
            formData.append('file', blob, 'screenshot.png');
            
            // Show uploading message
            loadingIndicator.textContent = 'Uploading image to Kagi...';
            
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
                // Remove loading indicator
                document.body.removeChild(loadingIndicator);
                
                // Re-enable the search button
                searchButton.disabled = false;
                
                if (response.ok) {
                    // If successful, the response will be a redirect to the search results
                    // We can follow the redirect by opening the response URL
                    window.location.href = response.url;
                } else {
                    throw new Error(`Upload failed with status ${response.status}`);
                }
            })
            .catch(error => {
                console.error('Upload error:', error);
                
                // Remove loading indicator
                if (document.body.contains(loadingIndicator)) {
                    document.body.removeChild(loadingIndicator);
                }
                
                // Re-enable the search button
                searchButton.disabled = false;
                
                // Create a download link for the image
                const downloadLink = document.createElement('a');
                downloadLink.href = imageData;
                downloadLink.download = 'screenshot.png';
                downloadLink.textContent = 'Download Image';
                downloadLink.className = 'button';
                
                // Create a button to open Kagi's reverse image search page
                const openKagiButton = document.createElement('button');
                openKagiButton.textContent = 'Open Kagi Reverse Image Search';
                openKagiButton.className = 'button';
                openKagiButton.addEventListener('click', function() {
                    window.open('https://kagi.com/reverse', '_blank');
                });
                
                // Add instructions for manual upload
                const instructions = document.createElement('div');
                instructions.innerHTML = `
                    <h2>Upload Error</h2>
                    <p>There was an error uploading the image to Kagi: ${error.message}</p>
                    <p>Please download the image and upload it manually:</p>
                `;
                
                // Replace the search button with these new elements
                const buttonContainer = document.querySelector('div:last-of-type');
                buttonContainer.innerHTML = '';
                buttonContainer.appendChild(instructions);
                buttonContainer.appendChild(downloadLink);
                buttonContainer.appendChild(document.createElement('br'));
                buttonContainer.appendChild(document.createElement('br'));
                buttonContainer.appendChild(openKagiButton);
            });
        });
    } else {
        loadingElement.textContent = 'Error: Image not found';
    }
});
