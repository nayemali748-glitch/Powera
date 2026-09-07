const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzVV5sqqypop3sr19hstcti76QXw4aGIKHqAut31pcYMcOuffGwsAmtfbbOnx3KVB_7/exec';

async function readRawBody(req: any): Promise<string> {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return await new Promise<string>((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export default async function handler(req: any, res: any) {
  const target = process.env.GOOGLE_APPS_SCRIPT_URL || DEFAULT_SCRIPT_URL;
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    let url = target;
    let body: string | undefined;
    if (req.method === 'GET') {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(req.query || {})) {
        if (k !== 'path' && v !== undefined && v !== null) q.set(k, Array.isArray(v) ? String(v[0]) : String(v));
      }
      const qs = q.toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    } else {
      body = await readRawBody(req);
      if (!body) body = '{}';
      JSON.parse(body); // validate before forwarding
    }

    const response = await fetch(url, {
      method: req.method === 'GET' ? 'GET' : 'POST',
      headers: req.method === 'GET' ? undefined : { 'Content-Type': 'application/json;charset=utf-8' },
      body: req.method === 'GET' ? undefined : body,
      redirect: 'follow',
      cache: 'no-store'
    });

    const text = await response.text();
    res.status(response.status);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(text);
  } catch (err: any) {
    return res.status(502).json({ success: false, error: err?.message || 'Backend proxy error' });
  }
}
