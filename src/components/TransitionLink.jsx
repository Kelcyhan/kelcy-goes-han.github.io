import { useNavigate } from 'react-router-dom';

function shouldHandle(event) {
  return !event.defaultPrevented
    && event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey;
}

export function useTransitionNavigate() {
  const navigate = useNavigate();

  return (to, options) => {
    const commit = () => navigate(to, options);
    if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.startViewTransition(commit);
    } else {
      commit();
    }
  };
}

export default function TransitionLink({ to, onClick, children, ...props }) {
  const transitionNavigate = useTransitionNavigate();

  function handleClick(event) {
    onClick?.(event);
    if (!shouldHandle(event)) return;
    event.preventDefault();
    transitionNavigate(to);
  }

  return (
    <a href={to} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
