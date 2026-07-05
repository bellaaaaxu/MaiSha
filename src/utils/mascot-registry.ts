// 长尾兜底的 ¥0 分配引擎（design §8.4）：rendezvous/HRW 一致性分配。
// 单向门约束：成员 id 一经上线永不改名；扩池时老商品只会保持原脸
// 或换到新成员，绝不互相洗牌（这是 hash % N 做不到的）。
import { normalizeName } from './normalize-name';

export interface MascotMember {
  /** 稳定 id——分配结果依赖它，永不改名 */
  id: string;
  /** public/mascots/<file>.webp */
  file: string;
  name: string;
  /** 虚拟节点数：队长 2，普通成员 1 */
  weight: number;
}

export const MASCOT_MEMBERS: MascotMember[] = [
  { id: 'xiaorongbao',   file: 'xiaorongbao',   name: '小榕包',   weight: 2 },
  { id: 'jiaozi',        file: 'jiaozi',        name: '饺子',     weight: 1 },
  { id: 'tanghulu',      file: 'tanghulu',      name: '糖葫芦',   weight: 1 },
  { id: 'jianbingguozi', file: 'jianbingguozi', name: '煎饼果子', weight: 1 },
  { id: 'chayedan',      file: 'chayedan',      name: '茶叶蛋',   weight: 1 },
  { id: 'danta',         file: 'danta',         name: '蛋挞',     weight: 1 },
  { id: 'boluobao',      file: 'boluobao',      name: '菠萝包',   weight: 1 },
  { id: 'xiajiao',       file: 'xiajiao',       name: '虾饺',     weight: 1 },
  { id: 'jidanzai',      file: 'jidanzai',      name: '鸡蛋仔',   weight: 1 },
  { id: 'zhenzhunaicha', file: 'zhenzhunaicha', name: '珍珠奶茶', weight: 1 },
  { id: 'fenglisu',      file: 'fenglisu',      name: '凤梨酥',   weight: 1 },
];

// FNV-1a 32-bit + murmur3 fmix32 终混。裸 FNV-1a 对只差末位字符的输入
// （虚拟节点 "#0"/"#1"）雪崩不足，两个分数强相关，队长加权会失效；
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

export function assignMascot(
  itemName: string,
  members: MascotMember[] = MASCOT_MEMBERS
): MascotMember {
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

export function mascotUrl(member: MascotMember): string {
  return `/mascots/${member.file}.webp`;
}
