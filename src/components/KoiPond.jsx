import { useEffect, useRef } from 'react';

export default function KoiPond({ active }) {
  const canvasRef = useRef(null);
  const controllerRef = useRef(null);
  const mobileLikeRef = useRef(
    window.matchMedia?.('(pointer: coarse)')?.matches || window.innerWidth < 760,
  );
  const enabled = active && !mobileLikeRef.current;

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      controllerRef.current?.deactivate();
      return undefined;
    }

    const activate = async () => {
      if (!controllerRef.current) {
        const { createKoiScene } = await import('../lib/koiScene.js');
        if (cancelled || !canvasRef.current) return;
        controllerRef.current = createKoiScene(canvasRef.current);
      }
      controllerRef.current.activate();
    };

    void activate();
    return () => {
      cancelled = true;
      controllerRef.current?.deactivate();
    };
  }, [enabled]);

  useEffect(() => () => {
    controllerRef.current?.dispose();
    controllerRef.current = null;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`koi-canvas ${enabled ? 'is-active' : ''}`}
      aria-hidden="true"
    />
  );
}
