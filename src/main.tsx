import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './lab.css';
import './visual-audit.css';
import './event-effects.css';
import './tcp.css';
import './tcp-audit.css';
import './dns.css';
import './dns-audit.css';
import './tls.css';
import './http-comparison.css';
import './journey-audit.css';

type StressProfile = 'as-density' | 'builder-density' | 'physical-density';

const StressHarness = lazy(() => import('./StressHarness').then((module) => ({ default: module.StressHarness })));

function stressProfileFromSearch(search: string): StressProfile | null {
  const value = new URLSearchParams(search).get('stress');
  return value === 'as-density' || value === 'builder-density' || value === 'physical-density' ? value : null;
}

const stressProfile = typeof window === 'undefined' ? null : stressProfileFromSearch(window.location.search);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {stressProfile ? (
      <Suspense fallback={<main className="app-shell stress-harness"><div className="lab-loading">LOADING STRESS PROFILE…</div></main>}>
        <StressHarness profile={stressProfile} />
      </Suspense>
    ) : <App />}
  </StrictMode>,
);
