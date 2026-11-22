/*
 * aliases.js — 星铁别称 → 正式名解析
 * 纯数据 + 纯函数，无依赖。浏览器挂 window.AliasResolver，Node 挂 module.exports（便于测试）。
 * 数据来源见 docs/别名对照表.md，基准 2026-11-21 / 4.7。
 */

(function (root) {
  "use strict";

  // ---------- 角色：alias(小写归一) → { name, path, element, note } ----------
  var CHARACTERS = {
    // 本次指定
    "银狼lv999": { name: "银狼LV.999", path: "欢愉", element: "虚数", note: "狼尊" },
    "狼尊": { name: "银狼LV.999", path: "欢愉", element: "虚数", note: "狼尊" },
    "狼狼": { name: "银狼LV.999", path: "欢愉", element: "虚数" },
    "银狼999": { name: "银狼LV.999", path: "欢愉", element: "虚数" },
    "爻光": { name: "爻光", path: "欢愉", element: "物理", note: "爻老板" },
    "爻老板": { name: "爻光", path: "欢愉", element: "物理" },
    "真珠": { name: "真珠", path: "欢愉", element: "冰", note: "防御型" },
    "珍珠": { name: "真珠", path: "欢愉", element: "冰" },
    "欢愉主": { name: "开拓者·欢愉", path: "欢愉", element: "雷" },
    "开拓者欢愉": { name: "开拓者·欢愉", path: "欢愉", element: "雷" },
    "遐蝶": { name: "遐蝶", path: "记忆", element: "量子" },
    "castorice": { name: "遐蝶", path: "记忆", element: "量子" },
    "长夜月": { name: "长夜月", path: "记忆", element: "冰", note: "黑三月" },
    "黑三月": { name: "长夜月", path: "记忆", element: "冰" },
    "evernight": { name: "长夜月", path: "记忆", element: "冰" },
    "知更鸟晴歌": { name: "知更鸟·晴歌", path: "记忆", element: "风" },
    "晴歌": { name: "知更鸟·晴歌", path: "记忆", element: "风" },
    "水鸟": { name: "知更鸟·晴歌", path: "记忆", element: "风" },
    "鸡翅膀女孩": { name: "知更鸟·晴歌", path: "记忆", element: "风" },
    "summeretto": { name: "知更鸟·晴歌", path: "记忆", element: "风" },
    "风堇": { name: "风堇", path: "记忆", element: "风" },
    "马头": { name: "风堇", path: "记忆", element: "风" },
    "hyacine": { name: "风堇", path: "记忆", element: "风" },
    "红a": { name: "Archer", path: "巡猎", element: "量子", note: "Fate联动" },
    "archer": { name: "Archer", path: "巡猎", element: "量子" },
    "远坂凛": { name: "远坂凛", path: "智识", element: "量子", note: "Fate联动" },
    "rin": { name: "远坂凛", path: "智识", element: "量子" },
    "凛": { name: "远坂凛", path: "智识", element: "量子" },
    "花火": { name: "花火", path: "同谐", element: "量子", note: "雌小鬼" },
    "雌小鬼": { name: "花火", path: "同谐", element: "量子" },
    "sparkle": { name: "花火", path: "同谐", element: "量子" },
    "丹恒螣荒": { name: "丹恒·腾荒", path: "存护", element: "物理", note: "纠错：正式名为腾荒" },
    "丹恒腾荒": { name: "丹恒·腾荒", path: "存护", element: "物理" },
    "盾丹": { name: "丹恒·腾荒", path: "存护", element: "物理" },
    "知更鸟": { name: "知更鸟", path: "同谐", element: "物理", note: "本体，非晴歌" },
    "鸟": { name: "知更鸟", path: "同谐", element: "物理" },
    "robin": { name: "知更鸟", path: "同谐", element: "物理" },
    "缇宝": { name: "缇宝", path: "同谐", element: "量子" },
    "提宝": { name: "缇宝", path: "同谐", element: "量子" },
    "tribbie": { name: "缇宝", path: "同谐", element: "量子" },

    // 萌娘百科通行别称
    "爷": { name: "开拓者", path: null, element: null },
    "物主": { name: "开拓者·毁灭", path: "毁灭", element: "物理" },
    "火主": { name: "开拓者·存护", path: "存护", element: "火" },
    "同谐主": { name: "开拓者·同谐", path: "同谐", element: "虚数" },
    "记忆主": { name: "开拓者·记忆", path: "记忆", element: "冰" },
    "盾三月": { name: "三月七·存护", path: "存护", element: "冰" },
    "剑三月": { name: "三月七·巡猎", path: "巡猎", element: "虚数" },
    "老杨": { name: "瓦尔特", path: "虚无", element: "虚数" },
    "卡妈": { name: "卡芙卡", path: "虚无", element: "雷" },
    "妈": { name: "卡芙卡", path: "虚无", element: "雷" },
    "点刀哥": { name: "刃", path: "毁灭", element: "风" },
    "杰哥": { name: "杰帕德", path: "存护", element: "冰" },
    "板鸭": { name: "布洛妮娅", path: "同谐", element: "风" },
    "大鸭鸭": { name: "布洛妮娅", path: "同谐", element: "风" },
    "景元元": { name: "景元", path: "智识", element: "雷" },
    "type c": { name: "符玄", path: "存护", element: "量子" },
    "青总": { name: "青雀", path: "智识", element: "量子" },
    "雀神": { name: "青雀", path: "智识", element: "量子" },
    "龙丹": { name: "丹恒·饮月", path: "毁灭", element: "虚数" },
    "小桂子": { name: "桂乃芬", path: "虚无", element: "火" },
    "大停云": { name: "忘归人", path: "虚无", element: "火" },
    "王贵人": { name: "忘归人", path: "虚无", element: "火" },
    "义父": { name: "真理医生", path: "巡猎", element: "虚数" },
    "bto": { name: "波提欧", path: "巡猎", element: "物理" },
    "周天哥": { name: "星期日", path: "同谐", element: "虚数" },
    "阿雅": { name: "阿格莱雅", path: "记忆", element: "雷" },
    "agly": { name: "阿格莱雅", path: "记忆", element: "雷" },
    "刻律": { name: "刻律德菈", path: "同谐", element: "风" },
    "女皇": { name: "刻律德菈", path: "同谐", element: "风" },
    "火花": { name: "火花", path: "欢愉", element: "火", note: "火花花" },
    "火花花": { name: "火花", path: "欢愉", element: "火" },
    "虚照": { name: "星神★阿哈", path: "欢愉", element: "量子" },
    "虚虚": { name: "星神★阿哈", path: "欢愉", element: "量子" },
    "呆毛王": { name: "Saber", path: "毁灭", element: "风" },
    "金闪闪": { name: "吉尔伽美什", path: "毁灭", element: "雷" },
    "鲨鱼": { name: "艾莲", path: null, element: "冰" }
  };

  // 正式名也作为 key（便于反查 path/element）
  [
    ["银狼LV.999", "欢愉", "虚数"], ["爻光", "欢愉", "物理"], ["真珠", "欢愉", "冰"],
    ["开拓者·欢愉", "欢愉", "雷"], ["遐蝶", "记忆", "量子"], ["长夜月", "记忆", "冰"],
    ["知更鸟·晴歌", "记忆", "风"], ["风堇", "记忆", "风"], ["Archer", "巡猎", "量子"],
    ["远坂凛", "智识", "量子"], ["花火", "同谐", "量子"], ["丹恒·腾荒", "存护", "物理"],
    ["知更鸟", "同谐", "物理"], ["缇宝", "同谐", "量子"]
  ].forEach(function (r) {
    var k = norm(r[0]);
    if (!CHARACTERS[k]) CHARACTERS[k] = { name: r[0], path: r[1], element: r[2] };
  });

  // ---------- 光锥 ----------
  var LIGHT_CONES = {
    "555": { name: "舞！舞！舞！", path: "同谐", rarity: 4 },
    "舞舞舞": { name: "舞！舞！舞！", path: "同谐", rarity: 4 },
    "狼专": { name: "欢迎来到银河城", path: "欢愉", rarity: 5, note: "银狼LV.999专武" },
    "欢迎来到银河城": { name: "欢迎来到银河城", path: "欢愉", rarity: 5 },
    "咕咕嘎嘎": { name: "菇菇嘎嘎历险记", path: "欢愉", rarity: 4 },
    "菇菇嘎嘎": { name: "菇菇嘎嘎历险记", path: "欢愉", rarity: 4 },
    "菇菇嘎嘎历险记": { name: "菇菇嘎嘎历险记", path: "欢愉", rarity: 4 }
  };

  // ---------- 遗器 ----------
  var RELICS = {
    "风套": { name: "晨昏交界的翔鹰", slot: "外圈" },
    "晨昏交界的翔鹰": { name: "晨昏交界的翔鹰", slot: "外圈" },
    "魔法少女": { name: "闪耀功勋的魔法少女", slot: "外圈" },
    "功勋闪耀的魔法少女": { name: "闪耀功勋的魔法少女", slot: "外圈" },
    "闪耀功勋的魔法少女": { name: "闪耀功勋的魔法少女", slot: "外圈" },
    "卜者": { name: "应天涉远的卜者", slot: "外圈" },
    "应天涉远的卜者": { name: "应天涉远的卜者", slot: "外圈" },
    "伶人": { name: "戏梦点星的伶人", slot: "外圈" },
    "戏梦点星的伶人": { name: "戏梦点星的伶人", slot: "外圈" },
    "翁瓦克": { name: "生命的翁瓦克", slot: "内圈" },
    "生命的翁瓦克": { name: "生命的翁瓦克", slot: "内圈" },
    "朋克洛德": { name: "零号关卡朋克洛德", slot: "内圈" },
    "零号关卡朋克洛德": { name: "零号关卡朋克洛德", slot: "内圈" }
  };

  var TABLES = { character: CHARACTERS, lightCone: LIGHT_CONES, relic: RELICS };

  // 归一化：去空格、间隔号、连字符、全角标点（！？，。），转小写
  function norm(s) {
    return String(s == null ? "" : s)
      .replace(/[\s·•・．.\-_！？，。、]/g, "")
      .toLowerCase();
  }

  function buildIndex(table) {
    var idx = {};
    Object.keys(table).forEach(function (k) { idx[norm(k)] = table[k]; });
    return idx;
  }
  var INDEX = {};
  Object.keys(TABLES).forEach(function (t) { INDEX[t] = buildIndex(TABLES[t]); });

  /**
   * 解析名称。type: 'character' | 'lightCone' | 'relic' | 'auto'
   * 返回 { hit, name, type, data } 或 { hit:false, type, input }
   */
  function resolve(input, type) {
    type = type || "auto";
    var key = norm(input);
    var types = type === "auto" ? Object.keys(INDEX) : [type];
    for (var i = 0; i < types.length; i++) {
      var hit = INDEX[types[i]][key];
      if (hit) return { hit: true, name: hit.name, type: types[i], data: hit };
    }
    return { hit: false, type: type, input: input };
  }

  /** 批量解析；返回 [{input, hit, name, type}] */
  function resolveAll(arr, type) {
    return (arr || []).map(function (x) {
      var r = resolve(x, type);
      return { input: x, hit: r.hit, name: r.name || null, type: r.type };
    });
  }

  var API = {
    resolve: resolve,
    resolveAll: resolveAll,
    norm: norm,
    tables: TABLES,
    version: "2026-11-21 / 4.7"
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (root) root.AliasResolver = API;
})(typeof window !== "undefined" ? window : null);
