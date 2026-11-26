#!/usr/bin/env python3
"""Validate and merge submitted research shards without changing any site data."""
import csv, hashlib, json, sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIELDS = ["site", "name", "type", "translation", "kind", "source", "status"]
EXPECTED = {"danbooru": "dan.csv", "gelbooru": None}

def load(path):
    with path.open(encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f)
        if r.fieldnames != FIELDS:
            raise ValueError(f"{path.name}: expected exact header {FIELDS}, got {r.fieldnames}")
        return list(r)

def main(out_path):
    base_path = HERE / "gaps.csv"
    with base_path.open(encoding="utf-8-sig", newline="") as f:
        base_rows = list(csv.DictReader(f))
    base = {(r["site"], r["name"], r["type"]): i for i, r in enumerate(base_rows)}
    paths = [HERE / "dan.csv"] + [HERE / f"gel-{i}.csv" for i in range(6)]
    merged, seen = [], set()
    for p in paths:
        if not p.exists():
            continue
        for row in load(p):
            key = (row["site"], row["name"], row["type"])
            if key not in base:
                raise ValueError(f"{p.name}: key is not in frozen 0.3.0 gap baseline: {key}")
            if key in seen:
                raise ValueError(f"duplicate submitted key across shards: {key}")
            seen.add(key)
            if row["site"] == "danbooru" and p.name != "dan.csv":
                raise ValueError(f"Dan key in wrong shard: {key}")
            if row["site"] == "gelbooru":
                shard = int(hashlib.sha256(row["name"].encode("utf-8")).hexdigest()[:8], 16) % 6
                if p.name != f"gel-{shard}.csv":
                    raise ValueError(f"Gel key assigned to wrong SHA256 shard: {key}; expected gel-{shard}.csv")
            if row["status"] not in ("confirmed", "unresolved"):
                raise ValueError(f"{p.name}: invalid status {row['status']!r}: {key}")
            if row["status"] == "unresolved" and row["translation"]:
                raise ValueError(f"{p.name}: unresolved row must have empty translation: {key}")
            if row["status"] == "confirmed" and not row["translation"].strip():
                raise ValueError(f"{p.name}: confirmed row must have a translation or explanatory note: {key}")
            if not row["kind"] or not row["source"].strip():
                raise ValueError(f"{p.name}: kind and evidence source are required: {key}")
            if "\ufffd" in "".join(row.values()):
                raise ValueError(f"{p.name}: replacement character found: {key}")
            merged.append(row)
    merged.sort(key=lambda r: base[(r["site"], r["name"], r["type"])])
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, lineterminator="\n")
        w.writeheader(); w.writerows(merged)
    print(json.dumps({"rows": len(merged), "by_site_status": {site + ":" + status: n for (site, status), n in sorted(Counter((r["site"], r["status"]) for r in merged).items())}, "output": str(out), "sha256": hashlib.sha256(out.read_bytes()).hexdigest().upper()}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    dest = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "merged-research.csv"
    main(dest)
