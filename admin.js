async function handleAdminAccess() {
    const userPassword = prompt("Enter the admin password:");

    try {
        const response = await fetch('http://localhost:8080/check-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: userPassword })  // Correct JSON format
        });

        const result = await response.json();
        console.log("Server response:", result); // Debugging to see the server's response

        if (result.success) {
            window.location.href = "admin.html";
        } else {
            alert("Access Denied");
        }
    } catch (error) {
        console.error('Error:', error);
        alert("An error occurred while trying to verify the password.");
    }
}

// Wait for the DOM to fully load before attaching the event listener
document.addEventListener('DOMContentLoaded', function () {
    const getButton = document.querySelector('#admin-rights');
    getButton.addEventListener('click', handleAdminAccess);
});

