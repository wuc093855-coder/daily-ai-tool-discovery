import { SCORE_WEIGHTS } from "./config.js";
import { getStats, loadData } from "./data.js";
import { initShell } from "./shell.js";

initShell("about");

const scoreNames = {
  usefulness: "实用性",
  heat: "热度",
  freshness: "新鲜度",
  product: "产品完整度",
  business: "商业价值",
};

document.querySelector("#score-method").innerHTML = Object.entries(SCORE_WEIGHTS).map(([key, weight]) => `
  <div class="score-weight">
    <span>${scoreNames[key]}</span>
    <div class="score-weight-track" aria-hidden="true"><div class="score-weight-fill" style="--value:${weight * 2.6}%"></div></div>
    <strong class="mono">${weight}%</strong>
  </div>
`).join("");

loadData().then((data) => {
  const stats = getStats(data);
  document.querySelector("[data-about-tools]").textContent = stats.totalTools;
  document.querySelector("[data-about-days]").textContent = stats.updateDays;
}).catch((error) => console.error("[about] 数据统计加载失败", error));
