import type {MeasuredSnapshotState} from '../measurement/state';
let current:MeasuredSnapshotState|null=null;
export function measuredSession(){return current;}
export function replaceMeasuredSession(state:MeasuredSnapshotState|null){current=state;}
