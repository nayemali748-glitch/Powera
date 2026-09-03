import { PowerEntry } from '../types';
import { createEntry } from './api';

const SPREADSHEET_ID = '1-3LtAbXZU6klisReK6ffIxDUwbM4wXvhxSbKVpE7raY';
const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;

export function getSavedSpreadsheetId(): string | null { return SPREADSHEET_ID; }
export function getSavedSpreadsheetUrl(): string | null { return SPREADSHEET_URL; }
export function saveSpreadsheetInfo(_id: string, _url: string) {}
export function clearSpreadsheetInfo() {}

export async function createPowerSpreadsheet(): Promise<{ id: string; url: string }> {
  return { id: SPREADSHEET_ID, url: SPREADSHEET_URL };
}

export async function appendEntryToGoogleSheet(entry: PowerEntry): Promise<boolean> {
  await createEntry(entry);
  return true;
}

export async function syncAllEntriesToGoogleSheet(entries: PowerEntry[]): Promise<{ success: boolean; syncedCount: number; sheetUrl: string }> {
  let syncedCount = 0;
  for (const entry of entries) {
    await createEntry(entry);
    syncedCount++;
  }
  return { success: true, syncedCount, sheetUrl: SPREADSHEET_URL };
}
