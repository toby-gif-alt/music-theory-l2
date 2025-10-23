// scripts/train-91276.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const INFO_DIR = 'info';
const OUT_DIR  = 'data';
const OUT_FILE = path.join(OUT_DIR, 'question_bank.json');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

/** Basic cleaners */
const clean = s => s
  .replace(/\u00A0/g, ' ')
  .replace(/[^\S\r\n]+/g, ' ')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

/** Mine stems commonly used in 91276 */
function mineStems(txt) {
  const stems = [];
  const rx = new RegExp(
    [
      // common imperative starters
      '^\\s*\\((?:a|b|c|d|e)\\)[\\s\\S]{0,8}\\)?\\s*',
      '(?:Identify|Describe|Explain|Discuss|Analyse|Name|Add|Transpose|Transcribe|Complete|Annotate)\\b[\\s\\S]{0,180}?\\.'
    ].join(''),
    'gmi'
  );
  let m;
  while ((m = rx.exec(txt))) {
    const s = m[0].replace(/^\s*\([a-e]\)\s*/i,'').trim();
    if (s.length > 18 && s.length < 220) stems.push(s);
  }
  return [...new Set(stems)];
}

/** Mine rubric A/M/E language blocks */
function mineRubric(txt) {
  const lines = txt.split('\n').map(l => l.trim());
  const rubric = { A: [], M: [], E: [] };

  // Collect "Achievement / Merit / Excellence" rows near "Evidence" tables
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (/Achievement\b/i.test(L) && /Merit\b/i.test(L) && /Excellence\b/i.test(L)) continue;
    if (/^Achievement\b/i.test(L)) rubric.A.push(L);
    if (/^Explains\b|^Appl(y|ies)\b|^Describes\b|^Discusses\b|^Identifies\b/i.test(L)) {
      // heuristic: gather qualifying evidence lines
      if (lines[i-1] && /Evidence/i.test(lines[i-1])) continue;
      const low = L.replace(/^\s*[-•]\s*/,'');
      if (low.length > 12) {
        if (/Analyse|effect|impact|comprehensive|justify|modulation|tessitura/i.test(low)) rubric.E.push(low);
        else if (/Explain|evidence|with|because|why|how|includes/i.test(low)) rubric.M.push(low);
        else rubric.A.push(low);
      }
    }
  }
  // Dedup & trim
  rubric.A = [...new Set(rubric.A)].slice(0, 40);
  rubric.M = [...new Set(rubric.M)].slice(0, 40);
  rubric.E = [...new Set(rubric.E)].slice(0, 40);
  return rubric;
}

/** Topic tagging heuristics based on stems */
function bucketByTopic(stems) {
  const by = { Tonality:[], Harmony:[], Cadences:[], Intervals:[], Transposition:[], Texture:[], Devices:[], Notation:[] };
  for (const s of stems) {
    const t = s.toLowerCase();
    if (/key|tonality|modulat/i.test(t)) by.Tonality.push(s);
    else if (/chord|roman|symbol|inversion/i.test(t)) by.Harmony.push(s);
    else if (/cadence/i.test(t)) by.Cadences.push(s);
    else if (/interval/i.test(t)) by.Intervals.push(s);
    else if (/transpose|concert pitch|written pitch/i.test(t)) by.Transposition.push(s);
    else if (/texture|instrumentation|polyphonic|homophonic/i.test(t)) by.Texture.push(s);
    else if (/device|sequence|ostinato|inversion|augmentation|diminution/i.test(t)) by.Devices.push(s);
    else if (/annotate|add.*key signature|time signature|transcribe|tablature|clef/i.test(t)) by.Notation.push(s);
  }
  return by;
}

async function main() {
  const files = fs.readdirSync(INFO_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(INFO_DIR, f));

  const allText = [];
  for (const f of files) {
    try {
      const data = await pdf(fs.readFileSync(f));
      allText.push(clean(data.text));
    } catch (e) {
      console.error('PDF parse failed:', f, e.message);
    }
  }
  const joined = clean(allText.join('\n\n'));

  const stems = mineStems(joined);
  const rubric = mineRubric(joined);
  const topics = bucketByTopic(stems);

  // Small curated music templates that VexFlow can engrave reliably.
  // These are *musical* building blocks; stems from PDFs provide the words.
  const templates = {
    Tonality: [
      { key: 'G',  time: '4/4', bars: [['G4/8','A4/8','B4/8','C5/8','D5/8','C5/8','B4/8','G4/8']] , cadence: 'V–I' },
      { key: 'F',  time: '4/4', bars: [['F4/8','G4/8','A4/8','Bb4/8','C5/8','Bb4/8','A4/8','F4/8']] , cadence: 'V–I' },
      { key: 'D',  time: '3/4', bars: [['D4/8','E4/8','F#4/8','G4/8','A4/8','G4/8','F#4/8','E4/8','D4/8']] , cadence: 'V–I' }
    ],
    Harmony: [
      { key: 'C', time:'4/4', roman:['I','IV','V','I'], bass: ['C3/4','F3/4','G3/4','C3/4'] },
      { key: 'G', time:'4/4', roman:['I','ii','V','I'],   bass: ['G2/4','A2/4','D3/4','G2/4'] }
    ],
    Cadences: [
      { key:'D', type:'perfect (V–I)',   seg:[['A3/4','D4/4']] },
      { key:'A', type:'interrupted (V–vi)', seg:[['E3/4','F#3/8','E3/8','F#3/2']] }
    ],
    Intervals: [
      { label:'P4',  semi:5 }, { label:'M3', semi:4 }, { label:'m3', semi:3 },
      { label:'M6', semi:9 }, { label:'m6', semi:8 }, { label:'P5', semi:7 }
    ],
    Transposition: [
      { inst:'Clarinet in Bb',  dir:'to concert',  interval:'M2 down' },
      { inst:'Alto Sax in Eb',  dir:'to concert',  interval:'M6 down' },
      { inst:'Horn in F',       dir:'to concert',  interval:'P5 down' }
    ]
  };

  const bank = {
    source_files: files.map(f=>path.basename(f)),
    stems, rubric,
    topics,
    templates,
    meta: {
      generated_at: new Date().toISOString(),
      note: "Built from /info PDFs. Stems provide wording; templates provide engravable music."
    }
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(bank, null, 2), 'utf8');
  console.log('Wrote', OUT_FILE);
}

main().catch(e => { console.error(e); process.exit(1); });
