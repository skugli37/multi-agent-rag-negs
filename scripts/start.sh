#!/bin/bash
# Auto-start script for Multi-Agent RAG
# Pokreće se script automatski k kda server startiji

echo "🚀 Auto-starting Multi-Agent RAG..."
echo "   Checking existing processes..."

# Kill existing processes (clean restart)
pkill -f "next dev" 2>/dev/null
pkill -f cloudflared 2>/dev/null
sleep 2

# Start Next.js server
echo "📡 Starting Next.js server..."
cd /home/z/my-project
nohup bun run dev > /tmp/nextjs.log 2>&1 &
NEXTJS_PID=$!

# Wait for Next.js to start
for i in {1..10}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "✅ Next.js server started on port 3000"
        break
    fi
    sleep 1
done

# Start tunnel
echo "🌐 Starting Cloudflare tunnel..."
/tmp/cloudflared tunnel --url http://localhost:3000 > /tmp/tunnel.log 2>&1 &
TUNNEL_PID=$!

# Wait for tunnel to start
sleep 12

# Get tunnel URL
TUNNEL_URL=$(grep -o 'https://[^ ]*\.trycloudflare\.com' /tmp/tunnel.log | head -1)

if [ -n "$TUNNEL_URL" ]; then
    echo "✅ Tunnel URL: $TUNNEL_URL"
    
    # Save to config file
    cat > /home/z/my-project/public/tunnel-config.json << EOF
{"url": "$TUNNEL_URL", "updatedAt": "$(date -Iseconds)"}
EOF
    
    echo "✅ Tunnel config saved!"
else
    echo "❌ Tunnel failed to start"
fi

echo ""
echo "🎉 Auto-start complete!"
echo "📱 App URL: $TUNNEL_URL"
