(function () {
  const META = {
    人: { radical: "人", strokes: 2, structure: "单一结构", variant: "" },
    口: { radical: "口", strokes: 3, structure: "单一结构", variant: "" },
    山: { radical: "山", strokes: 3, structure: "单一结构", variant: "" },
    水: { radical: "水", strokes: 4, structure: "单一结构", variant: "" },
    日: { radical: "日", strokes: 4, structure: "单一结构", variant: "" },
    月: { radical: "月", strokes: 4, structure: "单一结构", variant: "" },
    木: { radical: "木", strokes: 4, structure: "单一结构", variant: "" },
    火: { radical: "火", strokes: 4, structure: "单一结构", variant: "" },
    学: { radical: "子", strokes: 8, structure: "上下结构", variant: "學" },
    友: { radical: "又", strokes: 4, structure: "半包围结构", variant: "" },
    家: { radical: "宀", strokes: 10, structure: "上下结构", variant: "" },
    书: { radical: "乛", strokes: 4, structure: "单一结构", variant: "書" },
    春: { radical: "日", strokes: 9, structure: "上下结构", variant: "" },
    风: { radical: "风", strokes: 4, structure: "半包围结构", variant: "風" },
    明: { radical: "日", strokes: 8, structure: "左右结构", variant: "", synonyms: ["亮"], antonyms: ["暗"] },
    德: { radical: "彳", strokes: 15, structure: "左右结构", variant: "" },
    信: { radical: "亻", strokes: 9, structure: "左右结构", variant: "" },
    志: { radical: "心", strokes: 7, structure: "上下结构", variant: "" },
    勤: { radical: "力", strokes: 13, structure: "左右结构", variant: "" },
    诚: { radical: "讠", strokes: 8, structure: "左右结构", variant: "誠", antonyms: ["伪"] },
    和: { radical: "口", strokes: 8, structure: "左右结构", variant: "" },
    智: { radical: "日", strokes: 12, structure: "上下结构", variant: "" },
    礼: { radical: "礻", strokes: 5, structure: "左右结构", variant: "禮" },
    思: { radical: "心", strokes: 9, structure: "上下结构", variant: "" },
    行: { radical: "行", strokes: 6, structure: "左右结构", variant: "" },
    远: { radical: "辶", strokes: 7, structure: "半包围结构", variant: "遠", antonyms: ["近"] },
    新: { radical: "斤", strokes: 13, structure: "左右结构", variant: "", antonyms: ["旧"] },
  };

  const PRONUNCIATION_META = {
    行: [
      {
        pinyin: "xíng",
        tag: "常用（动词）",
        meanings: ["走；做；可以。", "行为、实行。"],
        words: [
          { word: "行动", meaning: "做事的行为。" },
          { word: "可行", meaning: "可以实施。" },
          { word: "旅行", meaning: "到外地游历。" },
        ],
        idioms: [
          {
            name: "身体力行",
            meaning: "亲身去做，努力实践。",
            story:
              "很多先贤主张“知行合一”，不仅懂道理，更要亲自实践，故有“身体力行”。",
          },
        ],
      },
      {
        pinyin: "háng",
        tag: "行业/行列",
        meanings: ["行列，排成的队伍。", "行业，职业类别。"],
        words: [
          { word: "银行", meaning: "办理存取款、结算等金融业务的机构。" },
          { word: "行业", meaning: "职业或工作门类。" },
          { word: "一行", meaning: "一排，一列。" },
        ],
        idioms: [
          {
            name: "隔行如隔山",
            meaning: "不同行业之间差异很大，外行很难精通。",
            story:
              "民间常说“隔行如隔山”，强调专业训练和长期积累的重要性。",
          },
        ],
      },
    ],
    和: [
      {
        pinyin: "hé",
        tag: "常用（和谐）",
        meanings: ["和谐；温和；不冲突。", "与、同。"],
        words: [
          { word: "和平", meaning: "没有战争和冲突。" },
          { word: "和气", meaning: "态度温和可亲。" },
          { word: "和谐", meaning: "协调而平衡。" },
        ],
        idioms: [
          {
            name: "和衷共济",
            meaning: "同心协力，克服困难。",
            story:
              "古人强调集体合作，“和衷共济”本意是同心渡河，后来比喻团结协作。",
          },
        ],
      },
      {
        pinyin: "hè",
        tag: "应和/和诗",
        meanings: ["声音相应，跟着唱。", "依照别人的诗词题材和韵脚作诗。"],
        words: [
          { word: "应和", meaning: "随着别人发声而附和。" },
          { word: "和诗", meaning: "按原诗韵脚作诗相答。" },
          { word: "唱和", meaning: "一唱一和，互相应答。" },
        ],
      },
      {
        pinyin: "huó",
        tag: "和面",
        meanings: ["在粉状物中加液体并搅拌使其均匀。"],
        words: [
          { word: "和面", meaning: "在面粉中加水并揉匀。" },
          { word: "和泥", meaning: "加水搅拌泥土，使其适于使用。" },
        ],
      },
      {
        pinyin: "huò",
        tag: "粉末混合",
        meanings: ["把粉状或颗粒状的东西掺和在一起。"],
        words: [
          { word: "和药", meaning: "把药粉与液体混合。" },
          { word: "和匀", meaning: "搅拌均匀。" },
        ],
      },
    ],
  };

  function createExamples(item) {
    const words = (item.words || []).slice(0, 2);
    const lines = words.map((entry) => `例：${entry.word}。${entry.meaning}`);
    if (!lines.length) {
      lines.push(`例：学习“${item.char}”字时，可结合字义和词组记忆。`);
    }
    return lines;
  }

  function createPronunciationExamples(char, pronunciation) {
    const words = (pronunciation?.words || []).slice(0, 2);
    const lines = words.map((entry) => `例：${entry.word}。${entry.meaning}`);
    if (!lines.length) {
      lines.push(`例：多音字“${char}”在“${pronunciation?.pinyin || ""}”读音下有特定语义。`);
    }
    return lines;
  }

  function normalizePronunciations(char, item) {
    const list = PRONUNCIATION_META[char];
    if (!Array.isArray(list) || !list.length) {
      return [];
    }
    return list.map((row, index) => {
      const pinyin = row?.pinyin || (index === 0 ? item.pinyin || "" : "");
      const meanings = Array.isArray(row?.meanings) && row.meanings.length ? row.meanings : [item.meaning].filter(Boolean);
      const words = Array.isArray(row?.words) ? row.words : [];
      const idioms = Array.isArray(row?.idioms) ? row.idioms : [];
      return {
        pinyin,
        tag: row?.tag || "",
        meanings,
        words,
        idioms,
        examples: createPronunciationExamples(char, { pinyin, words }),
      };
    });
  }

  window.XINHUA_DICTIONARY = (window.HANZI_LIBRARY || []).map((item) => {
    const meta = META[item.char] || {};
    const pronunciations = normalizePronunciations(item.char, item);
    const firstPron = pronunciations[0] || null;
    return {
      char: item.char,
      pinyin: firstPron?.pinyin || item.pinyin || "",
      radical: meta.radical || "未标注",
      strokes: Number.isFinite(meta.strokes) ? meta.strokes : null,
      structure: meta.structure || "常见结构",
      variant: meta.variant || "",
      levels: item.levels || [],
      ages: item.ages || [],
      meanings: firstPron?.meanings || [item.meaning].filter(Boolean),
      words: firstPron?.words || item.words || [],
      idioms: firstPron?.idioms || item.idioms || [],
      synonyms: meta.synonyms || [],
      antonyms: meta.antonyms || [],
      examples: firstPron?.examples || createExamples(item),
      pronunciations,
      pictograph: item.pictograph || null,
    };
  });
})();
