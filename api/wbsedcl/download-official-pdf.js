// api/wbsedcl/download-official-pdf.ts
import https from "https";
var BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
function fetchHttpsBuffer(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: "GET",
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...headers
      }
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode || 200,
          headers: res.headers,
          buffer: Buffer.concat(chunks)
        });
      });
    });
    req.on("error", reject);
    req.setTimeout(18e3, () => {
      req.destroy(new Error("Timeout connecting to WBSEDCL portal."));
    });
    req.end();
  });
}
async function handler(req, res) {
  const origin = req.headers?.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  if (origin !== "*") {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  const cleanId = String(req.query?.consumerId || req.body?.consumerId || "").replace(/^(PWR-DIS-|TASK-DISC-|SUB-DISC-|PWR-)/i, "").replace(/\.0+$/, "").replace(/[, \-_]/g, "").trim();
  if (!cleanId) {
    return res.status(400).send("Consumer ID is required.");
  }
  const officialPortalUrl = `https://portal.wbsedcl.in/webdynpro/resources/wbsedcl/noduesandoutstandingreport/OutstandingReport?consumerId=${cleanId}`;
  try {
    const r1 = await fetchHttpsBuffer(officialPortalUrl);
    const rawSetCookie = r1.headers["set-cookie"] || [];
    const cookieStr = rawSetCookie.map((c) => c.split(";")[0]).join("; ");
    const r2 = await fetchHttpsBuffer(officialPortalUrl, cookieStr ? { "Cookie": cookieStr } : {});
    const html = r2.buffer.toString("utf-8");
    const m = html.match(/openExternalWindow\([^,]+,\s*[\x27\x22]([^\x27\x22]+)[\x27\x22]/);
    if (!m) {
      return res.redirect(officialPortalUrl);
    }
    let rawLink = m[1];
    rawLink = rawLink.replace(/\\\\x([0-9a-fA-F]{2})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)));
    rawLink = rawLink.replace(/\\x([0-9a-fA-F]{2})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)));
    const pdfUrl = `https://portal.wbsedcl.in/webdynpro/resources/wbsedcl/noduesandoutstandingreport/${rawLink}`;
    const pdfRes = await fetchHttpsBuffer(pdfUrl, {
      "Referer": officialPortalUrl,
      ...cookieStr ? { "Cookie": cookieStr } : {}
    });
    const pdfBuffer = pdfRes.buffer;
    if (pdfBuffer.slice(0, 5).toString("utf-8").startsWith("%PDF")) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="WBSEDCL_Outstanding_Report_${cleanId}.pdf"`);
      return res.status(200).send(pdfBuffer);
    }
    return res.redirect(officialPortalUrl);
  } catch {
    return res.redirect(officialPortalUrl);
  }
}
export {
  handler as default
};
