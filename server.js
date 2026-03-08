import { cleanEnv, num, str } from 'envalid';
import express from'express';
import which from 'which';
import YTDlpWrap from 'yt-dlp-wrap';

const env = cleanEnv(process.env, {
  PORT: num({ default: 3000 }),
  YTDLP_BIN: str({ default: "yt-dlp" }),
});

// Find available yt-dlp
const ytdlpBin = which.sync(env.YTDLP_BIN);
const youtubedl = new YTDlpWrap.default(ytdlpBin);

const app = express();

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/watch', async (req, res) => {
  const videoID = req.query.v;
  if (/^([\w-]{11})$/.test(videoID)) {
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
      res.status(200).send(url);
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

app.listen(env.PORT, (err) => {
  if (err) {
    console.error("Error starting server:", err.message);
  } else {
    console.log(`Server is running on :${env.PORT}`);
  }
});
