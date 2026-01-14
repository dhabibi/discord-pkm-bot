import { verifyWebhookSignature, validateApiKey, createAuthHeader } from './auth';
import crypto from 'crypto';

describe('MCP Auth Module', () => {
  describe('verifyWebhookSignature', () => {
    it('should verify valid signature', () => {
      const secret = 'test_secret';
      const payload = JSON.stringify({ test: 'data' });
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
    });

    it('should reject invalid signature', () => {
      const secret = 'test_secret';
      const payload = JSON.stringify({ test: 'data' });
      const wrongSignature = 'invalid_signature_00000000000000000000000000000000';

      expect(verifyWebhookSignature(payload, wrongSignature, secret)).toBe(false);
    });

    it('should reject signature with wrong secret', () => {
      const secret = 'test_secret';
      const wrongSecret = 'wrong_secret';
      const payload = JSON.stringify({ test: 'data' });
      const signature = crypto
        .createHmac('sha256', wrongSecret)
        .update(payload)
        .digest('hex');

      expect(verifyWebhookSignature(payload, signature, secret)).toBe(false);
    });

    it('should handle errors gracefully', () => {
      const payload = JSON.stringify({ test: 'data' });
      const invalidSignature = 'not_a_hex_string';
      const secret = 'test_secret';

      expect(verifyWebhookSignature(payload, invalidSignature, secret)).toBe(false);
    });
  });

  describe('validateApiKey', () => {
    it('should accept valid API key', () => {
      expect(validateApiKey('valid_api_key_123')).toBe(true);
    });

    it('should reject undefined API key', () => {
      expect(validateApiKey(undefined)).toBe(false);
    });

    it('should reject empty API key', () => {
      expect(validateApiKey('')).toBe(false);
    });

    it('should reject whitespace-only API key', () => {
      expect(validateApiKey('   ')).toBe(false);
    });
  });

  describe('createAuthHeader', () => {
    it('should create proper authorization header', () => {
      const apiKey = 'test_key_123';
      const headers = createAuthHeader(apiKey);

      expect(headers).toEqual({
        'Authorization': 'Bearer test_key_123',
        'Content-Type': 'application/json'
      });
    });

    it('should handle special characters in API key', () => {
      const apiKey = 'key-with-special_chars.123';
      const headers = createAuthHeader(apiKey);

      expect(headers.Authorization).toBe('Bearer key-with-special_chars.123');
    });
  });
});
