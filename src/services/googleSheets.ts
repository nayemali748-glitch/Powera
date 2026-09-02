import { PowerEntry } from '../types';
import { getAccessToken } from './googleAuth';

const SPREADSHEET_KEY = 'wb_power_google_sheet_id';
const SPREADSHEET_URL_KEY = 'wb_power_google_sheet_url';

export function getSavedSpreadsheetId(): string | null {
  return localStorage.getItem(SPREADSHEET_KEY);
}

export function getSavedSpreadsheetUrl(): string | null {
  return localStorage.getItem(SPREADSHEET_URL_KEY);
}

export function saveSpreadsheetInfo(id: string, url: string) {
  localStorage.setItem(SPREADSHEET_KEY, id);
  localStorage.setItem(SPREADSHEET_URL_KEY, url);
}

export function clearSpreadsheetInfo() {
  localStorage.removeItem(SPREADSHEET_KEY);
  localStorage.removeItem(SPREADSHEET_URL_KEY);
}

/**
 * Creates a dedicated, well-structured Google Sheet for WBSEDCL/Power Entry data
 */
export async function createPowerSpreadsheet(token?: string): Promise<{ id: string; url: string }> {
  const accessToken = token || (await getAccessToken());
  if (!accessToken) {
    throw new Error('Google Sheets access token not available. Please sign in with Google first.');
  }

  const title = `WB Power Dept - Field Work Database (${new Date().toLocaleDateString('en-GB')})`;

  const payload = {
    properties: {
      title,
    },
    sheets: [
      {
        properties: {
          title: 'All_Entries',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
      {
        properties: {
          title: 'NSC',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
      {
        properties: {
          title: 'DISCONNECTION',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
      {
        properties: {
          title: 'METER_REPLESMENT',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
      {
        properties: {
          title: 'POLE_CASE',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
      {
        properties: {
          title: 'DTR_REPLESMENT',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
    ],
  };

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Sheets creation failed: ${errorText}`);
  }

  const data = await res.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Set standard headers for All_Entries
  const headers = [
    'Entry ID',
    'Category',
    'Status',
    'Date',
    'Created At',
    'Lineman / Worker',
    'Substation',
    'Feeder Name',
    'Consumer ID',
    'Consumer Name',
    'Meter No',
    'Seal No',
    'Initial / Final Reading',
    'Address / Location',
    'Work Order No',
    'GPS Coordinates',
    'Photo Attached',
    'Notes / Remarks',
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/All_Entries!A1:R1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [headers],
      }),
    }
  );

  saveSpreadsheetInfo(spreadsheetId, spreadsheetUrl);
  return { id: spreadsheetId, url: spreadsheetUrl };
}

/**
 * Converts a PowerEntry object to a row array
 */
function entryToRow(entry: PowerEntry): (string | number)[] {
  return [
    entry.id || '',
    entry.category || '',
    entry.status || 'Completed',
    entry.date || new Date().toISOString().split('T')[0],
    entry.createdAt || new Date().toISOString(),
    entry.workerName || '',
    entry.substation || '',
    entry.feederName || '',
    entry.consumerId || '',
    entry.consumerName || '',
    entry.meterNo || entry.newMeterNo || entry.oldMeterNo || '',
    entry.sealNo || entry.newMeterSealNo || '',
    entry.initialReading || entry.finalReading || '',
    entry.address || '',
    entry.workOrderNo || '',
    entry.locationGps || '',
    entry.photoUrl ? 'YES (Captured)' : 'NO',
    entry.notes || entry.actionTaken || '',
  ];
}

/**
 * Appends a single entry to the Google Sheet
 */
export async function appendEntryToGoogleSheet(
  entry: PowerEntry,
  sheetId?: string,
  token?: string
): Promise<boolean> {
  const targetSheetId = sheetId || getSavedSpreadsheetId();
  if (!targetSheetId) return false;

  const accessToken = token || (await getAccessToken());
  if (!accessToken) return false;

  try {
    const row = entryToRow(entry);

    // Append to All_Entries
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${targetSheetId}/values/All_Entries!A:R:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [row],
        }),
      }
    );

    // Also attempt to append to category-specific tab if available
    const categoryTab = entry.category.replace(' ', '_');
    fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${targetSheetId}/values/${encodeURIComponent(categoryTab)}!A:R:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [row],
        }),
      }
    ).catch(() => {
      // Ignore if category tab not setup
    });

    return true;
  } catch (err) {
    console.error('Failed to append to Google Sheet:', err);
    return false;
  }
}

/**
 * Batch syncs all entries into the Google Sheet
 */
export async function syncAllEntriesToGoogleSheet(
  entries: PowerEntry[],
  sheetId?: string,
  token?: string
): Promise<{ success: boolean; syncedCount: number; sheetUrl: string }> {
  const accessToken = token || (await getAccessToken());
  if (!accessToken) {
    throw new Error('Google Sheets token missing. Please sign in with Google.');
  }

  let targetSheetId = sheetId || getSavedSpreadsheetId();
  let sheetUrl = getSavedSpreadsheetUrl() || '';

  if (!targetSheetId) {
    const created = await createPowerSpreadsheet(accessToken);
    targetSheetId = created.id;
    sheetUrl = created.url;
  }

  const rows = entries.map(entryToRow);

  // Clear existing data in All_Entries (except header)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${targetSheetId}/values/All_Entries!A2:R10000:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  // Write all current rows
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${targetSheetId}/values/All_Entries!A2?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!writeRes.ok) {
    const err = await writeRes.text();
    throw new Error(`Failed to write rows to Google Sheets: ${err}`);
  }

  return {
    success: true,
    syncedCount: rows.length,
    sheetUrl: sheetUrl || `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`,
  };
}
