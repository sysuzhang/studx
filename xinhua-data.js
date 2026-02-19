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

  function createExamples(item) {
    const words = (item.words || []).slice(0, 2);
    const lines = words.map((entry) => `例：${entry.word}。${entry.meaning}`);
    if (!lines.length) {
      lines.push(`例：学习“${item.char}”字时，可结合字义和词组记忆。`);
    }
    return lines;
  }

  window.XINHUA_DICTIONARY = (window.HANZI_LIBRARY || []).map((item) => {
    const meta = META[item.char] || {};
    return {
      char: item.char,
      pinyin: item.pinyin || "",
      radical: meta.radical || "未标注",
      strokes: Number.isFinite(meta.strokes) ? meta.strokes : null,
      structure: meta.structure || "常见结构",
      variant: meta.variant || "",
      levels: item.levels || [],
      ages: item.ages || [],
      meanings: [item.meaning].filter(Boolean),
      words: item.words || [],
      idioms: item.idioms || [],
      synonyms: meta.synonyms || [],
      antonyms: meta.antonyms || [],
      examples: createExamples(item),
      pictograph: item.pictograph || null,
    };
  });
})();
