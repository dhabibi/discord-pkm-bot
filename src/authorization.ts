/**
 * Check if a user is authorized to execute commands
 * @param userId - The Discord user ID to check
 * @returns True if the user is authorized, false otherwise
 */
export function isAuthorized(userId: string): boolean {
  const authorizedUserId = process.env.AUTHORIZED_USER_ID;
  
  // Environment variable is validated at startup, so this should always be set
  if (!authorizedUserId) {
    return false;
  }
  
  return userId === authorizedUserId;
}

/**
 * Log an unauthorized access attempt
 * @param userId - The Discord user ID who attempted access
 * @param username - The Discord username
 * @param commandName - The command that was attempted
 */
export function logUnauthorizedAccess(userId: string, username: string, commandName: string): void {
  console.warn(`[SECURITY] Unauthorized access attempt: User ${username} (ID: ${userId}) tried to execute /${commandName}`);
}

/**
 * Get the unauthorized error message to display to users
 * @returns A friendly error message for unauthorized users
 */
export function getUnauthorizedMessage(): string {
  return '🔒 You are not authorized to use this bot. If you believe this is an error, please contact the bot administrator.';
}
