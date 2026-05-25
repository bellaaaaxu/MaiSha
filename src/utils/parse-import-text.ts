import type { NewItemInput } from '@/types/item';

const PREFIX_RE = /^(?:[-•·]\s*|\d+[.)]\s*|[①②③④⑤⑥⑦⑧⑨⑩]\s*)/;
const QUANTITY_RE = /\s*[×xX*]\s*(\d+)\s*$|(\d+(?:\.\d+)?)\s*(盒|包|瓶|袋|斤|克|kg|g|个|只|条|根|块|片|罐|箱|升|ml|L)\s*$/i;

export interface ParsedItem {
  name: string;
  quantity: string;
  category: string;
  category_emoji: string;
}

export function parseImportText(text: string): ParsedItem[] {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const results: ParsedItem[] = [];

  for (const line of lines) {
    let cleaned = line.replace(PREFIX_RE, '').trim();
    if (!cleaned) continue;

    let quantity = '';
    const qMatch = cleaned.match(QUANTITY_RE);
    if (qMatch) {
      if (qMatch[1]) {
        quantity = qMatch[1];
      } else if (qMatch[2] && qMatch[3]) {
        quantity = `${qMatch[2]}${qMatch[3]}`;
      }
      cleaned = cleaned.replace(QUANTITY_RE, '').trim();
    }

    if (!cleaned) continue;

    results.push({
      name: cleaned,
      quantity,
      category: '其他',
      category_emoji: '📦',
    });
  }

  return results;
}

export function parsedToInputs(parsed: ParsedItem[], supermarket: string): NewItemInput[] {
  return parsed.map(p => ({
    name: p.name,
    quantity: p.quantity,
    supermarket,
  }));
}
