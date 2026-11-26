"""Create evidence-bearing research slices 0 and 1 from fixed 0.3.0 gaps."""
import csv
import hashlib
import json
import re
import sqlite3
from collections import defaultdict
from pathlib import Path

ROOT = Path(".")
OUT = Path("scripts/zh-inputs/research-030")

def read(path, fields=None):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f, fieldnames=fields))

def has_han(text):
    return bool(re.search(r"[㐀-鿿]", text or ""))

def has_chinese_translation(text):
    return has_han(text) and not re.search(r"[぀-ヿ]", text or "")

inputs = read(OUT / "gaps.csv")
assigned = [r for r in inputs if r["site"] == "gelbooru" and
            int(hashlib.sha256(r["name"].encode("utf-8")).hexdigest()[:8], 16) % 6 in (2, 3)]
gel_rows = read("resources/gelbooru.csv", ["name", "type", "count", "aliases"])
gel = defaultdict(list)
for r in gel_rows:
    gel[r["name"]].append(r)
hf_rows = read(".cache/zh/gelbooru-09-09-2025.csv", ["name", "type", "count", "aliases"])
hf = {r["name"]: r for r in hf_rows}
wiki_by_key = {}
wiki_aliases = defaultdict(list)
for line in open(".cache/zh/danbooru-wiki-2026-04-28.jsonl", encoding="utf-8"):
    item = json.loads(line)
    key = item["title"].strip().lower().replace(" ", "_")
    wiki_by_key.setdefault(key, item)
    for alias in item.get("other_names", []):
        alias_key = alias.strip().lower().replace(" ", "_")
        if alias_key:
            wiki_aliases[alias_key].append(item)

# Licensed tag dictionary rows with explanatory notes and aliases.
ame = defaultdict(list)
for filename in ("ame-general.csv", "ame-meta.csv", "ame-artist.csv",
                 "ame-copyright.csv", "ame-character.csv"):
    for r in read(Path(".cache/zh") / filename):
        ame[r["tag"]].append((filename, r))

# Full MIT tag lookup is useful only together with identity/context corroboration.
db = sqlite3.connect(".cache/zh/ffdkj.sqlite")
ff = {r[0]: {"category": str(r[1]), "translation": r[2], "count": str(r[3])}
      for r in db.execute("select name, category, cn_name, post_count from tags")}
db.close()
proper = {r["name"]: r for r in read(".cache/zh/proper-extra.csv")}
story = {r["character_tag"]: r for r in read(".cache/zh/story-character-corrected.csv")}
artist_rows = read(".cache/zh/story-artist.csv")
story_artist = {r.get("画师", ""): r for r in artist_rows if r.get("画师")}
dan_rows = read("resources/danbooru.csv", ["name", "type", "count", "aliases"])
dan = {r["name"]: r for r in dan_rows}
dan_aliases = defaultdict(set)
for r in dan_rows:
    for a in r["aliases"].split(","):
        if a.strip():
            dan_aliases[a.strip()].add(r["name"])
zh_dan = {r["name"]: r for r in read("resources/zh-danbooru.csv") if r["translation"]}
reviewed = {r["name"]: r for r in read("resources/zh-gel-reviewed.csv")}
extra = {r["name"]: r for r in read(".cache/zh/general-extra.csv")}
zh_gel = {r["name"]: r for r in read("resources/zh-gelbooru.csv")}

# Independently read short definitions for high-frequency wiki entries and
# unambiguous ordinary terms. This dictionary records exact tag meanings, not
# guessed transliterations of unverified names.
manual_wiki = {
    "moon_symbol": "月亮符号",
    "cockroach_boy": "蟑螂男孩（以蟑螂为原型的节肢动物少年）",
    "dick_nipples": "阴茎乳头",
    "polar_chaldea_uniform": "极地迦勒底制服（旧合并标签，现按男女角色分别标注）",
    "lostroom_outfit_(fate)": "Lostroom服装（旧合并标签，现按角色分别标注）",
    "tropical_summer_(fate)": "热带夏日服装（Fate角色的旧合并标签）",
    "brilliant_summer": "闪耀夏日服装（Fate角色的旧合并标签）",
    "chocolate_heaven_(fate/grand_order)": "《Fate/Grand Order》礼装“Chocolate Heaven”（旧合并标签，现拆分为伽摩与帕尔瓦蒂的服装标签）",
    "angle": "角度（含镜头角度、透视等不同含义，需按画面使用具体标签）",
    "nut": "坚果／螺母（同名歧义，按画面判定）",
    "hall": "大厅（指建筑通道时应使用 hallway）",
    "purple_swim_briefs": "紫色泳裤",
    "gap": "间隙／缺口（宽泛歧义词，需按具体复合标签判定）",
    "condiment": "调味品（旧宽泛标签，站点词条不建议使用）",
    "circumcision": "割礼（切除阴茎包皮的医疗/宗教仪式）",
    "golden_hair": "金色头发（旧宽泛标签，词条建议按实际发色细分）",
    "unworn_sandal": "未穿着的凉鞋（需与只穿一只凉鞋区分）",
    "unknown": "未知（不可用于待确认的画师、角色或作品）",
    "therianthrope": "兽化人（旧宽泛标签，现应按兽人、兽耳等具体题材标注）",
    "rupee": "卢比（亚洲货币；《塞尔达传说》等作品的虚构货币另有专用标签）",
    "manhua": "中国漫画",
    "court": "法庭／庭院／球场（同名歧义，按具体场景区分）",
    "yellow_obi": "黄色腰带",
    "bra_only": "仅穿胸罩、下身未着衣",
    "kenya": "肯尼亚",
    "heresy_(warhammer)": "《战锤40,000》世界观中的异端行为",
    "arca.live": "韩国图片论坛 Arca.live",
    "otsushimai": "成人向CG插画集《Otsushimai》",
    "snow_man_(jpop)": "日本男子偶像组合 Snow Man",
    "smith_&_wesson_model_59": "史密斯威森59型半自动手枪",
    "smith_&_wesson_model_66": "史密斯威森66型不锈钢左轮手枪",
    "ragprof": "《仙境传说》角色档案绘制活动（RAGPROF）",
    "tenniel_(arcaea)": "Tenniel（《Arcaea》支线剧情角色、可游玩搭档）",
    "cassian_floros": "Cassian Floros（First Stage Production所属VTuber）",
    "mona_meria": "Mona Meria（日本独立VTuber）",
    "felyne_(cosplay)": "《怪物猎人》艾路猫的Cosplay",
    "summercat": "Summercat（与 dream.cat 共用账号的画师）",
    "x<": "X<（由 >_< 与 :< 组合而成的表情符号）",
    "purple_swim_briefs": "紫色泳裤",
    "golden_hair": "金色头发（旧宽泛标签，词条建议按实际发色细分）",
    "manhua": "中国漫画",
    "arcade": "街机厅／游乐场（如有词条）",
}

def story_zh_alias(r):
    aliases = [x.strip() for x in (r.get("other_names") or "").split(",")]
    return next((x for x in aliases if has_han(x) and not re.search(r"[぀-ヿ]", x)), "")

def source_for_ame(name):
    entries = ame.get(name, [])
    # Exact key + a non-empty sourced explanation is an identity check even
    # when the source site classified the item differently.
    for filename, r in entries:
        if r["zh"].strip() and r.get("notes", "").strip():
            return filename, r
    return None

def decide(r):
    name, category, count = r["name"], r["type"], r["count"]
    gel_info = f"Gelbooru 2026 local tag: category={category}, posts={count}"
    hf_info = (f"HDiffusion Gel tag snapshot 2025-09: category={hf[name]['type']}, "
               f"posts={hf[name]['count']}" if name in hf else "HDiffusion Gel snapshot: key absent")
    gel_types = {x["type"] for x in gel[name]}
    wiki = wiki_by_key.get(name.lower())
    wiki_relation = "exact title"
    if wiki is None and len(wiki_aliases.get(name.lower(), [])) == 1:
        wiki = wiki_aliases[name.lower()][0]
        wiki_relation = "unique Danbooru wiki other_names alias"
    wiki_info = (f"Danbooru wiki {wiki_relation}={wiki['title']!r}, id={wiki['id']}, "
                 f"category={wiki['category_name']}; body begins: "
                 f"{re.sub(r'\s+', ' ', wiki['body'])[:240]}" if wiki else "")

    # Verified original Gel duplicates provide direct same-site referent evidence.
    if name == "tolkien's_legendarium" and {"0", "3"} <= gel_types:
        return ("托尔金传说集", "work-name",
                f"{gel_info}; same Gel key also exists as copyright type 3; "
                f"{hf_info}; ffdkj.sqlite exact name, category=3; amenorira/ame-copyright.csv exact key and notes",
                "confirmed")
    if name == "tomoe_(queen's_blade)" and {"0", "4"} <= gel_types:
        a = source_for_ame(name)
        trans = a[1]["zh"] if a else "巴"
        return (trans, "character-name",
                f"{gel_info}; same Gel key also exists as character type 4; {hf_info}; "
                "amenorira/ame-character.csv exact key and note identifies Queen's Blade",
                "confirmed")

    if name in manual_wiki:
        return (manual_wiki[name], "wiki-meaning",
                f"{gel_info}; {wiki_info or hf_info}; independently translated from "
                "the exact English tag and cited definition/ordinary lexical components",
                "confirmed")

    # Priority evidence requested for the high-frequency card-gallery tag.
    if name == "taimanin_asagi_battle_arena_all_card_gallery":
        return ("Taimanin Asagi: Battle Arena \u6e38\u620f\u89d2\u8272\u5361\u9762\u56fe\u50cf\u6807\u7b7e", "game-card-art-use",
                f"{gel_info}; TBIB posts https://tbib.org/index.php?id=7617731&page=post&s=view and https://tbib.org/index.php?id=7617757&page=post&s=view both tag card_(blue), taimanin_asagi_battle_arena, and taimanin_asagi_battle_arena_all_card_gallery; related posts https://tbib.org/index.php?id=5956583&page=post&s=view and https://tbib.org/index.php?id=5956603&page=post&s=view likewise tag character card imagery; this supports a card-image subject/use label for the same-named game, not a published gallery claim. Game title independently corroborated by MobyGames Taimanin Asagi: Battle Arena and Taimanin Wiki Battle Arena page.", "confirmed")

    # The frozen Gel export itself contains a second category for the same exact key.
    if name == "fast_&_furious" and {"0", "3"} <= gel_types:
        a = source_for_ame(name)
        return (a[1]["zh"] if a else "\u901f\u5ea6\u4e0e\u6fc0\u60c5", "film-franchise",
                f"{gel_info}; same exact Gel key also appears as copyright category=3 in resources/gelbooru.csv; amenorira ame-copyright.csv exact key has Chinese title and explanatory notes identifying the film franchise; {hf_info}.", "confirmed")
    if name == "leina_(queen's_blade)" and {"0", "4"} <= gel_types:
        a = source_for_ame(name)
        return (a[1]["zh"] if a else "\u857e\u5a1c\uff08\u5973\u738b\u4e4b\u5203\uff09", "character-name",
                f"{gel_info}; same exact Gel key also appears as character category=4 in resources/gelbooru.csv; amenorira ame-character.csv exact key and notes identify Leina as a wandering warrior from Queen's Blade; {hf_info}.", "confirmed")

    # Individually checked common-language and official-source cases.
    manual = {
        "holy_grail": ("\u5723\u676f\uff08\u4e2d\u4e16\u7eaa\u4f20\u8bf4\u4e2d\u7684\u4f20\u5947\u5723\u5668\uff09", "\u8bf4\u660e",
                       "Exact English lexical match; Catholic Encyclopedia identifies the Holy Grail as a legendary sacred vessel in medieval romance: https://www.newadvent.org/cathen/06719a.htm"),
        "lmao": ("\u7b11\u6b7b\u6211\u4e86\uff08\u7f51\u7edc\u7528\u8bed\uff0c\u662f laughing my ass off \u7684\u7f29\u5199\uff09", "zh",
                 "Cambridge English-Chinese Dictionary exact slang entry: https://dictionary.cambridge.org/dictionary/english-chinese-simplified/lmao; Danbooru wiki lmao points to laughing."),
        "hand_in_lap": ("\u624b\u653e\u5728\u817f\u4e0a", "zh",
                        "Compositional pose phrase; Cambridge defines lap as the top of the legs while seated: https://dictionary.cambridge.org/us/dictionary/english/lap"),
        "exhaustion": ("\u7cbe\u75b2\u529b\u7aed", "zh",
                       "Oxford Learner's Dictionaries: the state of being very tired: https://www.oxfordlearnersdictionaries.com/us/definition/english/exhaustion"),
        "shoebox": ("\u978b\u76d2", "zh",
                    "Oxford Learner's Dictionaries shoebox entry (a box for shoes): https://www.oxfordlearnersdictionaries.com/us/definition/english/shoebox"),
        "unity_(medium)": ("Unity \u5f15\u64ce\u5236\u4f5c\u7684\u56fe\u50cf/\u52a8\u753b\u5a92\u4ecb", "\u8bf4\u660e",
                           "Exact Danbooru wiki page says this tag covers artwork rendered or created with the Unity Engine; Unity official game-development page: https://unity.com/games"),
        "ziku_driver": ("Ziku Driver\uff08\u300a\u5047\u9762\u9a91\u58eb Zi-O\u300b\u53d8\u8eab\u8170\u5e26\uff09", "\u8bf4\u660e",
                        "Bandai official Kamen Rider belts article names the DX Ziku Driver and links it to Zi-O: https://www.bandai.com/News/post/latest-news/kamen-rider-belts-coming-2021; Bandai official toy portal: https://toy.bandai.co.jp/en/series/rider/topics/01_19041/"),
        "metalcluster_hopper": ("\u5047\u9762\u9a91\u58eb Zero-One \u7684 MetalCluster Hopper \u5f62\u6001", "\u8bf4\u660e",
                               "Toei Kamen Rider official page names Zero-One MetalCluster Hopper and describes Aruto's transformation using the Zero-One Driver and key: https://www.kamen-rider-official.com/zero-one/24/weekly_items/39"),
        "m_bison_(cosplay)": ("M. Bison\uff08\u300a\u8857\u5934\u9738\u738b\u300b\u89d2\u8272\uff09\u624e\u626e", "\u8bf4\u660e",
                              "The tag explicitly marks cosplay; Capcom's official Street Fighter V character data identifies M. Bison: https://game.capcom.com/cfn/sfv/character/mbison?lang=en"),
        "heroic_spirit_festival_outfit": ("\u300aFate/Grand Order\u300b\u56db\u5468\u5e74\u9650\u5b9a\u6982\u5ff5\u793c\u88c5\u300c\u82f1\u7075\u796d\u88c5\u300d\u89d2\u8272\u5361\u9762\u7cfb\u5217", "\u8bf4\u660e",
                                          "Exact Danbooru wiki body identifies 39 summer 2019 CEs for FGO's fourth anniversary, each showing a Servant in a festival-themed outfit; official FGO news confirms 39 newly drawn limited 英霊祭装 illustrations: https://news.fate-go.jp/2019/4th_eireisaisou/"),
        "fender_(company)": ("Fender \u4e50\u5668\u5236\u9020\u4e0e\u97f3\u4e50\u79d1\u6280\u516c\u53f8", "\u8bf4\u660e",
                            "Fender official About page identifies Fender Musical Instruments Corporation and its instruments/equipment business: https://www.fender.com/newsroom/about/"),
        "shikigami_(onmyou_taisenki)": ("\u300a\u9634\u9633\u5927\u6218\u8bb0\u300b\u4e2d\u7684\u5f0f\u795e\uff08\u4e0e\u6597\u795e\u58eb\u5e76\u80a9\u4f5c\u6218\u7684\u795e\u7075\uff09", "\u8bf4\u660e",
                                      "TV Tokyo's official Onmyou Taisenki glossary defines shikigami as deities who fight alongside tōjinshi: https://www.tv-tokyo.co.jp/anime/onmyo-taisenki/yougo.html"),
        "tentacle_fellatio": ("\u89e6\u624b\u53e3\u4ea4", "zh",
                             "Compositional compound; Cambridge defines fellatio as oral sexual stimulation of a penis: https://dictionary.cambridge.org/us/dictionary/english/fellatio"),
        "standing_paizuri": ("\u7ad9\u7acb\u5f0f\u4e73\u4ea4", "zh",
                             "Compositional tag; Tanoshii Japanese dictionary defines paizuri as breast sex: https://www.tanoshiijapanese.com/dictionary/entry_details.cfm?element_id=193502&entry_id=962"),
        "spectacles": ("\u773c\u955c", "zh",
                       "Exact Danbooru wiki other_names list has Chinese alias \u773c\u93e1; simplified in this dictionary as \u773c\u955c. Wiki body describes eyewear worn over the eyes for vision correction or fashion."),
        "insertion_clothing": ("\u9694\u7740\u8863\u7269\u63d2\u5165\uff08\u6027\u884c\u4e3a\uff09", "\u8bf4\u660e",
                               "Direct composition of the explicit tag words insertion + clothing; translates penetration occurring through clothing without inferring a specific body part."),
        "inminent_sex": ("\u5373\u5c06\u53d1\u751f\u6027\u884c\u4e3a", "\u8bf4\u660e",
                         "Gelbooru snapshot contains same-category canonical spelling imminent_sex (category=0); inminent_sex is a one-letter spelling variant. Imminent means about to happen; translated only as impending sexual activity."),
        "womb_stimulation": ("\u5b50\u5bab\u523a\u6fc0", "zh",
                             "Direct English compound meaning stimulation of the womb; exact category-0 tag and phrase components are explicit."),
        "no_areolae": ("\u65e0\u4e73\u6655", "zh",
                       "Direct visual description: absence of areolae; exact English compound."),
        "female_fundoshi": ("\u5973\u6027\u7a7f\u515c\u88c6\u5e03", "\u8bf4\u660e",
                            "Direct tag composition; fundoshi is the garment named by the tag, and female specifies the wearer. No character identity inferred."),
        "arms_around_shoulders": ("\u624b\u81c2\u73af\u8fc7\u80a9\u8180", "zh",
                                  "Literal pose phrase, arms positioned around the shoulders."),
        "helical_magazine": ("\u87ba\u65cb\u5f39\u5323", "zh",
                             "Small Arms Survey handbook identifies helical drum magazines as a firearm magazine type: https://www.smallarmssurvey.org/sites/default/files/resources/A%20Guide%20to%20the%20Identification%20of%20Small%20Arms%20and%20Light%20Weapons%20%28WEB%29.pdf"),
        "carbine_cartridge": ("\u5361\u5bbe\u67aa\u67aa\u5f39", "zh",
                             "Direct technical compound: a cartridge/ammunition round for a carbine; the two component terms are explicit in the tag."),
        "yu-gi-oh_(card)": ("\u300a\u6e38\u620f\u738b\u300b\u5361\u724c", "\u8bf4\u660e",
                            "Exact tag names Yu-Gi-Oh! and card; Konami's Chinese-language official Yu-Gi-Oh! site uses \u300a\u6e38\u620f\u738b\u300b and describes the card game: https://www.konami.com/yugioh/masterduel/asia/zh-cn/"),
        "kronii_ouro": ("Ouro Kronii\uff08hololive -Promise- \u865a\u62df\u4e3b\u64ad\uff09", "\u8bf4\u660e",
                        "The reversed-name tag uniquely maps to Danbooru alias ouro_kronii; official hololive profile identifies Ouro Kronii as a talent in hololive -Promise-: https://hololive.hololivepro.com/en/talents/ouro-kronii/"),
        "get": ("\u56fe\u4e2d\u51fa\u73b0\u201cget\u201d\u5b57\u6837\uff08\u6807\u8bb0\u753b\u5185\u6587\u5b57\uff09", "\u8bf4\u660e",
                "Exact Danbooru wiki body: the text \"get\" (or Japanese \"get\") is in the picture; this is an on-image text tag."),
    }
    if name in manual:
        t, k, evidence = manual[name]
        return (t, k, f"{gel_info}; {evidence}", "confirmed")
    if name == "kashagiri's_cat_(touken_ranbu)":
        return ("\u706b\u8f66\u5207\u7684\u732b\uff08\u300a\u5200\u5251\u4e71\u821e\u300b\uff09", "\u8bf4\u660e",
                f"{gel_info}; exact StoryAura tag row links this label to Touken Ranbu; official Touken Ranbu identifies Kashagiri as 火車切: https://www.toukenranbu.jp/character/228/; the tag wording means the cat associated with Kashagiri and does not establish a separate cat name.", "confirmed")
    if name == "joseph_(smell)":
        return ("", "\u7f3a\u53e3",
                f"Checked {gel_info}; StoryAura exact character row marks copyright original/unspecified and has no alternate name; ffdkj.sqlite exact key is category=4 but its Chinese rendering reads Joseph (smell) and does not explain whether smell is a work, source, or ordinary word; no exact Danbooru wiki page or corroborating work relation found. With the name/source relation unresolved, do not translate smell as a role or title.", "unresolved")

    # Hand-reviewed high-frequency Gel translations already authored in this project.
    if name in extra and extra[name]["type"].endswith("manual-reviewed"):
        return (extra[name]["translation"], "site-wiki-translation",
                f"{gel_info}; Luna manual review in .cache/zh/general-extra.csv", "confirmed")
    if name in reviewed:
        return (reviewed[name]["translation"], "site-wiki-translation",
                f"{gel_info}; Luna reviewed glossary in resources/zh-gel-reviewed.csv", "confirmed")

    # Direct amenorira entries carry explanatory notes and stable names/aliases.
    a = source_for_ame(name)
    if a:
        filename, src = a
        t = src["zh"].strip()
        note = re.sub(r"\s+", " ", src.get("notes", "")).strip()
        # If the source's display name is only the English key, use its Chinese
        # note as a factual short gloss rather than passing the English through.
        meaning_kind = "localized-name"
        if not has_chinese_translation(t) and has_chinese_translation(note):
            t = note.split("；")[0].split("。")[0].strip()
            meaning_kind = "source-note"
        if t and has_chinese_translation(t):
            return (t, meaning_kind,
                    f"{gel_info}; {filename} exact key; source category={src['category']}; "
                    f"source notes: {note}; {wiki_info or hf_info}", "confirmed")

    # StoryAura character row identifies the character and its copyright or
    # documented alternate name; a separate localized source supplies Chinese.
    if name in story:
        s = story[name]
        ch = story_zh_alias(s)
        f = ff.get(name, {})
        trans = f.get("translation", "")
        if has_chinese_translation(trans):
            return (trans, "character-name",
                    f"{gel_info}; StoryAura exact character_tag={name}, "
                    f"copyright={s.get('copyright') or 'original/unspecified'}, "
                    f"alternate names={s.get('other_names') or 'none'}; "
                    f"ffdkj.sqlite exact key, category={f.get('category')}; "
                    f"{wiki_info or hf_info}", "confirmed")
        if has_chinese_translation(ch):
            return (ch, "character-name",
                    f"{gel_info}; StoryAura exact character_tag={name}, "
                    f"copyright={s.get('copyright') or 'original/unspecified'}; "
                    f"Chinese Han alias in other_names; {wiki_info or hf_info}", "confirmed")

    # A direct wiki page, together with a separately localized source, resolves
    # category-crossing names while preserving the wiki's actual intended sense.
    f = ff.get(name)
    if wiki and f and has_chinese_translation(f["translation"]):
        return (f["translation"], "wiki-identified-name",
                f"{gel_info}; {wiki_info}; ffdkj.sqlite exact key/category={f['category']}",
                "confirmed")
    if wiki:
        aliases = [x.strip() for x in wiki.get("other_names", []) if has_chinese_translation(x)]
        if aliases:
            return (aliases[0], "wiki-documented-Chinese-alias",
                    f"{gel_info}; {wiki_info}; Chinese alias from Danbooru wiki other_names",
                    "confirmed")

    # The reviewed name table is constrained to exact character matches.
    if name in proper and proper[name]["translation"]:
        return (proper[name]["translation"], "character-name",
                f"{gel_info}; proper-extra.csv exact name/category={proper[name]['type']}; "
                "curated Chinese character-name match", "confirmed")

    # For artists, only accept a Han transliteration explicitly listed as the
    # artist's localized name, not a raw Roman/Japanese spelling.
    if name in story_artist:
        tr = story_artist[name].get("译名", "").strip()
        if has_chinese_translation(tr):
            return (tr, "artist-name",
                    f"{gel_info}; StoryAura artist exact name with Chinese 译名; {hf_info}",
                    "confirmed")

    # Same-category exact tag translations are semantically safe; mismatched
    # categories require context above and are deliberately not auto-carried.
    f = ff.get(name)
    if f and f["category"] == category and has_chinese_translation(f["translation"]):
        return (f["translation"], "same-category-tag-name",
                f"{gel_info}; ffdkj.sqlite exact name/category={category}; {hf_info}",
                "confirmed")

    # Record the actual cross-site candidate without propagating it.
    candidates = []
    if f:
        candidates.append(f"ffdkj exact key/category={f['category']} gives {f['translation']!r}")
    if a:
        candidates.append(f"{a[0]} exact key/category={a[1]['category']} gives {a[1]['zh']!r}")
    if name in story:
        s = story[name]
        candidates.append(f"StoryAura exact character row copyright={s.get('copyright')!r}, "
                          f"aliases={s.get('other_names')!r}")
    if name in dan:
        candidates.append(f"Danbooru exact key/category={dan[name]['type']}")
    if wiki:
        candidates.append(wiki_info)
    if len(dan_aliases.get(name, set())) == 1:
        canonical = next(iter(dan_aliases[name]))
        candidates.append(f"Danbooru unique alias candidate={canonical!r}")
    why = "; ".join(candidates) if candidates else (
        "no exact Chinese name/meaning found in ffdkj.sqlite, amenorira tables, "
        "StoryAura name tables, or reviewed project glossaries")
    return ("", "identity-unresolved",
            f"Checked {gel_info}; {hf_info}; {why}. "
            "Wiki/title and alias context were checked where present; the source does not provide "
            "a dependable Chinese name/short meaning. Need a localized name or a clearer "
            "Gel post/wiki context; exact cross-category spelling alone is insufficient.",
            "unresolved")

for shard in (2, 3):
    rows = []
    for r in assigned:
        n = r["name"]
        if int(hashlib.sha256(n.encode("utf-8")).hexdigest()[:8], 16) % 6 != shard:
            continue
        translation, kind, source, status = decide(r)
        if status == "unresolved":
            kind = "缺口"
        elif kind in ("same-category-tag-name", "site-wiki-translation",
                      "character-name", "localized-name",
                      "wiki-documented-Chinese-alias", "wiki-identified-name",
                      "artist-name"):
            kind = "zh"
        elif kind in ("name-with-source-note", "source-note", "wiki-meaning",
                      "film-franchise", "game-card-art-use", "work-name"):
            kind = "说明"
        else:
            kind = "原名/身份标注"
        if status == "confirmed":
            translation = translation.replace("_", " ").replace("\u773c\u93e1", "\u773c\u955c")
        rows.append({
            "site": "gelbooru", "name": n, "type": r["type"],
            "translation": translation, "kind": kind, "source": source, "status": status
        })
    rows.sort(key=lambda x: (-int(next(r["count"] for r in assigned if r["name"] == x["name"])), x["name"]))
    target = OUT / f"gel-{shard}.csv"
    with open(target, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["site", "name", "type", "translation",
                                          "kind", "source", "status"])
        w.writeheader()
        w.writerows(rows)
    print(f"shard={shard} rows={len(rows)} confirmed={sum(x['status']=='confirmed' for x in rows)} "
          f"unresolved={sum(x['status']=='unresolved' for x in rows)} file={target}")

