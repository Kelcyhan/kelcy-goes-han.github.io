import { useEffect, useRef, useState } from 'react';
import bgmUrl from '../../assets/audio/bgm.mp3';
import dropletUrl from '../../assets/video/water_drop.mp4';

const TIME_KEY = 'kelcy-bgm-time';

export default function MusicPlayer({ compact = false }) {
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  // Audio starts paused so the first tap always has predictable browser
  // activation. The droplet follows the same play/pause state as the audio.
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState('paused');

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    audio.volume = 0.42;
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
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { willReadFrequently: true });
    if (!video || !canvas || !context) return undefined;

    let renderHandle = 0;
    let renderMode = 'none';
    let disposed = false;
    const clamp01 = (value) => Math.max(0, Math.min(1, value));

    const renderDropletFrame = () => {
      if (!video.videoWidth || !video.videoHeight) return;

      const target = Math.min(128, Math.max(96, Math.ceil(canvas.clientWidth)));
      if (canvas.width !== target || canvas.height !== target) {
        canvas.width = target;
        canvas.height = target;
      }

      const videoRatio = video.videoWidth / video.videoHeight;
      const canvasRatio = canvas.width / canvas.height;
      let sx = 0;
      let sy = 0;
      let sw = video.videoWidth;
      let sh = video.videoHeight;
      if (videoRatio > canvasRatio) {
        sw = video.videoHeight * canvasRatio;
        sx = (video.videoWidth - sw) / 2;
      } else {
        sh = video.videoWidth / canvasRatio;
        sy = (video.videoHeight - sh) / 2;
      }

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      let frame;
      try {
        frame = context.getImageData(0, 0, canvas.width, canvas.height);
      } catch {
        return;
      }

      const { data } = frame;
      for (let index = 0; index < data.length; index += 4) {
        const luma = (data[index] + data[index + 1] + data[index + 2]) / (255 * 3);
        const alpha = clamp01((luma * 9 - 0.15) * 0.85);
        const glow = clamp01(luma * 4.8);
        data[index] = 244 * glow;
        data[index + 1] = 232 * glow;
        data[index + 2] = 208 * glow;
        data[index + 3] = 255 * alpha;
      }
      context.putImageData(frame, 0, 0);
    };

    const cancelRenderLoop = () => {
      if (!renderHandle) return;
      if (renderMode === 'video-frame' && typeof video.cancelVideoFrameCallback === 'function') {
        video.cancelVideoFrameCallback(renderHandle);
      } else {
        window.cancelAnimationFrame(renderHandle);
      }
      renderHandle = 0;
      renderMode = 'none';
    };

    const scheduleNextFrame = () => {
      if (disposed || document.hidden || video.paused || video.ended) return;
      if (typeof video.requestVideoFrameCallback === 'function') {
        renderMode = 'video-frame';
        renderHandle = video.requestVideoFrameCallback(() => {
          renderHandle = 0;
          renderDropletFrame();
          scheduleNextFrame();
        });
      } else {
        renderMode = 'animation-frame';
        renderHandle = window.requestAnimationFrame(() => {
          renderHandle = 0;
          renderDropletFrame();
          scheduleNextFrame();
        });
      }
    };

    const startRenderLoop = () => {
      cancelRenderLoop();
      renderDropletFrame();
      scheduleNextFrame();
    };
    const stopRenderLoop = () => {
      cancelRenderLoop();
      renderDropletFrame();
    };

    video.addEventListener('loadeddata', renderDropletFrame);
    video.addEventListener('seeked', renderDropletFrame);
    video.addEventListener('play', startRenderLoop);
    video.addEventListener('pause', stopRenderLoop);
    if (video.readyState >= 2) renderDropletFrame();

    return () => {
      disposed = true;
      cancelRenderLoop();
      video.removeEventListener('loadeddata', renderDropletFrame);
      video.removeEventListener('seeked', renderDropletFrame);
      video.removeEventListener('play', startRenderLoop);
      video.removeEventListener('pause', stopRenderLoop);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const syncVisualPlayback = () => {
      if (playing && !document.hidden) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    };

    document.addEventListener('visibilitychange', syncVisualPlayback);
    syncVisualPlayback();
    return () => document.removeEventListener('visibilitychange', syncVisualPlayback);
  }, [playing]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || status === 'loading') return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      setStatus('paused');
      return;
    }

    setStatus('loading');
    try {
      if (audio.readyState === 0) audio.load();
      // Keep play() in the click handler so Safari and mobile browsers retain
      // the user activation needed for audio.
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
        title={playing ? 'Pause background music' : 'Play background music'}
      >
        <span className="music-orb" aria-hidden="true">
          <video ref={videoRef} src={dropletUrl} muted loop playsInline preload="auto" />
          <canvas ref={canvasRef} width="128" height="128" />
        </span>
      </button>
    </div>
  );
}
