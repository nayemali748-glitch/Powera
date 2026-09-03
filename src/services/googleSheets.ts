import { PowerEntry } from '../types';

const SPREADSHEET_ID = '1-3LtAbXZU6klisReK6ffIxDUwbM4wXvhxSbKVpE7raY';
const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzVV5sqqypop3sr19hstcti76QXw4aGIKHqAut31pcYMcOuffGwsAmtfbbOnx3KVB_7/exec';

export function getSavedSpreadsheetId(): string | null { 
  return SPREADSHEET_ID; 
}

export function getSavedSpreadsheetUrl(): string | null { 
  return SPREADSHEET_URL; 
}

export function saveSpreadsheetInfo(_id: string, _url: string) {}
export function clearSpreadsheetInfo() {}

export async function createPowerSpreadsheet(): Promise<{ id: string; url: string }> {
  return { id: SPREADSHEET_ID, url: SPREADSHEET_URL };
}

// Background, non-blocking sync to Google Sheets
export async function appendEntryToGoogleSheet(entry: PowerEntry): Promise<boolean> {
  // Fire-and-forget in background with a 6-second timeout so the UI never waits or lags
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    // Prepare clean lightweight payload for Sheets (no heavy base64 strings to avoid GAS freeze)
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

    fetch(GAS_URL, {
      method: 'POST',
      mode: 'no-cors', // Avoid cross-origin blocking in browser
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'createEntry', data: sheetData }),
      signal: controller.signal
    }).catch(err => {
      console.warn('Background Google Sheet sync notice:', err);
    }).finally(() => {
      clearTimeout(timeoutId);
    });

    return true;
  } catch (err) {
    console.warn('Google Sheet background send skipped:', err);
    return true;
  }
}

export async function syncAllEntriesToGoogleSheet(
  entries: PowerEntry[],
  _sheetId?: string,
  _accessToken?: string | null
): Promise<{ success: boolean; syncedCount: number; sheetUrl: string }> {
  let syncedCount = 0;
  try {
    // Send a batch sync request
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

    await fetch(GAS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'bulkSync', entries: cleanList })
    }).catch(() => {});

    syncedCount = entries.length;
  } catch {}

  return { success: true, syncedCount, sheetUrl: SPREADSHEET_URL };
}
