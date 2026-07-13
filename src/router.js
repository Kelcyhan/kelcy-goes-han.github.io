import { ROUTE_PATHS } from './routes.js';

const BLANK_ROUTE = '__blank__';

export function createPortfolioRouter({
  routeShell,
  routeIframe,
  routeBackButton,
  setRoomInstant,
  unloadDelay = 560,
}) {
  const siteRoot = new URL('.', document.baseURI).href;
  const knownRoutes = new Set(ROUTE_PATHS);
  let routeUnloadTimer = 0;
  let lastBackActivation = 0;

  function rootPath(search = '') {
    const url = new URL(search || '.', siteRoot);
    return url.pathname + url.search + url.hash;
  }

  function normalizeRoute(path) {
    const normalized = String(path || '').replace(/^\/+/, '').replace(/\/?$/, '/');
    return knownRoutes.has(normalized) ? normalized : '';
  }

  function resolveRoute(path) {
    return new URL(path, siteRoot).href;
  }

  function markIframeReady(path) {
    routeShell.classList.remove('iframe-ready');
    const desiredUrl = resolveRoute(path);
    const onReady = () => {
      if (routeIframe.dataset.path === path) {
        routeShell.classList.add('iframe-ready');
      }
    };

    routeIframe.addEventListener('load', onReady, { once: true });
    try {
      if (
        routeIframe.src === desiredUrl &&
        routeIframe.contentDocument &&
        routeIframe.contentDocument.readyState === 'complete'
      ) {
        onReady();
      }
    } catch (error) {}
  }

  function openInternal(path) {
    const route = normalizeRoute(path);
    if (!route) return;

    window.clearTimeout(routeUnloadTimer);
    setRoomInstant(2);

    if (routeIframe.dataset.path !== route) {
      routeIframe.dataset.path = route;
      markIframeReady(route);
      routeIframe.src = resolveRoute(route);
    } else {
      try {
        if (routeIframe.contentDocument && routeIframe.contentDocument.readyState === 'complete') {
          routeShell.classList.add('iframe-ready');
        } else {
          markIframeReady(route);
        }
      } catch (error) {
        markIframeReady(route);
      }
    }

    routeShell.classList.add('active');
    routeShell.setAttribute('aria-hidden', 'false');
    document.body.classList.add('route-open');
  }

  function closeInternal() {
    setRoomInstant(2);
    routeShell.classList.remove('active');
    routeShell.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('route-open');

    window.clearTimeout(routeUnloadTimer);
    routeUnloadTimer = window.setTimeout(() => {
      if (!routeShell.classList.contains('active')) {
        routeShell.classList.remove('iframe-ready');
        routeIframe.dataset.path = BLANK_ROUTE;
        routeIframe.removeAttribute('src');
      }
    }, unloadDelay);
  }

  function open(path) {
    const route = normalizeRoute(path);
    if (!route) return;

    try {
      history.pushState({ route, room: 2 }, '', rootPath(route));
    } catch (error) {
      console.warn('[router] pushState failed; opening without URL rewrite:', error);
    }
    openInternal(route);
  }

  function close({ replace = false } = {}) {
    const method = replace ? 'replaceState' : 'pushState';
    try {
      history[method]({ room: 2 }, '', rootPath('?room=2'));
    } catch (error) {
      console.warn('[router] history update failed while closing route:', error);
    }
    closeInternal();
  }

  function preloadBlank() {
    if (!routeIframe.dataset.path) {
      routeIframe.dataset.path = BLANK_ROUTE;
      routeIframe.src = 'about:blank';
    }
  }

  function handleBackActivation(event) {
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();

    const now = performance.now();
    if (now - lastBackActivation < 320) return;
    lastBackActivation = now;
    close({ replace: true });
  }

  function syncInitialUrl() {
    const hashMatch = location.hash.match(/^#\/(.+?)\/?$/);
    if (hashMatch) {
      const route = normalizeRoute(hashMatch[1]);
      if (route) {
        setRoomInstant(2);
        history.replaceState({ route, room: 2 }, '', rootPath(route));
        openInternal(route);
      }
    }

    try {
      const params = new URLSearchParams(location.search);
      const room = parseInt(params.get('room') || '0', 10);
      if (room >= 1 && room <= 3) {
        setRoomInstant(room);
        history.replaceState({ room }, '', rootPath('?room=' + room));
      }
    } catch (error) {}
  }

  function start() {
    preloadBlank();
    routeBackButton?.addEventListener('click', handleBackActivation);
    routeBackButton?.addEventListener('keydown', handleBackActivation);

    window.addEventListener('popstate', (event) => {
      if (event.state && event.state.route) openInternal(event.state.route);
      else if (event.state && event.state.room) {
        setRoomInstant(event.state.room);
        closeInternal();
      } else {
        closeInternal();
      }
    });

    window.addEventListener('message', (event) => {
      if (!event.data) return;
      if (event.data.type === 'close-route') close({ replace: true });
      else if (event.data.type === 'route-ready') routeShell.classList.add('iframe-ready');
    });

    syncInitialUrl();
  }

  return {
    start,
    open,
    close,
    isKnownRoute: (path) => Boolean(normalizeRoute(path)),
    rootPath,
    resolveRoute,
  };
}
