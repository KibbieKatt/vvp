#!/bin/bash

container=$1

if [ -z $container ]; then
    >&2 echo "Please provide a single container name"
    exit 1
fi

# Dry run yt-dlp to analyze the output
output=$(docker exec "$container" yt-dlp -v --simulate "https://www.youtube.com/watch?v=dQw4w9WgXcQ" 2>&1)

# Check for BgUtil in PO token providers
if ! echo "$output" | grep -Pq "PO Token Providers: (?:(?!bgutil)[^,\n]*, *)*(bgutil:http-(?:[0-9]+\.?)+ ?\(external\))(?:,.*|$)"; then
  echo "Error: Failed to find BgUtil in PO token providers"
  exit 1
else
  echo "[OK] BgUtil found in PO token providers"
fi

# Check for
if echo "$output" | grep -Pq "\[pot:bgutil:http\] Error reaching GET"; then
  echo "Error: Detected error reaching BgUtil"
  exit 1
else
  echo "[OK] No BgUtil connection issues detected"
fi

# Check for Deno in JS runtimes
if ! echo "$output" | grep -q "JS runtimes: deno-"; then
  echo "Error: Failed to find Deno in yt-dlp JS runtimes"
  exit 1
else
  echo "[OK] Deno found in JS runtimes"
fi
# Check for Deno in JS challenge providers
if ! echo "$output" | grep -Pq "JS Challenge Providers: (?:(?!deno)[^,\n]*, *)*(deno)(?:,.*|$)"; then
  echo "Error: Failed to find Deno in yt-dlp JS challenge providers"
  exit 1
else
  echo "[OK] Deno found in JS challenge providers"
fi

echo "Success!"
exit 0
