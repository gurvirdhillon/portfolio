document.addEventListener("DOMContentLoaded", function() {
    const telephoneLink = document.getElementById("telephone_link");
    const telephonePic = document.getElementById("telephone_pic");
    const phoneNumber = "+44 7908632941";

    telephonePic.addEventListener("click", function(event) {
        event.preventDefault();
        telephoneLink.href = "tel:" + phoneNumber;
    });
});

// document.addEventListener("DOMContentLoaded", function() {
//     const emailLink = document.getElementById("");
//     const emailPic = document.getElementById("");
//     const email = "gurvirsinghdhillon@outlook.com";

//     emailPic.addEventListener("click", function(event) {
//         event.preventDefault();
//         emailLink.href = "tel:" + phoneNumber;
//     });
// });