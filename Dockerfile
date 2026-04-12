# Set up deno / bgutil as stages
FROM denoland/deno:bin-2.7.12 AS deno
FROM brainicism/bgutil-ytdlp-pot-provider:1.3.1-node AS bgutil
# Use the official Node.js image
FROM node:25-slim
# Install deno from deno:bin
COPY --from=deno /deno /usr/local/bin/deno
# Copy bgutil server
COPY --from=bgutil /app /app/bgutil

RUN apt-get update && apt-get install -y \
  # Install supervisor
  # python and pip to install yt-dlp and bgutil
  # ffmpeg to enable more formats in yt-dlp
  # jq and curl for health check script
  supervisor python3 python3-pip ffmpeg jq curl \
  && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app/vvp

# Copy the application code
COPY . .
# Install yt-dlp and bgutil from requirements
RUN pip install --break-system-packages -r requirements.txt

# Install dependencies
RUN npm install -g corepack --force \
  && yarn install

# Copy supervisord config
COPY scripts/supervisord.conf /etc/supervisord.conf
# Copy and make the health check script executable
COPY scripts/healthcheck.sh /usr/bin/healthcheck.sh

# Expose the port
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=15s --start-period=30s --retries=3 \
  CMD /usr/bin/healthcheck.sh

# Start the application
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
