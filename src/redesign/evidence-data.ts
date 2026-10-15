import {simulatedAsGraph,enumeratePolicyPaths} from '../internet/asModel';
import worldSource from '../../design-review/source/complete-review/world-110m.topojson?raw';

export async function createEvidenceData(workspace:string,search='') {
 const profile=new URLSearchParams(search).get('stress'),stress=profile==='as-density'||profile==='physical-density'?await import('../stress/fixtures'):null;
 const graph=structuredClone(profile==='as-density'?stress!.denseAsStressGraph:simulatedAsGraph),source=profile==='as-density'?stress!.STRESS_AS_SOURCE:graph.nodes[0].asn,destination=profile==='as-density'?stress!.STRESS_AS_DESTINATION:graph.nodes.at(-1)!.asn;
 const capture={frames:[],conversations:[],events:[],warnings:[],metadata:{},container:{}};
 return {bootstrapWorkspace:workspace,measured:null,observed:null,physical:{facilities:profile==='physical-density'?stress!.densePhysicalStressFacilities:[],provenance:profile==='physical-density'?'SIMULATED':'PUBLIC DATA',note:profile==='physical-density'?'SIMULATED · stress points are not public infrastructure.':'',generatedAt:null},captureMulti:capture,captureMultiBytes:[],captureNg:capture,captureNgBytes:[],captureTruncated:capture,captureTruncatedBytes:[],world:JSON.parse(worldSource),
  internet:{graph,source,destination,paths:enumeratePolicyPaths(graph,source,destination)}};
}
