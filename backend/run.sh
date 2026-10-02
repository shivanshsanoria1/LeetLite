#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

log() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1"
}

log "1. Running LC-data-puller..."
node "$SCRIPT_DIR/web/LC-data-puller.js"

log "2. Running parser..."
node "$SCRIPT_DIR/parser.js"

log "All scripts completed."
