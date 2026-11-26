#!/usr/bin/env python3
"""Build licensed, reviewed Chinese lookup tables from pinned local snapshots."""
import csv
import hashlib
import json
import re
import subprocess
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "resources"
CACHE = ROOT / ".cache" / "zh"
INPUTS = ROOT / "scripts" / "zh-inputs"
RESEARCH = INPUTS / "research-030"


def read_csv(path):
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def read_booru(path):
    out = {}
    with path.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.reader(f):
            name = row[0].strip() if row else ""
            # Match core/csv.mjs importRows: trim, reject empty, too-long, and
            # newline-containing keys before building any derived dictionary.
            if len(row) >= 3 and name and len(name) <= 500 and not re.search(r"[\r\n]", name):
                out[name] = {"name": name, "type": int(row[1]), "count": int(row[2]),
                               "aliases": [a for a in (row[3].split(",") if len(row) > 3 else []) if a]}
    return out


def has_usable_zh(value, key):
    if not value:
        return False
    value = value.strip()
    if value.casefold() == key.casefold() or value.replace("_", " ").casefold() == key.replace("_", " ").casefold():
        return False
    # Require at least one Han character; reject Japanese kana so a Japanese spelling
    # plus a short Chinese aside is not mistaken for a clean Chinese translation.
    return bool(re.search(r"[\u3400-\u9fff\uf900-\ufaff]", value)) and not re.search(r"[\u3040-\u30ff]", value)


TYPE_LABELS = {1: "画师", 3: "作品", 4: "角色"}


def classify_value(value, key, typ, default="zh"):
    """Separate real Chinese translations from raw names and identity templates."""
    if not value:
        return "缺口"
    val = value.strip()
    if re.search(r"(?:专名.*原名保留|原名保留|原名，保留)", val):
        return "原名/身份标注"
    # Recognize common Chinese and Japanese type suffix templates after removing
    # them before comparing the remaining Latin root with the source tag.
    base = re.sub(r"[（(](?:画师|角色|作品|系列|artist|character|copyright|series)[）)]", "", val, flags=re.I).strip()
    norm = lambda s: re.sub(r"[^a-z0-9]", "", s.casefold())
    if typ in TYPE_LABELS and norm(base) and norm(base) == norm(key):
        return "原名/身份标注"
    if re.search(r"[\u3040-\u30ff]", val):
        return "原名/身份标注" if typ in TYPE_LABELS else "缺口"
    if not re.search(r"[\u3400-\u9fff\uf900-\ufaff]", val):
        return "原名/身份标注" if typ in TYPE_LABELS else "缺口"
    # A Latin name followed by a Chinese origin can help identify a proper
    # noun, but it should be an annotation rather than a translated name.
    if re.match(r"^[A-Za-z0-9 _'’.!:-]+[（(].*[\u3400-\u9fff\uf900-\ufaff].*[）)]$", val):
        return "说明"
    return default


def identity_display(name, typ):
    label = {1: "画师署名", 3: "作品名", 4: "角色名"}.get(typ, "原始标签")
    return f"{label}：{name}"


def repeated_english_template(value, key):
    """Reject a CJK wrapper that only repeats the same English tag."""
    tokens = re.findall(r"[A-Za-z0-9]+", value.casefold())
    key_norm = re.sub(r"[^a-z0-9]", "", key.casefold())
    if not tokens or any(re.sub(r"[^a-z0-9]", "", token) != key_norm for token in tokens):
        return False
    residue = re.sub(r"[A-Za-z0-9_]+", "", value)
    residue = re.sub(r"(?:关联标签|相關標籤|相关标签|标签|對應|对应|原名|專名|专名|保留|英文名|名称|名字|tag)", "", residue, flags=re.I)
    return not re.search(r"[\u3400-\u9fff\uf900-\ufaff]", residue)


def low_information(row, key):
    return row["kind"] in ("缺口", "原名/身份标注") or repeated_english_template(row["translation"], key)


def read_site_rows(path, source):
    """Read exact (site, key, numeric type) Luna/context rows if present."""
    out = {}
    if not path.exists():
        return out
    for row in read_csv(path):
        site, name = row.get("site", "").strip().lower(), row.get("name", "").strip()
        try:
            typ = int(row.get("type", "-1"))
        except ValueError:
            continue
        if site not in ("danbooru", "gelbooru") or name not in source or source[name]["type"] != typ:
            continue
        value, kind = row.get("translation", "").strip(), row.get("kind", "").strip()
        if not value or kind == "缺口":
            continue
        if kind == "别名":
            value, kind = "资料所列别名：" + value, "说明"
        elif "原名保留" in value or ("专名" in value and "原名" in value):
            kind = "原名/身份标注"
        elif kind == "zh":
            kind = classify_value(value, name, typ)
        elif kind not in ("说明", "原名/身份标注"):
            kind = classify_value(value, name, typ)
        if kind == "缺口":
            continue
        if repeated_english_template(value, name):
            continue
        detail = row.get("source", "").strip()
        out[(site, name, typ)] = {"translation": value, "kind": kind,
                                  "source": path.name + (": " + detail if detail else "")}
    return out


def apply_contexts(dan_out, gel_out, dan, gel):
    sources = [
        (RES / "zh-priority-gel.csv", "priority"),
        (RES / "zh-tail-lexicon.csv", "fill"),
        (RES / "zh-tail-names.csv", "fill"),
        (RES / "zh-character-context.csv", "fill"),
        (RES / "zh-artist-context.csv", "artist"),
        (RES / "zh-dan-last.csv", "fill"),
        (RES / "zh-final-gaps.csv", "fill"),
    ]
    for path, mode in sources:
        for mapping, source_tags, site in ((dan_out, dan, "danbooru"), (gel_out, gel, "gelbooru")):
            records = read_site_rows(path, source_tags)
            for (row_site, name, typ), entry in records.items():
                if row_site != site:
                    continue
                current = mapping.get(name)
                if not current or current["type"] != typ:
                    continue
                # Curated extension files are a second-pass fill: preserve any
                # trusted translation already selected, except the requested
                # sourced group note for ebifurya.
                if mode == "fill" and current["kind"] not in ("原名/身份标注", "缺口"):
                    continue
                if mode == "priority" and not low_information(current, name):
                    continue
                if mode == "artist" and current["kind"] not in ("原名/身份标注", "缺口"):
                    if name != "ebifurya":
                        continue
                if name == "ebifurya" and site == "danbooru" and mode == "artist":
                    # Keep the sourced group note ahead of a speculative literal
                    # interpretation of the handle (e.g. “炸虾人”).
                    pass
                if entry["kind"] == "原名/身份标注" and current["kind"] == "缺口" and entry["translation"] == name:
                    entry = dict(entry, translation=identity_display(name, typ))
                mapping[name] = dict(current, translation=entry["translation"], kind=entry["kind"], source=entry["source"])
    for mapping in (dan_out, gel_out):
        for name, row in mapping.items():
            if row["kind"] == "原名/身份标注" and row["translation"] == name:
                row["translation"] = identity_display(name, row["type"])


def inherit_shared_misses(dan_out, gel_out):
    """After all site-specific data, fill only exact same-key general/meta misses."""
    for name, gel_row in gel_out.items():
        if gel_row["kind"] != "缺口" or gel_row["type"] not in (0, 5):
            continue
        dan_row = dan_out.get(name)
        if not dan_row or dan_row["type"] != gel_row["type"] or dan_row["kind"] not in ("zh", "说明"):
            continue
        # Generic/meta exact tags with a matching numeric type are shared terms;
        # proper-name categories are intentionally excluded due homonym risk.
        gel_row["translation"] = dan_row["translation"]
        gel_row["kind"] = dan_row["kind"]
        gel_row["source"] = "Danbooru exact same-key/type shared term → " + dan_row["source"]


RESEARCH_FIELDS = ["site", "name", "type", "translation", "kind", "source", "status"]
RESEARCH_GAPS_SHA256 = "3DF527CA6FDF6AF16F793890C59E38490FB00C01F0BA935554919EBF93896E28"
FROZEN_030 = ROOT / ".cache" / "zh" / "research-030" / "frozen-030"


def cjk_without_kana(value):
    return bool(re.search(r"[\u3400-\u9fff\uf900-\ufaff]", value)) and not re.search(r"[\u3040-\u30ff]", value)


def product_kind(row, key):
    """Map research-specific evidence labels to the product's four stable kinds."""
    if row["status"] == "unresolved":
        return "缺口"
    value = row["translation"].strip()
    raw_kind = row["kind"].strip()
    if not value or re.search(r"[\u3040-\u30ff]", value):
        raise ValueError(f"confirmed research row has no clean content: {key}: {value!r}")
    if raw_kind == "原名/身份标注":
        # A Chinese identity label may preserve a verified Latin title or handle;
        # raw Latin alone is never accepted as a completed translation.
        if not cjk_without_kana(value):
            raise ValueError(f"confirmed identity row lacks Chinese labeling: {key}: {value!r}")
        return "原名/身份标注"
    if not cjk_without_kana(value):
        raise ValueError(f"confirmed research row has no Chinese content: {key}: {value!r}")
    if raw_kind in ("zh", "说明", "缺口"):
        return "zh" if raw_kind == "zh" else raw_kind
    if raw_kind in ("identity-unresolved", "identity"):
        # A source-verified Chinese personal name is a translation; generic
        # account/artist handles with an explanatory wrapper remain identity.
        if key == "li_zeyan" and value == "李泽言":
            return "zh"
        if key == "shi_cunjin" and value == "时寸瑾":
            return "zh"
        return "原名/身份标注"
    if raw_kind in ("localized-name", "wiki-documented-Chinese-alias", "work-name"):
        return "zh" if re.fullmatch(r"[\u3400-\u9fff\uf900-\ufaff·。！？：；，、（）《》\s]+", value) else "说明"
    if raw_kind == "character-name":
        return "zh" if re.fullmatch(r"[\u3400-\u9fff\uf900-\ufaff·。！？：；，、（）《》\s]+", value) else "说明"
    if raw_kind in ("说明", "wiki-meaning", "wiki-identified-name", "source-note", "name-with-source-note", "source-note", "wiki-meaning"):
        return "说明"
    if raw_kind in ("character-name", "localized-name"):
        return "zh" if re.fullmatch(r"[\u3400-\u9fff\uf900-\ufaff·。！？：；，、（）《》\s]+", value) else "说明"
    raise ValueError(f"unsupported research kind {raw_kind!r} for {key}")


def read_research_row(path, row, gap_keys):
    site, name = row.get("site", "").strip().lower(), row.get("name", "").strip()
    try:
        typ = str(int(row.get("type", "-1")))
    except ValueError:
        raise ValueError(f"invalid research type in {path.name}: {row}")
    key = (site, name, typ)
    if key not in gap_keys:
        raise ValueError(f"research input is not a frozen 0.3.0 gap: {path.name}: {key}")
    if row.get("status") not in ("confirmed", "unresolved"):
        raise ValueError(f"invalid research status in {path.name}: {key}")
    if row["status"] == "unresolved" and row.get("translation", "").strip():
        raise ValueError(f"unresolved research translation must be blank: {path.name}: {key}")
    if not row.get("source", "").strip():
        raise ValueError(f"research row missing evidence / reason: {path.name}: {key}")
    if "\ufffd" in "".join(str(v) for v in row.values()):
        raise ValueError(f"replacement character in research row: {path.name}: {key}")
    if row["status"] == "confirmed" and repeated_english_template(row.get("translation", ""), name):
        raise ValueError(f"confirmed row repeats source tag without meaning: {path.name}: {key}")
    return key


def apply_research_040(dan_out, gel_out):
    """Apply frozen 0.4.0 research only to the 0.3.0 open-gap set."""
    gap_path = RESEARCH / "gaps.csv"
    gap_bytes = gap_path.read_bytes()
    if hashlib.sha256(gap_bytes).hexdigest().upper() != RESEARCH_GAPS_SHA256:
        raise ValueError("research-030/gaps.csv changed from the frozen 0.3.0 baseline")
    gap_rows = read_csv(gap_path)
    gap_keys = set()
    for r in gap_rows:
        gap_keys.add((r["site"].strip(), r["name"].strip(), str(int(r["type"]))))

    shard_paths = [RESEARCH / "dan.csv"] + [RESEARCH / f"gel-{i}.csv" for i in range(6)]
    shard_map = {}
    for path in shard_paths:
        if not path.exists():
            raise FileNotFoundError(f"required research shard missing: {path}")
        rows = read_csv(path)
        seen_file = set()
        for row in rows:
            key = read_research_row(path, row, gap_keys)
            if key in seen_file or key in shard_map:
                raise ValueError(f"duplicate key across core shards: {key}")
            if (key[0] == "danbooru") != (path.name == "dan.csv"):
                raise ValueError(f"research row in wrong site shard: {path.name}: {key}")
            if key[0] == "gelbooru":
                shard_no = int(hashlib.sha256(key[1].encode("utf-8")).hexdigest()[:8], 16) % 6
                if path.name != f"gel-{shard_no}.csv":
                    raise ValueError(f"Gel research row in wrong stable shard: {path.name}: {key}")
            seen_file.add(key)
            shard_map[key] = dict(row, source_file=path.name)
    if set(shard_map) != gap_keys:
        raise ValueError(f"research shards do not exactly cover frozen gaps: missing={len(gap_keys-set(shard_map))}, extra={len(set(shard_map)-gap_keys)}")

    supplements = []
    for filename in ("extra-artists.csv", "extra-lexical.csv", "artist-md5-crosscheck.csv",
                     "extra-proven.csv", "extra-tail.csv", "tail-lexical.csv", "extra-proper.csv"):
        path = RESEARCH / filename
        if not path.exists():
            continue
        seen_file = set()
        for row in read_csv(path):
            key = read_research_row(path, row, gap_keys)
            if key in seen_file:
                raise ValueError(f"duplicate research key in {filename}: {key}")
            seen_file.add(key)
            # Cross-site alias-only borrowing is not an acceptable Gel proof.
            if filename == "extra-lexical.csv" and re.search(r"unique Danbooru alias|Danbooru alias candidate|reused.*Danbooru|Danbooru.*translation is reused", row["source"], re.I):
                raise ValueError(f"cross-site alias-only evidence must be removed or separately verified: {key}")
            supplements.append((key, dict(row, source_file=filename)))

    supplemental_by_key = defaultdict(list)
    for key, row in supplements:
        supplemental_by_key[key].append(row)

    decisions = {}
    for key in sorted(gap_keys):
        base_row = shard_map[key]
        candidates = [base_row] + supplemental_by_key.get(key, [])
        selected = base_row
        selection_reason = "core shard"
        # A confirmed site-specific artist classification is stronger than a
        # literal or cross-site lexical candidate. Other supplemental rows can
        # fill a shard gap, but never replace a confirmed shard result.
        artist_rows = [r for r in candidates[1:] if r["status"] == "confirmed" and r["source_file"] == "extra-artists.csv"
                       and "Gelbooru public exact tag page" in r["source"] and "classifies" in r["source"] and "artist" in r["source"].lower()]
        proven_rows = [r for r in candidates[1:] if r["status"] == "confirmed" and r["source_file"] == "extra-proven.csv"]
        md5_rows = [r for r in candidates[1:] if r["status"] == "confirmed" and r["source_file"] == "artist-md5-crosscheck.csv"]
        confirmed_artist_rows = [r for r in candidates[1:] if r["status"] == "confirmed" and r["source_file"] == "extra-artists.csv"
                                 and "Gelbooru public exact tag page" in r["source"] and "classifies" in r["source"] and "artist" in r["source"].lower()]
        # When an official/site-context source and same-image artist evidence
        # claim different meanings for one Gel key, stop for a human review.
        # Matching identities may share both provenance records in the audit.
        for proven in proven_rows:
            for competing in md5_rows + confirmed_artist_rows:
                if proven["translation"].strip() != competing["translation"].strip():
                    raise ValueError(f"conflicting confirmed extra-proven / artist-evidence claims need review: {key} ({competing['source_file']})")
        if base_row["status"] == "unresolved" and key[0] == "gelbooru" and proven_rows:
            selected = proven_rows[-1]
            selection_reason = "confirmed official or direct site-context evidence fills unresolved core row"
        elif base_row["status"] == "unresolved" and key[0] == "gelbooru" and md5_rows:
            selected = md5_rows[-1]
            selection_reason = "confirmed exact-image MD5 match to Danbooru artist record"
        elif base_row["status"] == "unresolved" and key[0] == "gelbooru" and artist_rows:
            selected = artist_rows[-1]
            selection_reason = "confirmed Gelbooru-native artist evidence"
        elif base_row["status"] == "unresolved":
            confirmed = [r for r in candidates[1:] if r["status"] == "confirmed"]
            if confirmed:
                # Extra lexical is processed after identity checks, but a
                # confirmed native artist row wins if both are present.
                selected = confirmed[-1]
                selection_reason = "confirmed supplemental evidence fills unresolved core shard"
            else:
                unresolved = [r for r in candidates[1:] if r["status"] == "unresolved"]
                if unresolved:
                    selected = max([base_row] + unresolved, key=lambda r: len(r["source"]))
                    selection_reason = "unresolved evidence retained; most detailed basis selected"

        mapping = dan_out if key[0] == "danbooru" else gel_out
        name, typ = key[1], int(key[2])
        current = mapping.get(name)
        if not current or current["type"] != typ or current["kind"] != "缺口":
            raise ValueError(f"0.4 overlay may only modify an old unresolved row: {key}, current={current}")
        product = product_kind(selected, name)
        final_translation = selected["translation"].strip() if selected["status"] == "confirmed" else ""
        if selected["status"] == "unresolved":
            product, final_translation = "缺口", ""
        if product == "zh" and not has_usable_zh(final_translation, name):
            raise ValueError(f"research row classified zh but has no usable Chinese: {key}: {final_translation!r}")
        if product == "缺口" and final_translation:
            raise ValueError(f"gap research row must have empty translation: {key}")
        all_sources = [{"file": r["source_file"], "status": r["status"], "kind": r["kind"], "translation": r["translation"], "source": r["source"]} for r in candidates]
        final_source = f"research-030/{selected['source_file']}: {selected['source']}"
        current.update(translation=final_translation, kind=product, source=final_source)
        decisions[key] = {"base": base_row, "candidates": candidates, "selected": selected, "kind": product,
                          "translation": final_translation, "source": final_source, "decision": selection_reason,
                          "all_sources_json": json.dumps(all_sources, ensure_ascii=False, separators=(",", ":"))}

    if set(decisions) != gap_keys:
        raise AssertionError("not all frozen gaps received a research audit decision")
    write_research_audit(decisions, gap_rows)
    verify_030_scope(dan_out, gel_out, gap_keys)
    print(f"Research 0.4 exact coverage: {len(decisions)} keys; supplemental rows: {len(supplements)}")
    return decisions


def write_research_audit(decisions, gap_rows):
    gap_by_key = {(r["site"], r["name"], str(int(r["type"]))): r for r in gap_rows}
    out = RES / "zh-research-040-audit.csv"
    fields = ["site", "name", "type", "count", "baseline_translation", "baseline_kind", "baseline_source",
              "shard_translation", "shard_kind", "shard_status", "shard_source", "supplemental_and_all_evidence_json",
              "selected_file", "selected_translation", "selected_product_kind", "selected_status", "selection_reason", "selected_source"]
    with out.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n")
        w.writeheader()
        for key in sorted(decisions):
            d, gap = decisions[key], gap_by_key[key]
            shard = d["base"]
            w.writerow({"site": key[0], "name": key[1], "type": key[2], "count": gap["count"],
                        "baseline_translation": "", "baseline_kind": "缺口", "baseline_source": "",
                        "shard_translation": shard["translation"], "shard_kind": shard["kind"],
                        "shard_status": shard["status"], "shard_source": shard["source"],
                        "supplemental_and_all_evidence_json": d["all_sources_json"],
                        "selected_file": d["selected"]["source_file"], "selected_translation": d["translation"],
                        "selected_product_kind": d["kind"], "selected_status": d["selected"]["status"],
                        "selection_reason": d["decision"], "selected_source": d["source"]})


def verify_030_scope(dan_out, gel_out, gap_keys):
    """Require every non-gap output field to remain byte-value identical to 0.3.0."""
    for site, current in (("danbooru", dan_out), ("gelbooru", gel_out)):
        path = FROZEN_030 / f"zh-{site}.csv"
        if not path.exists():
            raise FileNotFoundError(f"frozen 0.3.0 comparison file missing: {path}")
        old = {r["name"]: r for r in read_csv(path)}
        if set(old) != set(current):
            raise RuntimeError(f"0.3.0 scope check failed for {site}: missing={len(set(old)-set(current))}, added={len(set(current)-set(old))}")
        changed = []
        for name, row in current.items():
            if (site, name, str(row["type"])) in gap_keys:
                continue
            oldrow = old[name]
            for field in ("translation", "kind", "source"):
                if row[field] != oldrow[field]:
                    changed.append((name, field, oldrow[field], row[field]))
                    if len(changed) >= 10:
                        break
        if changed:
            raise RuntimeError(f"non-gap rows changed from 0.3.0 in {site}: {changed[:10]}")
        print(f"{site} frozen 0.3.0 non-gap translation/kind/source unchanged")


def cjk_only_alias_or_original(value):
    return bool(value) and bool(re.search(r"[\u3400-\u9fff]", value)) and not re.search(r"[\u3040-\u30ff]", value)


def get_seed():
    code = "import {seedTags} from './core/seed.mjs'; console.log(JSON.stringify(seedTags.map(({name,translation})=>({name,translation}))))"
    payload = subprocess.check_output(["node", "--input-type=module", "-e", code], cwd=ROOT, text=True, encoding="utf-8")
    return {row["name"]: row["translation"] for row in json.loads(payload)}


def read_ame():
    rows = {}
    for path in INPUTS.glob("ame-*.csv"):
        for row in read_csv(path):
            try:
                typ = int(row["category"])
            except (KeyError, ValueError):
                continue
            rows[(row["tag"], typ)] = {"zh": row.get("zh", "").strip(), "notes": row.get("notes", "").strip(),
                                        "aliases": [a.strip() for a in row.get("aliases", "").split("|") if a.strip()],
                                        "source": "amenorira/" + path.name}
    return rows


def read_ffdkj():
    path = INPUTS / "ffdkj-matched.csv"
    if not path.exists():
        raise FileNotFoundError(f"Persistent input missing: {path}")
    return {(row["name"], int(row["category"])): row.get("cn_name", "")
            for row in read_csv(path) if row.get("name") and row.get("category", "").isdigit()}


def read_proper():
    # Optional curated additions; ignore aliases and blank/non-Chinese values.
    out = {}
    for path in [INPUTS / "propernames.csv", INPUTS / "proper-extra.csv"]:
        if not path.exists():
            continue
        for row in read_csv(path):
            name = row.get("name") or row.get("tag") or ""
            value = (row.get("translation") or "").split(",", 1)[0].strip()
            try:
                typ = int(row.get("type", row.get("category", "-1")))
            except ValueError:
                continue
            # StoryAura's derived proper-extra file is conservative by design;
            # also reject Japanese kana here and later classify identity labels.
            if name and has_usable_zh(value, name):
                out[(name, typ)] = (value, path.name)
    return out


def read_gloss():
    out = {}
    for path in [INPUTS / "gel_gloss.csv", INPUTS / "gel-gloss.csv", INPUTS / "general-extra.csv"]:
        if not path.exists():
            continue
        for row in read_csv(path):
            name = row.get("name") or row.get("tag") or ""
            value = row.get("translation") or row.get("gloss") or row.get("zh") or ""
            raw_type = row.get("type", row.get("category", "-1"))
            if ":" in raw_type:
                category, quality = raw_type.split(":", 1)
            else:
                category, quality = raw_type, "manual-reviewed"
            try:
                typ = int(category)
            except ValueError:
                continue
            if name and has_usable_zh(value, name):
                kind = classify_value(value, name, typ)
                if kind != "缺口":
                    out[(name, typ)] = (value, path.name + ":" + quality, kind)
    return out


def reviewed_map(dan, path):
    out = {}
    if path.exists():
        for row in read_csv(path):
            name, value = row.get("name", "").strip(), row.get("translation", "").strip()
            if name in dan and classify_value(value, name, dan[name]["type"]) != "缺口":
                out[(name, dan[name]["type"])] = (value, classify_value(value, name, dan[name]["type"]))
    return out


def reviewed_map_for(path, source):
    out = {}
    if not path.exists():
        return out
    for row in read_csv(path):
        name, value = row.get("name", "").strip(), row.get("translation", "").strip()
        if name in source and classify_value(value, name, source[name]["type"]) != "缺口":
            out[(name, source[name]["type"])] = value
    return out


def make_dan(dan, seed, reviewed, ame, ff, proper, gloss):
    result = {}
    for key, meta in dan.items():
        pair = (key, meta["type"])
        value, kind, source = "", "缺口", ""
        if pair in reviewed:
            value, kind = reviewed[pair]
            source = "Luna 校译"
        elif key in seed and has_usable_zh(seed[key], key):
            value, kind, source = seed[key], "zh", "既有 seed"
        elif pair in ame and has_usable_zh(ame[pair]["zh"], key):
            value, kind, source = ame[pair]["zh"], classify_value(ame[pair]["zh"], key, meta["type"]), ame[pair]["source"]
        elif pair in proper:
            value, kind, source = proper[pair][0], classify_value(proper[pair][0], key, meta["type"]), proper[pair][1]
        elif pair in ff and has_usable_zh(ff[pair], key):
            value, kind, source = ff[pair], classify_value(ff[pair], key, meta["type"]), "ffdkj"
        elif pair in ame and ame[pair]["notes"]:
            value, kind, source = ame[pair]["notes"], classify_value(ame[pair]["notes"], key, meta["type"], "说明"), ame[pair]["source"]
        elif meta["type"] in (1, 3, 4):
            value, kind, source = key, "原名/身份标注", "原始标签"
        result[key] = {"name": key, "type": meta["type"], "count": meta["count"],
                       "translation": value, "kind": kind, "source": source}
    return result


def make_gel(gel, dan, dan_result, ame, ff, proper, gel_reviewed, gloss):
    # Alias transfer is allowed only if the Gelbooru key has exactly one Danbooru
    # target across the matching category. Case/spacing normalization is avoided.
    alias_targets = defaultdict(set)
    for tag, meta in dan.items():
        for alias in meta["aliases"]:
            alias_targets[(alias, meta["type"])].add(tag)
    for (tag, typ), row in ame.items():
        for alias in row["aliases"]:
            alias_targets[(alias, typ)].add(tag)
    result = {}
    for key, meta in gel.items():
        pair = (key, meta["type"])
        base = dan_result.get(key) if key in dan and dan[key]["type"] == meta["type"] else None
        if pair in gel_reviewed:
            value, reviewed_kind = gel_reviewed[pair]
            entry = {"name": key, "type": meta["type"], "count": meta["count"], "translation": value,
                     "kind": reviewed_kind, "source": "Luna Gelbooru 校译"}
        elif pair in gloss:
            value, source, kind = gloss[pair]
            entry = {"name": key, "type": meta["type"], "count": meta["count"], "translation": value,
                     "kind": kind, "source": source}
        elif base and base["kind"] in ("zh", "说明"):
            entry = dict(base, name=key, type=meta["type"], count=meta["count"], source="Danbooru exact key → " + base["source"])
        elif pair in ame and (has_usable_zh(ame[pair]["zh"], key) or ame[pair]["notes"]):
            value = ame[pair]["zh"] if has_usable_zh(ame[pair]["zh"], key) else ame[pair]["notes"]
            kind = classify_value(value, key, meta["type"], "说明")
            entry = {"name": key, "type": meta["type"], "count": meta["count"], "translation": value,
                     "kind": kind, "source": ame[pair]["source"]}
        elif pair in proper:
            value = proper[pair][0]
            entry = {"name": key, "type": meta["type"], "count": meta["count"], "translation": value,
                     "kind": classify_value(value, key, meta["type"]), "source": proper[pair][1]}
        elif pair in ff and has_usable_zh(ff[pair], key):
            value = ff[pair]
            entry = {"name": key, "type": meta["type"], "count": meta["count"], "translation": value,
                     "kind": classify_value(value, key, meta["type"]), "source": "ffdkj"}
        else:
            targets = alias_targets.get(pair, set())
            if not targets:
                for alias in meta["aliases"]:
                    targets.update(alias_targets.get((alias, meta["type"]), set()))
            if len(targets) == 1:
                target = next(iter(targets))
                match = dan_result.get(target)
                if match and match["kind"] in ("zh", "说明"):
                    entry = dict(match, name=key, type=meta["type"], count=meta["count"], source=f"Gelbooru unique alias → {target} → {match['source']}")
                else:
                    kind = "原名/身份标注" if meta["type"] in (1, 3, 4) else "缺口"
                    entry = {"name": key, "type": meta["type"], "count": meta["count"],
                             "translation": key if kind == "原名/身份标注" else "", "kind": kind,
                             "source": "原始标签" if kind == "原名/身份标注" else ""}
            else:
                kind = "原名/身份标注" if meta["type"] in (1, 3, 4) else "缺口"
                entry = {"name": key, "type": meta["type"], "count": meta["count"],
                         "translation": key if kind == "原名/身份标注" else "", "kind": kind,
                         "source": "原始标签" if kind == "原名/身份标注" else ""}
        result[key] = entry
    return result


def write_table(path, rows):
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "translation", "kind", "source"], extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows.values())


def write_gaps(rows):
    for path in (CACHE / "translation-gaps.csv", RES / "zh-open-gaps.csv"):
        with path.open("w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f, lineterminator="\n")
            w.writerow(["site", "name", "type", "count", "source"])
            for site, mapping in (("danbooru", DAN_OUT), ("gelbooru", GEL_OUT)):
                for row in mapping.values():
                    if row["kind"] == "缺口":
                        w.writerow([site, row["name"], row["type"], row["count"], row["source"]])


def write_summary():
    labels = {0: "通用", 1: "画师", 3: "作品", 4: "角色", 5: "元信息"}
    for path in (CACHE / "translation-summary.csv", RES / "zh-dictionary-summary.csv"):
        with path.open("w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f, lineterminator="\n")
            w.writerow(["site", "type", "category", "total", "zh", "notes", "identity", "gaps", "source_counts_json"])
            for site, mapping in (("danbooru", DAN_OUT), ("gelbooru", GEL_OUT)):
                by_type = defaultdict(list)
                for row in mapping.values():
                    by_type[row["type"]].append(row)
                for typ, rows in sorted(by_type.items()):
                    kinds = Counter(row["kind"] for row in rows)
                    def source_bucket(value):
                        value = value or "未标注"
                        if value.startswith("research-030/"):
                            return value.split(":", 1)[0]
                        for filename in ("zh-priority-gel.csv", "zh-tail-lexicon.csv", "zh-tail-names.csv", "zh-character-context.csv",
                                         "zh-artist-context.csv", "zh-dan-last.csv", "zh-final-gaps.csv"):
                            if value.startswith(filename + ":"):
                                return filename
                        if value.startswith("Gelbooru unique alias → "):
                            tail = value.rsplit(" → ", 1)[-1]
                            while tail.startswith(("Danbooru exact key → ", "Gelbooru unique alias → ")):
                                tail = tail.rsplit(" → ", 1)[-1]
                            return "Gelbooru unique alias / " + tail
                        if value.startswith("Danbooru exact key → "):
                            tail = value.rsplit(" → ", 1)[-1]
                            while tail.startswith(("Danbooru exact key → ", "Gelbooru unique alias → ")):
                                tail = tail.rsplit(" → ", 1)[-1]
                            return "Danbooru exact key / " + tail
                        if value.startswith("Danbooru exact same-key/type shared term → "):
                            return "Exact same-key/type cross-site fallback"
                        return value
                    sources = Counter(source_bucket(row["source"]) for row in rows)
                    w.writerow([site, typ, labels.get(typ, "其他"), len(rows), kinds["zh"], kinds["说明"],
                                kinds["原名/身份标注"], kinds["缺口"], json.dumps(dict(sorted(sources.items())), ensure_ascii=False)])


def verify_parser_parity():
    code = "import fs from 'node:fs'; import {importRows,parseCSV} from './core/csv.mjs'; " \
           "for (const site of ['danbooru','gelbooru']) { " \
           "const source=importRows(fs.readFileSync(`resources/${site}.csv`,'utf8')).entries.map(x=>x.name); " \
           "const built=parseCSV(fs.readFileSync(`resources/zh-${site}.csv`,'utf8')).slice(1).map(x=>x[0]?.trim()).filter(x=>x&&x.length<=500&&!/[\\r\\n]/.test(x)); " \
           "console.log(JSON.stringify({site,source,built})); }"
    payload = subprocess.check_output(["node", "--input-type=module", "-e", code], cwd=ROOT, text=True, encoding="utf-8")
    for line in payload.splitlines():
        obj = json.loads(line)
        source, built = set(obj["source"]), set(obj["built"])
        if source != built:
            raise RuntimeError(f"{obj['site']} parser key mismatch: input-only={sorted(source-built)[:5]}, output-only={sorted(built-source)[:5]}")
        print(f"{obj['site']} core/csv.mjs key parity: {len(source)} == {len(built)}")


if __name__ == "__main__":
    seed = get_seed()
    ame, ff = read_ame(), read_ffdkj()
    proper, gloss = read_proper(), read_gloss()
    dan, gel = read_booru(RES / "danbooru.csv"), read_booru(RES / "gelbooru.csv")
    reviewed = reviewed_map(dan, RES / "zh-dan-reviewed.csv")
    gel_reviewed = reviewed_map(gel, RES / "zh-gel-reviewed.csv")
    DAN_OUT = make_dan(dan, seed, reviewed, ame, ff, proper, gloss)
    GEL_OUT = make_gel(gel, dan, DAN_OUT, ame, ff, proper, gel_reviewed, gloss)
    apply_contexts(DAN_OUT, GEL_OUT, dan, gel)
    inherit_shared_misses(DAN_OUT, GEL_OUT)
    apply_research_040(DAN_OUT, GEL_OUT)
    write_table(RES / "zh-danbooru.csv", DAN_OUT)
    write_table(RES / "zh-gelbooru.csv", GEL_OUT)
    write_gaps({})
    write_summary()
    verify_parser_parity()
    print(f"Danbooru: {len(dan)} rows, {sum(x['kind']=='缺口' for x in DAN_OUT.values())} gaps")
    print(f"Gelbooru: {len(gel)} rows, {sum(x['kind']=='缺口' for x in GEL_OUT.values())} gaps")
    print(f"Luna reviewed exact keys used: {len(reviewed)}")
    print(f"Gelbooru Luna reviewed exact keys used: {len(gel_reviewed)}")
