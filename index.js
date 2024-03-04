// allows the phone number to be called when the picture icon is clicked
document.addEventListener('DOMContentLoaded', function () {
  const telephoneLink = document.getElementById('telephone_link');
  const telephonePic = document.getElementById('telephone_pic');
  const phoneNumber = '+44 7908632941';

  telephonePic.addEventListener('click', function (event) {
    event.preventDefault();
    telephoneLink.href = 'tel:' + phoneNumber;
  });
});
