document.querySelector('#app').innerHTML = `
  <textarea></textarea>
`;

const SERVER_URL = 'http://localhost:3000';

const fetchApiKey = () => {
  return fetch(`${SERVER_URL}/tinymce_api_key`)
    .then(response => response.json())
    .then(data => data.apiKey)
    .catch(error => {
      console.error('Failed to fetch API key:', error);
      throw error;
    });
};

const aiRequest = (request, respondWith) => {
  respondWith.string((signal) =>
    fetch(`${SERVER_URL}/ai_request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    })
      .then(response => {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error('Failed to communicate with the Amazon Bedrock API');
        }
      })
      .then(data => {
        if (data.error) {
          throw new Error(`${data.error.type}: ${data.error.message}`);
        } else {
          return data;
        }
      })
  );
};

fetchApiKey()
  .then(apiKey => {
    const script = document.createElement('script');
    script.src = `https://cdn.tiny.cloud/1/${apiKey}/tinymce/7/tinymce.min.js`;
    script.referrerPolicy = 'origin';
    document.head.appendChild(script);

    return new Promise(resolve => {
      script.onload = resolve;
    });
  })
  .then(() => {
    tinymce.init({
      selector: 'textarea',
      license_key: 'gpl',
      plugins: 'ai code help',
      toolbar: 'aidialog aishortcuts code',
      ai_request: aiRequest
    });
  });