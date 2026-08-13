import {
  builderEthernetDeviceById,
  builderEthernetInterfaceFor,
  builderEthernetPathForVlan,
  cloneBuilderEthernetConfig,
  type BuilderEthernetConfig,
  type BuilderEthernetDevice,
} from './ethernet.ts';

export interface BuilderDhcpPool {
  id: string;
  serverDeviceId: string;
  vlanId: number;
  startAddress: string;
  endAddress: string;
  gateway: string | null;
  dnsServers: string[];
  leaseSteps: number;
}

export interface BuilderDhcpRelay {
  id: string;
  routerId: string;
  clientVlanId: number;
  serverDeviceId: string;
  serverVlanId: number;
}

export interface BuilderDhcpConfig {
  clientDeviceIds: string[];
  pools: BuilderDhcpPool[];
  relays: BuilderDhcpRelay[];
}

export interface BuilderDhcpLease {
  id: string;
  clientDeviceId: string;
  clientMac: string;
  poolId: string;
  serverDeviceId: string;
  vlanId: number;
  address: string;
  subnetMask: string;
  gateway: string | null;
  dnsServers: string[];
  acquiredAtSequence: number;
  renewedAtSequence: number;
  renewAtSequence: number;
  rebindAtSequence: number;
  expiresAtSequence: number;
}

export type BuilderDhcpLeaseTable = BuilderDhcpLease[];

export type BuilderDhcpEventKind = 'DISCOVER' | 'OFFER' | 'REQUEST' | 'ACK' | 'RENEW' | 'REBIND' | 'NAK' | 'TIMEOUT' | 'RELEASE' | 'EXPIRE';

export interface BuilderDhcpEvent {
  kind: BuilderDhcpEventKind;
  sourceDeviceId: string;
  destinationDeviceId: string | null;
  vlanId: number;
  relayed: boolean;
  nodeIds: string[];
  linkIds: string[];
  detail: string;
}

export interface BuilderDhcpTransaction {
  id: string;
  sequence: number;
  clientDeviceId: string;
  success: boolean;
  configurationReady: boolean;
  relayed: boolean;
  events: BuilderDhcpEvent[];
  lease: BuilderDhcpLease | null;
  leases: BuilderDhcpLeaseTable;
  optionsIssues: string[];
  failureReason: string | null;
  summary: string;
}

const IPV4_RE=/^(?:\d{1,3}\.){3}\d{1,3}$/;
function validIpv4(value:string):boolean{return IPV4_RE.test(value)&&value.split('.').every((part)=>Number(part)>=0&&Number(part)<=255);}
function ipv4ToInt(value:string):number{if(!validIpv4(value))throw new Error(`Invalid IPv4 address ${value}.`);return value.split('.').reduce((result,part)=>((result<<8)|Number(part))>>>0,0)>>>0;}
function intToIpv4(value:number):string{const v=value>>>0;return[24,16,8,0].map((shift)=>(v>>>shift)&255).join('.');}
function prefixLength(cidr:string):number{const part=cidr.split('/')[1];const value=Number(part);if(!Number.isInteger(value)||value<8||value>30)throw new Error(`Invalid DHCP VLAN CIDR ${cidr}.`);return value;}
function maskForPrefix(prefix:number):number{return prefix===0?0:(0xffffffff<<(32-prefix))>>>0;}
function subnetMaskForCidr(cidr:string):string{return intToIpv4(maskForPrefix(prefixLength(cidr)));}
function networkAndBroadcast(cidr:string):{network:number;broadcast:number}{const [address]=cidr.split('/');const prefix=prefixLength(cidr);const mask=maskForPrefix(prefix);const network=(ipv4ToInt(address)&mask)>>>0;return{network,broadcast:(network|(~mask>>>0))>>>0};}
function addressInCidr(address:string,cidr:string):boolean{const value=ipv4ToInt(address);const range=networkAndBroadcast(cidr);return value>=range.network&&value<=range.broadcast;}
function isUsable(address:string,cidr:string):boolean{const value=ipv4ToInt(address);const range=networkAndBroadcast(cidr);return value>range.network&&value<range.broadcast;}
function device(config:BuilderEthernetConfig,id:string):BuilderEthernetDevice|undefined{return builderEthernetDeviceById(config,id);}
function vlanOfClient(config:BuilderEthernetConfig,id:string):number|null{const endpoint=device(config,id);return endpoint?.kind==='endpoint'?endpoint.interfaces[0]?.vlanId??null:null;}
function uniqueSorted(values:readonly string[]):string[]{return[...new Set(values)].sort();}

export function createEmptyBuilderDhcpConfig():BuilderDhcpConfig{return{clientDeviceIds:[],pools:[],relays:[]};}

export function createDefaultBuilderDhcpConfig(ethernet:BuilderEthernetConfig):BuilderDhcpConfig{
  if(ethernet.devices.length===0)return createEmptyBuilderDhcpConfig();
  const server=ethernet.devices.find((entry)=>entry.id==='lan-r1'&&entry.kind==='router')??ethernet.devices.find((entry)=>entry.kind==='router');
  if(!server)return createEmptyBuilderDhcpConfig();
  const pools:BuilderDhcpPool[]=[];
  for(const iface of server.interfaces){
    const vlan=ethernet.vlans.find((candidate)=>candidate.id===iface.vlanId);if(!vlan)continue;
    const range=networkAndBroadcast(vlan.cidr);
    const start=Math.min(range.broadcast-1,range.network+100);const end=Math.min(range.broadcast-1,range.network+199);
    if(start>end)continue;
    pools.push({id:`dhcp-${server.id}-v${vlan.id}`,serverDeviceId:server.id,vlanId:vlan.id,startAddress:intToIpv4(start),endAddress:intToIpv4(end),gateway:iface.address,dnsServers:['1.1.1.1','8.8.8.8'],leaseSteps:64});
  }
  return{clientDeviceIds:[],pools,relays:[]};
}

export function cloneBuilderDhcpConfig(config:BuilderDhcpConfig):BuilderDhcpConfig{return{clientDeviceIds:[...config.clientDeviceIds],pools:config.pools.map((pool)=>({...pool,dnsServers:[...pool.dnsServers]})),relays:config.relays.map((relay)=>({...relay}))};}
export function cloneBuilderDhcpLeases(leases:BuilderDhcpLeaseTable):BuilderDhcpLeaseTable{return leases.map((lease)=>({...lease,dnsServers:[...lease.dnsServers]}));}
export function clearBuilderDhcpLeases():BuilderDhcpLeaseTable{return[];}

export function validateBuilderDhcpConfig(ethernet:BuilderEthernetConfig,input:BuilderDhcpConfig):BuilderDhcpConfig{
  if(!input||!Array.isArray(input.clientDeviceIds)||!Array.isArray(input.pools)||!Array.isArray(input.relays))throw new Error('DHCP config requires client, pool, and relay arrays.');
  if(input.clientDeviceIds.length>24||input.pools.length>32||input.relays.length>32)throw new Error('DHCP teaching model exceeds its bounded client/pool/relay ceiling.');
  const endpointIds=new Set(ethernet.devices.filter((entry)=>entry.kind==='endpoint').map((entry)=>entry.id));
  const routerIds=new Set(ethernet.devices.filter((entry)=>entry.kind==='router').map((entry)=>entry.id));
  const vlanIds=new Set(ethernet.vlans.map((vlan)=>vlan.id));
  const clientDeviceIds=uniqueSorted(input.clientDeviceIds);
  if(clientDeviceIds.some((id)=>!endpointIds.has(id)))throw new Error('DHCP clients must reference Ethernet endpoint devices.');
  const poolIds=new Set<string>();
  const pools=input.pools.map((raw,index):BuilderDhcpPool=>{
    if(!raw||typeof raw!=='object'||!/^[a-zA-Z0-9_-]+$/.test(raw.id)||poolIds.has(raw.id))throw new Error(`DHCP pool ${index+1} id is invalid or duplicated.`);
    const server=device(ethernet,raw.serverDeviceId);if(!server||server.kind==='switch')throw new Error(`DHCP pool ${raw.id} server must be an endpoint or router device.`);
    const vlan=ethernet.vlans.find((candidate)=>candidate.id===raw.vlanId);if(!vlan||!vlanIds.has(raw.vlanId))throw new Error(`DHCP pool ${raw.id} references an unknown VLAN.`);
    if(!validIpv4(raw.startAddress)||!validIpv4(raw.endAddress)||!isUsable(raw.startAddress,vlan.cidr)||!isUsable(raw.endAddress,vlan.cidr)||ipv4ToInt(raw.startAddress)>ipv4ToInt(raw.endAddress))throw new Error(`DHCP pool ${raw.id} range must be ordered usable addresses inside VLAN ${raw.vlanId}.`);
    const gateway=raw.gateway==null||raw.gateway===''?null:raw.gateway;if(gateway&&!isUsable(gateway,vlan.cidr))throw new Error(`DHCP pool ${raw.id} gateway must be a usable VLAN ${raw.vlanId} address.`);
    const dnsServers=uniqueSorted(raw.dnsServers??[]);if(dnsServers.some((address)=>!validIpv4(address)))throw new Error(`DHCP pool ${raw.id} has an invalid DNS option.`);
    if(!Number.isInteger(raw.leaseSteps)||raw.leaseSteps<4||raw.leaseSteps>100000)throw new Error(`DHCP pool ${raw.id} leaseSteps must be 4–100000.`);
    poolIds.add(raw.id);return{id:raw.id,serverDeviceId:raw.serverDeviceId,vlanId:raw.vlanId,startAddress:raw.startAddress,endAddress:raw.endAddress,gateway,dnsServers,leaseSteps:raw.leaseSteps};
  }).sort((a,b)=>a.vlanId-b.vlanId||a.id.localeCompare(b.id));
  const relayIds=new Set<string>();
  const relays=input.relays.map((raw,index):BuilderDhcpRelay=>{
    if(!raw||typeof raw!=='object'||!/^[a-zA-Z0-9_-]+$/.test(raw.id)||relayIds.has(raw.id))throw new Error(`DHCP relay ${index+1} id is invalid or duplicated.`);
    if(!routerIds.has(raw.routerId))throw new Error(`DHCP relay ${raw.id} must reference a router.`);
    if(!vlanIds.has(raw.clientVlanId)||!vlanIds.has(raw.serverVlanId))throw new Error(`DHCP relay ${raw.id} references an unknown VLAN.`);
    const router=device(ethernet,raw.routerId);if(!builderEthernetInterfaceFor(router,raw.clientVlanId)||!builderEthernetInterfaceFor(router,raw.serverVlanId))throw new Error(`DHCP relay ${raw.id} router needs interfaces in client and server VLANs.`);
    const server=device(ethernet,raw.serverDeviceId);if(!server||!builderEthernetInterfaceFor(server,raw.serverVlanId))throw new Error(`DHCP relay ${raw.id} server must have an interface in server VLAN ${raw.serverVlanId}.`);
    relayIds.add(raw.id);return{...raw};
  }).sort((a,b)=>a.clientVlanId-b.clientVlanId||a.id.localeCompare(b.id));
  for(const pool of pools){
    const server=device(ethernet,pool.serverDeviceId)!;
    const local=Boolean(builderEthernetInterfaceFor(server,pool.vlanId));
    const relayed=relays.some((relay)=>relay.clientVlanId===pool.vlanId&&relay.serverDeviceId===pool.serverDeviceId);
    if(!local&&!relayed)throw new Error(`DHCP pool ${pool.id} server is neither local to VLAN ${pool.vlanId} nor reachable through a configured relay.`);
  }
  return{clientDeviceIds,pools,relays};
}

export function reconcileBuilderDhcpConfig(ethernet:BuilderEthernetConfig,input:BuilderDhcpConfig):BuilderDhcpConfig{
  const deviceIds=new Set(ethernet.devices.map((entry)=>entry.id));const vlanIds=new Set(ethernet.vlans.map((vlan)=>vlan.id));
  const candidate={clientDeviceIds:input.clientDeviceIds.filter((id)=>deviceIds.has(id)),pools:input.pools.filter((pool)=>deviceIds.has(pool.serverDeviceId)&&vlanIds.has(pool.vlanId)),relays:input.relays.filter((relay)=>deviceIds.has(relay.routerId)&&deviceIds.has(relay.serverDeviceId)&&vlanIds.has(relay.clientVlanId)&&vlanIds.has(relay.serverVlanId))};
  try{return validateBuilderDhcpConfig(ethernet,candidate);}catch{return createEmptyBuilderDhcpConfig();}
}

export function setBuilderDhcpClient(ethernet:BuilderEthernetConfig,config:BuilderDhcpConfig,clientDeviceId:string,enabled:boolean):BuilderDhcpConfig{
  const next=cloneBuilderDhcpConfig(config);next.clientDeviceIds=enabled?uniqueSorted([...next.clientDeviceIds,clientDeviceId]):next.clientDeviceIds.filter((id)=>id!==clientDeviceId);return validateBuilderDhcpConfig(ethernet,next);
}
export function upsertBuilderDhcpPool(ethernet:BuilderEthernetConfig,config:BuilderDhcpConfig,pool:BuilderDhcpPool):BuilderDhcpConfig{const next=cloneBuilderDhcpConfig(config);next.pools=[...next.pools.filter((entry)=>entry.id!==pool.id),{...pool,dnsServers:[...pool.dnsServers]}];return validateBuilderDhcpConfig(ethernet,next);}
export function deleteBuilderDhcpPool(ethernet:BuilderEthernetConfig,config:BuilderDhcpConfig,id:string):BuilderDhcpConfig{return validateBuilderDhcpConfig(ethernet,{...cloneBuilderDhcpConfig(config),pools:config.pools.filter((pool)=>pool.id!==id)});}
export function upsertBuilderDhcpRelay(ethernet:BuilderEthernetConfig,config:BuilderDhcpConfig,relay:BuilderDhcpRelay):BuilderDhcpConfig{const next=cloneBuilderDhcpConfig(config);next.relays=[...next.relays.filter((entry)=>entry.id!==relay.id),{...relay}];return validateBuilderDhcpConfig(ethernet,next);}

function pathForDhcp(ethernet:BuilderEthernetConfig,clientId:string,pool:BuilderDhcpPool,config:BuilderDhcpConfig):{relayed:boolean;requestNodes:string[];requestLinks:string[];responseNodes:string[];responseLinks:string[]}|null{
  const clientVlan=vlanOfClient(ethernet,clientId);if(clientVlan==null)return null;
  const server=device(ethernet,pool.serverDeviceId);if(!server)return null;
  if(builderEthernetInterfaceFor(server,clientVlan)){
    const path=builderEthernetPathForVlan(ethernet,clientId,server.id,clientVlan);if(!path)return null;
    return{relayed:false,requestNodes:path.nodeIds,requestLinks:path.linkIds,responseNodes:[...path.nodeIds].reverse(),responseLinks:[...path.linkIds].reverse()};
  }
  const relay=config.relays.find((entry)=>entry.clientVlanId===clientVlan&&entry.serverDeviceId===pool.serverDeviceId);if(!relay)return null;
  const clientLeg=builderEthernetPathForVlan(ethernet,clientId,relay.routerId,clientVlan);const serverLeg=builderEthernetPathForVlan(ethernet,relay.routerId,pool.serverDeviceId,relay.serverVlanId);if(!clientLeg||!serverLeg)return null;
  const nodes=[...clientLeg.nodeIds,...serverLeg.nodeIds.slice(1)];const links=[...clientLeg.linkIds,...serverLeg.linkIds];
  return{relayed:true,requestNodes:nodes,requestLinks:links,responseNodes:[...nodes].reverse(),responseLinks:[...links].reverse()};
}

function usedAddresses(ethernet:BuilderEthernetConfig,config:BuilderDhcpConfig,leases:BuilderDhcpLeaseTable,pool:BuilderDhcpPool):Set<number>{
  const dhcpClients=new Set(config.clientDeviceIds);const used=new Set<number>();
  for(const entry of ethernet.devices){for(const iface of entry.interfaces){if(iface.vlanId!==pool.vlanId)continue;if(entry.kind==='endpoint'&&dhcpClients.has(entry.id))continue;used.add(ipv4ToInt(iface.address));}}
  for(const lease of leases)if(lease.poolId===pool.id)used.add(ipv4ToInt(lease.address));
  return used;
}
function allocateAddress(ethernet:BuilderEthernetConfig,config:BuilderDhcpConfig,leases:BuilderDhcpLeaseTable,pool:BuilderDhcpPool):string|null{const used=usedAddresses(ethernet,config,leases,pool);for(let value=ipv4ToInt(pool.startAddress);value<=ipv4ToInt(pool.endAddress);value+=1)if(!used.has(value))return intToIpv4(value);return null;}
function optionsIssues(pool:BuilderDhcpPool):string[]{const issues:string[]=[];if(!pool.gateway)issues.push('DEFAULT GATEWAY MISSING');if(pool.dnsServers.length===0)issues.push('DNS OPTION MISSING');return issues;}
function leaseFor(client:BuilderEthernetDevice,pool:BuilderDhcpPool,address:string,vlanCidr:string,sequence:number):BuilderDhcpLease{const leaseSteps=pool.leaseSteps;return{id:`lease:${client.id}:${pool.id}:${address}`,clientDeviceId:client.id,clientMac:client.mac,poolId:pool.id,serverDeviceId:pool.serverDeviceId,vlanId:pool.vlanId,address,subnetMask:subnetMaskForCidr(vlanCidr),gateway:pool.gateway,dnsServers:[...pool.dnsServers],acquiredAtSequence:sequence,renewedAtSequence:sequence,renewAtSequence:sequence+Math.max(1,Math.floor(leaseSteps*.5)),rebindAtSequence:sequence+Math.max(2,Math.floor(leaseSteps*.875)),expiresAtSequence:sequence+leaseSteps};}
function upsertLease(leases:BuilderDhcpLeaseTable,lease:BuilderDhcpLease):BuilderDhcpLeaseTable{return[...leases.filter((entry)=>entry.clientDeviceId!==lease.clientDeviceId),lease].sort((a,b)=>a.clientDeviceId.localeCompare(b.clientDeviceId));}
export function pruneBuilderDhcpLeases(leases:BuilderDhcpLeaseTable,sequence:number):BuilderDhcpLeaseTable{return leases.filter((lease)=>sequence<=lease.expiresAtSequence).map((lease)=>({...lease,dnsServers:[...lease.dnsServers]}));}

export function runBuilderDhcpAcquire(ethernetInput:BuilderEthernetConfig,configInput:BuilderDhcpConfig,leasesInput:BuilderDhcpLeaseTable,clientDeviceId:string,sequence=1):BuilderDhcpTransaction{
  const ethernet=ethernetInput;const config=validateBuilderDhcpConfig(ethernet,configInput);const leases=pruneBuilderDhcpLeases(leasesInput,sequence);const client=device(ethernet,clientDeviceId);const vlanId=vlanOfClient(ethernet,clientDeviceId);
  const fail=(reason:string,events:BuilderDhcpEvent[]=[]):BuilderDhcpTransaction=>({id:`dhcp-${sequence}-${clientDeviceId}`,sequence,clientDeviceId,success:false,configurationReady:false,relayed:events.some((event)=>event.relayed),events,lease:null,leases,optionsIssues:[],failureReason:reason,summary:reason});
  if(!client||client.kind!=='endpoint'||vlanId==null)return fail('DHCP client must be an Ethernet endpoint with one access VLAN.');
  if(!config.clientDeviceIds.includes(clientDeviceId))return fail(`${client.label} is configured for STATIC IPv4, not DHCP.`);
  const existing=leases.find((lease)=>lease.clientDeviceId===clientDeviceId);if(existing&&sequence<=existing.expiresAtSequence)return{...fail(`${client.label} already has active lease ${existing.address}.`),lease:existing};
  const pools=config.pools.filter((pool)=>pool.vlanId===vlanId).sort((a,b)=>a.id.localeCompare(b.id));if(pools.length===0)return fail(`No DHCP pool serves VLAN ${vlanId}.`);
  let selected:BuilderDhcpPool|null=null;let path:ReturnType<typeof pathForDhcp>=null;
  for(const pool of pools){const candidate=pathForDhcp(ethernet,clientDeviceId,pool,config);if(candidate){selected=pool;path=candidate;break;}}
  if(!selected||!path)return fail(`DHCP DISCOVER in VLAN ${vlanId} cannot reach any configured server or relay path.`);
  const address=allocateAddress(ethernet,config,leases,selected);if(!address)return fail(`DHCP pool ${selected.id} is exhausted.`,[{kind:'DISCOVER',sourceDeviceId:client.id,destinationDeviceId:selected.serverDeviceId,vlanId,relayed:path.relayed,nodeIds:path.requestNodes,linkIds:path.requestLinks,detail:path.relayed?'Broadcast reached relay; relay forwarded DISCOVER to server.':'DISCOVER broadcast reached local server.'}]);
  const vlan=ethernet.vlans.find((entry)=>entry.id===vlanId)!;const lease=leaseFor(client,selected,address,vlan.cidr,sequence);const issues=optionsIssues(selected);
  const events:BuilderDhcpEvent[]=[
    {kind:'DISCOVER',sourceDeviceId:client.id,destinationDeviceId:selected.serverDeviceId,vlanId,relayed:path.relayed,nodeIds:path.requestNodes,linkIds:path.requestLinks,detail:path.relayed?'Client broadcast reaches relay; relay forwards DISCOVER across the routed boundary.':'Client broadcasts DHCPDISCOVER inside its VLAN.'},
    {kind:'OFFER',sourceDeviceId:selected.serverDeviceId,destinationDeviceId:client.id,vlanId,relayed:path.relayed,nodeIds:path.responseNodes,linkIds:path.responseLinks,detail:`Server offers ${address} from ${selected.id}.`},
    {kind:'REQUEST',sourceDeviceId:client.id,destinationDeviceId:selected.serverDeviceId,vlanId,relayed:path.relayed,nodeIds:path.requestNodes,linkIds:path.requestLinks,detail:`Client requests offered address ${address}.`},
    {kind:'ACK',sourceDeviceId:selected.serverDeviceId,destinationDeviceId:client.id,vlanId,relayed:path.relayed,nodeIds:path.responseNodes,linkIds:path.responseLinks,detail:`Server ACKs ${address}/${prefixLength(vlan.cidr)} · GW ${selected.gateway??'MISSING'} · DNS ${selected.dnsServers.join(', ')||'MISSING'}.`},
  ];
  const next=upsertLease(leases,lease);const ready=issues.length===0;
  return{id:`dhcp-${sequence}-${clientDeviceId}`,sequence,clientDeviceId,success:true,configurationReady:ready,relayed:path.relayed,events,lease,leases:next,optionsIssues:issues,failureReason:null,summary:ready?`${client.label} leased ${address} through ${path.relayed?'DHCP relay':'local DHCP'}; host IPv4/gateway/DNS state is ready.`:`${client.label} leased ${address}, but ACK options are incomplete: ${issues.join(' · ')}.`};
}

export function renewBuilderDhcpLease(ethernet:BuilderEthernetConfig,configInput:BuilderDhcpConfig,leasesInput:BuilderDhcpLeaseTable,clientDeviceId:string,sequence:number):BuilderDhcpTransaction{
  const config=validateBuilderDhcpConfig(ethernet,configInput);const leases=pruneBuilderDhcpLeases(leasesInput,sequence);const current=leasesInput.find((lease)=>lease.clientDeviceId===clientDeviceId);const client=device(ethernet,clientDeviceId);
  const fail=(reason:string,events:BuilderDhcpEvent[]=[]):BuilderDhcpTransaction=>({id:`dhcp-renew-${sequence}-${clientDeviceId}`,sequence,clientDeviceId,success:false,configurationReady:false,relayed:events.some((event)=>event.relayed),events,lease:current??null,leases,optionsIssues:[],failureReason:reason,summary:reason});
  if(!client||!current)return fail('No DHCP lease exists for this client.');
  if(sequence>current.expiresAtSequence)return fail(`Lease ${current.address} expired before renewal.`,[{kind:'EXPIRE',sourceDeviceId:client.id,destinationDeviceId:null,vlanId:current.vlanId,relayed:false,nodeIds:[client.id],linkIds:[],detail:`Lease expired at sequence ${current.expiresAtSequence}.`}]);
  const originalPool=config.pools.find((pool)=>pool.id===current.poolId);const originalPath=originalPool?pathForDhcp(ethernet,clientDeviceId,originalPool,config):null;
  let selected=originalPool??null;let path=originalPath;let kind:BuilderDhcpEventKind='RENEW';
  if(!path&&sequence>=current.rebindAtSequence){kind='REBIND';for(const pool of config.pools.filter((entry)=>entry.vlanId===current.vlanId)){const candidate=pathForDhcp(ethernet,clientDeviceId,pool,config);if(candidate){selected=pool;path=candidate;break;}}}
  if(!selected||!path)return fail(sequence>=current.rebindAtSequence?`REBIND broadcast cannot reach any DHCP server before lease expiry ${current.expiresAtSequence}.`:`RENEW to ${current.serverDeviceId} timed out; lease remains valid until rebind/expiry.`,[{kind:'TIMEOUT',sourceDeviceId:client.id,destinationDeviceId:current.serverDeviceId,vlanId:current.vlanId,relayed:false,nodeIds:[client.id],linkIds:[],detail:'No usable DHCP server path.'}]);
  const leaseSteps=selected.leaseSteps;const renewed:{lease:BuilderDhcpLease}={lease:{...current,poolId:selected.id,serverDeviceId:selected.serverDeviceId,gateway:selected.gateway,dnsServers:[...selected.dnsServers],renewedAtSequence:sequence,renewAtSequence:sequence+Math.max(1,Math.floor(leaseSteps*.5)),rebindAtSequence:sequence+Math.max(2,Math.floor(leaseSteps*.875)),expiresAtSequence:sequence+leaseSteps}};
  const next=upsertLease(leases,renewed.lease);const issues=optionsIssues(selected);return{id:`dhcp-renew-${sequence}-${clientDeviceId}`,sequence,clientDeviceId,success:true,configurationReady:issues.length===0,relayed:path.relayed,events:[{kind,sourceDeviceId:client.id,destinationDeviceId:selected.serverDeviceId,vlanId:current.vlanId,relayed:path.relayed,nodeIds:path.requestNodes,linkIds:path.requestLinks,detail:`${kind} requests continued use of ${current.address}.`},{kind:'ACK',sourceDeviceId:selected.serverDeviceId,destinationDeviceId:client.id,vlanId:current.vlanId,relayed:path.relayed,nodeIds:path.responseNodes,linkIds:path.responseLinks,detail:`Lease extended through sequence ${renewed.lease.expiresAtSequence}.`}],lease:renewed.lease,leases:next,optionsIssues:issues,failureReason:null,summary:`${client.label} ${kind==='REBIND'?'rebound':'renewed'} ${current.address}; lease now expires at sequence ${renewed.lease.expiresAtSequence}.`};
}

export function releaseBuilderDhcpLease(leases:BuilderDhcpLeaseTable,clientDeviceId:string,sequence:number):{leases:BuilderDhcpLeaseTable;event:BuilderDhcpEvent|null}{const lease=leases.find((entry)=>entry.clientDeviceId===clientDeviceId);return{leases:leases.filter((entry)=>entry.clientDeviceId!==clientDeviceId),event:lease?{kind:'RELEASE',sourceDeviceId:clientDeviceId,destinationDeviceId:lease.serverDeviceId,vlanId:lease.vlanId,relayed:false,nodeIds:[clientDeviceId],linkIds:[],detail:`Client releases ${lease.address} at sequence ${sequence}.`}:null};}

export function applyBuilderDhcpState(ethernetInput:BuilderEthernetConfig,config:BuilderDhcpConfig,leasesInput:BuilderDhcpLeaseTable,sequence:number):BuilderEthernetConfig{
  const next=cloneBuilderEthernetConfig(ethernetInput);const leases=pruneBuilderDhcpLeases(leasesInput,sequence);const byClient=new Map(leases.map((lease)=>[lease.clientDeviceId,lease]));
  next.devices=next.devices.map((entry)=>{if(entry.kind!=='endpoint'||!config.clientDeviceIds.includes(entry.id))return entry;const lease=byClient.get(entry.id);return{...entry,interfaces:entry.interfaces.map((iface)=>({...iface,address:lease?.address??'0.0.0.0',gateway:lease?.gateway??null}))};});return next;
}

export function builderDhcpClientReady(config:BuilderDhcpConfig,leases:BuilderDhcpLeaseTable,clientDeviceId:string,sequence:number):boolean{return!config.clientDeviceIds.includes(clientDeviceId)||pruneBuilderDhcpLeases(leases,sequence).some((lease)=>lease.clientDeviceId===clientDeviceId);}
