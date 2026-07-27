import { readStorage, writeStorage } from "./storage.js";

const THEMES = ["light", "dark"];

export function getTheme() {
  return document.documentElement.dataset.theme || "light";
}

export function setTheme(theme, persist = true) {
  const next = THEMES.includes(theme) ? theme : "light";
  document.documentElement.dataset.theme = next;
  document.documentElement.style.colorScheme = next;
  document.querySelectorAll("[data-theme-label]").forEach((node) => {
    node.setAttribute("aria-label", next === "dark" ? "切换浅色模式" : "切换深色模式");
  });
  document.querySelectorAll("[data-theme-icon]").forEach((node) => {
    node.dataset.themeIcon = next;
  });
  if (persist) writeStorage("theme", next);
  window.dispatchEvent(new CustomEvent("app:theme", { detail: next }));
}

export function toggleTheme() {
  setTheme(getTheme() === "dark" ? "light" : "dark");
}

export function initThemeControls() {
  const saved = readStorage("theme");
  if (saved && THEMES.includes(saved)) setTheme(saved, false);
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-theme-toggle]");
    if (trigger) toggleTheme();
  });
}
