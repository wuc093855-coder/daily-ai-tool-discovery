import { getCatalog, getLatestDay, loadData } from "./data.js";
import { activeFilterEntries, filterAndSortTools, normalizeFilters } from "./filters.js";
import { bindToolInteractions, createToolCard, escapeHTML, renderError, renderSkeleton } from "./ui.js";
import { initShell } from "./shell.js";
import { readStorage, writeStorage } from "./storage.js";

initShell("tools");

const grid = document.querySelector("#library-grid");
const search = document.querySelector("#library-search");
const resultCount = document.querySelector("[data-result-count]");
const activeFilters = document.querySelector("#active-filters");
const filterSidebar = document.querySelector("#filter-sidebar");
const filterBackdrop = document.querySelector("#filter-backdrop");
let catalog = [];
let latestDate = "";
let view = readStorage("library-view", "grid");
let filters = normalizeFilters(readStorage("library-filters", {}));

const queryParams = new URLSearchParams(location.search);
if (queryParams.get("category")) filters.category = queryParams.get("category");
if (queryParams.get("q")) filters.query = queryParams.get("q");
if (queryParams.get("date")) {
  filters.date = "today";
  latestDate = queryParams.get("date");
}

renderSkeleton(grid, 6);

function syncControls() {
  search.value = filters.query;
  document.querySelector("#filter-category").value = filters.category;
  document.querySelector("#filter-source").value = filters.source;
  document.querySelector("#filter-open").value = filters.openSource;
  document.querySelector("#filter-pricing").value = filters.pricing;
  document.querySelector("#filter-date").value = filters.date;
  document.querySelector("#filter-score").value = filters.minScore;
  document.querySelector("[data-score-output]").textContent = `${filters.minScore}+`;
  document.querySelector("#sort-tools").value = filters.sort;
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderActiveFilters() {
  const labels = {
    category: "分类",
    source: "来源",
    openSource: "开源",
    pricing: "价格",
    date: "日期",
    minScore: "评分",
  };
  const entries = activeFilterEntries(filters);
  activeFilters.innerHTML = entries.map(([key, value]) => `
    <button class="chip" type="button" data-clear-filter="${key}">
      ${labels[key]}：${escapeHTML(String(value))} ×
    </button>
  `).join("");
  activeFilters.hidden = !entries.length;
}

function render() {
  const tools = filterAndSortTools(catalog, filters, latestDate);
  resultCount.textContent = `${tools.length} 个结果`;
  grid.className = `library-grid${view === "list" ? " is-list" : ""}`;
  grid.innerHTML = "";
  if (!tools.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div>
          <div class="empty-state-icon">⌕</div>
          <h3>没有找到匹配工具</h3>
          <p>试试减少筛选条件，或使用更简短的中英文关键词。</p>
          <button class="button button--primary" type="button" data-clear-all>清除全部筛选</button>
        </div>
      </div>
    `;
  } else {
    tools.forEach((tool, index) => grid.appendChild(createToolCard(tool, { delay: index * 30 })));
  }
  renderActiveFilters();
  writeStorage("library-filters", filters);
}

function clearAll() {
  filters = normalizeFilters();
  syncControls();
  render();
}

function updateFilter(key, value) {
  filters = normalizeFilters({ ...filters, [key]: value });
  render();
}

function closeFilters() {
  filterSidebar.classList.remove("is-open");
  filterBackdrop.hidden = true;
  document.body.classList.remove("is-locked");
  document.querySelector("[data-filter-toggle]")?.setAttribute("aria-expanded", "false");
}

document.addEventListener("click", (event) => {
  const viewValue = event.target.closest("[data-view]")?.dataset.view;
  const clearKey = event.target.closest("[data-clear-filter]")?.dataset.clearFilter;
  if (viewValue) {
    view = viewValue;
    writeStorage("library-view", view);
    syncControls();
    render();
  } else if (clearKey) {
    filters = normalizeFilters({ ...filters, [clearKey]: clearKey === "minScore" ? 0 : "all" });
    syncControls();
    render();
  } else if (event.target.closest("[data-clear-all]")) {
    clearAll();
  } else if (event.target.closest("[data-filter-toggle]")) {
    filterSidebar.classList.add("is-open");
    filterBackdrop.hidden = false;
    document.body.classList.add("is-locked");
    event.target.closest("[data-filter-toggle]").setAttribute("aria-expanded", "true");
  } else if (event.target.closest("[data-filter-close]") || event.target === filterBackdrop) {
    closeFilters();
  }
});

search.addEventListener("input", () => updateFilter("query", search.value));
document.querySelector("#filter-category").addEventListener("change", (event) => updateFilter("category", event.target.value));
document.querySelector("#filter-source").addEventListener("change", (event) => updateFilter("source", event.target.value));
document.querySelector("#filter-open").addEventListener("change", (event) => updateFilter("openSource", event.target.value));
document.querySelector("#filter-pricing").addEventListener("change", (event) => updateFilter("pricing", event.target.value));
document.querySelector("#filter-date").addEventListener("change", (event) => updateFilter("date", event.target.value));
document.querySelector("#filter-score").addEventListener("input", (event) => {
  document.querySelector("[data-score-output]").textContent = `${event.target.value}+`;
  updateFilter("minScore", event.target.value);
});
document.querySelector("#sort-tools").addEventListener("change", (event) => updateFilter("sort", event.target.value));
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) {
    event.preventDefault();
    search.focus();
  }
  if (event.key === "Escape") {
    if (filterSidebar.classList.contains("is-open")) closeFilters();
    else if (document.activeElement === search) {
      search.value = "";
      updateFilter("query", "");
      search.blur();
    }
  }
});

async function boot(force = false) {
  if (force) renderSkeleton(grid, 6);
  try {
    const data = await loadData({ force });
    catalog = getCatalog(data);
    latestDate ||= getLatestDay(data)?.date || "";
    const categories = [...new Set(catalog.map((tool) => tool.category))].sort();
    const select = document.querySelector("#filter-category");
    select.innerHTML = '<option value="all">全部分类</option>'
      + categories.map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join("");
    syncControls();
    render();
    bindToolInteractions(document.body, catalog);
  } catch (error) {
    renderError(grid, error.message, () => boot(true));
  }
}

boot();
