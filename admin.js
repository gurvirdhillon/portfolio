async function handleAdminAccess() {
    const userPassword = prompt("Enter the admin password:");
    if (userPassword === null) {
        return;
    }

    try {
        const response = await fetch('/check-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify({ password: userPassword })
        });

        const result = await response.json();
        console.log("Server response:", result);

        if (result.success) {
            localStorage.setItem('isAuthenticated', 'true');
            window.location.href = "admin.html";
        } else {
            alert("Access Denied");
            window.location.href = "index.html";
        }

        const result = await response.json().catch(() => ({}));
        alert(result.message || 'Access denied');
    } catch (error) {
        console.error('Admin login failed:', error);
        alert('Unable to sign in. Please try again.');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const getButton = document.querySelector('#admin-rights');
    if (!getButton) {
        return;
    }

    getButton.addEventListener('click', handleAdminAccess);
});
