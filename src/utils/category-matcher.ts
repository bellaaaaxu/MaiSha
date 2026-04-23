import { CATEGORY_DEFS, FALLBACK_CATEGORY, FALLBACK_CATEGORY_EMOJI } from './constants';
import type { CategoryKey } from '@/types/item';

export interface MatchResult {
  category: CategoryKey;
  emoji: string;
}

export function matchCategory(name: string): MatchResult {
  if (!name) {
    return { category: FALLBACK_CATEGORY, emoji: FALLBACK_CATEGORY_EMOJI };
  }
  for (const def of CATEGORY_DEFS) {
    for (const kw of def.keywords) {
      if (name.includes(kw)) {
        return { category: def.key, emoji: def.emoji };
      }
    }
  }
  return { category: FALLBACK_CATEGORY, emoji: FALLBACK_CATEGORY_EMOJI };
}
