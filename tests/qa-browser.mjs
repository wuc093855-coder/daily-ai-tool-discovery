import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "file:///C:/Users/chenmo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:8765";
const shots = process.env.QA_SCREENSHOT_DIR || "qa-screenshots";
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
await mkdir(shots, { recursive: true });

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--disable-gpu"],
});

const failures = [];
const results = [];

async function run(name, fn) {
  try {
    await fn();
    results.push(`PASS ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.stack || error}`);
    results.push(`FAIL ${name}`);
  }
}

function monitor(page, label) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${label}: ${message.text()}`);
  });
  return errors;
}

async function openPage(path, viewport, colorScheme = "light") {
  const context = await browser.newContext({ viewport, colorScheme });
  const page = await context.newPage();
  const errors = monitor(page, `${path} ${viewport.width}`);
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  return { context, page, errors };
}

for (const width of [320, 375, 390, 430, 768, 1366, 1440, 1920]) {
  await run(`首页 ${width}px 无横向滚动且首屏看到工具`, async () => {
    const viewport = { width, height: width < 700 ? 844 : 900 };
    const { context, page, errors } = await openPage("/", viewport);
    await page.waitForSelector("#today-grid .tool-card", { timeout: 10_000 });
    assert.equal(await page.locator("#today-grid .tool-card").count(), 5);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `horizontal overflow: ${overflow}px`);
    const firstTop = await page.locator("#today-grid .tool-card").first().evaluate((node) => node.getBoundingClientRect().top);
    assert.ok(firstTop < viewport.height, `first tool starts below fold at ${firstTop}px`);
    assert.equal(await page.locator(".skeleton-card").count(), 0);
    assert.deepEqual(errors, []);
    if ([390, 1366, 1920].includes(width)) {
      await page.screenshot({ path: `${shots}/home-light-${width}.png`, fullPage: true });
    }
    await context.close();
  });
}

await run("深色主题切换、刷新后保持", async () => {
  const { context, page, errors } = await openPage("/", { width: 1440, height: 900 }, "light");
  await page.evaluate(() => localStorage.removeItem("daily-ai-tools:theme"));
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-theme-toggle]").click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.screenshot({ path: `${shots}/home-dark-1440.png`, fullPage: true });
  assert.deepEqual(errors, []);
  await context.close();
});

await run("工具库搜索、筛选、排序与列表视图", async () => {
  const { context, page, errors } = await openPage("/tools.html", { width: 1366, height: 900 });
  await page.waitForSelector("#library-grid .tool-card", { timeout: 10_000 });
  await page.locator("#library-search").fill("KAT");
  assert.equal(await page.locator("#library-grid .tool-card").count(), 1);
  assert.match(await page.locator("[data-result-count]").textContent(), /1/);
  await page.locator("#library-search").fill("");
  await page.locator("#filter-source").selectOption("github");
  assert.ok(await page.locator("#library-grid .tool-card").count() >= 1);
  await page.locator("#sort-tools").selectOption("recommendation");
  await page.locator('[data-view="list"]').click();
  assert.ok((await page.locator("#library-grid").getAttribute("class")).includes("is-list"));
  await page.reload({ waitUntil: "networkidle" });
  assert.ok((await page.locator("#library-grid").getAttribute("class")).includes("is-list"));
  await page.screenshot({ path: `${shots}/tools-list-1366.png`, fullPage: true });
  assert.deepEqual(errors, []);
  await context.close();
});

await run("详情弹窗、Escape 与滚动锁", async () => {
  const { context, page, errors } = await openPage("/", { width: 390, height: 844 });
  await page.waitForSelector("[data-detail-id]");
  await page.locator("[data-detail-id]").first().click();
  assert.ok(await page.locator("#tool-dialog").evaluate((node) => node.open));
  assert.ok(await page.locator("body").evaluate((node) => node.classList.contains("is-locked")));
  await page.keyboard.press("Escape");
  assert.ok(!(await page.locator("#tool-dialog").evaluate((node) => node.open)));
  assert.ok(!(await page.locator("body").evaluate((node) => node.classList.contains("is-locked"))));
  assert.deepEqual(errors, []);
  await context.close();
});

await run("收藏跨页面和刷新后保持", async () => {
  const { context, page, errors } = await openPage("/", { width: 390, height: 844 });
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("daily-ai-tools:")) localStorage.removeItem(key);
    }
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-favorite-id]").first().click();
  assert.equal(await page.locator("[data-header-favorite-count]").first().textContent(), "1");
  await page.goto(`${base}/favorites.html`, { waitUntil: "networkidle" });
  await page.waitForSelector("#favorites-grid .tool-card");
  assert.equal(await page.locator("#favorites-grid .tool-card").count(), 1);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("#favorites-grid .tool-card").count(), 1);
  assert.deepEqual(errors, []);
  await context.close();
});

await run("分享弹窗提供完整操作", async () => {
  const { context, page, errors } = await openPage("/", { width: 430, height: 844 });
  await page.waitForSelector("[data-share-id]");
  await page.locator("[data-share-id]").first().click();
  assert.ok(await page.locator("#share-dialog").evaluate((node) => node.open));
  for (const action of ["copy-link", "copy-intro", "x", "telegram", "native"]) {
    assert.equal(await page.locator(`[data-share-action="${action}"]`).count(), 1);
  }
  await page.locator('[data-share-action="close"]').click();
  assert.ok(!(await page.locator("#share-dialog").evaluate((node) => node.open)));
  assert.deepEqual(errors, []);
  await context.close();
});

await run("网络失败使用最近成功缓存，不会无限加载", async () => {
  const { context, page, errors } = await openPage("/", { width: 390, height: 844 });
  await page.waitForSelector("#today-grid .tool-card");
  await page.route("**/data/daily.json*", (route) => route.abort("failed"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#today-grid .tool-card", { timeout: 10_000 });
  assert.equal(await page.locator("#today-grid .tool-card").count(), 5);
  assert.match(await page.locator("[data-data-health]").textContent(), /缓存|最近/);
  assert.equal(await page.locator(".skeleton-card").count(), 0);
  assert.deepEqual(errors.filter((item) => !item.includes("[data]") && !item.includes("ERR_FAILED")), []);
  await context.close();
});

await run("空缓存且请求失败显示可重试错误", async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route("**/data/daily.json*", (route) => route.abort("failed"));
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-retry]", { timeout: 10_000 });
  assert.equal(await page.locator(".skeleton-card").count(), 0);
  assert.match(await page.locator("#today-grid").textContent(), /加载失败|重试/);
  await context.close();
});

await run("核心无障碍与外链安全", async () => {
  const { context, page, errors } = await openPage("/", { width: 1366, height: 900 });
  await page.waitForSelector("#today-grid .tool-card");
  const audit = await page.evaluate(() => ({
    namelessButtons: [...document.querySelectorAll("button")].filter((node) => {
      const name = node.getAttribute("aria-label") || node.textContent?.trim() || node.getAttribute("title");
      return !name;
    }).length,
    imagesWithoutAlt: [...document.querySelectorAll("img")].filter((node) => !node.hasAttribute("alt")).length,
    unsafeBlankLinks: [...document.querySelectorAll('a[target="_blank"]')].filter((node) => {
      const rel = node.getAttribute("rel") || "";
      return !rel.includes("noopener") || !rel.includes("noreferrer");
    }).length,
    mainLabel: document.querySelector("main")?.id,
  }));
  assert.deepEqual(audit, { namelessButtons: 0, imagesWithoutAlt: 0, unsafeBlankLinks: 0, mainLabel: "main" });
  await page.locator("[data-theme-toggle]").focus();
  assert.notEqual(await page.locator("[data-theme-toggle]").evaluate((node) => getComputedStyle(node).outlineStyle), "none");
  assert.deepEqual(errors, []);
  await context.close();
});

await run("SEO 元数据和静态当日内容", async () => {
  const { context, page, errors } = await openPage("/", { width: 1366, height: 900 });
  assert.match(await page.title(), /Daily AI Tools/);
  assert.ok(await page.locator('meta[name="description"]').getAttribute("content"));
  assert.ok(await page.locator('link[rel="canonical"]').getAttribute("href"));
  assert.ok(await page.locator('meta[property="og:title"]').getAttribute("content"));
  assert.equal(await page.locator('script[type="application/ld+json"]').count(), 1);
  const source = await page.locator("html").evaluate(() => document.documentElement.outerHTML);
  assert.match(source, /open-code-review/);
  assert.deepEqual(errors, []);
  await context.close();
});

await browser.close();
for (const result of results) console.log(result);
if (failures.length) {
  console.error("\nFailures:\n" + failures.join("\n\n"));
  process.exit(1);
}
console.log(`\n${results.length} browser checks passed.`);
