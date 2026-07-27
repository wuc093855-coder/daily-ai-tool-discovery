import { APP } from "./config.js";
import { formatDateTime, getCatalog, loadData } from "./data.js";
import { getFavorites } from "./favorites.js";
import { initShare } from "./share.js";
import { initThemeControls } from "./theme.js";
import { escapeHTML, icon, openToolDetails } from "./ui.js";

const NAV = [
  ["home", "index.html", "今日精选"],
  ["tools", "tools.html", "工具库"],
  ["tools", "tools.html#categories", "分类"],
  ["home", "index.html#recent", "往期"],
  ["about", "about.html", "关于"],
];

function navLinks(page, mobile = false) {
  return NAV.map(([key, href, label]) => `
    <a class="nav-link" href="${href}" ${key === page && !href.includes("#") ? 'aria-current="page"' : ""}>${label}</a>
  `).join("") + (mobile ? `<a class="nav-link" href="${APP.repository}" target="_blank" rel="noopener noreferrer">GitHub ${icon("external")}</a>` : "");
}

function headerMarkup(page) {
  return `
    <header class="site-header" data-site-header>
      <div class="container header-inner">
        <a class="brand" href="index.html" aria-label="Daily AI Tools 首页">
          <span class="brand-mark" aria-hidden="true"></span>
          <span class="brand-copy"><strong>Daily AI Tools</strong><span>每日 AI 工具发现</span></span>
        </a>
        <nav class="desktop-nav" aria-label="主导航">${navLinks(page)}</nav>
        <div class="header-actions">
          <button class="icon-button search-button" type="button" data-global-search aria-label="搜索工具">${icon("search")}</button>
          <button class="icon-button theme-button" type="button" data-theme-toggle aria-label="切换主题" data-theme-label>${icon("sun")}</button>
          <a class="icon-button favorite-shortcut" href="favorites.html" aria-label="我的收藏，0 个工具">
            ${icon("bookmark")}<span class="favorite-count" data-header-favorite-count>0</span>
          </a>
          <a class="button github-star" href="${APP.repository}" target="_blank" rel="noopener noreferrer" aria-label="在 GitHub 查看并 Star 项目">${icon("star")} GitHub Star</a>
          <button class="icon-button mobile-menu-button" type="button" data-mobile-menu aria-label="打开菜单" aria-expanded="false">${icon("menu")}</button>
        </div>
      </div>
    </header>
    <nav class="mobile-menu" data-mobile-menu-panel aria-label="移动端导航">${navLinks(page, true)}</nav>
  `;
}

function footerMarkup() {
  return `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true"></span><span class="brand-copy"><strong>Daily AI Tools</strong><span>每日 AI 工具发现</span></span></a>
            <p>每天从 GitHub、Product Hunt 和 Hugging Face 中筛选真正值得关注的 AI 工具，用中文快速说明它是什么、适合谁，以及有没有商业价值。</p>
          </div>
          <div class="footer-column">
            <strong>产品</strong>
            <a href="index.html#today">今日精选</a>
            <a href="tools.html">工具库</a>
            <a href="favorites.html">我的收藏</a>
            <a href="about.html">评分说明</a>
          </div>
          <div class="footer-column">
            <strong>数据</strong>
            <a href="https://github.com/trending" target="_blank" rel="noopener noreferrer">GitHub Trending ↗</a>
            <a href="https://www.producthunt.com/" target="_blank" rel="noopener noreferrer">Product Hunt ↗</a>
            <a href="https://huggingface.co/" target="_blank" rel="noopener noreferrer">Hugging Face ↗</a>
            <a href="feed.xml">RSS Feed</a>
          </div>
          <div class="footer-column">
            <strong>项目</strong>
            <a href="${APP.repository}" target="_blank" rel="noopener noreferrer">GitHub 仓库 ↗</a>
            <a href="sitemap.xml">Sitemap</a>
            <a href="about.html#privacy">隐私说明</a>
            <a href="#top">返回顶部 ↑</a>
          </div>
        </div>
        <div class="footer-bottom">
          <span>最近成功更新：<span data-footer-updated>读取中</span></span>
          <span>工具价格、许可证、商用权限和功能可能变化，正式使用前请以原项目页面为准。</span>
        </div>
      </div>
    </footer>
  `;
}

function bottomNav(page) {
  return `
    <nav class="mobile-bottom-nav" aria-label="移动端快捷导航">
      <a href="index.html" ${page === "home" ? 'aria-current="page"' : ""}>${icon("home")}<span>今日</span></a>
      <a href="tools.html" ${page === "tools" ? 'aria-current="page"' : ""}>${icon("grid")}<span>工具库</span></a>
      <a href="favorites.html" ${page === "favorites" ? 'aria-current="page"' : ""}>${icon("bookmark")}<span>收藏</span></a>
      <a href="about.html" ${page === "about" ? 'aria-current="page"' : ""}>${icon("info")}<span>关于</span></a>
    </nav>
  `;
}

function dialogsMarkup() {
  return `
    <dialog id="tool-dialog" aria-labelledby="tool-dialog-title">
      <div class="detail-dialog">
        <div class="dialog-scroll">
          <div class="dialog-header"><strong>工具详情</strong><button class="icon-button dialog-close" type="button" data-dialog-close="tool-dialog" aria-label="关闭详情">${icon("close")}</button></div>
          <div class="detail-content" data-detail-content></div>
        </div>
      </div>
    </dialog>
    <dialog id="share-dialog" class="share-dialog" aria-labelledby="share-dialog-title">
      <button class="icon-button dialog-close" type="button" data-share-action="close" aria-label="关闭分享">${icon("close")}</button>
      <h2 id="share-dialog-title">分享工具</h2>
      <p>分享 <strong data-share-name></strong></p>
      <div class="share-options">
        <button class="button" type="button" data-share-action="native">${icon("share")} 系统分享</button>
        <button class="button" type="button" data-share-action="copy-link">${icon("link")} 复制链接</button>
        <button class="button" type="button" data-share-action="copy-intro">${icon("copy")} 复制简介</button>
        <button class="button" type="button" data-share-action="x">X</button>
        <button class="button" type="button" data-share-action="telegram">Telegram</button>
      </div>
    </dialog>
    <dialog id="search-dialog" class="search-dialog" aria-labelledby="search-dialog-title">
      <h2 id="search-dialog-title" class="visually-hidden">搜索工具</h2>
      <label class="search-field">
        <span class="visually-hidden">搜索工具名称或简介</span>
        ${icon("search")}
        <input class="input" type="search" data-global-search-input placeholder="搜索名称、简介或分类…" autocomplete="off">
        <kbd class="search-shortcut">Esc</kbd>
      </label>
      <div class="global-search-results" data-global-search-results></div>
    </dialog>
    <div class="toast-region" role="status" aria-live="polite" aria-atomic="true" data-toast-region></div>
  `;
}

function setupHeader() {
  const header = document.querySelector("[data-site-header]");
  const menuButton = document.querySelector("[data-mobile-menu]");
  const menu = document.querySelector("[data-mobile-menu-panel]");
  const updateScroll = () => header?.classList.toggle("is-scrolled", scrollY > 8);
  updateScroll();
  addEventListener("scroll", updateScroll, { passive: true });
  menuButton?.addEventListener("click", () => {
    const open = !menu.classList.contains("is-open");
    menu.classList.toggle("is-open", open);
    header.classList.toggle("is-open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
  });
}

function setupDialogs() {
  const unlockWhenIdle = () => {
    if (![...document.querySelectorAll("dialog")].some((dialog) => dialog.open)) {
      document.body.classList.remove("is-locked");
    }
  };
  document.addEventListener("click", (event) => {
    const dialogId = event.target.closest("[data-dialog-close]")?.dataset.dialogClose;
    if (dialogId) document.getElementById(dialogId)?.close();
  });
  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("close", unlockWhenIdle);
  });
  document.querySelector("#tool-dialog")?.addEventListener("close", () => {
    if (location.hash.startsWith("#tool=")) history.replaceState(null, "", `${location.pathname}${location.search}`);
  });
}

function setupToast() {
  addEventListener("app:toast", (event) => {
    const region = document.querySelector("[data-toast-region]");
    if (!region) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = event.detail;
    region.appendChild(toast);
    setTimeout(() => toast.remove(), 2800);
  });
}

function setupFavoriteCount() {
  const update = () => {
    const total = getFavorites().length;
    document.querySelectorAll("[data-header-favorite-count]").forEach((node) => {
      node.textContent = String(total);
      node.closest(".favorite-shortcut")?.setAttribute("aria-label", `我的收藏，${total} 个工具`);
    });
  };
  update();
  addEventListener("app:favorites", update);
  addEventListener("storage", update);
}

async function setupSearch() {
  const dialog = document.querySelector("#search-dialog");
  const input = document.querySelector("[data-global-search-input]");
  const results = document.querySelector("[data-global-search-results]");
  let catalog = [];
  loadData().then((data) => {
    catalog = getCatalog(data);
    document.querySelectorAll("[data-footer-updated]").forEach((node) => {
      node.textContent = formatDateTime(data.updated_at) || "尚未记录";
    });
  }).catch((error) => {
    console.error("[shell] 无法准备全局搜索", error);
  });

  const open = () => {
    document.body.classList.add("is-locked");
    dialog.showModal();
    setTimeout(() => input.focus(), 0);
  };
  document.querySelectorAll("[data-global-search]").forEach((button) => button.addEventListener("click", open));
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.body.dataset.page !== "tools" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) {
      event.preventDefault();
      open();
    }
    if (event.key === "Escape" && dialog.open) dialog.close();
  });
  input.addEventListener("input", () => {
    const query = input.value.trim().toLocaleLowerCase("zh-CN");
    if (!query) {
      results.innerHTML = '<p class="muted">输入工具名称、简介或分类开始搜索。</p>';
      return;
    }
    const matches = catalog.filter((tool) => [
      tool.name, tool.original_name, tool.tagline_zh, tool.category,
    ].join(" ").toLocaleLowerCase("zh-CN").includes(query)).slice(0, 8);
    results.innerHTML = matches.length
      ? matches.map((tool) => `
          <button class="global-search-item" type="button" data-global-result="${escapeHTML(tool.id)}">
            <span><strong>${escapeHTML(tool.name)}</strong><span>${escapeHTML(tool.category)} · ${escapeHTML(tool.source)}</span></span>
            <span>查看详情 →</span>
          </button>
        `).join("")
      : '<p class="muted">没有找到匹配工具，试试其他关键词。</p>';
  });
  results.addEventListener("click", (event) => {
    const id = event.target.closest("[data-global-result]")?.dataset.globalResult;
    const tool = catalog.find((item) => item.id === id);
    if (tool) {
      dialog.close();
      openToolDetails(tool, catalog);
    }
  });
}

export function initShell(page = document.body.dataset.page || "home") {
  const header = document.querySelector("#site-header");
  const footer = document.querySelector("#site-footer");
  const overlays = document.querySelector("#site-overlays");
  if (header) header.innerHTML = headerMarkup(page);
  if (footer) footer.innerHTML = footerMarkup();
  if (overlays) overlays.innerHTML = dialogsMarkup() + bottomNav(page);

  initThemeControls();
  initShare();
  setupHeader();
  setupDialogs();
  setupToast();
  setupFavoriteCount();
  setupSearch();
}
