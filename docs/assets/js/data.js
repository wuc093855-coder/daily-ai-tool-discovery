import { APP, CATEGORY_ALIASES, SOURCE_LABELS } from "./config.js";
import { readStorage, writeStorage } from "./storage.js";

let dataPromise;

function slugify(value = "") {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanOrNull(value) {
  return typeof value === "boolean" ? value : null;
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeCategory(category = "综合工具") {
  return CATEGORY_ALIASES[category] || category;
}

function normalizeTool(raw, day) {
  const sourceKey = raw.source_key || Object.entries(SOURCE_LABELS)
    .find(([, label]) => label === raw.source)?.[0] || "unknown";
  const originalName = raw.original_name || raw.name || "Unnamed";
  const displayName = raw.display_name || originalName.split("/").at(-1);
  const sourceUrl = raw.source_url || raw.url || raw.official_url || raw.repo_url || null;
  const id = raw.id || `${sourceKey}-${slugify(originalName)}`;
  const metrics = raw.metrics || {};
  const category = normalizeCategory(raw.category);
  const scoreTotal = numberOrNull(raw.score_total ?? raw.attention_score);

  return {
    id,
    slug: raw.slug || slugify(displayName),
    name: displayName,
    original_name: originalName,
    tagline_zh: raw.tagline_zh || raw.one_liner || "",
    description_zh: raw.description_zh || raw.one_liner || "",
    original_description: raw.original_description || null,
    source: raw.source || SOURCE_LABELS[sourceKey] || sourceKey,
    source_key: sourceKey,
    source_url: sourceUrl,
    official_url: raw.official_url || sourceUrl,
    repo_url: raw.repo_url || (sourceKey === "github" ? sourceUrl : null),
    logo_url: raw.logo_url || null,
    category,
    tags: [...new Set([category, ...arrayOrEmpty(raw.tags)])],
    pricing_type: raw.pricing_type || (raw.is_open_source ? "open_source" : null),
    is_free: booleanOrNull(raw.is_free),
    is_open_source: booleanOrNull(raw.is_open_source),
    license: raw.license || null,
    stars: numberOrNull(raw.stars ?? metrics.stars),
    star_growth: numberOrNull(raw.star_growth ?? metrics.stars_today),
    likes: numberOrNull(raw.likes ?? metrics.likes),
    trending_score: numberOrNull(raw.trending_score ?? metrics.trending_score),
    published_at: raw.published_at || null,
    discovered_at: raw.discovered_at || day?.date || null,
    updated_at: raw.updated_at || day?.updated_at || null,
    suitable_for: raw.suitable_for || raw.best_for || "",
    core_features: arrayOrEmpty(raw.core_features || raw.main_features),
    use_cases: arrayOrEmpty(raw.use_cases),
    pros: arrayOrEmpty(raw.pros),
    limitations: arrayOrEmpty(raw.limitations),
    business_potential: raw.business_potential || raw.side_hustle || "",
    monetization_ideas: arrayOrEmpty(raw.monetization_ideas),
    score_total: scoreTotal,
    score_heat: numberOrNull(raw.score_heat),
    score_freshness: numberOrNull(raw.score_freshness),
    score_usefulness: numberOrNull(raw.score_usefulness),
    score_product: numberOrNull(raw.score_product),
    score_business: numberOrNull(raw.score_business),
    score_history: arrayOrEmpty(raw.score_history),
    rank: numberOrNull(raw.rank),
    carried_forward: Boolean(raw.carried_forward),
  };
}

function validateData(data) {
  if (!data || typeof data !== "object") throw new Error("数据不是有效对象");
  if (!Array.isArray(data.days)) throw new Error("数据缺少 days 数组");
  data.days.forEach((day, index) => {
    if (!day?.date || !Array.isArray(day.tools)) {
      throw new Error(`第 ${index + 1} 天的数据结构无效`);
    }
  });
}

export function normalizeData(raw, fromCache = false) {
  validateData(raw);
  const days = raw.days.map((day) => ({
    ...day,
    tools: day.tools.map((tool) => normalizeTool(tool, day)),
  }));
  return {
    ...raw,
    schema_version: raw.schema_version || 1,
    days,
    meta: {
      fromCache,
      loadedAt: new Date().toISOString(),
    },
  };
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), APP.fetchTimeout);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadData({ force = false } = {}) {
  if (dataPromise && !force) return dataPromise;
  dataPromise = (async () => {
    const url = new URL(APP.dataPath, document.baseURI);
    url.searchParams.set("v", String(Math.floor(Date.now() / 300000)));
    try {
      const raw = await fetchWithTimeout(url);
      const data = normalizeData(raw);
      writeStorage("data-cache", raw);
      return data;
    } catch (error) {
      console.error("[data] 远程数据加载失败", error);
      const cached = readStorage("data-cache");
      if (cached) {
        console.warn("[data] 使用最近一次成功缓存");
        return normalizeData(cached, true);
      }
      dataPromise = undefined;
      throw new Error(error.name === "AbortError" ? "数据请求超时" : `数据加载失败：${error.message}`);
    }
  })();
  return dataPromise;
}

export function getLatestDay(data) {
  return data.days[0] || null;
}

export function getCatalog(data) {
  const map = new Map();
  [...data.days].reverse().forEach((day) => {
    day.tools.forEach((tool) => {
      const key = tool.repo_url || tool.official_url || tool.source_url || tool.id;
      const previous = map.get(key);
      map.set(key, {
        ...(previous || {}),
        ...tool,
        first_discovered_at: previous?.first_discovered_at || tool.discovered_at || day.date,
        last_discovered_at: day.date,
      });
    });
  });
  return [...map.values()];
}

export function getStats(data) {
  const catalog = getCatalog(data);
  const latest = getLatestDay(data);
  const sourceStatus = latest?.source_status || {};
  const scanned = Object.values(sourceStatus).reduce(
    (sum, source) => sum + (Number(source?.candidates) || 0),
    0,
  );
  return {
    todayCount: latest?.tools.length || 0,
    totalTools: catalog.length,
    updateDays: data.days.length,
    sourceCount: Object.values(sourceStatus).filter((source) => source?.ok).length
      || new Set(catalog.map((tool) => tool.source_key)).size,
    scanned,
    highestScore: Math.max(0, ...(latest?.tools.map((tool) => tool.score_total || 0) || [])),
  };
}

export function formatNumber(value) {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat("zh-CN", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(value, options = {}) {
  if (!value) return "";
  const date = new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: APP.timezone,
    year: options.short ? undefined : "numeric",
    month: "long",
    day: "numeric",
    ...options,
  }).format(date);
}

export function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: APP.timezone,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
