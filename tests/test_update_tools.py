import copy
import unittest

from scripts.site_builder import migrate_data, validate_data
from scripts.update_tools import (
    Candidate,
    build_chinese_profile,
    infer_category,
    score_candidate,
    select_top_five,
)


def legacy_data():
    return {
        "site": {"title": "每日 AI 工具发现"},
        "updated_at": "2026-07-27T08:30:00+08:00",
        "days": [
            {
                "date": "2026-07-27",
                "tools": [
                    {
                        "rank": 1,
                        "name": "example/codepilot",
                        "category": "编程开发",
                        "one_liner": "一个 AI 编程工具。",
                        "main_features": ["代码生成"],
                        "best_for": "开发者",
                        "side_hustle": "可用于开发服务。",
                        "source": "GitHub",
                        "source_key": "github",
                        "url": "https://github.com/example/codepilot",
                        "attention_score": 88,
                        "is_open_source": True,
                        "metrics": {"stars": 1200, "stars_today": 80},
                    }
                ],
            }
        ],
    }


class ScoringTests(unittest.TestCase):
    def test_category_inference(self):
        self.assertEqual(infer_category("AI coding assistant for developers"), "编程开发")
        self.assertEqual(infer_category("Create images with diffusion"), "图像生成")
        self.assertEqual(infer_category("Speech transcription toolkit"), "音频工具")

    def test_score_and_components_stay_in_range(self):
        candidate = Candidate(
            name="CodePilot",
            url="https://github.com/example/codepilot",
            source="github",
            description="Open source AI coding agent for developers",
            is_open_source=True,
            metrics={"stars_today": 420, "stars": 3200},
        )
        score_candidate(candidate)
        self.assertGreater(candidate.score, 0)
        self.assertLessEqual(candidate.score, 100)
        self.assertEqual(
            set(candidate.score_components),
            {"usefulness", "heat", "freshness", "product", "business"},
        )
        self.assertTrue(all(0 <= value <= 100 for value in candidate.score_components.values()))

    def test_profile_is_chinese_and_complete(self):
        candidate = Candidate(
            name="CodePilot",
            url="https://github.com/example/codepilot",
            source="github",
            description="Open source AI coding assistant for developers",
            score=88,
            is_open_source=True,
        )
        profile = build_chinese_profile(candidate)
        for field in (
            "tagline_zh",
            "description_zh",
            "core_features",
            "suitable_for",
            "business_potential",
            "monetization_ideas",
        ):
            self.assertTrue(profile[field])
        self.assertIn("编程", profile["tagline_zh"])

    def test_selection_keeps_source_diversity_and_spread(self):
        items = []
        for source in ("github", "producthunt", "huggingface"):
            for index in range(4):
                items.append(
                    Candidate(
                        name=f"{source}-{index}",
                        url=f"https://example.com/{source}/{index}",
                        source=source,
                        description="AI agent automation",
                        score=90 - index * 0.2,
                        score_components={"heat": 80},
                    )
                )
        selected = select_top_five(items)
        self.assertEqual(len(selected), 5)
        self.assertEqual({item.source for item in selected}, {"github", "producthunt", "huggingface"})
        self.assertTrue(all(selected[index - 1].score > selected[index].score for index in range(1, 5)))


class DataSchemaTests(unittest.TestCase):
    def test_legacy_data_migrates_to_v2_without_losing_history(self):
        migrated = migrate_data(legacy_data())
        self.assertEqual(migrated["schema_version"], 2)
        self.assertEqual(len(migrated["days"]), 1)
        tool = migrated["days"][0]["tools"][0]
        self.assertEqual(tool["id"], "github-example-codepilot")
        self.assertEqual(tool["original_name"], "example/codepilot")
        self.assertEqual(tool["stars"], 1200)
        self.assertIsNone(tool["license"])
        self.assertEqual(validate_data(migrated), [])

    def test_duplicate_tool_is_rejected(self):
        migrated = migrate_data(legacy_data())
        migrated["days"][0]["tools"].append(copy.deepcopy(migrated["days"][0]["tools"][0]))
        self.assertTrue(any("duplicated" in error for error in validate_data(migrated)))

    def test_invalid_date_and_url_are_rejected(self):
        migrated = migrate_data(legacy_data())
        migrated["days"][0]["date"] = "2026-99-88"
        migrated["days"][0]["tools"][0]["official_url"] = "javascript:alert(1)"
        errors = validate_data(migrated)
        self.assertTrue(any("date is invalid" in error for error in errors))
        self.assertTrue(any("valid URL" in error for error in errors))

    def test_out_of_range_score_is_rejected(self):
        migrated = migrate_data(legacy_data())
        migrated["days"][0]["tools"][0]["score_total"] = 120
        self.assertTrue(any("between 0 and 100" in error for error in validate_data(migrated)))

    def test_required_field_is_rejected(self):
        migrated = migrate_data(legacy_data())
        migrated["days"][0]["tools"][0]["id"] = ""
        self.assertTrue(any(".id is required" in error for error in validate_data(migrated)))


if __name__ == "__main__":
    unittest.main()
