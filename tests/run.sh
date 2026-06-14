#!/usr/bin/env bash
# max4work Playwright Testsuite starten
# Aufruf: bash run.sh [pytest-optionen]
#
# Beispiele:
#   bash run.sh                          → alle Tests
#   bash run.sh -k kunden                → nur Kunden-Tests
#   bash run.sh -k "kunden or produkte"  → mehrere Bereiche
#   bash run.sh -v                       → verbose
#   bash run.sh --headed                 → mit Browser-Fenster (Standard)

set -e

cd "$(dirname "$0")"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  max4work – Playwright Testsuite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Playwright-Browser installieren falls nötig
python3 -m playwright install chromium 2>/dev/null || true

# Tests ausführen
python3 -m pytest test_max4work.py -v --tb=short "$@"
