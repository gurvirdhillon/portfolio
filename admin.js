async function handleAdminAccess() {
    const userPassword = prompt('Enter the admin password:');

    if (userPassword === null) {
        return;
    }

    try {
        const response = await fetch('/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify({ password: userPassword })
        });

        if (response.ok) {
            window.location.assign('/admin');
            return;
        }

        const result = await response.json().catch(() => ({}));
        alert(result.message || 'Access denied');
    } catch (error) {
        console.error('Admin login failed:', error);
        alert('Unable to sign in. Please try again.');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const button = document.querySelector('#admin-rights');

    if (button) {
        button.addEventListener('click', handleAdminAccess);
    }
});
