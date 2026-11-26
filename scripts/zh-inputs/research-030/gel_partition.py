#!/usr/bin/env python3
"""Return the stable research shard for a Gelbooru key."""
import hashlib, sys
if len(sys.argv) != 2:
    raise SystemExit("usage: python gel_partition.py NAME")
name = sys.argv[1]
print(int(hashlib.sha256(name.encode("utf-8")).hexdigest()[:8], 16) % 6)
