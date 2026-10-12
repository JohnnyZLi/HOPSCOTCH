// One mounted renderer owns its listeners, observers, animation frames and
// graphics surfaces. These wrappers are local to the mount; globals stay intact.
export function createRuntimeScope(element) {
 let disposed = false;
 const cleanups = [], frames = new Set(), observers = new Set(), surfaces = new Set();
 function listen(target, type, listener, options) {
  target.addEventListener(type, listener, options);
  cleanups.push(() => target.removeEventListener(type, listener, options));
 }
 const bind = target => new Proxy(target, {get(object, key) {
  if (key === 'addEventListener') return (type, listener, options) => listen(object, type, listener, options);
  if (key === 'fonts' && object === globalThis.document) return bind(object.fonts);
  if (key === 'createElement' && object === globalThis.document) return (...args) => {
   const node = object.createElement(...args);if(String(args[0]).toLowerCase()==='canvas')surfaces.add(node);return node;
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
   for (const cleanup of cleanups.splice(0)) cleanup();
   for (const canvas of surfaces) {
    for (const kind of ['webgl2', 'webgl']) {
     const gl = canvas.getContext(kind);if (gl?.getExtension) {gl.getExtension('WEBGL_lose_context')?.loseContext?.();break;}
    }
   }
   surfaces.clear();
  },
  stats: () => ({disposed, frames: frames.size, observers: observers.size, listeners: cleanups.length}),
 };
}
