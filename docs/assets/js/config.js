export const APP = Object.freeze({
  name: "Daily AI Tools",
  subtitle: "每日 AI 工具发现",
  repository: "https://github.com/wuc093855-coder/daily-ai-tool-discovery",
  siteUrl: "https://wuc093855-coder.github.io/daily-ai-tool-discovery/",
  dataPath: "data/daily.json",
  timezone: "Asia/Shanghai",
  fetchTimeout: 8000,
  storagePrefix: "daily-ai-tools:",
});

export const CATEGORY_ORDER = [
  "AI Agent",
  "编程开发",
  "图像生成",
  "视频生成",
  "音频工具",
  "写作办公",
  "数据分析",
  "搜索研究",
  "自动化",
  "开源模型",
  "本地工具",
  "商业与营销",
];

export const CATEGORY_ALIASES = {
  智能体: "AI Agent",
  图像设计: "图像生成",
  视频创作: "视频生成",
  音频语音: "音频工具",
  效率办公: "写作办公",
  搜索知识: "搜索研究",
  模型与推理: "开源模型",
  综合工具: "自动化",
};

export const SOURCE_LABELS = {
  github: "GitHub",
  producthunt: "Product Hunt",
  huggingface: "Hugging Face",
};

export const SCORE_WEIGHTS = Object.freeze({
  usefulness: 30,
  heat: 25,
  freshness: 20,
  product: 15,
  business: 10,
});
