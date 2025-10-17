#!/bin/sh
set -e

# Start Ollama server in background
/bin/ollama serve &
pid=$!

echo "🚀  Ollama is starting..."

# Wait a few seconds to ensure the server is listening
sleep 5

# Pull the model if missing
if ! /bin/ollama list | grep -q "${OLLAMA_MODEL:-deepseek-r1:7b}"; then
  echo "⬇️  Pulling model ${OLLAMA_MODEL:-deepseek-r1:7b}..."
  /bin/ollama pull "${OLLAMA_MODEL:-deepseek-r1:7b}"
else
  echo "✅  Model ${OLLAMA_MODEL:-deepseek-r1:7b} already exists."
fi

echo "🚀  Ollama is running and model is ready."
wait $pid
