#!/usr/bin/env python3
"""Search pinned Danbooru wiki CSV by exact title or exact other_names entry."""
import ast, csv, json, re, sys
from pathlib import Path

DATA = Path(__file__).resolve().parents[3] / ".cache" / "zh" / "danbooru-wikis-2026.csv"

def main(query):
    q = query.casefold()
    exact, aliases, body_hits = [], [], []
    with DATA.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            title = row.get("title", "")
            try:
                other_names = ast.literal_eval(row.get("other_names", "[]"))
            except (ValueError, SyntaxError):
                other_names = []
            if title.casefold() == q:
                exact.append(row)
            if any(isinstance(x, str) and x.casefold() == q for x in other_names):
                aliases.append(row)
            if re.search(r"(?<![A-Za-z0-9])" + re.escape(query) + r"(?![A-Za-z0-9])", row.get("body", ""), re.I):
                body_hits.append({"title": title, "other_names": other_names, "body": row.get("body", "")})
    print(json.dumps({"query": query, "exact_title": exact, "exact_other_name": aliases, "body_mentions": body_hits[:100]}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: python search-wiki.py TERM")
    main(sys.argv[1])
