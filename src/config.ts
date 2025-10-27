/**
 * Configuration and constants
 */

import { homedir, platform } from 'os';
import { join } from 'path';

export const DEFAULT_TTL_DAYS = 14;

/**
 * Get the storage directory following XDG Base Directory specification
 */
export function getStorageDir(): string {
  const isWindows = platform() === 'win32';

  if (isWindows) {
    const appData = process.env.APPDATA;
    if (!appData) {
      throw new Error('APPDATA environment variable not found');
    }
    return join(appData, 'jot-mcp');
  }

  // Linux/macOS - follow XDG specification
  const xdgConfigHome = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(xdgConfigHome, 'jot-mcp');
}

export function getDatabasePath(): string {
  return join(getStorageDir(), 'jots.sqlite');
}
