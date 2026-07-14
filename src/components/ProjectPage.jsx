import { useEffect, useRef, useState } from 'react';
import { nextProject } from '../data/projects.js';
import TransitionLink from './TransitionLink.jsx';

function LazyVideo({ media }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [active, setActive] = useState(false);
  const hasControls = Boolean(media.controls);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    if (!('IntersectionObserver' in window)) {
      setActive(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setActive(true);
        observer.disconnect();
      }
    }, { rootMargin: '320px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || !active || hasControls) return;
    node.play().catch(() => { /* muted autoplay can still be deferred by the browser */ });
  }, [active, hasControls]);

  return (
    <figure ref={containerRef} className="media-item media-video">
      <video
        ref={videoRef}
        src={active ? media.src : undefined}
        poster={media.poster}
        preload={active ? 'metadata' : 'none'}
        muted={!hasControls}
        loop={!hasControls}
        controls={hasControls}
        autoPlay={!hasControls}
        playsInline
        aria-label={media.label}
      />
      <figcaption>{media.label}</figcaption>
    </figure>
  );
}

function PuriFlow({ media }) {
  const [screen, setScreen] = useState('home');
  const [selectedId, setSelectedId] = useState(media.resources[0].id);
  const [records, setRecords] = useState([]);
  const selected = media.resources.find((resource) => resource.id === selectedId) || media.resources[0];

  function openResource(id) {
    setSelectedId(id);
    setScreen('detail');
  }

  function borrow() {
    setRecords((current) => [
      { id: `${selected.id}-${Date.now()}`, title: selected.title, state: 'Returned' },
      ...current,
    ].slice(0, 4));
    setScreen('success');
  }

  return (
    <section className="puri-flow" aria-label={media.title}>
      <div className="puri-flow-notes">
        <span>Native React prototype</span>
        <b>Verified resource flow</b>
        <p>No nested page, no missing module artwork, and every state is reversible.</p>
      </div>
      <div className="puri-phone">
        <div className="puri-phone-bar">
          <button type="button" onClick={() => setScreen('home')} disabled={screen === 'home'} aria-label="Return to Puri home">←</button>
          <b>{screen === 'records' ? 'My records' : screen === 'success' ? 'Complete' : screen === 'detail' ? selected.title : 'Puri!'}</b>
          <button type="button" onClick={() => setScreen('records')} aria-label="Open borrowing records">◎</button>
        </div>

        {screen === 'home' && (
          <div className="puri-phone-screen puri-home-screen">
            <p className="eyebrow">Neighborhood station</p>
            <h3>Choose a resource.</h3>
            <div className="puri-resource-grid">
              {media.resources.map((resource) => (
                <button
                  key={resource.id}
                  type="button"
                  style={{ '--resource-accent': resource.accent }}
                  onClick={() => openResource(resource.id)}
                >
                  <img src={resource.image} alt="" />
                  <span><b>{resource.title}</b><small>Available now</small></span>
                </button>
              ))}
              <button type="button" className="is-disabled" disabled><span><b>Greywater Filter</b><small>Artwork under review</small></span></button>
              <button type="button" className="is-disabled" disabled><span><b>Compost Soil</b><small>Artwork under review</small></span></button>
            </div>
          </div>
        )}

        {screen === 'detail' && (
          <div className="puri-phone-screen puri-detail-screen" style={{ '--resource-accent': selected.accent }}>
            <img src={selected.image} alt={`${selected.title} module`} />
            <p className="eyebrow">Available · Station 01</p>
            <h3>{selected.title}</h3>
            <p>{selected.description}</p>
            <button type="button" className="puri-primary" onClick={borrow}>{selected.action}</button>
          </div>
        )}

        {screen === 'success' && (
          <div className="puri-phone-screen puri-success-screen">
            <span aria-hidden="true">✓</span>
            <p className="eyebrow">Transaction complete</p>
            <h3>Item returned.</h3>
            <p>The station record is updated and ready for the next neighbor.</p>
            <button type="button" className="puri-primary" onClick={() => setScreen('home')}>Continue borrowing</button>
            <button type="button" className="puri-secondary" onClick={() => setScreen('records')}>View my records</button>
          </div>
        )}

        {screen === 'records' && (
          <div className="puri-phone-screen puri-records-screen">
            <p className="eyebrow">Borrowing history</p>
            <h3>My records</h3>
            {records.length ? records.map((record) => (
              <div className="puri-record" key={record.id}><span>{record.title}</span><b>{record.state}</b></div>
            )) : <p className="puri-empty">Complete a borrowing flow to create the first record.</p>}
            <button type="button" className="puri-secondary" onClick={() => setScreen('home')}>Back to resources</button>
          </div>
        )}
      </div>
    </section>
  );
}

function ImageLightbox({ media, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.classList.add('lightbox-open');
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('lightbox-open');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={media.alt} onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="image-lightbox-toolbar">
        <p>{media.alt}</p>
        <div>
          <a href={media.src} target="_blank" rel="noreferrer">Open original ↗</a>
          <button type="button" onClick={onClose} autoFocus>Close ×</button>
        </div>
      </div>
      <img src={media.src} alt={media.alt} />
    </div>
  );
}

function InteractiveDemo({ media }) {
  const frameRef = useRef(null);
  const timeoutRef = useRef(0);
  const [started, setStarted] = useState(Boolean(media.eager));
  const [stage, setStage] = useState(media.eager ? 'loading' : 'idle');

  useEffect(() => {
    if (!started) return undefined;
    setStage('loading');
    let cancelled = false;
    fetch(media.src, { method: 'HEAD' })
      .then((response) => {
        if (!cancelled && !response.ok) setStage('error');
      })
      .catch(() => {
        if (!cancelled) setStage('error');
      });

    timeoutRef.current = window.setTimeout(() => {
      if (!cancelled) setStage((value) => (value === 'ready' ? value : 'error'));
    }, 14000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutRef.current);
    };
  }, [media.src, started]);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      if (
        event.data?.source === 'kelcy-demo'
        && event.data?.version === 1
        && event.data?.demo === media.demoId
        && event.data?.type === 'ready'
      ) {
        window.clearTimeout(timeoutRef.current);
        setStage('ready');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  function start() {
    setStarted(true);
    setStage('loading');
  }

  function onLoad() {
    if (media.demoId) return;
    window.setTimeout(() => {
      window.clearTimeout(timeoutRef.current);
      setStage('ready');
    }, 500);
  }

  return (
    <div className={`demo-card is-${stage}`} style={{ '--demo-height': `${media.height || 720}px` }}>
      <div className="demo-toolbar">
        <div>
          <span className="demo-status-dot" aria-hidden="true" />
          <b>{media.title}</b>
        </div>
        <a href={media.src} target="_blank" rel="noreferrer">Open in a new tab ↗</a>
      </div>

      {!started ? (
        <div className="demo-launch">
          <p>{media.description}</p>
          <button type="button" onClick={start}>Launch interactive demo</button>
          <small>The demo loads only when requested, so the case study remains fast and stable.</small>
        </div>
      ) : (
        <div className="demo-frame-wrap">
          {stage === 'loading' && (
            <div className="demo-loading" role="status">
              <span className="loader-ring" aria-hidden="true" />
              <b>Preparing the workspace…</b>
              <small>Large interactive builds can take a moment on the first visit.</small>
            </div>
          )}
          {stage === 'error' && (
            <div className="demo-error" role="alert">
              <b>The embedded demo did not finish loading.</b>
              <p>Your place in the case study is safe. Try the demo directly or reload just this frame.</p>
              <div>
                <button type="button" onClick={() => {
                  setStarted(false);
                  window.requestAnimationFrame(start);
                }}>Retry</button>
                <a href={media.src} target="_blank" rel="noreferrer">Open directly ↗</a>
              </div>
            </div>
          )}
          <iframe
            ref={frameRef}
            className={stage === 'ready' ? 'is-ready' : ''}
            src={media.src}
            title={media.title}
            loading={media.eager ? 'eager' : 'lazy'}
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"
            allow="clipboard-read; clipboard-write; fullscreen"
            onLoad={onLoad}
          />
        </div>
      )}
    </div>
  );
}

function MediaItem({ media, onOpen }) {
  if (media.type === 'video') return <LazyVideo media={media} />;
  if (media.type === 'demo') return <InteractiveDemo media={media} />;
  if (media.type === 'puri-flow') return <PuriFlow media={media} />;
  return (
    <figure className={`media-item media-image ${media.contain ? 'is-contain' : ''}`}>
      <button type="button" className="media-image-button" onClick={() => onOpen(media)} aria-label={`Open ${media.alt} full size`}>
        <img src={media.src} alt={media.alt} loading="lazy" decoding="async" />
        <span>Open full size ↗</span>
      </button>
    </figure>
  );
}

export default function ProjectPage({ project }) {
  const following = nextProject(project.slug);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    document.title = `${project.title} — Kelcy Han`;
    window.scrollTo(0, 0);
    setLightbox(null);
    document.body.classList.add('on-project-page');
    return () => document.body.classList.remove('on-project-page');
  }, [project]);

  return (
    <main
      className={`project-page project-${project.slug}`}
      style={{ '--project-accent': project.accent, '--project-ink': project.ink }}
    >
      <header className="project-header">
        <TransitionLink className="project-logo" to="/">KELCY HAN</TransitionLink>
        <TransitionLink className="back-to-work" to="/?room=2">
          <span aria-hidden="true">←</span> Selected work
        </TransitionLink>
        <span className="project-header-label">{project.category} · {project.year}</span>
      </header>

      <section className="project-hero">
        <div className="project-hero-copy">
          <p className="eyebrow">{project.category} · {project.year}</p>
          <h1>{project.title}</h1>
          <p className="project-statement">{project.statement}</p>
          <p className="project-summary">{project.summary}</p>
        </div>
        <div className={`project-hero-media ${project.graphic ? `is-${project.graphic}` : ''}`}>
          {project.hero ? (
            <img src={project.hero} alt={`${project.title} project overview`} fetchPriority="high" />
          ) : (
            <span className="hero-swarm" aria-hidden="true">
              {Array.from({ length: 42 }, (_, dot) => <i key={dot} style={{ '--dot': dot }} />)}
            </span>
          )}
        </div>
      </section>

      <section className="project-facts" aria-label="Project facts">
        <div><small>My role</small><p>{project.role}</p></div>
        <div><small>Built with</small><p>{project.tools}</p></div>
        <div className="project-stats">
          {project.stats.map(([value, label]) => (
            <span key={label}><b>{value}</b><small>{label}</small></span>
          ))}
        </div>
      </section>

      <div className="project-story">
        {project.chapters.map((chapter, chapterIndex) => (
          <section className="story-chapter" key={`${project.slug}-${chapter.title}`}>
            <div className="chapter-copy">
              <p className="eyebrow">{String(chapterIndex + 1).padStart(2, '0')} · {chapter.eyebrow}</p>
              <h2>{chapter.title}</h2>
              <p>{chapter.body}</p>
            </div>
            {chapter.media.length > 0 && (
              <div className={`chapter-media media-count-${chapter.media.length}`}>
                {chapter.media.map((media, index) => (
                  <MediaItem key={`${media.src || media.title}-${index}`} media={media} onOpen={setLightbox} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <footer className="project-footer">
        <div>
          <p className="eyebrow">Next project</p>
          <TransitionLink to={`/projects/${following.slug}`}>
            <span>{following.title}</span>
            <small>{following.category} · {following.year}</small>
            <i aria-hidden="true">↗</i>
          </TransitionLink>
        </div>
        <TransitionLink className="all-work-link" to="/?room=2">View all selected work</TransitionLink>
      </footer>
      {lightbox && <ImageLightbox media={lightbox} onClose={() => setLightbox(null)} />}
    </main>
  );
}
