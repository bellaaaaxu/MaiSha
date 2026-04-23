export interface FrequentItem {
  name: string;
  note: string;
  supermarket: string;
  category_emoji: string;
  count: number;
  lastUsedAt: number;
}

export type UsageInput = Pick<FrequentItem, 'name' | 'note' | 'supermarket' | 'category_emoji'>;

function storageKey(uid: string): string {
  return `maisha:frequent:${uid}`;
}

function aggKey(i: UsageInput): string {
  return `${i.name}|${i.note}|${i.supermarket}`;
}

function load(uid: string): FrequentItem[] {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function save(uid: string, items: FrequentItem[]): void {
  localStorage.setItem(storageKey(uid), JSON.stringify(items));
}

export function recordItemUsage(uid: string, input: UsageInput): void {
  const all = load(uid);
  const k = aggKey(input);
  const existing = all.find(it => aggKey(it) === k);
  const now = Date.now();
  if (existing) {
    existing.count += 1;
    existing.lastUsedAt = now;
  } else {
    all.push({ ...input, count: 1, lastUsedAt: now });
  }
  save(uid, all);
}

export function getTopFrequentItems(uid: string, limit: number): FrequentItem[] {
  const all = load(uid);
  return all
    .slice()
    .sort((a, b) => b.count - a.count || b.lastUsedAt - a.lastUsedAt)
    .slice(0, limit);
}

export function getRecentItems(uid: string, limit: number): FrequentItem[] {
  const all = load(uid);
  return all
    .slice()
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, limit);
}
