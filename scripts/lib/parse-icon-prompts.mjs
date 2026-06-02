// scripts/lib/parse-icon-prompts.mjs
// Parse icon-prompts.md into structured items.
//
// Expected markdown shape:
//   ## 蔬菜                         ← category heading (may carry 🆕 prefix / （新增…）suffix)
//   ### 1. 娃娃菜 (baby-cabbage)     ← item heading: ### <index>. <中文名> (<pinyin-stem>)
//   ```
//   生成一个手绘素描…               ← prompt body inside the fenced block
//   ```
//
// Returns: Array<{ index:number, name:string, stem:string, category:string|null, prompt:string }>

const ITEM_RE = /^###\s*(\d+[a-z]*)\.\s*(.+?)\s*\(([a-z0-9-]+)\)\s*$/;

/** Strip the 🆕 prefix and a trailing （…）annotation from a raw category heading. */
export function cleanCategory(raw) {
  return raw
    .replace(/^🆕\s*/u, '')
    .replace(/（[^）]*）\s*$/u, '')
    .trim();
}

export function parseIconPrompts(markdown) {
  const lines = markdown.split(/\r?\n/);
  const items = [];
  let category = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Category: exactly "## " + text (two hashes, not three).
    if (/^##\s+/.test(line) && !/^###/.test(line)) {
      category = cleanCategory(line.replace(/^##\s+/, '').trim());
      continue;
    }

    // Item heading.
    const im = line.match(ITEM_RE);
    if (im) {
      const index = parseInt(im[1], 10);
      const name = im[2].trim();
      const stem = im[3];
      let prompt = '';

      // Find the opening fence, but never cross into the next item/category.
      let j = i + 1;
      while (j < lines.length && !/^```/.test(lines[j]) && !/^#{2,3}\s/.test(lines[j])) j++;

      if (j < lines.length && /^```/.test(lines[j])) {
        const buf = [];
        let k = j + 1;
        while (k < lines.length && !/^```/.test(lines[k])) {
          buf.push(lines[k]);
          k++;
        }
        prompt = buf.join('\n').trim();
        i = k; // advance past the closing fence (or EOF)
      }

      items.push({ index, name, stem, category, prompt });
    }
  }

  return items;
}
