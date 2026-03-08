import { cleanEnv, num, str } from 'envalid';
import express from'express';
import which from 'which';
import YTDlpWrap from 'yt-dlp-wrap';
import NodeCache from 'node-cache';
import { Mutex } from 'async-mutex';
import { proxyFetch } from './lib/proxyFetch.js';

const env = cleanEnv(process.env, {
  PORT: num({ default: 3000 }),
  YTDLP_BIN: str({ default: "yt-dlp" }),
});

// Find available yt-dlp
const ytdlpBin = which.sync(env.YTDLP_BIN);
const youtubedl = new YTDlpWrap.default(ytdlpBin);

const app = express();

// Cache with default ttl for playlists
const cache = new NodeCache({ stdTTL: 18000, checkperiod: 30 });
// Use a mutex to avoid racing fetches
const cacheMutex = new Mutex();

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
        console.log(`New request for: ${videoID}`);

        // Get m3u8 from yt-dlp
        return youtubedl.execPromise([
          "-g",
          "--format-sort",
          "proto:m3u8",
          `https://www.youtube.com/watch?v=${videoID}`,
        ]).then(async (stdout) => {
          const url = stdout.trim();
          if (!url.endsWith(".m3u8")) {
            return Promise.reject({
              message: "YouTube returned a non-m3u8 url: " + url
            });
          }

          // Proxy m3u8 and rewrite URLs before caching and responding
          return proxyFetch(url)
            .then(async (response) => {
              if (!response.ok) {
                return res.status(response.status).json({
                  error: response.statusText,
                  status: response.status
                });
              }
              // Tecnically thix promise leaks rejections but I'm choosing to not think about it
              const playlistData = await response.text();
              cache.set(videoID, playlistData);

              return playlistData;
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
