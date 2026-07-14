import { useEffect, useRef, useState } from 'react';
import bgmUrl from '../../assets/audio/bgm.mp3';
import dropletUrl from '../../assets/video/water_drop.mp4';

const TIME_KEY = 'kelcy-bgm-time';
const PLAY_KEY = 'kelcy-bgm-enabled';

export default function MusicPlayer({ compact = false }) {
  const audioRef = useRef(null);
  // Browsers require play() to happen inside a real user gesture. A previous
  // preference is remembered, but a fresh page intentionally starts paused.
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    audio.volume = 0.34;
    try {
      const savedTime = Number(sessionStorage.getItem(TIME_KEY));
      if (Number.isFinite(savedTime) && savedTime > 0) {
        const restore = () => {
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            audio.currentTime = Math.min(savedTime, Math.max(0, audio.duration - 0.25));
          }
        };
        audio.addEventListener('loadedmetadata', restore, { once: true });
      }
    } catch {
      // Storage can be unavailable in privacy modes; playback still works.
    }

    const saveTime = () => {
      try { sessionStorage.setItem(TIME_KEY, String(audio.currentTime || 0)); } catch { /* noop */ }
    };
    window.addEventListener('pagehide', saveTime);
    const timer = window.setInterval(saveTime, 3000);

    return () => {
      window.removeEventListener('pagehide', saveTime);
      window.clearInterval(timer);
      saveTime();
    };
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(PLAY_KEY, String(playing)); } catch { /* noop */ }
  }, [playing]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      setStatus('idle');
      return;
    }

    setStatus('loading');
    try {
      if (audio.readyState === 0) audio.load();
      // This call stays directly in the click handler so user activation is
      // preserved in Safari, Chrome, and mobile browsers.
      await audio.play();
      setPlaying(true);
      setStatus('playing');
    } catch (error) {
      setPlaying(false);
      setStatus(error?.name || 'blocked');
    }
  }

  return (
    <div className={`music-player ${compact ? 'is-compact' : ''}`}>
      <audio ref={audioRef} src={bgmUrl} loop preload="metadata" />
      <button
        className="music-toggle"
        type="button"
        aria-label={playing ? 'Pause background music' : 'Play background music'}
        aria-pressed={playing}
        data-status={status}
        onClick={togglePlayback}
      >
        <span className="music-orb" aria-hidden="true">
          <video src={dropletUrl} muted loop playsInline autoPlay preload="metadata" />
          <span className={`music-wave ${playing ? 'is-playing' : ''}`} />
        </span>
        <span className="music-copy">
          <b>{playing ? 'Sound on' : 'Sound off'}</b>
          <small>{status === 'loading' ? 'Starting…' : status === 'NotAllowedError' ? 'tap to allow audio' : 'ambient water study'}</small>
        </span>
      </button>
    </div>
  );
}
