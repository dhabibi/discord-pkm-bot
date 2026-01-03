// URL regex pattern to match http, https, and common URLs
// Captures URLs including those with parentheses (e.g., Wikipedia links)
// Excludes trailing sentence punctuation
const URL_REGEX = /https?:\/\/[^\s<>"']+/g;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  
  // Post-process to remove trailing punctuation that's not part of the URL
  return matches.map(url => {
    // Remove trailing punctuation that appears at sentence boundaries
    // Keep ) if it's balanced with ( in the URL
    let cleaned = url;
    
    // Remove trailing punctuation like ., !, ?, ;, :, but be smart about )
    while (cleaned.length > 0) {
      const lastChar = cleaned[cleaned.length - 1];
      
      // Always remove these trailing characters
      if (['.', ',', '!', '?', ';', ':'].includes(lastChar)) {
        cleaned = cleaned.slice(0, -1);
        continue;
      }
      
      // For ), only remove if unbalanced (more ) than ()
      if (lastChar === ')') {
        const openCount = (cleaned.match(/\(/g) || []).length;
        const closeCount = (cleaned.match(/\)/g) || []).length;
        
        // If there are more closing than opening parens, remove the trailing one
        if (closeCount > openCount) {
          cleaned = cleaned.slice(0, -1);
          continue;
        }
      }
      
      // No more trailing punctuation to remove
      break;
    }
    
    return cleaned;
  });
}
