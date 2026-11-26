# Research 0.3.0 dictionary protocol

## Frozen baseline

`gaps.csv` is an unchanged byte-for-byte copy of `resources/zh-open-gaps.csv` from 0.3.0. It has 5,626 data rows; SHA-256 `3DF527CA6FDF6AF16F793890C59E38490FB00C01F0BA935554919EBF93896E28`.

## Review files

All shard CSVs use UTF-8 with optional BOM and the exact header:

`site,name,type,translation,kind,source,status`

`site` is `danbooru` or `gelbooru`; `name` and numeric `type` must exactly match the frozen site CSV. Preserve the existing 0.3.0 translation and source as reference; do not rewrite them in the gap baseline. `status` is exactly `confirmed` or `unresolved`. An unresolved row must have empty `translation`, `kind=缺口`, and a source field describing checked evidence and why it does not settle the meaning. Confirmed rows must name the actual tag sense and source evidence; URL-only/template placeholders do not count as research. Use `kind=zh` only for a direct Chinese equivalent; use `kind=说明` for a useful Chinese identity/usage explanation; use `kind=原名/身份标注` where the original name is retained as identity; do not include Japanese kana in the Chinese translation.

Dan shard: `dan.csv`.

Gel shard assignment is stable and independent of the dictionary build: interpret the first eight hex digits of `SHA256(name.encode('utf-8'))` as an unsigned integer, then take modulo 6. Shards are `gel-0.csv` through `gel-5.csv`.

## Reusable wiki source

Downloaded the public `lylogummy/danbooru_wikis_2026` dataset at immutable revision `efee213a064e53adc185cb4a0198d1317c1e264f`, file `wiki_pages.csv` (upstream LFS oid `921d5cefcb7638a3fd3597f7ef1b1326a384f6b9`, 103,491,903 bytes). Dataset card states MIT. Local SHA-256: `EC9831D658686327DA7C7D36ED6BF3D2393D262ACD152C22606470C8C6FA01D0`. To rerun the historical wiki search, download that revision to `.cache/zh/danbooru-wikis-2026.csv` and verify its SHA-256. The dataset includes title/body/other_names and is enough for exact-title and alias-string lookups, but it is not a standalone complete Danbooru tag-alias export.

An additional pinned full wiki source is `kierarkia/danbooru-wiki-2026` revision `b23a4a14e77b7c3bd6742e6973d2e3948b5b046d`, published 2026-04-28, WTFPL, with upstream LFS SHA-256 `a68a0da07dd233dafd3fe449af40a8687b1b8eb9cecfa912d10da78d31b3fb10`. To repeat that cross-check, restore the pinned JSONL at `.cache/zh/danbooru-wiki-2026-04-28.jsonl`.

`dan-wiki-selected.json` contains rows for the exact-title matches among the 13 Dan gaps. `dan-api-live.json` contains the current official API checks (tag records, exact-title wiki results, alias searches and implication searches); these live responses supplement but do not replace the pinned snapshot. Script `search-wiki.py` supports further exact-title/other_names lookups. `gel_partition.py` reproduces the stable shard rule.


## Supplemental final review

`extra-lexical.csv` remains the frozen 1,248-row list; five in-place semantic corrections are recorded in `extra-lexical-review.csv`. The ledger also adds two source-backed rows absent from the frozen list, which have been applied to their assigned Gel shards.

`artist-md5-crosscheck.csv` is an independent evidence addendum for 25 priority conflict names, 50 additional high-frequency general-tag candidates, the Haguma Karasu alias case, and a full follow-up of 767 remaining unresolved general-tag candidates with exact Dan artist profile matches. It records exact Gel thumbnail MD5s, matching Danbooru post ids and artist tags, official profile ids, and unresolved cases. Method and selection scope are documented in `.cache/zh/ARTIST-MD5-CROSSCHECK-SOURCES.txt`.


## Final supplements

`extra-proven.csv` and `artist-md5-crosscheck.csv` use the same exact schema as shard CSVs and are loaded by `scripts/build-zh-dictionaries.py`. All records must match frozen site/name/type gaps. `extra-proven` may fill an unresolved core row with official or direct site-context evidence; it never replaces a confirmed core row. Confirmed exact-image MD5 artist evidence is selected over the less specific artist candidate, and all competing records remain in the row audit. A same-key `extra-proven` / confirmed artist evidence claim with different meanings causes the build to fail for manual review. The full MD5 addendum has 843 rows (815 confirmed, 28 unresolved); the 767-candidate follow-up added 746 confirmed and 21 unresolved. Unresolved entries remain empty, with the failed or mismatching image evidence explained in `source`. See `resources/zh-research-040-audit.csv` and `resources/zh-open-gaps.csv` for full decisions and residual gaps.

The final `sengoku_enbu_-kizna-` explanation cites Gelbooru post 14383095 (copyright, official art, official artist and named character tags) and the publisher Sumzap’s 2024 release/relaunch announcement.
