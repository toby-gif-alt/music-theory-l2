import fs from 'fs/promises';
import path from 'path';

const args = Object.fromEntries(process.argv.slice(2).map(a=>{
  const m = a.match(/^--([^=]+)=(.*)$/); return m? [m[1], m[2]] : [a.replace(/^--/,''), true];
}));
const N = parseInt(args.n||args.N||10);
const LEVEL = (args.level||'A').toUpperCase();
const topics = (args.topics||'intervals,transposition,texture,tonality,harmony,cadences,devices,perf').split(',').map(s=>s.trim()).filter(Boolean);
const OUT = args.out || 'pack.json';

const patterns = JSON.parse(await fs.readFile('data/patterns.json','utf8'));
const banks = JSON.parse(await fs.readFile('data/banks.json','utf8'));

const DIFF = {
  A: (s)=>`Identify / describe: ${s}`,
  M: (s)=>`Explain with evidence from the score: ${s}`,
  E: (s)=>`Analyse/apply and discuss the effect on the music: ${s}`
};

const rand = (arr)=> arr[Math.floor(Math.random()*arr.length)];
const cap = (s)=> s.charAt(0).toUpperCase()+s.slice(1);

function genIntervals(level){
  const items = Array.from({length:6},()=>`${rand(banks.intervalQualities)} ${rand(banks.intervalNumbers)}`);
  const stem = `${DIFF[level]('Identify the quality and quantity of the labelled intervals ①–⑥ (e.g., minor 3rd).')} Intervals may include: ${items.join(', ')}.`;
  const ans = `Model: quality + quantity on each, correct for clef context.${level==='E'? ' Discuss dissonance → resolution and its effect on momentum; '+rand(banks.excellencePhrases)+'.':''}`;
  return {topic:'intervals', stem, model: ans};
}

function genTransposition(level){
  const fam = rand(Object.keys(banks.instruments));
  const inst = rand(banks.instruments[fam]);
  const dir = Math.random()<0.5?'to concert pitch':'to written pitch for the instrument';
  const key = `${rand(banks.keys)} ${rand(banks.modes)}`;
  const ivl = fam==='Bb'? 'a major 2nd' : fam==='Eb'? 'a major 6th' : 'a perfect 5th';
  const stem = `${DIFF[level](`Transpose ${dir}: ${inst} part in ${key}. State the transposition interval and ${level==='A'?'direction': level==='M'?'resulting key and direction':'justify key‑signature change and accidentals'}.`)}`;
  const ans = `Model: ${inst} transposes by ${ivl}. Include correct key signature and carry performance markings.${level==='E'? ' Comment on tessitura/ensemble balance; '+rand(banks.excellencePhrases)+'.':''}`;
  return {topic:'transposition', stem, model: ans};
}

function genTonality(level){
  const key = `${rand(banks.keys)} ${rand(banks.modes)}`;
  const stem = `${DIFF[level](`Identify the key (${key} implied) and provide ${level==='A'?'one':'two'} piece(s) of evidence${level==='E'?'; comment on a brief modulation if present':''}.`)}`;
  const ans = `Model: ${key}. Evidence: key signature, opening/closing chords, V or V7→I. ${level==='E'? rand(banks.excellencePhrases)+'.':''}`;
  return {topic:'tonality', stem, model: ans};
}

function genHarmony(level){
  const bars = 4; const pool = Array.from({length:bars},()=>rand(['C','G','F','Dm','Em','Am','E7','A7','D7','G/B','C/E','Bb','Eb','F/A']));
  const stem = `${DIFF[level](`Add chord symbols (jazz/rock) for a ${bars}-bar phrase. Include inversions where relevant.`)}`;
  const ans = `Model approach: derive chords from bass + upper voices; include at least one inversion; cadential function. ${level==='E'? rand(banks.excellencePhrases)+'.':''}`;
  return {topic:'harmony', stem, model: ans};
}

function genCadences(level){
  const cad = rand(banks.cadenceTypes);
  const stem = `${DIFF[level](`Name the cadence (${cad} may occur)${level!=='A'?'; describe/notate bass notes and the 7th where relevant':''}.`)}`;
  const ans = `Model: ${cad.split(' ')[0]} cadence with supporting chord tones.${level==='E'? ' Effect: closure vs continuation; voice‑leading of leading tone/7th.':''}`;
  return {topic:'cadences', stem, model: ans};
}

function genTexture(level){
  const stem = `${DIFF[level]('Discuss texture using specific evidence (bars/parts).')}`;
  const ans = `Model: monophonic → homophonic / imitative polyphony; evidence cites bars/parts.${level==='E'? ' State effect on listener/drive/contrast; '+rand(banks.excellencePhrases)+'.':''}`;
  return {topic:'texture', stem, model: ans};
}

function genDevices(level){
  const [name, def] = rand(banks.devices);
  const stem = `${DIFF[level](`Define the compositional device "${name}"${level!=='A'? ' and outline a 2–4 bar example':''}.`)}`;
  const ans = `Model: ${cap(name)} – ${def}.${level==='E'? ' Explain its impact on expectation/momentum.':''}`;
  return {topic:'devices', stem, model: ans};
}

function genPerf(level){
  const [name, why] = rand(banks.perf);
  const stem = `${DIFF[level](`Explain how the performance marking "${name}" would be played, with score evidence.`)}`;
  const ans = `Model: ${cap(name)} – ${why}.`;
  return {topic:'perf', stem, model: ans};
}

const GEN = { intervals:genIntervals, transposition:genTransposition, tonality:genTonality, harmony:genHarmony, cadences:genCadences, texture:genTexture, devices:genDevices, perf:genPerf };

const qs = [];
for(let i=0;i<N;i++){
  const t = rand(topics);
  const q = GEN[t] ? GEN[t](LEVEL) : GEN.intervals(LEVEL);
  qs.push({ number:i+1, ...q });
}
await fs.writeFile(OUT, JSON.stringify(qs, null, 2));
console.log('Wrote', OUT, 'with', qs.length, 'questions.');
