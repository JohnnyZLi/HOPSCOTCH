from pathlib import Path
p=Path('scripts/_tmp_patch_bgp_projection.py')
s=p.read_text(encoding='utf-8')
start=s.index('# Keep projection endpoints and failures locked if the prop changes.')
end=s.index('s=s.replace("    if (pickMode) {"', start)
replacement='''# Keep projection endpoints and failures locked if the prop changes.\nanchor="  const activeRelationships = new Set(winner?.relationshipIds ?? []);"\ninsert="""  const activeRelationships = new Set(winner?.relationshipIds ?? []);\n\n  useEffect(() => {\n    if (!builderProjection) return;\n    if (builderProjection.sourceAsn != null) setSource(builderProjection.sourceAsn);\n    if (builderProjection.destinationAsn != null) setDestination(builderProjection.destinationAsn);\n    setFailed(new Set()); setPickMode(null);\n    setSelectedRelationshipId(builderProjection.graph.relationships[0]?.id ?? '');\n  }, [builderProjection]);"""\nif s.count(anchor)!=1: raise SystemExit(f'Internet active relationships anchor found {s.count(anchor)}')\ns=s.replace(anchor,insert,1)\n'''
s=s[:start]+replacement+s[end:]
p.write_text(s,encoding='utf-8')
print('Hardened projection patch around the active-relationship insertion.')
