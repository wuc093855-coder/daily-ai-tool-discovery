const DEFAULTS = Object.freeze({
  query: "",
  category: "all",
  source: "all",
  openSource: "all",
  pricing: "all",
  date: "all",
  minScore: 0,
  sort: "heat",
});

function includesText(tool, query) {
  if (!query) return true;
  const needle = query.toLocaleLowerCase("zh-CN").trim();
  const haystack = [
    tool.name,
    tool.original_name,
    tool.tagline_zh,
    tool.description_zh,
    tool.category,
    ...(tool.tags || []),
    ...(tool.core_features || []),
  ].join(" ").toLocaleLowerCase("zh-CN");
  return haystack.includes(needle);
}

function matchesDate(tool, dateFilter, latestDate) {
  if (dateFilter === "all") return true;
  const value = new Date(`${tool.last_discovered_at || tool.discovered_at}T00:00:00+08:00`);
  const latest = new Date(`${latestDate}T00:00:00+08:00`);
  const days = Math.round((latest - value) / 86400000);
  if (dateFilter === "today") return days === 0;
  if (dateFilter === "week") return days <= 7;
  if (dateFilter === "month") return days <= 30;
  return true;
}

function heatValue(tool) {
  return tool.score_heat ?? tool.trending_score ?? tool.star_growth ?? tool.likes ?? tool.score_total ?? 0;
}

export function normalizeFilters(value = {}) {
  return { ...DEFAULTS, ...value, minScore: Number(value.minScore || 0) };
}

export function filterAndSortTools(tools, value = {}, latestDate = "") {
  const filters = normalizeFilters(value);
  const filtered = tools.filter((tool) => {
    if (!includesText(tool, filters.query)) return false;
    if (filters.category !== "all" && tool.category !== filters.category) return false;
    if (filters.source !== "all" && tool.source_key !== filters.source) return false;
    if (filters.openSource === "yes" && tool.is_open_source !== true) return false;
    if (filters.openSource === "no" && tool.is_open_source !== false) return false;
    if (filters.pricing === "free" && tool.is_free !== true) return false;
    if (filters.pricing === "paid" && tool.pricing_type !== "paid") return false;
    if (filters.pricing === "open_source" && tool.is_open_source !== true) return false;
    if ((tool.score_total || 0) < filters.minScore) return false;
    return matchesDate(tool, filters.date, latestDate);
  });

  const sorters = {
    heat: (a, b) => heatValue(b) - heatValue(a),
    latest: (a, b) => String(b.last_discovered_at || "").localeCompare(String(a.last_discovered_at || "")),
    stars: (a, b) => (b.stars ?? -1) - (a.stars ?? -1),
    recommendation: (a, b) => (b.score_total ?? 0) - (a.score_total ?? 0),
  };
  return filtered.sort(sorters[filters.sort] || sorters.heat);
}

export function activeFilterEntries(value = {}) {
  const filters = normalizeFilters(value);
  return Object.entries(filters).filter(([key, val]) => (
    !["sort", "query"].includes(key)
    && val !== DEFAULTS[key]
    && val !== ""
  ));
}
