import { toggleAutosave, isAutosaveEnabled, clearAutosaveSettings } from './autosave';

describe('Autosave Settings', () => {
  beforeEach(() => {
    clearAutosaveSettings();
  });

  describe('toggleAutosave', () => {
    it('should enable autosave when disabled', () => {
      const channelId = '123456789';
      const result = toggleAutosave(channelId);
      
      expect(result).toBe(true);
      expect(isAutosaveEnabled(channelId)).toBe(true);
    });

    it('should disable autosave when enabled', () => {
      const channelId = '123456789';
      
      // Enable first
      toggleAutosave(channelId);
      expect(isAutosaveEnabled(channelId)).toBe(true);
      
      // Then disable
      const result = toggleAutosave(channelId);
      expect(result).toBe(false);
      expect(isAutosaveEnabled(channelId)).toBe(false);
    });

    it('should handle different channels independently', () => {
      const channel1 = '111111111';
      const channel2 = '222222222';
      
      toggleAutosave(channel1);
      
      expect(isAutosaveEnabled(channel1)).toBe(true);
      expect(isAutosaveEnabled(channel2)).toBe(false);
    });
  });

  describe('isAutosaveEnabled', () => {
    it('should return false for channels with no setting', () => {
      const channelId = '123456789';
      expect(isAutosaveEnabled(channelId)).toBe(false);
    });

    it('should return true for channels with autosave enabled', () => {
      const channelId = '123456789';
      toggleAutosave(channelId);
      expect(isAutosaveEnabled(channelId)).toBe(true);
    });
  });
});
