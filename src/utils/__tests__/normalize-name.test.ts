import { describe, it, expect } from 'vitest';
import { normalizeName } from '../normalize-name';

describe('normalizeName', () => {
  it('strips surrounding whitespace and inner spaces', () => {
    expect(normalizeName('  生 抽 ')).toBe('生抽');
  });
  it('maps traditional chars to simplified (酱油)', () => {
    expect(normalizeName('醬油')).toBe(normalizeName('酱油'));
  });
  it('maps 椰漿 to match 椰浆', () => {
    expect(normalizeName('椰漿')).toBe('椰浆');
  });
  it('maps 雞蛋 to match 鸡蛋', () => {
    expect(normalizeName('雞蛋')).toBe('鸡蛋');
  });
  it('maps 蘿蔔 to match 萝卜', () => {
    expect(normalizeName('蘿蔔')).toBe('萝卜');
  });
  it('is identity for already-simplified spaceless names', () => {
    expect(normalizeName('牛奶')).toBe('牛奶');
  });
});
