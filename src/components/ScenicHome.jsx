import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import homeIdle from '../../assets/frames/scene_1/frame_001.webp';
import reefIdle from '../../assets/a1_idle.webp';
import loungeIdle from '../../assets/a2_idle.webp';
import { projects } from '../data/projects.js';
import KoiPond from './KoiPond.jsx';
import TransitionLink from './TransitionLink.jsx';

const ROOM_LABELS = { 1: 'Index', 2: 'Gallery', 3: 'Contact' };
const IDLE_IMAGES = { 1: homeIdle, 2: reefIdle, 3: loungeIdle };
const TRANSITIONS = {
  1: { 2: { scene: 2, reversed: false }, 3: { scene: 3, reversed: false } },
  2: { 1: { scene: 2, reversed: true }, 3: { scene: 4, reversed: true } },
  3: { 1: { scene: 3, reversed: true }, 2: { scene: 4, reversed: false } },
};
const FRAME_COUNT = 121;
const FRAME_STEP = 2;
const AMBIENT_FPS = 12;
const TRANSITION_MS = 2520;
const BASE_URL = import.meta.env.BASE_URL || '/';

function frameUrl(scene, index) {
  return `${BASE_URL}assets/frames/scene_${scene}/frame_${String(index + 1).padStart(3, '0')}.webp`;
}

function easeTrapezoidal(value) {
  const acceleration = 0.18;
  const peak = 1 / (1 - acceleration);
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  if (value <= acceleration) return (value * value / (2 * acceleration)) * peak;
  if (value >= 1 - acceleration) {
    const remaining = 1 - value;
    return 1 - (remaining * remaining / (2 * acceleration)) * peak;
  }
  return (acceleration / 2 + value - acceleration) * peak;
}

function drawCover(canvas, image) {
  if (!canvas || !image?.naturalWidth) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  const context = canvas.getContext('2d', { alpha: true });
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const viewportRatio = width / height;
  let drawWidth;
  let drawHeight;
  let x;
  let y;
  if (imageRatio > viewportRatio) {
    drawHeight = height;
    drawWidth = height * imageRatio;
    x = (width - drawWidth) / 2;
    y = 0;
  } else {
    drawWidth = width;
    drawHeight = width / imageRatio;
    x = 0;
    y = (height - drawHeight) / 2;
  }
  context.clearRect(0, 0, width, height);
  context.drawImage(image, x, y, drawWidth, drawHeight);
}

function clearCanvas(canvas) {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
}

function ProjectCard({ project, index }) {
  return (
    <TransitionLink
      className="project-card"
      to={`/projects/${project.slug}`}
      style={{
        '--card-accent': project.cardAccent || project.accent,
        '--card-ink': project.ink,
        '--delay': `${index * 45}ms`,
      }}
      aria-label={`Open ${project.title} project`}
    >
      <span className={`project-card-media ${project.graphic ? `is-${project.graphic}` : ''}`}>
        {project.preview ? (
          <img src={project.preview} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="swarm-preview" aria-hidden="true">
            {Array.from({ length: 18 }, (_, dot) => <i key={dot} style={{ '--dot': dot }} />)}
          </span>
        )}
      </span>
      <span className="project-card-copy">
        <span>
          <b>{project.title}</b>
          <small>{project.category} · {project.year}</small>
        </span>
        <span className="project-arrow" aria-hidden="true">↗</span>
      </span>
    </TransitionLink>
  );
}

export default function ScenicHome() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRoom = Math.min(3, Math.max(1, Number(searchParams.get('room')) || 1));
  const [room, setRoom] = useState(initialRoom);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef(null);
  const ambientCanvasRef = useRef(null);
  const cacheRef = useRef(new Map());
  const animationRef = useRef(0);
  const ambientAnimationRef = useRef(0);
  const mountedRef = useRef(true);
  const goRoomRef = useRef(null);
  const reduceMotion = useMemo(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false,
    [],
  );
  const ambientMotionEnabled = useMemo(
    () => !reduceMotion && !(window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 760),
    [reduceMotion],
  );

  const loadFrame = useCallback((scene, index) => {
    const key = `${scene}:${index}`;
    const cached = cacheRef.current.get(key);
    if (cached) return cached.promise;

    const entry = { image: new Image(), ready: false, failed: false, promise: null };
    entry.image.decoding = 'async';
    entry.promise = new Promise((resolve) => {
      entry.image.onload = () => {
        entry.ready = entry.image.naturalWidth > 0;
        resolve(entry);
      };
      entry.image.onerror = () => {
        entry.failed = true;
        resolve(entry);
      };
    });
    entry.image.src = frameUrl(scene, index);
    cacheRef.current.set(key, entry);
    return entry.promise;
  }, []);

  const commitRoom = useCallback((target) => {
    setRoom(target);
    const next = target === 1 ? {} : { room: String(target) };
    setSearchParams(next, { replace: true });
  }, [setSearchParams]);

  const goRoom = useCallback(async (target) => {
    if (busy || target === room || !TRANSITIONS[room]?.[target]) return;
    if (reduceMotion) {
      if (target !== 1) clearCanvas(ambientCanvasRef.current);
      commitRoom(target);
      return;
    }

    const transition = TRANSITIONS[room][target];
    const forward = Array.from(
      { length: Math.floor((FRAME_COUNT - 1) / FRAME_STEP) + 1 },
      (_, position) => Math.min(FRAME_COUNT - 1, position * FRAME_STEP),
    );
    const sequence = transition.reversed ? forward.reverse() : forward;
    setBusy(true);

    const opening = sequence.slice(0, 12);
    await Promise.all(opening.map((index) => loadFrame(transition.scene, index)));
    if (!mountedRef.current) return;

    // Continue the remaining requests while playback begins. Only every second
    // source frame is used: 24fps motion with roughly half the decode pressure.
    sequence.slice(12).forEach((index) => { void loadFrame(transition.scene, index); });
    const startedAt = performance.now();

    const tick = (now) => {
      if (!mountedRef.current) return;
      const raw = Math.min(1, (now - startedAt) / TRANSITION_MS);
      const progress = easeTrapezoidal(raw);
      const position = Math.min(sequence.length - 1, Math.floor(progress * (sequence.length - 1)));
      const desired = sequence[position];
      let entry = cacheRef.current.get(`${transition.scene}:${desired}`);

      if (!entry?.ready) {
        // Keep the previous successful frame instead of flashing a blank canvas.
        for (let offset = 1; offset <= 8 && !entry?.ready; offset += 1) {
          const fallbackIndex = sequence[Math.max(0, position - offset)];
          entry = cacheRef.current.get(`${transition.scene}:${fallbackIndex}`);
        }
      }
      if (entry?.ready) drawCover(canvasRef.current, entry.image);

      if (raw < 1) {
        animationRef.current = window.requestAnimationFrame(tick);
      } else {
        if (target !== 1) clearCanvas(ambientCanvasRef.current);
        commitRoom(target);
        setBusy(false);
        window.requestAnimationFrame(() => {
          clearCanvas(canvasRef.current);
        });
      }
    };

    animationRef.current = window.requestAnimationFrame(tick);
  }, [busy, commitRoom, loadFrame, reduceMotion, room]);

  goRoomRef.current = goRoom;

  useEffect(() => {
    mountedRef.current = true;
    const prefetch = window.setTimeout(() => {
      [2, 3].forEach((scene) => {
        for (let index = 0; index <= 22; index += FRAME_STEP) void loadFrame(scene, index);
      });
    }, 700);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(prefetch);
      window.cancelAnimationFrame(animationRef.current);
    };
  }, [loadFrame]);

  useEffect(() => {
    if (!ambientMotionEnabled) return undefined;

    let cancelled = false;
    let nextFrame = 0;
    let batchTimer = 0;
    const loadBatch = () => {
      if (cancelled) return;
      const end = Math.min(FRAME_COUNT, nextFrame + 8);
      for (; nextFrame < end; nextFrame += 1) void loadFrame(1, nextFrame);
      if (nextFrame < FRAME_COUNT) batchTimer = window.setTimeout(loadBatch, 45);
    };

    batchTimer = window.setTimeout(loadBatch, 60);
    return () => {
      cancelled = true;
      window.clearTimeout(batchTimer);
    };
  }, [ambientMotionEnabled, loadFrame]);

  useEffect(() => {
    const canvas = ambientCanvasRef.current;
    if (!canvas) return undefined;

    // Keep the latest ambient frame frozen underneath the outgoing transition.
    if (busy) return undefined;
    if (room !== 1 || !ambientMotionEnabled) {
      clearCanvas(canvas);
      return undefined;
    }

    let cancelled = false;
    let startedAt = 0;
    let lastFrame = -1;
    const tick = (now) => {
      if (cancelled) return;
      const frameIndex = Math.floor(((now - startedAt) / 1000) * AMBIENT_FPS) % FRAME_COUNT;
      if (frameIndex !== lastFrame) {
        const entry = cacheRef.current.get(`1:${frameIndex}`);
        if (entry?.ready) {
          drawCover(canvas, entry.image);
          lastFrame = frameIndex;
        } else {
          void loadFrame(1, frameIndex);
        }
      }
      ambientAnimationRef.current = window.requestAnimationFrame(tick);
    };

    const prime = Array.from({ length: 16 }, (_, index) => loadFrame(1, index));
    void Promise.all(prime).then(() => {
      if (cancelled) return;
      startedAt = performance.now();
      ambientAnimationRef.current = window.requestAnimationFrame(tick);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(ambientAnimationRef.current);
    };
  }, [ambientMotionEnabled, busy, loadFrame, room]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'ArrowDown') goRoomRef.current?.(2);
      else if (event.key === 'ArrowRight') goRoomRef.current?.(3);
      else if (event.key === 'ArrowLeft' || event.key === 'Home' || event.key === 'Escape') goRoomRef.current?.(1);
      else if (event.key === 'ArrowUp' && room === 2) goRoomRef.current?.(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [room]);

  useEffect(() => {
    document.title = 'Kelcy Han — Creative Technologist';
  }, []);

  return (
    <main className={`scenic-home room-${room} ${busy ? 'is-transitioning' : ''}`} aria-busy={busy}>
      <div className="scenic-stage" aria-hidden="true">
        <img className="scenic-idle" src={IDLE_IMAGES[room]} alt="" />
        <canvas ref={ambientCanvasRef} className="ambient-canvas" />
        <canvas ref={canvasRef} className="transition-canvas" />
        <KoiPond active={room === 2 && !busy} />
        <span className="scenic-wash" />
      </div>

      <header className="home-header">
        <button className="home-logo" type="button" onClick={() => goRoom(1)} disabled={busy}>
          KELCY HAN
        </button>
        <nav className="room-nav" aria-label="Portfolio rooms">
          {[1, 2, 3].map((roomNumber) => (
            <button
              key={roomNumber}
              type="button"
              className={room === roomNumber ? 'is-active' : ''}
              aria-current={room === roomNumber ? 'page' : undefined}
              onClick={() => goRoom(roomNumber)}
              disabled={busy}
            >
              <span>0{roomNumber}</span> {ROOM_LABELS[roomNumber]}
            </button>
          ))}
        </nav>
      </header>

      <section className={`home-room home-intro ${room === 1 ? 'is-active' : ''}`} aria-hidden={room !== 1}>
        <p className="eyebrow">Creative technologist · Hong Kong</p>
        <h1>Hello,<br />I’m Kelcy Han.</h1>
        <p className="home-lede">I build thoughtful systems where design, technology, and real-world behaviour meet.</p>
        <button className="room-cta" type="button" onClick={() => goRoom(2)} disabled={busy}>
          Enter selected work <span aria-hidden="true">↓</span>
        </button>
      </section>

      <section className={`home-room home-gallery ${room === 2 ? 'is-active' : ''}`} aria-hidden={room !== 2}>
        <div className="gallery-heading">
          <div>
            <p className="eyebrow">Selected work · 2024–2026</p>
            <h2>Eight systems,<br />one curious practice.</h2>
          </div>
          <p>Research prototypes, services, learning environments, and interactive experiments.</p>
        </div>
        <div className="project-grid">
          {projects.map((project, index) => <ProjectCard key={project.slug} project={project} index={index} />)}
        </div>
      </section>

      <section className={`home-room home-contact ${room === 3 ? 'is-active' : ''}`} aria-hidden={room !== 3}>
        <p className="eyebrow">Contact · collaborations welcome</p>
        <h2>Let’s make the<br />complicated feel clear.</h2>
        <p>Open to research collaborations, creative technology, product work, and conversations about the spaces between disciplines.</p>
        <div className="contact-links">
          <a href="mailto:kelcyhan@gmail.com">Email <span aria-hidden="true">↗</span></a>
          <a href="https://www.linkedin.com/in/kelcy-goes-han" target="_blank" rel="noreferrer">LinkedIn <span aria-hidden="true">↗</span></a>
          <a href="https://github.com/Kelcyhan" target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <p className="home-hint">
        {room === 2 ? 'Move to scatter · Click to summon more' : 'Use the room menu or arrow keys'}
      </p>
    </main>
  );
}
