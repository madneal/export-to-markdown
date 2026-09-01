#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

PACKAGE=export-to-markdown.zip
rm -f "$PACKAGE"

zip -q -r "$PACKAGE" \
  manifest.json \
  popup.html \
  load.svg \
  PRIVACY.md \
  THIRD_PARTY_LICENSES.md \
  third_party \
  icons \
  scripts \
  -x "*/.DS_Store"

unzip -tq "$PACKAGE"
unzip -l "$PACKAGE"
