import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const INFO_DIR = path.resolve('info');
const DATA_DIR = path.resolve('data');
await fs.mkdir(DATA_DIR, { recursive: true });

function cleanText(txt){
  return (txt||'')
    .replace(/\r/g,'\n')
    .replace(/\u00a0/g,' ')
    .replace(/[\t ]+/g,' ')
    .replace(/\n{2,}/g,'\n')
    .trim();
}

function minePatterns(text){
  const lines = text.split('\n').map(s=>s.trim()).filter(Boolean);
  const stems = [];
  const verbs = [];
  const markBits = [];
  const reStem = /\b(Identify|Describe|Explain|Discuss|Analyse|Transcribe|Transpose|Add|Annotate|Name|Notate)\b/i;
  const reMark = /(evidence|effect|cadence|key signature|interval|texture|transposition|tablature|reduction|modulation|harmony|chord|tempo|dynamics|articulation)/i;
  for(const line of lines){
    if(line.length>30 && reStem.test(line) && reMark.test(line)) stems.push(line);
    if(/(creates a sense|adds .* momentum|contrast|unity|closure|drive|energy|tension|resolution|character and feel)/i.test(line)) verbs.push(line);
    if(/(Achievement|Merit|Excellence|underlined|bold-type|evidence)/i.test(line)) markBits.push(line);
  }
  return { stems, verbs, markBits };
}

async function loadPdf(file){
  const buf = await fs.readFile(file);
  const data = await pdf(buf);
  return cleanText(data.text||'');
}

const entries = [];
const agg = { stems:[], verbs:[], markBits:[] };

const files = (await fs.readdir(INFO_DIR)).filter(f=>f.toLowerCase().endsWith('.pdf'));
for(const f of files){
  try{
    const text = await loadPdf(path.join(INFO_DIR, f));
    entries.push({ file:f, text });
    const mined = minePatterns(text);
    agg.stems.push(...mined.stems);
    agg.verbs.push(...mined.verbs);
    agg.markBits.push(...mined.markBits);
    console.log('parsed', f, 'stems', mined.stems.length, 'verbs', mined.verbs.length);
  }catch(e){
    console.warn('skip', f, e.message);
  }
}

// Deduplicate and cap sizes to keep payload light for Pages
function uniq(arr,max=1000){ return Array.from(new Set(arr)).slice(0,max); }
const patterns = {
  stems: uniq(agg.stems, 1500),
  verbs: uniq(agg.verbs, 500),
  rubric: uniq(agg.markBits, 300)
};

await fs.writeFile(path.join(DATA_DIR,'corpus.json'), JSON.stringify(entries,null,2));
await fs.writeFile(path.join(DATA_DIR,'patterns.json'), JSON.stringify(patterns,null,2));
console.log('wrote data/corpus.json and data/patterns.json');

// Ensure banks.json exists
try{ await fs.access(path.join(DATA_DIR,'banks.json')); }
catch{ await fs.writeFile(path.join(DATA_DIR,'banks.json'), JSON.stringify({
  intervalQualities:["minor","major","perfect","diminished","augmented"],
  intervalNumbers:["2nd","3rd","4th","5th","6th","7th","octave"],
  keys:["C","G","D","A","E","B","F#","F","Bb","Eb","Ab","Db"],
  modes:["major","minor"],
  cadenceTypes:["perfect (V–I)","plagal (IV–I)","imperfect (any–V)","interrupted (V–vi)"],
  devices:[["sequence","repetition of a motif higher/lower"],["ostinato","repeated motif"],["inversion","intervals inverted"],["augmentation","note values lengthened"],["diminution","note values shortened"],["pedal point","sustained/repeated note under changing harmonies"],["syncopation","accents on weak/off beats"]],
  perf:[["staccato","short/detached"],["tenuto","held slightly longer"],["marcato","accented"],["accent","emphasised"],["legato","smooth/connected"]],
  instruments:{ Bb:["Clarinet in Bb","Trumpet in Bb","Soprano Sax in Bb"], Eb:["Alto Sax in Eb","Baritone Sax in Eb"], F:["Horn in F"] },
  excellencePhrases:[
    "creates a sense of unity","adds energy and momentum","centres the harmony around the tonic",
    "produces a dramatic contrast","strengthens the cadence/resolution",
    "increases intensity towards a climax","clarifies the perceived metre for the listener"
  ]
},null,2)); }
