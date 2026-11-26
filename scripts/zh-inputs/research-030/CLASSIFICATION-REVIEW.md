# 0.4.0 研究分片分类复核

## 分类修正

Gel 分片生成脚本曾把 `character-name`、`localized-name`、`wiki-documented-Chinese-alias`、`wiki-identified-name` 和 `artist-name` 这些已确认中文名统一落入“原名/身份标注”。这与来源内容矛盾。现将这些经同键来源支持的中文名称标为 `zh`，将 `source-note`、作品用途等说明性内容保留为“说明”；未确认项仍为缺口。生成脚本 `build-gel-23.py`、`build-gel-45.py` 已同步修正映射。

改动前 4 个分片确认身份数：gel-2 280、gel-3 273、gel-4 275、gel-5 259，共 1,087。现在这些分片不再把确认的中文译名标作身份；对照最终审计，最终输出身份项由 1,323 降为 237，`zh` 由 840 增为 1,926，说明由 1,257 增为 1,259，缺口由 2,206 降为 2,204。最终身份剩余 237 项来自 `extra-artists.csv` 235 条和 `extra-lexical.csv` 2 条，而非上述误分片记录。

下面 40 项来自原来被标成身份的各片高频记录，分别抽取每片 10 项。来源列保留同名 amenorira / ffdkj / Danbooru wiki / StoryAura 证据。

## gel-2（10 项）

| name | translation | source evidence |
|---|---|---|
| `namipon_(wuthering_waves)` | 波仔（鸣潮） | Gelbooru 2026 local tag: category=0, posts=293; ame-character.csv exact key; source category=4 |
| `sovereign_(sekaiju)` | 君主（世界树的迷宫） | Gelbooru 2026 local tag: category=0, posts=190; ame-character.csv exact key; source category=4 |
| `dino_albani` | 迪诺·阿尔巴尼 | Gelbooru 2026 local tag: category=0, posts=185; ame-character.csv exact key; source category=4 |
| `honey_come_chatka!!` | 蜂蜜来聊聊！！ | Gelbooru 2026 local tag: category=0, posts=173; wiki exact-title evidence |
| `score` | 分数 | Gelbooru 2026 local tag: category=5, posts=141; ame-general.csv exact key; source category=0 |
| `holy_rouge` | 圣红玉 | Gelbooru 2026 local tag: category=0, posts=123; ame-character.csv exact key; source category=4 |
| `misaki_nako` | 岬奈子 | Gelbooru 2026 local tag: category=0, posts=120; ame-character.csv exact key; source category=4 |
| `cat_girl_(andaerz)` | 猫娘 | Gelbooru 2026 local tag: category=0, posts=119; ame-character.csv exact key; source category=4 |
| `hakkito_(banzoin_hakka)` | 哈基托（Banzoin Hakka） | Gelbooru 2026 local tag: category=0, posts=113; ame-character.csv exact key; source category=4 |
| `the_doctor_(doctor_who)` | 博士（神秘博士） | Gelbooru 2026 local tag: category=0, posts=109; ame-character.csv exact key; source category=4 |

## gel-3（10 项）

| name | translation | source evidence |
|---|---|---|
| `gundam_battle_operation_2` | 机动战士高达 战斗行动2 | Gelbooru 2026 local tag: category=0, posts=271; ame-copyright.csv exact key; source category=3 |
| `narby_(heaven_burns_red)` | 纳比（炽焰天穹） | Gelbooru 2026 local tag: category=0, posts=257; ame-character.csv exact key; source category=4 |
| `the_distortion_detective` | 扭曲侦探 | Gelbooru 2026 local tag: category=0, posts=246; ame-copyright.csv exact key; source category=3 |
| `pienna_(akane_lize)` | 皮恩娜 | Gelbooru 2026 local tag: category=0, posts=245; ame-character.csv exact key; source category=4 |
| `oscar_bale` | 奥斯卡·贝尔 | Gelbooru 2026 local tag: category=0, posts=167; ame-character.csv exact key; source category=4 |
| `kurusu_rin` | 来栖凛 | Gelbooru 2026 local tag: category=0, posts=142; ame-character.csv exact key; source category=4 |
| `tsui_no_sora` | 终之空 | Gelbooru 2026 local tag: category=0, posts=138; ame-copyright.csv exact key; source category=3 |
| `mizuha_(toraware_no_kami-sama)` | 瑞叶（被囚禁的神明与旅行少女） | Gelbooru 2026 local tag: category=0, posts=123; StoryAura exact character_tag=mizuha_(toraware_no_kami-sama), copyright=original/unspecified, alternate names=none; ffdkj.sqlite exact key, category=4; HDiffusion Gel snaps |
| `tama-jii` | 魂爷 | Gelbooru 2026 local tag: category=0, posts=121; ame-character.csv exact key; source category=4 |
| `d.o.c._health_drone` | D.O.C.医疗无人机 | Gelbooru 2026 local tag: category=0, posts=118; ame-character.csv exact key; source category=4 |

## gel-4（10 项）

| name | translation | source evidence |
|---|---|---|
| `serval_ears` | 薮猫耳 | Gelbooru 2026 local tag: category=0, posts=363; wiki exact-title evidence |
| `facebook` | 脸书 | Gelbooru 2026 local tag: category=0, posts=285; ame-copyright.csv exact key; source category=3 |
| `nea_(chihuri)` | 涅亚 | Gelbooru 2026 local tag: category=0, posts=285; ame-character.csv exact key; source category=4 |
| `itou_shinji_(chaos;child)` | 伊藤真二（混沌之子） | Gelbooru 2026 local tag: category=0, posts=279; ame-character.csv exact key; source category=4 |
| `mithrun_(young)` | 米斯伦（年轻时期） | Gelbooru 2026 local tag: category=0, posts=174; ame-character.csv exact key; source category=4 |
| `mario_(pripara)` | 马里奥（美妙天堂） | Gelbooru 2026 local tag: category=0, posts=152; ame-character.csv exact key; source category=4 |
| `komikado_sachi` | 小见门沙知 | Gelbooru 2026 local tag: category=0, posts=150; ame-character.csv exact key; source category=4 |
| `evey_(honkai:_star_rail)` | 伊薇（崩坏：星穹铁道） | Gelbooru 2026 local tag: category=0, posts=137; ame-character.csv exact key; source category=4 |
| `kanae_(tsukiman)` | 佳苗 | Gelbooru 2026 local tag: category=0, posts=137; ame-character.csv exact key; source category=4 |
| `cove_holden` | 科夫·霍尔登 | Gelbooru 2026 local tag: category=0, posts=123; ame-character.csv exact key; source category=4 |

## gel-5（10 项）

| name | translation | source evidence |
|---|---|---|
| `bokukawauso` | 我是水獭（舰队Collection） | Gelbooru 2026 local tag: category=0, posts=632; ame-character.csv exact key; source category=4 |
| `mahou_senshi_(series)` | 魔法战士系列 | Gelbooru 2026 local tag: category=0, posts=600; ame-copyright.csv exact key; source category=3 |
| `captain_america:_the_winter_soldier` | 美国队长2：冬日战士 | Gelbooru 2026 local tag: category=0, posts=302; ame-copyright.csv exact key; source category=3 |
| `ganusgil` | 加努斯吉尔 | Gelbooru 2026 local tag: category=0, posts=284; ame-character.csv exact key; source category=4 |
| `luo_shun_yao` | 洛舜瑶 | Gelbooru 2026 local tag: category=0, posts=278; ame-character.csv exact key; source category=4 |
| `yumenokessho` | 梦之结晶 | Gelbooru 2026 local tag: category=0, posts=266; ame-copyright.csv exact key; source category=3 |
| `pero_(wuthering_waves)` | 佩洛（鸣潮） | Gelbooru 2026 local tag: category=0, posts=181; ame-character.csv exact key; source category=4 |
| `keith_max` | 基思·马克斯 | Gelbooru 2026 local tag: category=0, posts=172; ame-character.csv exact key; source category=4 |
| `nonaka_kokona` | 野中心菜 | Gelbooru 2026 local tag: category=0, posts=150; ame-character.csv exact key; source category=4 |
| `lorentz_butterfly` | 洛伦兹·蝴蝶 | Gelbooru 2026 local tag: category=0, posts=148; ame-character.csv exact key; source category=4 |

## 复现检查

`python scripts/zh-inputs/research-030/merge-shards.py` 校验全部 5,626 个 key/type 覆盖及 Gel SHA 分片；随后 `python scripts/build-zh-dictionaries.py` 生成成品。构建器验证旧 0.3.0 非缺口 translation/kind/source 未改变，并调用 `core/csv.mjs` 检查两站键集合一致。Danbooru 与 Gelbooru 原始英文索引未更新。

## 指定高频样例复核

这些样例覆盖提出问题时列出的类别：作品译名、元标签释义、真实人物/角色名、虚构角色名和赛马名。它们都由对应的同键/wiki 或 StoryAura/amenorira 数据支持，按中文名称归 `zh`。

| name | translation | source evidence |
|---|---|---|
| `rusty_front` | 锈蚀前线 | Gelbooru 2026 local tag: category=0, posts=27; Danbooru wiki exact title='rusty_front', id=154873, category=Copyright; body begins: An original [[dieselpunk]]/[[military]] setting created by [[aoi waffle]], with contributions from other artists. Information on the setting is collected on a wiki page, with illustrations and a short animation depicting events and vehicles |
| `japanese_commentary` | 日文注释 | Gelbooru 2026 local tag: category=0, posts=44; ame-meta.csv exact key; source category=5 |
| `karasawa_takahiro` | 唐泽贵洋 | Gelbooru 2026 local tag: category=0, posts=30; StoryAura exact character_tag=karasawa_takahiro, copyright=real_life, alternate names=唐澤貴洋, 恒心教; ffdkj.sqlite exact key, category=4 |
| `theseus_(hades)` | 忒修斯（Hades） | Gelbooru 2026 local tag: category=0, posts=20; StoryAura exact character_tag=theseus_(hades), copyright=hades_(series), alternate names=none; ffdkj.sqlite exact key, category=4 |
| `sashihara_rino_(akb0048)` | 指原莉乃（AKB0048） | Gelbooru 2026 local tag: category=0, posts=20; StoryAura exact character_tag=sashihara_rino_(akb0048), copyright=akb0048, alternate names=7代目指原莉乃, 指原莉乃; ffdkj.sqlite exact key, category=4 |
| `muramasa_(phantom_of_the_kill)` | 村正（杀戮魅影） | Gelbooru 2026 local tag: category=0, posts=26; StoryAura exact character_tag=muramasa_(phantom_of_the_kill), copyright=phantom_of_the_kill, alternate names=ムラマサ, ムラマサ(ファンキル); ffdkj.sqlite exact key, category=4 |
| `shian_(synthesizer_v)` | 诗岸（Synthesizer V） | Gelbooru 2026 local tag: category=0, posts=26; StoryAura exact character_tag=shian_(synthesizer_v), copyright=synthesizer_v, alternate names=诗岸; ffdkj.sqlite exact key, category=4 |
| `meikei_yell_(racehorse)` | 名将飞燕（赛马） | Gelbooru 2026 local tag: category=0, posts=35; StoryAura exact character_tag=meikei_yell_(racehorse), copyright=original/unspecified, alternate names=メイケイエール; ffdkj.sqlite exact key, category=4 |

## 0.4.0 最终补充表集成

- `extra-proven.csv`：90 条 confirmed，90 条均被采用，且只填旧缺口。官方页面或 Gel 站内具体帖子语境是 source。
- `artist-md5-crosscheck.csv`：最终 843 条，815 confirmed、28 unresolved。与更新后的 `extra-artists.csv` 有 843 个同键同类交集：815 组 confirmed 翻译/kind 完全一致，28 组均 unresolved。该表给同图 Gel-Danbooru tag/profile 的逐张 MD5 对照；全部竞争来源保留在逐词审计中。最终选择了 829 行 MD5 记录（814 confirmed、15 unresolved）；其余项由更直接的核心来源或别表处理。
- `extra-proven.csv` 和 MD5 表只交叠 `go` 一项；MD5/artist 证据未确认 Gel 通用标签是画师名，Gel post 10448413 同时标记 `go` 和 `board_game`，Danbooru `go_(board_game)` wiki 说明围棋规则并列出中文别名，因此采用 `围棋（棋类）` 说明。报告审计仍保留两份未决作者判断及其具体 MD5/帖子依据。对未来 proven 与 confirmed artist-evidence 同键释义冲突，合并器会停止并要求人工复核，不会按文件顺序覆盖。

最终 5,626 行审计分类为 `zh` 1,927、说明 1,349、原名/身份标注 1,048、缺口 1,302。缺口为 Danbooru 2 条、Gelbooru 1,300 条（通用 1,288、元信息 12）。`zh-dictionary-summary.csv` 给出两站 5 类逐类/来源统计；逐条未决依据在 `zh-open-gaps.csv` 及 `zh-research-040-audit.csv`。

最终输入 SHA-256：

- `extra-proven.csv`：`79ac6f79dad91341120c19b2615037c1dc53abbb13bd91833a72984ed98e5596`
- `artist-md5-crosscheck.csv`：`0004d03223b39aa3b19f267d54f7344ba6d925f7dbe6b5352499721aaeb7f09d`
- `extra-artists.csv`：`6e042d61374efc5bbbeb297cf03cae2b4090e7a563368938f6fd04ba2d84af3d`
- `extra-lexical.csv`：`db7071f57bf456ad0ffb9d3faba517ce8acd1d6d34bf84b2f08fec86c88f0cc9`

最终产物 SHA-256：

- `zh-danbooru.csv`：`85d16954ecf02249673a00397c5f8f7626c1884a5526559ff366c31fc50bcd4b`
- `zh-gelbooru.csv`：`c45b9dcafab908987c7633f80699fe761e65e45aec0f5a503a74dc2e0d013cf6`
- `zh-open-gaps.csv`：`07d38749ff73662c295193967c6fb7d18bd6b25a4150c48a78e4e7fe5bc1f1cb`
- `zh-dictionary-summary.csv`：`8d414476742189894cc11940bfc8480f2632a125d92157f688ea042cf455b790`
- `zh-research-040-audit.csv`：`e46652a0426375d02afaa709566c6e1394b8384660c51c5bf5e5e40f11d47a62`

再现命令：`python scripts/build-zh-dictionaries.py`。末次构建通过基准覆盖、0.3 非缺口字段守恒与 `core/csv.mjs` 双站 key parity（Dan 220,510 / Gel 235,255）。输入文件都在 `scripts/zh-inputs/research-030/`，研究抓取缓存并非必需输入。


Final source-backed gap resolved: `sengoku_enbu_-kizna-` now has a Gelbooru sample in `extra-proven.csv`. Gel post 14383095 labels the item as the copyright, official art, Takayama Toshiaki’s artist tag, and Imagawa Yoshimoto as a character; the Sumzap announcement identifies the legacy smartphone game title and its 2024 relaunch as Shin Sengoku Enbu -KIZNA-. The output therefore describes the old title and the revision in Chinese rather than guessing from the parenthetical name.
