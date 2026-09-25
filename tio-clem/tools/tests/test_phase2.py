"""Tests de la Phase 2 : recherche, sélection, anti-répétition, script.

Lancement : `npm test` ou `python3 -m unittest discover -s tools/tests`.
Les tests travaillent sur des copies en mémoire : aucun fichier du projet n'est modifié.
"""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))

from content import repetition, script, selection  # noqa: E402
from research import validate as research  # noqa: E402


def load(rel):
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))


POST1, POST2 = load("content/posts/day-01.json"), load("content/posts/day-02.json")
RES1 = load("research/ceviche.json")


class Research(unittest.TestCase):
    def test_real_research_files_pass(self):
        for post in (POST1, POST2):
            r = research.validate(load(post["research"]), post, post["bank_category"])
            self.assertEqual(r["errors"], [], post["slug"])

    def test_forbidden_and_not_citable_domains(self):
        r = copy.deepcopy(RES1)
        r["sources"][0]["url"] = "https://www.instagram.com/p/xyz"
        r["sources"][1]["url"] = "https://fr.wikipedia.org/wiki/Ceviche"
        errs = " ".join(research.validate(r, POST1)["errors"])
        self.assertIn("domaine interdit", errs)
        self.assertIn("wikipedia.org ne se cite pas", errs)

    def test_fact_resting_only_on_search_snippets_fails(self):
        r = copy.deepcopy(RES1)
        for s in r["sources"]:
            s["lu"] = "extrait"
        self.assertTrue(any("extraits de recherche" in e for e in research.validate(r, POST1)["errors"]))

    def test_low_confidence_fact_on_screen_fails(self):
        r = copy.deepcopy(RES1)
        next(f for f in r["faits"] if f["id"] == "F6")["confiance"] = "basse"
        self.assertTrue(any("confiance basse" in e for e in research.validate(r, POST1)["errors"]))

    def test_unknown_source_and_missing_reason_fail(self):
        r = copy.deepcopy(RES1)
        r["faits"][0]["sources"] = ["S99"]
        r["informations_ecartees"].append({"information": "rumeur", "raison": ""})
        errs = " ".join(research.validate(r, POST1)["errors"])
        self.assertIn("inconnues", errs)
        self.assertIn("sans raison", errs)

    def test_single_source_post_fails(self):
        r = copy.deepcopy(RES1)
        for f in r["faits"]:
            f["sources"] = ["S1"]
        self.assertTrue(any("minimum" in e for e in research.validate(r, POST1)["errors"]))

    def test_sources_json_v2_format(self):
        out = research.validate(RES1, POST1)["sources_used"]
        self.assertTrue(out)
        for s in out:
            self.assertEqual({"title", "url", "publisher", "date", "used_for", "read"}, set(s))
            self.assertTrue(s["url"].startswith("https://"))


class Repetition(unittest.TestCase):
    def test_distinct_posts_pass(self):
        self.assertEqual(repetition.check_post(POST2, [POST1])["level"], "ok")

    def test_clone_fails_on_every_content_dimension(self):
        clone = copy.deepcopy(POST1)
        clone.update(day=9, date="2026-10-02", idea_id="002")
        dims = repetition.check_post(clone, [POST1, POST2])["dimensions"]
        for d in ("sujet", "angle", "informations", "hook", "visuels", "cta", "formulation"):
            self.assertEqual(dims[d]["level"], "fail", d)

    def test_same_theme_new_angle_is_allowed_after_cooldown(self):
        history = [POST1] + [dict(POST2, day=i, date=f"2026-09-{24 + i}", theme=f"t{i}") for i in range(2, 8)]
        f = repetition.check_candidate("Comment reconnaît-on un ceviche péruvien ?", "ceviche", "explication",
                                       "carrousel", history)
        self.assertFalse([x for x in f if x["level"] == "fail"], f)

    def test_near_duplicate_title_is_blocked(self):
        f = repetition.check_candidate("5 choses que tu ne savais probablement pas sur le ceviche péruvien",
                                       "ceviche", "top", "video", [POST1, POST2])
        self.assertIn(("angle", "fail"), {(x["dimension"], x["level"]) for x in f})
        self.assertIn(("sujet", "fail"), {(x["dimension"], x["level"]) for x in f})

    def test_similarity_bounds(self):
        self.assertGreater(repetition.similarity("Team poisson ou team fruits de mer ?",
                                                 "Team poisson ou team fruits de mer ?"), 0.99)
        self.assertLess(repetition.similarity("60 % du Pérou, c'est l'Amazonie.",
                                              "Le ceviche, c'est pas juste du poisson cru."), 0.5)


class Script(unittest.TestCase):
    def test_real_posts_have_no_errors(self):
        for post in (POST1, POST2):
            self.assertEqual(script.lint(post)["errors"], [], post["slug"])

    def test_slow_intro_and_long_sentence(self):
        p = copy.deepcopy(POST1)
        p["scenes"][0]["voiceover"] = "Bonjour à tous, aujourd'hui on va parler du ceviche péruvien."
        p["scenes"][1]["voiceover"] = ("Voici une phrase beaucoup trop longue qui continue encore et encore sans "
                                       "respirer parce que personne ne parle vraiment comme ça dans une vidéo TikTok.")
        r = script.lint(p)
        self.assertTrue(any("introduction lente" in e for e in r["errors"]))
        self.assertTrue(any("18 mots" in w for w in r["warnings"]))

    def test_missing_keyword_and_structure(self):
        p = copy.deepcopy(POST1)
        p["seo"]["primary_keyword"] = "pachamanca"
        p["scenes"] = list(reversed(p["scenes"]))
        errs = " ".join(script.lint(p)["errors"])
        self.assertIn("absent de la voix", errs)
        self.assertIn("n'est pas le hook", errs)

    def test_generalization_warning(self):
        p = copy.deepcopy(POST1)
        p["scenes"][2]["voiceover"] = "Les Péruviens mangent toujours du ceviche le midi."
        self.assertTrue(any("généralisation" in w for w in script.lint(p)["warnings"]))

    def test_draft_is_blocked_until_written(self):
        entry = next(d for d in load("content/calendar.json")["days"] if d["day"] == 3)
        idea = next(i for i in load("content/ideas.json")["ideas"] if i["id"] == entry["idea_id"])
        d = script.draft(entry, idea, "research/x.json")
        self.assertEqual([s["role"] for s in d["scenes"]][:2], ["hook", "promesse"])
        self.assertTrue(any("À ÉCRIRE" in e for e in script.lint(d)["errors"]))

    def test_old_seo_names_still_read(self):
        f = script.seo_fields({"seo": {"main": "ceviche", "secondary": ["a"], "question": "q ?"}})
        self.assertEqual((f["primary_keyword"], f["secondary_keywords"], f["search_phrase"]), ("ceviche", ["a"], "q ?"))


class Selection(unittest.TestCase):
    def test_pillar_rotation(self):
        self.assertFalse(selection.rotation_ok("manger", ["explorer", "manger", "manger"]))
        self.assertTrue(selection.rotation_ok("manger", ["manger", "explorer"]))

    def test_every_category_has_a_pillar(self):
        for i in selection.ideas()["ideas"]:
            self.assertEqual(selection.pillar_of({"category": i["category"]}), i["pillar"], i["id"])

    def test_pick_never_breaks_rotation_nor_reuses(self):
        pubs = selection.timeline()
        prev = [selection.pillar_of(p) for p in pubs]
        used = {p["idea_id"] for p in pubs}
        for t in selection.pick(20):
            self.assertTrue(selection.rotation_ok(t["pilier"], prev))
            self.assertNotIn(t["id"], used)

    def test_rotation_problem_reported(self):
        pubs = [dict(day=1, date="2026-01-01", bank_category="cuisine"),
                dict(day=2, date="2026-01-02", bank_category="boissons")]
        post = dict(day=3, date="2026-01-03", bank_category="cuisine")
        self.assertTrue(selection.rotation_problems(post, pubs))


if __name__ == "__main__":
    unittest.main()
