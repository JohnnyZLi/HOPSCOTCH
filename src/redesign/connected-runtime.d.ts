import type {ExploreDestination} from '../workspace-catalog';
export function mountConnected(element:HTMLElement,data:Record<string,unknown>,navigate:(id:ExploreDestination|null,search?:string)=>void):{api:{appearance():void;snapshot():unknown;pause():void};dispose():void};
