import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import MusicPlayer from './components/MusicPlayer.jsx';
import ProjectPage from './components/ProjectPage.jsx';
import ScenicHome from './components/ScenicHome.jsx';
import TransitionLink from './components/TransitionLink.jsx';
import { legacyRouteMap, projectMap } from './data/projects.js';

function ProjectRoute() {
  const { slug } = useParams();
  const project = projectMap[slug];
  return project ? <ProjectPage project={project} /> : <NotFound />;
}

function LegacyRoute() {
  const { legacy } = useParams();
  const slug = legacyRouteMap[String(legacy || '').toLowerCase()];
  return slug ? <Navigate replace to={`/projects/${slug}`} /> : <NotFound />;
}

function NotFound() {
  return (
    <main className="not-found">
      <p className="eyebrow">404 · route not found</p>
      <h1>This room is still being built.</h1>
      <p>The project may have moved into the new portfolio route.</p>
      <TransitionLink className="button-link" to="/?room=2">Return to selected work</TransitionLink>
    </main>
  );
}

function App() {
  const location = useLocation();
  const isProject = location.pathname.startsWith('/projects/');

  return (
    <div className={isProject ? 'app app-project' : 'app app-home'}>
      <Routes>
        <Route path="/" element={<ScenicHome />} />
        <Route path="/projects/:slug" element={<ProjectRoute />} />
        <Route path="/:legacy" element={<LegacyRoute />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <MusicPlayer compact={isProject} />
    </div>
  );
}

export default App;
