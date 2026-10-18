import { fetchOfficialWbsedclReportAsync } from '../../src/utils/wbsedclReport';

export default async function handler(req: any, res: any) {
  const cleanId = String(req.query?.consumerId || req.body?.consumerId || '')
    .replace(/^(PWR-DIS-|TASK-DISC-|SUB-DISC-|PWR-)/i, '')
    .replace(/\.0+$/, '')
    .replace(/[, \-_]/g, '')
    .trim();

  if (!cleanId) {
    return res.status(400).send('Consumer ID is required.');
  }

  try {
    const report = await fetchOfficialWbsedclReportAsync(cleanId);
    if (report.success && report.pdfBase64) {
      const pdfBuffer = Buffer.from(report.pdfBase64, 'base64');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="WBSEDCL_Outstanding_Report_${cleanId}.pdf"`);
      return res.status(200).send(pdfBuffer);
    }

    return res.status(404).send(report.error || 'Official PDF could not be retrieved.');
  } catch (err: any) {
    return res.status(500).send(err?.message || 'Error downloading official report PDF');
  }
}
