import app from '../server.js';

export default function handler(req: any, res: any) {
  // If Vercel rewrite forwarded a sub-path to /api, restore the original URL so Express routes match
  if (req.url === '/api') {
    const rawTarget = req.headers?.['x-matched-path'] || req.originalUrl;
    if (rawTarget && typeof rawTarget === 'string' && rawTarget !== '/api') {
      req.url = rawTarget;
    }
  }

  return new Promise<void>((resolve, reject) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    res.on('error', reject);
    try {
      app(req, res, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

