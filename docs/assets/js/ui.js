import { formatDate, formatNumber } from "./data.js";
import { isFavorite, toggleFavorite } from "./favorites.js";
import { openShareDialog } from "./share.js";

const ICONS = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  bookmark: '<path d="M6.5 4.5A1.5 1.5 0 0 1 8 3h8a1.5 1.5 0 0 1 1.5 1.5V21L12 17.8 6.5 21V4.5Z"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/>',
  star: '<path d="m12 2.8 2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93L12 2.8Z"/>',
  trend: '<path d="m3 16 5-5 4 4 8-9"/><path d="M15 6h5v5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  heart: '<path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.4 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
};

export function icon(name, label = "") {
  return `<svg viewBox="0 0 24 24" ${label ? `role="img" aria-label="${escapeHTML(label)}"` : 'aria-hidden="true"'}>${ICONS[name] || ICONS.info}</svg>`;
}

export function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function safeURL(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function initials(name = "AI") {
  const words = name.replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, " ").trim().split(/\s+/);
  if (!words.length) return "AI";
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function recommendation(score) {
  if (score >= 88) return "强烈推荐";
  if (score >= 80) return "值得使用";
  if (score >= 72) return "值得关注";
  return "可以看看";
}

function pricingLabel(tool) {
  if (tool.pricing_type === "paid") return "付费";
  if (tool.pricing_type === "freemium") return "免费增值";
  if (tool.is_free === true) return "免费";
  return null;
}

function toolTags(tool) {
  const tags = [
    { value: tool.source, className: "tag--accent" },
    { value: tool.category },
    tool.is_open_source === true ? { value: "开源", className: "tag--success" } : null,
    pricingLabel(tool) ? { value: pricingLabel(tool), className: tool.is_free ? "tag--success" : "" } : null,
    ...(tool.tags || []).filter((tag) => tag !== tool.category).slice(0, 2).map((value) => ({ value })),
  ].filter(Boolean);
  return tags.map((tag) => `<span class="tag ${tag.className || ""}">${escapeHTML(tag.value)}</span>`).join("");
}

function metricMarkup(tool) {
  const metrics = [
    tool.stars !== null ? `${icon("star")}<span>${formatNumber(tool.stars)} Star</span>` : null,
    tool.star_growth !== null ? `${icon("trend")}<span>+${formatNumber(tool.star_growth)} 今日</span>` : null,
    tool.likes !== null ? `${icon("heart")}<span>${formatNumber(tool.likes)} 赞</span>` : null,
    tool.published_at ? `${icon("clock")}<span>${formatDate(tool.published_at, { short: true })}</span>` : null,
  ].filter(Boolean);
  return metrics.map((metric) => `<span class="tool-metric">${metric}</span>`).join("");
}

function scoreRing(score, compact = false) {
  if (score === null) return "";
  const value = Math.max(0, Math.min(100, Math.round(score)));
  return `
    <div class="score-ring ${compact ? "score-ring--compact" : ""}" style="--score:${value}" aria-label="站内综合评分 ${value} 分">
      <div class="score-ring-content">
        <strong>${value}</strong>
        <span>站内评分</span>
      </div>
    </div>
  `;
}

function scoreBars(tool) {
  const scores = [
    ["实用性", tool.score_usefulness],
    ["热度", tool.score_heat],
    ["新鲜度", tool.score_freshness],
    ["商业价值", tool.score_business],
  ].filter(([, value]) => value !== null);
  if (!scores.length) return "";
  return `
    <div class="score-bars">
      ${scores.map(([label, value]) => `
        <div class="score-bar">
          <span>${label}</span>
          <div class="score-bar-track" aria-hidden="true"><div class="score-bar-fill" style="--value:${value}%"></div></div>
          <strong class="mono">${Math.round(value)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function logoMarkup(tool) {
  const logo = safeURL(tool.logo_url);
  return `
    <span class="tool-logo" aria-hidden="true">
      <span>${escapeHTML(initials(tool.name))}</span>
      ${logo ? `<img src="${escapeHTML(logo)}" alt="" width="58" height="58" loading="lazy" referrerpolicy="no-referrer">` : ""}
    </span>
  `;
}

export function createToolCard(tool, { featured = false, delay = 0 } = {}) {
  const card = document.createElement("article");
  card.className = `tool-card${featured ? " tool-card--featured" : ""}`;
  card.dataset.toolId = tool.id;
  card.style.animationDelay = `${Math.min(delay, 240)}ms`;
  const saved = isFavorite(tool.id);
  const detailLabel = `查看 ${tool.name} 详情`;
  const main = `
    <div class="tool-card-main">
      <div class="tool-card-top">
        <div class="tool-identity">
          ${logoMarkup(tool)}
          <div class="tool-title-wrap">
            <h3 class="tool-title">${escapeHTML(tool.name)}</h3>
            <div class="tool-original-name">${escapeHTML(tool.original_name)}</div>
          </div>
        </div>
        ${tool.rank ? `<span class="rank-badge ${tool.rank === 1 ? "rank-badge--top" : ""}">#${tool.rank}</span>` : ""}
      </div>
      <p class="tool-tagline">${escapeHTML(tool.tagline_zh || tool.description_zh)}</p>
      <div class="tag-list">${toolTags(tool)}</div>
      <div class="tool-metrics">${metricMarkup(tool)}</div>
      <div class="tool-card-footer">
        <button class="button button--ghost" type="button" data-detail-id="${escapeHTML(tool.id)}" aria-label="${escapeHTML(detailLabel)}">
          查看详情 ${icon("arrow")}
        </button>
        <div class="card-actions">
          <button class="action-button ${saved ? "is-active" : ""}" type="button" data-favorite-id="${escapeHTML(tool.id)}" aria-label="${saved ? "取消收藏" : "收藏"} ${escapeHTML(tool.name)}" aria-pressed="${saved}">
            ${icon("bookmark")}
          </button>
          <button class="action-button" type="button" data-share-id="${escapeHTML(tool.id)}" aria-label="分享 ${escapeHTML(tool.name)}">
            ${icon("share")}
          </button>
        </div>
      </div>
    </div>
  `;
  const side = featured ? `
    <aside class="tool-card-side">
      <div class="score-summary">
        ${scoreRing(tool.score_total)}
        <div class="score-copy">
          <strong>${recommendation(tool.score_total || 0)}</strong>
          <span>站内综合评分，仅供同日工具横向参考</span>
        </div>
      </div>
      ${scoreBars(tool)}
      ${tool.suitable_for ? `<p class="muted"><strong>适合：</strong>${escapeHTML(tool.suitable_for)}</p>` : ""}
    </aside>
  ` : "";
  card.innerHTML = main + side;
  card.querySelectorAll(".tool-logo img").forEach((image) => {
    image.addEventListener("error", () => image.remove(), { once: true });
  });
  return card;
}

function optionalSection(title, content, isList = false) {
  if (!content || (Array.isArray(content) && !content.length)) return "";
  return `
    <section class="detail-section">
      <h3>${title}</h3>
      ${isList
        ? `<ul>${content.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>`
        : `<p>${escapeHTML(content)}</p>`}
    </section>
  `;
}

function detailMeta(tool) {
  const entries = [
    ["来源平台", tool.source],
    ["首次收录", formatDate(tool.first_discovered_at || tool.discovered_at)],
    ["最近收录", formatDate(tool.last_discovered_at || tool.discovered_at)],
    ["许可证", tool.license],
    ["GitHub Star", tool.stars !== null ? formatNumber(tool.stars) : null],
    ["今日增长", tool.star_growth !== null ? `+${formatNumber(tool.star_growth)}` : null],
  ].filter(([, value]) => value);
  if (!entries.length) return "";
  return `
    <div class="detail-meta">
      ${entries.map(([label, value]) => `
        <div class="detail-meta-item"><span>${label}</span><strong>${escapeHTML(value)}</strong></div>
      `).join("")}
    </div>
  `;
}

export function openToolDetails(tool, catalog = []) {
  const dialog = document.querySelector("#tool-dialog");
  if (!dialog) return;
  const similar = catalog.filter((item) => item.id !== tool.id && item.category === tool.category).slice(0, 3);
  const saved = isFavorite(tool.id);
  dialog.querySelector("[data-detail-content]").innerHTML = `
    <div class="detail-hero">
      <div>
        <div class="detail-title-row">
          ${logoMarkup(tool)}
          <div>
            <h2 id="tool-dialog-title">${escapeHTML(tool.name)}</h2>
            <div class="tool-original-name">${escapeHTML(tool.original_name)}</div>
          </div>
        </div>
        <p class="detail-summary">${escapeHTML(tool.description_zh || tool.tagline_zh)}</p>
        <div class="tag-list">${toolTags(tool)}</div>
        <div class="detail-actions">
          ${safeURL(tool.official_url) ? `<a class="button button--primary" href="${escapeHTML(safeURL(tool.official_url))}" target="_blank" rel="noopener noreferrer">打开官方项目 ${icon("external")}</a>` : ""}
          <button class="button ${saved ? "button--accent" : ""}" type="button" data-favorite-id="${escapeHTML(tool.id)}" aria-pressed="${saved}">${icon("bookmark")} ${saved ? "已收藏" : "收藏"}</button>
          <button class="button" type="button" data-share-id="${escapeHTML(tool.id)}">${icon("share")} 分享</button>
        </div>
      </div>
      ${scoreRing(tool.score_total)}
    </div>
    <div class="detail-grid">
      ${detailMeta(tool)}
      ${optionalSection("核心功能", tool.core_features, true)}
      ${optionalSection("适合人群", tool.suitable_for)}
      ${optionalSection("适用场景", tool.use_cases, true)}
      ${optionalSection("优势", tool.pros, true)}
      ${optionalSection("可能的限制", tool.limitations, true)}
      ${optionalSection("商业价值", tool.business_potential)}
      ${optionalSection("变现思路", tool.monetization_ideas, true)}
      ${scoreBars(tool) ? `<section class="detail-section"><h3>评分维度</h3>${scoreBars(tool)}<p>评分用于站内同日横向比较，并非绝对评价。</p></section>` : ""}
      ${similar.length ? optionalSection("类似工具", similar.map((item) => item.name), true) : ""}
    </div>
  `;
  dialog.querySelectorAll(".tool-logo img").forEach((image) => {
    image.addEventListener("error", () => image.remove(), { once: true });
  });
  document.body.classList.add("is-locked");
  dialog.showModal();
  history.replaceState(null, "", `${location.pathname}${location.search}#tool=${encodeURIComponent(tool.id)}`);
}

export function bindToolInteractions(root, catalog) {
  if (!root || root.dataset.interactionsBound) return;
  root.dataset.interactionsBound = "true";
  root.addEventListener("click", (event) => {
    const detailId = event.target.closest("[data-detail-id]")?.dataset.detailId;
    const favoriteId = event.target.closest("[data-favorite-id]")?.dataset.favoriteId;
    const shareId = event.target.closest("[data-share-id]")?.dataset.shareId;
    if (detailId) {
      const tool = catalog.find((item) => item.id === detailId);
      if (tool) openToolDetails(tool, catalog);
    } else if (favoriteId) {
      const active = toggleFavorite(favoriteId);
      document.querySelectorAll(`[data-favorite-id="${CSS.escape(favoriteId)}"]`).forEach((button) => {
        button.classList.toggle("is-active", active);
        button.classList.toggle("button--accent", active && button.classList.contains("button"));
        button.setAttribute("aria-pressed", String(active));
        const textNode = [...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
        if (textNode && button.classList.contains("button")) textNode.textContent = active ? " 已收藏" : " 收藏";
      });
      window.dispatchEvent(new CustomEvent("app:toast", { detail: active ? "已加入收藏" : "已取消收藏" }));
    } else if (shareId) {
      const tool = catalog.find((item) => item.id === shareId);
      if (tool) openShareDialog(tool);
    }
  });
}

export function renderSkeleton(container, count = 4) {
  container.className = "skeleton-grid";
  container.innerHTML = Array.from({ length: count }, () => `
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
    </div>
  `).join("");
}

export function renderError(container, message, retry) {
  container.className = "error-state";
  container.innerHTML = `
    <div>
      <div class="empty-state-icon">!</div>
      <h3>数据暂时没有加载成功</h3>
      <p>${escapeHTML(message)}。页面其他内容仍可浏览，你也可以立即重试。</p>
      <button class="button button--primary" type="button" data-retry>重新加载</button>
    </div>
  `;
  container.querySelector("[data-retry]")?.addEventListener("click", retry);
}
