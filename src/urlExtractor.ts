// URL regex pattern to match http, https, and common URLs
const URL_REGEX = /https?:\/\/[^\s]+/g;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches || [];
}
