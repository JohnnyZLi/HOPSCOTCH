import { useEffect } from 'react';
import type { InternetEvidenceSnapshot } from './internet/evidence';
import { isJourneyClockSuspended, resumeJourneyClock } from './journey/browser.ts';
import type { JourneyDetailLab } from './journey/model';
import { JourneyTheater as JourneyTheaterV2 } from './JourneyTheaterV2';

export function JourneyTheater({
  onTimeChange,
  ...props
}: {
  hostname: string;
  timeMs: number;
  startPlaying: boolean;
  evidence: InternetEvidenceSnapshot | null;
  onHostnameChange: (hostname: string) => void;
  onTimeChange: (timeMs: number) => void;
  onEvidenceChange: (evidence: InternetEvidenceSnapshot | null) => void;
  onOpenDetail: (lab: JourneyDetailLab, timeMs: number) => void;
  onExit: () => void;
}) {
  useEffect(() => {
    resumeJourneyClock();
  }, []);

  return <JourneyTheaterV2
    {...props}
    onTimeChange={(nextTimeMs) => {
      if (!isJourneyClockSuspended()) onTimeChange(nextTimeMs);
    }}
  />;
}
