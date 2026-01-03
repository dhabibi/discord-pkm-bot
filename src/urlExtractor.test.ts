import { extractUrls } from './urlExtractor';

describe('URL Extractor', () => {
  describe('extractUrls', () => {
    it('should extract a single URL from text', () => {
      const text = 'Check out this link: https://example.com';
      const urls = extractUrls(text);
      
      expect(urls).toEqual(['https://example.com']);
    });

    it('should extract multiple URLs from text', () => {
      const text = 'Here are some links: https://example.com and http://test.com';
      const urls = extractUrls(text);
      
      expect(urls).toEqual(['https://example.com', 'http://test.com']);
    });

    it('should return empty array when no URLs found', () => {
      const text = 'This is just plain text without any links';
      const urls = extractUrls(text);
      
      expect(urls).toEqual([]);
    });

    it('should handle URLs with paths and query strings', () => {
      const text = 'Visit https://example.com/path/to/page?query=value';
      const urls = extractUrls(text);
      
      expect(urls).toEqual(['https://example.com/path/to/page?query=value']);
    });

    it('should handle URLs at the start of text', () => {
      const text = 'https://example.com is a great site';
      const urls = extractUrls(text);
      
      expect(urls).toEqual(['https://example.com']);
    });

    it('should handle URLs at the end of text', () => {
      const text = 'Check out https://example.com';
      const urls = extractUrls(text);
      
      expect(urls).toEqual(['https://example.com']);
    });

    it('should handle multiple URLs on separate lines', () => {
      const text = 'First link: https://example.com\nSecond link: http://test.com';
      const urls = extractUrls(text);
      
      expect(urls).toEqual(['https://example.com', 'http://test.com']);
    });

    it('should exclude trailing punctuation from URLs', () => {
      const text = 'Check out https://example.com. And also http://test.com!';
      const urls = extractUrls(text);
      
      expect(urls).toEqual(['https://example.com', 'http://test.com']);
    });

    it('should handle URLs followed by various punctuation', () => {
      const text = 'Links: https://example.com, http://test.com; https://another.com. Final: http://last.com!';
      const urls = extractUrls(text);
      
      expect(urls).toEqual(['https://example.com', 'http://test.com', 'https://another.com', 'http://last.com']);
    });

    it('should capture URLs with balanced parentheses like Wikipedia links', () => {
      const text = 'Check out https://en.wikipedia.org/wiki/Apple_(disambiguation) for more info.';
      const urls = extractUrls(text);
      
      expect(urls).toEqual(['https://en.wikipedia.org/wiki/Apple_(disambiguation)']);
    });

    it('should handle multiple Wikipedia-style URLs', () => {
      const text = 'See https://en.wikipedia.org/wiki/Python_(programming_language) and https://en.wikipedia.org/wiki/Ruby_(programming_language)';
      const urls = extractUrls(text);
      
      expect(urls).toEqual([
        'https://en.wikipedia.org/wiki/Python_(programming_language)',
        'https://en.wikipedia.org/wiki/Ruby_(programming_language)'
      ]);
    });

    it('should remove unbalanced trailing parentheses', () => {
      const text = 'Link in parentheses (https://example.com)';
      const urls = extractUrls(text);
      
      expect(urls).toEqual(['https://example.com']);
    });

    it('should handle URLs with nested parentheses', () => {
      const text = 'See https://example.com/path/(nested_(content))';
      const urls = extractUrls(text);
      
      expect(urls).toEqual(['https://example.com/path/(nested_(content))']);
    });
  });
});
