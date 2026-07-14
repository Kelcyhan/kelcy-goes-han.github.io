(() => {
  const STYLE_ID = 'kelcy-project-back-style';
  const BACK_SELECTOR = '#back-link, #bottom-back, [data-project-back]';
  const DIRECT_RETURN_DELAY = 170;
  // Do not navigate on pointerdown/touchstart. Removing the route layer before
  // the matching click is dispatched lets that click fall through to the
  // portfolio canvas (and can immediately open another project or blank it).
  const ACTIVATION_EVENTS = ['click', 'keydown'];
  let lastActivation = 0;

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body {
        transition: opacity .22s ease, transform .22s ease;
      }
      html {
        overflow-y: auto;
        overscroll-behavior-y: auto;
      }
      body {
        overflow-y: auto;
      }
      html:has(body.is-loading),
      body.is-loading {
        overflow: hidden !important;
        overscroll-behavior: none !important;
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
        position: fixed !important;
        inset: max(14px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) auto max(14px, env(safe-area-inset-left)) !important;
        display: flex !important;
        align-items: flex-start !important;
        justify-content: space-between !important;
        gap: 12px !important;
        z-index: 100000 !important;
        pointer-events: none !important;
      }
      .top-bar > * {
        pointer-events: auto;
      }
      .top-bar .proj-id {
        margin-left: auto !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-height: 42px !important;
        max-width: min(52vw, 240px) !important;
        padding: 0 14px !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        border-radius: 999px !important;
      }
      .top-bar .top-links {
        position: fixed !important;
        top: max(64px, calc(env(safe-area-inset-top) + 58px)) !important;
        right: max(14px, env(safe-area-inset-right)) !important;
      }
      #loading-screen {
        pointer-events: none !important;
      }
      #loading-screen.gone {
        pointer-events: none !important;
      }
      html.is-route-frame #back-link,
      html.is-route-frame #bottom-back,
      html.is-route-frame [data-project-back] {
        display: none !important;
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
        .top-bar .proj-tag,
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

  if (isInIframe()) {
    document.documentElement.classList.add('is-route-frame');
  }

  function setImportant(element, property, value) {
    if (!element) return;
    element.style.setProperty(property, value, 'important');
  }

  function normalizeTopBar() {
    const topBar = document.querySelector('.top-bar, .ov-topleft');
    const back = document.querySelector('#back-link');
    const title = document.querySelector('.top-bar .proj-id, .ov-topleft .proj-id');

    if (topBar) {
      setImportant(topBar, 'position', 'fixed');
      setImportant(topBar, 'top', 'max(14px, env(safe-area-inset-top))');
      setImportant(topBar, 'right', 'max(14px, env(safe-area-inset-right))');
      setImportant(topBar, 'bottom', 'auto');
      setImportant(topBar, 'left', 'max(14px, env(safe-area-inset-left))');
      setImportant(topBar, 'display', 'flex');
      setImportant(topBar, 'align-items', 'flex-start');
      setImportant(topBar, 'justify-content', 'space-between');
      setImportant(topBar, 'gap', '12px');
      setImportant(topBar, 'padding', '0');
      setImportant(topBar, 'pointer-events', 'none');
      setImportant(topBar, 'z-index', '100000');
    }

    if (back) {
      setImportant(back, 'min-width', '72px');
      setImportant(back, 'min-height', '42px');
      setImportant(back, 'display', isInIframe() ? 'none' : 'inline-flex');
      setImportant(back, 'align-items', 'center');
      setImportant(back, 'justify-content', 'center');
      setImportant(back, 'padding', '0 14px');
      setImportant(back, 'pointer-events', 'auto');
      setImportant(back, 'z-index', '100001');
    }

    if (title) {
      setImportant(title, 'display', 'inline-flex');
      setImportant(title, 'align-items', 'center');
      setImportant(title, 'justify-content', 'center');
      setImportant(title, 'margin-left', 'auto');
      setImportant(title, 'min-height', '42px');
      setImportant(title, 'max-width', 'min(52vw, 240px)');
      setImportant(title, 'padding', '0 14px');
      setImportant(title, 'overflow', 'hidden');
      setImportant(title, 'text-overflow', 'ellipsis');
      setImportant(title, 'white-space', 'nowrap');
      setImportant(title, 'pointer-events', 'auto');
      setImportant(title, 'z-index', '100000');
    }
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

  normalizeTopBar();
  window.addEventListener('load', normalizeTopBar, { once: true });
  window.addEventListener('resize', normalizeTopBar, { passive: true });

  // Some case studies use Lenis/Three.js. If either optional module fails to
  // load, native document scrolling must still remain available.
  function ensureScrollable() {
    if (document.body.classList.contains('is-loading')) return;
    if (document.documentElement.scrollHeight > window.innerHeight + 1) {
      document.documentElement.style.setProperty('overflow-y', 'auto', 'important');
      document.body.style.setProperty('overflow-y', 'auto', 'important');
    }
  }
  window.addEventListener('load', ensureScrollable, { once: true });
  window.addEventListener('resize', ensureScrollable, { passive: true });
})();
