#!/bin/sh

# Check bgutil is running and returns valid json at /ping
if ! curl -fs http://localhost:4416/ping | jq -ne input; then
  echo "HTTP health check failed for bgutil"
  exit 1  # Return failure to Docker
fi

# Check app is running and returns valid json at /ping
if ! curl -fs http://localhost:3000/health | jq -ne input; then
  echo "HTTP health check failed for app"
  exit 1  # Return failure to Docker
fi

# All checks passed
exit 0
