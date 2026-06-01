// scripts/data/item-catalog.mjs
//
// Bulk supermarket catalog for batch icon generation (食品全品类 + 日常家居).
// Each entry: { name, stem, category, desc? } — `desc` is an optional visual hint;
// the generator falls back to `name` when omitted, and wraps it in the shared
// STYLE_TEMPLATE (see generate-item-icons.mjs).
//
// Hand-tuned items live in icon-prompts.md; THIS file is the deduped complement.
// Invariants (enforced by tests/item-catalog.test.mjs): stems are [a-z0-9-]+,
// unique here, and never collide with an icon-prompts.md stem.
// `category` values are already the registry categories used by icon-registry.ts.
//
// Packaging/container items pin the vessel + 「无标签无文字」 in desc so the model
// renders a consistent object (and avoids hallucinating brand logos/text).

export default [
  // ── 蔬菜 ──
  { name: '茄子', stem: 'eggplant', category: '蔬菜', desc: '一根紫色长茄子，表皮光亮' },
  { name: '彩椒', stem: 'bell-pepper', category: '蔬菜', desc: '红黄绿三只甜椒' },
  { name: '大白菜', stem: 'napa-cabbage', category: '蔬菜', desc: '一棵大白菜，叶片层叠' },
  { name: '卷心菜', stem: 'cabbage', category: '蔬菜', desc: '一颗圆球卷心菜' },
  { name: '冬瓜', stem: 'winter-melon', category: '蔬菜', desc: '一段带白霜的冬瓜' },
  { name: '南瓜', stem: 'pumpkin', category: '蔬菜', desc: '橙黄色小南瓜' },
  { name: '丝瓜', stem: 'luffa', category: '蔬菜', desc: '绿色长丝瓜' },
  { name: '苦瓜', stem: 'bitter-melon', category: '蔬菜', desc: '绿色带疙瘩的苦瓜' },
  { name: '四季豆', stem: 'green-beans', category: '蔬菜', desc: '一把翠绿四季豆' },
  { name: '香菇', stem: 'shiitake', category: '蔬菜', desc: '几朵新鲜香菇' },
  { name: '金针菇', stem: 'enoki-mushroom', category: '蔬菜', desc: '一束白色金针菇' },
  { name: '木耳', stem: 'wood-ear', category: '蔬菜', desc: '泡发的黑木耳' },
  { name: '莲藕', stem: 'lotus-root', category: '蔬菜', desc: '一节莲藕，断面有孔' },
  { name: '山药', stem: 'chinese-yam', category: '蔬菜', desc: '一根细长山药' },
  { name: '红薯', stem: 'sweet-potato', category: '蔬菜', desc: '红皮红薯' },
  { name: '芋头', stem: 'taro', category: '蔬菜', desc: '带毛芋头' },
  { name: '上海青', stem: 'bok-choy', category: '蔬菜', desc: '青翠上海青' },
  { name: '豆芽', stem: 'bean-sprouts', category: '蔬菜', desc: '一把黄豆芽' },
  { name: '辣椒', stem: 'chili-pepper', category: '蔬菜', desc: '红绿小尖椒' },
  { name: '蒜薹', stem: 'garlic-scape', category: '蔬菜', desc: '一束绿色蒜薹' },
  { name: '西葫芦', stem: 'zucchini', category: '蔬菜', desc: '绿色西葫芦' },
  { name: '香菜', stem: 'cilantro', category: '蔬菜', desc: '一把带根香菜' },
  { name: '芦笋', stem: 'asparagus', category: '蔬菜', desc: '一束绿芦笋' },
  { name: '毛豆', stem: 'edamame', category: '蔬菜', desc: '一把带荚毛豆' },

  // ── 水果 ──
  { name: '橘子', stem: 'mandarin', category: '水果', desc: '几个小橘子' },
  { name: '猕猴桃', stem: 'kiwi', category: '水果', desc: '切开的绿心猕猴桃' },
  { name: '芒果', stem: 'mango', category: '水果', desc: '黄色芒果' },
  { name: '菠萝', stem: 'pineapple', category: '水果', desc: '带叶菠萝' },
  { name: '火龙果', stem: 'dragon-fruit', category: '水果', desc: '粉红火龙果' },
  { name: '桃子', stem: 'peach', category: '水果', desc: '粉红水蜜桃' },
  { name: '樱桃', stem: 'cherry', category: '水果', desc: '一串红樱桃' },
  { name: '哈密瓜', stem: 'cantaloupe', category: '水果', desc: '切块哈密瓜' },
  { name: '柚子', stem: 'pomelo', category: '水果', desc: '黄绿色柚子' },
  { name: '椰子', stem: 'coconut', category: '水果', desc: '棕色椰子' },
  { name: '荔枝', stem: 'lychee', category: '水果', desc: '一串红荔枝' },
  { name: '石榴', stem: 'pomegranate', category: '水果', desc: '红石榴，露出籽' },
  { name: '山楂', stem: 'hawthorn', category: '水果', desc: '一捧红山楂' },
  { name: '龙眼', stem: 'longan', category: '水果', desc: '一串龙眼' },

  // ── 肉蛋（肉类）──
  { name: '猪肉', stem: 'pork', category: '肉蛋', desc: '一块新鲜猪肉' },
  { name: '肉末', stem: 'ground-pork', category: '肉蛋', desc: '一堆猪肉末' },
  { name: '里脊', stem: 'pork-loin', category: '肉蛋', desc: '一条猪里脊' },
  { name: '鸡胸肉', stem: 'chicken-breast', category: '肉蛋', desc: '两块鸡胸肉' },
  { name: '鸡腿', stem: 'chicken-leg', category: '肉蛋', desc: '两只鸡腿' },
  { name: '鸡翅', stem: 'chicken-wings', category: '肉蛋', desc: '几只鸡翅' },
  { name: '牛肉', stem: 'beef', category: '肉蛋', desc: '一块红牛肉' },
  { name: '牛排', stem: 'steak', category: '肉蛋', desc: '一块生牛排' },
  { name: '牛肉末', stem: 'ground-beef', category: '肉蛋', desc: '一堆牛肉末' },
  { name: '羊肉', stem: 'lamb', category: '肉蛋', desc: '一块羊肉' },
  { name: '培根', stem: 'bacon', category: '肉蛋', desc: '几片培根' },
  { name: '香肠', stem: 'sausage', category: '肉蛋', desc: '一串香肠' },
  { name: '火腿', stem: 'ham', category: '肉蛋', desc: '一块火腿' },
  { name: '腊肠', stem: 'chinese-sausage', category: '肉蛋', desc: '红色腊肠' },
  { name: '鸭肉', stem: 'duck', category: '肉蛋', desc: '一块鸭肉' },

  // ── 肉蛋（蛋类）──
  { name: '鸭蛋', stem: 'duck-eggs', category: '肉蛋', desc: '青壳鸭蛋' },
  { name: '咸鸭蛋', stem: 'salted-duck-egg', category: '肉蛋', desc: '切开流油的咸鸭蛋' },
  { name: '皮蛋', stem: 'century-egg', category: '肉蛋', desc: '切开的黑色皮蛋' },
  { name: '鹌鹑蛋', stem: 'quail-eggs', category: '肉蛋', desc: '一把花壳鹌鹑蛋' },

  // ── 海鲜 ──
  { name: '带鱼', stem: 'beltfish', category: '海鲜', desc: '银色带鱼段' },
  { name: '鲈鱼', stem: 'seabass', category: '海鲜', desc: '一条鲈鱼' },
  { name: '黄鱼', stem: 'yellow-croaker', category: '海鲜', desc: '一条黄花鱼' },
  { name: '龙虾', stem: 'lobster', category: '海鲜', desc: '红色龙虾' },
  { name: '扇贝', stem: 'scallop', category: '海鲜', desc: '带壳扇贝' },
  { name: '生蚝', stem: 'oyster', category: '海鲜', desc: '带壳生蚝' },
  { name: '鱿鱼', stem: 'squid', category: '海鲜', desc: '一只白鱿鱼' },
  { name: '虾仁', stem: 'peeled-shrimp', category: '海鲜', desc: '一把粉色虾仁' },
  { name: '海带', stem: 'kelp', category: '海鲜', desc: '绿色海带结' },
  { name: '紫菜', stem: 'dried-seaweed', category: '海鲜', desc: '一片干紫菜' },
  { name: '鱼丸', stem: 'fish-balls', category: '海鲜', desc: '几颗白鱼丸' },

  // ── 乳制品 ──
  { name: '奶油', stem: 'cream', category: '乳制品', desc: '一团奶油' },
  { name: '淡奶油', stem: 'whipping-cream', category: '乳制品', desc: '一个纸盒装淡奶油，无标签无文字' },
  { name: '芝士片', stem: 'cheese-slices', category: '乳制品', desc: '几片黄色芝士片' },
  { name: '奶粉', stem: 'milk-powder', category: '乳制品', desc: '一个圆罐装奶粉，无标签无文字' },

  // ── 豆制品 ──
  { name: '豆干', stem: 'dried-tofu', category: '豆制品', desc: '几块豆腐干' },
  { name: '腐竹', stem: 'tofu-skin', category: '豆制品', desc: '一把干腐竹' },
  { name: '豆皮', stem: 'tofu-sheet', category: '豆制品', desc: '一卷豆皮' },
  { name: '豆腐泡', stem: 'fried-tofu-puff', category: '豆制品', desc: '几个金黄豆腐泡' },
  { name: '豆腐乳', stem: 'fermented-tofu', category: '豆制品', desc: '一块红色豆腐乳' },

  // ── 主食 ──
  { name: '挂面', stem: 'dried-noodles', category: '主食', desc: '一把挂面' },
  { name: '方便面', stem: 'instant-noodles', category: '主食', desc: '一块干方便面饼' },
  { name: '米粉', stem: 'rice-noodles', category: '主食', desc: '一把细米粉' },
  { name: '馒头', stem: 'steamed-bun', category: '主食', desc: '两个白馒头' },
  { name: '包子', stem: 'baozi', category: '主食', desc: '一个白包子' },
  { name: '吐司', stem: 'toast', category: '主食', desc: '几片方吐司' },
  { name: '年糕', stem: 'rice-cake', category: '主食', desc: '几条白年糕' },
  { name: '汤圆', stem: 'tangyuan', category: '主食', desc: '几颗白汤圆' },
  { name: '燕麦', stem: 'oats', category: '主食', desc: '一碗燕麦片' },
  { name: '小米', stem: 'millet', category: '主食', desc: '一捧黄小米' },
  { name: '糯米', stem: 'glutinous-rice', category: '主食', desc: '一捧白糯米' },
  { name: '红豆', stem: 'red-beans', category: '主食', desc: '一捧红豆' },
  { name: '绿豆', stem: 'mung-beans', category: '主食', desc: '一捧绿豆' },

  // ── 调料 ──
  { name: '醋', stem: 'vinegar', category: '调料', desc: '一个深色玻璃瓶装的醋，无标签无文字' },
  { name: '香醋', stem: 'black-vinegar', category: '调料', desc: '一个深色玻璃瓶装香醋，无标签无文字' },
  { name: '芝麻油', stem: 'sesame-oil', category: '调料', desc: '一个小玻璃瓶装琥珀色芝麻油，无标签无文字' },
  { name: '鸡精', stem: 'chicken-bouillon', category: '调料', desc: '一个小盒装鸡精，无标签无文字' },
  { name: '味精', stem: 'msg', category: '调料', desc: '一小袋白色味精，无标签无文字' },
  { name: '胡椒粉', stem: 'pepper-powder', category: '调料', desc: '一个小调料瓶装胡椒粉，无标签无文字' },
  { name: '辣椒粉', stem: 'chili-powder', category: '调料', desc: '一小堆红辣椒粉' },
  { name: '孜然', stem: 'cumin', category: '调料', desc: '一小堆孜然粒' },
  { name: '五香粉', stem: 'five-spice', category: '调料', desc: '一小堆五香粉' },
  { name: '辣椒酱', stem: 'chili-sauce', category: '调料', desc: '一个玻璃罐装红辣椒酱，无标签无文字' },
  { name: '老干妈', stem: 'laoganma', category: '调料', desc: '一个红色瓶盖的玻璃罐辣酱，无标签无文字' },
  { name: '甜面酱', stem: 'sweet-bean-sauce', category: '调料', desc: '一碟甜面酱' },
  { name: '黄豆酱', stem: 'soybean-paste', category: '调料', desc: '一个玻璃罐装黄豆酱，无标签无文字' },
  { name: '淀粉', stem: 'cornstarch', category: '调料', desc: '一捧白淀粉' },
  { name: '芝麻', stem: 'sesame', category: '调料', desc: '一小堆白芝麻' },
  { name: '干辣椒', stem: 'dried-chili', category: '调料', desc: '一把干红辣椒' },
  { name: '火锅底料', stem: 'hotpot-base', category: '调料', desc: '一块红色火锅底料' },

  // ── 干货 ──
  { name: '花生', stem: 'peanuts', category: '干货', desc: '一把带壳花生' },
  { name: '核桃', stem: 'walnuts', category: '干货', desc: '几个核桃' },
  { name: '杏仁', stem: 'almonds', category: '干货', desc: '一把杏仁' },
  { name: '腰果', stem: 'cashews', category: '干货', desc: '一把腰果' },
  { name: '瓜子', stem: 'sunflower-seeds', category: '干货', desc: '一把瓜子' },
  { name: '葡萄干', stem: 'raisins', category: '干货', desc: '一把葡萄干' },
  { name: '枸杞', stem: 'goji-berries', category: '干货', desc: '一把红枸杞' },
  { name: '银耳', stem: 'white-fungus', category: '干货', desc: '一朵干银耳' },
  { name: '干香菇', stem: 'dried-shiitake', category: '干货', desc: '几朵干香菇' },
  { name: '黄豆', stem: 'soybeans', category: '干货', desc: '一捧黄豆' },
  { name: '红枣', stem: 'red-dates', category: '干货', desc: '一把红枣' },

  // ── 速冻 ──
  { name: '馄饨', stem: 'wonton', category: '速冻', desc: '几个生馄饨' },
  { name: '火锅丸子', stem: 'hotpot-balls', category: '速冻', desc: '什锦火锅丸子' },
  { name: '冰淇淋', stem: 'ice-cream', category: '速冻', desc: '一个甜筒冰淇淋' },
  { name: '薯条', stem: 'french-fries', category: '速冻', desc: '一份金黄薯条' },

  // ── 方便食品 ──
  { name: '火腿肠', stem: 'ham-sausage', category: '方便食品', desc: '几根火腿肠' },
  { name: '午餐肉', stem: 'luncheon-meat', category: '方便食品', desc: '一个方形午餐肉罐头，无标签无文字' },
  { name: '鱼罐头', stem: 'canned-fish', category: '方便食品', desc: '一个圆形鱼罐头，无标签无文字' },
  { name: '八宝粥', stem: 'congee-can', category: '方便食品', desc: '一个圆罐装八宝粥，无标签无文字' },

  // ── 零食 ──
  { name: '饼干', stem: 'biscuits', category: '零食', desc: '几块饼干' },
  { name: '蛋糕', stem: 'cake', category: '零食', desc: '一块奶油小蛋糕' },
  { name: '糖果', stem: 'candy', category: '零食', desc: '几颗彩色糖果' },
  { name: '果冻', stem: 'jelly', category: '零食', desc: '彩色果冻杯' },
  { name: '爆米花', stem: 'popcorn', category: '零食', desc: '一桶爆米花' },
  { name: '海苔', stem: 'seaweed-snack', category: '零食', desc: '一片即食海苔' },
  { name: '辣条', stem: 'latiao', category: '零食', desc: '一包红色辣条，无标签无文字' },
  { name: '棒棒糖', stem: 'lollipop', category: '零食', desc: '一根彩色棒棒糖' },

  // ── 饮料（含茶咖）──
  { name: '雪碧', stem: 'sprite', category: '饮料', desc: '一个绿色塑料瓶装汽水，无标签无文字' },
  { name: '橙汁', stem: 'orange-juice', category: '饮料', desc: '一杯橙汁' },
  { name: '苹果汁', stem: 'apple-juice', category: '饮料', desc: '一个瓶装苹果汁，无标签无文字' },
  { name: '椰汁', stem: 'coconut-drink', category: '饮料', desc: '一个银色易拉罐装椰汁，无标签无文字' },
  { name: '苏打水', stem: 'soda-water', category: '饮料', desc: '一个透明瓶装苏打水，无标签无文字' },
  { name: '功能饮料', stem: 'energy-drink', category: '饮料', desc: '一个金色易拉罐功能饮料，无标签无文字' },
  { name: '乳酸菌', stem: 'yogurt-drink', category: '饮料', desc: '一个小塑料瓶装乳酸菌饮料，无标签无文字' },
  { name: '气泡水', stem: 'sparkling-water', category: '饮料', desc: '一个玻璃瓶装气泡水，无标签无文字' },
  { name: '茶叶', stem: 'tea-leaves', category: '饮料', desc: '一小堆绿茶叶' },
  { name: '红茶', stem: 'black-tea', category: '饮料', desc: '一小堆红茶叶' },
  { name: '茶包', stem: 'tea-bags', category: '饮料', desc: '几个茶包' },
  { name: '咖啡', stem: 'coffee', category: '饮料', desc: '一杯咖啡' },
  { name: '速溶咖啡', stem: 'instant-coffee', category: '饮料', desc: '几条独立包装的速溶咖啡，无标签无文字' },
  { name: '咖啡豆', stem: 'coffee-beans', category: '饮料', desc: '一把咖啡豆' },

  // ── 酒水 ──
  { name: '啤酒', stem: 'beer', category: '酒水', desc: '一个棕色玻璃瓶装啤酒，无标签无文字' },
  { name: '红酒', stem: 'red-wine', category: '酒水', desc: '一个深色玻璃红酒瓶，无标签无文字' },
  { name: '白酒', stem: 'baijiu', category: '酒水', desc: '一个白瓷瓶装白酒，无标签无文字' },
  { name: '黄酒', stem: 'rice-wine', category: '酒水', desc: '一个陶瓷瓶装黄酒，无标签无文字' },

  // ── 烘焙 ──
  { name: '酵母', stem: 'yeast', category: '烘焙', desc: '一小袋酵母粉，无标签无文字' },
  { name: '泡打粉', stem: 'baking-powder', category: '烘焙', desc: '一个小罐装泡打粉，无标签无文字' },
  { name: '可可粉', stem: 'cocoa-powder', category: '烘焙', desc: '一小堆可可粉' },
  { name: '糖粉', stem: 'powdered-sugar', category: '烘焙', desc: '一小堆糖粉' },
  { name: '吉利丁', stem: 'gelatin', category: '烘焙', desc: '几片吉利丁' },

  // ── 日用 ──
  { name: '湿巾', stem: 'wet-wipes', category: '日用', desc: '一包抽取式湿巾，无标签无文字' },
  { name: '餐巾纸', stem: 'napkins', category: '日用', desc: '一叠餐巾纸' },
  { name: '洗衣液', stem: 'laundry-detergent', category: '日用', desc: '一个塑料瓶装洗衣液，无标签无文字' },
  { name: '洗衣粉', stem: 'laundry-powder', category: '日用', desc: '一袋洗衣粉，无标签无文字' },
  { name: '消毒液', stem: 'disinfectant', category: '日用', desc: '一个塑料瓶装蓝色消毒液，无标签无文字' },
  { name: '洁厕灵', stem: 'toilet-cleaner', category: '日用', desc: '一个弯颈塑料瓶装洁厕液，无标签无文字' },
  { name: '柔顺剂', stem: 'fabric-softener', category: '日用', desc: '一个塑料瓶装衣物柔顺剂，无标签无文字' },
  { name: '抹布', stem: 'cleaning-cloth', category: '日用', desc: '一块抹布' },
  { name: '百洁布', stem: 'scrub-sponge', category: '日用', desc: '一块黄绿百洁布' },
  { name: '拖把', stem: 'mop', category: '日用', desc: '一把拖把' },
  { name: '扫把', stem: 'broom', category: '日用', desc: '一把扫把' },
  { name: '锡纸', stem: 'aluminum-foil', category: '日用', desc: '一卷锡纸' },
  { name: '保鲜袋', stem: 'food-bags', category: '日用', desc: '一盒保鲜袋，无标签无文字' },
  { name: '一次性手套', stem: 'disposable-gloves', category: '日用', desc: '一盒一次性手套，无标签无文字' },
  { name: '牙签', stem: 'toothpicks', category: '日用', desc: '一小盒牙签，无标签无文字' },
  { name: '密封袋', stem: 'ziplock-bags', category: '日用', desc: '几个密封袋' },
  { name: '电池', stem: 'batteries', category: '日用', desc: '几节圆柱形电池，无标签无文字' },
  { name: '垃圾桶', stem: 'trash-can', category: '日用', desc: '一个垃圾桶' },

  // ── 个护 ──
  { name: '香皂', stem: 'soap-bar', category: '个护', desc: '一块香皂' },
  { name: '洗面奶', stem: 'face-wash', category: '个护', desc: '一支软管装洗面奶，无标签无文字' },
  { name: '面霜', stem: 'face-cream', category: '个护', desc: '一个圆罐装面霜，无标签无文字' },
  { name: '身体乳', stem: 'body-lotion', category: '个护', desc: '一个按压瓶装身体乳，无标签无文字' },
  { name: '护手霜', stem: 'hand-cream', category: '个护', desc: '一支软管装护手霜，无标签无文字' },
  { name: '防晒霜', stem: 'sunscreen', category: '个护', desc: '一支软管装防晒霜，无标签无文字' },
  { name: '剃须刀', stem: 'razor', category: '个护', desc: '一把剃须刀' },
  { name: '棉签', stem: 'cotton-swabs', category: '个护', desc: '一盒棉签，无标签无文字' },
  { name: '化妆棉', stem: 'cotton-pads', category: '个护', desc: '一叠化妆棉' },
  { name: '卫生巾', stem: 'sanitary-pads', category: '个护', desc: '一包卫生巾，无标签无文字' },
  { name: '漱口水', stem: 'mouthwash', category: '个护', desc: '一个塑料瓶装漱口水，无标签无文字' },
  { name: '牙线', stem: 'dental-floss', category: '个护', desc: '一小盒牙线，无标签无文字' },
  { name: '梳子', stem: 'comb', category: '个护', desc: '一把梳子' },
];
