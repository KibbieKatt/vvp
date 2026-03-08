#!/bin/bash

container=$1

if [ -z $container ]; then
    >&2 echo "Please provide a single container name"
    exit 1
fi

MAX_WAIT=20  # Max wait time in seconds
RETRY_DELAY=2  # Seconds between checks
END_TIME=$((SECONDS + MAX_WAIT))  # Calculate when to stop waiting

while true; do
  if [ $SECONDS -lt $END_TIME ]; then
    if docker inspect -f {{.State.Health.Status}} "$container" 2>/dev/null | grep -Pq "^healthy$"; then
      echo "Container is running and healthy!"
      break
    else
      echo "Waiting for container..."
      sleep $RETRY_DELAY
    fi
  else
    echo "Error: container did not become active within $MAX_WAIT seconds."
    exit 1
  fi
done

exit 0
