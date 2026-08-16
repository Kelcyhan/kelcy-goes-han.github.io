import speakingWide from '../../AISpeakingLab/assets/photos/aisl-table-wide.jpg';
import agentPreview from '../../AgentSystem/demo-preview.png';
import discussDashboard from '../../DiscussAgain/assets/dashboard.png';
import metacogPreview from '../../MetacogReef/assets/page_1.webp';
import pointFitPreview from '../../PointFit/assets/home_p1.webp';
import puriPreview from '../../Puri/assets/puri-final-product.png';
import supplyNetPreview from '../../SupplyNet/assets/overview.webp';
import swarmFlightPreview from '../../assets/swarm-flight-preview.png';
import betweenBayPreview from '../../Doliu/assets/merch-03.png';
import betweenBayShopPreview from '../../BetweenBayShop/assets/merch-04.png';

// Project case studies keep their original, independently designed pages.
// This list contains only the metadata needed by the React gallery and route shell.
export const projects = [
  {
    slug: 'between-bay-shop',
    legacyPath: 'BetweenBayShop',
    title: 'Between Bay',
    category: 'E-commerce',
    year: '2026',
    accent: '#0a60d6',
    cardAccent: '#a8cef6',
    loaderBackground: '#f7f4f0',
    ink: '#111a2a',
    preview: betweenBayShopPreview,
    group: 'commerce',
  },
  {
    slug: 'between-bay',
    legacyPath: 'Doliu',
    title: 'Doliu',
    category: 'IP Design',
    year: '2026',
    accent: '#ef719a',
    cardAccent: '#f1a6bd',
    loaderBackground: '#fffaf5',
    ink: '#5c365f',
    preview: betweenBayPreview,
    group: 'commerce',
  },
  {
    slug: 'metacog-reef',
    legacyPath: 'MetacogReef',
    title: 'MetacogReef',
    category: 'Digital product & visual system',
    year: '2024',
    accent: '#78b7aa',
    cardAccent: '#a6c2a8',
    loaderBackground: '#16110b',
    ink: '#143d38',
    preview: metacogPreview,
    group: 'product',
  },
  {
    slug: 'discuss-again',
    legacyPath: 'DiscussAgain',
    title: 'DiscussAgain',
    category: 'Web experience & visual design',
    year: '2026',
    accent: '#f3a64a',
    cardAccent: '#e85d75',
    loaderBackground: '#0a0f14',
    ink: '#4a2b08',
    preview: discussDashboard,
    group: 'product',
  },
  {
    slug: 'point-fit',
    legacyPath: 'PointFit',
    title: 'PointFit',
    category: 'Mobile product & campaign design',
    year: '2024',
    accent: '#67d9b6',
    cardAccent: '#7fe3c4',
    loaderBackground: '#05090c',
    ink: '#153f35',
    preview: pointFitPreview,
    group: 'commerce',
  },
  {
    slug: 'ai-speaking-lab',
    legacyPath: 'AISpeakingLab',
    title: 'AI Speaking Lab',
    category: 'Digital learning & art direction',
    year: '2026',
    accent: '#e26c54',
    cardAccent: '#d9ff39',
    loaderBackground: '#050604',
    ink: '#542015',
    preview: speakingWide,
    group: 'product',
  },
  {
    slug: 'supply-net',
    legacyPath: 'SupplyNet',
    title: 'SupplyNet',
    category: 'Multi-agent learning experience',
    year: '2026',
    accent: '#e8865b',
    cardAccent: '#7fd3a0',
    loaderBackground: '#0a1815',
    ink: '#55220e',
    preview: supplyNetPreview,
    group: 'creative',
  },
  {
    slug: 'swarm',
    legacyPath: 'Swarm',
    title: 'Swarm',
    category: 'Creative coding & interactive visual',
    year: '2025',
    accent: '#9c8ff0',
    cardAccent: '#5ab8df',
    loaderBackground: '#04060a',
    ink: '#2f275f',
    preview: swarmFlightPreview,
    graphic: 'swarm',
    group: 'creative',
  },
  {
    slug: 'puri',
    legacyPath: 'Puri',
    title: 'Puri!',
    category: 'Brand campaign & service design',
    year: '2024',
    accent: '#ef7c54',
    cardAccent: '#a7c957',
    loaderBackground: '#111510',
    ink: '#5b2716',
    preview: puriPreview,
    group: 'product',
  },
  {
    slug: 'agent-system',
    legacyPath: 'AgentSystem',
    title: 'Agent System',
    category: 'AI operations & interface research',
    year: '2026',
    accent: '#6e95f6',
    cardAccent: '#6e95f6',
    loaderBackground: '#f4efe5',
    ink: '#172a5b',
    preview: agentPreview,
    group: 'creative',
  },
];

export const projectMap = Object.fromEntries(projects.map((project) => [project.slug, project]));

export const legacyRouteMap = Object.fromEntries(
  projects.map((project) => [project.legacyPath.toLowerCase(), project.slug]),
);
