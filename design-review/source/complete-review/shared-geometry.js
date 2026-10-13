// One geometric camera law serves the review and the production Builder.
export function frameCamera(bounds,viewport,padding=16,maxZoom=1){
 const gap=Math.max(0,Math.min(padding,viewport.w/4,viewport.h/4)),w=Math.max(1,bounds.right-bounds.left),h=Math.max(1,bounds.bottom-bounds.top),z=Math.min(maxZoom,Math.max(1,viewport.w-gap*2)/w,Math.max(1,viewport.h-gap*2)/h);
 return {x:viewport.w/2-(bounds.left+bounds.right)*z/2,y:viewport.h/2-(bounds.top+bounds.bottom)*z/2,z};
}
