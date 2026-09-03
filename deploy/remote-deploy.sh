#!/usr/bin/env bash
# Update only the Studio container on the remote host.

set -Eeuo pipefail

DEPLOY_DIR=${1:?deployment directory is required}
COMPOSE_FILE=${2:?compose file is required}
IMAGE=${3:?image is required}

cd "$DEPLOY_DIR"
test -f "$COMPOSE_FILE"
test -n "$IMAGE"

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

timestamp=$(date +%Y%m%d-%H%M%S)
if [ -f .env ]; then
  cp -- .env ".env.backup.${timestamp}"
else
  : > .env
fi

tmp_env=".env.tmp.${timestamp}"
awk -v image="$IMAGE" '
  BEGIN { updated = 0 }
  /^STUDIO_IMAGE=/ {
    print "STUDIO_IMAGE=" image
    updated = 1
    next
  }
  { print }
  END {
    if (!updated) print "STUDIO_IMAGE=" image
  }
' .env > "$tmp_env"
mv -- "$tmp_env" .env

compose config --quiet
compose pull studio
compose up -d --no-deps studio
echo "Studio deployment started: ${IMAGE}"
