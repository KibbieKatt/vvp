import 'dotenv/config';
import { cleanEnv, makeValidator, num, str } from 'envalid';
import express from'express';
import which from 'which';
import YTDlpWrap from 'yt-dlp-wrap';
import NodeCache from 'node-cache';
import morgan from 'morgan';
import helmet from 'helmet';
import { Mutex } from 'async-mutex';
import { proxyFetch } from './lib/proxyFetch.js';
import { isM3U8, guessUrlMime } from './lib/mimeTypes.js';
import { rewritePlaylist } from './lib/playlistTools.js';

const listValidator = makeValidator((value) => {
  return value
    .split(",")
    .map(item => item.trim())
    .filter(item => item.length);
});

// Allows only youtube by default
const defaultAllowedOrigins = [
  "https://*.googlevideo.com"
];

// Allows m3u8, octet, and some video mime types
const defaultAllowedMimes = [
  "application/vnd.apple.mpegurl", // .m3u8
  "application/octet-stream", // YT .ts
  "video/mp2t", // .ts
  "video/mp4", // .mp4
  "video/x-matroska", // .mkv
];

// Validate environment variables
const env = cleanEnv(process.env, {
  PORT: num({ default: 3000 }),
  YTDLP_BIN: str({ default: "yt-dlp" }),
  REFERER_URL: str({ default: "https://www.youtube.com/" }),
  ALLOWED_ORIGINS: listValidator({ default: defaultAllowedOrigins }),
  ALLOWED_MIMES: listValidator({ default: defaultAllowedMimes }),
});

// Print out config for easier sanity checks
console.log("VVP Config:", env);
// Warn when all origins allowed
if (env.ALLOWED_ORIGINS.includes("*")) {
  console.warn("WARNING: Allowing all origins is a security risk! Consider removing \"*\" from ALLOWED_ORIGINS!");
}

// For convenience
const proxyConfig = {
  referer: env.REFERER_URL,
  allowedOrigins: env.ALLOWED_ORIGINS,
  allowedMimes: env.ALLOWED_MIMES
};

// Find available yt-dlp
const ytdlpBin = which.sync(env.YTDLP_BIN);
const youtubedl = new YTDlpWrap.default(ytdlpBin);

// Print yt-dlp version
youtubedl.getVersion()
  .then((res) => {
    console.log("Using yt-dlp version " + res);
  });

const app = express();

// Initialize cache with a TTL of 5 hours
// Intended to last the duration of a watch party
const cache = new NodeCache({ stdTTL: 18000, checkperiod: 30 });
// Use lower ttl for segments, avoid storing entire movies in ram
const segmentCacheTTL = 300;
// Use a mutex to avoid racing fetches
const cacheMutex = new Mutex();

// Set up logging
app.use(morgan('dev'));

// Set up basic security headers
app.use(helmet());

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// CORS preflight
app.options('/{*splat}', (req, res) => {
  res.status(204).end();
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/watch', async (req, res) => {
  const videoID = req.query.v;
  if (/^([\w-]{11})$/.test(videoID)) {
    // Use mutex to make cache check/load atomic.
    // Intended to block raced clients until the first completes and
    // primes the cache for the second
    return cacheMutex.runExclusive(async () => {
      const cachedResponse = cache.get(videoID);

      if (cachedResponse) {
        console.log(`Serving from cache: ${videoID}`);

        return cachedResponse;
      } else {
        console.log(`Serving from proxy: ${videoID}`);

        // Get m3u8 from yt-dlp
        return youtubedl.execPromise([
          "-g",
          "--format-sort",
          "proto:m3u8",
          `https://www.youtube.com/watch?v=${videoID}`,
        ]).then(async (stdout) => {
          const url = stdout.trim();
          if (!isM3U8(url)) {
            return Promise.reject({
              message: "YouTube returned a non-m3u8 url: " + url
            });
          }

          // Proxy m3u8 and rewrite URLs before caching and responding
          return proxyFetch(proxyConfig, url)
            .then(async (response) => {
              if (!response.ok) {
                return res.status(response.status).json({
                  error: response.statusText,
                  status: response.status
                });
              }
              // Tecnically thix promise leaks rejections but I'm choosing to not think about it
              const playlistData = await response.text();
              const modifiedPlaylist = rewritePlaylist(playlistData, url);
              cache.set(videoID, modifiedPlaylist);

              return modifiedPlaylist;
            });
        });
      }
    }).then(playlistData => {
      // Separate response code outside mutex to avoid blocking on data transfer
      res.set({
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "public, max-age=600" // 10 minutes
      });
      return res.status(200).send(playlistData);
    }).catch(error => {
      // yt-dlp command returned an error
      const message = error.message.match(/(?<=Stderr:\n)(.*)/) || error.message
      console.error("yt-dlp error: " + message);
      res.status(500).json({
        error: "Failed to fetch source from yt-dlp",
        details: message
      });
    });
  } else {
    res.status(500).json({
      error: "Invalid video ID",
    });
  }
});

app.get('/api/proxy', async (req, res) => {
  try {
    // URL is already decoded
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Check cache for the URL
    const cachedResponse = cache.get(url);
    if (cachedResponse) {
      console.log(`Serving from cache: ${url}`);
      if (isM3U8(url)) {
        res.set({
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "public, max-age=600" // 10 minutes
        });
      } else {
        res.set({
          "Content-Type": guessUrlMime(url),
          "Cache-Control": "public, max-age=31536000" // 1 year for segments
        });
      }
      return res.status(200).send(cachedResponse);
    }

    const response = await proxyFetch(proxyConfig, url);

    if (!response.ok) {
      return res.status(response.status).json({
        error: response.statusText,
        status: response.status
      });
    }

    if (isM3U8(url)) {
      const playlistText = await response.text();
      const modifiedPlaylist = rewritePlaylist(playlistText, url);

      // Cache the response
      cache.set(url, modifiedPlaylist);

      res.set({
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "public, max-age=600" // 10 minutes
      });
      return res.send(modifiedPlaylist);
    } else {
      const arrayBuffer = await response.arrayBuffer();

      // Cache the response, lower TTL for segments
      cache.set(url, Buffer.from(arrayBuffer), segmentCacheTTL);

      res.set({
        "Content-Type": guessUrlMime(url),
        "Cache-Control": "public, max-age=31536000" // 1 year for segments
      });
      return res.send(Buffer.from(arrayBuffer));
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      error: "Failed to fetch data",
      details: error.message
    });
  }
});

// Catchall error
app.use((err, req, res, next) => {
  console.error('Uncaught error:', err.stack);
  res.status(500).json({
    error: "Internal server error",
  });
});

app.listen(env.PORT, (err) => {
  if (err) {
    console.error("Error starting server:", err.message);
  } else {
    console.log(`Server is running on :${env.PORT}`);
  }
});
