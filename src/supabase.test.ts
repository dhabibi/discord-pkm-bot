import { getSupabaseClient, saveLink, resetSupabaseClient } from './supabase';
import { createClient } from '@supabase/supabase-js';

// Mock the Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

describe('Supabase Client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment and client before each test
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    resetSupabaseClient();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getSupabaseClient', () => {
    it('should create a Supabase client with valid credentials', () => {
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SECRET_KEY = 'test-key';

      const mockClient = { from: jest.fn() };
      (createClient as jest.Mock).mockReturnValue(mockClient);

      const client = getSupabaseClient();

      expect(createClient).toHaveBeenCalledWith(
        'https://example.supabase.co',
        'test-key'
      );
      expect(client).toBe(mockClient);
    });

    it('should throw an error if SUPABASE_URL is missing', () => {
      process.env.SUPABASE_SECRET_KEY = 'test-key';
      delete process.env.SUPABASE_URL;

      expect(() => getSupabaseClient()).toThrow(
        'Missing required Supabase environment variables: SUPABASE_URL and/or SUPABASE_SECRET_KEY'
      );
    });

    it('should throw an error if SUPABASE_SECRET_KEY is missing', () => {
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      delete process.env.SUPABASE_SECRET_KEY;

      expect(() => getSupabaseClient()).toThrow(
        'Missing required Supabase environment variables: SUPABASE_URL and/or SUPABASE_SECRET_KEY'
      );
    });
  });

  describe('saveLink', () => {
    it('should save a link successfully', async () => {
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SECRET_KEY = 'test-key';

      const mockLink = { url: 'https://example.com', created_at: '2024-01-01' };
      const mockSelect = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockLink, error: null })
      });
      const mockInsert = jest.fn().mockReturnValue({
        select: mockSelect
      });
      const mockFrom = jest.fn().mockReturnValue({
        insert: mockInsert
      });
      const mockClient = { from: mockFrom };
      (createClient as jest.Mock).mockReturnValue(mockClient);

      const result = await saveLink('https://example.com');

      expect(mockFrom).toHaveBeenCalledWith('links');
      expect(mockInsert).toHaveBeenCalledWith({ url: 'https://example.com' });
      expect(result.data).toEqual(mockLink);
      expect(result.error).toBeNull();
    });

    it('should return error if save fails', async () => {
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SECRET_KEY = 'test-key';

      const mockError = { message: 'Database error' };
      const mockSelect = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null, error: mockError })
      });
      const mockInsert = jest.fn().mockReturnValue({
        select: mockSelect
      });
      const mockFrom = jest.fn().mockReturnValue({
        insert: mockInsert
      });
      const mockClient = { from: mockFrom };
      (createClient as jest.Mock).mockReturnValue(mockClient);

      const result = await saveLink('https://example.com');

      expect(result.data).toBeNull();
      expect(result.error).toEqual(mockError);
    });
  });
});
