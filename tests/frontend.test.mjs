import assert from "node:assert/strict";
import test from "node:test";

import { getCatalog, normalizeData } from "../docs/assets/js/data.js";
import { filterAndSortTools, normalizeFilters } from "../docs/assets/js/filters.js";

const tools = [
  {
    id: "github-codepilot",
    name: "CodePilot",
    original_name: "example/CodePilot",
    tagline_zh: "面向开发者的 AI 编程助手",
    description_zh: "帮助开发者生成与审查代码",
    category: "编程开发",
    tags: ["API", "Agent"],
    source_key: "github",
    is_open_source: true,
    is_free: null,
    pricing_type: "open_source",
    score_total: 91,
    score_heat: 88,
    stars: 5000,
    discovered_at: "2026-07-27",
    last_discovered_at: "2026-07-27",
  },
  {
    id: "producthunt-writer",
    name: "Writer Pro",
    original_name: "Writer Pro",
    tagline_zh: "中文写作办公助手",
    description_zh: "用于内容创作与办公",
    category: "写作办公",
    tags: ["写作"],
    source_key: "producthunt",
    is_open_source: false,
    is_free: true,
    pricing_type: "freemium",
    score_total: 78,
    score_heat: 60,
    stars: null,
    discovered_at: "2026-07-20",
    last_discovered_at: "2026-07-20",
  },
];

test("search supports English and Chinese content", () => {
  assert.equal(filterAndSortTools(tools, { query: "codepilot" }, "2026-07-27").length, 1);
  assert.equal(filterAndSortTools(tools, { query: "写作" }, "2026-07-27")[0].id, "producthunt-writer");
});

test("combined filters and score range work", () => {
  const result = filterAndSortTools(tools, {
    category: "编程开发",
    source: "github",
    openSource: "yes",
    minScore: 85,
  }, "2026-07-27");
  assert.deepEqual(result.map((tool) => tool.id), ["github-codepilot"]);
});

test("sorting supports stars, latest and recommendation", () => {
  assert.equal(filterAndSortTools(tools, { sort: "stars" }, "2026-07-27")[0].id, "github-codepilot");
  assert.equal(filterAndSortTools(tools, { sort: "latest" }, "2026-07-27")[0].id, "github-codepilot");
  assert.equal(filterAndSortTools(tools, { sort: "recommendation" }, "2026-07-27")[0].id, "github-codepilot");
});

test("empty result is returned safely", () => {
  assert.deepEqual(filterAndSortTools(tools, { query: "不存在的工具" }, "2026-07-27"), []);
  assert.equal(normalizeFilters().sort, "heat");
});

test("legacy history data is normalized and deduplicated into catalog", () => {
  const data = normalizeData({
    updated_at: "2026-07-27T08:30:00+08:00",
    days: [
      {
        date: "2026-07-27",
        tools: [{
          name: "example/CodePilot",
          one_liner: "AI 编程工具",
          source: "GitHub",
          source_key: "github",
          url: "https://github.com/example/codepilot",
          category: "编程开发",
          attention_score: 88,
        }],
      },
      {
        date: "2026-07-26",
        tools: [{
          name: "example/CodePilot",
          one_liner: "AI 编程工具",
          source: "GitHub",
          source_key: "github",
          url: "https://github.com/example/codepilot",
          category: "编程开发",
          attention_score: 86,
        }],
      },
    ],
  });
  assert.equal(data.schema_version, 1);
  assert.equal(getCatalog(data).length, 1);
});

test("favorites persist and toggle using localStorage", async () => {
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class {
    constructor(type, options) { this.type = type; this.detail = options?.detail; }
  };
  const favorites = await import("../docs/assets/js/favorites.js");
  assert.equal(favorites.toggleFavorite("github-codepilot"), true);
  assert.deepEqual(favorites.getFavorites(), ["github-codepilot"]);
  assert.equal(favorites.toggleFavorite("github-codepilot"), false);
  assert.deepEqual(favorites.getFavorites(), []);
});

test("invalid or empty day data throws a clear error", () => {
  assert.throws(() => normalizeData({}), /days/);
  assert.throws(() => normalizeData({ days: [{ date: "", tools: null }] }), /结构无效/);
});
