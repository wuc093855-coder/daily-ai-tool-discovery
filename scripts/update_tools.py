#!/usr/bin/env python3
"""Collect, rank, and publish five noteworthy AI tools.

The collector intentionally uses public, key-free endpoints:
- GitHub Trending HTML
- Product Hunt's official RSS feed
- Hugging Face's public Hub API
"""

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

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "docs" / "data" / "daily.json"
TIMEZONE = ZoneInfo("Asia/Shanghai")
REQUEST_TIMEOUT = 25
USER_AGENT = (
    "DailyAIToolDiscovery/1.0 "
    "(+https://github.com/wuc093855-coder/daily-ai-tool-discovery)"
)

SOURCE_LABELS = {
    "github": "GitHub Trending",
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

CATEGORY_RULES: list[tuple[str, set[str]]] = [
    ("编程开发", {"code", "coding", "developer", "github", "repository", "debug", "ide", "sdk", "api", "devops", "sql"}),
    ("图像设计", {"image", "photo", "design", "diffusion", "illustration", "visual", "3d", "avatar", "logo"}),
    ("视频创作", {"video", "film", "movie", "animation", "subtitle", "shorts", "youtube"}),
    ("音频语音", {"audio", "voice", "speech", "music", "podcast", "transcription", "tts", "asr"}),
    ("智能体", {"agent", "agentic", "multi-agent", "autonomous", "assistant", "copilot"}),
    ("搜索知识", {"search", "rag", "knowledge", "research", "browser", "retrieval", "document", "pdf"}),
    ("效率办公", {"productivity", "meeting", "email", "calendar", "note", "workflow", "automation", "office"}),
    ("数据分析", {"data", "analytics", "chart", "database", "spreadsheet", "business intelligence", "dataset"}),
    ("模型与推理", {"model", "llm", "transformer", "inference", "embedding", "fine-tune", "finetune", "benchmark"}),
]

CATEGORY_CONTENT = {
    "编程开发": {
        "focus": "AI 编程与开发提效",
        "features": ["辅助生成、理解或重构代码", "融入常见开发流程", "减少重复开发与排错时间"],
        "audience": "开发者、独立黑客、技术团队和正在学习编程的人",
        "money": "可用于更快交付网站、自动化脚本或客户定制开发服务",
    },
    "图像设计": {
        "focus": "AI 图像生成与视觉设计",
        "features": ["生成或编辑视觉素材", "加快创意方案迭代", "降低设计内容的制作门槛"],
        "audience": "设计师、自媒体创作者、电商从业者和营销团队",
        "money": "可用于制作电商图、社媒素材、品牌视觉或接单服务",
    },
    "视频创作": {
        "focus": "AI 视频生成与内容制作",
        "features": ["辅助生成或处理视频内容", "缩短剪辑与包装流程", "支持更高频的内容产出"],
        "audience": "短视频创作者、营销人员、教育从业者和视频团队",
        "money": "可用于短视频代制作、广告素材、课程内容或账号运营",
    },
    "音频语音": {
        "focus": "AI 音频、语音与音乐处理",
        "features": ["处理语音或音频内容", "支持转写、生成或增强场景", "降低音频制作的时间成本"],
        "audience": "播客主、视频创作者、配音从业者和内容团队",
        "money": "可用于转写、配音、播客后期或音频内容服务",
    },
    "智能体": {
        "focus": "AI 智能体与任务执行",
        "features": ["把复杂目标拆解为可执行步骤", "连接工具完成多阶段任务", "减少人工重复操作"],
        "audience": "独立开发者、运营人员、创业团队和自动化爱好者",
        "money": "可用于搭建行业智能体、自动化工作流或企业定制服务",
    },
    "搜索知识": {
        "focus": "AI 搜索、研究与知识管理",
        "features": ["检索并整理分散信息", "对文档或知识库进行问答", "提高研究与阅读效率"],
        "audience": "研究人员、学生、知识工作者和咨询团队",
        "money": "可用于报告研究、知识库搭建、资料整理或咨询交付",
    },
    "效率办公": {
        "focus": "AI 办公效率与流程自动化",
        "features": ["自动处理重复办公任务", "整合常用信息与工作流程", "提升个人或团队协作效率"],
        "audience": "职场人士、运营人员、小团队和自由职业者",
        "money": "可用于流程代搭建、运营服务、模板产品或效率咨询",
    },
    "数据分析": {
        "focus": "AI 数据处理与分析",
        "features": ["辅助清洗、理解或分析数据", "生成可读的洞察与结果", "缩短从数据到决策的路径"],
        "audience": "分析师、产品经理、研究人员和中小企业经营者",
        "money": "可用于数据报告、商业分析、看板搭建或咨询服务",
    },
    "模型与推理": {
        "focus": "AI 模型、推理与应用构建",
        "features": ["提供可复用的模型或推理能力", "支持集成到二次开发项目", "帮助快速验证 AI 应用想法"],
        "audience": "AI 开发者、研究人员、创业团队和技术爱好者",
        "money": "可作为应用底座，开发垂直工具、API 服务或企业解决方案",
    },
    "综合工具": {
        "focus": "AI 应用与效率提升",
        "features": ["利用 AI 简化特定任务", "提供可快速上手的工作方式", "帮助降低时间或人力成本"],
        "audience": "AI 爱好者、内容创作者、自由职业者和小团队",
        "money": "可用于提升接单效率、制作数字产品或探索垂直服务",
    },
}

MONETIZATION_KEYWORDS = {
    "content", "marketing", "sales", "ecommerce", "e-commerce", "video", "image",
    "design", "code", "website", "automation", "seo", "social", "business",
    "analytics", "voice", "music", "creator", "workflow", "customer",
}


@dataclass
class Candidate:
    name: str
    url: str
    source: str
    description: str = ""
    score: float = 0
    published_at: str = ""
    is_open_source: bool = False
    metrics: dict[str, Any] = field(default_factory=dict)
    tags: list[str] = field(default_factory=list)
    source_rank: int = 0


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    value = re.sub(r"<[^>]+>", " ", html.unescape(str(value)))
    return re.sub(r"\s+", " ", value).strip()


def safe_int(value: Any) -> int:
    if isinstance(value, (int, float)):
        return int(value)
    match = re.search(r"[\d,.]+", str(value or ""))
    return int(match.group(0).replace(",", "").replace(".", "")) if match else 0


def normalized_blob(candidate: Candidate) -> str:
    return " ".join((candidate.name, candidate.description, " ".join(candidate.tags))).lower()


def ai_relevance(candidate: Candidate) -> float:
    blob = normalized_blob(candidate)
    hits = sum(1 for keyword in AI_KEYWORDS if keyword in blob)
    if candidate.source == "huggingface":
        hits += 2
    return min(24.0, hits * 5.0)


def monetization_score(candidate: Candidate) -> float:
    blob = normalized_blob(candidate)
    hits = sum(1 for keyword in MONETIZATION_KEYWORDS if keyword in blob)
    return min(10.0, hits * 2.0)


def recency_score(published_at: str) -> float:
    if not published_at:
        return 5.0
    try:
        dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        age_hours = max(0, (datetime.now(timezone.utc) - dt).total_seconds() / 3600)
        return max(0.0, 14.0 - age_hours / 12)
    except ValueError:
        return 5.0


def score_candidate(candidate: Candidate) -> float:
    relevance = ai_relevance(candidate)
    if relevance <= 0:
        return 0

    rank_bonus = max(0, 16 - candidate.source_rank * 0.65)
    popularity = 0.0
    if candidate.source == "github":
        popularity = min(26.0, math.log1p(candidate.metrics.get("stars_today", 0)) * 3.8)
        popularity += min(8.0, math.log1p(candidate.metrics.get("stars", 0)) * 0.7)
    elif candidate.source == "producthunt":
        popularity = rank_bonus + 6
    else:
        popularity = min(20.0, candidate.metrics.get("trending_score", 0) * 2.5)
        popularity += min(8.0, math.log1p(candidate.metrics.get("likes", 0)) * 1.2)

    score = (
        22
        + relevance
        + popularity
        + recency_score(candidate.published_at)
        + monetization_score(candidate)
        + rank_bonus * 0.35
    )
    return round(min(100.0, score), 1)


class Response:
    def __init__(self, content: bytes):
        self.content = content
        self.text = content.decode("utf-8", errors="replace")

    def json(self) -> Any:
        return json.loads(self.text)


class HttpClient:
    def __init__(self, token: str = ""):
        self.headers = {
            "User-Agent": USER_AGENT,
            "Accept-Language": "en-US,en;q=0.8",
        }
        if token:
            self.headers["Authorization"] = f"Bearer {token}"

    def get(self, url: str) -> Response:
        request = Request(url, headers=self.headers)
        with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            return Response(response.read())


def collect_github(session: HttpClient) -> list[Candidate]:
    response = session.get("https://github.com/trending?since=daily")
    candidates: list[Candidate] = []
    articles = re.findall(
        r'<article\b[^>]*class="[^"]*\bBox-row\b[^"]*"[^>]*>(.*?)</article>',
        response.text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    for rank, article in enumerate(articles, start=1):
        anchor = re.search(
            r"<h2\b.*?<a\b[^>]*href=[\"']([^\"']+)[\"'][^>]*>",
            article,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if not anchor:
            continue
        repo_path = anchor.group(1).strip("/")
        description_match = re.search(
            r"<p\b[^>]*>(.*?)</p>",
            article,
            flags=re.IGNORECASE | re.DOTALL,
        )
        stars_match = re.search(
            r'href=["\'][^"\']+/stargazers["\'][^>]*>(.*?)</a>',
            article,
            flags=re.IGNORECASE | re.DOTALL,
        )
        stars_today_match = re.search(
            r"([\d,.]+)\s+stars?\s+today",
            clean_text(article),
            flags=re.IGNORECASE,
        )
        language_match = re.search(
            r'itemprop=["\']programmingLanguage["\'][^>]*>(.*?)<',
            article,
            flags=re.IGNORECASE | re.DOTALL,
        )
        description = clean_text(description_match.group(1) if description_match else "")
        language = clean_text(language_match.group(1) if language_match else "")
        candidate = Candidate(
            name=repo_path,
            url=f"https://github.com/{repo_path}",
            source="github",
            description=description,
            is_open_source=True,
            metrics={
                "stars": safe_int(stars_match.group(1) if stars_match else 0),
                "stars_today": safe_int(stars_today_match.group(1) if stars_today_match else 0),
                "language": language,
            },
            tags=[language],
            source_rank=rank,
        )
        candidate.score = score_candidate(candidate)
        if candidate.score:
            candidates.append(candidate)
    return candidates


def parse_feed_date(raw: str) -> str:
    try:
        return parsedate_to_datetime(raw).astimezone(timezone.utc).isoformat()
    except (TypeError, ValueError, OverflowError):
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError):
            return ""


def element_text(element: ElementTree.Element | None) -> str:
    return "".join(element.itertext()) if element is not None else ""


def first_child(parent: ElementTree.Element, names: tuple[str, ...]) -> ElementTree.Element | None:
    for child in parent:
        local_name = child.tag.rsplit("}", 1)[-1].lower()
        if local_name in names:
            return child
    return None


def collect_product_hunt(session: HttpClient) -> list[Candidate]:
    response = session.get("https://www.producthunt.com/feed")
    root = ElementTree.fromstring(response.content)
    entries = [
        element
        for element in root.iter()
        if element.tag.rsplit("}", 1)[-1].lower() in {"entry", "item"}
    ]
    candidates: list[Candidate] = []
    for rank, entry in enumerate(entries[:40], start=1):
        title_node = first_child(entry, ("title",))
        summary_node = first_child(entry, ("content", "summary", "description"))
        date_node = first_child(entry, ("published", "updated", "pubdate"))
        link_node = first_child(entry, ("link",))
        name = clean_text(element_text(title_node))
        description = clean_text(element_text(summary_node))
        url = ""
        if link_node is not None:
            url = link_node.attrib.get("href") or clean_text(element_text(link_node))
        if not name or not url:
            continue
        candidate = Candidate(
            name=name,
            url=url,
            source="producthunt",
            description=description,
            published_at=parse_feed_date(element_text(date_node)),
            is_open_source="open source" in description.lower(),
            source_rank=rank,
        )
        candidate.score = score_candidate(candidate)
        if candidate.score:
            candidates.append(candidate)
    return candidates


def hf_candidates_from_payload(payload: Iterable[dict[str, Any]], kind: str) -> list[Candidate]:
    candidates: list[Candidate] = []
    for rank, item in enumerate(payload, start=1):
        repo_id = item.get("id") or item.get("modelId") or ""
        if not repo_id:
            continue
        tags = [str(tag) for tag in item.get("tags", []) if tag]
        card_data = item.get("cardData") or {}
        description = clean_text(
            card_data.get("short_description")
            or card_data.get("description")
            or " ".join(tags[:8])
        )
        gated = bool(item.get("gated"))
        candidate = Candidate(
            name=repo_id,
            url=f"https://huggingface.co/{'spaces/' if kind == 'space' else ''}{repo_id}",
            source="huggingface",
            description=description,
            published_at=item.get("createdAt") or item.get("lastModified") or "",
            is_open_source=not gated,
            metrics={
                "likes": safe_int(item.get("likes")),
                "downloads": safe_int(item.get("downloads")),
                "trending_score": float(item.get("trendingScore") or 0),
                "kind": kind,
            },
            tags=tags,
            source_rank=rank,
        )
        candidate.score = score_candidate(candidate)
        if candidate.score:
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
        payload = session.get(url).json()
        candidates.extend(hf_candidates_from_payload(payload, kind))
    deduped: dict[str, Candidate] = {}
    for candidate in candidates:
        current = deduped.get(candidate.url)
        if not current or candidate.score > current.score:
            deduped[candidate.url] = candidate
    return list(deduped.values())


def infer_category(text: str) -> str:
    blob = text.lower()
    best_category = "综合工具"
    best_hits = 0
    for category, keywords in CATEGORY_RULES:
        hits = sum(1 for keyword in keywords if keyword in blob)
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

    if candidate.is_open_source:
        pricing = "开源可用；具体许可证、托管与模型调用成本请查看原项目说明。"
    elif "free" in normalized_blob(candidate):
        pricing = "提供免费入口或免费额度；高级功能是否收费以官网当前定价为准。"
    else:
        pricing = "是否免费需查看官网当前定价；新产品通常可能提供试用或基础额度。"

    side_hustle_potential = monetization_score(candidate) >= 2 or category != "模型与推理"
    side_hustle = (
        f"可以。{content['money']}；商用前请确认许可证、隐私和平台条款。"
        if side_hustle_potential
        else f"可以作为技术底座。{content['money']}，但需要一定开发与部署能力。"
    )
    name = candidate.name.split("/")[-1]
    return {
        "category": category,
        "one_liner": f"{name} 是一款聚焦于{content['focus']}的{kind}，适合用来提升产出效率或快速验证想法。",
        "main_features": content["features"],
        "pricing": pricing,
        "best_for": content["audience"],
        "side_hustle": side_hustle,
        "side_hustle_potential": side_hustle_potential,
    }


def select_top_five(candidates: list[Candidate]) -> list[Candidate]:
    deduped: dict[str, Candidate] = {}
    for candidate in candidates:
        key = re.sub(r"[^a-z0-9]", "", candidate.name.lower())
        current = deduped.get(key)
        if not current or candidate.score > current.score:
            deduped[key] = candidate

    ranked = sorted(deduped.values(), key=lambda item: item.score, reverse=True)
    selected: list[Candidate] = []
    source_counts = {source: 0 for source in SOURCE_LABELS}

    # First pass: guarantee one useful item from every available source.
    for source in SOURCE_LABELS:
        item = next((entry for entry in ranked if entry.source == source), None)
        if item:
            selected.append(item)
            source_counts[source] += 1

    # Second pass: cap each source at two until diversity has been achieved.
    for item in ranked:
        if len(selected) >= 5:
            break
        if item in selected or source_counts[item.source] >= 2:
            continue
        selected.append(item)
        source_counts[item.source] += 1

    # Final pass: fill any gap if one or more sources were unavailable.
    for item in ranked:
        if len(selected) >= 5:
            break
        if item not in selected:
            selected.append(item)

    return sorted(selected[:5], key=lambda item: item.score, reverse=True)


def serialize_tool(candidate: Candidate, rank: int) -> dict[str, Any]:
    profile = build_chinese_profile(candidate)
    return {
        "rank": rank,
        "name": candidate.name,
        **profile,
        "source": SOURCE_LABELS[candidate.source],
        "source_key": candidate.source,
        "url": candidate.url,
        "original_description": candidate.description,
        "attention_score": candidate.score,
        "metrics": candidate.metrics,
        "published_at": candidate.published_at,
    }


def load_data() -> dict[str, Any]:
    if not DATA_FILE.exists():
        return {
            "site": {
                "title": "每日 AI 工具发现",
                "timezone": "Asia/Shanghai",
                "update_time": "08:30",
            },
            "updated_at": "",
            "days": [],
        }
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def write_data(selected: list[Candidate], source_status: dict[str, Any]) -> None:
    now = datetime.now(TIMEZONE)
    date_key = now.date().isoformat()
    data = load_data()
    day = {
        "date": date_key,
        "display_date": now.strftime("%Y年%m月%d日"),
        "weekday": "星期" + "一二三四五六日"[now.weekday()],
        "tools": [serialize_tool(candidate, index) for index, candidate in enumerate(selected, start=1)],
        "source_status": source_status,
    }
    previous_days = [entry for entry in data.get("days", []) if entry.get("date") != date_key]
    data["days"] = [day, *previous_days][:90]
    data["updated_at"] = now.isoformat(timespec="seconds")
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    session = HttpClient(os.environ.get("GITHUB_TOKEN", ""))

    collectors = {
        "github": collect_github,
        "producthunt": collect_product_hunt,
        "huggingface": collect_hugging_face,
    }
    all_candidates: list[Candidate] = []
    source_status: dict[str, Any] = {}
    for source, collector in collectors.items():
        try:
            candidates = collector(session)
            all_candidates.extend(candidates)
            source_status[source] = {"ok": True, "candidates": len(candidates)}
            print(f"[ok] {SOURCE_LABELS[source]}: {len(candidates)} AI candidates")
        except Exception as exc:  # One source should not prevent the others from updating.
            source_status[source] = {"ok": False, "error": str(exc)[:240]}
            print(f"[warn] {SOURCE_LABELS[source]} failed: {exc}", file=sys.stderr)

    selected = select_top_five(all_candidates)
    if len(selected) < 5:
        print(
            f"Only {len(selected)} candidates were available; keeping the existing site unchanged.",
            file=sys.stderr,
        )
        return 1

    write_data(selected, source_status)
    print("\nToday's top five:")
    for index, item in enumerate(selected, start=1):
        print(f"{index}. {item.name} — {item.score:.1f} ({SOURCE_LABELS[item.source]})")
    print(f"\nUpdated {DATA_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
