# 每日 AI 工具发现助手

每天自动扫描 **GitHub Trending、Product Hunt、Hugging Face**，根据 AI
相关性、社区热度、发布时间和副业潜力，筛选出最值得关注的 5 个工具，并生成中文网页。

## 功能

- 每天北京时间 **08:30** 自动更新
- 每日精选 5 个工具，并保留最近 90 天历史
- 每个工具包含中文一句话介绍、主要功能、费用/开源情况、适合人群和副业建议
- GitHub Actions 自动采集、测试、提交和部署
- GitHub Pages 免费托管
- 不需要额外 API Key

## 数据来源与筛选

| 来源 | 采集方式 | 主要信号 |
| --- | --- | --- |
| GitHub Trending | 每日趋势公开页面 | 当日新增 Star、总 Star、排名 |
| Product Hunt | 官方 RSS Feed | 新鲜度、Feed 排名、AI 相关性 |
| Hugging Face | Hub 公共 API | Trending Score、Like、发布时间 |

评分会综合 AI 关键词相关性、平台热度、时效性和商业应用关键词。最终选择时会优先保证三个来源都有代表，单一来源通常不超过两个。

> 定价、许可证和商用条件可能随时变化，正式使用前请以原项目页面为准。

## 项目结构

```text
.
├── .github/workflows/daily-update.yml  # 定时更新与 Pages 部署
├── docs/
│   ├── assets/                         # 网页样式和脚本
│   ├── data/daily.json                 # 每日数据与历史
│   └── index.html                      # 中文首页
├── scripts/update_tools.py             # 采集、评分和中文内容生成
├── tests/test_update_tools.py          # 自动化测试
└── requirements.txt
```

## 本地运行

需要 Python 3.11 或更高版本。

```bash
python -m venv .venv
python -m unittest discover -s tests -v
python scripts/update_tools.py
python -m http.server 8000 --directory docs
```

然后打开 `http://localhost:8000`。

## 后续修改

### 修改每天更新时间

编辑 `.github/workflows/daily-update.yml` 中的 cron。GitHub Actions 使用 UTC：

```yaml
- cron: "30 0 * * *" # 北京时间每天 08:30
```

### 修改筛选逻辑

编辑 `scripts/update_tools.py`：

- `AI_KEYWORDS`：决定哪些项目与 AI 相关
- `CATEGORY_RULES`：决定工具分类
- `score_candidate()`：调整关注度评分权重
- `select_top_five()`：调整来源配额

### 修改中文介绍模板

编辑 `scripts/update_tools.py` 中的 `CATEGORY_CONTENT` 和
`build_chinese_profile()`。

### 修改网页样式

- 页面结构：`docs/index.html`
- 视觉样式：`docs/assets/styles.css`
- 页面交互：`docs/assets/app.js`

### 手动立即更新

进入仓库的 **Actions → 每日更新并部署 → Run workflow**。

## License

[MIT](LICENSE)
