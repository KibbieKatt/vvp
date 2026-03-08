import fetch from 'node-fetch';

export const proxyFetch = async (url) => {
  // Validate URL provided
  if (!url) throw new Error("URL not provided");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
      },
      redirect: 'follow',
      timeout: 10000
    });

    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};
