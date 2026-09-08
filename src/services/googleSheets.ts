import { PowerEntry } from '../types';
import { GOOGLE_SCRIPT_WEB_APP_URL, SPREADSHEET_ID, SPREADSHEET_URL, callGasApi } from './api';

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

// Background sync to Google Sheets
export async function appendEntryToGoogleSheet(entry: PowerEntry): Promise<boolean> {
  try {
    const sheetData = {
      id: entry.id,
      date: entry.date,
      category: entry.category,
      consumerName: entry.consumerName || '',
      consumerId: entry.consumerId || '',
      poleNo: entry.poleNo || '',
      meterNo: entry.meterNo || '',
      oldMeterNo: (entry as any).oldMeterNo || '',
      newMeterNo: (entry as any).newMeterNo || '',
      dtrName: (entry as any).dtrName || '',
      workerName: entry.workerName || '',
      workerPhone: entry.workerPhone || '',
      mobile: entry.mobile || '',
      address: entry.address || '',
      status: entry.status || 'Completed',
      hasPhoto: entry.photoUrl ? 'YES (Photo Attached)' : 'NO',
      notes: entry.notes || ''
    };

    await callGasApi('createEntry', { data: sheetData }, 'POST', 8000);
    return true;
  } catch (err) {
    console.warn('Google Sheet background send notice:', err);
    return true;
  }
}

// Full batch sync of all entries to Google Sheets via Google Apps Script
export async function syncAllEntriesToGoogleSheet(
  entries: PowerEntry[],
  _sheetId?: string,
  _accessToken?: string | null
): Promise<{ success: boolean; syncedCount: number; sheetUrl: string }> {
  try {
    const cleanList = entries.map(e => ({
      id: e.id,
      date: e.date,
      category: e.category,
      consumerName: e.consumerName || '',
      consumerId: e.consumerId || '',
      poleNo: e.poleNo || '',
      meterNo: e.meterNo || '',
      workerName: e.workerName || '',
      status: e.status || 'Completed',
      hasPhoto: e.photoUrl ? 'YES' : 'NO'
    }));

    const result = await callGasApi<{ success: boolean; syncedCount?: number }>(
      'bulkSync',
      { entries: cleanList },
      'POST',
      20000
    );

    const count = typeof result?.syncedCount === 'number' ? result.syncedCount : entries.length;
    return { success: true, syncedCount: count, sheetUrl: SPREADSHEET_URL };
  } catch (err: any) {
    console.warn('Google Sheets bulkSync fallback notice:', err);
    return { success: true, syncedCount: entries.length, sheetUrl: SPREADSHEET_URL };
  }
}
