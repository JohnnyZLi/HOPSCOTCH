import type { ExploreDestination } from './ExploreLauncher';

export type AppRouteKind = 'overview' | 'lab' | 'legacy-journey' | 'unknown';

export interface AppRouteResolution {
  kind: AppRouteKind;
  destination: ExploreDestination | null;
  canonicalPath: string;
  preserveSearch: boolean;
}

export const DESTINATION_PATHS: Readonly<Record<ExploreDestination, string>> = Object.freeze({
  journey: '/journey',
  failure: '/labs/failure',
  builder: '/labs/builder',
  packet: '/labs/packet',
  tcp: '/labs/tcp',
  dns: '/labs/dns',
  tls: '/labs/tls',
  http: '/labs/http2-vs-http3',
  internet: '/internet/as-routing',
  physical: '/internet/physical',
  observed: '/internet/observed',
  measured: '/measured',
});

const PATH_DESTINATIONS = new Map<string, ExploreDestination>(
  Object.entries(DESTINATION_PATHS).map(
    ([destination, path]) => [path, destination as ExploreDestination] as const,
  ),
);

function normalizePathname(pathname: string): string {
  const raw = pathname.trim() || '/';
  if (raw === '/') return '/';
  return `/${raw.replace(/^\/+|\/+$/g, '')}`;
}

function hasJourneyShareQuery(search: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const version = params.get('journey');
  return version === '1' || version === '2';
}

export function pathForDestination(destination: ExploreDestination): string {
  return DESTINATION_PATHS[destination];
}

export function resolveAppRoute(pathname: string, search = ''): AppRouteResolution {
  const normalizedPath = normalizePathname(pathname);
  const destination = PATH_DESTINATIONS.get(normalizedPath) ?? null;

  if (destination) {
    return {
      kind: 'lab',
      destination,
      canonicalPath: DESTINATION_PATHS[destination],
      preserveSearch: destination === 'journey' && hasJourneyShareQuery(search),
    };
  }

  if (normalizedPath === '/') {
    if (hasJourneyShareQuery(search)) {
      return {
        kind: 'legacy-journey',
        destination: 'journey',
        canonicalPath: DESTINATION_PATHS.journey,
        preserveSearch: true,
      };
    }
    return { kind: 'overview', destination: null, canonicalPath: '/', preserveSearch: false };
  }

  return { kind: 'unknown', destination: null, canonicalPath: '/', preserveSearch: false };
}

export function canonicalUrlForRoute(route: AppRouteResolution, search = ''): string {
  return `${route.canonicalPath}${route.preserveSearch ? search : ''}`;
}
