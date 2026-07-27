# Daily AI Tools

**每日 AI 工具发现**：每天从 GitHub Trending、Product Hunt 和 Hugging Face
筛选 5 个真正值得关注的 AI 工具，用中文说明它是什么、适合谁、是否免费或开源，
以及是否具有商业价值。

- 网站：[wuc093855-coder.github.io/daily-ai-tool-discovery](https://wuc093855-coder.github.io/daily-ai-tool-discovery/)
- 自动更新：每天北京时间 **08:30**
- 运行方式：原生 HTML、CSS、JavaScript + Python 标准库
- 数据原则：不虚构 Star、价格和许可证；缺失字段使用 `null` 并在页面隐藏

## 产品功能

- 首页第一屏直接呈现今日精选和实时数据
- 第 1 名重点卡片、第 2–5 名响应式网格
- 工具库支持中英文即时搜索、组合筛选、四种排序和网格/列表视图
- 站内详情弹窗、相似工具、评分维度和商业价值说明
- 无登录收藏系统，收藏、主题、筛选和视图均保存在浏览器本地
- 复制链接、复制简介、X、Telegram 和系统原生分享
- 深色/浅色主题、移动端筛选抽屉、键盘快捷键和无障碍焦点状态
- 请求超时、重试、错误提示、最近成功数据回退，不会无限 Loading
- RSS、Sitemap、Manifest、Open Graph、JSON-LD 和静态当日工具内容

## 页面

| 路径 | 内容 |
| --- | --- |
| `/` | 今日精选、分类、本周趋势、最近更新、工作原理 |
| `/tools.html` | 完整工具库、搜索、筛选和排序 |
| `/favorites.html` | 浏览器本地收藏 |
| `/about.html` | 数据来源、评分规则、免责声明 |

## 项目结构

```text
.
├── .github/workflows/daily-update.yml
├── docs/
│   ├── assets/
│   │   ├── css/                 # 设计变量、基础、组件、响应式样式
│   │   ├── js/                  # 数据、筛选、收藏、分享、主题和页面模块
│   │   ├── icons/
│   │   └── images/
│   ├── data/
│   │   ├── daily.json           # v2 主数据，最多保留 90 天
│   │   ├── stats.json
│   │   └── categories.json
│   ├── index.html
│   ├── tools.html
│   ├── favorites.html
│   ├── about.html
│   ├── feed.xml
│   └── sitemap.xml
├── scripts/
│   ├── update_tools.py          # 采集、去重、评分和中文摘要
│   └── site_builder.py          # 迁移、校验和静态产物生成
└── tests/
    ├── test_update_tools.py
    └── frontend.test.mjs
```

## 本地运行与测试

需要 Python 3.11+ 和 Node.js 20+，没有第三方运行依赖。

```bash
python -m unittest discover -s tests -p "test_*.py"
node --test tests/frontend.test.mjs
python scripts/site_builder.py --validate-only
python -m http.server 8000 --directory docs
```

打开 `http://localhost:8000/`。如需采集一次真实数据：

```bash
python scripts/update_tools.py
```

不提供 `GITHUB_TOKEN` 也可以运行；提供后可提高 GitHub API 限额，并补充能够核实的
Star、许可证、头像和更新时间。不要把 Token 写入仓库。

## 自动化

`.github/workflows/daily-update.yml` 在每天 `00:30 UTC`（北京时间 08:30）运行，也支持
手动触发。流程会：

1. 运行 Python 和前端逻辑测试；
2. 迁移并校验历史数据；
3. 分别采集三个来源，单一来源失败时继续；
4. 生成统计数据、静态首页、RSS 和 Sitemap；
5. 仅在内容变化时提交；
6. 部署到 GitHub Pages。

工作流设置了并发锁和超时。若部分来源失败，会记录失败来源并优先使用历史有效数据；
只有所有来源都失败且没有可用回退时才终止更新。

## 数据与评分

`daily.json` 使用带 `schema_version` 的 v2 数据结构，并兼容旧历史。工具以官方 URL 或
仓库 URL 去重，最多保存最近 90 天。站内综合评分用于同一天候选项的横向比较：

- 实用性 30%
- 热度 25%
- 新鲜度 20%
- 产品完整度 15%
- 商业价值 10%

它不是绝对质量评价。评分权重位于 `scripts/site_builder.py` 的 `SCORING_CONFIG`；
采集和分数计算位于 `scripts/update_tools.py`。

## 常见修改

- 调整更新时间：修改 `.github/workflows/daily-update.yml` 的 cron（使用 UTC）
- 调整筛选/分类：修改 `scripts/update_tools.py`
- 调整评分权重：修改 `scripts/site_builder.py`
- 调整设计系统：修改 `docs/assets/css/variables.css`
- 调整卡片和详情：修改 `docs/assets/js/ui.js`
- 修改首页结构：修改 `docs/index.html`

手动立即更新：进入仓库 **Actions → 每日更新、校验并部署 → Run workflow**。

## 免责声明

工具价格、许可证、商用权限和功能可能发生变化，正式使用前请以原项目页面为准。
本站只保存公开来源的摘要与链接，收藏数据仅存储在访问者自己的浏览器中。

## License

[MIT](LICENSE)
