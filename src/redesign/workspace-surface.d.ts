import type {ExploreDestination} from '../workspace-catalog';
export function mountWorkspaceSurface(element:HTMLElement,navigate:(id:ExploreDestination|null,search?:string)=>void,destination:ExploreDestination):{appearance():void;dispose():void};
