import { describe, it, expect } from 'vitest';
import { buildIconMap, type IconMapRow } from '../icon-map';

const url = (p: string) => `URL(${p})`;

describe('buildIconMap', () => {
  it('library same-name: earliest created_at wins (first-author owns name)', () => {
    const rows: IconMapRow[] = [
      { name: '酱油', image_path: 'new', source: 'ai_generated', kind: 'library', created_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z' },
      { name: '酱油', image_path: 'old', source: 'upload', kind: 'library', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
    ];
    expect(buildIconMap(rows, url).get('酱油')).toBe('URL(old)');
  });

  it('assignment overrides library regardless of created_at', () => {
    const rows: IconMapRow[] = [
      { name: '酱油', image_path: 'lib', source: 'upload', kind: 'library', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      { name: '酱油', image_path: 'assigned', source: 'upload', kind: 'assignment', created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-01T00:00:00Z' },
    ];
    expect(buildIconMap(rows, url).get('酱油')).toBe('URL(assigned)');
  });

  it('normalizes keys so 椰漿 and 椰浆 collapse to one entry', () => {
    const rows: IconMapRow[] = [
      { name: '椰漿', image_path: 'trad', source: 'upload', kind: 'library', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    ];
    const m = buildIconMap(rows, url);
    expect(m.get('椰浆')).toBe('URL(trad)');
  });
});
