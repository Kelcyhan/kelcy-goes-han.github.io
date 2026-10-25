(() => {
  const readings = {
    purple: { title: '01. Purple / cool & playful', mood: 'Cool & playful', copy: 'Violet and blue create a cooler reading of the same scene. The pale background separates the dark ball and plate, while several mid-tone objects sit close together.' },
    pink: { title: '02. Pink / lively & sweet', mood: 'Lively & sweet', copy: 'Coral, pink and red bring the cakes forward. The red plate and ball create two strong anchors, while the lighter figure and background have a softer separation.' },
    green: { title: '03. Green / bright & energetic', mood: 'Bright & energetic', copy: 'The vivid shirt and citrus cup pull attention in different directions. The green range feels active, but those competing accents would need care around a headline.' },
    yellow: { title: '04. Yellow / warm & relaxed', mood: 'Warm & relaxed', copy: 'Golden tones connect the coffee and cakes with the leisure scene. The lighter figure blends into the background, so the new layout places its text outside the illustration.' },
  };
  const colourImage = document.querySelector('#colour-image');
  const colourEnlarge = document.querySelector('#colour-enlarge');
  document.querySelectorAll('[data-colour]').forEach((button) => {
    button.addEventListener('click', () => {
      const colour = button.dataset.colour;
      const reading = readings[colour];
      document.querySelectorAll('[data-colour]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      colourImage.src = `assets/colour-${colour}.png`;
      colourImage.alt = `${colour[0].toUpperCase() + colour.slice(1)} colour variation with a pool player, bowling pins, coffee and cakes.`;
      colourEnlarge.dataset.view = colourImage.getAttribute('src');
      colourEnlarge.dataset.caption = `${reading.title} · Original exercise`;
      document.querySelector('#colour-caption').textContent = reading.title;
      document.querySelector('#colour-mood').textContent = reading.mood;
      document.querySelector('#colour-description').textContent = reading.copy;
    });
  });

  const viewer = document.querySelector('#image-viewer');
  const viewerImage = document.querySelector('#viewer-image');
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      viewerImage.src = button.dataset.view;
      viewerImage.alt = button.querySelector('img').alt;
      viewerImage.classList.toggle('mirrored', button.dataset.mirror === 'true');
      document.querySelector('#viewer-caption').textContent = button.dataset.caption;
      document.querySelector('#viewer-download').href = button.dataset.view;
      viewer.showModal();
    });
  });
  document.querySelector('#viewer-close').addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', (event) => {
    if (event.target !== viewer) return;
    const bounds = viewer.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) viewer.close();
  });
  // Let Escape close the native dialog before the shared page bridge handles it.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && viewer.open) event.stopImmediatePropagation();
  }, true);
})();
