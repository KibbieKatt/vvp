export const rewritePlaylist = (playlistText, baseUrl) => {
  const base = new URL(baseUrl);
  return playlistText
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed === "") return line;
      if (trimmed.startsWith("#")) {
        // Match urls in segment tags
        // TODO this should be expanded to handle all tags
        try {
          const matches = /^#EXT-X-MAP:URI="(?<url>[^"]+)"$/.exec(trimmed);
          if (matches?.groups?.url) {
            const resolvedUrl = new URL(matches.groups.url, base).href;
            return `#EXT-X-MAP:URI="/api/proxy?url=${encodeURIComponent(resolvedUrl)}"`;
          } else {
            // No matches, don't modify
            return line;
          }
        } catch (e) {
          console.warn("Error occurred in EXT-X-MAP rewrite");
          return line; // Return original line if URL resolution fails
        }
      }

      try {
        // Fill in relative URLs in playlist with path of m3u8
        // Should be a no-op if URLs are absolute
        const resolvedUrl = new URL(trimmed, base).href;
        return `/api/proxy?url=${encodeURIComponent(resolvedUrl)}`;
      } catch (e) {
        console.warn('Failed to resolve URL:', trimmed);
        return line; // Return original line if URL resolution fails
      }
    })
    .join("\n");
};
