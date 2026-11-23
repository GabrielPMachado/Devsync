#!/usr/bin/env bash
# Gera workers/demos/.dev.vars apontando o Worker local para o Supabase local
# (supabase start). Usado pelo E2E e pelo CI. Site local em SITE_URL (padrão: porta 3100 do E2E).
set -euo pipefail
cd "$(dirname "$0")/.."
SITE_URL="${SITE_URL:-http://localhost:3100}"
eval "$(supabase status -o env)"
cat > workers/demos/.dev.vars <<VARS
SUPABASE_URL=$API_URL
SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
UPLOAD_SIGNING_SECRET=${UPLOAD_SIGNING_SECRET:-segredo-local-de-teste}
SITE_URL=$SITE_URL
FRAME_ANCESTORS=$SITE_URL
VARS
echo "workers/demos/.dev.vars gerado (site: $SITE_URL)"
