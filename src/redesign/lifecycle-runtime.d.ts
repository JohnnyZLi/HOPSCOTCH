export interface LifecycleAPI {
 select(scene:string):void;
 seek(clock:number):void;
 save():unknown;
 restore(value:unknown):void;
 presentSource(timeMs: number, durationMs: number, settle?: boolean): void;
 reflow(): void;
 appearance(): void;
 pause(): void;
 snapshot(): {sceneId: string; clock: number; at: {index: number; kind: string; p: number}; material: unknown};
 dispose(): void;
}
export function mountLifecycle(element: HTMLElement, data: Record<string, unknown>): {
 api: LifecycleAPI;
 stats(): {disposed: boolean; frames: number; observers: number; listeners: number};
 dispose(): void;
};
