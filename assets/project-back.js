(() => {
  const STYLE_ID = 'kelcy-project-back-style';
  const BACK_SELECTOR = '#back-link, #bottom-back, [data-project-back]';
  const DIRECT_RETURN_DELAY = 170;
  let lastActivation = 0;

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body {
        transition: opacity .22s ease, transform .22s ease;
      }
      body.is-returning {
        opacity: 0;
        transform: translateY(8px) scale(.992);
      }
      ${BACK_SELECTOR} {
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }
      #back-link {
        position: relative;
      }
      #back-link::before {
        content: "";
        position: absolute;
        inset: -18px -24px;
        border-radius: 999px;
      }
    `;
    document.head.appendChild(style);
  }

  function isInIframe() {
    return window.top !== window.self;
  }

  function galleryUrl() {
    return new URL('../?room=2', window.location.href).href;
  }

  function closeParentRoute() {
    try {
      if (typeof window.parent.closeRoute === 'function') {
        window.parent.closeRoute({ replace: true });
        return;
      }
    } catch (error) {}
    window.parent.postMessage({ type: 'close-route' }, '*');
  }

  function activate(event) {
    const trigger = event.target?.closest?.(BACK_SELECTOR);
    if (!trigger) return;
    if (event.type === 'click' && trigger.dataset.projectBackPointerHandled === '1') {
      trigger.dataset.projectBackPointerHandled = '0';
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const now = performance.now();
    if (now - lastActivation < 280) return;
    lastActivation = now;

    if (event.type === 'pointerup') trigger.dataset.projectBackPointerHandled = '1';
    document.body.classList.add('is-returning');

    if (isInIframe()) {
      window.setTimeout(closeParentRoute, 35);
    } else {
      window.setTimeout(() => window.location.assign(galleryUrl()), DIRECT_RETURN_DELAY);
    }
  }

  document.addEventListener('pointerup', activate, true);
  document.addEventListener('click', activate, true);
})();
