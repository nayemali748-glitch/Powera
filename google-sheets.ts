/** Vercel serverless proxy for Google Apps Script.
 * Browser -> same-origin Vercel -> Apps Script -> Google Sheet.
 * This avoids browser CORS/redirect parsing problems with Apps Script.
 */
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzVV5sqqypop3sr19hstcti76QXw4aGIKHqAut31pcYMcOuffGwsAmtfbbOnx3KVB_7/exec';

export default async function handler(req: any, res: any) {
  const target = process.env.GOOGLE_APPS_SCRIPT_URL || process.env.VITE_GOOGLE_SHEET_API_URL || DEFAULT_SCRIPT_URL;
  try {
    let url = target;
    if (req.method === 'GET') {
      const q = new URLSearchParams();
      const query = req.query || {};
      for (const [k, v] of Object.entries(query)) {
        if (Array.isArray(v)) q.set(k, String(v[0]));
        else if (v !== undefined && v !== null) q.set(k, String(v));
      }
      url += (url.includes('?') ? '&' : '?') + q.toString();
    }

    const response = await fetch(url, {
      method: req.method === 'GET' ? 'GET' : 'POST',
      headers: req.method === 'GET' ? {} : { 'Content-Type': 'text/plain;charset=utf-8' },
      body: req.method === 'GET' ? undefined : JSON.stringify(typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})),
      redirect: 'follow'
    });

    const text = await response.text();
    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(text);
  } catch (err: any) {
    res.status(502).setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(JSON.stringify({ success: false, error: err?.message || 'Backend proxy error' }));
  }
}
