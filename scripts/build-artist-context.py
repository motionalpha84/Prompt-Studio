#!/usr/bin/env python3
"""Build artist lookup context from pinned licensed data and local tag aliases.

All non-Chinese personal-name forms are labeled as recorded forms, not translations.
Danbooru tag aliases are usable only on Danbooru; no cross-site propagation occurs.
"""
import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HAN = re.compile(r"[\u3400-\u9fff\uf900-\ufaff]")
KANA = re.compile(r"[\u3040-\u30ff]")

def read(path, fields=None):
    with path.open(encoding="utf-8-sig", newline="") as f:
        if fields:
            return list(csv.DictReader(f, fieldnames=fields))
        return list(csv.DictReader(f))

ame = {r["tag"]: r for r in read(ROOT / "scripts/zh-inputs/ame-artist.csv")
       if r.get("tag") and r.get("category") == "1"}
dan = read(ROOT / "resources/danbooru.csv", ["name", "type", "count", "aliases"])
gel = read(ROOT / "resources/gelbooru.csv", ["name", "type", "count", "aliases"])
by_key = {}

# Preserve source-backed amenorira context, but call every name form an
# annotation. A Han-only string is not assumed to be Chinese or a person's name.
for site, tags in (("danbooru", dan), ("gelbooru", gel)):
    for tag in tags:
        name = tag["name"].strip()
        if tag["type"] != "1" or name not in ame:
            continue
        row = ame[name]
        zh = row.get("zh", "").strip()
        note = row.get("notes", "").strip()
        aliases = [a.strip() for a in row.get("aliases", "").split("|") if a.strip()]
        if note and HAN.search(note):
            translation, detail = f"{name}（来源备注：{note}）", "amenorira notes"
        elif zh and HAN.search(zh):
            # Kana-bearing entries are often Japanese display spellings; keep
            # those visible as evidence, but never promote them to translation.
            label = "来源中文字段" if not KANA.search(zh) else "来源署名字段"
            translation, detail = f"{name}（{label}记录：{zh}）", "amenorira zh field"
        else:
            alias = next((a for a in aliases if HAN.search(a)), "")
            if not alias:
                continue
            translation, detail = f"{name}（来源别名字段记录：{alias}）", "amenorira aliases"
        by_key[(site, name)] = [site, name, "1", translation, "说明",
                                f"amenorira/ame-artist.csv@8e73f3b1c15b30f873c11a8c65d2d8264cdf0224; exact tag+category=1; {detail}"]

# The local Danbooru archive has an explicit alias column. Emit all source-backed
# same-site type-1 candidate facts. The final dictionary builder decides whether
# its current value is only an identity marker before applying this context.
alias_rows = 0
for tag in dan:
    name = tag["name"].strip()
    if tag["type"] != "1":
        continue
    aliases = []
    for alias in tag.get("aliases", "").split(","):
        alias = alias.strip()
        if alias and alias.casefold() != name.casefold() and alias not in aliases:
            aliases.append(alias)
    if not aliases:
        continue
    # Keep a bounded note while retaining the source's first recorded aliases.
    displayed = aliases[:8]
    translation = f"{name}（Danbooru 收录的署名别名：{'、'.join(displayed)}）"
    key = ("danbooru", name)
    alias_source = ("DraconicDragon/dbr-e621-lists-archive commit b46f08e5bc5ff98063c1f955786c43850a94b7c0; "
                    "danbooru_2026-10-01_pt20-ia-dd.csv (Unlicense); exact local name/type=1; archived alias column")
    if key in by_key:
        by_key[key][3] = by_key[key][3][:-1] + f"；Danbooru 收录署名别名：{'、'.join(displayed)}）"
        by_key[key][5] += "; " + alias_source
    else:
        by_key[key] = ["danbooru", name, "1", translation, "说明", alias_source]
    alias_rows += 1

out = list(by_key.values())
target = ROOT / "resources/zh-artist-context.csv"
with target.open("w", encoding="utf-8-sig", newline="") as f:
    writer = csv.writer(f, lineterminator="\n")
    writer.writerow(["site", "name", "type", "translation", "kind", "source"])
    writer.writerows(out)
print(f"{len(out)} unique candidate rows -> {target}; source-backed Danbo artist alias rows={alias_rows}")
