import { readFileSync } from 'node:fs';

const launcher = readFileSync(new URL('../src/ExploreLauncher.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/HomeActionDeck.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const destinations = [
  'journey',
  'failure',
  'builder',
  'packet',
  'tcp',
  'dns',
  'tls',
  'http',
  'internet',
  'physical',
  'observed',
  'measured',
];

for (const destination of destinations) {
  assert(
    launcher.includes(`id: '${destination}'`),
    `Explore launcher is missing the ${destination} destination.`,
  );
  assert(
    app.includes(`case '${destination}':`) || app.includes(`${destination}:`),
    `App does not route the ${destination} Explore destination.`,
  );
}

assert(
  launcher.includes("data-explore-destination={item.id}"),
  'Standard Explore cards must expose stable destination attributes for browser coverage.',
);
assert(
  launcher.includes("data-explore-destination={item.id}"),
  'Featured Explore cards must expose stable destination attributes for browser coverage.',
);
assert(
  launcher.includes("id: 'journey'") && launcher.includes("title: 'Watch a request'"),
  'Explore must keep WATCH A REQUEST as a featured starting point.',
);
assert(
  launcher.includes("id: 'failure'") && launcher.includes("title: 'Break the network'"),
  'Explore must keep BREAK THE NETWORK as a featured starting point.',
);
assert(
  launcher.includes("id: 'builder'") && launcher.includes("title: 'Build a network'"),
  'Explore must keep BUILD A NETWORK as a featured starting point.',
);
assert(
  app.includes("const [exploreOpen, setExploreOpen] = useState(false);"),
  'Explore launcher must have explicit App-owned open state.',
);
assert(
  app.includes('className="explore-trigger"') && app.includes('onExplore={() => setExploreOpen(true)}'),
  'Explore must be reachable from both the persistent header and the overview product surface.',
);
assert(
  home.includes('Explore all 12 labs') && home.includes('onClick={onExplore}'),
  'Overview product surface must keep an explicit entry to the full Explore catalog.',
);
assert(
  app.includes('onSelect={selectExploreDestination}'),
  'Explore launcher must use the single App routing boundary.',
);
assert(
  launcher.includes("event.key === 'Escape'") && launcher.includes('aria-modal="true"'),
  'Explore launcher must retain dialog and Escape-key behavior.',
);
assert(
  !launcher.includes("from './journey/") && !launcher.includes("from './simulation/") && !launcher.includes('fetch('),
  'Explore launcher must remain presentation/navigation only and must not become simulation or network truth.',
);

console.log(`Explore launcher contract OK: ${destinations.length} direct destinations, persistent + overview entry points, and no truth-path imports.`);
