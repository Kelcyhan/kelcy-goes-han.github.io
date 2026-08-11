import { useEffect, useRef } from 'react';
import { useTransitionNavigate } from './TransitionLink.jsx';

export default function ProjectPage({ project }) {
  const iframeRef = useRef(null);
  const transitionNavigate = useTransitionNavigate();
  const projectUrl = `/${project.legacyPath}/index.html`;

  useEffect(() => {
    document.title = `${project.title} — Kelcy Han`;
    document.body.classList.add('on-project-page', 'route-open');
    window.scrollTo(0, 0);

    const closeProject = () => transitionNavigate('/?room=2', { replace: true });
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeProject();
    };
    const onMessage = (event) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === 'close-route' || event.data?.type === 'kelcy-project-close') closeProject();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('message', onMessage);
    return () => {
      document.body.classList.remove('on-project-page', 'route-open');
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('message', onMessage);
    };
  }, [project, transitionNavigate]);

  return (
    <main
      className={`original-project-shell project-${project.slug}`}
      style={{ '--project-loader-background': project.loaderBackground }}
    >
      <button
        className="original-project-back"
        type="button"
        onClick={() => transitionNavigate('/?room=2', { replace: true })}
      >
        Back
      </button>
      <iframe
        ref={iframeRef}
        className="original-project-frame"
        src={projectUrl}
        title={`${project.title} case study`}
        allow="autoplay; clipboard-read; clipboard-write; fullscreen"
      />
    </main>
  );
}
