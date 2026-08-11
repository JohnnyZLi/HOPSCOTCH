import fs from 'node:fs';

const path = 'src/JourneyTheaterV2.tsx';
const source = fs.readFileSync(path, 'utf8');
const search = '<AnimatePresence mode="wait" initial={false}><motion.div key={`${state.scale}:${mode}`} className="journey-scene-transition"';
const replacement = '<AnimatePresence key={scenario.id} mode="wait" initial={false}><motion.div key={`${state.scale}:${mode}`} className="journey-scene-transition"';
const count = source.split(search).length - 1;
if (count !== 1) throw new Error(`Expected exactly one semantic-scene AnimatePresence match, found ${count}.`);
fs.writeFileSync(path, source.replace(search, replacement));
console.log('Applied scenario-keyed semantic scene presence fix.');
