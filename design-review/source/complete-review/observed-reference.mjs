export default {
    schema: 'hopscotch.internet-evidence', version: 1, generatedAt: '2026-08-20T22:00:00.000Z',
    edge: { provenance: 'EDGE OBSERVED', availability: 'available', asn: 13335, organization: 'Cloudflare, Inc.', colo: 'LHR', country: 'GB', region: 'England', city: 'London', transportRttMs: 17, transport: 'QUIC', observedAt: '2026-08-20T22:00:00.000Z', note: 'Observed at the edge serving this explicit HOPSCOTCH request.' },
    destination: { provenance: 'INFERRED', availability: 'available', hostname: 'cloudflare.com', addresses: ['104.16.132.229', '104.16.133.229', '2606:4700::6810:84e5'], selectedAddress: '104.16.132.229', note: 'DNS resolution provides destination context, not a measured forwarding path.' },
    routing: { provenance: 'PUBLIC COLLECTOR', availability: 'available', prefix: '104.16.128.0/20', originAsns: [13335], note: 'Public route-origin context seen from independent collector vantage points.' },
    collectorPaths: [
      { provenance: 'PUBLIC COLLECTOR', availability: 'available', sourceId: 'rrc00-peer-64500', targetPrefix: '104.16.128.0/20', asPath: [64500, 3356, 13335], note: 'Independent RIS vantage; not the browser path.' },
      { provenance: 'PUBLIC COLLECTOR', availability: 'available', sourceId: 'rrc10-peer-64496', targetPrefix: '104.16.128.0/20', asPath: [64496, 1299, 13335], note: 'Independent RIS vantage; not the browser path.' },
      { provenance: 'PUBLIC COLLECTOR', availability: 'available', sourceId: 'rrc21-peer-64497', targetPrefix: '104.16.128.0/20', asPath: [64497, 174, 13335], note: 'Independent RIS vantage; not the browser path.' },
    ],
    bridge: { provenance: 'INFERRED', availability: 'partial', sourceAsn: 13335, destinationOriginAsns: [13335], note: 'No continuous observation joins the request edge, the browser forwarding path, and these public collector routes.' },
    warnings: ['Collector paths are independent route observations and do not identify the current browser path.'],
  };