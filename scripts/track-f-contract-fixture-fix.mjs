import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
const path='scripts/builder-routing-policy-contract-check.mjs';
let source=readFileSync(path,'utf8');
source=source.replace("id,64512);","id,64500);").replace("'a',64520);","'a',64501);").replace("'b',64521);","'b',64502);").replaceAll("64520:100","64501:100").replaceAll("64520:200","64501:200").replaceAll("asn===64520","asn===64501");
writeFileSync(path,source);
unlinkSync('scripts/track-f-contract-fixture-fix.mjs');
