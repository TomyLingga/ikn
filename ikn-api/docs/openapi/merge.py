"""Merge OpenAPI fragments into docs/openapi.yaml.

Each module writes its own fragment in docs/openapi/<module>.yaml containing any of:
  paths: {...}          -> merged into the main `paths`
  components:
    schemas: {...}      -> merged into `components.schemas`
    responses: {...}    -> merged into `components.responses`
    parameters: {...}
  tags: [...]           -> appended (deduplicated by name)

The base document is docs/openapi/base.yaml (info, servers, security, shared components).
Run:  python docs/openapi/merge.py      (from ikn-api/)
Fails on duplicate path or schema names so modules cannot silently overwrite each other.
"""
import glob
import io
import os
import sys

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
BASE = os.path.join(HERE, "base.yaml")
OUT = os.path.join(ROOT, "docs", "openapi.yaml")


def load(path):
    with io.open(path, encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def merge_dict(target, source, label, allow_override=False):
    for key, value in (source or {}).items():
        if key in target and not allow_override:
            sys.exit(f"duplicate {label} '{key}' (already defined by another fragment)")
        target[key] = value


def main():
    doc = load(BASE)
    doc.setdefault("paths", {})
    doc.setdefault("components", {})
    for section in ("schemas", "responses", "parameters"):
        doc["components"].setdefault(section, {})
    doc.setdefault("tags", [])

    fragments = sorted(p for p in glob.glob(os.path.join(HERE, "*.yaml")) if os.path.basename(p) != "base.yaml")
    for frag_path in fragments:
        frag = load(frag_path)
        name = os.path.basename(frag_path)
        merge_dict(doc["paths"], frag.get("paths"), f"path in {name}")
        comps = frag.get("components") or {}
        for section in ("schemas", "responses", "parameters"):
            merge_dict(doc["components"][section], comps.get(section), f"components.{section} in {name}")
        known = {t.get("name") for t in doc["tags"]}
        for tag in frag.get("tags") or []:
            if tag.get("name") not in known:
                doc["tags"].append(tag)
                known.add(tag.get("name"))

    header = (
        "# GENERATED FILE - do not edit by hand.\n"
        "# Source: docs/openapi/base.yaml + docs/openapi/<module>.yaml, merged by docs/openapi/merge.py\n"
    )
    with io.open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(header)
        yaml.safe_dump(doc, fh, allow_unicode=True, sort_keys=False, width=140)
    print(f"merged {len(fragments)} fragment(s) -> {os.path.relpath(OUT, ROOT)}; paths={len(doc['paths'])} schemas={len(doc['components']['schemas'])}")


if __name__ == "__main__":
    main()
