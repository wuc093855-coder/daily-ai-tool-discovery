import { APP } from "./config.js";

const key = (name) => `${APP.storagePrefix}${name}`;

export function readStorage(name, fallback = null) {
  try {
    const value = localStorage.getItem(key(name));
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    console.warn(`[storage] 无法读取 ${name}`, error);
    return fallback;
  }
}
export function writeStorage(name, value) {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`[storage] 无法保存 ${name}`, error);
    return false;
  }
}

export function removeStorage(name) {
  try {
    localStorage.removeItem(key(name));
  } catch (error) {
    console.warn(`[storage] 无法删除 ${name}`, error);
  }
}
