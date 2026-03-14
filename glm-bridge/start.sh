#!/bin/bash
# GLM Session Bridge - Startup Script

echo "🚀 Pokrećem GLM Session Bridge..."

cd /home/z/my-project/glm-bridge

# Check if session exists
if [ -f ".glm-session.json" ]; then
    echo "✅ Postoji sačuvana sesija"
else
    echo "⚠️ Nema sesije - biće potrebna prijava"
fi

# Run bridge
bun run session-bridge.ts
