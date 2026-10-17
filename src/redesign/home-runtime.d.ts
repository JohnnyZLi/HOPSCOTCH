import type {ExploreDestination} from '../workspace-catalog';
export function mountHome(element:HTMLElement,navigate:(id:ExploreDestination|null,search?:string)=>void):{api:{appearance():void;snapshot():unknown};dispose():void};
