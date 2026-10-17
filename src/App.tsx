import { useEffect, useState } from 'react';
import { CompleteWorkspace } from './redesign/CompleteWorkspace';
import { WORKSPACE_CATALOG, type ExploreDestination } from './workspace-catalog';
import { resolveAppRoute } from './navigation';

export default function App() {
  const [path, setPath] = useState(() => location.pathname + location.search);
  const [origin,setOrigin] = useState<string|null>(null);
  useEffect(() => {
    const change = () => setPath(location.pathname + location.search);
    window.addEventListener('popstate', change);
    return () => window.removeEventListener('popstate', change);
  }, []);
  const url = new URL(path, location.origin);
  const route=resolveAppRoute(url.pathname,url.search),stress=url.searchParams.get('stress'),destination:ExploreDestination|null=stress==='as-density'?'internet':stress==='builder-density'?'builder':stress==='physical-density'?'physical':route.destination;
  useEffect(()=>{document.title=destination?WORKSPACE_CATALOG[destination].name+' · HOPSCOTCH':'HOPSCOTCH · See the Internet happen';if(route.kind==='legacy-journey'){const next=WORKSPACE_CATALOG.journey.path+url.search;history.replaceState(null,'',next);setPath(next);}},[destination,route.kind,url.search]);
  const navigate = (id: ExploreDestination | null, search = '') => {
    setOrigin(null);
    const next = (id ? WORKSPACE_CATALOG[id].path : '/') + search;
    if (next !== location.pathname + location.search) history.pushState(null, '', next);
    setPath(next);
  };
  return <div className="hopscotch-app">
    {destination && <nav className="app-navigation" aria-label="HOPSCOTCH workspaces">
      <a href="/" aria-current={!destination ? 'page' : undefined} onClick={event => {event.preventDefault();navigate(null);}}>Home</a>
      <a href="/journey" aria-current={destination === 'journey' ? 'page' : undefined} onClick={event => {event.preventDefault();navigate('journey');}}>Journey</a>
      <a href={WORKSPACE_CATALOG.tcp.path} aria-current={destination && ['tcp','dns','tls','http','packet','failure'].includes(destination) ? 'page' : undefined} onClick={event => {event.preventDefault();navigate('tcp');}}>Protocols & packets</a>
      <a href={WORKSPACE_CATALOG.builder.path} aria-current={destination === 'builder' ? 'page' : undefined} onClick={event => {event.preventDefault();navigate('builder');}}>Network Builder</a>
      <a href="/measured" aria-current={destination && ['measured','capture','observed','physical','internet'].includes(destination) ? 'page' : undefined} onClick={event => {event.preventDefault();navigate('measured');}}>Evidence & Internet</a>
    </nav>}
    {origin && destination!=='journey' && <button className="app-return" onClick={()=>{history.pushState(null,'',origin);setPath(origin);setOrigin(null);}}>Return to paused Journey</button>}
    <CompleteWorkspace destination={destination} search={url.search} navigate={navigate} inspect={id=>{setOrigin(path);const next=WORKSPACE_CATALOG[id].path;history.pushState(null,'',next);setPath(next);}} />
  </div>;
}
