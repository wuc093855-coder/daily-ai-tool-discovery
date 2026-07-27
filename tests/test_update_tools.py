import unittest

from scripts.update_tools import (
    Candidate,
    build_chinese_profile,
    infer_category,
    select_top_five,
)


class ToolDiscoveryTests(unittest.TestCase):
    def test_category_inference(self):
        self.assertEqual(infer_category("AI coding agent for developers"), "编程开发")
        self.assertEqual(infer_category("Create images with diffusion"), "图像设计")
        self.assertEqual(infer_category("Speech transcription toolkit"), "音频语音")

    def test_profile_is_chinese_and_complete(self):
        candidate = Candidate(
            name="CodePilot",
            url="https://github.com/example/codepilot",
            source="github",
            description="Open source AI coding agent for developers",
            score=88,
            is_open_source=True,
            metrics={"stars_today": 420},
        )
        profile = build_chinese_profile(candidate)
        for key in (
            "one_liner",
            "main_features",
            "pricing",
            "best_for",
            "side_hustle",
        ):
            self.assertTrue(profile[key])
        self.assertIn("开源", profile["pricing"])
        self.assertIn("编程", profile["one_liner"])

    def test_selection_keeps_source_diversity(self):
        items = []
        for source in ("github", "producthunt", "huggingface"):
            for index in range(4):
                items.append(
                    Candidate(
                        name=f"{source}-{index}",
                        url=f"https://example.com/{source}/{index}",
                        source=source,
                        description="AI agent automation",
                        score=100 - index,
                        is_open_source=source != "producthunt",
                    )
                )
        selected = select_top_five(items)
        self.assertEqual(len(selected), 5)
        self.assertEqual({item.source for item in selected}, set(("github", "producthunt", "huggingface")))


if __name__ == "__main__":
    unittest.main()
