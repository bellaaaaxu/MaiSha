// Lightweight, hand-maintained traditional→simplified map for grocery/daily terms.
// Goal: let 繁体 / 粤语版 users' names collide with the simplified canonical key.
// NOT a full OpenCC — extend this table as real mismatches show up.
const TRAD_TO_SIMP: Record<string, string> = {
  '醬': '酱', '漿': '浆', '鹽': '盐',
  '雞': '鸡', '鴨': '鸭', '鵝': '鹅', '魚': '鱼', '蝦': '虾', '蠔': '蚝',
  '鱈': '鳕', '鮭': '鲑', '鮮': '鲜', '鱸': '鲈', '鯽': '鲫',
  '豬': '猪', '醃': '腌', '滷': '卤', '燉': '炖',
  '蘿': '萝', '蔔': '卜', '蔥': '葱', '薑': '姜',
  '麵': '面', '飯': '饭', '餅': '饼', '餃': '饺', '麥': '麦', '饅': '馒',
  '蘋': '苹', '檸': '柠', '蕎': '荞', '蘆': '芦', '薺': '荠',
  '鵪': '鹌', '鶉': '鹑', '黃': '黄', '蓮': '莲', '筍': '笋',
  '凍': '冻', '糰': '团', '餛': '馄', '飩': '饨', '腸': '肠',
};

export function normalizeName(name: string): string {
  const stripped = name.trim().replace(/\s+/g, '');
  let out = '';
  for (const ch of stripped) out += TRAD_TO_SIMP[ch] ?? ch;
  return out;
}
