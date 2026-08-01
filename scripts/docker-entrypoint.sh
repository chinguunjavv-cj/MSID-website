#!/bin/sh
# Container start-up.
#
# Runs before the server so a fresh volume comes up working rather than erroring on
# missing tables. Every step is idempotent, so this is safe on every restart.
set -e

# Applies the schema, tops up MSID's own published facts, and creates the first
# administrator only when no account with ADMIN_EMAIL exists yet.
npm run seed

# Optional sample content, for showing the site populated before MSID's real content
# arrives. Set MSID_SEED_DEMO=1 in the environment to enable; remove the variable and
# run `npm run demo:clear` to take it back out.
if [ "$MSID_SEED_DEMO" = "1" ]; then
  echo "MSID_SEED_DEMO=1 — adding sample content"
  npm run demo
fi

exec npm run start
