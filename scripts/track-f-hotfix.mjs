import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
function edit(path,fn){const before=readFileSync(path,'utf8');const after=fn(before);if(after===before)throw new Error(`No hotfix applied to ${path}`);writeFileSync(path,after);}
edit('src/builder/routing-policy.ts',(s)=>s.replace("maxPaths:Math.max(1,Math.min(16,Math.round(Number(entry.maxPaths)||8))};","maxPaths:Math.max(1,Math.min(16,Math.round(Number(entry.maxPaths)||8)))};"));
edit('src/builder/bgp.ts',(s)=>{if(!s.endsWith('\n}\n'))throw new Error('Unexpected BGP file ending');return s.slice(0,-2);});
edit('src/BuilderBgpPanel.tsx',(s)=>{let n=s.replace("sessionState?.mode==='ibgp'?<button","sessionState?.mode==='ibgp'?<><button");n=n.replace("RR CLIENT {selectedSession.routeReflectorClientRouterId?labelFor(graph,selectedSession.routeReflectorClientRouterId):'OFF'}</button>:<><button","RR CLIENT {selectedSession.routeReflectorClientRouterId?labelFor(graph,selectedSession.routeReflectorClientRouterId):'OFF'}</button></>:<><button");return n;});
unlinkSync('scripts/track-f-hotfix.mjs');
