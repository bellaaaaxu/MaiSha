import { describe, it, expect } from 'vitest';
import { haversineMeters } from '../store-finder-utils';

describe('haversineMeters', () => {
  it('returns ~0 for the same point', () => {
    expect(haversineMeters({ lat: 31.23, lng: 121.47 }, { lat: 31.23, lng: 121.47 })).toBeLessThan(1);
  });

  it('computes a known distance (~1.11km per 0.01° latitude)', () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 0.01, lng: 0 });
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1120);
  });
});
