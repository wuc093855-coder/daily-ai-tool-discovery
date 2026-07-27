const SOURCE_CLASS = {
  github: "github",
  producthunt: "producthunt",
  huggingface: "huggingface",
};

const state = { data: null, selectedDate: null };

function formatUpdateTime(value) {
  if (!value) return "尚未更新";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function renderDay(date) {
  const day = state.data.days.find((item) => item.date === date);
  const list = document.querySelector("#tool-list");
  const status = document.querySelector("#status");
  const heading = document.querySelector("#edition-heading");
  list.innerHTML = "";

  if (!day) {
    status.textContent = "这一天还没有内容。";
    status.hidden = false;
    return;
  }

  heading.textContent = date === state.data.days[0].date ? "今日精选" : `${day.display_date}精选`;
  status.hidden = true;

  day.tools.forEach((tool, index) => {
    const fragment = document.querySelector("#tool-template").content.cloneNode(true);
    const card = fragment.querySelector(".tool-card");
    card.style.setProperty("--delay", `${index * 70}ms`);
    fragment.querySelector(".rank").textContent = String(tool.rank).padStart(2, "0");

    const source = fragment.querySelector(".source-badge");
    source.textContent = tool.source;
    source.classList.add(SOURCE_CLASS[tool.source_key] || "");
    fragment.querySelector(".category-badge").textContent = tool.category;
    fragment.querySelector(".score").textContent = `关注度 ${Math.round(tool.attention_score)}`;
    fragment.querySelector("h3").textContent = tool.name;
    fragment.querySelector(".one-liner").textContent = tool.one_liner;

    const featureList = fragment.querySelector(".feature-detail ul");
    tool.main_features.forEach((feature) => {
      const item = document.createElement("li");
      item.textContent = feature;
      featureList.appendChild(item);
    });
    fragment.querySelector(".pricing").textContent = tool.pricing;
    fragment.querySelector(".best-for").textContent = tool.best_for;
    fragment.querySelector(".side-hustle").textContent = tool.side_hustle;

    const link = fragment.querySelector(".project-link");
    link.href = tool.url;
    link.setAttribute("aria-label", `查看 ${tool.name} 原始项目`);
    list.appendChild(fragment);
  });
}

function setupDateSelect() {
  const select = document.querySelector("#date-select");
  select.innerHTML = "";
  state.data.days.forEach((day, index) => {
    const option = document.createElement("option");
    option.value = day.date;
    option.textContent = `${day.display_date} · ${day.weekday}${index === 0 ? "（最新）" : ""}`;
    select.appendChild(option);
  });
  select.addEventListener("change", (event) => renderDay(event.target.value));
}

async function boot() {
  const status = document.querySelector("#status");
  try {
    const response = await fetch("data/daily.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    if (!state.data.days.length) {
      status.textContent = "首次内容正在生成，请稍后刷新。";
      return;
    }
    setupDateSelect();
    renderDay(state.data.days[0].date);
    document.querySelector(".nav-meta").title = `最近更新：${formatUpdateTime(state.data.updated_at)}`;
  } catch (error) {
    status.textContent = "内容加载失败，请稍后再试。";
    console.error(error);
  }
}

boot();
