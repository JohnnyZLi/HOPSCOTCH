import fs from 'node:fs';

const path = 'src/JourneyTheaterV2.tsx';
const source = fs.readFileSync(path, 'utf8');
const search = '<AnimatePresence key={scenario.id} mode="sync" initial={false}><motion.div key={`${state.scale}:${mode}`} className="journey-scene-transition" initial={reduceMotion ? {opacity:1}:{opacity:0,scale:enteringScale,filter:\'blur(12px)\'}} animate={{opacity:1,scale:1,filter:\'blur(0px)\'}} exit={reduceMotion ? {opacity:0}:{opacity:0,scale:state.zoom===\'out\'?.72:1.24,filter:\'blur(10px)\'}} transition={reduceMotion ? {duration:0} : {duration:.46,ease:[.16,1,.3,1]}}><SemanticScene state={state} hostname={scenario.hostname} address={scenario.destinationAddress}/></motion.div></AnimatePresence>';
const replacement = '<motion.div key={`${scenario.id}:${state.scale}:${mode}`} className="journey-scene-transition" initial={reduceMotion ? {opacity:1}:{opacity:0,scale:enteringScale,filter:\'blur(12px)\'}} animate={{opacity:1,scale:1,filter:\'blur(0px)\'}} transition={reduceMotion ? {duration:0} : {duration:.46,ease:[.16,1,.3,1]}}><SemanticScene state={state} hostname={scenario.hostname} address={scenario.destinationAddress}/></motion.div>';
const count = source.split(search).length - 1;
if (count !== 1) throw new Error(`Expected one semantic scene AnimatePresence block, found ${count}.`);
fs.writeFileSync(path, source.replace(search, replacement));
console.log('Semantic viewport now renders the latest canonical scene directly.');
