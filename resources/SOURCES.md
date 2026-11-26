# 离线词库来源

旧版 0.1.0 通过 DominikDoom/a1111-sd-webui-tagcomplete 的 tags/danbooru.csv 取得 Danbooru 快照。原文件的 Git blob 为 7a3cba59a8cd75bad45b0097338f8f882714a040，与下列归档的 2024-12-22 pt25 文件相同。旧版另附项目整理的 337 条词义。

0.2.0 使用 DraconicDragon/dbr-e621-lists-archive 固定提交 b46f08e5bc5ff98063c1f955786c43850a94b7c0 的两份独立词表。文件名称中的 pt20 是收录频次门槛。这些离线快照可用于补全，站点的词条和使用次数会继续变化。

| 词库 | 原始文件 | Git blob |
| --- | --- | --- |
| Danbooru | [2026-10-01，含别名](https://github.com/DraconicDragon/dbr-e621-lists-archive/blob/b46f08e5bc5ff98063c1f955786c43850a94b7c0/tag-lists/danbooru/danbooru_2026-10-01_pt20-ia-dd.csv) | acdc0685c5a52ac743363adfe4d6a9b4298331d0 |
| Gelbooru | [2026-06-11，含歧义标签](https://github.com/DraconicDragon/dbr-e621-lists-archive/blob/b46f08e5bc5ff98063c1f955786c43850a94b7c0/tag-lists/gelbooru/gelbooru_tags_2026-06-11_pt20_incl_ambiguous.csv) | dd25c6691951726baafb49e5725645d98fb6c7f8 |

归档使用 Unlicense，随附 archive-LICENSE.txt。内置中文只给该词库中确实存在的英文词条匹配释义。两套词库各自保存别名、导入项、个人词条、翻译、使用记录和收藏。旧版本已有的词条随 Danbooru 数据保留。

## 中文词义扩充

`zh-danbooru.csv` 和 `zh-gelbooru.csv` 由 `scripts/build-zh-dictionaries.py` 从以上两个站点词表及 `scripts/zh-inputs/` 下持久保存的源快照构建。结果字段为 `name,translation,kind,source`；仅 `kind=zh` 是可计入翻译的中文译名，`说明` 是中文释义/用途注记，`原名/身份标注` 保留未译专名的检索身份，`缺口` 表示尚无可靠释义且 translation 留空。source 用于追溯，不用于匹配。以下输入不依赖被 `.gitignore` 排除的 `.cache/`。

| 来源 | 固定版本 / 文件 | 许可证与字段 |
| --- | --- | --- |
| ffdkj Danbooru 中英标签表 | commit `51dcc274e51b47dde9f55c26e34545bf59c91444`；持久化的 `scripts/zh-inputs/ffdkj-matched.csv` 是按两站本地 key+category 从上游 `tag.sqlite` 精确筛出的所需子集 (`name,category,cn_name,post_count`) | MIT，见 `ffdkj-LICENSE.txt`；README 说明覆盖 post_count≥10，Gemini 机翻加人工校对 |
| amenorira Danbooru 中文标签数据 | `scripts/zh-inputs/ame-general.csv`, `ame-meta.csv`, `ame-artist.csv`, `ame-copyright.csv`, `ame-character.csv`；上游 commit `8e73f3b1c15b30f873c11a8c65d2d8264cdf0224` | MIT，见 `amenorira-LICENSE.txt`；精确 key/type 字段含 `tag, category, aliases, zh, count, notes` |
| 画师署名检索上下文 | `resources/zh-artist-context.csv`，由 `python scripts/build-artist-context.py` 从 amenorira 固定版本、两站原始词表及 Danbooru 离线别名列生成 | amenorira MIT + Danbooru 归档 Unlicense；候选均按同站画师 key/category=1 精确匹配，输出统一为 `kind=说明`，不将团体名、汉字署名或外文别名当作中文译名。Danbooru 归档第 4 列所有可用署名别名均输出为候选；最终合并器只应在当前词条仍为 `原名/身份标注` 时应用说明。无跨站别名传递。 |
| StoryAura 专名补充 | `scripts/zh-inputs/proper-extra.csv`；由 Hugging Face `StoryAura/Danbooru-Dataset-csv` revision `53cb576` 整理 | MIT，随包文本见 `StoryAura-LICENSE.txt`；完整整理说明在 `scripts/zh-inputs/SOURCES-proper-extra.txt`；仅通过本地标签精确匹配的角色名补充 |
| 项目 Luna 校译 | `zh-dan-reviewed.csv` | 项目原创校译；仅纳入本地 Danbooru 快照中实际存在且不在 seed 中的精确英文 key |
| Gelbooru Luna 校译 | `zh-gel-reviewed.csv` | 项目原创站点专用校译，按 Gelbooru 本地快照的精确 key 匹配 |
| Gelbooru 通用/元信息补充 | `scripts/zh-inputs/general-extra.csv` | 项目校译与封闭规则组合；`type` 为 `类别:manual-reviewed` 或 `类别:auto-composed`，只接受同站点精确 key 与数字类别 |
| 长尾词义校译 | `zh-tail-lexicon.csv` | Luna 逐词校译；按 site/name/type 精确匹配 |
| 长尾专名说明 | `zh-tail-names.csv` | 仅用于补充 `说明` 或 identity；“专名/原名保留”类始终计为 identity |
| 角色关系说明 | `zh-character-context.csv` | 只覆盖 identity/缺口的中性关联文字，按 site/name/type 精确匹配 |
| 画师身份与别名说明 | `zh-artist-context.csv` | 只补 identity/缺口；`别名` 改为“资料所列别名：…”说明；纯署名不计译名；`ebifurya` 优先使用有来源的同人社团说明 |
| Gel 高频专名/元标签人工优先校译 | `zh-priority-gel.csv` | 按 Gelbooru 精确 key/type 匹配，只覆盖缺口、身份标注或重复英文低信息项；明确记录官方来源 |
| Danbooru 末轮补充 | `zh-dan-last.csv` | 可选逐项精确匹配，仅填 identity/缺口；与已有 Sheila 重复时按文件优先级保留有来源版本 |
| 最后一轮缺口校译 | `zh-final-gaps.csv` | 可选逐项精确覆盖，仅填 identity/缺口；作为固定校译输入，不从动态 gap 再生成 |

上游内容核对记录：amenorira 的五份 `scripts/zh-inputs/ame-*.csv` 在上述 commit 下逐个匹配 Git blob SHA（general `2cb6a1a50c0692714ea22ba33e673a2c867807be`；meta `9d159f6e2bfa00da1245b9995e2650aa6166969a`；artist `22c9ce774d90044ea92ca2e8069dfbda1165b9db`；copyright `0601d9d00efdd07fb0419aeb2abd218fc9dea862`；character `227270bcd3d86da2817d032f507b2304fb256162`）。ffdkj 上游 `tag.sqlite` blob SHA 为 `2da143138ec3f8a03378cce2faae3c61bee4c43c`；本地 CSV 是从该数据库按两站词表精确 key/type 筛出的可复现子集。构建只读取 `scripts/zh-inputs/` 和 `resources/`，`.cache/` 只保存可再生报告。

画师来源补充核查：Danbooru API 文档表明 artist 记录具有 `other_names` 和 `group_name` 字段（https://shima.donmai.us/wiki_pages/api:artists）。本次直接访问 `https://danbooru.donmai.us/artists.json?search[name]=ebifurya` 与 `/db_export/` 均实测返回 HTTP 403；因此没有声称拿到或引入官方批量 artists 导出，也未使用不明许可镜像。改用上表已固定的 Unlicense Danbooru 标签归档第 4 列 alias。当前归档有 18,477 个 category=1 的同站画师 alias 候选；本地现行 Danbooru 结果中身份标注项对比可应用到 10,130 个，扣除 amenorira 说明重合及重复 key 后，为 9,685 个新增检索 key。Gelbooru 原始 CSV 第 4 列没有画师 alias（本地实测 0 条），未从 Danbooru 跨站借用。脚本仅读取原始 CSV、amenorira 固定输入和现有 tag 表，不读最终 zh-danbooru/zh-gelbooru 输出；最终合并器负责检查当前 kind 再应用，重复构建不会掏空候选。

构建按同名且数字类别一致匹配。Danbooru 优先级为 Luna 校译、seed、amenorira 中文译名、StoryAura 专名补充、ffdkj 中文译名、amenorira notes；Gelbooru 优先站点专属 `zh-gel-reviewed.csv`、带数字类别的 `general-extra.csv`，再用本地 Danbooru 同名同类别、许可清晰外部同名同类别数据、唯一同类别 alias。随后长尾/上下文表只填 identity 或缺口；`zh-final-gaps.csv` 也是稳定输入，不能由构建器的动态缺口列表再次生成。不从未经许可确认的第三方翻译表导入数据。

翻译质量过滤会去掉纯英文/拉丁原名、proper-name 类英文 key 的“原名（画师/角色/作品/系列）”身份模板和含日文假名的内容；普通词和元标签的真实释义不因英文短词根相同而误标 identity。身份类标签会标 `原名/身份标注`，拉丁名加中文作品信息可标 `说明`。只有可信中文译名标为 `zh`，缺少可靠内容则 `缺口` 留空；“专名，原名保留”不算说明。构建脚本输出易找到的 `zh-open-gaps.csv`、`zh-dictionary-summary.csv`，也在 `.cache/zh/` 留一份相同报告；前者逐词给二轮审校用，后者按站点和数字类别统计各状态和来源计数。脚本对源与生成文件调用 `core/csv.mjs` 的真实解析器进行双向 key set 一致性检查，并在最后将同 key、同类别的 Danbooru 通用/元信息释义补到 Gelbooru 缺口。

所有 tag 数量和覆盖统计仅反映随包的离线快照，标签释义和站点标签会随时间变化；专名可能同名、别名也可能歧义，故只使用精确英文 key 和类别作为合并键。`zh-character-context.csv` 已采用修订后的中性关联文案，只覆盖 identity/缺口；`zh-artist-context.csv` 生成器不依赖最终词表且可重复构建。其余项目校译表同样固定在 `resources/`。合并输入和生成报告均有意放在 `resources/`、`scripts/zh-inputs/`，避免只依赖 `.gitignore` 忽略的缓存。


## 末轮人工核实与 Gel 括注候选

`zh-final-gaps.csv` 是稳定的手工/审校输入，字段为 `site,name,type,translation,kind,source`；不依赖会被重建的 `.cache/zh/translation-gaps.csv`。当前含 5,663 行：3 行逐词核实记录，以及 5,660 行 Gelbooru 括注限定词候选。候选扫描固定的 `resources/gelbooru.csv` 全量 235,256 个标签，其中 62,206 个含 `_(...)` 括注；5,660 个命中筛选，56,546 个未命中，继续保留缺口。复现筛选时逐个解析标签中括注限定词并从最内层向外找：限定词必须精确匹配 `scripts/zh-inputs/ame-copyright.csv` 或 `scripts/zh-inputs/ffdkj-matched.csv` 中 category=3 记录；且本地 Danbooru 有同名 category=3 标签，或限定词属于人工确认的作品名集合 `pokemon,fire_emblem,azur_lane,arknights,granblue_fantasy,genshin_impact`。说明只陈述标签显式限定词对应的专名，不推定标签主体身份。遇到同名异类不据此匹配；括注类型如 `(glasses)` 不会通过 category=3 作品限定词条件。表格行作为最终真源，构建合并时必须按 `site + name + type` 精确匹配，且仅可补入缺口/原名身份状态，不能覆盖已有实义内容。

核实与许可：5,660 条候选的作品限定词释义来自上文列明的固定 amenorira / ffdkj 输入，source 字段记录限定词和匹配条件；快照与词表许可分别见 amenorira-LICENSE.txt、ffdkj-LICENSE.txt 和 archive-LICENSE.txt。人工作品名集合可由官方页面复核：[《明日方舟》](https://ak.hypergryph.com/)、[《原神》](https://genshin.hoyoverse.com/zh-cn/game)、[《碧蓝航线》开发者介绍](https://www.manjuu.co.jp/)；宝可梦、火焰之纹章、Granblue Fantasy 的正式作品名均由相同固定 category=3 映射和本地 Danbooru 同类标签交叉限定。人工核实的其它记录：`modo_(medium)` 是 Modo 三维创作软件（Danbooru 媒介类别与 [Foundry Modo 产品页](https://www.foundry.com/products/modo)）；`sheila_(minigun)` 是 Apex Legends 兰伯特的机枪（Danbooru 与 Rampart 关联标签及 [Apex 官方角色页](https://www.ea.com/games/apex-legends/about/characters/rampart)）。项目撰写的说明不复制外部译文。


末轮补充核对：Danbooru 常见 `*_request` 标签中涉及对象识别的 dog/bird/flower/plant/vehicle/aircraft/fish/species 等项目已按“请求辨认……”校译，避免将请求类型误写为字面上的“请求狗/请求花卉”。Gelbooru `shouto_(boku_no_hero_academia)` 与 `earphone_jack_(boku_no_hero_academia)` 的说明按官方角色页对应轰焦冻、耳郎响香及其个性名；`female_fingering_male` 未确认含义，保留缺口。


## 0.4.0 缺口研究与分类校正

0.4.0 的研究基准固定在 `scripts/zh-inputs/research-030/gaps.csv`，共有 5,626 个旧缺口（Danbooru 13、Gelbooru 5,613）。输入副本存于 `.cache/zh/research-030/frozen-030/`，SHA-256 与 0.3.0 `resources/zh-open-gaps.csv` 一致。7 份研究分片 `dan.csv`、`gel-0.csv` 至 `gel-5.csv` 按 site/name/numeric type 覆盖基准；Gel 分片由 UTF-8 name 的 SHA-256 前 8 位整数取模 6 固定。每条记录的 `source` 保存实际核验线索和 URL，`status=unresolved` 的译文为空。合并后逐条审计见 `resources/zh-research-040-audit.csv`，当前缺项见 `resources/zh-open-gaps.csv`，分片分类抽查报告见 `scripts/zh-inputs/research-030/CLASSIFICATION-REVIEW.md`。

研究使用固定的 Danbooru Wiki 快照：`lylogummy/danbooru_wikis_2026` revision `efee213a064e53adc185cb4a0198d1317c1e264f`，MIT；缓存校验 SHA-256 为 `EC9831D658686327DA7C7D36ED6BF3D2393D262ACD152C22606470C8C6FA01D0`。另一份比对快照 `kierarkia/danbooru-wiki-2026` 为 2026-04-28 JSONL、WTFPL，文件 SHA-256 `a68a0da07dd233dafd3fe449af40a8687b1b8eb9cecfa912d10da78d31b3fb10`。原始缓存只供研究，不随包；持久化分片和报告足以复核逐词决策。`pincet` 释义另参考武藏野美术大学词汇表（荷兰语 pincet / 英语 tweezers 对应）与《魔法禁书目录》官方时间线中垣根帝督取得「ピンセット」的记录，详细 URL 和适用范围在 `dan.csv`。`smlie` 的官方 post_versions API 查询于 2026-11-19 返回 HTTP 403；没有用样本同现推断 typo，仍保留缺口。

0.4.0 只对冻结的待考证记录叠加研究结果，旧 0.3.0 非缺口行的释义、kind、source 都经过逐行不变校验。本轮只更新中文词库及研究输入，没有修改两站英文索引 CSV。分片到产品 kind 的映射另纠正了旧错误：有同键词典、wiki alias 或可核来源支持的角色名、作品名和画师译名归 `zh`；描述性中文注记归 `说明`；只有保留原署名/原名并加身份提示时才归 `原名/身份标注`。


最终补充表：`scripts/zh-inputs/research-030/extra-proven.csv` 有 90 条官方页面或 Gel 站内具体帖子语境支持的确认记录；只填旧缺口，不覆盖分片已确认行。`artist-md5-crosscheck.csv` 是帖子图片级对照输入，共 843 行（815 confirmed、28 unresolved），同名同类型匹配的 Gel 与 Danbooru 文件 MD5、Dan 官方画师 ID/署名/alias 均写在 source 字段；合并审计保留所有 competing source。该表与更新的 `extra-artists.csv` 有 843 个同键同类重合，815 组确认译文和 kind 相同，28 组均未决。`extra-proven` 与 MD5 表只在 `go` 一项重合：MD5 样图不支持其为画师，Gel post 10448413 的 `go` + `board_game` 和 Danbooru `go_(board_game)` wiki 定义支持“围棋（棋类）”；审计保留了两种证据。若 proven 与确认的画师证据未来对同一键释义不同，构建器会失败并要求人工复核，不按文件顺序覆盖。

本轮额外输入 SHA-256：`extra-proven.csv` `79ac6f79dad91341120c19b2615037c1dc53abbb13bd91833a72984ed98e5596`；`artist-md5-crosscheck.csv`（最终 843 行）`0004d03223b39aa3b19f267d54f7344ba6d925f7dbe6b5352499721aaeb7f09d`；更新后的 `extra-artists.csv` `6e042d61374efc5bbbeb297cf03cae2b4090e7a563368938f6fd04ba2d84af3d`。逐条结果及未决原因见 `resources/zh-research-040-audit.csv`；逐行缺口见 `resources/zh-open-gaps.csv`。无损性检查以 `.cache/zh/research-030/frozen-030/` 的 0.3.0 CSV 为准，未更新任何 Danbooru/Gelbooru 英文索引。MD5 方法说明与其依据见 `.cache/zh/ARTIST-MD5-CROSSCHECK-SOURCES.txt`，不是运行时数据。


最终构建记录：research audit 为 5,626 条，`zh` 1,927、说明 1,349、identity 1,048、gap 1,302。新增 `extra-proven.csv` 90 条（全数入选），`artist-md5-crosscheck.csv` 843 条（815 confirmed / 28 unresolved），和更新后的 `extra-artists.csv` 有 843 个精确交集，其中 815 对确认翻译/kind 一致，28 对保留未决。额外输入 SHA-256：`extra-proven.csv` `79ac6f79dad91341120c19b2615037c1dc53abbb13bd91833a72984ed98e5596`；`artist-md5-crosscheck.csv` `0004d03223b39aa3b19f267d54f7344ba6d925f7dbe6b5352499721aaeb7f09d`；`extra-artists.csv` `6e042d61374efc5bbbeb297cf03cae2b4090e7a563368938f6fd04ba2d84af3d`。所有两站英文索引快照保持原样。
