import { CATEGORY_ORDER } from "./config.js";
import { renderBarChart, renderDonut } from "./charts.js";
import { formatDate, formatDateTime, getCatalog, getLatestDay, getStats, loadData } from "./data.js";
import { initShell } from "./shell.js";
import { bindToolInteractions, createToolCard, escapeHTML, renderError, renderSkeleton } from "./ui.js";

initShell("home");

const todayGrid = document.querySelector("#today-grid");
renderSkeleton(todayGrid, 3);

function animateNumber(node, value) {
  if (!node) return;
  const target = Number(value) || 0;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    node.textContent = target;
    return;
  }
  const start = performance.now();
  const duration = 450;
  const frame = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    node.textContent = Math.round(target * (1 - Math.pow(1 - progress, 3)));
    if (progress < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function renderHero(data) {
  const latest = getLatestDay(data);
  const stats = getStats(data);
  const values = {
    today: stats.todayCount,
    total: stats.totalTools,
    days: stats.updateDays,
    sources: stats.sourceCount,
    scanned: stats.scanned,
    selected: stats.todayCount,
    highest: Math.round(stats.highestScore),
  };
  Object.entries(values).forEach(([key, value]) => {
    const node = document.querySelector(`[data-stat="${key}"]`);
    animateNumber(node, value);
  });
  document.querySelector("[data-stat='updated']").textContent = formatDateTime(data.updated_at) || "尚未记录";
  document.querySelector("[data-scan-time]").textContent = formatDateTime(data.updated_at) || "尚未记录";
  document.querySelector("[data-data-health]").textContent = data.meta.fromCache
    ? "远程数据暂不可用，正在展示最近一次成功缓存"
    : `${latest?.display_date || formatDate(latest?.date)} 数据已校验`;
  document.querySelector("[data-data-health]").classList.toggle("is-warning", data.meta.fromCache);
}

function renderToday(data, catalog) {
  const latest = getLatestDay(data);
  const subtitle = document.querySelector("[data-today-subtitle]");
  subtitle.textContent = `${formatDate(latest.date)} · 今日筛选出的 ${latest.tools.length} 个 AI 工具`;
  todayGrid.className = "tool-grid";
  todayGrid.innerHTML = "";
  latest.tools.forEach((tool, index) => {
    todayGrid.appendChild(createToolCard(tool, { featured: index === 0, delay: index * 55 }));
  });
  bindToolInteractions(document.body, catalog);
}

function renderCategories(catalog) {
  const container = document.querySelector("#category-grid");
  const counts = catalog.reduce((map, tool) => {
    map[tool.category] = (map[tool.category] || 0) + 1;
    return map;
  }, {});
  const available = [
    ...CATEGORY_ORDER,
    ...Object.keys(counts).filter((category) => !CATEGORY_ORDER.includes(category)),
  ];
  container.innerHTML = available.map((category, index) => `
    <a class="category-card" href="tools.html?category=${encodeURIComponent(category)}">
      <span class="category-icon">${String(index + 1).padStart(2, "0")}</span>
      <strong>${escapeHTML(category)}</strong>
      <span>${counts[category] || 0} 个工具</span>
    </a>
  `).join("");
}

function renderTrends(data, catalog) {
  const section = document.querySelector("#trends");
  if (data.days.length < 2 || catalog.length < 5) {
    section.hidden = true;
    return;
  }
  const ranked = [...catalog]
    .filter((tool) => tool.score_total !== null)
    .sort((a, b) => b.score_total - a.score_total)
    .slice(0, 5)
    .map((tool) => ({ label: tool.name, value: tool.score_total }));
  renderBarChart(document.querySelector("#trend-bars"), ranked);
  const sourceCounts = Object.entries(catalog.reduce((map, tool) => {
    map[tool.source] = (map[tool.source] || 0) + 1;
    return map;
  }, {})).map(([label, value]) => ({ label, value }));
  renderDonut(document.querySelector("#source-donut"), sourceCounts);
  section.hidden = false;
}

function renderRecent(data) {
  const section = document.querySelector("#recent");
  const timeline = document.querySelector("#recent-timeline");
  if (!data.days.length) {
    section.hidden = true;
    return;
  }
  timeline.innerHTML = data.days.slice(0, 7).map((day) => `
    <article class="timeline-day">
      <div class="timeline-date">
        <strong>${escapeHTML(formatDate(day.date))}</strong>
        <span>${escapeHTML(day.weekday || "")}</span>
      </div>
      <div class="timeline-tools">
        ${day.tools.slice(0, 5).map((tool) => `<span class="timeline-tool">${escapeHTML(tool.name)}</span>`).join("")}
      </div>
      <a class="button button--ghost" href="tools.html?date=${encodeURIComponent(day.date)}">查看当天</a>
    </article>
  `).join("");
}

async function boot(force = false) {
  if (force) renderSkeleton(todayGrid, 3);
  try {
    const data = await loadData({ force });
    const catalog = getCatalog(data);
    renderHero(data);
    renderToday(data, catalog);
    renderCategories(catalog);
    renderTrends(data, catalog);
    renderRecent(data);
    const hashId = decodeURIComponent(location.hash.replace("#tool=", ""));
    if (location.hash.startsWith("#tool=") && hashId) {
      const button = document.querySelector(`[data-detail-id="${CSS.escape(hashId)}"]`);
      button?.click();
    }
  } catch (error) {
    renderError(todayGrid, error.message, () => boot(true));
  }
}

boot();
