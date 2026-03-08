// Checks the content type response with the allowed mimes list
export const isMimeAllowed = (allowedMimes, contentType) => {
  // The mime filter doesn't allow "*" as a safety feature
  const parts = contentType.split(";")
      .map(part => part.trim());

  if (parts.length) {
      const responseMime = parts[0];
      return allowedMimes.includes(responseMime);
  }

  return false;
};

// For loading from cache, since we don't currently store mime
export const guessUrlMime = (url) => {
  const pathName = (new URL(url)).pathname;
  switch (true) {
      case pathName.endsWith(".mkv"):
          return "video/x-matroska";
      case pathName.endsWith(".mp4"):
          return "video/mp4";
      case pathName.endsWith(".ts"):
          return "video/mp2t";
      default:
          return "application/octet-stream";
  }
};

export const isM3U8 = (url) => {
  return (new URL(url)).pathname.endsWith(".m3u8");
};
