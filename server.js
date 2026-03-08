import express from'express';
import { cleanEnv, num } from 'envalid';

const env = cleanEnv(process.env, {
  PORT: num({ default: 3000 }),
});

const app = express();

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(env.PORT, (err) => {
  if (err) {
    console.error("Error starting server:", err.message);
  } else {
    console.log(`Server is running on :${env.PORT}`);
  }
});
