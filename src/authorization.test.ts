import { isAuthorized, logUnauthorizedAccess, getUnauthorizedMessage } from './authorization';

describe('Authorization', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isAuthorized', () => {
    it('should return true for authorized user', () => {
      process.env.AUTHORIZED_USER_ID = '123456789';
      expect(isAuthorized('123456789')).toBe(true);
    });

    it('should return false for unauthorized user', () => {
      process.env.AUTHORIZED_USER_ID = '123456789';
      expect(isAuthorized('987654321')).toBe(false);
    });

    it('should return false when AUTHORIZED_USER_ID is not set', () => {
      delete process.env.AUTHORIZED_USER_ID;
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      expect(isAuthorized('123456789')).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ERROR] AUTHORIZED_USER_ID environment variable is not set. All commands are blocked for security.'
      );
      
      consoleSpy.mockRestore();
    });

    it('should return false when AUTHORIZED_USER_ID is empty string', () => {
      process.env.AUTHORIZED_USER_ID = '';
      expect(isAuthorized('123456789')).toBe(false);
    });
  });

  describe('logUnauthorizedAccess', () => {
    it('should log unauthorized access attempts with user details', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      logUnauthorizedAccess('987654321', 'UnauthorizedUser#1234', 'save');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[SECURITY] Unauthorized access attempt: User UnauthorizedUser#1234 (ID: 987654321) tried to execute /save'
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle different commands correctly', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      logUnauthorizedAccess('111222333', 'TestUser#5678', 'ping');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[SECURITY] Unauthorized access attempt: User TestUser#5678 (ID: 111222333) tried to execute /ping'
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('getUnauthorizedMessage', () => {
    it('should return a friendly error message', () => {
      const message = getUnauthorizedMessage();
      expect(message).toBe('🔒 You are not authorized to use this bot. If you believe this is an error, please contact the bot administrator.');
    });

    it('should include the lock emoji', () => {
      const message = getUnauthorizedMessage();
      expect(message).toContain('🔒');
    });

    it('should not expose sensitive information', () => {
      const message = getUnauthorizedMessage();
      expect(message).not.toContain('ID');
      expect(message).not.toContain('user');
      expect(message.toLowerCase()).toContain('authorized');
    });
  });
});
