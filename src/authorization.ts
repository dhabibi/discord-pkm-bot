import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Check if a user is authorized to execute commands
 * @param userId - The Discord user ID to check
 * @returns True if the user is authorized, false otherwise
 */
export function isAuthorized(userId: string): boolean {
  const authorizedUserId = process.env.AUTHORIZED_USER_ID;
  
  // If no authorized user ID is configured, deny all access for security
  if (!authorizedUserId) {
    console.error('[ERROR] AUTHORIZED_USER_ID environment variable is not set. All commands are blocked for security.');
    return false;
  }
  
  return userId === authorizedUserId;
}

/**
 * Log an unauthorized access attempt
 * @param userId - The Discord user ID who attempted access
 * @param userTag - The Discord user tag (username#discriminator)
 * @param commandName - The command that was attempted
 */
export function logUnauthorizedAccess(userId: string, userTag: string, commandName: string): void {
  console.warn(`[SECURITY] Unauthorized access attempt: User ${userTag} (ID: ${userId}) tried to execute /${commandName}`);
}

/**
 * Get the unauthorized error message to display to users
 * @returns A friendly error message for unauthorized users
 */
export function getUnauthorizedMessage(): string {
  return '🔒 You are not authorized to use this bot. If you believe this is an error, please contact the bot administrator.';
}
