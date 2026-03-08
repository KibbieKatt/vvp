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
}
