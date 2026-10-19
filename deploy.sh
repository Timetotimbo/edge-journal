#!/bin/sh
# Builds Edge Journal and publishes it to Cloudflare Pages (project "edge-journal"), served at journal.eefavorbooks.com.
# Every deploy is a saved version: only committed code goes out, and it's tagged deploy-<date>-<time>.
set -e
cd "$(dirname "$0")"
if [ -n "$(git status --porcelain)" ]; then
  echo "Not deploying: there are changes that aren't committed. Commit them first, so this version is saved." >&2
  git status --short >&2
  exit 1
fi
npm run build
export NODE_OPTIONS=--dns-result-order=ipv4first
npx -y wrangler pages deploy dist --project-name edge-journal --branch main \
  --commit-hash "$(git rev-parse HEAD)" --commit-message "$(git log -1 --format=%s | cut -c1-300)"
TAG="deploy-$(date +%Y-%m-%d-%H%M)"
git tag -a "$TAG" -m "Deployed $(date '+%Y-%m-%d %H:%M')"
if git remote get-url origin >/dev/null 2>&1; then git push -q origin HEAD "$TAG" && echo "Saved as $TAG on GitHub"; else echo "Saved as $TAG (local)"; fi
