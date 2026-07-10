(() => {
  const STYLE_ID = 'kelcy-project-back-style';
  const BACK_SELECTOR = '#back-link, #bottom-back, [data-project-back]';
  const DIRECT_RETURN_DELAY = 170;
  const ACTIVATION_EVENTS = ['pointerdown', 'touchstart', 'click', 'keydown'];
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
        z-index: 100001 !important;
      }
      .top-bar {
        z-index: 100000 !important;
      }
      #loading-screen {
        pointer-events: none !important;
      }
      #back-link::before {
        content: "";
        position: absolute;
        inset: -18px -24px;
        border-radius: 999px;
      }
      @media (max-width: 768px) {
        #back-link {
          min-width: 72px !important;
          min-height: 42px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 0 14px !important;
          border-radius: 999px !important;
          font-size: 12px !important;
          line-height: 1 !important;
          z-index: 20;
        }
        #back-link::before {
          inset: -12px -16px;
        }
        .top-bar a,
        .top-bar .back,
        .top-bar .proj-id,
        .top-links,
        #back-link {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
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
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;

    const now = performance.now();
    if (now - lastActivation < 280) return;
    lastActivation = now;

    document.body.classList.add('is-returning');
    if (trigger.tagName === 'A') trigger.href = galleryUrl();

    if (isInIframe()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.setTimeout(closeParentRoute, 35);
      return;
    }

    if (event.type === 'keydown') {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.setTimeout(() => window.location.assign(galleryUrl()), DIRECT_RETURN_DELAY);
    }
  }

  for (const eventName of ACTIVATION_EVENTS) {
    document.addEventListener(eventName, activate, true);
  }
})();
