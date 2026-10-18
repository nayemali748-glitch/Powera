import { fetchOfficialWbsedclReportAsync } from '../../src/utils/wbsedclReport';

export default async function handler(req: any, res: any) {
  // Set CORS & Cache-Control headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const rawConsumerId = String(body?.consumerId || req.query?.consumerId || body?.id || '').trim();
    const cleanId = rawConsumerId
      .replace(/^(PWR-DIS-|TASK-DISC-|SUB-DISC-|PWR-)/i, '')
      .replace(/\.0+$/, '')
      .replace(/[, \-_]/g, '')
      .trim();

    if (!cleanId) {
      return res.status(400).json({
        success: false,
        error: 'A valid Consumer ID is required for Outstanding & LPSC check.'
      });
    }

    const officialReport = await fetchOfficialWbsedclReportAsync(cleanId);

    if (officialReport.success && officialReport.data) {
      return res.status(200).json({
        success: true,
        liveConnected: true,
        consumerId: cleanId,
        consumerName: officialReport.data.consumerName,
        address: officialReport.data.address,
        ccc: officialReport.data.office,
        office: officialReport.data.office,
        connDate: officialReport.data.connDate,
        connectionStatus: officialReport.data.connectionStatus,
        outstandingAmount: officialReport.data.outstandingAmount,
        lpscAmount: officialReport.data.lpscAmount,
        lpscSurcharge: officialReport.data.lpscSurcharge,
        lpscAvailable: officialReport.data.lpscAvailable,
        totalDueAmount: officialReport.data.totalDueAmount,
        reportingDate: officialReport.data.reportingDate,
        lastReadingDate: officialReport.data.lastReadingDate,
        lastCheckedAt: officialReport.data.lastCheckedAt,
        officialPortalUrl: officialReport.officialPortalUrl,
        reportType: officialReport.data.reportType,
        hasOfficialPdf: Boolean(officialReport.pdfBase64),
        source: 'WBSEDCL Official Live WebDynpro Portal'
      });
    }

    return res.status(200).json({
      success: false,
      liveConnected: false,
      consumerId: cleanId,
      officialPortalUrl: officialReport.officialPortalUrl,
      requiresBrowserOpen: true,
      error: officialReport.error || 'Direct automated retrieval from WBSEDCL was restricted. Please click "Open Official WBSEDCL Report Page" to view/verify the report directly in your browser.'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error during live check'
    });
  }
}
