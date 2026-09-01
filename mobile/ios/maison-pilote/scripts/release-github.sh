#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${MAISON_PILOTE_IOS_NEXT_VERSION_CODE:?Variable requise}"
: "${MAISON_PILOTE_IOS_RESULT_FILE:?Variable requise}"

if [[ ! "$MAISON_PILOTE_IOS_NEXT_VERSION_CODE" =~ ^[1-9][0-9]*$ ]]; then
    echo "MAISON_PILOTE_IOS_NEXT_VERSION_CODE doit être un entier positif." >&2
    exit 64
fi
if [[ "$MAISON_PILOTE_IOS_RESULT_FILE" != /* ]]; then
    echo "MAISON_PILOTE_IOS_RESULT_FILE doit être un chemin absolu." >&2
    exit 64
fi

GH_CLI="${MOBILE_IOS_GITHUB_CLI:-gh}"
GH_CONFIG_DIR="${GH_CONFIG_DIR:-${MOBILE_IOS_GITHUB_CONFIG_DIR:-}}"
REPOSITORY="${MOBILE_IOS_GITHUB_REPOSITORY:-VMeilhac85/compta}"
WORKFLOW="${MOBILE_IOS_GITHUB_WORKFLOW:-ios-testflight.yml}"
REF="${MOBILE_IOS_GITHUB_REF:-main}"

if [[ "$GH_CLI" == */* ]]; then
    if [[ ! -x "$GH_CLI" ]]; then
        echo "Le client GitHub configuré est absent ou non exécutable." >&2
        exit 69
    fi
elif ! GH_CLI="$(command -v "$GH_CLI")"; then
    echo "Le client GitHub gh est introuvable." >&2
    exit 69
fi
if [[ -z "$GH_CONFIG_DIR" || "$GH_CONFIG_DIR" != /* || ! -d "$GH_CONFIG_DIR" ]]; then
    echo "Le répertoire privé d’authentification GitHub est absent." >&2
    exit 66
fi
if [[ ! "$REPOSITORY" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
    echo "Le dépôt GitHub configuré est invalide." >&2
    exit 64
fi
if [[ ! "$WORKFLOW" =~ ^[A-Za-z0-9_.-]+\.ya?ml$ ]]; then
    echo "Le nom du workflow GitHub est invalide." >&2
    exit 64
fi
if [[ ! "$REF" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$ || "$REF" == *..* ]]; then
    echo "La référence GitHub configurée est invalide." >&2
    exit 64
fi

export GH_CONFIG_DIR
"$GH_CLI" auth status --hostname github.com >/dev/null

CORRELATION_ID="$(openssl rand -hex 12)"
RUN_TITLE="TestFlight $CORRELATION_ID"
TEMP_DIRECTORY="$(mktemp -d "${TMPDIR:-/tmp}/maison-pilote-ios-github.XXXXXX")"
cleanup() {
    rm -rf -- "$TEMP_DIRECTORY"
}
trap cleanup EXIT

echo "Déclenchement du runner macOS GitHub pour la demande $CORRELATION_ID..."
"$GH_CLI" workflow run "$WORKFLOW" \
    --repo "$REPOSITORY" \
    --ref "$REF" \
    --field "next_version_code=$MAISON_PILOTE_IOS_NEXT_VERSION_CODE" \
    --field "marketing_version=${IOS_MARKETING_VERSION:-}" \
    --field "correlation_id=$CORRELATION_ID"

RUN_ID=""
for _ in $(seq 1 30); do
    RUNS_JSON="$("$GH_CLI" run list \
        --repo "$REPOSITORY" \
        --workflow "$WORKFLOW" \
        --branch "$REF" \
        --event workflow_dispatch \
        --limit 20 \
        --json databaseId,displayTitle)"
    RUN_ID="$(RUN_TITLE="$RUN_TITLE" python3 -c '
import json
import os
import sys

runs = json.load(sys.stdin)
title = os.environ["RUN_TITLE"]
for run in runs:
    if run.get("displayTitle") == title:
        print(run.get("databaseId", ""))
        break
' <<< "$RUNS_JSON")"
    if [[ "$RUN_ID" =~ ^[1-9][0-9]*$ ]]; then
        break
    fi
    sleep 4
done

if [[ ! "$RUN_ID" =~ ^[1-9][0-9]*$ ]]; then
    echo "Le lancement GitHub n’a pas pu être retrouvé après son déclenchement." >&2
    exit 70
fi

RUN_URL="$("$GH_CLI" run view "$RUN_ID" --repo "$REPOSITORY" --json url --jq .url)"
echo "Runner macOS : $RUN_URL"
"$GH_CLI" run watch "$RUN_ID" --repo "$REPOSITORY" --exit-status

"$GH_CLI" run download "$RUN_ID" \
    --repo "$REPOSITORY" \
    --name "maison-pilote-ios-release-$CORRELATION_ID" \
    --dir "$TEMP_DIRECTORY/result"

DOWNLOADED_RESULT="$TEMP_DIRECTORY/result/release-result.json"
if [[ ! -s "$DOWNLOADED_RESULT" ]]; then
    echo "Le runner n’a pas fourni le manifeste de release attendu." >&2
    exit 65
fi
python3 -m json.tool "$DOWNLOADED_RESULT" >/dev/null
install -m 600 "$DOWNLOADED_RESULT" "$MAISON_PILOTE_IOS_RESULT_FILE"

echo "Build TestFlight transmis par GitHub Actions ; manifeste récupéré depuis $RUN_URL."
