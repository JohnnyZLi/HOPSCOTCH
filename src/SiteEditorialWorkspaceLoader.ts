let workspaceThemePromise: Promise<unknown> | null = null;

function loadWorkspaceEditorialTheme(): Promise<unknown> {
  workspaceThemePromise ??= import('./SiteEditorialWorkspaceSystem.css');
  return workspaceThemePromise;
}

function routeNeedsWorkspaceTheme(): boolean {
  if (typeof window === 'undefined') return false;
  const search = new URLSearchParams(window.location.search);
  if (search.has('stress') || search.has('journey')) return true;
  return window.location.pathname !== '/';
}

function domNeedsWorkspaceTheme(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(document.querySelector('.app-shell[data-lab="active"], .stress-harness'));
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (routeNeedsWorkspaceTheme()) void loadWorkspaceEditorialTheme();

  const observer = new MutationObserver(() => {
    if (!domNeedsWorkspaceTheme()) return;
    void loadWorkspaceEditorialTheme();
    observer.disconnect();
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'data-lab'],
  });
}
