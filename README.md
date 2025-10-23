# AS91276 AI Question Generator (Node CLI)

**Goal:** Generate original questions that *follow the shapes/phrasing* of NZQA 91276 without copying wording verbatim.

## Folder layout
```
repo/
  info/                 # put your PDFs/DOCs here (exam booklets + schedules + practice packs)
  data/
    corpus.json         # auto-built text corpus (cleaned text, per-file)
    patterns.json       # auto-mined task patterns (intervals, transposition, texture, etc.)
    banks.json          # seed musical data banks used to parameterise templates
  scripts/
    build-corpus.mjs    # parse PDFs -> text, mine patterns, save corpus + patterns
    generate.mjs        # generate questions using patterns + banks
    check-originality.mjs # sanity check: n-gram overlap & cosine similarity vs corpus
```

## Quick start
1. Put all your uploaded documents into `info/`.
2. Install deps: `npm i`
3. Build corpus & discover patterns: `npm run build:corpus`
4. Generate a pack: `npm run generate -- --n 12 --topics intervals,transposition,texture --level E --out pack.json`
5. (Optional) Check originality: `npm run check -- --in pack.json`

## Notes
- We don't *train* an ML model. We mine *patterns* (task shapes + verbs) and fill them with parameterised musical content to ensure originality and NZQA-aligned phrasing.
- `check-originality.mjs` prevents close copying (e.g., 7+ word n-gram matches) and flags high-similarity stems.
