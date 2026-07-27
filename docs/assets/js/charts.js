import { formatNumber } from "./data.js";

export function renderBarChart(container, entries = []) {
  if (!container || !entries.length) return;
  const max = Math.max(...entries.map((entry) => entry.value), 1);
  container.innerHTML = entries.map((entry) => `
    <div class="bar-row">
      <span title="${entry.label}">${entry.label}</span>
      <div class="bar-track" aria-hidden="true">
        <div class="bar-fill" style="--value:${Math.max(4, entry.value / max * 100)}%"></div>
      </div>
      <strong class="mono">${formatNumber(entry.value)}</strong>
    </div>
  `).join("");
}

export function renderDonut(container, entries = []) {
  if (!container || entries.length < 2) return;
  const total = entries.reduce((sum, entry) => sum + entry.value, 0) || 1;
  const percentages = entries.map((entry) => Math.round(entry.value / total * 100));
  const colors = ["var(--accent)", "var(--cyan)", "var(--border-strong)"];
  container.innerHTML = `
    <div class="donut" style="--a:${percentages[0]};--b:${percentages[1] || 0}" role="img" aria-label="${entries.map((entry, index) => `${entry.label} ${percentages[index]}%`).join("，")}"></div>
    <div class="chart-legend">
      ${entries.slice(0, 3).map((entry, index) => `
        <div class="legend-item">
          <i class="legend-dot" style="background:${colors[index]}"></i>
          <span>${entry.label}</span>
          <strong class="mono">${percentages[index]}%</strong>
        </div>
      `).join("")}
    </div>
  `;
}
