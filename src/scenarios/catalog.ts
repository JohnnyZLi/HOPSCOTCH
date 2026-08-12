export type ScenarioPresetId =
  | 'dns-outage'
  | 'route-failover'
  | 'path-outage'
  | 'congestion'
  | 'route-leak'
  | 'partition'
  | 'server-503'
  | 'quic-loss';

export interface ScenarioPresetCard {
  id: ScenarioPresetId;
  kicker: string;
  title: string;
  description: string;
  meta: string;
}

export const SCENARIO_PRESET_CARDS: readonly ScenarioPresetCard[] = [
  {
    id: 'dns-outage',
    kicker: 'DNS',
    title: 'Resolver stops answering',
    description: 'Watch a cache miss hit a DNS timeout, retry, and recovery before transport can even begin.',
    meta: 'TIMEOUT · RETRY · RECOVERY',
  },
  {
    id: 'route-failover',
    kicker: 'ROUTING',
    title: 'Primary route disappears',
    description: 'Fail the preferred path before transport and watch SPF invalidate it, recompute, and install the alternate.',
    meta: 'OSPF MODEL · FAILOVER',
  },
  {
    id: 'path-outage',
    kicker: 'CROSS-LAYER',
    title: 'Path dies mid-transfer',
    description: 'Break forwarding after data is already moving and separate route recovery from transport loss recovery.',
    meta: 'ROUTE LOSS · RTO / PTO',
  },
  {
    id: 'congestion',
    kicker: 'TRANSPORT',
    title: 'Queue starts growing',
    description: 'Watch queue pressure, ECN feedback, and congestion-window response without fabricating packet loss.',
    meta: 'QUEUE · ECN · CWND',
  },
  {
    id: 'route-leak',
    kicker: 'BGP POLICY',
    title: 'Reachable but wrong',
    description: 'See a leaked advertisement win on local preference even though the selected AS path violates valley-free policy.',
    meta: 'LOCAL_PREF · POLICY ANOMALY',
  },
  {
    id: 'partition',
    kicker: 'FAILURE',
    title: 'The network partitions',
    description: 'Cut every surviving route and watch established transport stall into a terminal network-unreachable state.',
    meta: 'NO ROUTE · TERMINAL',
  },
  {
    id: 'server-503',
    kicker: 'HTTP',
    title: 'Server returns 503',
    description: 'Keep the network and connection healthy while the service fails, waits on Retry-After, and safely retries GET.',
    meta: '503 · RETRY-AFTER · REUSE',
  },
  {
    id: 'quic-loss',
    kicker: 'HTTP/3',
    title: 'Lose a QUIC packet',
    description: 'Drop one HTTP/3 data packet and watch ACK ranges expose the gap before STREAM data is retransmitted.',
    meta: 'QUIC · ACK RANGES · STREAM',
  },
] as const;
