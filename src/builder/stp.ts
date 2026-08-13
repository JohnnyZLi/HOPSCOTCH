import type { BuilderEthernetConfig, BuilderEthernetDevice, BuilderEthernetLink } from './ethernet.ts';

export interface BuilderStpConfig {
  enabled: boolean;
  bridgePriorities: Record<string, number>;
}

export interface BuilderStpPortState {
  linkId: string;
  a: string;
  b: string;
  state: 'FORWARDING' | 'BLOCKING' | 'DOWN' | 'NOT-STP';
  blockedAt: string | null;
  reason: string;
}

export interface BuilderStpState {
  vlanId: number;
  enabled: boolean;
  rootBridgeId: string | null;
  rootBridgeLabel: string | null;
  loopDetected: boolean;
  ports: BuilderStpPortState[];
  blockedLinkIds: string[];
  forwardingLinkIds: string[];
  explanation: string;
}

export function createDefaultBuilderStpConfig(): BuilderStpConfig { return { enabled: true, bridgePriorities: {} }; }
export function cloneBuilderStpConfig(config: BuilderStpConfig | undefined): BuilderStpConfig { return { enabled: config?.enabled !== false, bridgePriorities: { ...(config?.bridgePriorities ?? {}) } }; }

function carriesVlan(link: BuilderEthernetLink, vlanId: number): boolean {
  if (link.failed) return false;
  return link.mode === 'access' ? link.accessVlan === vlanId : Boolean(link.allowedVlans?.includes(vlanId));
}

function deviceById(config: BuilderEthernetConfig, id: string): BuilderEthernetDevice | undefined { return config.devices.find((device)=>device.id===id); }
function switchIds(config: BuilderEthernetConfig): string[] { return config.devices.filter((device)=>device.kind==='switch').map((device)=>device.id).sort(); }
function priority(config: BuilderEthernetConfig, id: string): number { return config.stp?.bridgePriorities?.[id] ?? 32768; }
function bridgeKey(config: BuilderEthernetConfig, id: string): string {
  const device=deviceById(config,id); return `${String(priority(config,id)).padStart(5,'0')}:${device?.mac??'ff:ff:ff:ff:ff:ff'}:${id}`;
}

export function validateBuilderStpConfig(config: BuilderEthernetConfig, input: BuilderStpConfig | undefined): BuilderStpConfig {
  const next=cloneBuilderStpConfig(input);
  const switches=new Set(switchIds(config));
  const priorities:Record<string,number>={};
  for(const [id,value] of Object.entries(next.bridgePriorities)){
    if(!switches.has(id))continue;
    if(!Number.isInteger(value)||value<0||value>61440||value%4096!==0)throw new Error(`STP bridge priority for ${id} must be 0–61440 in increments of 4096.`);
    priorities[id]=value;
  }
  return { enabled: next.enabled, bridgePriorities: priorities };
}

function activeSwitchEdges(config: BuilderEthernetConfig, vlanId: number): Array<{linkId:string;a:string;b:string}> {
  return config.links.filter((link)=>{
    if(!carriesVlan(link,vlanId))return false;
    return deviceById(config,link.a)?.kind==='switch'&&deviceById(config,link.b)?.kind==='switch';
  }).map((link)=>({linkId:link.id,a:link.a,b:link.b})).sort((x,y)=>x.linkId.localeCompare(y.linkId));
}

function hasCycle(nodes:string[],edges:Array<{a:string;b:string}>): boolean {
  const parent=new Map(nodes.map((id)=>[id,id]));
  const find=(id:string):string=>{const p=parent.get(id)??id;if(p===id)return id;const root=find(p);parent.set(id,root);return root;};
  for(const edge of edges){const a=find(edge.a),b=find(edge.b);if(a===b)return true;parent.set(a,b);} return false;
}

export function builderStpState(config: BuilderEthernetConfig, vlanId: number): BuilderStpState {
  const switches=switchIds(config);
  const edges=activeSwitchEdges(config,vlanId);
  const loopDetected=hasCycle(switches,edges);
  if(switches.length===0)return{vlanId,enabled:config.stp?.enabled!==false,rootBridgeId:null,rootBridgeLabel:null,loopDetected:false,ports:[],blockedLinkIds:[],forwardingLinkIds:[],explanation:'No switches participate in this VLAN.'};
  const root=[...switches].sort((a,b)=>bridgeKey(config,a).localeCompare(bridgeKey(config,b)))[0];
  const enabled=config.stp?.enabled!==false;
  if(!enabled){
    const ports=config.links.map((link):BuilderStpPortState=>{
      if(link.failed)return{linkId:link.id,a:link.a,b:link.b,state:'DOWN',blockedAt:null,reason:'Physical link is down.'};
      const aSwitch=deviceById(config,link.a)?.kind==='switch',bSwitch=deviceById(config,link.b)?.kind==='switch';
      if(!aSwitch||!bSwitch||!carriesVlan(link,vlanId))return{linkId:link.id,a:link.a,b:link.b,state:'NOT-STP',blockedAt:null,reason:'Not an active switch-to-switch segment for this VLAN.'};
      return{linkId:link.id,a:link.a,b:link.b,state:'FORWARDING',blockedAt:null,reason:'STP disabled; redundant switch links all forward.'};
    });
    return{vlanId,enabled:false,rootBridgeId:root,rootBridgeLabel:deviceById(config,root)?.label??root,loopDetected,ports,blockedLinkIds:[],forwardingLinkIds:ports.filter((p)=>p.state==='FORWARDING').map((p)=>p.linkId),explanation:loopDetected?'STP is disabled while this VLAN contains a Layer-2 cycle. Broadcast/unknown-unicast traffic can circulate and is treated as unsafe.':'STP is disabled; the active switch graph has no cycle.'};
  }

  type Candidate={id:string;cost:number;path:string[];parentLink:string|null};
  const best=new Map<string,Candidate>(); best.set(root,{id:root,cost:0,path:[root],parentLink:null});
  const settled=new Set<string>();
  const adjacency=new Map<string,Array<{id:string;linkId:string}>>(switches.map((id)=>[id,[]]));
  for(const edge of edges){adjacency.get(edge.a)?.push({id:edge.b,linkId:edge.linkId});adjacency.get(edge.b)?.push({id:edge.a,linkId:edge.linkId});}
  for(const values of adjacency.values())values.sort((a,b)=>bridgeKey(config,a.id).localeCompare(bridgeKey(config,b.id))||a.linkId.localeCompare(b.linkId));
  while(true){
    let current:Candidate|undefined;
    for(const candidate of best.values())if(!settled.has(candidate.id)&&(!current||candidate.cost<current.cost||(candidate.cost===current.cost&&candidate.path.map((id)=>bridgeKey(config,id)).join('|').localeCompare(current.path.map((id)=>bridgeKey(config,id)).join('|'))<0)))current=candidate;
    if(!current)break;settled.add(current.id);
    for(const edge of adjacency.get(current.id)??[]){if(settled.has(edge.id))continue;const next:Candidate={id:edge.id,cost:current.cost+1,path:[...current.path,edge.id],parentLink:edge.linkId};const prior=best.get(edge.id);if(!prior||next.cost<prior.cost||(next.cost===prior.cost&&next.path.map((id)=>bridgeKey(config,id)).join('|').localeCompare(prior.path.map((id)=>bridgeKey(config,id)).join('|'))<0))best.set(edge.id,next);}
  }

  const parentLinks=new Set([...best.values()].flatMap((candidate)=>candidate.parentLink?[candidate.parentLink]:[]));
  const ports=config.links.map((link):BuilderStpPortState=>{
    if(link.failed)return{linkId:link.id,a:link.a,b:link.b,state:'DOWN',blockedAt:null,reason:'Physical link is down.'};
    const aSwitch=deviceById(config,link.a)?.kind==='switch',bSwitch=deviceById(config,link.b)?.kind==='switch';
    if(!aSwitch||!bSwitch||!carriesVlan(link,vlanId))return{linkId:link.id,a:link.a,b:link.b,state:'NOT-STP',blockedAt:null,reason:'Access/edge segment or VLAN not carried.'};
    if(parentLinks.has(link.id))return{linkId:link.id,a:link.a,b:link.b,state:'FORWARDING',blockedAt:null,reason:'Root/designated tree edge.'};
    const aBest=best.get(link.a),bBest=best.get(link.b);
    if(!aBest||!bBest)return{linkId:link.id,a:link.a,b:link.b,state:'BLOCKING',blockedAt:aBest?link.b:link.a,reason:'Segment is outside the root component.'};
    const aRank=`${String(aBest.cost).padStart(6,'0')}:${bridgeKey(config,link.a)}`; const bRank=`${String(bBest.cost).padStart(6,'0')}:${bridgeKey(config,link.b)}`;
    const blockedAt=aRank<=bRank?link.b:link.a;
    return{linkId:link.id,a:link.a,b:link.b,state:'BLOCKING',blockedAt,reason:`Redundant segment blocked at ${deviceById(config,blockedAt)?.label??blockedAt}; lower root-path/bridge ID remains designated.`};
  });
  const blockedLinkIds=ports.filter((port)=>port.state==='BLOCKING').map((port)=>port.linkId);
  return{vlanId,enabled:true,rootBridgeId:root,rootBridgeLabel:deviceById(config,root)?.label??root,loopDetected,ports,blockedLinkIds,forwardingLinkIds:ports.filter((p)=>p.state==='FORWARDING').map((p)=>p.linkId),explanation:blockedLinkIds.length>0?`${deviceById(config,root)?.label??root} is root; ${blockedLinkIds.length} redundant segment${blockedLinkIds.length===1?'':'s'} blocked for VLAN ${vlanId}.`:`${deviceById(config,root)?.label??root} is root; this VLAN needs no blocked switch segment.`};
}

export function builderStpBlocksLink(config: BuilderEthernetConfig, linkId: string, vlanId: number): boolean {
  return builderStpState(config,vlanId).blockedLinkIds.includes(linkId);
}
