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

document.addEventListener('DOMContentLoaded', function () {
  const getBirdie = document.querySelector('#birdLogo');
  getBirdie.addEventListener('click', () => {
    const modal = document.getElementById('myModal');
    const span = document.getElementsByClassName('close')[0];

    modal.style.display = 'block';

    span.onclick = function() {
      modal.style.display = 'none';
    };

    window.onclick = function(event) {
      if (event.target == modal) {
        modal.style.display = 'none';
      }
    };
  });
});
