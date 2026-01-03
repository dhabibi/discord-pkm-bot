// URL regex pattern to match http, https, and common URLs
// Excludes trailing punctuation like periods, commas, etc.
const URL_REGEX = /https?:\/\/[^\s<>"']+[^\s<>"'.,!?;:)]/g;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches || [];
}
