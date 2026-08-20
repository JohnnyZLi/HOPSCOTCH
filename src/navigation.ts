import { WORKSPACE_PATHS, type ExploreDestination } from './workspace-catalog.ts';

export type AppRouteKind = 'overview' | 'lab' | 'legacy-journey' | 'unknown';

export interface AppRouteResolution {
  kind: AppRouteKind;
  destination: ExploreDestination | null;
  canonicalPath: string;
  preserveSearch: boolean;
}

export const OVERVIEW_PATH = '/';
export const DESTINATION_PATHS = WORKSPACE_PATHS;

const PATH_DESTINATIONS = new Map<string, ExploreDestination>(
  Object.entries(DESTINATION_PATHS).map(
    ([destination, path]) => [path, destination as ExploreDestination] as const,
  ),
);

function normalizePathname(pathname: string): string {
  const raw = pathname.trim() || OVERVIEW_PATH;
  if (raw === OVERVIEW_PATH) return OVERVIEW_PATH;
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

  if (normalizedPath === OVERVIEW_PATH) {
    if (hasJourneyShareQuery(search)) {
      return {
        kind: 'legacy-journey',
        destination: 'journey',
        canonicalPath: DESTINATION_PATHS.journey,
        preserveSearch: true,
      };
    }
    return { kind: 'overview', destination: null, canonicalPath: OVERVIEW_PATH, preserveSearch: false };
  }

  return { kind: 'unknown', destination: null, canonicalPath: OVERVIEW_PATH, preserveSearch: false };
}

export function canonicalUrlForRoute(route: AppRouteResolution, search = ''): string {
  return `${route.canonicalPath}${route.preserveSearch ? search : ''}`;
}
