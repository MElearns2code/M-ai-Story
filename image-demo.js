const labRoot = document.querySelector('[data-image-lab]');

if (labRoot) {
  const form = labRoot.querySelector('.image-lab-form');
  const promptField = labRoot.querySelector('#image-prompt');
  const preview = labRoot.querySelector('[data-image-lab-preview]');
  const messageEl = labRoot.querySelector('[data-image-lab-message]');
  const randomBtn = labRoot.querySelector('[data-image-lab-random]');
  const submitBtn = form?.querySelector('button[type="submit"]');
  const defaultEndpoint = labRoot.dataset.api || '/api/generate-image';
  const fallbackEndpoint = labRoot.dataset.apiFallback || 'http://127.0.0.1:4000/api/generate-image';
  let activeEndpoint = defaultEndpoint;

  const samplePrompts = [
    'Maya and her grandpa reading under a glowing blanket fort filled with fireflies',
    'Jonah and his puppy sailing a paper boat across a moonlit pond',
    'Sasha and twin kittens camping beside a softly sparkling waterfall',
    'Mateo and his sister floating with lanterns above a calm forest village',
    'A bedtime tea party with Ava, her teddy bear, and friendly shooting stars'
  ];

  const setMessage = (text, tone = 'info') => {
    if (!messageEl) {
      return;
    }
    messageEl.textContent = text;
    messageEl.dataset.tone = tone;
    messageEl.hidden = !text;
  };

  const renderPlaceholder = () => {
    if (!preview) {
      return;
    }
    preview.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'image-lab-placeholder';
    const text = document.createElement('p');
    text.textContent = 'Ready when you are—your artwork will display here.';
    wrapper.appendChild(text);
    preview.appendChild(wrapper);
  };

  const renderLoading = () => {
    if (!preview) {
      return;
    }
    preview.innerHTML = '';
    const loader = document.createElement('div');
    loader.className = 'image-lab-loading';

    const spinner = document.createElement('div');
    spinner.className = 'image-lab-spinner';
    loader.appendChild(spinner);

    const text = document.createElement('p');
    text.textContent = 'Painting your scene…';
    loader.appendChild(text);

    preview.appendChild(loader);
  };

  const renderImage = (dataUrl, captionText) => {
    if (!preview) {
      return;
    }
    preview.innerHTML = '';

    const figure = document.createElement('figure');
    figure.className = 'image-lab-figure';

    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = `Gemini illustration for prompt: ${captionText}`;

    const caption = document.createElement('figcaption');
    caption.textContent = captionText;

    figure.appendChild(img);
    figure.appendChild(caption);
    preview.appendChild(figure);
  };

  const setLoading = (isLoading) => {
    if (submitBtn) {
      submitBtn.disabled = isLoading;
    }
    if (randomBtn) {
      randomBtn.disabled = isLoading;
    }
    if (isLoading) {
      renderLoading();
      setMessage('Creating your illustration with Nano Banana…', 'info');
    } else {
      if (submitBtn) {
        submitBtn.disabled = false;
      }
      if (randomBtn) {
        randomBtn.disabled = false;
      }
    }
  };

  const chooseRandomPrompt = () => {
    const selection = samplePrompts[Math.floor(Math.random() * samplePrompts.length)];
    if (promptField) {
      promptField.value = selection;
      promptField.focus();
    }
    setMessage('Prompt updated. Tap “Create illustration” to generate.', 'info');
  };

  renderPlaceholder();

  if (randomBtn) {
    randomBtn.addEventListener('click', (event) => {
      event.preventDefault();
      if (randomBtn.disabled) {
        return;
      }
      chooseRandomPrompt();
    });
  }

  const parseJsonResponse = async (response) => {
    const contentType = response.headers.get('content-type') || '';
    const looksJson = contentType.includes('application/json');
    const payload = looksJson ? await response.json() : await response.text();
    return { payload, looksJson };
  };

  const requestImage = async (endpoint, prompt) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt })
    });

    const { payload, looksJson } = await parseJsonResponse(response);

    if (!response.ok) {
      const detail = looksJson && payload?.error ? String(payload.error) : `Request failed (${response.status})`;
      const error = new Error(detail);
      error.status = response.status;
      error.endpoint = endpoint;
      error.payload = payload;
      throw error;
    }

    if (!looksJson) {
      const error = new Error('Unexpected response from the image service.');
      error.endpoint = endpoint;
      error.payload = payload;
      throw error;
    }

    return payload;
  };

  const requestWithFallback = async (prompt) => {
    const endpoints = [activeEndpoint];

    if (!endpoints.includes(defaultEndpoint)) {
      endpoints.push(defaultEndpoint);
    }

    if (fallbackEndpoint && !endpoints.includes(fallbackEndpoint)) {
      endpoints.push(fallbackEndpoint);
    }

    let lastError;

    for (const endpoint of endpoints) {
      try {
        const payload = await requestImage(endpoint, prompt);
        activeEndpoint = endpoint;
        return payload;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Image service unavailable.');
  };

  if (form && promptField) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const prompt = promptField.value.trim();
      if (prompt.length < 10) {
        setMessage('Please describe your scene with at least a few words.', 'warn');
        return;
      }

      setLoading(true);

      try {
        const payload = await requestWithFallback(prompt);

        const { imageBase64, mimeType } = payload;
        if (!imageBase64) {
          setMessage('No illustration was returned. Please try another prompt.', 'warn');
          renderPlaceholder();
          return;
        }

        const safeMime = typeof mimeType === 'string' && mimeType.startsWith('image/') ? mimeType : 'image/png';
        const dataUrl = `data:${safeMime};base64,${imageBase64}`;
        renderImage(dataUrl, prompt);
        setMessage('Illustration ready! Save the image or try another idea.', 'success');
      } catch (error) {
        console.error('Image generation request failed', error);
        if (error?.status === 404) {
          setMessage('Image service not found. Make sure the Gemini proxy server is running (node server.js).', 'error');
        } else if (error?.status === 401 || error?.status === 403) {
          setMessage('Authentication failed. Confirm the API key in your server configuration.', 'error');
        } else {
          const detail = error?.message || 'Something went wrong while reaching the image service.';
          setMessage(detail, 'error');
        }
        renderPlaceholder();
      } finally {
        setLoading(false);
      }
    });
  }
}
