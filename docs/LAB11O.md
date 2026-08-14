# Lab 11O — BGP inside Network Builder

Lab 11O brings a deterministic path-vector control plane into the same Builder topology rather than treating Internet-scale policy as a disconnected theater.

## BGP configuration

- Builder routers use RFC 5398 documentation ASNs only (`64496–64511` and `65536–65551`).
- Direct router-router links can carry explicit eBGP or iBGP sessions. Session type is derived from the endpoint ASNs.
- eBGP sessions can be PEER or CUSTOMER/PROVIDER; iBGP sessions keep an explicit `NEXT-HOP-SELF` teaching control.
- Networks, communities, MED, import/export rules, and relationship-leak overrides are persisted inside the existing additive routing configuration. Old schema-v9 files with no BGP field normalize to an empty BGP config.

## Deterministic path vector

The BGP RIB is derived from local origins plus the currently ESTABLISHED sessions. Each convergence round advertises only the sender's current best path, so link/session failure removes the corresponding Adj-RIB-In route instead of preserving stale invented state. AS-loop rejection and iBGP split-horizon are explicit.

HOPSCOTCH's teaching best-path order is:

1. highest `LOCAL_PREF`;
2. shortest `AS_PATH`;
3. lowest `MED`;
4. local over eBGP over iBGP;
5. stable router/source tie break.

This is deliberately described as the HOPSCOTCH teaching comparator rather than a universal vendor decision process. For FIB precedence, eBGP AD 20 and iBGP AD 200 are also local teaching defaults, not BGP protocol attributes.

## Policy and anomalies

Import/export rules can permit/deny a prefix and mutate LOCAL_PREF, MED, or communities independently from physical link state. The customer/peer/provider export rule is shared from Lab 05's Internet policy model: local/customer-learned routes may be exported broadly, while peer/provider-learned routes export only to customers unless an explicit leak override is authored.

Because arbitrary network origination is allowed for teaching, the engine marks a prefix as multi-origin when different documentation ASNs originate the same NLRI. This creates a controlled hijack-style scenario without pretending it is legitimate ownership. Relationship-policy overrides mark resulting routes as leak anomalies.

## Data plane

Best BGP paths project into the IPv4 route table as `B` / `B i`. A BGP route is active only when its protocol NEXT_HOP is directly resolvable on the current Builder topology. This makes iBGP NEXT_HOP preservation versus NEXT-HOP-SELF visible instead of silently inventing recursive reachability. Existing Ping/Traceroute, NAT, and ACL code consume the same route table, so BGP is not a parallel forwarding engine.

## Internet-scale projection

The BGP model derives an AS-level projection from the exact Builder ASN/session graph and the currently selected best BGP route. `OPEN AS PROJECTION` snapshots the complete schema-v9 Builder configuration and opens Lab 05 at AS scale with that selected path locked as display truth. Lab 05 does not run its own policy enumerator in projection mode, does not permit relationship failures or endpoint changes, and shows the Builder route attributes that produced the path.

`RETURN TO BUILDER` reconstructs the Builder from the captured graph, layout, IPv4/IPv6 addressing, routing/BGP, Ethernet/VLAN, link profiles, ACL, NAT, and DHCP configuration. Session-only observations such as ARP, NAT translations, probe history, FDB entries, DHCP leases, and IPv6 lifecycle timers are intentionally not promoted into persisted truth just to make the cross-lab transition look stateful.
