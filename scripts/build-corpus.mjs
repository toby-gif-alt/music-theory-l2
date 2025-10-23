import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const INFO_DIR = path.resolve('info');
const DATA_DIR = path.resolve('data');
await fs.mkdir(DATA_DIR, { recursive: true });

function cleanText(txt){
  return txt
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

// Heuristic: extract lines that look like task stems and marking phrases
function minePatterns(text){
  const lines = text.split('\n').map(s=>s.trim()).filter(Boolean);
  const stems = [];
  const verbs = [];
  const reStem = /(Identify|Describe|Explain|Discuss|Analyse|Transcribe|Transpose|Add|Annotate|Name|Notate)/i;
  const reMark = /(evidence|effect|cadence|key signature|interval|texture|transposition|tablature|reduction|modulation)/i;
  for(const line of lines){
    if(reStem.test(line) && reMark.test(line) && line.length>30){ stems.push(line); }
    if(/(creates a sense|adds .* momentum|contrast|unity|closure|drive)/i.test(line)){ verbs.push(line); }
  }
  return { stems, verbs };
}

async function loadPdf(file){
  const buf = await fs.readFile(file);
  const data = await pdf(buf);
  return cleanText(data.text || '');
}

const entries = [];
const patterns = { stems: [], verbs: [] };
const files = await fs.readdir(INFO_DIR);
for(const f of files){
  const full = path.join(INFO_DIR, f);
  if(/\.pdf$/i.test(f)){
    try{
      const text = await loadPdf(full);
      entries.push({ file: f, text });
      const p = minePatterns(text);
      patterns.stems.push(...p.stems);
      patterns.verbs.push(...p.verbs);
      console.log('Parsed', f, 'stems+', p.stems.length, 'verbs+', p.verbs.length);
    }catch(e){ console.warn('Skip', f, e.message); }
  } else if(/\.(txt|md)$/i.test(f)){
    const text = cleanText(await fs.readFile(full, 'utf8'));
    entries.push({ file: f, text });
    const p = minePatterns(text);
    patterns.stems.push(...p.stems);
    patterns.verbs.push(...p.verbs);
  }
}

await fs.writeFile(path.join(DATA_DIR, 'corpus.json'), JSON.stringify(entries, null, 2));
await fs.writeFile(path.join(DATA_DIR, 'patterns.json'), JSON.stringify({
  stems: Array.from(new Set(patterns.stems)).slice(0, 2000),
  verbs: Array.from(new Set(patterns.verbs)).slice(0, 500)
}, null, 2));
console.log('Saved data/corpus.json and data/patterns.json');

// Seed banks file if missing
try{ await fs.access(path.join(DATA_DIR, 'banks.json')); }catch{
  await fs.copyFile('data/banks.json', path.join(DATA_DIR, 'banks.json'));
}
