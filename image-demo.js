const labRoot = document.querySelector('[data-image-lab]');

if (labRoot) {
  const form = labRoot.querySelector('.image-lab-form');
  const promptField = labRoot.querySelector('#image-prompt');
  const preview = labRoot.querySelector('[data-image-lab-preview]');
  const messageEl = labRoot.querySelector('[data-image-lab-message]');
  const randomBtn = labRoot.querySelector('[data-image-lab-random]');
  const submitBtn = form?.querySelector('button[type="submit"]');

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
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ prompt })
        });

        const payload = await response.json();

        if (!response.ok) {
          const detail = payload?.error || 'Unable to generate an image right now.';
          setMessage(detail, 'error');
          renderPlaceholder();
          return;
        }

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
        setMessage('Something went wrong while reaching the image service.', 'error');
        renderPlaceholder();
      } finally {
        setLoading(false);
      }
    });
  }
}
