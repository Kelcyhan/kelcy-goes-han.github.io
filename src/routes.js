import metacogPreview from '../MetacogReef/assets/page_1.webp';
import discussPreview from '../DiscussAgain/assets/dashboard.png';
import pointFitPreview from '../PointFit/assets/home_p1.webp';
import speakingLabPreview from '../AISpeakingLab/assets/photos/aisl-table-wide.jpg';
import supplyNetPreview from '../SupplyNet/assets/overview.webp';
import puriPreview from '../Puri/assets/puri-final-product.png';
import agentSystemPreview from '../AgentSystem/demo-preview.png';

export const PROJECTS = [
  { ttl: 'MetacogReef', tag: 'Service · 2024', x: '8%', y: '20%', tint: 'reef', route: 'MetacogReef/', preview: metacogPreview },
  { ttl: 'DiscussAgain', tag: 'UIST · 2026', x: '63%', y: '14%', tint: 'amber', route: 'DiscussAgain/', preview: discussPreview },
  { ttl: 'PointFit', tag: 'Health · 2024', x: '12%', y: '58%', tint: 'mint', route: 'PointFit/', preview: pointFitPreview },
  { ttl: 'AI Speaking Lab', tag: 'AI Edu · 2026', x: '34%', y: '37%', tint: 'voice', route: 'AISpeakingLab/', preview: speakingLabPreview },
  { ttl: 'SupplyNet', tag: 'Research · 2026', x: '54%', y: '55%', tint: 'rust', route: 'SupplyNet/', preview: supplyNetPreview },
  { ttl: 'Swarm', tag: 'Art Demo · 2025', x: '78%', y: '35%', tint: 'swarm', route: 'Swarm/', previewGraphic: 'swarm' },
  { ttl: 'Puri!', tag: 'Service · 2024', x: '77%', y: '61%', tint: 'puri', route: 'Puri/', preview: puriPreview, previewPosition: 'center 42%' },
  { ttl: 'Agent System', tag: 'AI Ops · Live Demo', x: '34%', y: '73%', tint: 'agent', route: 'AgentSystem/', preview: agentSystemPreview },
];

export const ROUTE_PATHS = PROJECTS.map((project) => project.route);
