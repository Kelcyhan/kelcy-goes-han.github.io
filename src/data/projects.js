import speakingWide from '../../AISpeakingLab/assets/photos/aisl-table-wide.jpg';
import agentPreview from '../../AgentSystem/demo-preview.png';
import discussDashboard from '../../DiscussAgain/assets/dashboard.png';
import metacogPreview from '../../MetacogReef/assets/page_1.webp';
import pointFitPreview from '../../PointFit/assets/home_p1.webp';
import puriPreview from '../../Puri/assets/puri-final-product.png';
import supplyNetPreview from '../../SupplyNet/assets/overview.webp';
import swarmFlightPreview from '../../assets/swarm-flight-preview.png';
import betweenBayPreview from '../../Doliu/assets/merch-03.png';

// Project case studies keep their original, independently designed pages.
// This list contains only the metadata needed by the React gallery and route shell.
export const projects = [
  {
    slug: 'between-bay',
    legacyPath: 'Doliu',
    title: 'Between Bay',
    category: 'Brand & e-commerce experience',
    year: '2026',
    accent: '#ef719a',
    cardAccent: '#f1a6bd',
    loaderBackground: '#fffaf5',
    ink: '#5c365f',
    preview: betweenBayPreview,
  },
  {
    slug: 'metacog-reef',
    legacyPath: 'MetacogReef',
    title: 'MetacogReef',
    category: 'Reflective service',
    year: '2024',
    accent: '#78b7aa',
    cardAccent: '#a6c2a8',
    loaderBackground: '#16110b',
    ink: '#143d38',
    preview: metacogPreview,
  },
  {
    slug: 'discuss-again',
    legacyPath: 'DiscussAgain',
    title: 'DiscussAgain',
    category: 'Human–AI research',
    year: '2026',
    accent: '#f3a64a',
    cardAccent: '#e85d75',
    loaderBackground: '#0a0f14',
    ink: '#4a2b08',
    preview: discussDashboard,
  },
  {
    slug: 'point-fit',
    legacyPath: 'PointFit',
    title: 'PointFit',
    category: 'Health experience',
    year: '2024',
    accent: '#67d9b6',
    cardAccent: '#7fe3c4',
    loaderBackground: '#05090c',
    ink: '#153f35',
    preview: pointFitPreview,
  },
  {
    slug: 'ai-speaking-lab',
    legacyPath: 'AISpeakingLab',
    title: 'AI Speaking Lab',
    category: 'AI learning environment',
    year: '2026',
    accent: '#e26c54',
    cardAccent: '#d9ff39',
    loaderBackground: '#050604',
    ink: '#542015',
    preview: speakingWide,
  },
  {
    slug: 'supply-net',
    legacyPath: 'SupplyNet',
    title: 'SupplyNet',
    category: 'Multi-agent learning',
    year: '2026',
    accent: '#e8865b',
    cardAccent: '#7fd3a0',
    loaderBackground: '#0a1815',
    ink: '#55220e',
    preview: supplyNetPreview,
  },
  {
    slug: 'swarm',
    legacyPath: 'Swarm',
    title: 'Swarm',
    category: 'Interactive art demo',
    year: '2025',
    accent: '#9c8ff0',
    cardAccent: '#5ab8df',
    loaderBackground: '#04060a',
    ink: '#2f275f',
    preview: swarmFlightPreview,
    graphic: 'swarm',
  },
  {
    slug: 'puri',
    legacyPath: 'Puri',
    title: 'Puri!',
    category: 'Circular service',
    year: '2024',
    accent: '#ef7c54',
    cardAccent: '#a7c957',
    loaderBackground: '#111510',
    ink: '#5b2716',
    preview: puriPreview,
  },
  {
    slug: 'agent-system',
    legacyPath: 'AgentSystem',
    title: 'Agent System',
    category: 'AI operations research',
    year: '2026',
    accent: '#6e95f6',
    cardAccent: '#6e95f6',
    loaderBackground: '#f4efe5',
    ink: '#172a5b',
    preview: agentPreview,
  },
];

export const projectMap = Object.fromEntries(projects.map((project) => [project.slug, project]));

export const legacyRouteMap = Object.fromEntries(
  projects.map((project) => [project.legacyPath.toLowerCase(), project.slug]),
);
