// In-memory storage for channel autosave settings
const channelAutosaveSettings = new Map<string, boolean>();

export function toggleAutosave(channelId: string): boolean {
  const currentSetting = channelAutosaveSettings.get(channelId) || false;
  const newSetting = !currentSetting;
  channelAutosaveSettings.set(channelId, newSetting);
  return newSetting;
}

export function isAutosaveEnabled(channelId: string): boolean {
  return channelAutosaveSettings.get(channelId) || false;
}

export function clearAutosaveSettings(): void {
  channelAutosaveSettings.clear();
}
