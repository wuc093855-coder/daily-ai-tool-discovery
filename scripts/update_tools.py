#!/usr/bin/env python3
"""Collect, score, enrich, and publish five noteworthy AI tools."""

from __future__ import annotations

import html
import json
import math
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any, Iterable
from urllib.request import Request, urlopen
from xml.etree import ElementTree
from zoneinfo import ZoneInfo

try:
    from scripts.site_builder import DATA_FILE, SCORE_CONFIG, build_all, catalog_from_days, migrate_data
except ModuleNotFoundError:  # Supports `python scripts/update_tools.py`.
    from site_builder import DATA_FILE, SCORE_CONFIG, build_all, catalog_from_days, migrate_data


ROOT = Path(__file__).resolve().parents[1]
TIMEZONE = ZoneInfo("Asia/Shanghai")
REQUEST_TIMEOUT = 25
USER_AGENT = "DailyAIToolDiscovery/2.0 (+https://github.com/wuc093855-coder/daily-ai-tool-discovery)"

SOURCE_LABELS = {
    "github": "GitHub",
    "producthunt": "Product Hunt",
    "huggingface": "Hugging Face",
}

AI_KEYWORDS = {
    "ai", "artificial intelligence", "llm", "language model", "gpt", "agent",
    "agentic", "rag", "embedding", "transformer", "diffusion", "machine learning",
    "deep learning", "computer vision", "vision model", "speech", "voice",
    "text-to-image", "text to image", "generative", "copilot", "prompt",
    "inference", "multimodal", "automation", "chatbot", "ocr", "vibe coding",
}

MONETIZATION_KEYWORDS = {
    "content", "marketing", "sales", "ecommerce", "e-commerce", "video", "image",
    "design", "code", "website", "automation", "seo", "social", "business",
    "analytics", "voice", "music", "creator", "workflow", "customer",
}

CATEGORY_RULES: list[tuple[str, set[str]]] = [
    ("AI Agent", {"agent", "agentic", "multi-agent", "autonomous", "assistant", "copilot"}),
    ("编程开发", {"code", "coding", "developer", "github", "repository", "debug", "ide", "sdk", "api", "devops", "sql"}),
    ("图像生成", {"image", "photo", "design", "diffusion", "illustration", "visual", "3d", "avatar", "logo"}),
    ("视频生成", {"video", "film", "movie", "animation", "subtitle", "shorts", "youtube"}),
    ("音频工具", {"audio", "voice", "speech", "music", "podcast", "transcription", "tts", "asr"}),
    ("搜索研究", {"search", "rag", "knowledge", "research", "browser", "retrieval", "document", "pdf"}),
    ("写作办公", {"writing", "productivity", "meeting", "email", "calendar", "note", "office"}),
    ("数据分析", {"data", "analytics", "chart", "database", "spreadsheet", "business intelligence", "dataset"}),
    ("商业与营销", {"marketing", "sales", "seo", "ecommerce", "customer", "growth", "advertising"}),
    ("本地工具", {"local", "offline", "desktop", "on-device", "self-hosted", "self hosted"}),
    ("开源模型", {"model", "llm", "transformer", "inference", "embedding", "fine-tune", "finetune", "benchmark"}),
    ("自动化", {"workflow", "automation", "orchestration", "integration", "no-code"}),
]

CATEGORY_CONTENT = {
    "AI Agent": {
        "focus": "AI 智能体与任务执行",
        "features": ["把复杂目标拆解为可执行步骤", "连接工具完成多阶段任务", "减少人工重复操作"],
        "audience": "独立开发者、运营人员、创业团队和自动化爱好者",
        "use_cases": ["搭建垂直任务智能体", "自动执行多步骤工作流", "验证 Agent 产品想法"],
        "money": ["为企业搭建行业智能体", "交付自动化工作流", "封装垂直场景服务"],
    },
    "编程开发": {
        "focus": "AI 编程与开发提效",
        "features": ["辅助生成、理解或重构代码", "融入常见开发流程", "减少重复开发与排错时间"],
        "audience": "开发者、独立黑客、技术团队和正在学习编程的人",
        "use_cases": ["代码生成与审查", "快速搭建原型", "开发流程自动化"],
        "money": ["更快交付网站或应用", "提供自动化脚本服务", "承接客户定制开发"],
    },
    "图像生成": {
        "focus": "AI 图像生成与视觉设计",
        "features": ["生成或编辑视觉素材", "加快创意方案迭代", "降低设计内容的制作门槛"],
        "audience": "设计师、自媒体创作者、电商从业者和营销团队",
        "use_cases": ["制作电商与社媒素材", "生成创意概念图", "辅助品牌视觉探索"],
        "money": ["制作电商图与社媒素材", "提供视觉设计服务", "生产数字素材产品"],
    },
    "视频生成": {
        "focus": "AI 视频生成与内容制作",
        "features": ["辅助生成或处理视频内容", "缩短剪辑与包装流程", "支持更高频的内容产出"],
        "audience": "短视频创作者、营销人员、教育从业者和视频团队",
        "use_cases": ["短视频批量生产", "广告与课程素材制作", "视频后期自动化"],
        "money": ["提供短视频代制作", "生产广告素材", "辅助账号内容运营"],
    },
    "音频工具": {
        "focus": "AI 音频、语音与音乐处理",
        "features": ["处理语音或音频内容", "支持转写、生成或增强场景", "降低音频制作的时间成本"],
        "audience": "播客主、视频创作者、配音从业者和内容团队",
        "use_cases": ["语音转写与字幕", "配音和音频增强", "播客内容制作"],
        "money": ["提供转写与配音服务", "承接播客后期", "制作音频内容产品"],
    },
    "搜索研究": {
        "focus": "AI 搜索、研究与知识管理",
        "features": ["检索并整理分散信息", "对文档或知识库进行问答", "提高研究与阅读效率"],
        "audience": "研究人员、学生、知识工作者和咨询团队",
        "use_cases": ["行业与竞品研究", "私有知识库问答", "长文档快速理解"],
        "money": ["交付研究报告", "搭建企业知识库", "提供资料整理服务"],
    },
    "写作办公": {
        "focus": "AI 写作、办公与生产力",
        "features": ["自动处理重复办公任务", "辅助整理和生成文本内容", "提升个人或团队协作效率"],
        "audience": "职场人士、内容运营、小团队和自由职业者",
        "use_cases": ["文案和报告写作", "会议与邮件整理", "日常办公提效"],
        "money": ["提供内容代写与编辑", "售卖办公模板", "交付效率咨询服务"],
    },
    "数据分析": {
        "focus": "AI 数据处理与分析",
        "features": ["辅助清洗、理解或分析数据", "生成可读的洞察与结果", "缩短从数据到决策的路径"],
        "audience": "分析师、产品经理、研究人员和中小企业经营者",
        "use_cases": ["业务数据分析", "报告与看板生成", "数据清洗和探索"],
        "money": ["交付数据报告", "搭建商业看板", "提供分析咨询"],
    },
    "商业与营销": {
        "focus": "AI 商业增长与营销",
        "features": ["辅助获客、销售或营销执行", "提升内容和触达效率", "支持业务增长实验"],
        "audience": "创业者、销售、市场团队和电商经营者",
        "use_cases": ["营销内容生成", "销售线索处理", "增长流程自动化"],
        "money": ["提供营销代运营", "交付增长自动化", "开发垂直营销工具"],
    },
    "本地工具": {
        "focus": "本地运行与隐私友好的 AI 能力",
        "features": ["在本地或自托管环境运行", "减少敏感数据外传", "提供更高的可控性"],
        "audience": "重视隐私的个人用户、开发者和企业技术团队",
        "use_cases": ["私有数据处理", "离线 AI 工作流", "企业内网部署"],
        "money": ["提供私有化部署", "交付本地 AI 方案", "提供运维和集成服务"],
    },
    "开源模型": {
        "focus": "AI 模型、推理与应用构建",
        "features": ["提供可复用的模型或推理能力", "支持集成到二次开发项目", "帮助快速验证 AI 应用想法"],
        "audience": "AI 开发者、研究人员、创业团队和技术爱好者",
        "use_cases": ["模型能力评估", "构建垂直 AI 应用", "研究与二次开发"],
        "money": ["开发垂直工具", "封装模型 API 服务", "交付企业 AI 方案"],
    },
    "自动化": {
        "focus": "AI 工作流与流程自动化",
        "features": ["连接工具和数据完成重复流程", "减少人工操作与信息搬运", "支持快速搭建自动化方案"],
        "audience": "运营人员、独立开发者、小团队和效率爱好者",
        "use_cases": ["业务流程自动化", "跨工具信息同步", "低代码工作流搭建"],
        "money": ["提供流程代搭建", "交付运营自动化", "售卖工作流模板"],
    },
}


@dataclass
class Candidate:
    name: str
    url: str
    source: str
    description: str = ""
    score: float = 0
    score_components: dict[str, float] = field(default_factory=dict)
    published_at: str = ""
    updated_at: str = ""
    is_open_source: bool | None = None
    is_free: bool | None = None
    pricing_type: str | None = None
    license: str | None = None
    logo_url: str | None = None
    official_url: str | None = None
    metrics: dict[str, Any] = field(default_factory=dict)
    tags: list[str] = field(default_factory=list)
    source_rank: int = 0
    carried_forward: bool = False


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    value = re.sub(r"<[^>]+>", " ", html.unescape(str(value)))
    return re.sub(r"\s+", " ", value).strip()


def safe_int(value: Any) -> int:
    if isinstance(value, (int, float)):
        return int(value)
    text = clean_text(str(value or "")).lower().replace(",", "")
    match = re.search(r"(\d+(?:\.\d+)?)\s*([km]?)", text)
    if not match:
        return 0
    number = float(match.group(1))
    multiplier = {"k": 1_000, "m": 1_000_000}.get(match.group(2), 1)
    return int(number * multiplier)


def normalized_blob(candidate: Candidate) -> str:
    return " ".join((candidate.name, candidate.description, " ".join(candidate.tags))).lower()


def keyword_hits(blob: str, keywords: set[str]) -> int:
    return sum(1 for keyword in keywords if keyword in blob)


def parse_datetime(value: str) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
    except ValueError:
        return None


def score_components(candidate: Candidate) -> dict[str, float]:
    blob = normalized_blob(candidate)
    ai_hits = keyword_hits(blob, AI_KEYWORDS)
    money_hits = keyword_hits(blob, MONETIZATION_KEYWORDS)
    usefulness = min(98, 42 + ai_hits * 9 + min(18, len(candidate.description) / 14))

    if candidate.source == "github":
        heat = min(100, math.log1p(candidate.metrics.get("stars_today", 0)) * 11 + math.log1p(candidate.metrics.get("stars", 0)) * 2.4)
    elif candidate.source == "producthunt":
        heat = max(42, 96 - candidate.source_rank * 2.2)
    else:
        heat = min(100, candidate.metrics.get("trending_score", 0) * 0.48 + math.log1p(candidate.metrics.get("likes", 0)) * 7)

    published = parse_datetime(candidate.published_at)
    if published:
        age_hours = max(0, (datetime.now(timezone.utc) - published).total_seconds() / 3600)
        freshness = max(28, 100 - age_hours / 5)
    else:
        freshness = 78 if candidate.source in {"github", "producthunt"} else 55

    product = 38
    product += min(28, len(candidate.description) / 9)
    product += min(15, len(candidate.tags) * 3)
    product += 8 if candidate.url else 0
    product += 6 if candidate.is_open_source is not None else 0
    business = min(96, 36 + money_hits * 11 + (8 if candidate.source == "producthunt" else 0))
    return {
        "usefulness": round(min(100, usefulness), 1),
        "heat": round(min(100, heat), 1),
        "freshness": round(min(100, freshness), 1),
        "product": round(min(100, product), 1),
        "business": round(min(100, business), 1),
    }


def score_candidate(candidate: Candidate) -> float:
    if keyword_hits(normalized_blob(candidate), AI_KEYWORDS) == 0 and candidate.source != "huggingface":
        return 0
    components = score_components(candidate)
    candidate.score_components = components
    weights = SCORE_CONFIG["weights"]
    total = sum(components[key] * weights[key] for key in weights)
    candidate.score = round(min(98, max(0, total)), 1)
    return candidate.score


class Response:
    def __init__(self, content: bytes):
        self.content = content
        self.text = content.decode("utf-8", errors="replace")

    def json(self) -> Any:
        return json.loads(self.text)


class HttpClient:
    def __init__(self, token: str = ""):
        self.headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.8"}
        if token:
            self.headers["Authorization"] = f"Bearer {token}"

    def get(self, url: str, *, accept: str | None = None) -> Response:
        headers = dict(self.headers)
        if accept:
            headers["Accept"] = accept
        request = Request(url, headers=headers)
        with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            return Response(response.read())


def collect_github(session: HttpClient) -> list[Candidate]:
    response = session.get("https://github.com/trending?since=daily")
    articles = re.findall(
        r'<article\b[^>]*class="[^"]*\bBox-row\b[^"]*"[^>]*>(.*?)</article>',
        response.text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    candidates: list[Candidate] = []
    for rank, article in enumerate(articles, start=1):
        anchor = re.search(r"<h2\b.*?<a\b[^>]*href=[\"']([^\"']+)[\"']", article, re.I | re.S)
        if not anchor:
            continue
        repo_path = anchor.group(1).strip("/")
        description_match = re.search(r"<p\b[^>]*>(.*?)</p>", article, re.I | re.S)
        stars_match = re.search(r'href=["\'][^"\']+/stargazers["\'][^>]*>(.*?)</a>', article, re.I | re.S)
        today_match = re.search(r"([\d,.kKmM]+)\s+stars?\s+today", clean_text(article), re.I)
        language_match = re.search(r'itemprop=["\']programmingLanguage["\'][^>]*>(.*?)<', article, re.I | re.S)
        language = clean_text(language_match.group(1) if language_match else "")
        candidate = Candidate(
            name=repo_path,
            url=f"https://github.com/{repo_path}",
            source="github",
            description=clean_text(description_match.group(1) if description_match else ""),
            is_open_source=True,
            pricing_type="open_source",
            metrics={
                "stars": safe_int(stars_match.group(1) if stars_match else 0),
                "stars_today": safe_int(today_match.group(1) if today_match else 0),
                "language": language,
            },
            tags=[language] if language else [],
            source_rank=rank,
        )
        if score_candidate(candidate):
            candidates.append(candidate)
    return candidates


def parse_feed_date(raw: str) -> str:
    try:
        return parsedate_to_datetime(raw).astimezone(timezone.utc).isoformat()
    except (TypeError, ValueError, OverflowError):
        parsed = parse_datetime(raw)
        return parsed.isoformat() if parsed else ""


def element_text(element: ElementTree.Element | None) -> str:
    return "".join(element.itertext()) if element is not None else ""


def first_child(parent: ElementTree.Element, names: tuple[str, ...]) -> ElementTree.Element | None:
    for child in parent:
        if child.tag.rsplit("}", 1)[-1].lower() in names:
            return child
    return None


def collect_product_hunt(session: HttpClient) -> list[Candidate]:
    root = ElementTree.fromstring(session.get("https://www.producthunt.com/feed").content)
    entries = [element for element in root.iter() if element.tag.rsplit("}", 1)[-1].lower() in {"entry", "item"}]
    candidates: list[Candidate] = []
    for rank, entry in enumerate(entries[:40], start=1):
        title = clean_text(element_text(first_child(entry, ("title",))))
        description = clean_text(element_text(first_child(entry, ("content", "summary", "description"))))
        date_node = first_child(entry, ("published", "updated", "pubdate"))
        link_node = first_child(entry, ("link",))
        url = (link_node.attrib.get("href") or clean_text(element_text(link_node))) if link_node is not None else ""
        image_node = next((child for child in entry.iter() if child.tag.rsplit("}", 1)[-1].lower() in {"thumbnail", "image"}), None)
        logo_url = image_node.attrib.get("url") if image_node is not None else None
        if not title or not url:
            continue
        open_source = "open source" in description.lower()
        explicitly_free = bool(re.search(r"\bfree\b", description, re.I))
        candidate = Candidate(
            name=title,
            url=url,
            official_url=url,
            source="producthunt",
            description=description,
            published_at=parse_feed_date(element_text(date_node)),
            is_open_source=open_source if open_source else None,
            is_free=True if explicitly_free else None,
            pricing_type="free" if explicitly_free else ("open_source" if open_source else None),
            logo_url=logo_url,
            source_rank=rank,
        )
        if score_candidate(candidate):
            candidates.append(candidate)
    return candidates


def hf_candidates(payload: Iterable[dict[str, Any]], kind: str) -> list[Candidate]:
    candidates: list[Candidate] = []
    for rank, item in enumerate(payload, start=1):
        repo_id = item.get("id") or item.get("modelId") or ""
        if not repo_id:
            continue
        tags = [str(tag) for tag in item.get("tags", []) if tag]
        card = item.get("cardData") or {}
        description = clean_text(card.get("short_description") or card.get("description") or " ".join(tags[:8]))
        gated = bool(item.get("gated"))
        url = f"https://huggingface.co/{'spaces/' if kind == 'space' else ''}{repo_id}"
        candidate = Candidate(
            name=repo_id,
            url=url,
            source="huggingface",
            description=description,
            published_at=item.get("createdAt") or "",
            updated_at=item.get("lastModified") or "",
            is_open_source=False if gated else True,
            pricing_type=None if gated else "open_source",
            metrics={
                "likes": safe_int(item.get("likes")),
                "downloads": safe_int(item.get("downloads")),
                "trending_score": float(item.get("trendingScore") or 0),
                "kind": kind,
            },
            tags=tags,
            source_rank=rank,
        )
        if score_candidate(candidate):
            candidates.append(candidate)
    return candidates


def collect_hugging_face(session: HttpClient) -> list[Candidate]:
    queries = (
        ("https://huggingface.co/api/spaces?sort=trendingScore&direction=-1&limit=35&full=true", "space"),
        ("https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=35&full=true", "model"),
        ("https://huggingface.co/api/spaces?sort=createdAt&direction=-1&limit=25&full=true", "space"),
    )
    candidates: list[Candidate] = []
    for url, kind in queries:
        candidates.extend(hf_candidates(session.get(url).json(), kind))
    deduped: dict[str, Candidate] = {}
    for candidate in candidates:
        if candidate.url not in deduped or candidate.score > deduped[candidate.url].score:
            deduped[candidate.url] = candidate
    return list(deduped.values())


def infer_category(text: str) -> str:
    blob = text.lower()
    best_category = "自动化"
    best_hits = 0
    for category, keywords in CATEGORY_RULES:
        hits = keyword_hits(blob, keywords)
        if hits > best_hits:
            best_category, best_hits = category, hits
    return best_category


def build_chinese_profile(candidate: Candidate) -> dict[str, Any]:
    category = infer_category(normalized_blob(candidate))
    content = CATEGORY_CONTENT[category]
    kind = "开源项目" if candidate.is_open_source else "AI 产品"
    if candidate.source == "huggingface" and candidate.metrics.get("kind") == "model":
        kind = "AI 模型"
    elif candidate.source == "huggingface" and candidate.metrics.get("kind") == "space":
        kind = "AI 应用"
    name = candidate.name.split("/")[-1]
    tagline = f"{name} 是一款聚焦于{content['focus']}的{kind}，适合用来提升产出效率或快速验证想法。"
    return {
        "category": category,
        "tagline_zh": tagline,
        "description_zh": f"{tagline} 当前入选依据包括平台趋势、时效性、AI 相关度与实际应用潜力。",
        "core_features": content["features"],
        "suitable_for": content["audience"],
        "use_cases": content["use_cases"],
        "business_potential": f"具备实际商业应用空间。{content['money'][0]}；商用前请确认许可证、隐私和平台条款。",
        "monetization_ideas": content["money"],
    }


def select_top_five(candidates: list[Candidate]) -> list[Candidate]:
    deduped: dict[str, Candidate] = {}
    for candidate in candidates:
        key = re.sub(r"[^a-z0-9]", "", candidate.name.lower())
        if key not in deduped or candidate.score > deduped[key].score:
            deduped[key] = candidate
    ranked = sorted(deduped.values(), key=lambda item: item.score, reverse=True)
    selected: list[Candidate] = []
    source_counts = {source: 0 for source in SOURCE_LABELS}
    for source in SOURCE_LABELS:
        item = next((entry for entry in ranked if entry.source == source), None)
        if item:
            selected.append(item)
            source_counts[source] += 1
    for item in ranked:
        if len(selected) >= 5:
            break
        if item in selected or source_counts[item.source] >= 2:
            continue
        selected.append(item)
        source_counts[item.source] += 1
    for item in ranked:
        if len(selected) >= 5:
            break
        if item not in selected:
            selected.append(item)
    selected.sort(key=lambda item: item.score, reverse=True)
    for index in range(1, len(selected)):
        if selected[index - 1].score - selected[index].score < 1.2:
            selected[index].score = round(max(0, selected[index - 1].score - 1.2), 1)
    return selected[:5]


def enrich_github(candidate: Candidate, session: HttpClient) -> None:
    if candidate.source != "github":
        return
    try:
        repo = session.get(f"https://api.github.com/repos/{candidate.name}", accept="application/vnd.github+json").json()
        candidate.metrics["stars"] = safe_int(repo.get("stargazers_count"))
        candidate.license = (repo.get("license") or {}).get("spdx_id")
        if candidate.license == "NOASSERTION":
            candidate.license = None
        candidate.logo_url = (repo.get("owner") or {}).get("avatar_url")
        candidate.official_url = repo.get("homepage") or repo.get("html_url") or candidate.url
        candidate.updated_at = repo.get("updated_at") or candidate.updated_at
    except Exception as exc:
        print(f"[warn] GitHub metadata enrichment failed for {candidate.name}: {exc}", file=sys.stderr)


def candidate_from_tool(tool: dict[str, Any]) -> Candidate:
    candidate = Candidate(
        name=tool["original_name"],
        url=tool.get("source_url") or tool.get("official_url") or tool.get("repo_url"),
        source=tool["source_key"],
        description=tool.get("original_description") or tool.get("tagline_zh") or "",
        score=float(tool.get("score_total") or 0),
        score_components={
            "heat": tool.get("score_heat") or 0,
            "freshness": tool.get("score_freshness") or 0,
            "usefulness": tool.get("score_usefulness") or 0,
            "product": tool.get("score_product") or 0,
            "business": tool.get("score_business") or 0,
        },
        published_at=tool.get("published_at") or "",
        updated_at=tool.get("updated_at") or "",
        is_open_source=tool.get("is_open_source"),
        is_free=tool.get("is_free"),
        pricing_type=tool.get("pricing_type"),
        license=tool.get("license"),
        logo_url=tool.get("logo_url"),
        official_url=tool.get("official_url"),
        metrics={
            "stars": tool.get("stars"),
            "stars_today": tool.get("star_growth"),
            "likes": tool.get("likes"),
            "trending_score": tool.get("trending_score"),
        },
        tags=tool.get("tags") or [],
        carried_forward=True,
    )
    return candidate


def supplement_from_history(
    selected: list[Candidate],
    data: dict[str, Any],
    failed_sources: set[str],
) -> list[Candidate]:
    catalog = catalog_from_days(data.get("days", []))
    identities = {candidate.url.rstrip("/").lower() for candidate in selected}
    history = sorted(catalog, key=lambda tool: tool.get("score_total") or 0, reverse=True)
    for source in failed_sources:
        if any(candidate.source == source for candidate in selected):
            continue
        prior = next(
            (
                tool for tool in history
                if tool["source_key"] == source
                and str(tool.get("source_url") or "").rstrip("/").lower() not in identities
            ),
            None,
        )
        if prior:
            carried = candidate_from_tool(prior)
            if len(selected) >= 5:
                selected.pop()
            selected.append(carried)
            identities.add(carried.url.rstrip("/").lower())
    for tool in history:
        if len(selected) >= 5:
            break
        identity = str(tool.get("source_url") or "").rstrip("/").lower()
        if identity and identity not in identities:
            selected.append(candidate_from_tool(tool))
            identities.add(identity)
    selected.sort(key=lambda item: item.score, reverse=True)
    return selected[:5]


def serialize_tool(
    candidate: Candidate,
    rank: int,
    today: str,
    now_iso: str,
    previous: dict[str, Any] | None,
) -> dict[str, Any]:
    profile = build_chinese_profile(candidate)
    name = candidate.name.split("/")[-1]
    history = list(previous.get("score_history", [])) if previous else []
    history = [entry for entry in history if entry.get("date") != today]
    history.append({"date": today, "score": candidate.score})
    components = candidate.score_components
    source_url = candidate.url
    return {
        "id": previous.get("id") if previous else f"{candidate.source}-{re.sub(r'[^a-z0-9]+', '-', candidate.name.lower()).strip('-')[:80]}",
        "slug": previous.get("slug") if previous else re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:80],
        "name": name,
        "original_name": candidate.name,
        **profile,
        "original_description": candidate.description or None,
        "source": SOURCE_LABELS[candidate.source],
        "source_key": candidate.source,
        "source_url": source_url,
        "official_url": candidate.official_url or source_url,
        "repo_url": source_url if candidate.source == "github" else None,
        "logo_url": candidate.logo_url,
        "category": profile["category"],
        "tags": list(dict.fromkeys([profile["category"], *candidate.tags]))[:12],
        "pricing_type": candidate.pricing_type,
        "is_free": candidate.is_free,
        "is_open_source": candidate.is_open_source,
        "license": candidate.license,
        "stars": candidate.metrics.get("stars"),
        "star_growth": candidate.metrics.get("stars_today"),
        "likes": candidate.metrics.get("likes"),
        "trending_score": candidate.metrics.get("trending_score"),
        "published_at": candidate.published_at or None,
        "discovered_at": previous.get("discovered_at", today) if previous else today,
        "updated_at": candidate.updated_at or now_iso,
        "score_total": candidate.score,
        "score_heat": components.get("heat") or None,
        "score_freshness": components.get("freshness") or None,
        "score_usefulness": components.get("usefulness") or None,
        "score_product": components.get("product") or None,
        "score_business": components.get("business") or None,
        "score_history": history[-90:],
        "rank": rank,
        "carried_forward": candidate.carried_forward,
    }


def load_existing() -> dict[str, Any]:
    if not DATA_FILE.exists():
        return migrate_data({"days": [], "updated_at": ""})
    return migrate_data(json.loads(DATA_FILE.read_text(encoding="utf-8")))


def write_data(
    selected: list[Candidate],
    source_status: dict[str, Any],
    existing: dict[str, Any],
) -> None:
    now = datetime.now(TIMEZONE)
    today = now.date().isoformat()
    now_iso = now.isoformat(timespec="seconds")
    previous_catalog = catalog_from_days(existing["days"])
    previous_by_identity = {
        str(tool.get("repo_url") or tool.get("source_url") or tool.get("official_url")).rstrip("/").lower(): tool
        for tool in previous_catalog
    }
    tools = []
    for rank, candidate in enumerate(selected, start=1):
        identity = candidate.url.rstrip("/").lower()
        tools.append(serialize_tool(candidate, rank, today, now_iso, previous_by_identity.get(identity)))
    day = {
        "date": today,
        "display_date": now.strftime("%Y年%m月%d日"),
        "weekday": "星期" + "一二三四五六日"[now.weekday()],
        "updated_at": now_iso,
        "tools": tools,
        "source_status": source_status,
    }
    data = {
        **existing,
        "schema_version": 2,
        "scoring": SCORE_CONFIG,
        "updated_at": now_iso,
        "days": [day, *[item for item in existing["days"] if item["date"] != today]][:90],
    }
    build_all(data)


def main() -> int:
    session = HttpClient(os.environ.get("GITHUB_TOKEN", ""))
    collectors = {
        "github": collect_github,
        "producthunt": collect_product_hunt,
        "huggingface": collect_hugging_face,
    }
    all_candidates: list[Candidate] = []
    source_status: dict[str, Any] = {}
    successful_sources = 0
    for source, collector in collectors.items():
        try:
            candidates = collector(session)
            all_candidates.extend(candidates)
            source_status[source] = {"ok": True, "candidates": len(candidates)}
            successful_sources += 1
            print(f"[ok] {SOURCE_LABELS[source]}: {len(candidates)} AI candidates")
        except Exception as exc:
            source_status[source] = {"ok": False, "error": str(exc)[:240]}
            print(f"[warn] {SOURCE_LABELS[source]} failed: {exc}", file=sys.stderr)

    if successful_sources == 0:
        print("[error] all sources failed; existing site remains unchanged", file=sys.stderr)
        return 1

    existing = load_existing()
    selected = select_top_five(all_candidates)
    for candidate in selected:
        enrich_github(candidate, session)
    failed = {source for source, status in source_status.items() if not status["ok"]}
    selected = supplement_from_history(selected, existing, failed)
    if len(selected) < 5:
        print(f"[error] only {len(selected)} tools available after history fallback", file=sys.stderr)
        return 1

    write_data(selected, source_status, existing)
    print("\nToday's top five:")
    for index, item in enumerate(selected, start=1):
        suffix = " [carried]" if item.carried_forward else ""
        print(f"{index}. {item.name} - {item.score:.1f} ({SOURCE_LABELS[item.source]}){suffix}")
    print(f"\n[ok] updated {DATA_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
