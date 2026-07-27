import { readStorage, writeStorage } from "./storage.js";

const STORAGE_KEY = "favorites";

export function getFavorites() {
  const value = readStorage(STORAGE_KEY, []);
  return Array.isArray(value) ? [...new Set(value.filter(Boolean))] : [];
}

export function isFavorite(id) {
  return getFavorites().includes(id);
}

export function toggleFavorite(id) {
  const current = getFavorites();
  const next = current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id];
  writeStorage(STORAGE_KEY, next);
  window.dispatchEvent(new CustomEvent("app:favorites", { detail: next }));
  return next.includes(id);
}

export function clearFavorites() {
  writeStorage(STORAGE_KEY, []);
  window.dispatchEvent(new CustomEvent("app:favorites", { detail: [] }));
}
