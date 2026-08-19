#!/bin/bash
set -e

SERVER="sxz@100.127.103.9"
REMOTE_DIR="/home/sxz/projects/active/contextual-reader"
LOCAL_DIR="/opt/data/contextual-reader"

echo "🚀 Packaging Contextual Reader..."
cd "$LOCAL_DIR"

tar -czf /tmp/contextual-reader.tar.gz \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='dist' \
  .

echo "📤 Uploading to server sxz ($SERVER)..."
ssh -o StrictHostKeyChecking=no "$SERVER" "mkdir -p $REMOTE_DIR /home/sxz/projects/tokens"
scp -o StrictHostKeyChecking=no /tmp/contextual-reader.tar.gz "$SERVER:$REMOTE_DIR/"

echo "🔧 Deploying Docker services on server..."
ssh -o StrictHostKeyChecking=no "$SERVER" << 'ENDSSH'
set -e
cd /home/sxz/projects/active/contextual-reader
tar -xzf contextual-reader.tar.gz
rm contextual-reader.tar.gz

# Check for tunnel token in projects/tokens/
if [ -f /home/sxz/projects/tokens/contextual-reader-tunnel.token ]; then
  export TUNNEL_TOKEN=$(cat /home/sxz/projects/tokens/contextual-reader-tunnel.token)
elif [ -f /home/sxz/projects/tokens/cftunnel.token ]; then
  export TUNNEL_TOKEN=$(cat /home/sxz/projects/tokens/cftunnel.token)
fi

echo "🐳 Building & restarting docker containers..."
docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d --build

echo "⏳ Checking container health..."
sleep 5
docker compose ps
ENDSSH

rm /tmp/contextual-reader.tar.gz
echo "✅ Deployment completed!"
