import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../src/App.tsx', import.meta.url);
let source = await readFile(path, 'utf8');

function replaceOnce(before, after, label) {
  if (!source.includes(before)) throw new Error(`Journey integration could not find ${label}.`);
  source = source.replace(before, after);
}

replaceOnce(
  "import { HttpComparisonTheater } from './HttpComparisonTheater';\n",
  "import { HttpComparisonTheater } from './HttpComparisonTheater';\nimport { JourneyTheater } from './JourneyTheater';\n",
  'JourneyTheater import anchor',
);
replaceOnce(
  "import { InternetScaleTheater } from './InternetScaleTheater';\n",
  "import { InternetScaleTheater } from './InternetScaleTheater';\nimport type { InternetEvidenceSnapshot } from './internet/evidence';\nimport type { JourneyDetailLab } from './journey/model';\n",
  'Journey type import anchor',
);
replaceOnce(
  "type ActiveLab = 'failure' | 'packet' | 'tcp' | 'dns' | 'tls' | 'http' | 'builder' | 'physical' | 'internet' | 'observed' | null;",
  "type ActiveLab = 'journey' | 'failure' | 'packet' | 'tcp' | 'dns' | 'tls' | 'http' | 'builder' | 'physical' | 'internet' | 'observed' | null;",
  'ActiveLab union',
);
replaceOnce(
  "  const [playing, setPlaying] = useState(false);\n",
  "  const [playing, setPlaying] = useState(false);\n  const [journeyHostname, setJourneyHostname] = useState('example.test');\n  const [journeyTimeMs, setJourneyTimeMs] = useState(0);\n  const [journeyStartPlaying, setJourneyStartPlaying] = useState(true);\n  const [journeyReturnPending, setJourneyReturnPending] = useState(false);\n  const [journeyEvidence, setJourneyEvidence] = useState<InternetEvidenceSnapshot | null>(null);\n",
  'Journey App state',
);

replaceOnce(
`  const openFailureLab = (atMs = 0, autoplay = true) => {
    setLayer('routing'); setTimeMs(atMs); setActiveLab('failure'); setPlaying(autoplay);
  };
  const openPacketLab = () => { setPlaying(false); setLayer('packet'); setActiveLab('packet'); };
  const openTcpLab = () => { setPlaying(false); setLayer('transport'); setActiveLab('tcp'); };
  const openDnsLab = () => { setPlaying(false); setLayer('application'); setActiveLab('dns'); };
  const openTlsLab = () => { setPlaying(false); setLayer('application'); setActiveLab('tls'); };
  const openHttpLab = () => { setPlaying(false); setLayer('application'); setActiveLab('http'); };
  const openBuilderLab = () => { setPlaying(false); setLayer('routing'); setActiveLab('builder'); };
  const openPhysicalInternet = () => { setPlaying(false); setLayer('internet'); setActiveLab('physical'); };
  const openInternetLab = () => { setPlaying(false); setLayer('internet'); setActiveLab('internet'); };
  const openObservedInternet = () => { setPlaying(false); setLayer('internet'); setActiveLab('observed'); };
  const exitLabs = () => { setPlaying(false); setActiveLab(null); };
`,
`  const openFailureLab = (atMs = 0, autoplay = true) => {
    setLayer('routing'); setTimeMs(atMs); setActiveLab('failure'); setPlaying(autoplay);
  };
  const openPacketLab = () => { setPlaying(false); setLayer('packet'); setActiveLab('packet'); };
  const openTcpLab = () => { setPlaying(false); setLayer('transport'); setActiveLab('tcp'); };
  const openDnsLab = () => { setPlaying(false); setLayer('application'); setActiveLab('dns'); };
  const openTlsLab = () => { setPlaying(false); setLayer('application'); setActiveLab('tls'); };
  const openHttpLab = () => { setPlaying(false); setLayer('application'); setActiveLab('http'); };
  const openBuilderLab = () => { setPlaying(false); setLayer('routing'); setActiveLab('builder'); };
  const openPhysicalInternet = () => { setPlaying(false); setLayer('internet'); setActiveLab('physical'); };
  const openInternetLab = () => { setPlaying(false); setLayer('internet'); setActiveLab('internet'); };
  const openObservedInternet = () => { setPlaying(false); setLayer('internet'); setActiveLab('observed'); };
  const openJourney = () => {
    setPlaying(false);
    setLayer('application');
    setJourneyTimeMs(0);
    setJourneyStartPlaying(true);
    setJourneyReturnPending(false);
    setActiveLab('journey');
  };
  const openJourneyDetail = (lab: JourneyDetailLab, atMs: number) => {
    const detailLayer: Record<JourneyDetailLab, NetworkLayer> = {
      dns: 'application', tcp: 'transport', tls: 'application', http: 'application', packet: 'packet',
      builder: 'routing', internet: 'internet', physical: 'internet', observed: 'internet',
    };
    setPlaying(false);
    setJourneyTimeMs(atMs);
    setJourneyStartPlaying(false);
    setJourneyReturnPending(true);
    setLayer(detailLayer[lab]);
    setActiveLab(lab);
  };
  const exitLabs = () => { setPlaying(false); setJourneyReturnPending(false); setActiveLab(null); };
  const exitActiveLab = () => {
    setPlaying(false);
    if (journeyReturnPending && activeLab !== 'journey') {
      setJourneyReturnPending(false);
      setJourneyStartPlaying(false);
      setActiveLab('journey');
      return;
    }
    exitLabs();
  };
`,
  'lab navigation block',
);
replaceOnce("  const buildLabel = activeLab === 'failure'\n", "  const buildLabel = activeLab === 'journey'\n    ? 'LAB 06'\n    : activeLab === 'failure'\n", 'build label');
replaceOnce("  const buildStatus = activeLab === 'failure'\n", "  const buildStatus = activeLab === 'journey'\n    ? 'URL JOURNEY ACTIVE'\n    : activeLab === 'failure'\n", 'build status');
replaceOnce(
`                <motion.button className="primary-action" type="button" onClick={overviewAction.run} whileHover={reduceMotion ? undefined : { y: -2, scale: 1.015 }} whileTap={reduceMotion ? undefined : { scale: 0.985 }}>{overviewAction.label}<span aria-hidden="true">↗</span></motion.button>
                <button className="text-action text-button" type="button" onClick={() => setMode((current) => (current === 'overview' ? 'xray' : 'overview'))}>{mode === 'overview' ? 'Preview X-ray' : 'Hide X-ray'}</button>
`,
`                <motion.button className="primary-action" type="button" onClick={openJourney} whileHover={reduceMotion ? undefined : { y: -2, scale: 1.015 }} whileTap={reduceMotion ? undefined : { scale: 0.985 }}>Play URL journey<span aria-hidden="true">↗</span></motion.button>
                <button className="text-action text-button" type="button" onClick={overviewAction.run}>{overviewAction.label}</button>
                <button className="text-action text-button" type="button" onClick={() => setMode((current) => (current === 'overview' ? 'xray' : 'overview'))}>{mode === 'overview' ? 'Preview X-ray' : 'Hide X-ray'}</button>
`,
  'hero actions',
);
replaceOnce(
  '<span className="timeline-note">Lab 01 failure · Lab 02 packet · Lab 03 protocols · Lab 04 builder · Lab 05 Internet</span>',
  '<span className="timeline-note">Lab 01 failure · Lab 02 packet · Lab 03 protocols · Lab 04 builder · Lab 05 Internet · Lab 06 Journey</span>',
  'timeline note',
);
replaceOnce(
`        ) : activeLab === 'packet' ? (
          <PacketMicroscope key="lab02" onExit={exitLabs} onOpenSourceEvent={() => openFailureLab(5400, false)} />
`,
`        ) : activeLab === 'journey' ? (
          <JourneyTheater key="lab06" hostname={journeyHostname} timeMs={journeyTimeMs} startPlaying={journeyStartPlaying} evidence={journeyEvidence} onHostnameChange={setJourneyHostname} onTimeChange={setJourneyTimeMs} onEvidenceChange={setJourneyEvidence} onOpenDetail={openJourneyDetail} onExit={exitLabs} />
        ) : activeLab === 'packet' ? (
          <PacketMicroscope key="lab02" onExit={exitActiveLab} onOpenSourceEvent={() => openFailureLab(5400, false)} />
`,
  'Journey render branch',
);
for (const [component, key] of [
  ['TcpTheater','lab03-tcp'],['DnsTheater','lab03-dns'],['TlsTheater','lab03-tls'],['HttpComparisonTheater','lab03-http'],
  ['NetworkBuilder','lab04'],['PhysicalInternetGlobe','lab05-physical'],['InternetScaleTheater','lab05-simulated'],['ObservedInternet','lab05-observed'],
]) {
  replaceOnce(`<${component} key="${key}" onExit={exitLabs}`, `<${component} key="${key}" onExit={exitActiveLab}`, `${component} Journey return`);
}
replaceOnce(
  '<button type="button" className="lab-mode" onClick={exitLabs}>EXIT LAB</button>',
  '<button type="button" className="lab-mode" onClick={exitActiveLab}>EXIT LAB</button>',
  'Lab 01 Journey return',
);

await writeFile(path, source);
console.log('Journey App integration applied.');
