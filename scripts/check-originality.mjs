import fs from 'fs/promises';
import path from 'path';

const args = {};
const argv = process.argv.slice(2);
for(let i=0; i<argv.length; i++){
  const a = argv[i];
  if(a.startsWith('--')){
    const m = a.match(/^--([^=]+)=(.*)$/);
    if(m){
      args[m[1]] = m[2];
    } else {
      const key = a.replace(/^--/,'');
      const next = argv[i+1];
      if(next && !next.startsWith('--')){
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
}
const IN = args.in || 'pack.json';

const pack = JSON.parse(await fs.readFile(IN,'utf8'));
const corpus = JSON.parse(await fs.readFile('data/corpus.json','utf8'));

function ngrams(str, n=7){
  const words = str.toLowerCase().replace(/[^a-z0-9# ]/g,' ').split(/\s+/).filter(Boolean);
  const arr = []; for(let i=0;i<=words.length-n;i++){ arr.push(words.slice(i,i+n).join(' ')); } return new Set(arr);
}

function flag(question){
  const qset = ngrams(question, 7);
  for(const doc of corpus){
    const dset = ngrams(doc.text, 7);
    for(const g of qset){ if(dset.has(g)) return true; }
  }
  return false;
}

const report = pack.map(q=>({ number:q.number, topic:q.topic, risky: flag(q.stem) }));
const risky = report.filter(r=>r.risky);
console.table(report);
if(risky.length){
  console.log(`\n⚠️  ${risky.length} stem(s) triggered the 7-gram overlap rule. Re-generate or edit wording.`);
}else{
  console.log('\n✅ All stems passed the n-gram originality check.');
}
