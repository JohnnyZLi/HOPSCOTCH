from pathlib import Path

def patch(path, replacements):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    for old, new in replacements:
        count = text.count(old)
        if count != 1:
            raise SystemExit(f'{path}: expected 1 match, found {count}: {old[:100]!r}')
        text = text.replace(old, new, 1)
    p.write_text(text, encoding='utf-8')

patch('src/builder/probes.ts', [
    ("export type BuilderProbeStatus = 'echo-reply' | 'time-exceeded' | 'timeout' | 'unreachable';",
     "export type BuilderProbeStatus = 'echo-reply' | 'time-exceeded' | 'packet-too-big' | 'timeout' | 'unreachable';"),
    ("export interface BuilderProbePacketSeed { id:string; label:string; family:'ipv4'|'ipv6'; sourceAddress:string; destinationAddress:string; sourceMac:string; destinationMac:string; ttl:number; }",
     "export interface BuilderProbePacketSeed { id:string; label:string; family:'ipv4'|'ipv6'; sourceAddress:string; destinationAddress:string; sourceMac:string; destinationMac:string; ttl:number; icmpType?:number; icmpCode?:number; icmpMtu?:number; payloadBytes?:number; }")
])

patch('src/packet/model.ts', [
    ("  icmpIdentifier?: number;\n  icmpSequence?: number;",
     "  icmpIdentifier?: number;\n  icmpSequence?: number;\n  icmpMtu?: number;"),
    ("    const identifier = clampInteger(config.icmpIdentifier ?? 0x484f, 0, 65535);\n    const sequence = clampInteger(config.icmpSequence ?? 1, 0, 65535);\n    const bytes = [type, code, 0, 0, ...word16(identifier), ...word16(sequence)];",
     "    const identifier = clampInteger(config.icmpIdentifier ?? 0x484f, 0, 65535);\n    const sequence = clampInteger(config.icmpSequence ?? 1, 0, 65535);\n    const packetTooBig = config.family === 'ipv6' && type === 2;\n    const mtu = clampInteger(config.icmpMtu ?? 1280, 1280, 0xffffffff);\n    const bytes = packetTooBig ? [type, code, 0, 0, ...word32(mtu)] : [type, code, 0, 0, ...word16(identifier), ...word16(sequence)];"),
    ("      { id: 'icmp-type', label: 'Type', value: config.family === 'ipv4' && type === 8 ? '8 · Echo Request' : config.family === 'ipv6' && type === 128 ? '128 · Echo Request' : String(type), offset: 0, length: 1 },",
     "      { id: 'icmp-type', label: 'Type', value: config.family === 'ipv4' && type === 8 ? '8 · Echo Request' : config.family === 'ipv6' && type === 128 ? '128 · Echo Request' : packetTooBig ? '2 · Packet Too Big' : String(type), offset: 0, length: 1 },"),
    ("      { id: 'icmp-id', label: 'Identifier', value: hex16(identifier), offset: 4, length: 2 },\n      { id: 'icmp-seq', label: 'Sequence', value: String(sequence), offset: 6, length: 2 },",
     "      ...(packetTooBig ? [{ id: 'icmp-mtu', label: 'MTU', value: `${mtu} bytes`, offset: 4, length: 4, derived: true, note: 'IPv6 routers do not fragment transit packets; Packet Too Big carries the constraining next-hop MTU.' }] : [{ id: 'icmp-id', label: 'Identifier', value: hex16(identifier), offset: 4, length: 2 }, { id: 'icmp-seq', label: 'Sequence', value: String(sequence), offset: 6, length: 2 }]),")
])

patch('src/App.tsx', [
    ("initialConfig={builderPacketSeed ? { family: builderPacketSeed.family, transport: 'icmp', payloadBytes: 32, ttl: builderPacketSeed.ttl, ...(builderPacketSeed.family === 'ipv4' ? { sourceIpv4: builderPacketSeed.sourceAddress, destinationIpv4: builderPacketSeed.destinationAddress } : { sourceIpv6: builderPacketSeed.sourceAddress, destinationIpv6: builderPacketSeed.destinationAddress }), sourceMac: builderPacketSeed.sourceMac, destinationMac: builderPacketSeed.destinationMac, icmpType: builderPacketSeed.family === 'ipv4' ? 8 : 128, icmpCode: 0, icmpSequence: Math.max(1, builderPacketSeed.ttl) } : undefined}",
     "initialConfig={builderPacketSeed ? { family: builderPacketSeed.family, transport: 'icmp', payloadBytes: builderPacketSeed.payloadBytes ?? 32, ttl: builderPacketSeed.ttl, ...(builderPacketSeed.family === 'ipv4' ? { sourceIpv4: builderPacketSeed.sourceAddress, destinationIpv4: builderPacketSeed.destinationAddress } : { sourceIpv6: builderPacketSeed.sourceAddress, destinationIpv6: builderPacketSeed.destinationAddress }), sourceMac: builderPacketSeed.sourceMac, destinationMac: builderPacketSeed.destinationMac, icmpType: builderPacketSeed.icmpType ?? (builderPacketSeed.family === 'ipv4' ? 8 : 128), icmpCode: builderPacketSeed.icmpCode ?? 0, icmpMtu: builderPacketSeed.icmpMtu, icmpSequence: Math.max(1, builderPacketSeed.ttl) } : undefined}")
])

print('Patched probe seed and Packet Microscope for ICMPv6 Packet Too Big.')
