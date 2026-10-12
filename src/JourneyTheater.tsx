import { useEffect } from 'react';
import type { InternetEvidenceSnapshot } from './internet/evidence';
import { isJourneyClockSuspended, resumeJourneyClock, suspendJourneyClock } from './journey/browser.ts';
import type { JourneyDetailLab } from './journey/model';
import type { MeasuredSnapshotState } from './measurement/state.ts';
import { JourneyTheater as JourneyTheaterV2 } from './JourneyTheaterV2';

export function JourneyTheater({
  onTimeChange,
  active = true,
  ...props
}: {
  hostname: string;
  timeMs: number;
  startPlaying: boolean;
  evidence: InternetEvidenceSnapshot | null;
  measuredState: MeasuredSnapshotState | null;
  onHostnameChange: (hostname: string) => void;
  onTimeChange: (timeMs: number) => void;
  onEvidenceChange: (evidence: InternetEvidenceSnapshot | null) => void;
  onOpenDetail: (lab: JourneyDetailLab, timeMs: number) => void;
  onExit: () => void;
  active?: boolean;
}) {
  useEffect(() => {
    if(active)resumeJourneyClock();else suspendJourneyClock();
  }, [active]);

  return <JourneyTheaterV2
    {...props}
    active={active}
    onTimeChange={(nextTimeMs) => {
      if (!isJourneyClockSuspended()) onTimeChange(nextTimeMs);
    }}
  />;
}
