import { normalizeName } from '@/utils/normalize-name';

export interface IconMapRow {
  name: string;
  image_path: string;
  source: string;
  kind: 'library' | 'assignment';
  created_at: string;
  updated_at: string;
}

/**
 * Build the name→url map a list renders from.
 * Priority (low→high): library union (created_at EARLIEST wins) < this list's assignments.
 * Keys are normalized (simp/trad) so 椰漿/椰浆 collapse and resolveIconUrl(normalizeName(name)) hits.
 */
export function buildIconMap(
  rows: IconMapRow[],
  urlFor: (imagePath: string) => string
): Map<string, string> {
  const map = new Map<string, string>();

  // Library: sort created_at DESCENDING, set each -> the EARLIEST is written last and wins.
  const library = rows
    .filter(r => r.kind === 'library')
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const r of library) map.set(normalizeName(r.name), urlFor(r.image_path));

  // Assignments override on top (unique per (list,name), so order among them is irrelevant).
  for (const r of rows.filter(r => r.kind === 'assignment')) {
    map.set(normalizeName(r.name), urlFor(r.image_path));
  }

  return map;
}
