// allows the phone number to be called when the picture icon is clicked
document.addEventListener("DOMContentLoaded", function() {
    const telephoneLink = document.getElementById("telephone_link");
    const telephonePic = document.getElementById("telephone_pic");
    const phoneNumber = "+44 7908632941";

    telephonePic.addEventListener("click", function(event) {
        event.preventDefault();
        telephoneLink.href = "tel:" + phoneNumber;
    });
});

// once the form is filled it will send the email to my inbox with the "Query"

function retrieveMsg() {
    const firstName = document.querySelector('#formFirstName');
    const secondName = document.querySelector('#formSecondName');
    const email = document.querySelector('#emailInput');
    const query = document.querySelector('#queryMsg');
}

const sendBtn = document.querySelector('#submitBtn');
sendBtn.addEventListener('click', (event) => {
    event.preventDefault();
    alert("button has been clicked");
})
