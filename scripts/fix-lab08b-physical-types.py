from pathlib import Path

path = Path('src/PhysicalInternetGlobe.tsx')
text = path.read_text()

def replace_once(old: str, new: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f'missing Physical stress type anchor: {old!r}')
    text = text.replace(old, new, 1)

replace_once(
    "const DENSITY_LEVELS = [80, 150, 250] as const;",
    "type RenderFacility = PublicInfrastructureFacility | PhysicalStressFacility;\n\nconst DENSITY_LEVELS = [80, 150, 250] as const;",
)
replace_once(
    "function corridorPoints(a: PublicInfrastructureFacility, b: PublicInfrastructureFacility): THREE.Vector3[] {",
    "function corridorPoints(a: RenderFacility, b: RenderFacility): THREE.Vector3[] {",
)
replace_once(
    "  const facilityRecordsRef = useRef<PublicInfrastructureFacility[]>([]);",
    "  const facilityRecordsRef = useRef<RenderFacility[]>([]);",
)

path.write_text(text)
