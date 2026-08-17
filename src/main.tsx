import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StressHarness, stressProfileFromSearch } from './StressHarness';
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

const stressProfile = typeof window === 'undefined' ? null : stressProfileFromSearch(window.location.search);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {stressProfile ? <StressHarness profile={stressProfile} /> : <App />}
  </StrictMode>,
);
