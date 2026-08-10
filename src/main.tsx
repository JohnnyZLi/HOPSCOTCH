import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './lab.css';
import './visual-audit.css';
import './event-effects.css';
import './packet.css';
import './tcp.css';
import './tcp-audit.css';
import './dns.css';
import './dns-audit.css';
import './tls.css';
import './journey-audit.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
