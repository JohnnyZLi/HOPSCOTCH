// One mounted renderer owns its listeners, observers, animation frames and
// graphics surfaces. These wrappers are local to the mount; globals stay intact.
export function createRuntimeScope(element) {
 let disposed = false;
 const cleanups = new Set(), frames = new Set(), observers = new Set(), surfaces = new Map();
 function listen(target, type, listener, options) {
  target.addEventListener(type, listener, options);
  const remove=()=>{target.removeEventListener(type,listener,options);cleanups.delete(remove);};
  cleanups.add(remove);return remove;
 }
 const bind = target => new Proxy(target, {get(object, key) {
  if (key === 'addEventListener') return (type, listener, options) => listen(object, type, listener, options);
  if (key === 'fonts' && object === globalThis.document) return bind(object.fonts);
  if (key === 'ready' && object === globalThis.document.fonts) return {
   then(fulfilled,rejected){return object.ready.then(value=>disposed?undefined:fulfilled?.(value),error=>disposed?undefined:rejected?.(error));}
  };
  if (key === 'createElement' && object === globalThis.document) return (...args) => {
   const node = object.createElement(...args);
   if(String(args[0]).toLowerCase()==='canvas'){
    const getContext=node.getContext.bind(node);
    node.getContext=(kind,...options)=>{const context=getContext(kind,...options);if(context&&['webgl2','webgl'].includes(kind))surfaces.set(node,context);return context;};
   }
   // Scratch 2D measurement/raster canvases are deliberately not retained.
   // Only graphics contexts needing explicit disposal belong to this mount.
   return node;
  };
  const value = Reflect.get(object, key, object);
  return typeof value === 'function' ? value.bind(object) : value;
 }});
 const requestFrame = callback => {
  if (disposed) return 0;
  let id = 0;
  id = globalThis.requestAnimationFrame(now => {frames.delete(id);if (!disposed) callback(now);});
  frames.add(id);return id;
 };
 const cancelFrame = id => {frames.delete(id);globalThis.cancelAnimationFrame(id);};
 const observerClass = Native => class extends Native {
  constructor(callback) {super((...args) => {if (!disposed) callback(...args);});observers.add(this);}
  observe(...args){observers.add(this);return super.observe(...args);}
  disconnect(){observers.delete(this);return super.disconnect();}
 };
 return {
  document: bind(globalThis.document), window: bind(globalThis.window),
  matchMedia: query => bind(globalThis.matchMedia(query)),
  requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame,
  ResizeObserver: observerClass(globalThis.ResizeObserver), MutationObserver: observerClass(globalThis.MutationObserver), listen,
  dispose() {
   if (disposed) return;disposed = true;
   for (const id of frames) globalThis.cancelAnimationFrame(id);frames.clear();
   for (const observer of observers) observer.disconnect();observers.clear();
   for (const cleanup of [...cleanups]) cleanup();cleanups.clear();
   for (const gl of surfaces.values()) gl.getExtension?.('WEBGL_lose_context')?.loseContext?.();
   surfaces.clear();
  },
  stats: () => ({disposed, frames: frames.size, observers: observers.size, listeners: cleanups.size}),
 };
}
