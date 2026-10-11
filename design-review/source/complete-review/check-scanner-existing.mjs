import {motionAudit,auditCount} from './check-complete.mjs';
for(const width of [320,390,736,1024,1440])await motionAudit(width,{});
await motionAudit(390,{reduced:true});
console.log('PASS existing full lifecycle contract coverage',auditCount());
