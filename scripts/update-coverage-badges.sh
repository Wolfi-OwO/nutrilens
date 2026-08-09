#!/usr/bin/env bash
# Regenerates .github/badges/*.json from a real local test run of both
# apps/api and apps/ai-server, so the README's coverage badges reflect
# reality. Run this and commit the result as part of any PR that changes
# apps/api or apps/ai-server — see NFR-OBS-02 for why this isn't automated
# on every merge (nutrilens's branch protection blocks CI from pushing to
# main directly, and a bot-opened PR from the default GITHUB_TOKEN can't
# trigger its own required checks).
set -euo pipefail
cd "$(dirname "$0")/.."

color_for() {
    local pct="${1%.*}"
    if [ "$pct" -ge 80 ]; then echo brightgreen
    elif [ "$pct" -ge 60 ]; then echo yellow
    else echo red; fi
}

echo "Running apps/api tests (needs a reachable Postgres — see apps/api/docker-compose.yml)..."
API_PCT=$(
    npm test --workspace=@nutrilens/api 2>&1 \
        | tee /tmp/nutrilens-api-coverage.log \
        | grep "all files" \
        | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/,"",$2); print $2}'
)

echo "Running apps/ai-server tests..."
AI_PCT=$(
    make -C apps/ai-server test 2>&1 \
        | tee /tmp/nutrilens-ai-server-coverage.log \
        | awk '/^TOTAL /{print $NF}' \
        | tr -d '%'
)

mkdir -p .github/badges
cat > .github/badges/api-coverage.json <<EOF
{"schemaVersion":1,"label":"api coverage","message":"${API_PCT}%","color":"$(color_for "$API_PCT")"}
EOF
cat > .github/badges/ai-server-coverage.json <<EOF
{"schemaVersion":1,"label":"ai-server coverage","message":"${AI_PCT}%","color":"$(color_for "$AI_PCT")"}
EOF

echo "apps/api: ${API_PCT}% · apps/ai-server: ${AI_PCT}%"
echo "Updated .github/badges/*.json — review and commit."
