// scripts/train-91276.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// pdf-parse has a bug where it runs test code on ESM import
// Use createRequire to import the library part directly
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse/lib/pdf-parse.js');

const INFO_DIR = 'info';
const OUT_DIR  = 'data';
const OUT_FILE = path.join(OUT_DIR, 'question_bank.json');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

/** Basic cleaners */
const clean = s => (s || '')
  .replace(/\u00A0/g, ' ')
  .replace(/[^\S\r\n]+/g, ' ')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

/** Mine stems commonly used in 91276 */
function mineStems(txt) {
  const stems = [];
  const rx = /(?:^|\n)\s*(?:\([a-e]\)\s*)?(Identify|Describe|Explain|Discuss|Analyse|Name|Add|Transpose|Transcribe|Complete|Annotate)\b[\s\S]{0,180}?\./gmi;
  let m;
  while ((m = rx.exec(txt))) {
    const s = m[0].replace(/^\s*\([a-e]\)\s*/i,'').trim();
    if (s.length > 18 && s.length < 220) stems.push(s);
  }
  return [...new Set(stems)];
}

/** Mine rubric A/M/E language blocks */
function mineRubric(txt){
  const lines = txt.split('\n').map(l=>l.trim());
  const rubric = { A:[], M:[], E:[] };
  for (const L of lines) {
    if (!L) continue;
    const low = L.replace(/^\s*[-•]\s*/,'');
    if (/^Achievement\b/i.test(L) || /identify|name|describe\b/i.test(low)) rubric.A.push(low);
    if (/evidence|explain|because|how|why|includes/i.test(low)) rubric.M.push(low);
    if (/analyse|effect|impact|justify|modulation|tessitura/i.test(low)) rubric.E.push(low);
  }
  rubric.A = [...new Set(rubric.A)].slice(0,40);
  rubric.M = [...new Set(rubric.M)].slice(0,40);
  rubric.E = [...new Set(rubric.E)].slice(0,40);
  return rubric;
}

/** Topic tagging heuristics based on stems */
function bucketByTopic(stems){
  const by = { Tonality:[], Harmony:[], Cadences:[], Intervals:[], Transposition:[] };
  for (const s of stems) {
    const t = s.toLowerCase();
    if (/key|tonality|modulat/.test(t)) by.Tonality.push(s);
    else if (/chord|roman|symbol|inversion/.test(t)) by.Harmony.push(s);
    else if (/cadence/.test(t)) by.Cadences.push(s);
    else if (/interval/.test(t)) by.Intervals.push(s);
    else if (/transpose|concert pitch|written pitch/.test(t)) by.Transposition.push(s);
  }
  return by;
}

async function parsePdf(file){
  try {
    const buf = fs.readFileSync(file);
    const data = await pdf(buf);
    return clean(data.text);
  } catch (e) {
    console.error('[trainer] Skipping', file, e.message);
    return '';
  }
}

async function main() {
  const files = (fs.existsSync(INFO_DIR) ? fs.readdirSync(INFO_DIR) : [])
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(INFO_DIR, f));

  if (files.length === 0) {
    console.warn('[trainer] No PDFs found in /info. Writing minimal bank.');
  }

  const texts = [];
  for (const f of files) {
    const t = await parsePdf(f);
    if (t) texts.push(t);
  }
  const joined = clean(texts.join('\n\n'));
  const stems  = mineStems(joined);
  const rubric = mineRubric(joined);
  const topics = bucketByTopic(stems);

  // Small curated music templates that VexFlow can engrave reliably.
  // These are *musical* building blocks; stems from PDFs provide the words.
  const templates = {
    Tonality: [
      { key:'G', time:'4/4', bars:[['G4/8','A4/8','B4/8','C5/8','D5/8','C5/8','B4/8','G4/8']], cadence:'V–I' },
      { key:'F', time:'4/4', bars:[['F4/8','G4/8','A4/8','Bb4/8','C5/8','Bb4/8','A4/8','F4/8']], cadence:'V–I' }
    ],
    Harmony: [
      { key:'C', time:'4/4', roman:['I','IV','V','I'], bass:['C3/4','F3/4','G3/4','C3/4'] }
    ],
    Cadences: [
      { key:'D', type:'perfect (V–I)', seg:[['A3/4','D4/4']] }
    ],
    Intervals: [
      { label:'M3', semi:4 }, { label:'P5', semi:7 }, { label:'m6', semi:8 }
    ],
    Transposition: [
      { inst:'Clarinet in Bb', dir:'to concert', interval:'M2 down' }
    ]
  };

  const bank = {
    source_files: files.map(f=>path.basename(f)),
    stems, rubric, topics, templates,
    meta: { generated_at: new Date().toISOString() }
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(bank, null, 2), 'utf8');
  console.log('[trainer] Wrote', OUT_FILE, 'stems:', stems.length, 'A/M/E:', rubric.A.length, rubric.M.length, rubric.E.length);
}

main().catch(err => {
  console.error('[trainer] Fatal:', err);
  // Do not fail the workflow hard; still write an empty bank so the site works.
  const fallback = { stems:[], rubric:{A:[],M:[],E:[]}, topics:{}, templates:{}, meta:{ generated_at:new Date().toISOString(), error:String(err) } };
  try {
    if (!fs.existsSync('data')) fs.mkdirSync('data',{recursive:true});
    fs.writeFileSync('data/question_bank.json', JSON.stringify(fallback,null,2));
    console.log('[trainer] Wrote fallback bank.');
    process.exit(0);
  } catch (e) {
    process.exit(1);
  }
});
