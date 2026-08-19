import { InternetScaleTheater } from './InternetScaleTheater';
import { NetworkBuilder } from './NetworkBuilder';
import { PhysicalInternetGlobe } from './PhysicalInternetGlobe';
import {
  denseAsStressGraph,
  denseBuilderStressGraph,
  denseBuilderStressLayout,
  densePhysicalStressFacilities,
  STRESS_AS_DESTINATION,
  STRESS_AS_SOURCE,
  STRESS_BUILDER_DESTINATION,
  STRESS_BUILDER_SOURCE,
  STRESS_FACILITY_COUNT,
} from './stress/fixtures';

export type StressProfile = 'as-density' | 'builder-density' | 'physical-density';

export function stressProfileFromSearch(search: string): StressProfile | null {
  const value = new URLSearchParams(search).get('stress');
  return value === 'as-density' || value === 'builder-density' || value === 'physical-density' ? value : null;
}

const noop = () => undefined;

export function StressHarness({ profile }: { profile: StressProfile }) {
  return <main className="app-shell stress-harness" data-stress-profile={profile}>
    {profile === 'as-density' && <InternetScaleTheater
      onExit={noop}
      onOpenObserved={noop}
      graph={denseAsStressGraph}
      initialSource={STRESS_AS_SOURCE}
      initialDestination={STRESS_AS_DESTINATION}
      stressLabel="160 AS · 220 RELATIONSHIPS"
    />}
    {profile === 'builder-density' && <NetworkBuilder
      onExit={noop}
      onOpenFailureStory={noop}
      initialGraph={denseBuilderStressGraph}
      initialLayout={denseBuilderStressLayout}
      initialSourceId={STRESS_BUILDER_SOURCE}
      initialDestinationId={STRESS_BUILDER_DESTINATION}
      stressLabel="32 NODES · 96 LINKS"
    />}
    {profile === 'physical-density' && <PhysicalInternetGlobe
      onExit={noop}
      onOpenSimulated={noop}
      onOpenObserved={noop}
      stressFacilities={densePhysicalStressFacilities}
      stressPointLimit={STRESS_FACILITY_COUNT}
    />}
  </main>;
}
