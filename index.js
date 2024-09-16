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

// when clicking the mockingbird icon it alerts the user the link is coming soon.

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


document.addEventListener('DOMContentLoaded', () => {
  // Array of file paths
  const filePaths = [
    'updates/07-09-24.txt',
    'updates/10-09-24.txt',
    'updates/16-09-24.txt'
  ];

  const preElement = document.querySelector('.content');

  // Function to fetch and display content from a file
  const fetchAndDisplayContent = (filePath) => {
    return fetch(filePath)
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.text();
      })
      .then(text => {
        const posts = text.split('\n\n');

        posts.forEach((post, index) => {
          const postElement = document.createElement('div');
          postElement.id = `post-${Date.now()}-${index + 1}`;
          postElement.textContent = post;
          postElement.classList.add('nodeContent');
          preElement.appendChild(postElement);
        });
      })
      .catch(error => {
        console.error('There was a problem with the fetch operation:', error);
      });
  };

  // Fetch content from all files
  filePaths.forEach(filePath => fetchAndDisplayContent(filePath));
});
