import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './ScaleInspectorPolish.css';
import './OverviewLayoutStability.css';
import './lab.css';
import './event-effects.css';
import './tcp.css';
import './dns.css';
import './tls.css';
import './http-comparison.css';
import './protocol-workspaces.css';
import './VisualPlayback.css';
import './FullUiPolish.css';
import './FullUiPolishFixups.css';
import './dns-geometry.css';
import './JourneyDnsGeometry.css';
import './JourneyDefaultLight.css';
import './JourneyDefaultLightShell.css';
import './JourneyDefaultLightAuditFixes.css';
import './JourneyDefaultLightPhase5.css';
import './JourneyLightRefinement.css';
import './JourneyLightRefinementAudit.css';
import './JourneyMotionShape.css';
import './JourneyMotionTimingFixes.css';
import './JourneyShapeRefinement.css';
import './JourneyShapeStateCorrections.css';

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
