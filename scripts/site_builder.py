#!/usr/bin/env python3
"""Migrate, validate, and build static artifacts from daily tool data."""

from __future__ import annotations

import argparse
import html
import json
import re
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
DATA_FILE = DOCS / "data" / "daily.json"
STATS_FILE = DOCS / "data" / "stats.json"
CATEGORIES_FILE = DOCS / "data" / "categories.json"
INDEX_FILE = DOCS / "index.html"
FEED_FILE = DOCS / "feed.xml"
SITEMAP_FILE = DOCS / "sitemap.xml"
SITE_URL = "https://wuc093855-coder.github.io/daily-ai-tool-discovery/"
SCHEMA_VERSION = 2

CATEGORY_ALIASES = {
    "智能体": "AI Agent",
    "图像设计": "图像生成",
    "视频创作": "视频生成",
    "音频语音": "音频工具",
    "效率办公": "写作办公",
    "搜索知识": "搜索研究",
    "模型与推理": "开源模型",
    "综合工具": "自动化",
}

CATEGORY_ORDER = [
    "AI Agent",
    "编程开发",
    "图像生成",
    "视频生成",
    "音频工具",
    "写作办公",
    "数据分析",
    "搜索研究",
    "自动化",
    "开源模型",
    "本地工具",
    "商业与营销",
]

SCORE_CONFIG = {
    "label": "站内综合评分",
    "disclaimer": "用于同日候选工具横向比较，不代表绝对质量。",
    "weights": {
        "usefulness": 0.30,
        "heat": 0.25,
        "freshness": 0.20,
        "product": 0.15,
        "business": 0.10,
    },
}


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^\w\u4e00-\u9fff]+", "-", value, flags=re.UNICODE)
    return value.strip("-")[:80] or "tool"


def list_value(value: Any) -> list[Any]:
    return [item for item in value if item] if isinstance(value, list) else []


def number_or_none(value: Any) -> float | int | None:
    if value in (None, ""):
        return None
    try:
        number = float(value)
        return int(number) if number.is_integer() else round(number, 2)
    except (TypeError, ValueError):
        return None


def bool_or_none(value: Any) -> bool | None:
    return value if isinstance(value, bool) else None


def normalize_category(value: str | None) -> str:
    category = value or "自动化"
    return CATEGORY_ALIASES.get(category, category)


def source_key(raw: dict[str, Any]) -> str:
    if raw.get("source_key"):
        return str(raw["source_key"])
    label = str(raw.get("source", "")).lower()
    if "github" in label:
        return "github"
    if "product" in label:
        return "producthunt"
    if "hugging" in label:
        return "huggingface"
    return "unknown"


def migrate_tool(raw: dict[str, Any], day_date: str) -> dict[str, Any]:
    key = source_key(raw)
    original_name = str(raw.get("original_name") or raw.get("name") or "Unnamed")
    name = str(raw.get("display_name") or original_name.split("/")[-1])
    metrics = raw.get("metrics") if isinstance(raw.get("metrics"), dict) else {}
    source_url = raw.get("source_url") or raw.get("url") or raw.get("official_url") or raw.get("repo_url")
    category = normalize_category(raw.get("category"))
    is_open_source = bool_or_none(raw.get("is_open_source"))
    pricing_type = raw.get("pricing_type") or ("open_source" if is_open_source is True else None)
    score_total = number_or_none(raw.get("score_total", raw.get("attention_score")))
    score_history = list_value(raw.get("score_history"))
    if score_total is not None and not score_history:
        score_history = [{"date": day_date, "score": score_total}]
    tags = list(dict.fromkeys([category, *list_value(raw.get("tags"))]))

    return {
        "id": raw.get("id") or f"{key}-{slugify(original_name)}",
        "slug": raw.get("slug") or slugify(name),
        "name": name,
        "original_name": original_name,
        "tagline_zh": raw.get("tagline_zh") or raw.get("one_liner") or "",
        "description_zh": raw.get("description_zh") or raw.get("one_liner") or "",
        "original_description": raw.get("original_description"),
        "source": raw.get("source") or key,
        "source_key": key,
        "source_url": source_url,
        "official_url": raw.get("official_url") or source_url,
        "repo_url": raw.get("repo_url") or (source_url if key == "github" else None),
        "logo_url": raw.get("logo_url"),
        "category": category,
        "tags": tags,
        "pricing_type": pricing_type,
        "is_free": bool_or_none(raw.get("is_free")),
        "is_open_source": is_open_source,
        "license": raw.get("license"),
        "stars": number_or_none(raw.get("stars", metrics.get("stars"))),
        "star_growth": number_or_none(raw.get("star_growth", metrics.get("stars_today"))),
        "likes": number_or_none(raw.get("likes", metrics.get("likes"))),
        "trending_score": number_or_none(raw.get("trending_score", metrics.get("trending_score"))),
        "published_at": raw.get("published_at"),
        "discovered_at": raw.get("discovered_at") or day_date,
        "updated_at": raw.get("updated_at"),
        "suitable_for": raw.get("suitable_for") or raw.get("best_for") or "",
        "core_features": list_value(raw.get("core_features") or raw.get("main_features")),
        "use_cases": list_value(raw.get("use_cases")),
        "pros": list_value(raw.get("pros")),
        "limitations": list_value(raw.get("limitations")),
        "business_potential": raw.get("business_potential") or raw.get("side_hustle") or "",
        "monetization_ideas": list_value(raw.get("monetization_ideas")),
        "score_total": score_total,
        "score_heat": number_or_none(raw.get("score_heat")),
        "score_freshness": number_or_none(raw.get("score_freshness")),
        "score_usefulness": number_or_none(raw.get("score_usefulness")),
        "score_product": number_or_none(raw.get("score_product")),
        "score_business": number_or_none(raw.get("score_business")),
        "score_history": score_history,
        "rank": number_or_none(raw.get("rank")),
        "carried_forward": bool(raw.get("carried_forward", False)),
    }


def migrate_data(raw: dict[str, Any]) -> dict[str, Any]:
    days: list[dict[str, Any]] = []
    for day in raw.get("days", []):
        day_date = str(day.get("date", ""))
        migrated_day = {
            **day,
            "date": day_date,
            "tools": [migrate_tool(tool, day_date) for tool in day.get("tools", [])],
        }
        days.append(migrated_day)
    days.sort(key=lambda item: item["date"], reverse=True)
    return {
        "schema_version": SCHEMA_VERSION,
        "site": {
            "title": "Daily AI Tools",
            "subtitle": "每日 AI 工具发现",
            "timezone": "Asia/Shanghai",
            "update_time": "08:30",
            **raw.get("site", {}),
            "title": "Daily AI Tools",
            "subtitle": "每日 AI 工具发现",
        },
        "scoring": raw.get("scoring") or SCORE_CONFIG,
        "updated_at": raw.get("updated_at", ""),
        "days": days[:90],
    }


def valid_url(value: Any) -> bool:
    if not value:
        return True
    parsed = urlparse(str(value))
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def validate_data(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if data.get("schema_version") != SCHEMA_VERSION:
        errors.append(f"schema_version must be {SCHEMA_VERSION}")
    if not isinstance(data.get("days"), list):
        return [*errors, "days must be a list"]
    for day_index, day in enumerate(data["days"]):
        try:
            date.fromisoformat(str(day.get("date")))
        except (TypeError, ValueError):
            errors.append(f"days[{day_index}].date is invalid")
        seen: set[str] = set()
        for tool_index, tool in enumerate(day.get("tools", [])):
            prefix = f"days[{day_index}].tools[{tool_index}]"
            for field in ("id", "name", "original_name", "source_key", "category"):
                if not tool.get(field):
                    errors.append(f"{prefix}.{field} is required")
            identity = str(tool.get("repo_url") or tool.get("official_url") or tool.get("source_url") or tool.get("id")).lower().rstrip("/")
            if identity in seen:
                errors.append(f"{prefix} is duplicated")
            seen.add(identity)
            for field in ("source_url", "official_url", "repo_url", "logo_url"):
                if not valid_url(tool.get(field)):
                    errors.append(f"{prefix}.{field} is not a valid URL")
            for field in (
                "score_total",
                "score_heat",
                "score_freshness",
                "score_usefulness",
                "score_product",
                "score_business",
            ):
                value = tool.get(field)
                if value is not None and not 0 <= float(value) <= 100:
                    errors.append(f"{prefix}.{field} must be between 0 and 100")
    return errors


def catalog_from_days(days: list[dict[str, Any]]) -> list[dict[str, Any]]:
    catalog: dict[str, dict[str, Any]] = {}
    for day in reversed(days):
        for tool in day.get("tools", []):
            identity = str(tool.get("repo_url") or tool.get("official_url") or tool.get("source_url") or tool["id"]).lower().rstrip("/")
            previous = catalog.get(identity, {})
            catalog[identity] = {
                **previous,
                **tool,
                "first_discovered_at": previous.get("first_discovered_at") or tool.get("discovered_at") or day["date"],
                "last_discovered_at": day["date"],
            }
    return list(catalog.values())


def build_stats(data: dict[str, Any]) -> dict[str, Any]:
    catalog = catalog_from_days(data["days"])
    latest = data["days"][0] if data["days"] else {"tools": [], "source_status": {}}
    category_counts = Counter(tool["category"] for tool in catalog)
    source_counts = Counter(tool["source"] for tool in catalog)
    known_open = [tool["is_open_source"] for tool in catalog if tool["is_open_source"] is not None]
    known_free = [tool["is_free"] for tool in catalog if tool["is_free"] is not None]
    scored = sorted(
        (tool for tool in catalog if tool["score_total"] is not None),
        key=lambda tool: tool["score_total"],
        reverse=True,
    )
    growth = sorted(
        (tool for tool in catalog if tool["star_growth"] is not None),
        key=lambda tool: tool["star_growth"],
        reverse=True,
    )
    return {
        "schema_version": 1,
        "generated_at": data.get("updated_at"),
        "history_sufficient": len(data["days"]) >= 2,
        "days": len(data["days"]),
        "total_tools": len(catalog),
        "today_tools": len(latest.get("tools", [])),
        "today_scanned": sum(
            int(status.get("candidates", 0))
            for status in latest.get("source_status", {}).values()
            if isinstance(status, dict)
        ),
        "category_counts": dict(category_counts),
        "source_counts": dict(source_counts),
        "open_source_ratio": round(sum(known_open) / len(known_open), 4) if known_open else None,
        "free_ratio": round(sum(known_free) / len(known_free), 4) if known_free else None,
        "top_scored": [{"id": tool["id"], "name": tool["name"], "score": tool["score_total"]} for tool in scored[:5]],
        "top_growth": [{"id": tool["id"], "name": tool["name"], "growth": tool["star_growth"]} for tool in growth[:5]],
    }


def build_categories(data: dict[str, Any]) -> dict[str, Any]:
    catalog = catalog_from_days(data["days"])
    counts = Counter(tool["category"] for tool in catalog)
    ordered = [*CATEGORY_ORDER, *sorted(category for category in counts if category not in CATEGORY_ORDER)]
    return {
        "schema_version": 1,
        "generated_at": data.get("updated_at"),
        "categories": [{"name": category, "count": counts.get(category, 0)} for category in ordered],
    }


def rss_xml(data: dict[str, Any]) -> str:
    rss = ElementTree.Element("rss", {"version": "2.0"})
    channel = ElementTree.SubElement(rss, "channel")
    for tag, text in (
        ("title", "Daily AI Tools｜每日 AI 工具发现"),
        ("link", SITE_URL),
        ("description", "每天筛选 5 个真正值得关注的 AI 工具。"),
        ("language", "zh-CN"),
        ("lastBuildDate", datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")),
    ):
        ElementTree.SubElement(channel, tag).text = text
    for day in data["days"][:14]:
        item = ElementTree.SubElement(channel, "item")
        names = "、".join(tool["name"] for tool in day["tools"])
        ElementTree.SubElement(item, "title").text = f"{day['date']} 每日 AI 工具精选"
        ElementTree.SubElement(item, "link").text = f"{SITE_URL}index.html#today"
        ElementTree.SubElement(item, "guid", {"isPermaLink": "false"}).text = f"daily-ai-tools-{day['date']}"
        ElementTree.SubElement(item, "description").text = f"今日精选：{names}"
        day_dt = datetime.fromisoformat(f"{day['date']}T00:30:00+00:00")
        ElementTree.SubElement(item, "pubDate").text = day_dt.strftime("%a, %d %b %Y %H:%M:%S +0000")
    ElementTree.indent(rss, space="  ")
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ElementTree.tostring(rss, encoding="unicode") + "\n"


def sitemap_xml(data: dict[str, Any]) -> str:
    namespace = "http://www.sitemaps.org/schemas/sitemap/0.9"
    ElementTree.register_namespace("", namespace)
    root = ElementTree.Element(f"{{{namespace}}}urlset")
    latest_date = data["days"][0]["date"] if data["days"] else date.today().isoformat()
    pages = [
        ("", "daily", "1.0"),
        ("tools.html", "daily", "0.9"),
        ("favorites.html", "monthly", "0.4"),
        ("about.html", "monthly", "0.6"),
    ]
    for path, frequency, priority in pages:
        node = ElementTree.SubElement(root, f"{{{namespace}}}url")
        ElementTree.SubElement(node, f"{{{namespace}}}loc").text = SITE_URL + path
        ElementTree.SubElement(node, f"{{{namespace}}}lastmod").text = latest_date
        ElementTree.SubElement(node, f"{{{namespace}}}changefreq").text = frequency
        ElementTree.SubElement(node, f"{{{namespace}}}priority").text = priority
    ElementTree.indent(root, space="  ")
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ElementTree.tostring(root, encoding="unicode") + "\n"


def static_latest_markup(data: dict[str, Any]) -> str:
    if not data["days"]:
        return "<!-- LATEST_TOOLS_START -->\n<!-- No daily data available. -->\n        <!-- LATEST_TOOLS_END -->"
    day = data["days"][0]
    items = "\n".join(
        f'              <li><a href="{html.escape(tool.get("official_url") or tool.get("source_url") or "#", quote=True)}">{html.escape(tool["name"])}</a> — {html.escape(tool["tagline_zh"])}</li>'
        for tool in day["tools"]
    )
    return f"""<!-- LATEST_TOOLS_START -->
        <noscript>
          <section class="panel" aria-label="今日工具静态列表">
            <h3>{html.escape(day["date"])} 精选工具</h3>
            <ol>
{items}
            </ol>
          </section>
        </noscript>
        <!-- LATEST_TOOLS_END -->"""


def update_static_latest(data: dict[str, Any]) -> None:
    content = INDEX_FILE.read_text(encoding="utf-8")
    pattern = re.compile(r"<!-- LATEST_TOOLS_START -->.*?<!-- LATEST_TOOLS_END -->", re.DOTALL)
    replacement = static_latest_markup(data)
    updated, count = pattern.subn(replacement, content, count=1)
    if count != 1:
        raise ValueError("index.html is missing latest tool markers")
    INDEX_FILE.write_text(updated, encoding="utf-8")


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_all(data: dict[str, Any] | None = None, *, write_daily: bool = True) -> dict[str, Any]:
    raw = data if data is not None else json.loads(DATA_FILE.read_text(encoding="utf-8"))
    migrated = migrate_data(raw)
    errors = validate_data(migrated)
    if errors:
        raise ValueError("Data validation failed:\n- " + "\n- ".join(errors))
    if write_daily:
        write_json(DATA_FILE, migrated)
    write_json(STATS_FILE, build_stats(migrated))
    write_json(CATEGORIES_FILE, build_categories(migrated))
    FEED_FILE.write_text(rss_xml(migrated), encoding="utf-8")
    SITEMAP_FILE.write_text(sitemap_xml(migrated), encoding="utf-8")
    update_static_latest(migrated)
    return migrated


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    raw = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    migrated = migrate_data(raw)
    errors = validate_data(migrated)
    if errors:
        print("\n".join(f"[error] {error}" for error in errors))
        return 1
    if args.validate_only:
        print(f"[ok] schema v{migrated['schema_version']}: {len(migrated['days'])} days")
    else:
        build_all(migrated)
        print(f"[ok] generated site artifacts for {len(migrated['days'])} days")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
