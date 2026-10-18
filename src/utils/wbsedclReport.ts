import https from 'https';
import zlib from 'zlib';

const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface OfficialWbsedclData {
  consumerId: string;
  reportType: 'OUTSTANDING REPORT' | 'NO DUES CERTIFICATE';
  consumerName: string;
  address: string;
  office: string;
  connDate: string;
  connectionStatus: string;
  outstandingAmount: number | null;
  lpscAmount: number | null;
  lpscSurcharge: number | null;
  lpscAvailable: boolean;
  totalDueAmount: number | null;
  reportingDate: string;
  lastReadingDate: string;
  lastCheckedAt: string;
}

export interface OfficialWbsedclResponse {
  success: boolean;
  liveConnected: boolean;
  officialPortalUrl: string;
  requiresBrowserOpen?: boolean;
  error?: string;
  pdfBase64?: string;
  data?: OfficialWbsedclData;
}

function fetchHttpsBuffer(url: string, headers: Record<string, string> = {}): Promise<{ statusCode: number; headers: Record<string, any>; buffer: Buffer }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...headers
      }
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 200,
          headers: res.headers,
          buffer: Buffer.concat(chunks)
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(18000, () => {
      req.destroy(new Error('Timeout connecting to WBSEDCL portal.'));
    });
    req.end();
  });
}

/**
 * Pure Node.js official WBSEDCL Outstanding Report retriever.
 * Works seamlessly in both standard Node server (AI Studio) and Vercel Serverless Function without curl or local disk dependency.
 */
export async function fetchOfficialWbsedclReportAsync(consumerId: string): Promise<OfficialWbsedclResponse> {
  const cleanId = String(consumerId || '').replace(/^(PWR-DIS-|TASK-DISC-|SUB-DISC-|PWR-)/i, '').replace(/\.0+$/, '').replace(/[, \-_]/g, '').trim();
  const officialPortalUrl = `https://portal.wbsedcl.in/webdynpro/resources/wbsedcl/noduesandoutstandingreport/OutstandingReport?consumerId=${cleanId}`;

  if (!cleanId) {
    return {
      success: false,
      liveConnected: false,
      officialPortalUrl,
      error: 'Valid Consumer ID is required.'
    };
  }

  try {
    // Step 1: Handshake with portal to establish NetWeaver session cookies
    const r1 = await fetchHttpsBuffer(officialPortalUrl);
    const rawSetCookie = (r1.headers['set-cookie'] || []) as string[];
    const cookieStr = rawSetCookie.map(c => c.split(';')[0]).join('; ');

    // Step 2: Request report with session cookies
    const r2 = await fetchHttpsBuffer(officialPortalUrl, cookieStr ? { 'Cookie': cookieStr } : {});
    const html = r2.buffer.toString('utf-8');

    const m = html.match(/openExternalWindow\([^,]+,\s*[\x27\x22]([^\x27\x22]+)[\x27\x22]/);
    if (!m) {
      return {
        success: false,
        liveConnected: false,
        officialPortalUrl,
        requiresBrowserOpen: true,
        error: 'Official WBSEDCL SAP portal session expired or requires direct browser verification.'
      };
    }

    let rawLink = m[1];
    rawLink = rawLink.replace(/\\\\x([0-9a-fA-F]{2})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)));
    rawLink = rawLink.replace(/\\x([0-9a-fA-F]{2})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)));
    const pdfUrl = `https://portal.wbsedcl.in/webdynpro/resources/wbsedcl/noduesandoutstandingreport/${rawLink}`;

    // Step 3: Fetch official PDF stream in memory
    const pdfRes = await fetchHttpsBuffer(pdfUrl, {
      'Referer': officialPortalUrl,
      ...(cookieStr ? { 'Cookie': cookieStr } : {})
    });

    const pdfBuffer = pdfRes.buffer;
    if (!pdfBuffer.slice(0, 5).toString('utf-8').startsWith('%PDF')) {
      return {
        success: false,
        liveConnected: false,
        officialPortalUrl,
        requiresBrowserOpen: true,
        error: 'WBSEDCL did not return a valid PDF document.'
      };
    }

    // Extract text from uncompressed streams in the PDF
    const regex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match;
    let fullText = '';
    while ((match = regex.exec(pdfBuffer.toString('binary'))) !== null) {
      try {
        const streamData = Buffer.from(match[1], 'binary');
        const decompressed = zlib.inflateSync(streamData);
        fullText += ' ' + decompressed.toString('utf-8');
      } catch {
        // Continue parsing next stream
      }
    }

    const nameMatch = fullText.match(/Name\s*:\s*([^)]+?)\)/i);
    const addrMatch = fullText.match(/Service Location Address\s*:\s*\)Tj[\s\S]*?\(([^)]+?)\)Tj/i) || fullText.match(/Service Location Address\s*:\s*([^)]+?)\)/i);
    const officeMatch = fullText.match(/Office Name\s*:\s*([^)]+?)\)/i);
    const connDateMatch = fullText.match(/Date of Service Connection\s*:\s*([^)]+?)\)/i);
    const statusMatch = fullText.match(/Connection Status\s*:\s*([^)]+?)\)/i);
    const isNoDuesCert = /NO DUES CERTIFICATE/i.test(fullText) || /no unpaid bill against/i.test(fullText);
    const unpaidMatch = fullText.match(/total unpaid bill amount is Rs\.\s*([0-9.,]+)/i);
    const lpscMatch = fullText.match(/Late Payment Surcharge\s*(?:\\?\(|\()?LPSC(?:\\?\))?\s*amount of Rs\.?\s*([0-9.,]+)/i)
      || fullText.match(/LPSC.*?amount of Rs\.?\s*([0-9.,]+)/i);
    const reportingDateMatch = fullText.match(/as on\)\s*Tj[\s\S]*?([0-9]{2}\.[0-9]{2}\.[0-9]{4})/i)
      || fullText.match(/as on[\s\S]*?([0-9]{2}\.[0-9]{2}\.[0-9]{4})/i)
      || fullText.match(/([0-9]{2}\.[0-9]{2}\.[0-9]{4})/);
    const readingDateMatch = fullText.match(/meter reading dated[\s\S]*?([0-9]{2}\.[0-9]{2}\.[0-9]{4})/i)
      || fullText.match(/meter reading dated\s*([0-9.]+)/i);

    let unpaidAmount: number | null = null;
    let lpscAmount: number | null = null;

    if (isNoDuesCert) {
      unpaidAmount = 0;
      lpscAmount = 0;
    } else {
      unpaidAmount = unpaidMatch ? parseFloat(unpaidMatch[1].replace(/,/g, '')) : null;
      lpscAmount = lpscMatch ? parseFloat(lpscMatch[1].replace(/,/g, '')) : null;
    }

    const isLpscAvailable = typeof lpscAmount === 'number' && !isNaN(lpscAmount);
    const isUnpaidAvailable = typeof unpaidAmount === 'number' && !isNaN(unpaidAmount);

    let totalDue: number | null = null;
    if (isUnpaidAvailable && isLpscAvailable) {
      totalDue = Math.round(((unpaidAmount ?? 0) + (lpscAmount ?? 0)) * 100) / 100;
    } else if (isUnpaidAvailable) {
      totalDue = unpaidAmount;
    }

    return {
      success: true,
      liveConnected: true,
      officialPortalUrl,
      pdfBase64: pdfBuffer.toString('base64'),
      data: {
        consumerId: cleanId,
        reportType: isNoDuesCert ? 'NO DUES CERTIFICATE' : 'OUTSTANDING REPORT',
        consumerName: nameMatch ? nameMatch[1].trim() : '',
        address: addrMatch ? addrMatch[1].trim() : '',
        office: officeMatch ? officeMatch[1].trim() : '',
        connDate: connDateMatch ? connDateMatch[1].trim() : '',
        connectionStatus: statusMatch ? statusMatch[1].trim() : 'LIVE',
        outstandingAmount: unpaidAmount,
        lpscAmount: lpscAmount,
        lpscSurcharge: lpscAmount,
        lpscAvailable: isLpscAvailable,
        totalDueAmount: totalDue,
        reportingDate: reportingDateMatch ? reportingDateMatch[1].trim() : '',
        lastReadingDate: readingDateMatch ? readingDateMatch[1].trim().replace(/\.$/, '') : '',
        lastCheckedAt: new Date().toISOString()
      }
    };
  } catch (err: any) {
    return {
      success: false,
      liveConnected: false,
      officialPortalUrl,
      requiresBrowserOpen: true,
      error: `WBSEDCL portal notice: ${err?.message || 'Official report access unavailable. Open direct portal link.'}`
    };
  }
}
