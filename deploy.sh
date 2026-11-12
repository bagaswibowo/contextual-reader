#!/bin/bash
set -e

# Configuration (override via environment variables)
SERVER="${SERVER:-sxz@100.127.103.9}"
REMOTE_DIR="${REMOTE_DIR:-/home/sxz/projects/active/contextual-reader}"
LOCAL_DIR="${LOCAL_DIR:-/opt/data/contextual-reader}"

# Required environment variables (must be set before running)
REQUIRED_VARS=("SECRET_KEY" "ALLOWED_HOSTS")
MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    MISSING_VARS+=("$var")
  fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
  echo "❌ Error: Required environment variables not set:"
  printf '  - %s\n' "${MISSING_VARS[@]}"
  echo ""
  echo "Please set the following variables before running deploy.sh:"
  echo "  - SECRET_KEY: Django secret key"
  echo "  - ALLOWED_HOSTS: Allowed hostnames (comma-separated or space-separated)"
  echo ""
  echo "Example:"
  echo "  export SECRET_KEY='your-secret-key-here'"
  echo "  export ALLOWED_HOSTS='localhost 127.0.0.1'"
  echo "  ./deploy.sh"
  exit 1
fi

echo "🚀 Packaging Contextual Reader..."
cd "$LOCAL_DIR"

# Exclude secrets and build artifacts
# Strategy: Only exclude .env (production secrets). Do NOT use --exclude='.env.*' because it would also exclude .env.example
# Since .env.example doesn't match '.env', it will be included automatically
tar -czf /tmp/contextual-reader.tar.gz \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='dist' \
  --exclude='.env' \
  .

echo "📤 Uploading to server $SERVER..."
ssh -o StrictHostKeyChecking=yes -o UserKnownHostsFile=~/.ssh/known_hosts "$SERVER" "mkdir -p $REMOTE_DIR /home/sxz/projects/tokens"
scp -o StrictHostKeyChecking=yes -o UserKnownHostsFile=~/.ssh/known_hosts /tmp/contextual-reader.tar.gz "$SERVER:$REMOTE_DIR/"

echo "🔧 Deploying Docker services on server..."
ssh -o StrictHostKeyChecking=yes -o UserKnownHostsFile=~/.ssh/known_hosts "$SERVER" << 'ENDSSH'
set -e
cd /home/sxz/projects/active/contextual-reader
tar -xzf contextual-reader.tar.gz
rm contextual-reader.tar.gz

# Load environment from .env file if it exists
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check for tunnel token in projects/tokens/
if [ -f /home/sxz/projects/tokens/contextual-reader-tunnel.token ]; then
  export TUNNEL_TOKEN=$(cat /home/sxz/projects/tokens/contextual-reader-tunnel.token)
elif [ -f /home/sxz/projects/tokens/cftunnel.token ]; then
  export TUNNEL_TOKEN=$(cat /home/sxz/projects/tokens/cftunnel.token)
fi

echo "🐳 Building Docker images..."
docker compose build

echo "🐳 Recreating services without downtime..."
docker compose up -d --no-deps --force-recreate backend

echo "⏳ Checking container health..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if docker compose ps backend | grep -q "healthy"; then
    echo "✅ Backend is healthy"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "⏳ Waiting for backend to be healthy... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "❌ Backend health check failed. Rollback in progress..."
  docker compose up -d --no-deps --force-recreate backend
  echo "❌ Deployment failed. Manual rollback required."
  exit 1
fi

docker compose ps
ENDSSH

rm /tmp/contextual-reader.tar.gz
echo "✅ Deployment completed!"
