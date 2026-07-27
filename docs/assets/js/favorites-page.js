import { getCatalog, loadData } from "./data.js";
import { clearFavorites, getFavorites } from "./favorites.js";
import { initShell } from "./shell.js";
import { bindToolInteractions, createToolCard, renderError, renderSkeleton } from "./ui.js";

initShell("favorites");

const grid = document.querySelector("#favorites-grid");
const count = document.querySelector("[data-favorite-count]");
let catalog = [];
renderSkeleton(grid, 4);

function render() {
  const ids = getFavorites();
  const tools = ids.map((id) => catalog.find((tool) => tool.id === id)).filter(Boolean);
  count.textContent = String(tools.length);
  grid.className = "library-grid";
  grid.innerHTML = "";
  if (!tools.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div>
          <div class="empty-state-icon">◇</div>
          <h3>收藏夹还是空的</h3>
          <p>在工具卡片或详情中点击收藏，感兴趣的工具会安全保存在当前浏览器。</p>
          <a class="button button--primary" href="tools.html">浏览工具库</a>
        </div>
      </div>
    `;
  } else {
    tools.forEach((tool, index) => grid.appendChild(createToolCard(tool, { delay: index * 35 })));
  }
  document.querySelector("[data-clear-favorites]").hidden = !tools.length;
}

document.querySelector("[data-clear-favorites]").addEventListener("click", () => {
  if (confirm("确定清空当前浏览器中的全部收藏吗？")) clearFavorites();
});
addEventListener("app:favorites", render);

async function boot(force = false) {
  try {
    const data = await loadData({ force });
    catalog = getCatalog(data);
    render();
    bindToolInteractions(document.body, catalog);
  } catch (error) {
    renderError(grid, error.message, () => boot(true));
  }
}

boot();
