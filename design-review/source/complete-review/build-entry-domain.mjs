import {stripTypeScriptTypes} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
// Exact pinned snapshots, type erasure only; static named ESM imports become
// module-local references. No source model or protocol logic is rewritten.
const base=path.resolve('complete-review/entry-source'),definitions=new Map();
function moduleSource(file){
 const id=path.basename(file);if(definitions.has(id))return;
 let source=stripTypeScriptTypes(fs.readFileSync(file,'utf8'),{mode:'strip'}),names=[];
 source=source.replace(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g,(_,bindings,ref)=>{const dep=path.basename(ref);moduleSource(path.join(base,dep));return 'const {'+bindings.trim().replace(/\s+as\s+/g,':')+'}=read('+JSON.stringify(dep)+');';});
 source=source.replace(/export\s+(const|let|function|class)\s+(\w+)/g,(_,kind,name)=>{names.push(name);return kind+' '+name;});
 if(/^\s*(import|export)\s/m.test(source))throw Error('Unconverted ESM in '+id);
 definitions.set(id,source+'\nObject.assign(exports,{'+names.join(',')+'});');
}
let entry=fs.readFileSync('complete-review/entry-domain.mjs','utf8').replace(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g,(_,bindings,ref)=>{const id=path.basename(ref);moduleSource(path.join(base,id));return 'const {'+bindings+'}=read('+JSON.stringify(id)+');';});
const registry=[...definitions].map(([id,source])=>JSON.stringify(id)+':(exports,read)=>{\n'+source+'\n}').join(',\n');
fs.writeFileSync('complete-review/entry-domain.bundle.js','(()=>{const modules={'+registry+'},cache={};function read(id){if(!cache[id]){cache[id]={};modules[id](cache[id],read);}return cache[id];}\n'+entry+'\n})();');
