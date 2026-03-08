import fetch from 'node-fetch';
import { minimatch } from 'minimatch'
import { isMimeAllowed } from './mimeTypes.js';

export const proxyFetch = async ({referer, allowedOrigins, allowedMimes} = config, url) => {
  // Validate URL provided
  if (!url) throw new Error("URL not provided");
  // Validate origin
  const urlOrigin = new URL(url).origin;
  if (!isAllowedOrigin(allowedOrigins, urlOrigin)) {
    console.error("Origin not allowed: " + urlOrigin);
    throw new Error("Origin not allowed");
  }

  try {
    const response = await fetch(url, {
      headers: {
        "Referer": referer && referer.length ? referer : undefined,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Origin": referer && referer.length ? new URL(referer).origin : undefined,
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
      },
      redirect: 'follow',
      timeout: 10000
    });

    const contentType = response.headers.get('Content-Type');
    // Reject requests when content type not allowed
    if (!isMimeAllowed(allowedMimes, contentType)) {
      console.error("Mime not allowed: " + contentType);
      throw new Error("Mime not allowed");
    }

    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

const isAllowedOrigin = (allowedOrigins, urlOrigin) => {
  if (allowedOrigins.includes("*")) {
    console.warn("WARNING: Allowing all origins is a security risk! Consider removing \"*\" from ALLOWED_ORIGINS!");
    return true;
  }

  return allowedOrigins.some((rule) => {
    return minimatch(urlOrigin, rule);
  });
}
