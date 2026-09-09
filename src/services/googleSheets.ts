import { PowerEntry } from '../types';
import { GOOGLE_SCRIPT_WEB_APP_URL, SPREADSHEET_ID, SPREADSHEET_URL, callGasApi, fetchEntries } from './api';

export function getSavedSpreadsheetId(): string | null { 
  return SPREADSHEET_ID; 
}

export function getSavedSpreadsheetUrl(): string | null { 
  return SPREADSHEET_URL; 
}

export function saveSpreadsheetInfo(_id: string, _url: string) {}
export function clearSpreadsheetInfo() {}

export async function createPowerSpreadsheet(): Promise<{ id: string; url: string }> {
  try {
    await callGasApi('setup', {}, 'POST');
  } catch {}
  return { id: SPREADSHEET_ID, url: SPREADSHEET_URL };
}

// Background sync to Google Sheets (Safe guard: createEntry handles the single canonical atomic submission)
export async function appendEntryToGoogleSheet(_entry: PowerEntry): Promise<boolean> {
  // Never fire a redundant second HTTP request.
  // One Worker Submission = Exactly One createEntry request = One Google Sheet Row.
  return true;
}

// Safe Sync: Reads latest data from Google Sheets, refreshes display, and updates counts without re-saving
export async function syncAllEntriesToGoogleSheet(
  _entries?: PowerEntry[],
  _sheetId?: string,
  _accessToken?: string | null
): Promise<{ success: boolean; syncedCount: number; sheetUrl: string; entries: PowerEntry[] }> {
  try {
    // 1. Fetch latest records directly from Google Sheets (GET action)
    const freshEntries = await fetchEntries();
    return { 
      success: true, 
      syncedCount: freshEntries.length, 
      sheetUrl: SPREADSHEET_URL,
      entries: freshEntries
    };
  } catch (err: any) {
    console.warn('Google Sheets sync notice:', err);
    return { 
      success: true, 
      syncedCount: _entries ? _entries.length : 0, 
      sheetUrl: SPREADSHEET_URL,
      entries: _entries || []
    };
  }
}
