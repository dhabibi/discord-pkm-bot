import crypto from 'crypto';

/**
 * Verify webhook signature from Poke
 * Uses HMAC-SHA256 to validate the webhook payload
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('[ERROR] Failed to verify webhook signature:', error);
    return false;
  }
}

/**
 * Verify API key for outbound requests to Poke
 */
export function validateApiKey(apiKey: string | undefined): boolean {
  if (!apiKey || apiKey.trim().length === 0) {
    return false;
  }
  // Add additional validation logic if needed
  return true;
}

/**
 * Create authorization header for Poke API requests
 */
export function createAuthHeader(apiKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
}
