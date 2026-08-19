import { useMemo, useState } from 'react';
import {
  pruneBuilderDhcpLeases,
  releaseBuilderDhcpLease,
  renewBuilderDhcpLease,
  runBuilderDhcpAcquire,
  setBuilderDhcpClient,
  upsertBuilderDhcpPool,
  upsertBuilderDhcpRelay,
  type BuilderDhcpConfig,
  type BuilderDhcpLeaseTable,
  type BuilderDhcpTransaction,
} from './builder/dhcp.ts';
import { builderEthernetInterfaceFor, type BuilderEthernetConfig } from './builder/ethernet.ts';
import './BuilderDhcpPanel.css';

interface BuilderDhcpPanelProps {
  ethernet: BuilderEthernetConfig;
  config: BuilderDhcpConfig;
  onConfigChange: (next: BuilderDhcpConfig) => void;
  leases: BuilderDhcpLeaseTable;
  onLeasesChange: (next: BuilderDhcpLeaseTable) => void;
  sequence: number;
  onSequenceChange: (next: number) => void;
  onMessage: (message: string, deviceIds?: string[]) => void;
  onTransaction?: (transaction: BuilderDhcpTransaction, operation: 'acquire' | 'renew') => void;
  historical?: boolean;
  historicalStage?: { summary: string; detail: string } | null;
}

function labelFor(ethernet:BuilderEthernetConfig,id:string):string{return ethernet.devices.find((device)=>device.id===id)?.label??id.toUpperCase();}
function firstServerVlan(ethernet:BuilderEthernetConfig,deviceId:string):number|null{return ethernet.devices.find((device)=>device.id===deviceId)?.interfaces[0]?.vlanId??null;}

export function BuilderDhcpPanel({ethernet,config,onConfigChange,leases,onLeasesChange,sequence,onSequenceChange,onMessage,onTransaction,historical=false,historicalStage=null}:BuilderDhcpPanelProps){
  const endpoints=ethernet.devices.filter((device)=>device.kind==='endpoint');
  const servers=ethernet.devices.filter((device)=>device.kind!=='switch');
  const routers=ethernet.devices.filter((device)=>device.kind==='router');
  const [clientId,setClientId]=useState(()=>endpoints[0]?.id??'');
  const [lastTransaction,setLastTransaction]=useState<BuilderDhcpTransaction|null>(null);
  const effectiveClientId=endpoints.some((device)=>device.id===clientId)?clientId:(endpoints[0]?.id??'');
  const client=endpoints.find((device)=>device.id===effectiveClientId);
  const vlanId=client?.interfaces[0]?.vlanId??null;
  const isDhcp=config.clientDeviceIds.includes(effectiveClientId);
  const lease=leases.find((entry)=>entry.clientDeviceId===effectiveClientId)??null;
  const pool=useMemo(()=>vlanId==null?null:config.pools.find((entry)=>entry.vlanId===vlanId)??null,[config.pools,vlanId]);

  const commitMode=(enabled:boolean)=>{
    try{const next=setBuilderDhcpClient(ethernet,config,effectiveClientId,enabled);onConfigChange(next);let releasedServer:string|undefined;if(!enabled){const released=releaseBuilderDhcpLease(leases,effectiveClientId,sequence);releasedServer=released.event?.destinationDeviceId??undefined;onLeasesChange(released.leases);}setLastTransaction(null);onMessage(`${labelFor(ethernet,effectiveClientId)} · ${enabled?'DHCP CLIENT ENABLED · NO IPV4 UNTIL ACK':'STATIC IPV4 RESTORED'}.`,[effectiveClientId,...(releasedServer?[releasedServer]:[])]);}catch(error){onMessage(`DHCP CONFIG REJECTED · ${error instanceof Error?error.message:'Invalid DHCP client configuration.'}`,[effectiveClientId]);}
  };
  const acquire=()=>{try{const result=runBuilderDhcpAcquire(ethernet,config,leases,effectiveClientId,sequence);onLeasesChange(result.leases);setLastTransaction(result);onSequenceChange(sequence+1);onTransaction?.(result,'acquire');const serverId=result.lease?.serverDeviceId??result.events.find((event)=>event.destinationDeviceId)?.destinationDeviceId??undefined;onMessage(`DHCP ${result.success?'ACK':'FAILED'} · ${result.summary}`,[effectiveClientId,...(serverId?[serverId]:[])]);}catch(error){onMessage(`DHCP FAILED · ${error instanceof Error?error.message:'Unable to acquire lease.'}`,[effectiveClientId]);}};
  const renew=()=>{try{const result=renewBuilderDhcpLease(ethernet,config,leases,effectiveClientId,sequence);onLeasesChange(result.leases);setLastTransaction(result);onSequenceChange(sequence+1);onTransaction?.(result,'renew');const serverId=result.lease?.serverDeviceId??result.events.find((event)=>event.destinationDeviceId)?.destinationDeviceId??undefined;onMessage(`DHCP ${result.success?'RENEW':'TIMEOUT'} · ${result.summary}`,[effectiveClientId,...(serverId?[serverId]:[])]);}catch(error){onMessage(`DHCP RENEW FAILED · ${error instanceof Error?error.message:'Unable to renew lease.'}`,[effectiveClientId]);}};
  const release=()=>{const result=releaseBuilderDhcpLease(leases,effectiveClientId,sequence);onLeasesChange(result.leases);setLastTransaction(result.event?{id:`release-${sequence}`,sequence,clientDeviceId:effectiveClientId,success:true,configurationReady:false,relayed:false,events:[result.event],lease:null,leases:result.leases,optionsIssues:[],failureReason:null,summary:result.event.detail}:null);onSequenceChange(sequence+1);onMessage(result.event?`DHCP RELEASE · ${result.event.detail}`:'DHCP RELEASE · no active lease.',[effectiveClientId,...(result.event?.destinationDeviceId?[result.event.destinationDeviceId]:[])]);};
  const advance=(steps:number)=>{const next=sequence+steps;const nextLeases=pruneBuilderDhcpLeases(leases,next);const expired=leases.filter((lease)=>!nextLeases.some((entry)=>entry.id===lease.id));onLeasesChange(nextLeases);onSequenceChange(next);onMessage(`DHCP CLOCK · advanced to sequence ${next}. Lease expiration is evaluated from deterministic sequence time.`,[effectiveClientId,...expired.flatMap((entry)=>[entry.clientDeviceId,entry.serverDeviceId])]);};

  const patchPool=(patch:Partial<{serverDeviceId:string;startAddress:string;endAddress:string;gateway:string|null;dnsServers:string[];leaseSteps:number}>)=>{
    if(!pool)return;
    try{
      let nextConfig=config;
      const nextPool={...pool,...patch};
      if(patch.serverDeviceId&&patch.serverDeviceId!==pool.serverDeviceId){
        const serverVlan=firstServerVlan(ethernet,patch.serverDeviceId);const local=serverVlan!=null&&builderEthernetInterfaceFor(ethernet.devices.find((device)=>device.id===patch.serverDeviceId),pool.vlanId);
        if(!local){const relayRouter=routers.find((router)=>serverVlan!=null&&builderEthernetInterfaceFor(router,pool.vlanId)&&builderEthernetInterfaceFor(router,serverVlan));if(!relayRouter||serverVlan==null)throw new Error('No router can relay between the client VLAN and selected DHCP server VLAN.');nextConfig=upsertBuilderDhcpRelay(ethernet,nextConfig,{id:`relay-v${pool.vlanId}-to-${patch.serverDeviceId}`,routerId:relayRouter.id,clientVlanId:pool.vlanId,serverDeviceId:patch.serverDeviceId,serverVlanId:serverVlan});}
      }
      nextConfig=upsertBuilderDhcpPool(ethernet,nextConfig,nextPool);onConfigChange(nextConfig);onLeasesChange(leases.filter((entry)=>entry.vlanId!==pool.vlanId));setLastTransaction(null);onMessage(`DHCP POOL · VLAN ${pool.vlanId} configuration updated; affected leases cleared.`);
    }catch(error){onMessage(`DHCP POOL REJECTED · ${error instanceof Error?error.message:'Invalid DHCP pool.'}`);}
  };

  return <section className="builder-dhcp-section" data-dhcp-client={isDhcp?'enabled':'static'}>
    <div className="control-title"><span>DHCP · HOST BOOTSTRAP</span><strong>SEQ {sequence} · {leases.length} LEASE{leases.length===1?'':'S'}</strong></div>
    {endpoints.length===0?<small className="builder-routing-note">NO LAN ENDPOINTS · LOAD THE LAN FABRIC BEFORE DHCP.</small>:<>
      <label>CLIENT<select value={effectiveClientId} onChange={(event)=>{setClientId(event.currentTarget.value);setLastTransaction(null);}}>{endpoints.map((endpoint)=><option key={endpoint.id} value={endpoint.id}>{endpoint.label} · VLAN {endpoint.interfaces[0]?.vlanId}</option>)}</select></label>
      <div className="builder-dhcp-status"><span>ADDRESS MODE</span><strong>{isDhcp?(lease?`DHCP · ${lease.address}`:'DHCP · UNCONFIGURED'):`STATIC · ${client?.interfaces[0]?.address??'—'}`}</strong>{lease&&<small>/ {lease.subnetMask} · GW {lease.gateway??'MISSING'} · DNS {lease.dnsServers.join(', ')||'MISSING'} · T1 {lease.renewAtSequence} · T2 {lease.rebindAtSequence} · EXP {lease.expiresAtSequence}</small>}</div>
      <div className="button-row"><button type="button" onClick={()=>commitMode(!isDhcp)}>{isDhcp?'USE STATIC':'USE DHCP'}</button><button type="button" disabled={!isDhcp||Boolean(lease)} onClick={acquire}>DORA / ACQUIRE</button><button type="button" disabled={!lease} onClick={renew}>RENEW / REBIND</button><button type="button" disabled={!lease} onClick={release}>RELEASE</button></div>
      <div className="button-row"><button type="button" onClick={()=>advance(1)}>TIME +1</button><button type="button" onClick={()=>advance(8)}>TIME +8</button></div>
      {pool&&<div className="builder-dhcp-pool"><span>VLAN {pool.vlanId} POOL</span><label>SERVER<select value={pool.serverDeviceId} onChange={(event)=>patchPool({serverDeviceId:event.currentTarget.value})}>{servers.map((server)=><option key={server.id} value={server.id}>{server.label} · VLANs {server.interfaces.map((entry)=>entry.vlanId).join(',')}</option>)}</select></label><div className="builder-dhcp-grid"><label>START<input key={`${pool.id}-start-${pool.startAddress}`} defaultValue={pool.startAddress} onBlur={(event)=>patchPool({startAddress:event.currentTarget.value})}/></label><label>END<input key={`${pool.id}-end-${pool.endAddress}`} defaultValue={pool.endAddress} onBlur={(event)=>patchPool({endAddress:event.currentTarget.value})}/></label><label>GATEWAY<input key={`${pool.id}-gw-${pool.gateway}`} defaultValue={pool.gateway??''} placeholder="MISSING" onBlur={(event)=>patchPool({gateway:event.currentTarget.value||null})}/></label><label>DNS<input key={`${pool.id}-dns-${pool.dnsServers.join(',')}`} defaultValue={pool.dnsServers.join(', ')} placeholder="MISSING" onBlur={(event)=>patchPool({dnsServers:event.currentTarget.value.split(',').map((value)=>value.trim()).filter(Boolean)})}/></label><label>LEASE STEPS<input type="number" min={4} max={100000} value={pool.leaseSteps} onChange={(event)=>patchPool({leaseSteps:Math.max(4,Math.min(100000,Math.round(Number(event.currentTarget.value)||4)))})}/></label></div><small>{config.relays.some((relay)=>relay.clientVlanId===pool.vlanId&&relay.serverDeviceId===pool.serverDeviceId)?'RELAYED · DISCOVER/REQUEST CROSS THE CONFIGURED ROUTER RELAY.':'LOCAL SERVER · BROADCAST REMAINS INSIDE THE VLAN.'}</small></div>}
      {historical&&historicalStage&&<div className="builder-dhcp-transaction"><span>HISTORICAL DHCP STAGE</span><strong>{historicalStage.summary}</strong><small>{historicalStage.detail}</small></div>}{!historical&&lastTransaction&&<div className={`builder-dhcp-transaction ${lastTransaction.success?'success':'failed'}`}><span>{lastTransaction.success?'DHCP TRANSACTION':'DHCP FAILURE'} · {lastTransaction.relayed?'RELAYED':'LOCAL'}</span><strong>{lastTransaction.summary}</strong>{lastTransaction.optionsIssues.length>0&&<small>OPTIONS · {lastTransaction.optionsIssues.join(' · ')}</small>}<div>{lastTransaction.events.map((event,index)=><small key={`${event.kind}-${index}`}><b>{event.kind} · VLAN {event.vlanId}{event.relayed?' · RELAY':''}</b>{event.detail}<i>{event.nodeIds.map((id)=>labelFor(ethernet,id)).join(' → ')}</i></small>)}</div></div>}
      <div className="builder-dhcp-leases"><span>DERIVED LEASE STATE</span>{leases.length===0?<small>NO ACTIVE LEASES</small>:leases.map((entry)=><small key={entry.id}><b>{labelFor(ethernet,entry.clientDeviceId)} · VLAN {entry.vlanId}</b>{entry.address} · SERVER {labelFor(ethernet,entry.serverDeviceId)} · T1 {entry.renewAtSequence} · T2 {entry.rebindAtSequence} · EXP {entry.expiresAtSequence}</small>)}</div>
      <small className="builder-routing-note">DHCP CONFIG PERSISTS · LEASES DO NOT. DHCP CLIENTS HAVE NO EFFECTIVE IPV4/GATEWAY UNTIL ACK. RELAY IS EXPLICIT; BROADCASTS NEVER MAGICALLY CROSS A ROUTER.</small>
    </>}
  </section>;
}
