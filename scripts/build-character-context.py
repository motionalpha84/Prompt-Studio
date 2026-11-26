"""Build repeatable, neutral character-tag context from licensed local data."""
import csv
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def rows(path, fields=None):
    with (ROOT / path).open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f, fieldnames=fields))

def norm(tag):
    # StoryAura's exact tag field can use spaces where Booru uses underscores.
    return "_".join(tag.strip().lower().split()).replace("__", "_")

work_rows = {r['tag']: r for r in rows('.cache/zh/ame-copyright.csv')}
story = rows('.cache/zh/story-character-corrected.csv')
by_norm = defaultdict(list)
for r in story:
    if r['copyright'].strip():
        by_norm[norm(r['character_tag'])].append(r)

out = []
for site, path in [('danbooru', 'resources/danbooru.csv'), ('gelbooru', 'resources/gelbooru.csv')]:
    base = rows(path, ['name', 'type', 'count', 'aliases'])
    for r in base:
        name = r['name']
        if r['type'] != '4':
            continue
        matches = by_norm.get(norm(name), [])
        # Both source-key normalization and copyright binding must be unique;
        # ambiguous normalized spellings are intentionally dropped.
        if len(matches) != 1:
            continue
        c = matches[0]
        raw_work = c['copyright'].strip()
        work_row = work_rows.get(raw_work)
        display_work = (work_row['zh'].strip() if work_row and work_row['zh'].strip()
                        else raw_work.replace('_', ' '))
        out.append([site, name, '4', f'{name}（关联标签：{display_work}）', '说明',
                    'StoryAura danbooru_character_tags_corrected.csv exact character_tag/copyright binding (normalized spaces/underscores; unique key) + amenorira ame-copyright.csv exact copyright tag'])

target = ROOT / 'resources/zh-character-context.csv'
with target.open('w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f)
    w.writerow(['site', 'name', 'type', 'translation', 'kind', 'source'])
    w.writerows(out)
print(f'{len(out)} rows -> {target}')
