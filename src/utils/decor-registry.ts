// 长尾兜底装饰引擎（design §8.4，2026-07-05 换装）：rendezvous/HRW 一致性分配。
// 单向门约束：成员 id 一经上线永不改名；扩池时老商品只会保持原贴纸
// 或换到新成员，绝不互相洗牌（这是 hash % N 做不到的）。
// 池子 = 梅兰竹菊装饰系 12 只无脸雅集花卉，等权重（队长加权随小人退役取消）。
import { normalizeName } from './normalize-name';

export interface DecorMember {
  /** 稳定 id——分配结果依赖它，永不改名 */
  id: string;
  /** public/flora/<file>.webp */
  file: string;
  name: string;
  /** 虚拟节点数：装饰层等权重全 1，字段保留供未来用 */
  weight: number;
}

export const DECOR_MEMBERS: DecorMember[] = [
  { id: 'mei',      file: 'mei',      name: '梅',   weight: 1 },
  { id: 'lan',      file: 'lan',      name: '兰',   weight: 1 },
  { id: 'zhu',      file: 'zhu',      name: '竹',   weight: 1 },
  { id: 'ju',       file: 'ju',       name: '菊',   weight: 1 },
  { id: 'song',     file: 'song',     name: '松',   weight: 1 },
  { id: 'he',       file: 'he',       name: '荷',   weight: 1 },
  { id: 'gui',      file: 'gui',      name: '桂',   weight: 1 },
  { id: 'yinxing',  file: 'yinxing',  name: '银杏', weight: 1 },
  { id: 'feng',     file: 'feng',     name: '枫',   weight: 1 },
  { id: 'shuixian', file: 'shuixian', name: '水仙', weight: 1 },
  { id: 'ziteng',   file: 'ziteng',   name: '紫藤', weight: 1 },
  { id: 'luwei',    file: 'luwei',    name: '芦苇', weight: 1 },
];

// FNV-1a 32-bit + murmur3 fmix32 终混。裸 FNV-1a 对只差末位字符的输入
// （虚拟节点 "#0"/"#1"）雪崩不足，分数强相关会让加权失效；
// fmix32 全雪崩后才能当独立均匀分数用。
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function assignDecor(
  itemName: string,
  members: DecorMember[] = DECOR_MEMBERS
): DecorMember {
  const key = normalizeName(itemName);
  let best = members[0];
  let bestScore = -1;
  for (const m of members) {
    for (let v = 0; v < m.weight; v++) {
      const score = fnv1a(`${key} ${m.id}#${v}`);
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
  }
  return best;
}

export function decorUrl(member: DecorMember): string {
  return `/flora/${member.file}.webp`;
}
