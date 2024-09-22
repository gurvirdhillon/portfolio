async function handleAdminAccess() {
    // Check if the user is already authenticated in this session
    if (localStorage.getItem('isAuthenticated') === 'true') {
        console.log('User is already authenticated.');
        return; // If authenticated, don't ask for the password again
    }

    const userPassword = prompt("Enter the admin password:");

    try {
        const response = await fetch('http://localhost:8080/check-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ password: userPassword })
        });

        const result = await response.json();
        console.log("Server response:", result);

        if (result.success) {
            // Store authentication status in localStorage to avoid re-prompting
            localStorage.setItem('isAuthenticated', 'true');
            window.location.href = "admin.html";
        } else {
            window.location.href = "index.html";
        }
    } catch (error) {
        console.error('Error:', error);
        alert("An error occurred while trying to verify the password.");
    }
}

// Only run the password check if trying to access admin.html
if (window.location.pathname.includes('admin.html')) {
    window.addEventListener('load', handleAdminAccess);
}

