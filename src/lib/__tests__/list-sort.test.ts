import { describe, it, expect } from 'vitest';
import { sortLists, canArchive, canDelete, validateListName } from '../list-sort';
import type { List } from '@/types/list';

const mk = (over: Partial<List>): List => ({
  id: over.id ?? 'x',
  name: over.name ?? 'x',
  owner_uid: 'u',
  member_uids: ['u'],
  supermarkets: [],
  short_code: '',
  account_id: 'a',
  state: 'active',
  pin_order: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: over.updated_at ?? '2026-01-01T00:00:00Z',
  ...over,
});

describe('sortLists', () => {
  it('groups by state', () => {
    const rows = [
      mk({ id: '1', state: 'pinned', pin_order: 0 }),
      mk({ id: '2', state: 'active' }),
      mk({ id: '3', state: 'archived' }),
    ];
    const g = sortLists(rows);
    expect(g.pinned.map(r => r.id)).toEqual(['1']);
    expect(g.active.map(r => r.id)).toEqual(['2']);
    expect(g.archived.map(r => r.id)).toEqual(['3']);
  });

  it('pinned sorted by pin_order ASC, NULLS LAST, then updated_at DESC', () => {
    const rows = [
      mk({ id: 'b', state: 'pinned', pin_order: 1, updated_at: '2026-02-01T00:00:00Z' }),
      mk({ id: 'a', state: 'pinned', pin_order: 0, updated_at: '2026-01-01T00:00:00Z' }),
      mk({ id: 'c', state: 'pinned', pin_order: null, updated_at: '2026-03-01T00:00:00Z' }),
    ];
    expect(sortLists(rows).pinned.map(r => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('active/archived sorted by updated_at DESC', () => {
    const rows = [
      mk({ id: 'old', state: 'active', updated_at: '2026-01-01T00:00:00Z' }),
      mk({ id: 'new', state: 'active', updated_at: '2026-03-01T00:00:00Z' }),
    ];
    expect(sortLists(rows).active.map(r => r.id)).toEqual(['new', 'old']);
  });

  it('sorts correctly across mixed timestamp precisions (no localeCompare bug)', () => {
    const rows = [
      mk({ id: 'A', state: 'active', updated_at: '2026-01-01T00:00:00Z' }),       // 1 sec earlier
      mk({ id: 'B', state: 'active', updated_at: '2026-01-01T00:00:00.500Z' }),   // 0.5 sec later
    ];
    // B is more recent; DESC means B first.
    expect(sortLists(rows).active.map(r => r.id)).toEqual(['B', 'A']);
  });

  it('sortLists on empty array returns empty groups', () => {
    expect(sortLists([])).toEqual({ pinned: [], active: [], archived: [] });
  });
});

describe('canArchive', () => {
  const a = mk({ id: 'a', state: 'pinned' });
  const b = mk({ id: 'b', state: 'active' });
  const c = mk({ id: 'c', state: 'archived' });

  it('false if it is the last active+pinned', () => {
    expect(canArchive(a, [a, c])).toBe(false); // only 'a' is non-archived
  });
  it('true if other active+pinned exist', () => {
    expect(canArchive(a, [a, b, c])).toBe(true);
  });
  it('true for an already-archived list (no-op, but allowed)', () => {
    expect(canArchive(c, [a, c])).toBe(true);
  });
});

describe('canDelete', () => {
  it('mirrors canArchive behavior', () => {
    const a = mk({ id: 'a', state: 'pinned' });
    const b = mk({ id: 'b', state: 'active' });
    expect(canDelete(a, [a])).toBe(false);     // last active+pinned
    expect(canDelete(a, [a, b])).toBe(true);   // others exist
  });
});

describe('validateListName', () => {
  it('rejects empty', () => {
    expect(validateListName('').ok).toBe(false);
    expect(validateListName('   ').ok).toBe(false);
  });
  it('rejects > 20 chars (after trim)', () => {
    expect(validateListName('a'.repeat(21)).ok).toBe(false);
  });
  it('accepts trimmed 1..20 chars', () => {
    expect(validateListName('家里').ok).toBe(true);
    expect(validateListName('a'.repeat(20)).ok).toBe(true);
    expect(validateListName('  家里  ').ok).toBe(true);
  });
});
