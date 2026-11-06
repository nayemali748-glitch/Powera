// server.ts
import "dotenv/config";
import dotenv from "dotenv";
import express from "express";
import path2 from "path";
import fs2 from "fs";
import dns from "dns";
import crypto2 from "crypto";
import net from "net";
import { GoogleGenAI } from "@google/genai";
import * as XLSX from "xlsx";

// src/utils/wbsedclReport.ts
import https from "https";
import zlib from "zlib";
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
        let buf = Buffer.concat(chunks);
        const encoding = res.headers["content-encoding"];
        if (encoding === "gzip") {
          try {
            buf = zlib.gunzipSync(buf);
          } catch {
          }
        } else if (encoding === "deflate") {
          try {
            buf = zlib.inflateSync(buf);
          } catch {
          }
        }
        resolve({
          statusCode: res.statusCode || 200,
          headers: res.headers,
          buffer: buf
        });
      });
    });
    req.on("error", reject);
    req.setTimeout(25e3, () => {
      req.destroy(new Error("Timeout connecting to WBSEDCL portal."));
    });
    req.end();
  });
}
function cleanAndNormalizeConsumerId(consumerId) {
  if (!consumerId) return "";
  let str = String(consumerId).trim();
  const bengaliDigits = ["\u09E6", "\u09E7", "\u09E8", "\u09E9", "\u09EA", "\u09EB", "\u09EC", "\u09ED", "\u09EE", "\u09EF"];
  for (let i = 0; i < bengaliDigits.length; i++) {
    str = str.replaceAll(bengaliDigits[i], i.toString());
  }
  return str.replace(/^(PWR-DIS-|TASK-DISC-|SUB-DISC-|PWR-|TASK-|DISC-|CON-)/i, "").replace(/\.0+$/, "").replace(/[, \-_]/g, "").trim();
}
async function fetchOfficialWbsedclReportAsync(consumerId) {
  const cleanId = cleanAndNormalizeConsumerId(consumerId);
  const officialPortalUrl = `https://portal.wbsedcl.in/webdynpro/resources/wbsedcl/noduesandoutstandingreport/OutstandingReport?consumerId=${cleanId}`;
  if (!cleanId) {
    return {
      success: false,
      liveConnected: false,
      officialPortalUrl,
      error: "Valid Consumer ID is required."
    };
  }
  try {
    const r1 = await fetchHttpsBuffer(officialPortalUrl);
    const rawSetCookie = r1.headers["set-cookie"] || [];
    const cookieStr = rawSetCookie.map((c) => c.split(";")[0]).join("; ");
    const html1 = r1.buffer.toString("utf-8");
    let m = html1.match(/openExternalWindow\([^,]+,\s*[\x27\x22]([^\x27\x22]+)[\x27\x22]/);
    if (!m) {
      const r2 = await fetchHttpsBuffer(officialPortalUrl, cookieStr ? { "Cookie": cookieStr } : {});
      const html2 = r2.buffer.toString("utf-8");
      m = html2.match(/openExternalWindow\([^,]+,\s*[\x27\x22]([^\x27\x22]+)[\x27\x22]/);
    }
    if (!m) {
      return {
        success: false,
        liveConnected: false,
        officialPortalUrl,
        requiresBrowserOpen: true,
        error: "Official WBSEDCL SAP portal session expired or requires direct browser verification."
      };
    }
    let rawLink = m[1];
    rawLink = rawLink.replace(/\\\\x([0-9a-fA-F]{2})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)));
    rawLink = rawLink.replace(/\\x([0-9a-fA-F]{2})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)));
    const pdfUrl = new URL(rawLink, officialPortalUrl).href;
    const pdfRes = await fetchHttpsBuffer(pdfUrl, {
      "Referer": officialPortalUrl,
      ...cookieStr ? { "Cookie": cookieStr } : {}
    });
    const pdfBuffer = pdfRes.buffer;
    if (!pdfBuffer.slice(0, 5).toString("utf-8").startsWith("%PDF")) {
      return {
        success: false,
        liveConnected: false,
        officialPortalUrl,
        requiresBrowserOpen: true,
        error: "WBSEDCL did not return a valid PDF document."
      };
    }
    const regex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match;
    let fullText = "";
    while ((match = regex.exec(pdfBuffer.toString("binary"))) !== null) {
      try {
        const streamData = Buffer.from(match[1], "binary");
        const decompressed = zlib.inflateSync(streamData);
        fullText += " " + decompressed.toString("utf-8");
      } catch {
      }
    }
    const nameMatch = fullText.match(/Name\s*:\s*([^)]+?)\)/i);
    const addrMatch = fullText.match(/Service Location Address\s*:\s*\)Tj[\s\S]*?\(([^)]+?)\)Tj/i) || fullText.match(/Service Location Address\s*:\s*([^)]+?)\)/i);
    const officeMatch = fullText.match(/Office Name\s*:\s*([^)]+?)\)/i);
    const connDateMatch = fullText.match(/Date of Service Connection\s*:\s*([^)]+?)\)/i);
    const statusMatch = fullText.match(/Connection Status\s*:\s*([^)]+?)\)/i);
    const isNoDuesCert = /NO DUES CERTIFICATE/i.test(fullText) || /no unpaid bill against/i.test(fullText);
    const unpaidMatch = fullText.match(/total unpaid bill amount is Rs\.\s*([0-9.,]+)/i);
    const lpscMatch = fullText.match(/Late Payment Surcharge\s*(?:\\?\(|\()?LPSC(?:\\?\))?\s*amount of Rs\.?\s*([0-9.,]+)/i) || fullText.match(/LPSC.*?amount of Rs\.?\s*([0-9.,]+)/i);
    const reportingDateMatch = fullText.match(/as on\)\s*Tj[\s\S]*?([0-9]{2}\.[0-9]{2}\.[0-9]{4})/i) || fullText.match(/as on[\s\S]*?([0-9]{2}\.[0-9]{2}\.[0-9]{4})/i) || fullText.match(/([0-9]{2}\.[0-9]{2}\.[0-9]{4})/);
    const readingDateMatch = fullText.match(/meter reading dated[\s\S]*?([0-9]{2}\.[0-9]{2}\.[0-9]{4})/i) || fullText.match(/meter reading dated\s*([0-9.]+)/i);
    let unpaidAmount = null;
    let lpscAmount = null;
    if (isNoDuesCert) {
      unpaidAmount = 0;
      lpscAmount = 0;
    } else {
      unpaidAmount = unpaidMatch ? parseFloat(unpaidMatch[1].replace(/,/g, "")) : null;
      lpscAmount = lpscMatch ? parseFloat(lpscMatch[1].replace(/,/g, "")) : null;
    }
    const isLpscAvailable = typeof lpscAmount === "number" && !isNaN(lpscAmount);
    const isUnpaidAvailable = typeof unpaidAmount === "number" && !isNaN(unpaidAmount);
    let totalDue = null;
    if (isUnpaidAvailable && isLpscAvailable) {
      totalDue = Math.round(((unpaidAmount ?? 0) + (lpscAmount ?? 0)) * 100) / 100;
    } else if (isUnpaidAvailable) {
      totalDue = unpaidAmount;
    }
    return {
      success: true,
      liveConnected: true,
      officialPortalUrl,
      pdfBase64: pdfBuffer.toString("base64"),
      data: {
        consumerId: cleanId,
        reportType: isNoDuesCert ? "NO DUES CERTIFICATE" : "OUTSTANDING REPORT",
        consumerName: nameMatch ? nameMatch[1].trim() : "",
        address: addrMatch ? addrMatch[1].trim() : "",
        office: officeMatch ? officeMatch[1].trim() : "",
        connDate: connDateMatch ? connDateMatch[1].trim() : "",
        connectionStatus: statusMatch ? statusMatch[1].trim() : "LIVE",
        outstandingAmount: unpaidAmount,
        lpscAmount,
        lpscSurcharge: lpscAmount,
        lpscAvailable: isLpscAvailable,
        totalDueAmount: totalDue,
        reportingDate: reportingDateMatch ? reportingDateMatch[1].trim() : "",
        lastReadingDate: readingDateMatch ? readingDateMatch[1].trim().replace(/\.$/, "") : "",
        lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
  } catch (err) {
    return {
      success: false,
      liveConnected: false,
      officialPortalUrl,
      requiresBrowserOpen: true,
      error: `WBSEDCL portal notice: ${err?.message || "Official report access unavailable. Open direct portal link."}`
    };
  }
}

// src/services/officeRegistryBackend.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";
var DEDICATED_REGISTRY_SPREADSHEET_ID = process.env.OFFICE_REGISTRY_SPREADSHEET_ID || "1-mceU8a_JjYTrU3QUFGDKiXGRVA1AvzklKgoc-ezkAw";
var PROTECTED_PRODUCTION_SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "1-3LtAbXZU6klisReK6ffIxDUwbM4wXvhxSbKVpE7raY";
var REGISTRY_REQUIRED_HEADERS = [
  "Office ID",
  "Office Name",
  "Office Admin Name",
  "Admin Mobile",
  "Admin User ID",
  "Password Hash",
  "Password Salt",
  "Database Name",
  "Google Spreadsheet Link",
  "Verified Spreadsheet ID",
  "Status",
  "Registered At",
  "Registered By"
];
function normalizePrivateKey(rawKey) {
  if (!rawKey || typeof rawKey !== "string") return "";
  let key = rawKey.trim();
  if (key.startsWith('"') && key.endsWith('"') || key.startsWith("'") && key.endsWith("'")) {
    key = key.slice(1, -1).trim();
  }
  if (key.includes("\\n")) {
    key = key.replace(/\\n/g, "\n");
  }
  if (key.includes("\\r")) {
    key = key.replace(/\\r/g, "\r");
  }
  key = key.replace(/\r\n/g, "\n");
  return key.trim();
}
function isValidPrivateKeyFormat(key) {
  if (!key || typeof key !== "string") return false;
  const hasBegin = key.includes("-----BEGIN PRIVATE KEY-----") || key.includes("-----BEGIN RSA PRIVATE KEY-----");
  const hasEnd = key.includes("-----END PRIVATE KEY-----") || key.includes("-----END RSA PRIVATE KEY-----");
  if (!hasBegin || !hasEnd) return false;
  try {
    const signer = crypto.createSign("RSA-SHA256");
    signer.update("credential-format-probe");
    signer.sign(key);
    return true;
  } catch {
    return false;
  }
}
function isHexKeyId(str) {
  if (!str || typeof str !== "string") return false;
  return /^[0-9a-fA-F]{40}$/.test(str.trim());
}
function hasValidPemDelimiters(key) {
  if (!key || typeof key !== "string") return false;
  const hasBegin = key.includes("-----BEGIN PRIVATE KEY-----") || key.includes("-----BEGIN RSA PRIVATE KEY-----");
  const hasEnd = key.includes("-----END PRIVATE KEY-----") || key.includes("-----END RSA PRIVATE KEY-----");
  return hasBegin && hasEnd;
}
function inspectServiceAccountConfiguration() {
  const rawKeyJson = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GCP_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();
  const sepEmail = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GCP_SERVICE_ACCOUNT_EMAIL || "").trim();
  const sepKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GCP_PRIVATE_KEY || "").trim();
  const candidateFiles = [
    path.join(process.cwd(), ".service-account.json"),
    path.join(process.cwd(), ".service-account-backup.json"),
    path.join(process.cwd(), "service-account.json"),
    rawKeyJson
  ].filter((f) => f && typeof f === "string" && fs.existsSync(f));
  for (const credFilePath of candidateFiles) {
    try {
      const fileContent = fs.readFileSync(credFilePath, "utf8");
      const parsed = JSON.parse(fileContent);
      const email = parsed.client_email || parsed.clientEmail || "";
      const key = parsed.private_key || parsed.privateKey || "";
      const cleanKey = normalizePrivateKey(key);
      const keyValid = isValidPrivateKeyFormat(cleanKey);
      if (email && keyValid) {
        return {
          configured: true,
          keyValid: true,
          source: "file_path",
          keyFormatStatus: "valid_rsa_pem",
          serviceAccountEmail: email,
          spreadsheetId: DEDICATED_REGISTRY_SPREADSHEET_ID,
          message: `Google Service Account credentials configured and key format validated from file (${path.basename(credFilePath)}).`
        };
      }
    } catch {
    }
  }
  if (rawKeyJson) {
    let stripped = rawKeyJson;
    if (stripped.startsWith('"') && stripped.endsWith('"') || stripped.startsWith("'") && stripped.endsWith("'")) {
      stripped = stripped.slice(1, -1).trim();
    }
    if (isHexKeyId(stripped)) {
      return {
        configured: false,
        keyValid: false,
        source: "none",
        keyFormatStatus: "is_hex_key_id",
        serviceAccountEmail: sepEmail || "power-office-registry@gen-lang-client-0685870335.iam.gserviceaccount.com",
        spreadsheetId: DEDICATED_REGISTRY_SPREADSHEET_ID,
        message: 'Google Service Account key format error: The configured key is a 40-character Key ID (private_key_id) rather than the actual RSA private key or complete service-account JSON credential. In Google Cloud Console, click "Add Key" -> "Create new key" -> "JSON", download the JSON file, and copy its complete content into GOOGLE_SERVICE_ACCOUNT_KEY.'
      };
    }
    let jsonStr = stripped;
    if (!jsonStr.startsWith("{")) {
      try {
        const b64 = Buffer.from(jsonStr, "base64").toString("utf8").trim();
        if (b64.startsWith("{")) {
          jsonStr = b64;
        }
      } catch {
      }
    }
    if (jsonStr.startsWith("{")) {
      try {
        const parsed = JSON.parse(jsonStr);
        const email = String(parsed.client_email || parsed.clientEmail || "").trim();
        const key = String(parsed.private_key || parsed.privateKey || "");
        const cleanKey = normalizePrivateKey(key);
        const keyValid = isValidPrivateKeyFormat(cleanKey);
        const keyFormatStatus = keyValid ? "valid_rsa_pem" : isHexKeyId(cleanKey) ? "is_hex_key_id" : "invalid_syntax";
        return {
          configured: Boolean(email && key),
          keyValid,
          source: stripped.startsWith("{") ? "json_full" : "base64_json",
          keyFormatStatus,
          serviceAccountEmail: email || "client_email missing from JSON",
          spreadsheetId: DEDICATED_REGISTRY_SPREADSHEET_ID,
          message: keyValid ? "Google Service Account credentials configured and key format validated." : isHexKeyId(cleanKey) ? "The private_key inside the service-account JSON is a 40-character Key ID rather than the full RSA PEM key." : "The private_key inside the service-account JSON is malformed or invalid."
        };
      } catch {
        return {
          configured: false,
          keyValid: false,
          source: "json_full",
          keyFormatStatus: "invalid_syntax",
          serviceAccountEmail: sepEmail || "Pending valid JSON",
          spreadsheetId: DEDICATED_REGISTRY_SPREADSHEET_ID,
          message: "GOOGLE_SERVICE_ACCOUNT_KEY contains malformed JSON syntax. Please verify the JSON string is complete and untruncated."
        };
      }
    }
    if (stripped.includes("BEGIN PRIVATE KEY") || stripped.includes("BEGIN RSA PRIVATE KEY")) {
      const cleanKey = normalizePrivateKey(stripped);
      const keyValid = isValidPrivateKeyFormat(cleanKey);
      return {
        configured: Boolean(sepEmail),
        keyValid,
        source: "pem_direct",
        keyFormatStatus: keyValid ? "valid_rsa_pem" : "invalid_syntax",
        serviceAccountEmail: sepEmail || "Service account email missing (set GOOGLE_SERVICE_ACCOUNT_EMAIL)",
        spreadsheetId: DEDICATED_REGISTRY_SPREADSHEET_ID,
        message: keyValid && sepEmail ? "Google Service Account credentials configured with direct PEM key." : "PEM key detected in GOOGLE_SERVICE_ACCOUNT_KEY, but GOOGLE_SERVICE_ACCOUNT_EMAIL is missing or key is malformed."
      };
    }
  }
  if (sepEmail || sepKey) {
    const cleanKey = normalizePrivateKey(sepKey);
    const keyValid = isValidPrivateKeyFormat(cleanKey);
    const keyFormatStatus = isHexKeyId(cleanKey) ? "is_hex_key_id" : keyValid ? "valid_rsa_pem" : cleanKey ? "invalid_syntax" : "missing";
    return {
      configured: Boolean(sepEmail && sepKey),
      keyValid,
      source: "separate_vars",
      keyFormatStatus,
      serviceAccountEmail: sepEmail || "GOOGLE_SERVICE_ACCOUNT_EMAIL is missing",
      spreadsheetId: DEDICATED_REGISTRY_SPREADSHEET_ID,
      message: keyValid && sepEmail ? "Google Service Account credentials configured and key format validated via separate environment variables." : isHexKeyId(cleanKey) ? 'Google Service Account key format error: The configured key is a 40-character Key ID (private_key_id) rather than the actual RSA private key ("-----BEGIN PRIVATE KEY-----") or complete service-account JSON credential. Please paste the entire downloaded service-account JSON file into GOOGLE_SERVICE_ACCOUNT_KEY.' : "Service Account credentials incomplete: Check GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY."
    };
  }
  return {
    configured: false,
    keyValid: false,
    source: "none",
    keyFormatStatus: "missing",
    serviceAccountEmail: "Not configured in environment variables",
    spreadsheetId: DEDICATED_REGISTRY_SPREADSHEET_ID,
    message: "Service Account credentials pending in environment variables (GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)."
  };
}
function getServiceAccountCredentials() {
  const rawKeyJson = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GCP_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();
  const candidateFiles = [
    path.join(process.cwd(), ".service-account.json"),
    path.join(process.cwd(), ".service-account-backup.json"),
    path.join(process.cwd(), "service-account.json"),
    rawKeyJson
  ].filter((f) => f && typeof f === "string" && fs.existsSync(f));
  for (const credFilePath of candidateFiles) {
    try {
      const fileContent = fs.readFileSync(credFilePath, "utf8");
      const parsed = JSON.parse(fileContent);
      const email2 = parsed.client_email || parsed.clientEmail;
      const rawKey = parsed.private_key || parsed.privateKey;
      if (email2 && rawKey) {
        const cleanKey = normalizePrivateKey(rawKey);
        if (!isHexKeyId(cleanKey) && hasValidPemDelimiters(cleanKey)) {
          return {
            client_email: String(email2).trim(),
            private_key: cleanKey,
            project_id: parsed.project_id || parsed.projectId || "gen-lang-client-0685870335"
          };
        }
      }
    } catch {
    }
  }
  if (rawKeyJson) {
    let decoded = rawKeyJson;
    if (decoded.startsWith('"') && decoded.endsWith('"') || decoded.startsWith("'") && decoded.endsWith("'")) {
      decoded = decoded.slice(1, -1).trim();
    }
    if (isHexKeyId(decoded)) {
      return null;
    }
    let jsonStr = decoded;
    if (!jsonStr.startsWith("{")) {
      try {
        const b64 = Buffer.from(jsonStr, "base64").toString("utf8").trim();
        if (b64.startsWith("{")) {
          jsonStr = b64;
        }
      } catch {
      }
    }
    if (jsonStr.startsWith("{")) {
      try {
        const parsed = JSON.parse(jsonStr);
        const email2 = parsed.client_email || parsed.clientEmail;
        const rawKey = parsed.private_key || parsed.privateKey;
        if (email2 && rawKey) {
          const cleanKey = normalizePrivateKey(rawKey);
          if (!isHexKeyId(cleanKey) && hasValidPemDelimiters(cleanKey)) {
            return {
              client_email: String(email2).trim(),
              private_key: cleanKey,
              project_id: parsed.project_id || parsed.projectId || "gen-lang-client-0685870335"
            };
          }
        }
      } catch {
      }
    }
    if (decoded.includes("BEGIN PRIVATE KEY") || decoded.includes("BEGIN RSA PRIVATE KEY")) {
      const email2 = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GCP_SERVICE_ACCOUNT_EMAIL;
      const cleanKey = normalizePrivateKey(decoded);
      if (email2 && !isHexKeyId(cleanKey) && hasValidPemDelimiters(cleanKey)) {
        return {
          client_email: String(email2).trim(),
          private_key: cleanKey,
          project_id: process.env.GCP_PROJECT_ID || "gen-lang-client-0685870335"
        };
      }
    }
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GCP_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GCP_PRIVATE_KEY;
  if (email && privateKey) {
    const cleanKey = normalizePrivateKey(privateKey);
    if (!isHexKeyId(cleanKey) && hasValidPemDelimiters(cleanKey)) {
      return {
        client_email: String(email).trim(),
        private_key: cleanKey,
        project_id: process.env.GCP_PROJECT_ID || "gen-lang-client-0685870335"
      };
    }
  }
  return null;
}
async function getGoogleSheetsAccessToken(creds) {
  const normalizedKey = normalizePrivateKey(creds.private_key);
  if (isHexKeyId(normalizedKey)) {
    throw new Error(
      'Google Service Account key format error: The configured key is a 40-character Key ID (private_key_id) rather than the actual RSA private key ("-----BEGIN PRIVATE KEY-----") or complete service-account JSON credential. Please paste the entire downloaded service-account JSON file into GOOGLE_SERVICE_ACCOUNT_KEY.'
    );
  }
  if (!isValidPrivateKeyFormat(normalizedKey)) {
    throw new Error(
      'Google Service Account private key is improperly formatted. Please verify that GOOGLE_SERVICE_ACCOUNT_KEY contains the complete service-account JSON with "-----BEGIN PRIVATE KEY-----".'
    );
  }
  const now = Math.floor(Date.now() / 1e3);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claimSet = Buffer.from(JSON.stringify({
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  })).toString("base64url");
  let signature;
  try {
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(`${header}.${claimSet}`);
    signature = signer.sign(normalizedKey, "base64url");
  } catch (signErr) {
    throw new Error(
      `Google Service Account signing failed: ${signErr?.message || "OpenSSL decoder error"}. Ensure the private key is a valid RSA private key.`
    );
  }
  const jwt = `${header}.${claimSet}.${signature}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    }).toString()
  });
  const tokenData = await tokenRes.json().catch(() => null);
  if (!tokenRes.ok || !tokenData?.access_token) {
    const errMsg = tokenData?.error_description || tokenData?.error || `HTTP ${tokenRes.status}`;
    throw new Error(`Google Service Account authentication failed: ${errMsg}`);
  }
  return tokenData.access_token;
}
function hashPasswordSecurely(plainPassword) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(plainPassword, salt, 64).toString("hex");
  return { salt, hash };
}
function verifyOfficePassword(plainPassword, salt, storedHash) {
  try {
    const cleanPass = String(plainPassword || "").trim();
    const cleanHash = String(storedHash || "").trim();
    const cleanSalt = String(salt || "").trim();
    if (!cleanPass || !cleanHash) return false;
    if (cleanSalt) {
      try {
        const computed = crypto.scryptSync(cleanPass, cleanSalt, 64).toString("hex");
        if (crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(cleanHash, "hex"))) {
          return true;
        }
      } catch {
      }
    }
    const passSha = crypto.createHash("sha256").update(cleanPass).digest("hex").toLowerCase();
    if (cleanHash.toLowerCase() === passSha) {
      return true;
    }
    if (cleanHash === cleanPass || cleanHash.toLowerCase() === cleanPass.toLowerCase()) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
function extractAndValidateSpreadsheetId(url) {
  if (!url || typeof url !== "string") {
    return { valid: false, error: "Google Spreadsheet Link is required." };
  }
  const trimmed = url.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_\-]+)/i);
  if (!match || !match[1]) {
    return {
      valid: false,
      error: "Invalid Google Spreadsheet URL. Must be formatted like https://docs.google.com/spreadsheets/d/.../edit"
    };
  }
  const id = match[1].trim();
  if (id === PROTECTED_PRODUCTION_SPREADSHEET_ID) {
    return {
      valid: false,
      error: "Security Error: You cannot assign the primary production database spreadsheet as a separate office database."
    };
  }
  if (id === DEDICATED_REGISTRY_SPREADSHEET_ID) {
    return {
      valid: false,
      error: "Security Error: You cannot assign the Master Office Registry spreadsheet as an operational database."
    };
  }
  if (id.length < 15) {
    return { valid: false, error: "The extracted Google Spreadsheet ID is too short to be valid." };
  }
  return { valid: true, id };
}
async function verifySpreadsheetAccessible(spreadsheetId, accessToken) {
  try {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties.title`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json"
      }
    });
    if (res.status === 404) {
      return { accessible: false, error: "Spreadsheet not found. Please verify the link exists and is spelled correctly." };
    }
    if (res.status === 403) {
      return { accessible: false, error: "Permission denied: Please ensure the service account email is granted Editor access to this spreadsheet." };
    }
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      return { accessible: false, error: errJson?.error?.message || `Google Sheets API returned status ${res.status}` };
    }
    const data = await res.json();
    return { accessible: true, title: data.properties?.title || "Google Spreadsheet" };
  } catch (err) {
    return { accessible: false, error: err.message || "Network error verifying spreadsheet" };
  }
}
async function fetchAllRegisteredOffices(accessToken) {
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${DEDICATED_REGISTRY_SPREADSHEET_ID}?fields=sheets.properties`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json"
    }
  });
  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => null);
    throw new Error(err?.error?.message || `Failed to read Registry spreadsheet metadata (Status ${metaRes.status})`);
  }
  const metaData = await metaRes.json();
  const sheets = metaData.sheets || [];
  if (sheets.length === 0) {
    throw new Error("The dedicated Registry spreadsheet contains no sheets/tabs.");
  }
  const officesTab = sheets.find((s) => s.properties?.title?.toLowerCase() === "offices") || sheets[0];
  const sheetTitle = officesTab.properties.title;
  const valRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${DEDICATED_REGISTRY_SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}!A1:M`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json"
    }
  });
  if (!valRes.ok) {
    const err = await valRes.json().catch(() => null);
    throw new Error(err?.error?.message || `Failed to read Registry spreadsheet rows (Status ${valRes.status})`);
  }
  const valData = await valRes.json();
  const rows = valData.values || [];
  if (rows.length === 0) {
    return { success: true, records: [], sheetTitle, hasHeaders: false };
  }
  const headerRow = rows[0].map((h) => String(h || "").trim());
  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row[0]) continue;
    records.push({
      id: String(row[0] || "").trim(),
      officeName: String(row[1] || "").trim(),
      adminName: String(row[2] || "").trim(),
      adminMobile: String(row[3] || "").trim(),
      adminUserId: String(row[4] || "").trim(),
      databaseName: String(row[7] || "").trim(),
      spreadsheetLink: String(row[8] || "").trim(),
      verifiedSpreadsheetId: String(row[9] || "").trim(),
      status: "active",
      registeredAt: String(row[11] || "").trim(),
      registeredBy: String(row[12] || "").trim()
    });
  }
  return { success: true, records, sheetTitle, hasHeaders: headerRow.length > 0 };
}
async function fetchAllRegisteredOfficesWithAuth(accessToken) {
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${DEDICATED_REGISTRY_SPREADSHEET_ID}?fields=sheets.properties`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json"
    }
  });
  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => null);
    throw new Error(err?.error?.message || `Failed to read Registry spreadsheet metadata (Status ${metaRes.status})`);
  }
  const metaData = await metaRes.json();
  const sheets = metaData.sheets || [];
  if (sheets.length === 0) {
    throw new Error("The dedicated Registry spreadsheet contains no sheets/tabs.");
  }
  const officesTab = sheets.find((s) => s.properties?.title?.toLowerCase() === "offices") || sheets[0];
  const sheetTitle = officesTab.properties.title;
  const valRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${DEDICATED_REGISTRY_SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}!A1:M`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json"
    }
  });
  if (!valRes.ok) {
    const err = await valRes.json().catch(() => null);
    throw new Error(err?.error?.message || `Failed to read Registry spreadsheet rows (Status ${valRes.status})`);
  }
  const valData = await valRes.json();
  const rows = valData.values || [];
  if (rows.length === 0) {
    return { success: true, records: [], sheetTitle, hasHeaders: false };
  }
  const headerRow = rows[0].map((h) => String(h || "").trim());
  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row[0]) continue;
    records.push({
      id: String(row[0] || "").trim(),
      officeName: String(row[1] || "").trim(),
      adminName: String(row[2] || "").trim(),
      adminMobile: String(row[3] || "").trim(),
      adminUserId: String(row[4] || "").trim(),
      passwordHash: String(row[5] || "").trim(),
      passwordSalt: String(row[6] || "").trim(),
      databaseName: String(row[7] || "").trim(),
      spreadsheetLink: String(row[8] || "").trim(),
      verifiedSpreadsheetId: String(row[9] || "").trim(),
      status: "active",
      registeredAt: String(row[11] || "").trim(),
      registeredBy: String(row[12] || "").trim()
    });
  }
  return { success: true, records, sheetTitle, hasHeaders: headerRow.length > 0 };
}
async function appendOfficeToRegistry(record, sheetTitle, hasHeaders, accessToken) {
  if (!hasHeaders) {
    const headerWriteRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${DEDICATED_REGISTRY_SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}!A1:M1?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          values: [REGISTRY_REQUIRED_HEADERS]
        })
      }
    );
    if (!headerWriteRes.ok) {
      const err = await headerWriteRes.json().catch(() => null);
      throw new Error(err?.error?.message || "Failed to initialize headers on Registry Spreadsheet.");
    }
  }
  const rowValues = [
    record.id,
    record.officeName,
    record.adminName,
    record.adminMobile,
    record.adminUserId,
    record.passwordHash,
    record.passwordSalt,
    record.databaseName,
    record.spreadsheetLink,
    record.verifiedSpreadsheetId,
    record.status,
    record.registeredAt,
    record.registeredBy
  ];
  const appendRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${DEDICATED_REGISTRY_SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}!A1:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        values: [rowValues]
      })
    }
  );
  if (!appendRes.ok) {
    const err = await appendRes.json().catch(() => null);
    throw new Error(err?.error?.message || `Failed to append office record to Registry Spreadsheet (Status ${appendRes.status})`);
  }
}

// server.ts
try {
  const envLocalPath = path2.join(process.cwd(), ".env.local");
  if (fs2.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
  }
} catch {
}
try {
  dns.setDefaultResultOrder("ipv4first");
  if (typeof net.setDefaultAutoSelectFamily === "function") {
    net.setDefaultAutoSelectFamily(false);
  }
} catch {
}
var GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbzVV5sqqypop3sr19hstcti76QXw4aGIKHqAut31pcYMcOuffGwsAmtfbbOnx3KVB_7/exec";
var GOOGLE_SHEET_ID = "1-3LtAbXZU6klisReK6ffIxDUwbM4wXvhxSbKVpE7raY";
var GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1-3LtAbXZU6klisReK6ffIxDUwbM4wXvhxSbKVpE7raY/edit?usp=drivesdk";
var BROWSER_USER_AGENT2 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var gasCache = /* @__PURE__ */ new Map();
var inFlightRequests = /* @__PURE__ */ new Map();
var CACHE_TTL_MS = 6e4;
var READ_ACTIONS = /* @__PURE__ */ new Set(["entries", "workorders", "stats", "users", "health", "chat", "logs", "disconnectiontasks", "getDisconnectionTasks"]);
var submissionIdMap = /* @__PURE__ */ new Map();
var inFlightSubmissions = /* @__PURE__ */ new Map();
var SUBMISSION_IDEMPOTENCY_TTL_MS = 15 * 60 * 1e3;
setInterval(() => {
  const now = Date.now();
  for (const [subId, record] of submissionIdMap.entries()) {
    if (now - record.timestamp > SUBMISSION_IDEMPOTENCY_TTL_MS) {
      submissionIdMap.delete(subId);
    }
  }
}, 6e4).unref();
function normalizeUniversal(val) {
  if (val === null || val === void 0) return "";
  const str = String(val).trim();
  const bengaliDigits = ["\u09E6", "\u09E7", "\u09E8", "\u09E9", "\u09EA", "\u09EB", "\u09EC", "\u09ED", "\u09EE", "\u09EF"];
  let res = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const bIdx = bengaliDigits.indexOf(ch);
    if (bIdx >= 0) {
      res += bIdx.toString();
    } else {
      res += ch;
    }
  }
  return res;
}
function toSheetTabCategory(cat) {
  const c = String(cat || "").trim().toUpperCase().replace(/[\s_\-]+/g, " ");
  if (c === "NSC" || c === "NEW CONNECTION" || c === "NEWCONNECTION") return "NSC";
  if (c === "DISCONNECTION" || c === "DISCONNECT") return "Disconnection";
  if (c === "POLE CASE" || c === "BROKEN" || c === "POLECASE") return "Broken";
  if (c === "METER REPLESMENT" || c === "METER REPLACEMENT" || c === "METERREPLACEMENT") return "Meter Replacement";
  if (c === "DTR REPLESMENT" || c === "DTR REPLACEMENT" || c === "DTRREPLACEMENT") return "DTR Replacement";
  if (c === "USERS" || c === "USER" || c === "USERS AUTH") return "Users";
  if (c === "WORK ORDERS" || c === "WORKORDERS KHATA" || c === "WORKORDERS") return "WorkOrders_Khata";
  return String(cat || "NSC").trim();
}
function toFrontendCategory(cat) {
  const c = String(cat || "").trim().toUpperCase().replace(/[\s_\-]+/g, " ");
  if (c === "NSC" || c === "NEW CONNECTION" || c === "NEWCONNECTION") return "NSC";
  if (c === "DISCONNECTION" || c === "DISCONNECT") return "DISCONNECTION";
  if (c === "POLE CASE" || c === "BROKEN" || c === "POLECASE") return "POLE CASE";
  if (c === "METER REPLESMENT" || c === "METER REPLACEMENT" || c === "METERREPLACEMENT") return "METER REPLESMENT";
  if (c === "DTR REPLESMENT" || c === "DTR REPLACEMENT" || c === "DTRREPLACEMENT") return "DTR REPLESMENT";
  return String(cat || "NSC").trim();
}
function normalizeServerEntry(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const raw = { ...entry };
  const rawFeeder = String(raw.feederName || raw["Feeder Name"] || "").trim();
  if (rawFeeder.startsWith("NSC_META::")) {
    try {
      const meta = JSON.parse(rawFeeder.slice("NSC_META::".length));
      if (meta && typeof meta === "object") {
        for (const [mk, mv] of Object.entries(meta)) {
          if (mv !== void 0 && mv !== null && mv !== "" && (raw[mk] === void 0 || raw[mk] === "")) {
            raw[mk] = mv;
          }
        }
      }
    } catch {
    }
    raw.feederName = "";
    delete raw["Feeder Name"];
  }
  raw.submissionId = raw.submissionId || raw["Submission ID"] || raw["SubmissionID"] || raw["submission_id"] || "";
  raw.id = raw.id || raw["Record ID"] || raw["RecordID"] || raw["record_id"] || raw["ID"] || raw.submissionId || "";
  const looksLikeDiscRow = raw["Discon Status"] !== void 0 || raw.disconStatus !== void 0 || raw.taskStatus !== void 0 || String(raw.id || "").toUpperCase().startsWith("TASK-DISC-") || String(raw.id || "").toUpperCase().startsWith("PWR-DIS-");
  raw.category = toFrontendCategory(
    raw.category || raw["Category"] || (looksLikeDiscRow ? "DISCONNECTION" : "NSC")
  );
  if (raw.category === "DISCONNECTION") {
    raw.status = raw["Discon Status"] || raw.disconStatus || raw.taskStatus || raw.status || raw["Status"] || "PENDING";
    raw.id = raw.id || String(raw["Consumer Id"] || raw["Consumer ID"] || raw.consumerId || raw.taskId || "").trim();
    raw.submissionId = raw.submissionId || raw.id;
  } else {
    raw.status = raw.status || raw["Status"] || "Completed";
  }
  raw.date = raw.date || raw["Date"] || raw["Discon Date"] || raw["Upload Date"] || raw.createdAt || "";
  raw.createdAt = raw.createdAt || raw["Created At"] || raw["Upload Date"] || raw.date || "";
  raw.updatedAt = raw.updatedAt || raw["Updated At"] || raw["Last Updated"] || "";
  raw.workerId = String(raw.workerId || raw["Worker ID"] || raw["Lineman ID"] || "").trim();
  raw.workerName = raw.workerName || raw["Worker Name"] || raw["Lineman Name"] || raw["NSC Worker Name"] || "";
  raw.role = raw.role || raw["Role"] || "";
  raw.submittedBy = raw.submittedBy || raw["Submitted By"] || raw.workerName || "";
  raw.workerPhone = raw.workerPhone || raw["Worker Phone"] || "";
  raw.agencyName = raw.agencyName || raw["Agency Name"] || "";
  raw.substation = raw.substation || raw["Substation"] || raw["off_code"] || "";
  raw.cccName = raw.cccName || raw["CCC Name"] || (raw.category === "NSC" && raw.substation && raw.substation !== "5233100" ? raw.substation : "") || "";
  raw.feederName = raw.feederName || raw["Feeder Name"] || "";
  raw.workOrderNo = raw.workOrderNo || raw["Work Order No"] || raw["Work Order Number"] || "";
  raw.workOrderDate = raw.workOrderDate || raw["Work Order Date"] || "";
  raw.workOrderNoticeId = raw.workOrderNoticeId || raw["Work Order Notice ID"] || "";
  raw.workOrderNoticeTitle = raw.workOrderNoticeTitle || raw["Work Order Notice Title"] || "";
  raw.workOrderNoticeDate = raw.workOrderNoticeDate || raw["Work Order Notice Date"] || "";
  raw.workOrderPhoto = raw.workOrderPhoto || raw["Work Order Photo"] || "";
  raw.applicationNo = raw.applicationNo || raw["Application No"] || raw["Application Number"] || "";
  raw.consumerId = raw.consumerId || raw["Consumer Id"] || raw["Consumer ID"] || raw["Consumer Number"] || raw["Consumer No"] || "";
  raw.consumerName = raw.consumerName || raw["Name"] || raw["Consumer Name"] || raw["Customer Name"] || "";
  raw.fatherName = raw.fatherName || raw["Father Name"] || raw["Father / Husband Name"] || "";
  raw.mobile = raw.mobile || raw["Mobile Number"] || raw["Mobile No"] || raw["Mobile"] || "";
  raw.address = raw.address || raw["Address"] || "";
  raw.appliedLoad = raw.appliedLoad || raw["Applied Load"] || "";
  raw.phase = raw.phase || raw["Supply Phase"] || raw["Phase"] || (raw.category === "DISCONNECTION" ? raw["BClass/Phase"] : "") || "";
  raw.tariffCategory = raw.tariffCategory || raw["Tariff Category"] || (raw.category === "DISCONNECTION" ? raw["Class"] : "") || "";
  raw.serviceCableLength = raw.serviceCableLength || raw["Service Cable Length"] || "";
  raw.poleNo = raw.poleNo || raw["Pole No"] || "";
  raw.earthResistance = raw.earthResistance || raw["Earth Resistance"] || "";
  raw.meterNo = raw.meterNo || raw["Meter"] || raw["Meter No"] || raw["Meter Number"] || "";
  raw.meterMake = raw.meterMake || raw["Meter Make"] || "";
  raw.initialReading = raw.initialReading || raw["Initial Reading"] || raw["Reading"] || raw.reading || "";
  raw.sealNo = raw.sealNo || raw["Meter Seal No"] || raw["Seal No"] || "";
  raw.meterInstallDate = raw.meterInstallDate || raw["Meter Install Date"] || "";
  raw.inspectionAgencyName = raw.inspectionAgencyName || raw["Inspection Agency Name"] || "";
  raw.oldMeterNo = raw.oldMeterNo || raw["Old Meter No"] || "";
  raw.replacementReason = raw.replacementReason || raw["Replacement Reason"] || "";
  raw.newMeterNo = raw.newMeterNo || raw["New Meter No"] || "";
  raw.newMeterSealNo = raw.newMeterSealNo || raw["New Meter Seal No"] || "";
  raw.oldMeterSealNo = raw.oldMeterSealNo || raw["Old Meter Seal No"] || "";
  raw.meterType = raw.meterType || raw["Meter Type"] || "";
  raw.dtrName = raw.dtrName || raw["DTR Name"] || "";
  raw.existingCapacity = raw.existingCapacity || raw["Existing Capacity"] || "";
  raw.newCapacity = raw.newCapacity || raw["New Capacity"] || "";
  raw.oldDtrSerial = raw.oldDtrSerial || raw["Old DTR Serial"] || "";
  raw.newDtrSerial = raw.newDtrSerial || raw["New DTR Serial"] || "";
  raw.failureReason = raw.failureReason || raw["Failure Reason"] || "";
  raw.oilLevelChecked = raw.oilLevelChecked || raw["Oil Level Checked"] || "";
  raw.dtrMakeBrand = raw.dtrMakeBrand || raw["DTR Make Brand"] || "";
  raw.hgFuseRating = raw.hgFuseRating || raw["HG Fuse Rating"] || "";
  raw.ltMccbAmpere = raw.ltMccbAmpere || raw["LT MCCB Ampere"] || "";
  raw.lightningArrester = raw.lightningArrester || raw["Lightning Arrester"] || "";
  raw.issueType = raw.issueType || raw["Issue Type"] || "";
  raw.priority = raw.priority || raw["Priority"] || "";
  raw.actionTaken = raw.actionTaken || raw["Action Taken"] || "";
  raw.materialUsed = raw.materialUsed || raw["Material Used"] || "";
  raw.poleType = raw.poleType || raw["Pole Type"] || "";
  raw.lineVoltage = raw.lineVoltage || raw["Line Voltage"] || "";
  raw.conductorType = raw.conductorType || raw["Conductor Type"] || "";
  raw.ptwShutdownRef = raw.ptwShutdownRef || raw["PTW Shutdown Ref"] || "";
  raw.photoBefore = raw.photoBefore || raw["Photo Before"] || "";
  raw.photoAfter = raw.photoAfter || raw["Photo After"] || "";
  raw.arrearAmount = raw.arrearAmount || raw["D2 Net O/S"] || raw["Arrear Amount"] || "";
  raw.dueDateRange = raw.dueDateRange || raw["O/S Due date Range"] || raw["O/S Duedate Range"] || "";
  raw.govStatus = raw.govStatus || raw["Gov/Non-Gov"] || "";
  raw.mru = raw.mru || raw["MRU"] || "";
  raw.locationGps = raw.locationGps || raw["GPS Location"] || raw["Location GPS"] || "";
  raw.photoUrl = raw.photoUrl || raw["Photo Evidence"] || raw["Photo URL"] || raw.directImageUrl || "";
  raw.notes = raw.notes || raw["Notes"] || raw.remarks || raw["Remarks"] || "";
  return raw;
}
var LARGE_IMAGES_FILE = path2.join(process.cwd(), ".large-images-store.json");
var UPLOADED_PHOTO_LINKS_FILE = path2.join(process.cwd(), ".uploaded-photo-links.json");
var PUBLIC_APP_BASE_URL = (process.env.SHARED_APP_URL || process.env.APP_URL || "https://ais-pre-rh4ipudzd63obfsffyyaxm-140503423112.asia-southeast1.run.app").replace(/\/+$/, "");
var largeImagesMap = /* @__PURE__ */ new Map();
try {
  if (fs2.existsSync(LARGE_IMAGES_FILE)) {
    const rawMap = JSON.parse(fs2.readFileSync(LARGE_IMAGES_FILE, "utf-8"));
    if (rawMap && typeof rawMap === "object") {
      for (const [k, v] of Object.entries(rawMap)) {
        if (typeof v === "string") largeImagesMap.set(k, v);
      }
    }
  }
} catch {
}
var uploadedPhotoLinksMap = /* @__PURE__ */ new Map();
try {
  if (fs2.existsSync(UPLOADED_PHOTO_LINKS_FILE)) {
    const rawLinks = JSON.parse(fs2.readFileSync(UPLOADED_PHOTO_LINKS_FILE, "utf-8"));
    if (rawLinks && typeof rawLinks === "object") {
      for (const [k, v] of Object.entries(rawLinks)) {
        if (typeof v === "string") uploadedPhotoLinksMap.set(k, v);
      }
    }
  }
} catch {
}
function saveLargeImagesToDisk() {
  try {
    const obj = {};
    for (const [k, v] of largeImagesMap.entries()) {
      obj[k] = v;
    }
    fs2.writeFileSync(LARGE_IMAGES_FILE, JSON.stringify(obj), "utf-8");
  } catch {
  }
}
function saveUploadedPhotoLinksToDisk() {
  try {
    const obj = {};
    for (const [k, v] of uploadedPhotoLinksMap.entries()) {
      obj[k] = v;
    }
    fs2.writeFileSync(UPLOADED_PHOTO_LINKS_FILE, JSON.stringify(obj), "utf-8");
  } catch {
  }
}
async function convertDataUrlToClickablePhotoLink(val, recordKeyHint = "") {
  if (!val || typeof val !== "string") return "";
  let trimmed = val.trim();
  if (!trimmed) return "";
  if (trimmed.includes("/api/stored-images/")) {
    const rawKey = decodeURIComponent(trimmed.split("/api/stored-images/")[1]?.split("?")[0] || "").trim();
    const hashSuffix = rawKey.includes("_") ? rawKey.split("_").pop() || "" : rawKey;
    if (hashSuffix) {
      const existingLink = uploadedPhotoLinksMap.get(hashSuffix);
      if (existingLink && existingLink.startsWith("https://") && !existingLink.includes("/api/stored-images/")) {
        return existingLink;
      }
    }
    const storedData = rawKey ? largeImagesMap.get(rawKey) : void 0;
    if (storedData && storedData.startsWith("data:")) {
      trimmed = storedData;
    } else {
      return `${PUBLIC_APP_BASE_URL}/api/stored-images/${encodeURIComponent(rawKey)}`;
    }
  } else if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (!trimmed.startsWith("data:")) {
    return trimmed;
  }
  const imgHash = crypto2.createHash("sha1").update(trimmed).digest("hex").slice(0, 16);
  const safeHint = String(recordKeyHint || "photo").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  const imgKey = `${safeHint}_${imgHash}`;
  largeImagesMap.set(imgKey, trimmed);
  saveLargeImagesToDisk();
  const cachedPublicUrl = uploadedPhotoLinksMap.get(imgHash);
  if (cachedPublicUrl && cachedPublicUrl.startsWith("https://") && !cachedPublicUrl.includes("/api/stored-images/")) {
    return cachedPublicUrl;
  }
  const base64Clean = trimmed.includes(";base64,") ? trimmed.split(";base64,")[1] : trimmed.replace(/^data:[^,]+,/, "");
  if (base64Clean && base64Clean.length > 20) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        try {
          controller.abort();
        } catch {
        }
      }, 15e3);
      const form = new FormData();
      form.append("key", "6d207e02198a847aa98d0a2a901485a5");
      form.append("action", "upload");
      form.append("source", base64Clean);
      form.append("format", "json");
      const res = await fetch("https://freeimage.host/api/1/upload", {
        method: "POST",
        body: form,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json().catch(() => null);
        const directUrl = String(json?.image?.url || json?.image?.display_url || "").trim();
        if (directUrl && directUrl.startsWith("https://")) {
          uploadedPhotoLinksMap.set(imgHash, directUrl);
          saveUploadedPhotoLinksToDisk();
          return directUrl;
        }
      }
    } catch (err) {
      console.warn("[Photo Link Upload] Primary host notice:", err?.message || err);
    }
    try {
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => {
        try {
          controller2.abort();
        } catch {
        }
      }, 15e3);
      const mimeMatch = trimmed.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const ext = mimeType.includes("png") ? "png" : "jpg";
      const buffer = Buffer.from(base64Clean, "base64");
      const blob = new Blob([buffer], { type: mimeType });
      const form2 = new FormData();
      form2.append("reqtype", "fileupload");
      form2.append("fileToUpload", blob, `photo_${imgHash}.${ext}`);
      const res2 = await fetch("https://catbox.moe/user/api.php", {
        method: "POST",
        body: form2,
        signal: controller2.signal
      });
      clearTimeout(timeoutId2);
      if (res2.ok) {
        const textUrl = (await res2.text()).trim();
        if (textUrl && textUrl.startsWith("https://")) {
          uploadedPhotoLinksMap.set(imgHash, textUrl);
          saveUploadedPhotoLinksToDisk();
          return textUrl;
        }
      }
    } catch (err2) {
      console.warn("[Photo Link Upload] Secondary host notice:", err2?.message || err2);
    }
  }
  return `${PUBLIC_APP_BASE_URL}/api/stored-images/${encodeURIComponent(imgKey)}`;
}
async function sanitizeObjectForSheetCells(obj, recordKeyHint = "") {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  if (obj.category === "WorkOrders_Khata") return obj;
  const clone = { ...obj };
  const recId = String(clone.id || clone.submissionId || clone.consumerId || clone["Consumer Id"] || recordKeyHint || Date.now()).trim();
  for (const [k, v] of Object.entries(clone)) {
    if (typeof v === "string") {
      const trimmedV = v.trim();
      if (trimmedV.startsWith("data:image/") || trimmedV.startsWith("data:") && trimmedV.length > 200 || trimmedV.includes("/api/stored-images/")) {
        clone[k] = await convertDataUrlToClickablePhotoLink(trimmedV, `${recId}_${k}`);
      } else if (v.length > 45e3) {
        clone[k] = v.slice(0, 45e3);
      }
    } else if (v && typeof v === "object" && !Array.isArray(v) && k === "data") {
      clone[k] = await sanitizeObjectForSheetCells(v, recId);
    }
  }
  delete clone.photoDataUrl;
  const mainPhotoLink = String(clone.photoUrl || clone.Image || clone.image || clone["Photo Evidence"] || clone.directImageUrl || "").trim();
  if (mainPhotoLink && (mainPhotoLink.startsWith("http://") || mainPhotoLink.startsWith("https://"))) {
    clone.photoUrl = mainPhotoLink;
    clone.Image = mainPhotoLink;
    clone.image = mainPhotoLink;
    clone["Photo Evidence"] = mainPhotoLink;
    clone.directImageUrl = mainPhotoLink;
  }
  const beforePhotoLink = String(clone.photoBefore || clone.photoBeforeUrl || clone["Photo Before"] || "").trim();
  if (beforePhotoLink && (beforePhotoLink.startsWith("http://") || beforePhotoLink.startsWith("https://"))) {
    clone.photoBefore = beforePhotoLink;
    clone.photoBeforeUrl = beforePhotoLink;
    clone["Photo Before"] = beforePhotoLink;
  }
  const afterPhotoLink = String(clone.photoAfter || clone.photoAfterUrl || clone["Photo After"] || "").trim();
  if (afterPhotoLink && (afterPhotoLink.startsWith("http://") || afterPhotoLink.startsWith("https://"))) {
    clone.photoAfter = afterPhotoLink;
    clone.photoAfterUrl = afterPhotoLink;
    clone["Photo After"] = afterPhotoLink;
  }
  return clone;
}
var gasFetchQueuePromise = Promise.resolve();
async function runSerializedGasFetch(url, options) {
  const next = gasFetchQueuePromise.then(async () => {
    const res = await fetch(url, options);
    await new Promise((r) => setTimeout(r, 50));
    return res;
  });
  gasFetchQueuePromise = next.catch(() => {
  });
  return next;
}
async function callGoogleAppsScript(action, payload = {}, method = "POST", timeoutMs = 45e3) {
  let finalAction = action;
  let finalPayload = { ...payload };
  const catCreateActions = [
    "createEntry",
    "createNSC",
    "createNewConnection",
    "createDisconnection",
    "createPoleCase",
    "createMeterReplacement",
    "createDTRReplacement",
    "submitRecord",
    "saveEntry",
    "saveRecord",
    "createRecord"
  ];
  if (catCreateActions.includes(action)) {
    finalAction = "submitRecord";
    if (!finalPayload.data) finalPayload.data = {};
    if (!finalPayload.data.category) {
      if (action === "createNSC" || action === "createNewConnection") finalPayload.data.category = "NSC";
      else if (action === "createDisconnection") finalPayload.data.category = "DISCONNECTION";
      else if (action === "createPoleCase") finalPayload.data.category = "POLE CASE";
      else if (action === "createMeterReplacement") finalPayload.data.category = "METER REPLESMENT";
      else if (action === "createDTRReplacement") finalPayload.data.category = "DTR REPLESMENT";
    }
    if (finalPayload.data.category && !finalPayload.category) {
      finalPayload.category = finalPayload.data.category;
    }
  }
  if (action === "getRecords" || action === "getMasterData") finalAction = "entries";
  if (action === "healthCheck") finalAction = "health";
  if (finalAction === "submitRecord" || finalAction === "updateEntry") {
    finalPayload = await sanitizeObjectForSheetCells(finalPayload);
  }
  if (finalAction === "createEntry") {
    const entryData = finalPayload.data || finalPayload;
    const subId = String(entryData.submissionId || finalPayload.submissionId || "").trim();
    if (subId) {
      const existing = submissionIdMap.get(subId);
      if (existing) {
        console.log(`[Idempotency] Submission ID "${subId}" already processed. Returning cached success.`);
        return {
          success: true,
          duplicate: true,
          message: "Already recorded (Idempotency check)",
          submissionId: subId,
          ...existing.result
        };
      }
      if (inFlightSubmissions.has(subId)) {
        console.log(`[Idempotency] Submission ID "${subId}" currently in-flight. Awaiting result.`);
        return inFlightSubmissions.get(subId);
      }
    }
  }
  const isMutation = finalAction.startsWith("create") || finalAction.startsWith("update") || finalAction.startsWith("delete") || finalAction.startsWith("clear") || finalAction.startsWith("change") || finalAction.startsWith("toggle") || finalAction === "resetPassword" || finalAction === "uploadWorkOrder" || finalAction.startsWith("uploadDisconnection") || finalAction.startsWith("submitDisconnection") || finalAction.startsWith("assignDisconnection") || finalAction.startsWith("archiveDisconnection") || finalAction.startsWith("restoreDisconnection");
  if (isMutation) {
    gasCache.clear();
  }
  const isReadAction = READ_ACTIONS.has(finalAction);
  const normalizedPayload = {};
  for (const [k, v] of Object.entries(finalPayload || {})) {
    if (k !== "_t" && k !== "timestamp" && v !== void 0 && v !== null && v !== "") {
      normalizedPayload[k] = v;
    }
  }
  const sortedKeys = Object.keys(normalizedPayload).sort();
  const sortedPayload = {};
  for (const k of sortedKeys) {
    sortedPayload[k] = normalizedPayload[k];
  }
  const cacheKey = `${finalAction}_${JSON.stringify(sortedPayload)}`;
  if (isReadAction && !isMutation) {
    const cached = gasCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }
  }
  const executionPromise = (async () => {
    if (!GOOGLE_APPS_SCRIPT_URL) {
      return {
        success: false,
        data: null,
        error: {
          code: "NO_GAS_URL",
          message: "GOOGLE_APPS_SCRIPT_URL is not configured."
        },
        requestId: `REQ-${Date.now()}`
      };
    }
    const maxAttempts = isMutation ? 2 : 2;
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const currentTimeoutMs = isMutation ? Math.min(Math.max(timeoutMs || 25e3, 15e3), 3e4) : Math.min(Math.max(timeoutMs || 18e3, 1e4), 22e3);
      const timeoutId = setTimeout(() => {
        try {
          controller.abort();
        } catch {
        }
      }, currentTimeoutMs);
      try {
        let fetchUrl = GOOGLE_APPS_SCRIPT_URL;
        const reqMethod = READ_ACTIONS.has(finalAction) ? "GET" : "POST";
        const options = {
          signal: controller.signal,
          redirect: "follow"
        };
        if (reqMethod === "GET") {
          const sep = fetchUrl.includes("?") ? "&" : "?";
          const queryParams = { action: finalAction };
          for (const [key, value] of Object.entries(finalPayload)) {
            if (value !== void 0 && value !== null && key !== "action") {
              queryParams[key] = String(value);
            }
          }
          queryParams["_t"] = Date.now().toString();
          fetchUrl = `${fetchUrl}${sep}${new URLSearchParams(queryParams).toString()}`;
          options.method = "GET";
          options.headers = {
            "Accept": "application/json",
            "User-Agent": BROWSER_USER_AGENT2
          };
        } else {
          options.method = "POST";
          options.headers = {
            "Content-Type": "text/plain;charset=utf-8",
            "Accept": "application/json",
            "User-Agent": BROWSER_USER_AGENT2
          };
          const innerData = finalPayload.data && typeof finalPayload.data === "object" ? finalPayload.data : {};
          const mergedPayload = { ...finalPayload, ...innerData };
          if (finalPayload.id) mergedPayload.id = finalPayload.id;
          if (finalPayload.category) mergedPayload.category = finalPayload.category;
          if (finalPayload.submissionId) mergedPayload.submissionId = finalPayload.submissionId;
          if (finalPayload.taskId) mergedPayload.taskId = finalPayload.taskId;
          options.body = JSON.stringify({ action: finalAction, ...mergedPayload, data: mergedPayload });
        }
        const finalRes = await runSerializedGasFetch(fetchUrl, options);
        if (!finalRes) {
          throw new Error(`Failed to retrieve response for action "${finalAction}".`);
        }
        const rawText = await finalRes.text();
        const trimmed = rawText.trim();
        if (trimmed.startsWith("<!DOCTYPE") || trimmed.includes("<html") || trimmed.includes("<body") || trimmed.includes("ppConfig")) {
          console.warn(`[GoogleAppsScript] Received HTML page on attempt ${attempt} for "${finalAction}". Retrying...`);
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 1e3 * attempt));
            continue;
          }
          return {
            success: false,
            data: null,
            error: {
              code: "BACKEND_BUSY",
              message: "Google Sheets is currently busy. Please retry in a few seconds."
            },
            busy: true,
            requestId: `REQ-${Date.now()}`
          };
        }
        let parsed;
        try {
          parsed = JSON.parse(trimmed);
        } catch (parseErr) {
          console.error(`[GoogleAppsScript] JSON parse error on attempt ${attempt}:`, parseErr.message, trimmed.slice(0, 100));
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 800));
            continue;
          }
          return {
            success: false,
            data: null,
            error: {
              code: "INVALID_JSON",
              message: `Google Sheets returned non-JSON content (Status: ${finalRes.status})`
            },
            rawText: trimmed.slice(0, 200),
            requestId: `REQ-${Date.now()}`
          };
        }
        if (isReadAction && parsed && parsed.success !== false) {
          gasCache.set(cacheKey, { data: parsed, timestamp: Date.now() });
        }
        if (finalAction === "createEntry" && parsed && parsed.success) {
          const entryData = finalPayload.data || finalPayload;
          const subId = String(entryData.submissionId || finalPayload.submissionId || "").trim();
          if (subId) {
            submissionIdMap.set(subId, { timestamp: Date.now(), result: parsed });
          }
        }
        return parsed;
      } catch (err) {
        lastError = err;
        const isAbort = err?.name === "AbortError" || String(err?.message || "").toLowerCase().includes("aborted");
        if (isAbort) {
          console.log(`[GoogleAppsScript] Notice: Attempt ${attempt} fetch window passed (${currentTimeoutMs}ms) for "${finalAction}". Serving cached/fallback.`);
        } else {
          console.log(`[GoogleAppsScript] Attempt ${attempt} notice for action "${finalAction}":`, err?.message || err);
        }
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1e3 * attempt));
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }
    if (isReadAction && gasCache.has(cacheKey)) {
      const stale = gasCache.get(cacheKey);
      if (stale?.data) {
        console.log(`[GoogleAppsScript] Action "${finalAction}" completed; serving cached data.`);
        return stale.data;
      }
    }
    console.log(`[GoogleAppsScript] Action "${action}" completed with notice:`, lastError?.message || lastError);
    return {
      success: false,
      data: null,
      error: {
        code: "CONNECTION_FAILED",
        message: lastError?.message || "Failed to connect to Google Sheets backend."
      },
      requestId: `REQ-${Date.now()}`
    };
  })();
  if (finalAction === "createEntry") {
    const entryData = finalPayload.data || finalPayload;
    const subId = String(entryData.submissionId || finalPayload.submissionId || "").trim();
    if (subId) {
      inFlightSubmissions.set(subId, executionPromise);
      try {
        return await executionPromise;
      } finally {
        inFlightSubmissions.delete(subId);
      }
    }
  }
  if (isReadAction && !isMutation) {
    inFlightRequests.set(cacheKey, executionPromise);
    try {
      return await executionPromise;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  }
  return executionPromise;
}
var app = express();
var PORT = parseInt(process.env.PORT || "3000", 10);
app.use(express.json({ limit: "80mb" }));
app.use(express.urlencoded({ limit: "80mb", extended: true }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(self), camera=(self), microphone=()");
  next();
});
app.get("/api/stored-images/:key", (req, res) => {
  const key = String(req.params.key || "").trim();
  const dataUrl = largeImagesMap.get(key);
  if (!dataUrl) {
    return res.status(404).send("Image not found");
  }
  if (dataUrl.startsWith("data:")) {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const mimeType = match[1] || "image/jpeg";
      const buffer = Buffer.from(match[2], "base64");
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Cache-Control", "public, max-age=31536000");
      return res.send(buffer);
    }
  }
  return res.redirect(dataUrl);
});
app.get(["/healthz", "/health", "/ping", "/ready"], (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.status(200).json({
    status: "ok",
    app: "POWER Utility Management",
    uptime: Math.round(process.uptime()),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get(["/Code.gs", "/api/code-gs"], (req, res) => {
  const filePath = path2.resolve(process.cwd(), "Code.gs");
  if (fs2.existsSync(filePath)) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(fs2.readFileSync(filePath, "utf-8"));
  } else {
    res.status(404).send("Code.gs not found");
  }
});
app.get("/api/code-gs/download", (req, res) => {
  const filePath = path2.resolve(process.cwd(), "Code.gs");
  if (fs2.existsSync(filePath)) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="Code.gs"');
    res.send(fs2.readFileSync(filePath, "utf-8"));
  } else {
    res.status(404).send("Code.gs not found");
  }
});
app.get("/api/health", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const gasHealth = await callGoogleAppsScript("health", {}, "GET", 5e3);
    res.status(200).json({
      status: "ok",
      app: "POWER Utility Management",
      backend: "Google Sheets & Google Apps Script",
      spreadsheetId: GOOGLE_SHEET_ID,
      gasStatus: gasHealth?.status || (gasHealth?.success ? "connected" : "error"),
      message: gasHealth?.message || "Google Sheets connected successfully"
    });
  } catch (err) {
    res.status(200).json({
      status: "ok",
      app: "POWER Utility Management",
      backend: "Google Sheets & Google Apps Script",
      warning: err?.message || "Google Sheets health check pending"
    });
  }
});
var USERS_CACHE_FILE = path2.join(process.cwd(), ".users-cache.json");
var cachedUsersState = null;
var isRefreshingUsersInBg = false;
try {
  if (fs2.existsSync(USERS_CACHE_FILE)) {
    const diskUsers = JSON.parse(fs2.readFileSync(USERS_CACHE_FILE, "utf-8"));
    if (Array.isArray(diskUsers) && diskUsers.length > 0) {
      cachedUsersState = { users: diskUsers, timestamp: Date.now() };
    }
  }
} catch {
}
var USERS_STATE_TTL_MS = 12e4;
function clearUsersStateCache() {
  gasCache.clear();
}
function saveUsersStateToDisk(users) {
  const filtered = (Array.isArray(users) ? users : []).filter((u) => {
    if (!u) return false;
    const uid = String(u.id || "").trim().toLowerCase();
    const uidNo = String(u.idNo || "").trim().toLowerCase();
    if (uid && deletedTombstoneSet.has(uid)) return false;
    if (uidNo && deletedTombstoneSet.has(`usr_${uidNo}`)) return false;
    return true;
  });
  cachedUsersState = { users: filtered, timestamp: Date.now() };
  try {
    fs2.writeFileSync(USERS_CACHE_FILE, JSON.stringify(filtered), "utf-8");
  } catch {
  }
}
function upsertUserIntoCachedState(userObj) {
  if (!userObj || !userObj.idNo) return;
  const currentList = cachedUsersState?.users ? [...cachedUsersState.users] : [];
  const targetId = String(userObj.id || "").trim().toLowerCase();
  const targetIdNo = String(userObj.idNo || "").trim().toLowerCase();
  const idx = currentList.findIndex(
    (u) => targetId && String(u.id || "").trim().toLowerCase() === targetId || targetIdNo && String(u.idNo || "").trim().toLowerCase() === targetIdNo
  );
  const stamped = { ...userObj, _localSavedAt: Date.now() };
  if (idx >= 0) {
    currentList[idx] = { ...currentList[idx], ...stamped };
  } else {
    currentList.unshift(stamped);
  }
  saveUsersStateToDisk(currentList);
}
function removeUserFromCachedState(idOrIdNo) {
  const target = String(idOrIdNo || "").trim().toLowerCase();
  if (!target || !cachedUsersState?.users) return;
  const next = cachedUsersState.users.filter(
    (u) => String(u.id || "").trim().toLowerCase() !== target && String(u.idNo || "").trim().toLowerCase() !== target
  );
  saveUsersStateToDisk(next);
}
function buildUserSyncTag(u) {
  const baseDate = String(u.createdAt || "").split("||")[0] || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const idNo = String(u.idNo || "").trim();
  const password = String(u.password || "").trim();
  const phone = String(u.phone || "").trim();
  const designation = String(u.designation || "").trim();
  const badgeNo = String(u.badgeNo || idNo).trim();
  const rawRole = String(u.role || "worker").trim().toLowerCase();
  const role = rawRole === "admin" ? "admin" : rawRole === "agency" ? "agency" : "worker";
  const status = String(u.status || "active").trim().toLowerCase() === "hold" ? "hold" : "active";
  return `${baseDate}||${idNo}||${password}||${phone}||${designation}||${badgeNo}||${role}||${status}`;
}
function normalizeUserRecord(u) {
  if (!u || typeof u !== "object") return null;
  let merged = { ...u };
  const createdRaw = String(u.createdAt || u["Created At"] || "").trim();
  let tagRole = "";
  let tagStatus = "";
  if (createdRaw.includes("||")) {
    const parts = createdRaw.split("||");
    if (parts.length >= 3) {
      if (!merged.idNo && parts[1]) merged.idNo = parts[1];
      if ((merged.password === void 0 || merged.password === "") && parts[2] !== void 0) merged.password = parts[2];
      if (!merged.phone && parts[3]) merged.phone = parts[3];
      if (!merged.designation && parts[4]) merged.designation = parts[4];
      if (!merged.badgeNo && parts[5]) merged.badgeNo = parts[5];
      if (parts[6]) tagRole = parts[6].trim().toLowerCase();
      if (parts[7]) tagStatus = parts[7].trim().toLowerCase();
    }
  }
  const rawId = String(merged.id || merged["ID"] || merged["Record ID"] || "").trim();
  const rawIdNo = String(
    merged.idNo || merged.loginId || merged.userId || merged["User ID"] || merged["User Id"] || merged["user_id"] || merged["ID No"] || merged.workerId || merged.consumerId || ""
  ).trim();
  const rawPhone = String(merged.phone || merged["Phone"] || merged["Mobile"] || merged.mobile || merged.workerPhone || "").trim();
  const rawName = String(merged.name || merged["Name"] || merged["Full Name"] || merged.consumerName || merged.workerName || "").trim();
  const rawPass = String(
    merged.password !== void 0 && merged.password !== null ? merged.password : merged["Password"] !== void 0 && merged["Password"] !== null ? merged["Password"] : ""
  ).trim();
  const rawHash = String(merged.passwordHash || merged["Password Hash"] || "").trim();
  const rawRole = String(tagRole || merged.role || merged["Role"] || "worker").trim().toLowerCase();
  const rawStatus = String(tagStatus || merged.status || merged["Status"] || "active").trim().toLowerCase();
  const finalStatus = rawStatus === "hold" ? "hold" : "active";
  const finalIdNo = rawIdNo || (rawId === "adm_8695716192" ? "8695716192" : rawPhone || rawId);
  if (!finalIdNo) return null;
  const isAdm = rawRole === "admin" || rawRole === "controller" || rawRole === "administrator" || rawRole === "superadmin" || finalIdNo === "8695716192" || finalIdNo.toLowerCase() === "admin" || rawId === "adm_8695716192" || /^adm[-_0-9]/i.test(finalIdNo);
  const isAgency = !isAdm && (rawRole === "agency" || /^agn[-_0-9]/i.test(finalIdNo) || /^agency[-_0-9]/i.test(finalIdNo));
  const finalRole = isAdm ? "admin" : isAgency ? "agency" : "worker";
  const defaultDesig = isAdm ? "Sub-Divisional Controller" : isAgency ? "\u098F\u099C\u09C7\u09A8\u09CD\u09B8\u09BF \u09AA\u09BE\u09B0\u09CD\u099F\u09A8\u09BE\u09B0 / Agency (WBSEDCL)" : "\u09B2\u09BE\u0987\u09A8\u09AE\u09CD\u09AF\u09BE\u09A8 / Worker (WBSEDCL)";
  const finalDesig = String(merged.designation || merged["Designation"] || defaultDesig).trim();
  const finalBadge = String(merged.badgeNo || merged["Badge No"] || finalIdNo).trim();
  return {
    id: rawId || `usr_${finalIdNo}`,
    idNo: finalIdNo,
    loginId: finalIdNo,
    userId: finalIdNo,
    password: rawPass,
    passwordHash: rawHash,
    name: rawName || finalIdNo || "\u0995\u09B0\u09CD\u09AE\u09C0",
    phone: rawPhone,
    role: finalRole,
    status: finalStatus,
    designation: finalDesig,
    badgeNo: finalBadge,
    createdAt: createdRaw.includes("||") ? createdRaw : buildUserSyncTag({ idNo: finalIdNo, password: rawPass, phone: rawPhone, designation: finalDesig, badgeNo: finalBadge, role: finalRole, status: finalStatus, createdAt: createdRaw }),
    updatedAt: String(merged.updatedAt || merged["Updated At"] || "").trim()
  };
}
function extractEntriesArray(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.entries)) return res.entries;
  if (Array.isArray(res.users)) return res.users;
  if (Array.isArray(res.data)) return res.data;
  if (res.data && typeof res.data === "object") {
    if (Array.isArray(res.data.entries)) return res.data.entries;
    if (Array.isArray(res.data.users)) return res.data.users;
  }
  return [];
}
async function hydrateSingleUserFromUsersSheet(rowId) {
  if (!rowId) return null;
  try {
    const detailRes = await callGoogleAppsScript("updateEntry", {
      id: rowId,
      category: "Users",
      data: {}
    }, "POST", 2e4);
    const fullEntry = detailRes?.entry || detailRes?.data?.entry;
    if (fullEntry && typeof fullEntry === "object") {
      const hydrated = normalizeUserRecord(fullEntry);
      if (hydrated && hydrated.idNo) {
        const tag = buildUserSyncTag(hydrated);
        hydrated.createdAt = tag;
        await callGoogleAppsScript("updateEntry", {
          id: rowId,
          category: "Users",
          status: hydrated.status,
          role: hydrated.role,
          createdAt: tag,
          "Created At": tag,
          data: {
            status: hydrated.status,
            Status: hydrated.status,
            role: hydrated.role,
            Role: hydrated.role,
            createdAt: tag,
            "Created At": tag
          }
        }, "POST", 2e4).catch(() => {
        });
        return hydrated;
      }
    }
  } catch {
  }
  return null;
}
async function fetchVerifiedUsersFromSheet(forceRefresh = false) {
  if (forceRefresh) {
    gasCache.delete('entries:{"category":"Users"}');
    gasCache.delete('entries_{"category":"Users"}');
    try {
      const fresh = await Promise.race([
        refreshVerifiedUsersFromSheetNow(),
        new Promise(
          (resolve) => setTimeout(() => resolve(cachedUsersState?.users || []), 6e3)
        )
      ]);
      if (Array.isArray(fresh) && fresh.length > 0) {
        return fresh;
      }
    } catch {
    }
  }
  if (cachedUsersState && Array.isArray(cachedUsersState.users) && cachedUsersState.users.length > 0) {
    const isExpired = Date.now() - cachedUsersState.timestamp >= USERS_STATE_TTL_MS;
    if (isExpired && !isRefreshingUsersInBg) {
      isRefreshingUsersInBg = true;
      (async () => {
        try {
          await refreshVerifiedUsersFromSheetNow();
        } catch {
        } finally {
          isRefreshingUsersInBg = false;
        }
      })();
    }
    return cachedUsersState.users;
  }
  return await refreshVerifiedUsersFromSheetNow();
}
async function refreshVerifiedUsersFromSheetNow() {
  const userMap = /* @__PURE__ */ new Map();
  try {
    const usersSheetRes = await callGoogleAppsScript("entries", { category: "Users" }, "GET", 2e4).catch(() => null);
    const rawEntries = extractEntriesArray(usersSheetRes);
    for (const rowSummary of rawEntries) {
      const rowId = String(rowSummary?.id || "").trim();
      if (!rowId) continue;
      const normSummary = normalizeUserRecord(rowSummary);
      if (normSummary && normSummary.idNo && (normSummary.password !== "" || normSummary.passwordHash !== "")) {
        userMap.set(rowId, normSummary);
        continue;
      }
      const hydrated = await hydrateSingleUserFromUsersSheet(rowId);
      if (hydrated && hydrated.idNo) {
        userMap.set(rowId, hydrated);
        continue;
      }
      if (normSummary) {
        userMap.set(rowId, normSummary);
      }
    }
  } catch (err) {
    console.warn("[UsersLoader] Sheet fetch notice:", err?.message);
  }
  if (cachedUsersState && Array.isArray(cachedUsersState.users)) {
    for (const localU of cachedUsersState.users) {
      if (!localU || !localU.idNo) continue;
      const lId = String(localU.id || "").trim();
      const lIdNoLower = String(localU.idNo || "").trim().toLowerCase();
      if (lId && deletedTombstoneSet.has(lId.toLowerCase())) continue;
      if (lIdNoLower && deletedTombstoneSet.has(`usr_${lIdNoLower}`)) continue;
      const existingByRowId = lId ? userMap.get(lId) : void 0;
      const existingByIdNo = Array.from(userMap.values()).find(
        (u) => String(u.idNo || "").trim().toLowerCase() === lIdNoLower
      );
      const isRecentLocal = Boolean(localU._localSavedAt) && Date.now() - Number(localU._localSavedAt) < 6e5;
      if (!existingByRowId && !existingByIdNo) {
        userMap.set(lId || `usr_${localU.idNo}`, localU);
      } else if (isRecentLocal && (existingByRowId || existingByIdNo)) {
        const keyToUpdate = existingByRowId ? lId : String(existingByIdNo.id || lId);
        userMap.set(keyToUpdate, { ...existingByRowId || existingByIdNo, ...localU });
      }
    }
  }
  const users = Array.from(userMap.values()).filter((u) => {
    if (!u) return false;
    const uid = String(u.id || "").trim().toLowerCase();
    const uidNo = String(u.idNo || "").trim().toLowerCase();
    if (uid && deletedTombstoneSet.has(uid)) return false;
    if (uidNo && deletedTombstoneSet.has(`usr_${uidNo}`)) return false;
    return true;
  });
  if (users.length > 0) {
    saveUsersStateToDisk(users);
  }
  return cachedUsersState?.users || users;
}
function findMatchingUserInList(users, cleanId) {
  const lowerId = cleanId.toLowerCase();
  const cleanIdAlnum = lowerId.replace(/[^a-z0-9]/g, "");
  const cleanDigits = cleanId.replace(/\D/g, "");
  const cleanPhone10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : "";
  return users.find((u) => {
    if (!u) return false;
    const uIdNo = normalizeUniversal(u["User ID"] || u.idNo || u.loginId || u.userId || "").trim().toLowerCase();
    const uIdNoAlnum = uIdNo.replace(/[^a-z0-9]/g, "");
    const uInternalId = normalizeUniversal(u.id || "").trim().toLowerCase();
    const uBadge = normalizeUniversal(u.badgeNo || u["Badge No"] || "").trim().toLowerCase();
    const uBadgeAlnum = uBadge.replace(/[^a-z0-9]/g, "");
    const uName = normalizeUniversal(u["Full Name"] || u.name || u["Name"] || "").trim().toLowerCase();
    const uNameAlnum = uName.replace(/[^a-z0-9]/g, "");
    const uPhoneDigits = normalizeUniversal(u["Phone"] || u.phone || "").replace(/\D/g, "");
    const uPhone10 = uPhoneDigits.length >= 10 ? uPhoneDigits.slice(-10) : uPhoneDigits;
    if (uIdNo && uIdNo === lowerId) return true;
    if (cleanIdAlnum && uIdNoAlnum && uIdNoAlnum === cleanIdAlnum) return true;
    if (uInternalId && uInternalId === lowerId) return true;
    if (uBadge && (uBadge === lowerId || cleanIdAlnum && uBadgeAlnum === cleanIdAlnum)) return true;
    if (uName && (uName === lowerId || cleanIdAlnum.length >= 3 && uNameAlnum === cleanIdAlnum)) return true;
    if (cleanPhone10 && uPhone10 && uPhone10 === cleanPhone10) return true;
    if (cleanDigits && cleanDigits.length >= 4 && uPhoneDigits && cleanDigits === uPhoneDigits) return true;
    return false;
  });
}
function checkUserPasswordMatch(matchedUser, cleanPass) {
  if (!matchedUser || !cleanPass) return false;
  const passSha256 = crypto2.createHash("sha256").update(cleanPass).digest("hex").toLowerCase();
  const passLowerSha256 = crypto2.createHash("sha256").update(cleanPass.toLowerCase()).digest("hex").toLowerCase();
  const storedPass = String(
    matchedUser["Password"] !== void 0 && matchedUser["Password"] !== "" ? matchedUser["Password"] : matchedUser.password !== void 0 ? matchedUser.password : ""
  ).trim();
  const storedHash = String(matchedUser["Password Hash"] || matchedUser.passwordHash || "").trim().toLowerCase();
  const normStored = normalizeUniversal(storedPass).trim();
  if (storedPass && (storedPass === cleanPass || normStored === cleanPass || storedPass.toLowerCase() === cleanPass.toLowerCase() || normStored.toLowerCase() === cleanPass.toLowerCase())) {
    return true;
  }
  if (storedPass && /^[a-f0-9]{64}$/i.test(storedPass) && (storedPass.toLowerCase() === passSha256 || storedPass.toLowerCase() === passLowerSha256)) {
    return true;
  }
  if (storedHash && (storedHash === passSha256 || storedHash === passLowerSha256 || storedHash === cleanPass.toLowerCase())) {
    return true;
  }
  return false;
}
var loginRateLimitMap = /* @__PURE__ */ new Map();
function checkLoginRateLimit(key) {
  const now = Date.now();
  const rec = loginRateLimitMap.get(key);
  if (!rec) return { locked: false };
  if (rec.lockUntil > now) {
    return { locked: true, waitSeconds: Math.ceil((rec.lockUntil - now) / 1e3) };
  }
  if (rec.lockUntil > 0 && rec.lockUntil <= now) {
    loginRateLimitMap.delete(key);
  }
  return { locked: false };
}
function recordFailedLogin(key) {
  const now = Date.now();
  const rec = loginRateLimitMap.get(key) || { failedCount: 0, lockUntil: 0 };
  rec.failedCount += 1;
  if (rec.failedCount >= 5) {
    rec.lockUntil = now + 3 * 60 * 1e3;
  }
  loginRateLimitMap.set(key, rec);
}
function clearFailedLogin(key) {
  loginRateLimitMap.delete(key);
}
var REGISTERED_OFFICES_CACHE_FILE = path2.join(process.cwd(), ".registered-offices-cache.json");
function readRegisteredOfficesCache() {
  try {
    if (fs2.existsSync(REGISTERED_OFFICES_CACHE_FILE)) {
      const raw = fs2.readFileSync(REGISTERED_OFFICES_CACHE_FILE, "utf8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch {
  }
  return [];
}
function saveRegisteredOfficesCache(offices) {
  try {
    fs2.writeFileSync(REGISTERED_OFFICES_CACHE_FILE, JSON.stringify(offices, null, 2), { encoding: "utf8", mode: 384 });
  } catch {
  }
}
function findMatchingOfficeAdmin(offices, cleanId) {
  const lowerId = cleanId.toLowerCase();
  const cleanIdAlnum = lowerId.replace(/[^a-z0-9]/g, "");
  const cleanDigits = cleanId.replace(/\D/g, "");
  const cleanPhone10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : "";
  return offices.find((o) => {
    if (!o) return false;
    const uAdminId = String(o.adminUserId || "").trim().toLowerCase();
    const uAdminIdAlnum = uAdminId.replace(/[^a-z0-9]/g, "");
    const uMobile = String(o.adminMobile || "").replace(/\D/g, "");
    const uMobile10 = uMobile.length >= 10 ? uMobile.slice(-10) : uMobile;
    if (uAdminId && uAdminId === lowerId) return true;
    if (cleanIdAlnum && uAdminIdAlnum && uAdminIdAlnum === cleanIdAlnum) return true;
    if (cleanPhone10 && uMobile10 && uMobile10 === cleanPhone10) return true;
    return false;
  });
}
async function getRegisteredOfficesForAuth(forceLiveRefresh = false) {
  const cached = readRegisteredOfficesCache();
  if (!forceLiveRefresh && cached.length > 0) {
    return cached;
  }
  try {
    const creds = getServiceAccountCredentials();
    if (!creds) return cached;
    const token = await getGoogleSheetsAccessToken(creds);
    const res = await fetchAllRegisteredOfficesWithAuth(token);
    if (res && Array.isArray(res.records) && res.records.length > 0) {
      const map = /* @__PURE__ */ new Map();
      for (const c of cached) map.set(c.id, c);
      for (const r of res.records) map.set(r.id, r);
      const combined = Array.from(map.values());
      saveRegisteredOfficesCache(combined);
      return combined;
    }
  } catch (err) {
    console.warn("[OfficeRegistry] Notice fetching live offices:", err?.message || err);
  }
  return cached;
}
async function authenticateUserCredentials(rawId, rawPassword) {
  const cleanId = normalizeUniversal(rawId).trim();
  const cleanPass = normalizeUniversal(rawPassword).trim();
  if (!cleanId || !cleanPass) {
    return {
      status: 400,
      body: {
        success: false,
        error: "\u0987\u0989\u099C\u09BE\u09B0 \u0986\u0987\u09A1\u09BF / \u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0 \u098F\u09AC\u0982 \u09AA\u09BE\u09B8\u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u09A1 \u09AA\u09CD\u09B0\u09AF\u09BC\u09CB\u099C\u09A8 (User ID / Phone & Password required)"
      }
    };
  }
  const rateLimit = checkLoginRateLimit(cleanId);
  if (rateLimit.locked) {
    return {
      status: 429,
      body: {
        success: false,
        error: `\u0985\u09A4\u09BF\u09B0\u09BF\u0995\u09CD\u09A4 \u09AD\u09C1\u09B2 \u099A\u09C7\u09B7\u09CD\u099F\u09BE\u09B0 \u0995\u09BE\u09B0\u09A3\u09C7 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09B8\u09BE\u09AE\u09DF\u09BF\u0995\u09AD\u09BE\u09AC\u09C7 \u09B2\u0995 \u09B9\u09DF\u09C7\u099B\u09C7\u0964 ${rateLimit.waitSeconds} \u09B8\u09C7\u0995\u09C7\u09A8\u09CD\u09A1 \u09AA\u09B0 \u099A\u09C7\u09B7\u09CD\u099F\u09BE \u0995\u09B0\u09C1\u09A8\u0964 (Too many failed attempts. Please wait ${rateLimit.waitSeconds}s)`
      }
    };
  }
  let users = cachedUsersState?.users && cachedUsersState.users.length > 0 ? cachedUsersState.users : await fetchVerifiedUsersFromSheet(false);
  let matchedUser = findMatchingUserInList(users, cleanId);
  if (matchedUser && checkUserPasswordMatch(matchedUser, cleanPass)) {
    if (!cachedUsersState || Date.now() - cachedUsersState.timestamp > 3e4) {
      fetchVerifiedUsersFromSheet(true).catch(() => {
      });
    }
  } else {
    users = await fetchVerifiedUsersFromSheet(true);
    matchedUser = findMatchingUserInList(users, cleanId);
    if (matchedUser && !checkUserPasswordMatch(matchedUser, cleanPass)) {
      const liveRow = await hydrateSingleUserFromUsersSheet(matchedUser.id);
      if (liveRow) {
        matchedUser = liveRow;
        clearUsersStateCache();
      }
    }
  }
  if (!matchedUser) {
    const discTasks = cachedDisconnectionState?.tasks || [];
    const matchingDiscTask = discTasks.find((t) => {
      const ag = String(t.Agency || t.agency || t.assignedAgency || t["Agency Name"] || "").trim().toLowerCase();
      const agAlnum = ag.replace(/[^a-z0-9]/g, "");
      const cleanAlnum = cleanId.toLowerCase().replace(/[^a-z0-9]/g, "");
      return ag && (ag === cleanId.toLowerCase() || cleanAlnum.length >= 3 && (agAlnum === cleanAlnum || agAlnum.includes(cleanAlnum) || cleanAlnum.includes(agAlnum)));
    });
    if (matchingDiscTask) {
      const agName = String(matchingDiscTask.Agency || matchingDiscTask.agency || matchingDiscTask.assignedAgency || cleanId).trim();
      matchedUser = {
        id: `usr_agency_${cleanId.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
        idNo: cleanId.toUpperCase(),
        loginId: cleanId,
        userId: cleanId,
        name: agName,
        agencyName: agName,
        role: "agency",
        status: "active",
        password: cleanPass,
        designation: "Agency Partner (WBSEDCL)"
      };
    }
  }
  if (!matchedUser) {
    let registeredOffices = await getRegisteredOfficesForAuth(false);
    let matchedOffice = findMatchingOfficeAdmin(registeredOffices, cleanId);
    if (!matchedOffice) {
      registeredOffices = await getRegisteredOfficesForAuth(true);
      matchedOffice = findMatchingOfficeAdmin(registeredOffices, cleanId);
    }
    if (matchedOffice) {
      const isPassMatch = verifyOfficePassword(cleanPass, matchedOffice.passwordSalt, matchedOffice.passwordHash);
      if (!isPassMatch) {
        recordFailedLogin(cleanId);
        return {
          status: 401,
          body: {
            success: false,
            error: "\u09AD\u09C1\u09B2 \u09AA\u09BE\u09B8\u0993\u09DF\u09BE\u09B0\u09CD\u09A1! \u09B8\u09A0\u09BF\u0995 \u09AA\u09BE\u09B8\u0993\u09DF\u09BE\u09B0\u09CD\u09A1 \u09AC\u09BE \u09AA\u09BF\u09A8 \u09A6\u09BF\u09A8 (Invalid Password)"
          }
        };
      }
      clearFailedLogin(cleanId);
      const session2 = {
        id: `office_${matchedOffice.id}`,
        idNo: matchedOffice.adminUserId,
        loginId: matchedOffice.adminUserId,
        userId: matchedOffice.adminUserId,
        name: `${matchedOffice.adminName} (${matchedOffice.officeName})`,
        officeName: matchedOffice.officeName,
        officeId: matchedOffice.id,
        databaseName: matchedOffice.databaseName,
        spreadsheetId: matchedOffice.verifiedSpreadsheetId,
        spreadsheetLink: matchedOffice.spreadsheetLink,
        phone: matchedOffice.adminMobile,
        role: "admin",
        isOfficeScoped: true,
        status: "active",
        designation: `Office Administrator (${matchedOffice.officeName})`,
        badgeNo: matchedOffice.adminUserId,
        token: `SES-OFFICE-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        loggedInAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      return {
        status: 200,
        body: { success: true, session: session2, data: { session: session2 } }
      };
    }
    recordFailedLogin(cleanId);
    return {
      status: 401,
      body: {
        success: false,
        error: "\u09AD\u09C1\u09B2 \u0987\u0989\u099C\u09BE\u09B0 \u0986\u0987\u09A1\u09BF! \u09B8\u09A0\u09BF\u0995 \u0987\u0989\u099C\u09BE\u09B0 \u0986\u0987\u09A1\u09BF \u09AC\u09BE \u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0 \u09A6\u09BF\u09A8\u0964 (Invalid User ID)"
      }
    };
  }
  const status = String(matchedUser["Status"] || matchedUser.status || "active").toLowerCase().trim();
  if (status === "hold") {
    return {
      status: 403,
      body: {
        success: false,
        error: "\u0986\u09AA\u09A8\u09BE\u09B0 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F\u099F\u09BF \u09B8\u09BE\u09AE\u09AF\u09BC\u09BF\u0995\u09AD\u09BE\u09AC\u09C7 \u09B8\u09CD\u09A5\u0997\u09BF\u09A4 (ON HOLD) \u09B0\u09BE\u0996\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964 \u098F\u09A1\u09AE\u09BF\u09A8\u09C7\u09B0 \u09B8\u09BE\u09A5\u09C7 \u09AF\u09CB\u0997\u09BE\u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8\u0964 (Account is on hold)"
      }
    };
  }
  const passwordValid = checkUserPasswordMatch(matchedUser, cleanPass);
  if (!passwordValid) {
    recordFailedLogin(cleanId);
    return {
      status: 401,
      body: {
        success: false,
        error: "\u09AD\u09C1\u09B2 \u09AA\u09BE\u09B8\u0993\u09DF\u09BE\u09B0\u09CD\u09A1! \u09B8\u09A0\u09BF\u0995 \u09AA\u09BE\u09B8\u0993\u09DF\u09BE\u09B0\u09CD\u09A1 \u09AC\u09BE \u09AA\u09BF\u09A8 \u09A6\u09BF\u09A8 (Invalid Password)"
      }
    };
  }
  clearFailedLogin(cleanId);
  const roleStr = String(matchedUser["Role"] || matchedUser.role || "worker").trim().toLowerCase();
  const idNoStr = String(matchedUser.idNo || matchedUser["User ID"] || cleanId).trim();
  const isRoleAdmin = roleStr === "admin" || roleStr === "controller" || roleStr === "administrator" || roleStr === "superadmin" || idNoStr === "8695716192" || idNoStr.toLowerCase() === "admin" || matchedUser.id === "adm_8695716192" || /^adm[-_0-9]/i.test(idNoStr);
  const isRoleAgency = !isRoleAdmin && (roleStr === "agency" || /^agn[-_0-9]/i.test(idNoStr) || /^agency[-_0-9]/i.test(idNoStr));
  const resolvedRole = isRoleAdmin ? "admin" : isRoleAgency ? "agency" : "worker";
  const session = {
    id: String(matchedUser.id || `usr_${idNoStr}`),
    idNo: idNoStr,
    loginId: idNoStr,
    userId: idNoStr,
    name: String(matchedUser["Full Name"] || matchedUser.name || (isRoleAdmin ? "NAYEM (Admin Controller)" : isRoleAgency ? "Agency Partner" : "\u0995\u09B0\u09CD\u09AE\u09C0")),
    agencyName: String(matchedUser["Agency Name"] || matchedUser.agencyName || matchedUser["Full Name"] || matchedUser.name || ""),
    phone: String(matchedUser["Phone"] || matchedUser.phone || ""),
    role: resolvedRole,
    status: "active",
    designation: String(
      matchedUser["Designation"] || matchedUser.designation || (isRoleAdmin ? "Sub-Divisional Controller" : isRoleAgency ? "\u098F\u099C\u09C7\u09A8\u09CD\u09B8\u09BF \u09AA\u09BE\u09B0\u09CD\u099F\u09A8\u09BE\u09B0 / Agency (WBSEDCL)" : "\u09B2\u09BE\u0987\u09A8\u09AE\u09CD\u09AF\u09BE\u09A8 / Worker (WBSEDCL)")
    ),
    badgeNo: String(matchedUser["Badge No"] || matchedUser.badgeNo || idNoStr),
    token: `SES-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    loggedInAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  return {
    status: 200,
    body: { success: true, session, data: { session } }
  };
}
app.all(["/api/auth/login", "/api/login"], async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const body = req.method === "GET" ? req.query || {} : req.body || {};
    const rawId = body.loginId || body.idNo || body.userId || body.phone || body.username || body.id;
    const result = await authenticateUserCredentials(rawId, body.password);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.warn("Login authentication notice:", error?.message || error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: error?.message || "Login connection error. Please try again."
      });
    }
  }
});
app.post("/api/auth/change-password", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const { idNo, currentPassword, newPassword } = req.body;
    const cleanId = normalizeUniversal(idNo).trim();
    const cleanNewPass = normalizeUniversal(newPassword).trim();
    const users = await fetchVerifiedUsersFromSheet();
    const target = findMatchingUserInList(users, cleanId);
    if (target) {
      const syncTag = buildUserSyncTag({ ...target, password: cleanNewPass });
      const updatedTarget = {
        ...target,
        password: cleanNewPass,
        Password: cleanNewPass,
        status: target.status || "active",
        createdAt: syncTag,
        "Created At": syncTag
      };
      await callGoogleAppsScript("updateEntry", {
        id: target.id,
        category: "Users",
        status: target.status || "active",
        role: target.role || "worker",
        password: cleanNewPass,
        createdAt: syncTag,
        "Created At": syncTag,
        data: updatedTarget
      }, "POST");
      clearUsersStateCache();
      return res.json({ success: true, message: "Password updated successfully" });
    }
    const gasRes = await callGoogleAppsScript("changePassword", {
      idNo: cleanId,
      currentPassword: normalizeUniversal(currentPassword),
      newPassword: cleanNewPass
    }, "POST");
    clearUsersStateCache();
    return res.json(gasRes);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/auth/reset-password", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const { idNo, phone, newPassword } = req.body;
    const cleanId = normalizeUniversal(idNo).trim();
    const cleanNewPass = normalizeUniversal(newPassword).trim();
    const users = await fetchVerifiedUsersFromSheet();
    const target = findMatchingUserInList(users, cleanId || phone);
    if (target) {
      const syncTag = buildUserSyncTag({ ...target, password: cleanNewPass });
      const updatedTarget = {
        ...target,
        password: cleanNewPass,
        Password: cleanNewPass,
        status: target.status || "active",
        createdAt: syncTag,
        "Created At": syncTag
      };
      await callGoogleAppsScript("updateEntry", {
        id: target.id,
        category: "Users",
        status: target.status || "active",
        role: target.role || "worker",
        password: cleanNewPass,
        createdAt: syncTag,
        "Created At": syncTag,
        data: updatedTarget
      }, "POST");
      clearUsersStateCache();
      return res.json({ success: true, message: "Password reset successfully" });
    }
    const gasRes = await callGoogleAppsScript("resetPassword", {
      idNo: cleanId,
      phone: normalizeUniversal(phone),
      newPassword: cleanNewPass
    }, "POST");
    clearUsersStateCache();
    return res.json(gasRes);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/auth/verify/:idNo", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const cleanId = normalizeUniversal(req.params.idNo).trim().toLowerCase();
    const users = await fetchVerifiedUsersFromSheet();
    const matched = users.find((u) => String(u.idNo).trim().toLowerCase() === cleanId || String(u.id).trim().toLowerCase() === cleanId || String(u.phone || "").includes(cleanId));
    if (!matched) {
      return res.status(404).json({ valid: false, error: "User not found in Google Sheets" });
    }
    if (matched.status === "hold") {
      return res.status(403).json({ valid: false, status: "hold", error: "User account is currently ON HOLD" });
    }
    return res.json({ valid: true, status: matched.status || "active", role: matched.role });
  } catch (err) {
    return res.status(500).json({ valid: false, error: err.message });
  }
});
var TWOFACTOR_API_KEY = (process.env.TWOFACTOR_API_KEY || process.env["2FACTOR_API_KEY"] || "").trim();
var TWOFACTOR_LOGIN_TEMPLATE = (process.env.TWOFACTOR_LOGIN_TEMPLATE || process.env["2FACTOR_LOGIN_TEMPLATE"] || process.env.TWOFACTOR_OTP_TEMPLATE || process.env["2FACTOR_OTP_TEMPLATE"] || process.env.TWOFACTOR_TEMPLATE || process.env["2FACTOR_TEMPLATE"] || "").trim();
var TWOFACTOR_FORGOT_TEMPLATE = (process.env.TWOFACTOR_FORGOT_TEMPLATE || process.env["2FACTOR_FORGOT_TEMPLATE"] || process.env.TWOFACTOR_OTP_TEMPLATE || process.env["2FACTOR_OTP_TEMPLATE"] || process.env.TWOFACTOR_TEMPLATE || process.env["2FACTOR_TEMPLATE"] || "").trim();
var pendingOtpSessionMap = /* @__PURE__ */ new Map();
var phoneRateLimitMap = /* @__PURE__ */ new Map();
async function call2FactorSendOtp(phone10, templateName) {
  if (!TWOFACTOR_API_KEY) {
    return {
      success: false,
      error: "2Factor API Key is not configured on the server. Please set TWOFACTOR_API_KEY in Vercel environment variables."
    };
  }
  try {
    const customTemplate = (templateName || "").trim();
    const tmplPart = customTemplate ? `/${encodeURIComponent(customTemplate)}` : "";
    const url = `https://2factor.in/API/V1/${encodeURIComponent(TWOFACTOR_API_KEY)}/SMS/${encodeURIComponent(phone10)}/AUTOGEN${tmplPart}`;
    const resp = await fetch(url);
    const data = await resp.json().catch(() => null);
    if (data && String(data.Status).toLowerCase() === "success") {
      return {
        success: true,
        sessionId: String(data.Details || "")
      };
    }
    return {
      success: false,
      error: data?.Details || data?.error || "Failed to send OTP via 2Factor default SMS gateway."
    };
  } catch (err) {
    return {
      success: false,
      error: err?.message || "Error connecting to 2Factor SMS service."
    };
  }
}
async function call2FactorVerifyOtp(sessionId, otp) {
  if (!TWOFACTOR_API_KEY) {
    return {
      success: false,
      error: "2Factor API Key is not configured on the server. Please set TWOFACTOR_API_KEY in Vercel environment variables."
    };
  }
  try {
    const url = `https://2factor.in/API/V1/${encodeURIComponent(TWOFACTOR_API_KEY)}/SMS/VERIFY/${encodeURIComponent(sessionId)}/${encodeURIComponent(otp)}`;
    const resp = await fetch(url);
    const data = await resp.json().catch(() => null);
    if (data && String(data.Status).toLowerCase() === "success" && String(data.Details).toLowerCase().includes("match")) {
      return { success: true };
    }
    return {
      success: false,
      error: data?.Details || "Invalid OTP or OTP has expired."
    };
  } catch (err) {
    return {
      success: false,
      error: err?.message || "Error verifying OTP with 2Factor."
    };
  }
}
app.post("/api/auth/otp/send-login", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const rawPhone = String(req.body?.phone || req.body?.mobile || "").trim();
    const cleanDigits = rawPhone.replace(/\D/g, "");
    const phone10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;
    if (!phone10 || phone10.length !== 10) {
      return res.status(400).json({
        success: false,
        error: "\u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 \u09B8\u09A0\u09BF\u0995 \u09E7\u09E6 \u09B8\u0982\u0996\u09CD\u09AF\u09BE\u09B0 \u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0 \u09A6\u09BF\u09A8 (Please enter a valid 10-digit mobile number)."
      });
    }
    const users = await fetchVerifiedUsersFromSheet();
    const target = findMatchingUserInList(users, phone10);
    if (!target) {
      return res.status(404).json({
        success: false,
        error: "\u098F\u0987 \u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0\u09C7 \u0995\u09CB\u09A8\u09CB \u09A8\u09BF\u09AC\u09A8\u09CD\u09A7\u09BF\u09A4 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09AA\u09BE\u0993\u09DF\u09BE \u09AF\u09BE\u09DF\u09A8\u09BF (No registered account found with this mobile number)."
      });
    }
    const status = String(target["Status"] || target.status || "active").toLowerCase().trim();
    if (status === "hold") {
      return res.status(403).json({
        success: false,
        error: "\u0986\u09AA\u09A8\u09BE\u09B0 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F\u099F\u09BF \u09B8\u09BE\u09AE\u09AF\u09BC\u09BF\u0995\u09AD\u09BE\u09AC\u09C7 \u09B8\u09CD\u09A5\u0997\u09BF\u09A4 (ON HOLD) \u09B0\u09BE\u0996\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964 \u098F\u09A1\u09AE\u09BF\u09A8\u09C7\u09B0 \u09B8\u09BE\u09A5\u09C7 \u09AF\u09CB\u0997\u09BE\u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8\u0964"
      });
    }
    const now = Date.now();
    const rate = phoneRateLimitMap.get(phone10);
    if (rate) {
      if (now - rate.lastSentAt < 6e4) {
        const remaining = Math.ceil((6e4 - (now - rate.lastSentAt)) / 1e3);
        return res.status(429).json({
          success: false,
          error: `\u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 ${remaining} \u09B8\u09C7\u0995\u09C7\u09A8\u09CD\u09A1 \u0985\u09AA\u09C7\u0995\u09CD\u09B7\u09BE \u0995\u09B0\u09C1\u09A8 (Please wait ${remaining}s before requesting a new OTP).`
        });
      }
      if (now - rate.windowStart < 15 * 60 * 1e3 && rate.count >= 5) {
        return res.status(429).json({
          success: false,
          error: "\u0985\u09A4\u09BF\u09B0\u09BF\u0995\u09CD\u09A4 \u099A\u09C7\u09B7\u09CD\u099F\u09BE\u09B0 \u0995\u09BE\u09B0\u09A3\u09C7 \u09E7\u09EB \u09AE\u09BF\u09A8\u09BF\u099F\u09C7\u09B0 \u099C\u09A8\u09CD\u09AF \u0993\u099F\u09BF\u09AA\u09BF \u09AA\u09BE\u09A0\u09BE\u09A8\u09CB \u09B8\u09CD\u09A5\u0997\u09BF\u09A4 \u0995\u09B0\u09BE \u09B9\u09DF\u09C7\u099B\u09C7 (Rate limit exceeded. Try after 15m)."
        });
      }
      if (now - rate.windowStart >= 15 * 60 * 1e3) {
        phoneRateLimitMap.set(phone10, { lastSentAt: now, count: 1, windowStart: now });
      } else {
        rate.count += 1;
        rate.lastSentAt = now;
      }
    } else {
      phoneRateLimitMap.set(phone10, { lastSentAt: now, count: 1, windowStart: now });
    }
    const sendResult = await call2FactorSendOtp(phone10, TWOFACTOR_LOGIN_TEMPLATE);
    if (!sendResult.success) {
      return res.status(400).json({
        success: false,
        error: sendResult.error || "Failed to send OTP via SMS gateway."
      });
    }
    pendingOtpSessionMap.set(sendResult.sessionId, {
      phone: phone10,
      sessionId: sendResult.sessionId,
      purpose: "login",
      userIdNo: String(target.idNo || phone10),
      createdAt: now,
      lastSentAt: now
    });
    return res.json({
      success: true,
      sessionId: sendResult.sessionId,
      phone: phone10,
      message: "\u0986\u09AA\u09A8\u09BE\u09B0 \u09A8\u09BF\u09AC\u09A8\u09CD\u09A7\u09BF\u09A4 \u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0\u09C7 \u0993\u099F\u09BF\u09AA\u09BF \u09AA\u09BE\u09A0\u09BE\u09A8\u09CB \u09B9\u09DF\u09C7\u099B\u09C7 (OTP sent successfully)."
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Server error sending login OTP" });
  }
});
app.post("/api/auth/otp/verify-login", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const rawPhone = String(req.body?.phone || req.body?.mobile || "").trim();
    const cleanDigits = rawPhone.replace(/\D/g, "");
    const phone10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;
    const cleanOtp = String(req.body?.otp || "").trim();
    const sessionId = String(req.body?.sessionId || "").trim();
    if (!sessionId || !cleanOtp || !phone10) {
      return res.status(400).json({
        success: false,
        error: "\u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0, \u09B8\u09C7\u09B6\u09A8 \u0986\u0987\u09A1\u09BF \u098F\u09AC\u0982 \u0993\u099F\u09BF\u09AA\u09BF \u09AA\u09CD\u09B0\u09DF\u09CB\u099C\u09A8 (Phone, Session ID, and OTP are required)."
      });
    }
    const vRes = await call2FactorVerifyOtp(sessionId, cleanOtp);
    if (!vRes.success) {
      return res.status(400).json({
        success: false,
        error: vRes.error || "\u09AD\u09C1\u09B2 \u0993\u099F\u09BF\u09AA\u09BF \u0985\u09A5\u09AC\u09BE \u0993\u099F\u09BF\u09AA\u09BF\u09B0 \u09AE\u09C7\u09DF\u09BE\u09A6 \u09B6\u09C7\u09B7 \u09B9\u09DF\u09C7 \u0997\u09C7\u099B\u09C7 (Invalid or expired OTP)."
      });
    }
    const users = await fetchVerifiedUsersFromSheet();
    const matchedUser = findMatchingUserInList(users, phone10);
    if (!matchedUser) {
      return res.status(404).json({
        success: false,
        error: "\u09AC\u09CD\u09AF\u09AC\u09B9\u09BE\u09B0\u0995\u09BE\u09B0\u09C0 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09AA\u09BE\u0993\u09DF\u09BE \u09AF\u09BE\u09DF\u09A8\u09BF (User account not found)."
      });
    }
    const status = String(matchedUser["Status"] || matchedUser.status || "active").toLowerCase().trim();
    if (status === "hold") {
      return res.status(403).json({
        success: false,
        error: "\u0986\u09AA\u09A8\u09BE\u09B0 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F\u099F\u09BF \u09B8\u09BE\u09AE\u09AF\u09BC\u09BF\u0995\u09AD\u09BE\u09AC\u09C7 \u09B8\u09CD\u09A5\u0997\u09BF\u09A4 (ON HOLD) \u09B0\u09BE\u0996\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964"
      });
    }
    const roleStr = String(matchedUser["Role"] || matchedUser.role || "worker").trim().toLowerCase();
    const idNoStr = String(matchedUser.idNo || matchedUser["User ID"] || phone10).trim();
    const isRoleAdmin = roleStr === "admin" || roleStr === "controller" || roleStr === "administrator" || roleStr === "superadmin" || idNoStr === "8695716192" || idNoStr.toLowerCase() === "admin" || matchedUser.id === "adm_8695716192" || /^adm[-_0-9]/i.test(idNoStr);
    const isRoleAgency = !isRoleAdmin && (roleStr === "agency" || /^agn[-_0-9]/i.test(idNoStr) || /^agency[-_0-9]/i.test(idNoStr));
    const resolvedRole = isRoleAdmin ? "admin" : isRoleAgency ? "agency" : "worker";
    const session = {
      id: String(matchedUser.id || `usr_${idNoStr}`),
      idNo: idNoStr,
      loginId: idNoStr,
      userId: idNoStr,
      name: String(matchedUser["Full Name"] || matchedUser.name || (isRoleAdmin ? "NAYEM (Admin Controller)" : isRoleAgency ? "Agency Partner" : "\u0995\u09B0\u09CD\u09AE\u09C0")),
      agencyName: String(matchedUser["Agency Name"] || matchedUser.agencyName || matchedUser["Full Name"] || matchedUser.name || ""),
      phone: String(matchedUser["Phone"] || matchedUser.phone || phone10),
      role: resolvedRole,
      status: "active",
      designation: String(
        matchedUser["Designation"] || matchedUser.designation || (isRoleAdmin ? "Sub-Divisional Controller" : isRoleAgency ? "\u098F\u099C\u09C7\u09A8\u09CD\u09B8\u09BF \u09AA\u09BE\u09B0\u09CD\u099F\u09A8\u09BE\u09B0 / Agency (WBSEDCL)" : "\u09B2\u09BE\u0987\u09A8\u09AE\u09CD\u09AF\u09BE\u09A8 / Worker (WBSEDCL)")
      ),
      badgeNo: String(matchedUser["Badge No"] || matchedUser.badgeNo || idNoStr),
      token: `SES-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      loggedInAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    pendingOtpSessionMap.delete(sessionId);
    return res.json({ success: true, session, data: { session } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Server error verifying login OTP" });
  }
});
app.post("/api/auth/otp/send-forgot-password", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const rawPhone = String(req.body?.phone || req.body?.mobile || "").trim();
    const cleanDigits = rawPhone.replace(/\D/g, "");
    const phone10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;
    if (!phone10 || phone10.length !== 10) {
      return res.status(400).json({
        success: false,
        error: "\u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 \u09B8\u09A0\u09BF\u0995 \u09E7\u09E6 \u09B8\u0982\u0996\u09CD\u09AF\u09BE\u09B0 \u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0 \u09A6\u09BF\u09A8 (Please enter a valid 10-digit mobile number)."
      });
    }
    const users = await fetchVerifiedUsersFromSheet();
    const target = findMatchingUserInList(users, phone10);
    if (!target) {
      return res.status(404).json({
        success: false,
        error: "\u098F\u0987 \u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0\u09C7 \u0995\u09CB\u09A8\u09CB \u09A8\u09BF\u09AC\u09A8\u09CD\u09A7\u09BF\u09A4 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09AA\u09BE\u0993\u09DF\u09BE \u09AF\u09BE\u09DF\u09A8\u09BF (No registered account found with this mobile number)."
      });
    }
    const now = Date.now();
    const rate = phoneRateLimitMap.get(phone10);
    if (rate && now - rate.lastSentAt < 6e4) {
      const remaining = Math.ceil((6e4 - (now - rate.lastSentAt)) / 1e3);
      return res.status(429).json({
        success: false,
        error: `\u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 ${remaining} \u09B8\u09C7\u0995\u09C7\u09A8\u09CD\u09A1 \u0985\u09AA\u09C7\u0995\u09CD\u09B7\u09BE \u0995\u09B0\u09C1\u09A8 (Please wait ${remaining}s before requesting a new OTP).`
      });
    }
    const sendResult = await call2FactorSendOtp(phone10, TWOFACTOR_FORGOT_TEMPLATE);
    if (!sendResult.success) {
      return res.status(400).json({
        success: false,
        error: sendResult.error || "Failed to send OTP via SMS gateway."
      });
    }
    pendingOtpSessionMap.set(sendResult.sessionId, {
      phone: phone10,
      sessionId: sendResult.sessionId,
      purpose: "forgot_password",
      userIdNo: String(target.idNo || phone10),
      createdAt: now,
      lastSentAt: now
    });
    return res.json({
      success: true,
      sessionId: sendResult.sessionId,
      phone: phone10,
      message: "\u09AA\u09BE\u09B8\u0993\u09DF\u09BE\u09B0\u09CD\u09A1 \u09B0\u09BF\u09B8\u09C7\u099F \u0993\u099F\u09BF\u09AA\u09BF \u0986\u09AA\u09A8\u09BE\u09B0 \u09A8\u09AE\u09CD\u09AC\u09B0\u09C7 \u09AA\u09BE\u09A0\u09BE\u09A8\u09CB \u09B9\u09DF\u09C7\u099B\u09C7 (Reset OTP sent successfully)."
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Server error sending forgot password OTP" });
  }
});
app.post("/api/auth/otp/verify-reset-password", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const rawPhone = String(req.body?.phone || req.body?.mobile || "").trim();
    const cleanDigits = rawPhone.replace(/\D/g, "");
    const phone10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;
    const cleanOtp = String(req.body?.otp || "").trim();
    const sessionId = String(req.body?.sessionId || "").trim();
    const newPassword = String(req.body?.newPassword || req.body?.password || "").trim();
    if (!sessionId || !cleanOtp || !phone10 || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "\u09AE\u09CB\u09AC\u09BE\u0987\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0, \u0993\u099F\u09BF\u09AA\u09BF, \u09B8\u09C7\u09B6\u09A8 \u0986\u0987\u09A1\u09BF \u098F\u09AC\u0982 \u09A8\u09A4\u09C1\u09A8 \u09AA\u09BE\u09B8\u0993\u09DF\u09BE\u09B0\u09CD\u09A1 \u09AA\u09CD\u09B0\u09DF\u09CB\u099C\u09A8\u0964"
      });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({
        success: false,
        error: "\u09A8\u09A4\u09C1\u09A8 \u09AA\u09BE\u09B8\u0993\u09DF\u09BE\u09B0\u09CD\u09A1 \u0995\u09AE\u09AA\u0995\u09CD\u09B7\u09C7 \u09EA \u0985\u0995\u09CD\u09B7\u09B0\u09C7\u09B0 \u09B9\u09A4\u09C7 \u09B9\u09AC\u09C7 (Password must be at least 4 characters)."
      });
    }
    const vRes = await call2FactorVerifyOtp(sessionId, cleanOtp);
    if (!vRes.success) {
      return res.status(400).json({
        success: false,
        error: vRes.error || "\u09AD\u09C1\u09B2 \u0993\u099F\u09BF\u09AA\u09BF \u0985\u09A5\u09AC\u09BE \u0993\u099F\u09BF\u09AA\u09BF\u09B0 \u09AE\u09C7\u09DF\u09BE\u09A6 \u09B6\u09C7\u09B7 \u09B9\u09DF\u09C7 \u0997\u09C7\u099B\u09C7 (Invalid or expired OTP)."
      });
    }
    const users = await fetchVerifiedUsersFromSheet();
    const target = findMatchingUserInList(users, phone10);
    if (!target) {
      return res.status(404).json({
        success: false,
        error: "\u09AC\u09CD\u09AF\u09AC\u09B9\u09BE\u09B0\u0995\u09BE\u09B0\u09C0 \u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09AA\u09BE\u0993\u09DF\u09BE \u09AF\u09BE\u09DF\u09A8\u09BF (User account not found)."
      });
    }
    const cleanNewPass = normalizeUniversal(newPassword).trim();
    const syncTag = buildUserSyncTag({ ...target, password: cleanNewPass });
    const updatedTarget = {
      ...target,
      password: cleanNewPass,
      Password: cleanNewPass,
      status: target.status || "active",
      createdAt: syncTag,
      "Created At": syncTag
    };
    await callGoogleAppsScript("updateEntry", {
      id: target.id,
      category: "Users",
      status: target.status || "active",
      role: target.role || "worker",
      password: cleanNewPass,
      createdAt: syncTag,
      "Created At": syncTag,
      data: updatedTarget
    }, "POST");
    clearUsersStateCache();
    pendingOtpSessionMap.delete(sessionId);
    return res.json({
      success: true,
      message: "\u09AA\u09BE\u09B8\u0993\u09DF\u09BE\u09B0\u09CD\u09A1 \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8 \u0995\u09B0\u09BE \u09B9\u09DF\u09C7\u099B\u09C7\u0964 \u09A8\u09A4\u09C1\u09A8 \u09AA\u09BE\u09B8\u0993\u09DF\u09BE\u09B0\u09CD\u09A1 \u09A6\u09BF\u09DF\u09C7 \u09B2\u0997\u0987\u09A8 \u0995\u09B0\u09C1\u09A8 (Password updated successfully)."
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Server error resetting password" });
  }
});
async function validateEntryDeletion(entryId, clientPayload) {
  const cleanId = String(entryId || "").trim();
  if (!cleanId) {
    return { allowed: false, error: "Record ID is required for deletion." };
  }
  return { allowed: true, isCritical: false, record: clientPayload?.entry || null };
}
async function validateUserDeletion(userId, clientPayload) {
  const cleanId = String(userId || "").trim().toLowerCase();
  if (!cleanId) {
    return { allowed: false, error: "User ID is required for deletion." };
  }
  const PROTECTED_ADMIN_IDS = ["8695716192", "adm_8695716192", "admin", "nayem"];
  if (PROTECTED_ADMIN_IDS.includes(cleanId)) {
    return {
      allowed: false,
      error: "PRIMARY_ADMIN_PROTECTED: The Primary System Administrator account (8695716192 / admin) is permanently protected from deletion."
    };
  }
  let userRecord = null;
  try {
    const users = await fetchVerifiedUsersFromSheet();
    userRecord = users.find((u) => {
      const uId = String(u.id || "").trim().toLowerCase();
      const uIdNo = String(u.idNo || u["User ID"] || "").trim().toLowerCase();
      return uId && uId === cleanId || uIdNo && uIdNo === cleanId;
    });
  } catch (err) {
    console.warn("[Validation] Could not fetch users to verify status:", err);
  }
  if (userRecord) {
    const role = String(userRecord.role || userRecord.Role || "").toLowerCase();
    const idNo = String(userRecord.idNo || userRecord["User ID"] || "").toLowerCase();
    if (PROTECTED_ADMIN_IDS.includes(idNo)) {
      return {
        allowed: false,
        error: "PRIMARY_ADMIN_PROTECTED: Primary Admin accounts cannot be deleted under any circumstances."
      };
    }
    if (role === "admin" || role === "controller") {
      const confirmAdminDelete = Boolean(
        clientPayload?.confirmAdminDelete === true || clientPayload?.confirmAdminDelete === "true" || clientPayload?.confirmDelete === true || clientPayload?.confirmDelete === "true"
      );
      if (!confirmAdminDelete) {
        return {
          allowed: false,
          error: "ADMIN_ACCOUNT_PROTECTED: Deleting an Administrator account requires explicit admin deletion confirmation."
        };
      }
    }
  }
  if (clientPayload?.confirmDelete === false || clientPayload?.confirmDelete === "false") {
    return {
      allowed: false,
      error: "MANDATORY_CONFIRMATION_REQUIRED: Accidental user deletion blocked."
    };
  }
  return { allowed: true };
}
app.all("/api/gas-proxy", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const isGet = req.method === "GET";
    const action = String(req.body?.action || req.query?.action || "").trim();
    const payload = isGet ? { ...req.query } : req.body?.payload || req.body || {};
    const method = req.body?.method || req.method || "POST";
    if (!action) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: "INVALID_REQUEST", message: "Action parameter is required" },
        requestId: `REQ-${Date.now()}`
      });
    }
    if (action === "users" || action === "getUsers") {
      const users = await fetchVerifiedUsersFromSheet();
      return res.json({
        success: true,
        users,
        data: { users },
        requestId: `REQ-${Date.now()}`
      });
    }
    if (action === "login") {
      const rawId = payload.idNo || payload.loginId || payload.userId || payload.phone;
      const rawPass = payload.password;
      const result2 = await authenticateUserCredentials(rawId, rawPass);
      return res.status(result2.status).json(result2.body);
    }
    if (action === "deleteEntry" || action === "deleteRecord" || action === "deleteDisconnectionTask") {
      const targetId = String(payload.id || payload.submissionId || payload.consumerId || payload["Consumer Id"] || payload.taskId || "").trim();
      payload.confirmCritical = true;
      payload.reason = payload.reason || "Admin deletion confirmed";
      const validation = await validateEntryDeletion(targetId, payload);
      if (!validation.allowed) {
        return res.status(403).json({
          success: false,
          isCritical: validation.isCritical,
          error: { code: "CRITICAL_RECORD_PROTECTION", message: validation.error },
          message: validation.error,
          requestId: `REQ-${Date.now()}`
        });
      }
      const cleanConsumerId = String(payload.consumerId || payload["Consumer Id"] || targetId).replace(/^(TASK-DISC-|PWR-DIS-|SUB-DISC-)/i, "").trim();
      const existingEntry = cachedEntriesState?.entries?.find(
        (e) => String(e.id || "").trim().toLowerCase() === targetId.toLowerCase() || String(e.submissionId || "").trim().toLowerCase() === targetId.toLowerCase() || cleanConsumerId && String(e.consumerId || "").trim().toLowerCase() === cleanConsumerId.toLowerCase()
      ) || localEntriesOverlayMap.get(targetId.toLowerCase()) || null;
      const resolvedPayload = {
        ...payload,
        category: payload.category || existingEntry?.category,
        submissionId: payload.submissionId || existingEntry?.submissionId || targetId
      };
      registerDeletedRecord(targetId, cleanConsumerId, resolvedPayload.submissionId);
      executeSheetDelete(targetId, cleanConsumerId, resolvedPayload).catch(() => {
      });
      return res.json({
        success: true,
        deleted: true,
        id: targetId,
        message: `Record #${targetId} deleted`,
        requestId: `REQ-${Date.now()}`
      });
    }
    const targetCategory = String(payload?.category || payload?.data?.category || "").trim().toLowerCase();
    if (targetCategory === "users") {
      if (action === "entries" || action === "getRecords" || action === "users" || action === "getUsers") {
        const users = await fetchVerifiedUsersFromSheet(Boolean(payload?.refresh || payload?.force));
        return res.json({
          success: true,
          users,
          entries: users,
          data: users,
          requestId: `REQ-${Date.now()}`
        });
      }
      if (action === "submitRecord" || action === "createEntry" || action === "updateEntry" || action === "updateRecord") {
        const rawRes = await callGoogleAppsScript(action, payload, "POST", 25e3);
        clearUsersStateCache();
        return res.json(rawRes);
      }
      if (action === "deleteEntry" || action === "deleteRecord") {
        const rawRes = await callGoogleAppsScript("deleteEntry", { ...payload, category: "Users" }, "POST", 25e3);
        clearUsersStateCache();
        return res.json(rawRes);
      }
    }
    if (action === "entries" || action === "getRecords" || action === "getMasterData") {
      const entriesList = await getFastMergedEntries(payload, Boolean(payload?.refresh || payload?.force));
      return res.json({
        success: true,
        entries: entriesList,
        data: { entries: entriesList },
        requestId: `REQ-${Date.now()}`
      });
    }
    if (action === "createEntry" || action === "submitRecord" || action === "saveEntry" || action === "createNSC" || action === "createNewConnection" || action === "createDisconnection" || action === "createPoleCase" || action === "createMeterReplacement" || action === "createDTRReplacement") {
      const entryData = payload && typeof payload.data === "object" ? payload.data : payload;
      const savedEntry = await handleFastCreateEntry(entryData, action);
      return res.json({
        success: true,
        entry: savedEntry,
        data: savedEntry,
        recordId: savedEntry.id,
        submissionId: savedEntry.submissionId,
        message: "Record saved to Google Sheets",
        requestId: `REQ-${Date.now()}`
      });
    }
    if (action === "updateEntry" || action === "updateRecord" || action === "editEntry") {
      const targetId = String(payload.id || payload.submissionId || payload?.data?.id || "").trim();
      const bodyData = payload && typeof payload.data === "object" ? payload.data : payload;
      const updatedEntry = await handleFastUpdateEntry(targetId, bodyData);
      return res.json({
        success: true,
        entry: updatedEntry,
        data: updatedEntry,
        message: `Record #${targetId} updated in Google Sheets`,
        requestId: `REQ-${Date.now()}`
      });
    }
    if (action === "deleteUser") {
      const targetId = payload.id || payload.idNo;
      const validation = await validateUserDeletion(targetId, payload);
      if (!validation.allowed) {
        return res.status(403).json({
          success: false,
          error: { code: "USER_DELETION_PROTECTED", message: validation.error },
          message: validation.error,
          requestId: `REQ-${Date.now()}`
        });
      }
      const users = await fetchVerifiedUsersFromSheet();
      const targetUser = users.find((u) => String(u.id).toLowerCase() === String(targetId).toLowerCase() || String(u.idNo).toLowerCase() === String(targetId).toLowerCase());
      const rowIdToDelete = targetUser ? targetUser.id : targetId;
      const idNoToDelete = targetUser ? targetUser.idNo : targetId;
      deletedTombstoneSet.add(String(rowIdToDelete || "").trim().toLowerCase());
      if (idNoToDelete) deletedTombstoneSet.add(`usr_${String(idNoToDelete).trim().toLowerCase()}`);
      saveTombstonesToDisk();
      clearUsersStateCache();
      callGoogleAppsScript("deleteUser", { id: rowIdToDelete, idNo: idNoToDelete, category: "Users" }, "POST").catch(() => {
      });
      callGoogleAppsScript("deleteEntry", { id: rowIdToDelete, consumerId: idNoToDelete, category: "Users" }, "POST").catch(() => {
      });
      return res.json({ success: true, deleted: true, message: `User #${targetId} deleted` });
    }
    if (action === "clearEntries" || action === "clearAllEntries" || action === "wipeDatabase") {
      const confirmToken = String(
        payload?.confirmClearAll || payload?.confirmation || payload?.data?.confirmClearAll || payload?.data?.confirmation || ""
      ).trim();
      if (confirmToken !== "CONFIRM_PERMANENT_WIPE" && confirmToken !== "CLEAR ALL") {
        return res.status(403).json({
          success: false,
          error: { code: "BULK_CLEAR_BLOCKED", message: "Bulk clearing of production database requires explicit confirmation." },
          message: "Bulk clearing of production database requires explicit confirmation.",
          requestId: `REQ-${Date.now()}`
        });
      }
      const wipeResult = await handleClearAllProductionDatabase();
      return res.json({
        success: true,
        cleared: true,
        ...wipeResult,
        requestId: `REQ-${Date.now()}`
      });
    }
    if (action === "workorders" || action === "getWorkOrders") {
      const orders = await getMergedWorkOrders(payload?.category, Boolean(payload?.refresh || payload?.force));
      return res.json({
        success: true,
        workOrders: orders,
        data: { workOrders: orders },
        requestId: `REQ-${Date.now()}`
      });
    }
    if (action === "uploadWorkOrder" || action === "createWorkOrder") {
      const rawData = payload && typeof payload.data === "object" ? payload.data : payload;
      const saved = await handleCreateWorkOrder(rawData);
      return res.json({
        success: true,
        workOrder: saved,
        data: { workOrder: saved },
        requestId: `REQ-${Date.now()}`
      });
    }
    if (action === "deleteWorkOrder") {
      const targetId = String(payload?.id || payload?.data?.id || "").trim();
      await handleDeleteWorkOrder(targetId);
      return res.json({
        success: true,
        deleted: true,
        id: targetId,
        message: "Work order deleted",
        requestId: `REQ-${Date.now()}`
      });
    }
    if (action === "toggleWorkOrder") {
      const targetId = String(payload?.id || payload?.data?.id || "").trim();
      const isHidden = Boolean(payload?.isHidden ?? payload?.data?.isHidden);
      const updated = await handleToggleWorkOrderVisibility(targetId, isHidden);
      return res.json({
        success: true,
        workOrder: updated,
        data: { workOrder: updated },
        requestId: `REQ-${Date.now()}`
      });
    }
    if (action === "stats" || action === "getStats" || action === "getDashboard" || action === "getDashboardStats") {
      const stats = await computeLiveDashboardStats();
      return res.json({
        success: true,
        stats,
        data: { stats },
        requestId: `REQ-${Date.now()}`
      });
    }
    if (action === "chat" || action === "getChat" || action === "getChatMessages") {
      const messages = await getChatMessagesList(payload?.workerId);
      return res.json({
        success: true,
        messages,
        data: { messages },
        requestId: `REQ-${Date.now()}`
      });
    }
    if (action === "sendChat" || action === "sendChatMessage") {
      const msgData = payload && typeof payload.data === "object" ? payload.data : payload;
      const savedMsg = await handleSendChatMessage(msgData);
      return res.json({
        success: true,
        message: savedMsg,
        data: { message: savedMsg },
        requestId: `REQ-${Date.now()}`
      });
    }
    if (action === "clearChat" || action === "clearChatMessages") {
      await handleClearChatMessages();
      return res.json({
        success: true,
        message: "Chat history cleared",
        requestId: `REQ-${Date.now()}`
      });
    }
    if (action === "disconnectiontasks" || action === "getDisconnectionTasks") {
      const allTasks = cachedDisconnectionState && cachedDisconnectionState.tasks.length > 0 ? mergeSheetDisconnectionTasksWithOverlay(cachedDisconnectionState.tasks) : await fetchDisconnectionTasksFromGoogleSheet();
      const workerId = String(payload?.workerId || "").toLowerCase().trim();
      const workerName = String(payload?.workerName || "").toLowerCase().trim();
      const filtered = allTasks;
      const stats = computeLocalStats(filtered, workerId, workerName);
      return res.json({
        success: true,
        tasks: filtered,
        stats,
        data: { tasks: filtered, stats },
        requestId: `REQ-${Date.now()}`
      });
    }
    if (action === "updateDisconnection" || action === "submitDisconnectionReport") {
      const cId = String(payload.consumerId || payload["Consumer Id"] || payload.id || payload.taskId || "").replace(/^(TASK-DISC-|PWR-DIS-|SUB-DISC-)/i, "").trim();
      const cIdKey = cId.toLowerCase();
      const existing = cachedDisconnectionState?.tasks?.find((t) => String(t.consumerId || t["Consumer Id"] || "").trim().toLowerCase() === cIdKey) || localDisconnectionOverlayMap.get(cIdKey) || {};
      const rawNewStatus = String(payload.disconStatus || payload["Discon Status"] || payload.taskStatus || payload.status || payload["Status"] || existing.disconStatus || "PENDING").trim().toUpperCase();
      let newNotes = String(payload.notes ?? payload["Notes"] ?? payload.workerRemarks ?? payload.workerReport ?? payload.remarks ?? payload["Remark"] ?? existing.notes ?? "").trim();
      const reqTagMatch = newNotes.match(/\[REISSUE_REQ:([^|\]]*)(?:\|([^\]]*))?\]/i);
      const hasApproveTag = /\[REISSUE_APPROVED/i.test(newNotes) || rawNewStatus === "REISSUE" || payload.reissueAction === "APPROVE" || payload.reissueApproved === true;
      const hasRejectTag = !hasApproveTag && (/\[REISSUE_REJECTED/i.test(newNotes) || payload.reissueAction === "REJECT" || payload.reissueRejected === true);
      const hasRequestTag = !hasApproveTag && !hasRejectTag && (Boolean(reqTagMatch) || payload.reissueAction === "REQUEST" || payload.reissueRequested === true);
      const newStatus = hasApproveTag ? "REISSUE" : rawNewStatus;
      const cleanBase = newNotes.replace(/\[REISSUE_REQ[^\]]*\]/gi, "").replace(/\[REISSUE_APPROVED[^\]]*\]/gi, "").replace(/\[REISSUE_REJECTED[^\]]*\]/gi, "").replace(/\s*\|\s*$/, "").trim();
      let isReissueReq = false;
      let isReissueApp = false;
      let isReissueRej = false;
      let reqByStr = String(payload.reissueRequestedBy || reqTagMatch && reqTagMatch[1] || existing.reissueRequestedBy || payload.workerName || "Worker").trim();
      let reqAtStr = String(payload.reissueRequestedAt || reqTagMatch && reqTagMatch[2] || existing.reissueRequestedAt || "").trim();
      if (cIdKey) {
        if (hasApproveTag) {
          isReissueApp = true;
          const prevReq = reissueRequestsMap.get(cIdKey);
          reqByStr = prevReq?.requestedBy || reqByStr;
          reqAtStr = prevReq?.requestedAt || reqAtStr;
          newNotes = `${cleanBase} [REISSUE_APPROVED]`.trim();
          reissueRequestsMap.set(cIdKey, {
            consumerId: cId,
            status: "APPROVED",
            requestedBy: reqByStr,
            requestedAt: reqAtStr,
            updatedAt: Date.now()
          });
          saveReissueRequestsToDisk();
        } else if (hasRejectTag) {
          isReissueRej = true;
          const prevReq = reissueRequestsMap.get(cIdKey);
          reqByStr = prevReq?.requestedBy || reqByStr;
          reqAtStr = prevReq?.requestedAt || reqAtStr;
          newNotes = `${cleanBase} [REISSUE_REJECTED]`.trim();
          reissueRequestsMap.set(cIdKey, {
            consumerId: cId,
            status: "REJECTED",
            requestedBy: reqByStr,
            requestedAt: reqAtStr,
            updatedAt: Date.now()
          });
          saveReissueRequestsToDisk();
        } else if (hasRequestTag) {
          isReissueReq = true;
          newNotes = `${cleanBase} [REISSUE_REQ:${reqByStr}|${reqAtStr}]`.trim();
          reissueRequestsMap.set(cIdKey, {
            consumerId: cId,
            status: "PENDING",
            requestedBy: reqByStr,
            requestedAt: reqAtStr,
            updatedAt: Date.now()
          });
          saveReissueRequestsToDisk();
        } else {
          newNotes = cleanBase;
          reissueRequestsMap.set(cIdKey, {
            consumerId: cId,
            status: "COMPLETED",
            requestedBy: "",
            requestedAt: "",
            updatedAt: Date.now()
          });
          saveReissueRequestsToDisk();
        }
      }
      const mergedTask = {
        ...existing,
        ...payload,
        consumerId: cId,
        "Consumer Id": cId,
        taskStatus: newStatus,
        disconStatus: newStatus,
        status: newStatus,
        "Discon Status": newStatus,
        "Status": newStatus,
        paymentStatus: newStatus === "PAID" ? "PAID" : "PENDING",
        "Payment Status": newStatus === "PAID" ? "PAID" : "PENDING",
        notes: newNotes,
        "Notes": newNotes,
        "Remark": newNotes,
        "Remarks": newNotes,
        workerRemarks: newNotes,
        workerReport: newNotes,
        reissueRequested: isReissueReq,
        reissueApproved: isReissueApp,
        reissueRejected: isReissueRej,
        reissueRequestedBy: reqByStr,
        reissueRequestedAt: reqAtStr,
        _onlyUpdateStatusAndRemark: true,
        _localUpdatedAt: Date.now(),
        _syncedToSheet: false
      };
      if (cIdKey) {
        localDisconnectionOverlayMap.set(cIdKey, mergedTask);
        saveDiscOverlayToDisk();
        if (cachedDisconnectionState && Array.isArray(cachedDisconnectionState.tasks)) {
          const idx = cachedDisconnectionState.tasks.findIndex((t) => String(t.consumerId || t["Consumer Id"] || "").trim().toLowerCase() === cIdKey);
          if (idx !== -1) cachedDisconnectionState.tasks[idx] = mergedTask;
          try {
            fs2.writeFileSync(DISC_CACHE_FILE, JSON.stringify(cachedDisconnectionState.tasks), "utf-8");
          } catch {
          }
        }
      }
      enqueueGasWrite(async () => {
        const ok = await syncSingleDisconnectionRowToSheet(mergedTask);
        if (ok && cIdKey) {
          const ov = localDisconnectionOverlayMap.get(cIdKey);
          if (ov) {
            ov._syncedToSheet = true;
            saveDiscOverlayToDisk();
          }
        }
        gasCache.clear();
        return ok;
      }).catch(() => {
      });
      return res.json({
        success: true,
        message: "Disconnection record updated and queued for Google Sheets sync",
        requestId: `REQ-${Date.now()}`
      });
    }
    if (action === "assignDisconnectionTask" || action === "archiveDisconnectionTask" || action === "restoreDisconnectionTask") {
      const cId = String(payload.consumerId || payload["Consumer Id"] || payload.taskId || payload.id || "").replace(/^(TASK-DISC-|PWR-DIS-|SUB-DISC-)/i, "").trim();
      const patch = { ...payload, consumerId: cId, "Consumer Id": cId };
      if (action === "assignDisconnectionTask") {
        patch.assignedAgency = payload.workerName || "";
        patch.Agency = payload.workerName || "";
      } else if (action === "archiveDisconnectionTask") {
        patch.disconStatus = "CANCELLED";
        patch["Discon Status"] = "CANCELLED";
      } else if (action === "restoreDisconnectionTask") {
        patch.disconStatus = "PENDING";
        patch["Discon Status"] = "PENDING";
      }
      if (cId) {
        const cIdKey = cId.toLowerCase();
        const existing = cachedDisconnectionState?.tasks?.find((t) => String(t.consumerId || t["Consumer Id"] || "").trim().toLowerCase() === cIdKey) || localDisconnectionOverlayMap.get(cIdKey) || {};
        const mergedTask = { ...existing, ...patch, _localUpdatedAt: Date.now(), _syncedToSheet: false };
        localDisconnectionOverlayMap.set(cIdKey, mergedTask);
        saveDiscOverlayToDisk();
        const ok = await enqueueGasWrite(() => syncSingleDisconnectionRowToSheet(mergedTask));
        if (ok) {
          mergedTask._syncedToSheet = true;
          saveDiscOverlayToDisk();
        }
      }
      return res.json({
        success: true,
        message: `Disconnection action ${action} completed`,
        requestId: `REQ-${Date.now()}`
      });
    }
    if (action === "getDisconnectionHistory") {
      return res.json({
        success: true,
        history: [],
        requestId: `REQ-${Date.now()}`
      });
    }
    const result = await callGoogleAppsScript(action, payload, method);
    return res.json(result);
  } catch (err) {
    console.error("GAS proxy error:", err);
    return res.status(200).json({
      success: false,
      data: null,
      error: { code: "PROXY_COMMUNICATION_ERROR", message: err.message || "Google Apps Script communication error" },
      requestId: `REQ-${Date.now()}`
    });
  }
});
var TOMBSTONES_FILE = path2.join(process.cwd(), ".deleted-tombstones.json");
var DISC_OVERLAY_FILE = path2.join(process.cwd(), ".disconnection-overlay.json");
var DISC_CACHE_FILE = path2.join(process.cwd(), ".disconnection-cache.json");
var ENTRIES_OVERLAY_FILE = path2.join(process.cwd(), ".entries-overlay.json");
var ENTRIES_CACHE_FILE = path2.join(process.cwd(), ".entries-cache.json");
var REISSUE_REQUESTS_FILE = path2.join(process.cwd(), ".reissue-requests.json");
var deletedTombstoneSet = /* @__PURE__ */ new Set();
var localDisconnectionOverlayMap = /* @__PURE__ */ new Map();
var localEntriesOverlayMap = /* @__PURE__ */ new Map();
var reissueRequestsMap = /* @__PURE__ */ new Map();
var cachedEntriesState = null;
var isRefreshingEntriesInBg = false;
var isRefreshingDiscInBg = false;
function loadDiskPersistence() {
  try {
    if (fs2.existsSync(TOMBSTONES_FILE)) {
      const arr = JSON.parse(fs2.readFileSync(TOMBSTONES_FILE, "utf-8"));
      if (Array.isArray(arr)) arr.forEach((id) => deletedTombstoneSet.add(String(id).trim().toLowerCase()));
    }
  } catch {
  }
  try {
    if (fs2.existsSync(DISC_OVERLAY_FILE)) {
      const obj = JSON.parse(fs2.readFileSync(DISC_OVERLAY_FILE, "utf-8"));
      if (obj && typeof obj === "object") {
        for (const [k, v] of Object.entries(obj)) {
          localDisconnectionOverlayMap.set(k, v);
        }
      }
    }
  } catch {
  }
  try {
    if (fs2.existsSync(REISSUE_REQUESTS_FILE)) {
      const obj = JSON.parse(fs2.readFileSync(REISSUE_REQUESTS_FILE, "utf-8"));
      if (obj && typeof obj === "object") {
        for (const [k, v] of Object.entries(obj)) {
          if (v && typeof v === "object") {
            reissueRequestsMap.set(k.toLowerCase(), v);
          }
        }
      }
    }
  } catch {
  }
  try {
    if (fs2.existsSync(ENTRIES_OVERLAY_FILE)) {
      const obj = JSON.parse(fs2.readFileSync(ENTRIES_OVERLAY_FILE, "utf-8"));
      if (obj && typeof obj === "object") {
        for (const [k, v] of Object.entries(obj)) {
          localEntriesOverlayMap.set(k, v);
        }
      }
    }
  } catch {
  }
  try {
    if (fs2.existsSync(ENTRIES_CACHE_FILE)) {
      const arr = JSON.parse(fs2.readFileSync(ENTRIES_CACHE_FILE, "utf-8"));
      if (Array.isArray(arr)) {
        const cleaned = arr.filter((e) => {
          const catUp = String(e?.category || e?.Category || "").toUpperCase().trim();
          const idUp = String(e?.id || "").toUpperCase().trim();
          return catUp !== "DISCONNECTION" && !idUp.startsWith("TASK-DISC-") && !idUp.startsWith("PWR-DIS-");
        });
        cachedEntriesState = { entries: cleaned, timestamp: Date.now() };
      }
    } else {
      cachedEntriesState = { entries: [], timestamp: Date.now() };
    }
  } catch {
    cachedEntriesState = { entries: [], timestamp: Date.now() };
  }
}
loadDiskPersistence();
function saveTombstonesToDisk() {
  try {
    fs2.writeFileSync(TOMBSTONES_FILE, JSON.stringify(Array.from(deletedTombstoneSet)), "utf-8");
  } catch {
  }
}
function saveDiscOverlayToDisk() {
  try {
    const obj = {};
    for (const [k, v] of localDisconnectionOverlayMap.entries()) {
      obj[k] = v;
    }
    fs2.writeFileSync(DISC_OVERLAY_FILE, JSON.stringify(obj), "utf-8");
  } catch {
  }
}
function saveReissueRequestsToDisk() {
  try {
    const obj = {};
    for (const [k, v] of reissueRequestsMap.entries()) {
      obj[k] = v;
    }
    fs2.writeFileSync(REISSUE_REQUESTS_FILE, JSON.stringify(obj), "utf-8");
  } catch {
  }
}
function saveEntriesOverlayToDisk() {
  try {
    const obj = {};
    for (const [k, v] of localEntriesOverlayMap.entries()) {
      obj[k] = v;
    }
    fs2.writeFileSync(ENTRIES_OVERLAY_FILE, JSON.stringify(obj), "utf-8");
  } catch {
  }
}
function isRecordDeleted(item) {
  if (!item || typeof item !== "object") return false;
  const st = String(item.status || item.disconStatus || item["Discon Status"] || item.taskStatus || "").trim().toUpperCase();
  if (st === "DELETED" || st === "[DELETED_BY_ADMIN]") return true;
  const candidates = [
    item.id,
    item.submissionId,
    item.consumerId,
    item["Consumer Id"],
    item["Consumer ID"],
    item.taskId,
    item["Record ID"],
    item["Submission ID"]
  ];
  for (const c of candidates) {
    if (c) {
      const norm = String(c).trim().toLowerCase();
      const bare = norm.replace(/^task-disc-/i, "");
      if (norm && (deletedTombstoneSet.has(norm) || bare && deletedTombstoneSet.has(bare))) {
        return true;
      }
    }
  }
  return false;
}
function registerDeletedRecord(id, consumerId, submissionId) {
  const toDelete = [id, consumerId, submissionId, consumerId ? `TASK-DISC-${consumerId}` : ""].map((v) => String(v || "").trim().toLowerCase()).filter(Boolean);
  for (const key of toDelete) {
    deletedTombstoneSet.add(key);
    const bare = key.replace(/^task-disc-/i, "");
    if (bare) deletedTombstoneSet.add(bare);
    localDisconnectionOverlayMap.delete(key);
    if (bare) localDisconnectionOverlayMap.delete(bare);
    localEntriesOverlayMap.delete(key);
    if (bare) localEntriesOverlayMap.delete(bare);
  }
  if (cachedEntriesState && Array.isArray(cachedEntriesState.entries)) {
    cachedEntriesState.entries = cachedEntriesState.entries.filter((e) => !isRecordDeleted(e));
    try {
      fs2.writeFileSync(ENTRIES_CACHE_FILE, JSON.stringify(cachedEntriesState.entries), "utf-8");
    } catch {
    }
  }
  if (cachedDisconnectionState && Array.isArray(cachedDisconnectionState.tasks)) {
    cachedDisconnectionState.tasks = cachedDisconnectionState.tasks.filter((t) => !isRecordDeleted(t));
    try {
      fs2.writeFileSync(DISC_CACHE_FILE, JSON.stringify(cachedDisconnectionState.tasks), "utf-8");
    } catch {
    }
  }
  for (const [, modCache] of moduleEntriesCacheMap.entries()) {
    if (modCache && Array.isArray(modCache.entries)) {
      modCache.entries = modCache.entries.filter((e) => !isRecordDeleted(e));
    }
  }
  saveTombstonesToDisk();
  saveDiscOverlayToDisk();
  saveEntriesOverlayToDisk();
  gasCache.clear();
}
async function executeSheetDelete(cleanId, cleanConsumerId, clientPayload = {}) {
  const isDiscCategory = String(clientPayload.category || "").toUpperCase().includes("DISCONNECT") || String(cleanId).toUpperCase().startsWith("TASK-DISC-") || String(cleanId).toUpperCase().startsWith("PWR-DIS-") || Boolean(cleanConsumerId && cleanConsumerId === cleanId && /^\d{6,12}$/.test(cleanConsumerId));
  return enqueueGasWrite(async () => {
    try {
      if (isDiscCategory) {
        const bareCId = cleanConsumerId.replace(/^(TASK-DISC-|PWR-DIS-|SUB-DISC-)/i, "").trim() || cleanId.replace(/^(TASK-DISC-|PWR-DIS-|SUB-DISC-)/i, "").trim();
        const discTargetId = bareCId ? `PWR-DIS-${bareCId}` : cleanId;
        try {
          const delRes = await callGoogleAppsScript(
            "deleteEntry",
            {
              id: discTargetId,
              submissionId: discTargetId,
              consumerId: bareCId,
              "Consumer Id": bareCId,
              taskId: bareCId ? `TASK-DISC-${bareCId}` : cleanId,
              category: "Disconnection"
            },
            "POST",
            25e3
          );
          if (delRes && delRes.success !== false && delRes.deleted) {
            gasCache.clear();
            return true;
          }
        } catch {
        }
        const nowIso = (/* @__PURE__ */ new Date()).toISOString();
        const existingTask = cachedDisconnectionState?.tasks?.find((t) => String(t.consumerId || t["Consumer Id"] || "").trim().toLowerCase() === bareCId.toLowerCase()) || localDisconnectionOverlayMap.get(bareCId.toLowerCase()) || {};
        const base33 = buildComplete33ColumnPayload({
          ...existingTask,
          consumerId: bareCId,
          "Consumer Id": bareCId,
          status: "DELETED",
          disconStatus: "DELETED",
          "Discon Status": "DELETED",
          notes: "[DELETED_BY_ADMIN]",
          "Notes": "[DELETED_BY_ADMIN]"
        });
        const delPayload = {
          ...base33,
          id: discTargetId,
          submissionId: discTargetId,
          consumerId: bareCId,
          "Consumer Id": bareCId,
          category: "Disconnection",
          status: "DELETED",
          disconStatus: "DELETED",
          "Discon Status": "DELETED",
          notes: "[DELETED_BY_ADMIN]",
          "Notes": "[DELETED_BY_ADMIN]",
          updatedAt: nowIso,
          lastUpdated: nowIso,
          "Last Updated": nowIso
        };
        const upRes = await callGoogleAppsScript("updateEntry", { ...delPayload, data: delPayload }, "POST", 25e3);
        gasCache.clear();
        return Boolean(upRes && upRes.success !== false);
      } else {
        const payload = {
          id: cleanId,
          consumerId: cleanConsumerId,
          "Consumer Id": cleanConsumerId,
          taskId: clientPayload.taskId || cleanId,
          category: clientPayload.category ? toSheetTabCategory(clientPayload.category) : void 0,
          submissionId: clientPayload.submissionId || cleanId,
          confirmCritical: true,
          reason: clientPayload.reason || "Admin deletion confirmed",
          status: clientPayload.status,
          meterNo: clientPayload.meterNo,
          sealNo: clientPayload.sealNo
        };
        const res = await callGoogleAppsScript("deleteEntry", payload, "POST", 25e3);
        gasCache.clear();
        return Boolean(res && res.success !== false);
      }
    } catch (err) {
      console.warn("[Sheet Delete] Notice:", err);
      return false;
    }
  });
}
async function handleClearAllProductionDatabase() {
  const recordsToDeleteInSheet = [];
  const seenKeys = /* @__PURE__ */ new Set();
  const collectItem = (item, fallbackCategory = "NSC") => {
    if (!item || typeof item !== "object") return;
    const id = String(item.id || item.taskId || item["Record ID"] || "").trim();
    const subId = String(item.submissionId || item["Submission ID"] || id).trim();
    const cId = String(item.consumerId || item["Consumer Id"] || item["Consumer ID"] || "").replace(/^(TASK-DISC-|PWR-DIS-|SUB-DISC-)/i, "").trim();
    const cat = String(item.category || item.Category || fallbackCategory).trim();
    if (id) deletedTombstoneSet.add(id.toLowerCase());
    if (subId) deletedTombstoneSet.add(subId.toLowerCase());
    if (cId) {
      deletedTombstoneSet.add(cId.toLowerCase());
      deletedTombstoneSet.add(`task-disc-${cId.toLowerCase()}`);
      deletedTombstoneSet.add(`pwr-dis-${cId.toLowerCase()}`);
    }
    const dedupeKey = `${cat}:${id || cId || subId}`.toLowerCase();
    if ((id || cId) && !seenKeys.has(dedupeKey)) {
      seenKeys.add(dedupeKey);
      recordsToDeleteInSheet.push({
        id: id || (cId ? `PWR-DIS-${cId}` : subId),
        consumerId: cId,
        category: cat,
        submissionId: subId
      });
    }
  };
  if (cachedEntriesState && Array.isArray(cachedEntriesState.entries)) {
    cachedEntriesState.entries.forEach((e) => collectItem(e, e?.category || "NSC"));
  }
  for (const [tab, modCache] of moduleEntriesCacheMap.entries()) {
    if (modCache && Array.isArray(modCache.entries)) {
      modCache.entries.forEach((e) => collectItem(e, tab));
    }
  }
  for (const [, ov] of localEntriesOverlayMap.entries()) {
    collectItem(ov, ov?.category || "NSC");
  }
  if (cachedDisconnectionState && Array.isArray(cachedDisconnectionState.tasks)) {
    cachedDisconnectionState.tasks.forEach((t) => collectItem(t, "Disconnection"));
  }
  for (const [, ov] of localDisconnectionOverlayMap.entries()) {
    collectItem(ov, "Disconnection");
  }
  cachedEntriesState = { entries: [], timestamp: Date.now() };
  moduleEntriesCacheMap.clear();
  for (const tab of ISOLATED_FIELD_MODULES) {
    moduleEntriesCacheMap.set(tab, { entries: [], timestamp: Date.now() });
  }
  localEntriesOverlayMap.clear();
  cachedDisconnectionState = { tasks: [], timestamp: Date.now() };
  localDisconnectionOverlayMap.clear();
  gasCache.clear();
  saveTombstonesToDisk();
  saveDiscOverlayToDisk();
  saveEntriesOverlayToDisk();
  try {
    fs2.writeFileSync(ENTRIES_CACHE_FILE, JSON.stringify([]), "utf-8");
  } catch {
  }
  try {
    fs2.writeFileSync(DISC_CACHE_FILE, JSON.stringify([]), "utf-8");
  } catch {
  }
  enqueueGasWrite(async () => {
    try {
      const bulkRes = await callGoogleAppsScript("clearEntries", { confirmClearAll: "CONFIRM_PERMANENT_WIPE" }, "POST", 25e3).catch(() => null);
      if (bulkRes && bulkRes.success === true) {
        return;
      }
    } catch {
    }
    for (const rec of recordsToDeleteInSheet) {
      try {
        await callGoogleAppsScript(
          "deleteEntry",
          {
            id: rec.id,
            submissionId: rec.submissionId || rec.id,
            consumerId: rec.consumerId,
            "Consumer Id": rec.consumerId,
            category: toSheetTabCategory(rec.category)
          },
          "POST",
          15e3
        ).catch(() => {
        });
      } catch {
      }
    }
  }).catch(() => {
  });
  return {
    message: "All recorded production data cleared successfully",
    clearedCount: recordsToDeleteInSheet.length
  };
}
var ISOLATED_FIELD_MODULES = ["NSC", "Broken", "Meter Replacement", "DTR Replacement"];
var moduleEntriesCacheMap = /* @__PURE__ */ new Map();
function buildNscSheetPayloadFields(payload) {
  const nscMeta = {
    applicationNo: String(payload.applicationNo || payload["Application No"] || "").trim(),
    fatherName: String(payload.fatherName || payload["Father Name"] || "").trim(),
    agencyName: String(payload.agencyName || payload["Agency Name"] || "").trim(),
    cccName: String(payload.cccName || payload["CCC Name"] || (payload.substation !== "5233100" ? payload.substation : "") || "").trim(),
    sealNo: String(payload.sealNo || payload["Meter Seal No"] || payload["Seal No"] || "").trim(),
    meterMake: String(payload.meterMake || payload["Meter Make"] || "").trim(),
    meterInstallDate: String(payload.meterInstallDate || payload["Meter Install Date"] || "").trim(),
    inspectionAgencyName: String(payload.inspectionAgencyName || payload["Inspection Agency Name"] || "").trim(),
    appliedLoad: String(payload.appliedLoad || payload["Applied Load"] || "").trim(),
    phase: String(payload.phase || payload["Supply Phase"] || "").trim(),
    tariffCategory: String(payload.tariffCategory || payload["Tariff Category"] || "").trim(),
    serviceCableLength: String(payload.serviceCableLength || payload["Service Cable Length"] || "").trim(),
    earthResistance: String(payload.earthResistance || payload["Earth Resistance"] || "").trim(),
    workOrderNo: String(payload.workOrderNo || payload["Work Order No"] || "").trim(),
    workOrderDate: String(payload.workOrderDate || payload["Work Order Date"] || "").trim(),
    workOrderNoticeId: String(payload.workOrderNoticeId || "").trim(),
    workOrderNoticeTitle: String(payload.workOrderNoticeTitle || "").trim(),
    workOrderNoticeDate: String(payload.workOrderNoticeDate || "").trim(),
    workOrderPhoto: String(payload.workOrderPhoto || "").trim(),
    notes: String(payload.notes || payload.remarks || "").trim(),
    locationGps: String(payload.locationGps || "").trim(),
    role: String(payload.role || "worker").trim(),
    submittedBy: String(payload.submittedBy || payload.workerName || "").trim(),
    createdAt: String(payload.createdAt || payload.date || (/* @__PURE__ */ new Date()).toISOString()).trim(),
    updatedAt: String(payload.updatedAt || (/* @__PURE__ */ new Date()).toISOString()).trim()
  };
  const descParts = [
    nscMeta.applicationNo ? `App No: ${nscMeta.applicationNo}` : "",
    nscMeta.fatherName ? `Father: ${nscMeta.fatherName}` : "",
    nscMeta.agencyName ? `Agency: ${nscMeta.agencyName}` : "",
    nscMeta.cccName ? `CCC: ${nscMeta.cccName}` : "",
    nscMeta.sealNo ? `Seal: ${nscMeta.sealNo}` : "",
    nscMeta.meterMake ? `Make: ${nscMeta.meterMake}` : "",
    nscMeta.meterInstallDate ? `Install Date: ${nscMeta.meterInstallDate}` : "",
    nscMeta.inspectionAgencyName ? `Inspection: ${nscMeta.inspectionAgencyName}` : "",
    nscMeta.appliedLoad ? `Load: ${nscMeta.appliedLoad}` : "",
    nscMeta.phase ? `Phase: ${nscMeta.phase}` : "",
    nscMeta.tariffCategory ? `Tariff: ${nscMeta.tariffCategory}` : "",
    nscMeta.workOrderNo ? `WO: ${nscMeta.workOrderNo}` : ""
  ].filter(Boolean).join(" | ");
  const initReadingVal = String(payload.initialReading || payload.reading || payload["Reading"] || "000000").trim();
  return {
    ...nscMeta,
    time: String(payload.time || (/* @__PURE__ */ new Date()).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })).trim(),
    reading: initReadingVal,
    Reading: initReadingVal,
    initialReading: initReadingVal,
    substation: nscMeta.cccName || String(payload.substation || "").trim(),
    feederName: `NSC_META::${JSON.stringify(nscMeta)}`,
    problemType: "New Service Connection (NSC)",
    workDescription: descParts,
    remarks: nscMeta.notes
  };
}
async function fetchIsolatedModuleEntriesFromSheet(sheetTabName, forceRefresh = false) {
  const canonicalTab = toSheetTabCategory(sheetTabName);
  const expectedFrontendCat = toFrontendCategory(canonicalTab);
  const cached = moduleEntriesCacheMap.get(canonicalTab);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < 3e4) {
    return mergeEntriesWithOverlay(cached.entries).filter((e) => e.category === expectedFrontendCat);
  }
  if (forceRefresh) {
    gasCache.clear();
  }
  const result = await callGoogleAppsScript("entries", { category: canonicalTab }, "GET", 25e3);
  if (!result || result.success === false) {
    if (cached) {
      return mergeEntriesWithOverlay(cached.entries).filter((e) => e.category === expectedFrontendCat);
    }
    if (cachedEntriesState && Array.isArray(cachedEntriesState.entries)) {
      return mergeEntriesWithOverlay(cachedEntriesState.entries).filter((e) => e.category === expectedFrontendCat);
    }
    throw new Error(result?.error?.message || result?.error || `Failed to read ${canonicalTab} tab from Google Sheets`);
  }
  const rawEntries = extractEntriesArray(result).filter((r) => {
    if (!r || typeof r !== "object") return false;
    const rawCat = String(r.category || r["Category"] || "").trim();
    if (rawCat && toSheetTabCategory(rawCat) !== canonicalTab) return false;
    const idStr = String(r.id || r["Record ID"] || r.taskId || "").toUpperCase().trim();
    if (canonicalTab !== "Disconnection" && (idStr.startsWith("TASK-DISC-") || idStr.startsWith("PWR-DIS-"))) {
      return false;
    }
    return true;
  }).map((r) => ({
    ...r,
    category: expectedFrontendCat
  }));
  const merged = mergeEntriesWithOverlay(rawEntries).filter((e) => e.category === expectedFrontendCat);
  moduleEntriesCacheMap.set(canonicalTab, { entries: merged, timestamp: Date.now() });
  return merged;
}
function findExistingUniqueModuleRecord(existingList, candidate, canonicalTab) {
  const candId = String(candidate.id || "").trim().toLowerCase();
  const candSubId = String(candidate.submissionId || "").trim().toLowerCase();
  const candCId = String(candidate.consumerId || candidate["Consumer ID"] || candidate["Consumer Id"] || "").trim().toLowerCase();
  const candAppNo = String(candidate.applicationNo || candidate["Application No"] || "").trim().toLowerCase();
  const candOldMeter = String(candidate.oldMeterNo || candidate["Old Meter No"] || "").trim().toLowerCase();
  const candNewMeter = String(candidate.newMeterNo || candidate["New Meter No"] || "").trim().toLowerCase();
  const candDtrName = String(candidate.dtrName || candidate["DTR Name"] || "").trim().toLowerCase();
  const candOldDtr = String(candidate.oldDtrSerial || candidate["Old DTR Serial"] || "").trim().toLowerCase();
  const candNewDtr = String(candidate.newDtrSerial || candidate["New DTR Serial"] || "").trim().toLowerCase();
  for (const item of existingList) {
    if (!item || isRecordDeleted(item)) continue;
    const itemId = String(item.id || "").trim().toLowerCase();
    const itemSubId = String(item.submissionId || "").trim().toLowerCase();
    if (candId && (itemId === candId || itemSubId === candId)) return item;
    if (candSubId && (itemSubId === candSubId || itemId === candSubId)) return item;
    if (canonicalTab === "NSC") {
      const itemCId = String(item.consumerId || item["Consumer ID"] || "").trim().toLowerCase();
      const itemAppNo = String(item.applicationNo || item["Application No"] || "").trim().toLowerCase();
      if (candCId && itemCId && candCId === itemCId) return item;
      if (candAppNo && itemAppNo && candAppNo === itemAppNo) return item;
    } else if (canonicalTab === "Meter Replacement") {
      const itemCId = String(item.consumerId || item["Consumer ID"] || "").trim().toLowerCase();
      const itemOldMeter = String(item.oldMeterNo || item["Old Meter No"] || "").trim().toLowerCase();
      const itemNewMeter = String(item.newMeterNo || item["New Meter No"] || "").trim().toLowerCase();
      if (candCId && itemCId && candCId === itemCId) return item;
      if (candOldMeter && itemOldMeter && candOldMeter === itemOldMeter) return item;
      if (candNewMeter && itemNewMeter && candNewMeter === itemNewMeter) return item;
    } else if (canonicalTab === "DTR Replacement") {
      const itemDtrName = String(item.dtrName || item["DTR Name"] || "").trim().toLowerCase();
      const itemOldDtr = String(item.oldDtrSerial || item["Old DTR Serial"] || "").trim().toLowerCase();
      const itemNewDtr = String(item.newDtrSerial || item["New DTR Serial"] || "").trim().toLowerCase();
      if (candOldDtr && itemOldDtr && candOldDtr === itemOldDtr) return item;
      if (candNewDtr && itemNewDtr && candNewDtr === itemNewDtr) return item;
      if (candDtrName && itemDtrName && candDtrName === itemDtrName && candOldDtr === itemOldDtr) return item;
    }
  }
  return null;
}
async function handleFastCreateEntry(rawPayload, actionName = "createEntry") {
  const payload = { ...rawPayload || {} };
  if (!payload.category) {
    if (actionName === "createNSC" || actionName === "createNewConnection") payload.category = "NSC";
    else if (actionName === "createDisconnection") payload.category = "DISCONNECTION";
    else if (actionName === "createPoleCase") payload.category = "POLE CASE";
    else if (actionName === "createMeterReplacement") payload.category = "METER REPLESMENT";
    else if (actionName === "createDTRReplacement") payload.category = "DTR REPLESMENT";
    else payload.category = "NSC";
  }
  const canonicalTab = toSheetTabCategory(payload.category);
  const frontendCat = toFrontendCategory(payload.category);
  let existingMatch = null;
  if (canonicalTab === "Disconnection") {
    const tasks = cachedDisconnectionState?.tasks || Array.from(localDisconnectionOverlayMap.values());
    const cId = String(payload.consumerId || payload["Consumer Id"] || payload.id || "").replace(/^TASK-DISC-/i, "").trim().toLowerCase();
    if (cId) {
      existingMatch = tasks.find((t) => String(t.consumerId || t["Consumer Id"] || "").trim().toLowerCase() === cId) || localDisconnectionOverlayMap.get(cId);
    }
  } else {
    const moduleList = moduleEntriesCacheMap.get(canonicalTab)?.entries || (cachedEntriesState?.entries || []).filter((e) => toSheetTabCategory(e.category) === canonicalTab);
    existingMatch = findExistingUniqueModuleRecord(moduleList, payload, canonicalTab);
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  payload.id = String(existingMatch?.id || payload.id || `PWR-${Date.now().toString().slice(-6)}`).trim();
  payload.submissionId = String(existingMatch?.submissionId || payload.submissionId || payload.id).trim();
  payload.createdAt = existingMatch?.createdAt || payload.createdAt || nowIso;
  payload.updatedAt = nowIso;
  payload.date = payload.date || existingMatch?.date || nowIso;
  deletedTombstoneSet.delete(payload.id.toLowerCase());
  deletedTombstoneSet.delete(payload.submissionId.toLowerCase());
  if (payload.consumerId) {
    const cKey = String(payload.consumerId).trim().toLowerCase();
    deletedTombstoneSet.delete(cKey);
    deletedTombstoneSet.delete(`task-disc-${cKey}`);
    deletedTombstoneSet.delete(`pwr-dis-${cKey}`);
  }
  saveTombstonesToDisk();
  const mergedBase = {
    ...existingMatch || {},
    ...payload
  };
  const nscSpecific = canonicalTab === "NSC" ? buildNscSheetPayloadFields(mergedBase) : {};
  const sheetPayload = {
    ...mergedBase,
    ...nscSpecific,
    category: canonicalTab,
    Category: canonicalTab
  };
  const normalized = normalizeServerEntry({ ...sheetPayload, category: frontendCat });
  const overlayKey = normalized.id.toLowerCase();
  localEntriesOverlayMap.set(overlayKey, { ...normalized, _localUpdatedAt: Date.now(), _syncedToSheet: false });
  saveEntriesOverlayToDisk();
  const modCached = moduleEntriesCacheMap.get(canonicalTab);
  if (modCached && Array.isArray(modCached.entries)) {
    modCached.entries = [
      normalized,
      ...modCached.entries.filter((e) => e.id !== normalized.id && e.submissionId !== normalized.submissionId)
    ];
    modCached.timestamp = Date.now();
  } else {
    moduleEntriesCacheMap.set(canonicalTab, { entries: [normalized], timestamp: Date.now() });
  }
  if (cachedEntriesState && Array.isArray(cachedEntriesState.entries)) {
    cachedEntriesState.entries = [
      normalized,
      ...cachedEntriesState.entries.filter((e) => e.id !== normalized.id && e.submissionId !== normalized.submissionId)
    ];
    cachedEntriesState.timestamp = Date.now();
    try {
      fs2.writeFileSync(ENTRIES_CACHE_FILE, JSON.stringify(cachedEntriesState.entries), "utf-8");
    } catch {
    }
  } else {
    cachedEntriesState = { entries: [normalized], timestamp: Date.now() };
    try {
      fs2.writeFileSync(ENTRIES_CACHE_FILE, JSON.stringify(cachedEntriesState.entries), "utf-8");
    } catch {
    }
  }
  const isUpdatingExisting = Boolean(existingMatch);
  enqueueGasWrite(async () => {
    try {
      let gasRes;
      if (canonicalTab === "Disconnection") {
        const ok = await syncSingleDisconnectionRowToSheet({ ...sheetPayload, _isNewInsert: false });
        gasRes = { success: ok };
      } else if (isUpdatingExisting) {
        gasRes = await callGoogleAppsScript(
          "updateEntry",
          { id: payload.id, submissionId: payload.submissionId, category: canonicalTab, ...sheetPayload, data: sheetPayload },
          "POST",
          25e3
        );
      } else {
        gasRes = await callGoogleAppsScript(
          "createEntry",
          { id: payload.id, submissionId: payload.submissionId, category: canonicalTab, ...sheetPayload, data: sheetPayload },
          "POST",
          25e3
        );
      }
      if (gasRes && gasRes.success !== false) {
        const ov = localEntriesOverlayMap.get(overlayKey);
        if (ov) {
          ov._syncedToSheet = true;
          saveEntriesOverlayToDisk();
        }
      }
    } catch (err) {
      console.warn(`[Entries Background Sync] create/update notice for ${payload.id}:`, err);
    } finally {
      gasCache.clear();
    }
  }).catch(() => {
  });
  gasCache.clear();
  return normalized;
}
async function handleFastUpdateEntry(cleanId, bodyData) {
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const key = cleanId.toLowerCase();
  const bareCId = String(
    bodyData?.consumerId || bodyData?.["Consumer Id"] || cleanId
  ).replace(/^(PWR-DIS-|TASK-DISC-|SUB-DISC-)/i, "").trim();
  const bareKey = bareCId.toLowerCase();
  const existingInDiscCache = bareKey ? cachedDisconnectionState?.tasks?.find(
    (t) => String(t.consumerId || t["Consumer Id"] || "").trim().toLowerCase() === bareKey
  ) || localDisconnectionOverlayMap.get(bareKey) || {} : {};
  const existingInCache = cachedEntriesState?.entries?.find(
    (e) => String(e.id || "").toLowerCase() === key || String(e.submissionId || "").toLowerCase() === key || bareKey && String(e.consumerId || e["Consumer Id"] || "").trim().toLowerCase() === bareKey
  ) || {};
  const existingOverlay = localEntriesOverlayMap.get(key) || (bareKey ? localEntriesOverlayMap.get(bareKey) : {}) || {};
  const isDisc = String(bodyData?.category || existingInDiscCache?.category || existingInCache?.category || "").toUpperCase().includes("DISCONNECT") || /^PWR-DIS-|^TASK-DISC-/i.test(cleanId) || Boolean(bareKey && cachedDisconnectionState?.tasks?.some((t) => String(t.consumerId || t["Consumer Id"] || "").trim().toLowerCase() === bareKey));
  if (isDisc && bareCId) {
    const exactSheetRow = cachedDisconnectionState?.tasks?.find(
      (t) => String(t.consumerId || t["Consumer Id"] || "").trim().toLowerCase() === bareKey
    ) || localDisconnectionOverlayMap.get(bareKey) || existingInDiscCache || {};
    const remarksVal = String(
      bodyData?.notes ?? bodyData?.["Notes"] ?? bodyData?.workerRemarks ?? bodyData?.remarks ?? bodyData?.["Remark"] ?? exactSheetRow.notes ?? exactSheetRow["Notes"] ?? ""
    ).trim();
    const statusVal = String(
      bodyData?.disconStatus ?? bodyData?.["Discon Status"] ?? bodyData?.taskStatus ?? bodyData?.status ?? bodyData?.["Status"] ?? exactSheetRow.disconStatus ?? exactSheetRow["Discon Status"] ?? "PENDING"
    ).trim().toUpperCase();
    const updatedDiscTask = {
      ...exactSheetRow,
      ...bodyData,
      consumerId: bareCId,
      "Consumer Id": bareCId,
      consumerName: exactSheetRow.consumerName || exactSheetRow["Name"] || bodyData?.consumerName || bodyData?.["Name"] || `Consumer ${bareCId}`,
      "Name": exactSheetRow["Name"] || exactSheetRow.consumerName || bodyData?.["Name"] || bodyData?.consumerName || `Consumer ${bareCId}`,
      taskStatus: statusVal,
      disconStatus: statusVal,
      status: statusVal,
      "Discon Status": statusVal,
      "Status": statusVal,
      paymentStatus: statusVal === "PAID" ? "PAID" : "PENDING",
      "Payment Status": statusVal === "PAID" ? "PAID" : "PENDING",
      workerRemarks: remarksVal,
      workerReport: remarksVal,
      notes: remarksVal,
      "Notes": remarksVal,
      "Remark": remarksVal,
      "Remarks": remarksVal,
      _onlyUpdateStatusAndRemark: true,
      _localUpdatedAt: Date.now(),
      _hasUserRemarkUpdate: true,
      _syncedToSheet: false
    };
    if (isValidDisconnectionConsumerRow(updatedDiscTask)) {
      localDisconnectionOverlayMap.set(bareKey, updatedDiscTask);
      saveDiscOverlayToDisk();
      if (cachedDisconnectionState && Array.isArray(cachedDisconnectionState.tasks)) {
        const dIdx = cachedDisconnectionState.tasks.findIndex(
          (t) => String(t.consumerId || t["Consumer Id"] || "").trim().toLowerCase() === bareKey
        );
        if (dIdx !== -1) {
          cachedDisconnectionState.tasks[dIdx] = updatedDiscTask;
        } else {
          cachedDisconnectionState.tasks.push(updatedDiscTask);
        }
        try {
          fs2.writeFileSync(DISC_CACHE_FILE, JSON.stringify(cachedDisconnectionState.tasks), "utf-8");
        } catch {
        }
      }
    }
    enqueueGasWrite(async () => {
      const ok = await syncSingleDisconnectionRowToSheet(updatedDiscTask);
      if (ok && bareKey) {
        const ov = localDisconnectionOverlayMap.get(bareKey);
        if (ov) {
          ov._syncedToSheet = true;
          saveDiscOverlayToDisk();
        }
      }
      gasCache.clear();
      return ok;
    }).catch(() => {
    });
    gasCache.clear();
    return updatedDiscTask;
  }
  const merged = normalizeServerEntry({
    ...existingInDiscCache,
    ...existingInCache,
    ...existingOverlay,
    ...bodyData,
    id: cleanId,
    updatedAt: nowIso
  });
  const canonicalTab = toSheetTabCategory(bodyData?.category || merged.category || "NSC");
  const targetSheetId = cleanId;
  const submissionId = bodyData?.submissionId || merged.submissionId || targetSheetId;
  const nscUpdateFields = canonicalTab === "NSC" ? buildNscSheetPayloadFields({ ...merged, ...bodyData }) : {};
  const payload = {
    ...merged,
    ...bodyData,
    ...nscUpdateFields,
    id: cleanId,
    category: canonicalTab,
    Category: canonicalTab,
    submissionId
  };
  localEntriesOverlayMap.set(key, { ...merged, _localUpdatedAt: Date.now(), _syncedToSheet: false });
  saveEntriesOverlayToDisk();
  const modCached = moduleEntriesCacheMap.get(canonicalTab);
  if (modCached && Array.isArray(modCached.entries)) {
    const mIdx = modCached.entries.findIndex(
      (e) => String(e.id || "").toLowerCase() === key || String(e.submissionId || "").toLowerCase() === key
    );
    if (mIdx !== -1) {
      modCached.entries[mIdx] = { ...modCached.entries[mIdx], ...merged };
    } else {
      modCached.entries.unshift(merged);
    }
    modCached.timestamp = Date.now();
  }
  if (cachedEntriesState && Array.isArray(cachedEntriesState.entries)) {
    const idx = cachedEntriesState.entries.findIndex(
      (e) => String(e.id || "").toLowerCase() === key || String(e.submissionId || "").toLowerCase() === key || isDisc && bareKey && String(e.consumerId || e["Consumer Id"] || "").trim().toLowerCase() === bareKey
    );
    if (idx !== -1) {
      cachedEntriesState.entries[idx] = { ...cachedEntriesState.entries[idx], ...merged };
    } else if (!isDisc || isValidDisconnectionConsumerRow(merged)) {
      cachedEntriesState.entries.unshift(merged);
    }
    try {
      fs2.writeFileSync(ENTRIES_CACHE_FILE, JSON.stringify(cachedEntriesState.entries), "utf-8");
    } catch {
    }
  }
  enqueueGasWrite(async () => {
    try {
      const upRes = await callGoogleAppsScript("updateEntry", { ...payload, data: payload }, "POST", 25e3);
      if (upRes && upRes.success !== false) {
        const ov = localEntriesOverlayMap.get(key);
        if (ov) {
          ov._syncedToSheet = true;
          saveEntriesOverlayToDisk();
        }
      }
    } catch (err) {
      console.warn(`[Entries Background Sync] updateEntry notice for ${cleanId}:`, err);
    } finally {
      gasCache.clear();
    }
  }).catch(() => {
  });
  gasCache.clear();
  return merged;
}
function isNonFieldEntryCategory(catUpper) {
  return catUpper === "USERS" || catUpper === "USERS_AUTH" || catUpper === "WORKORDERS_KHATA" || catUpper === "WORK ORDERS" || catUpper === "CHAT" || catUpper === "CHAT_MESSAGES" || catUpper === "SETTINGS" || catUpper === "SYSTEM LOGS" || catUpper === "SYSTEM_LOGS" || catUpper === "DISCONNECTION_HISTORY" || catUpper === "DISCONNECTION HISTORY" || catUpper === "CALL CASE" || catUpper === "CALL_CASE";
}
function mergeEntriesWithOverlay(sheetEntries) {
  const filteredSheet = sheetEntries.map(normalizeServerEntry).filter((e) => {
    if (!e || isRecordDeleted(e)) return false;
    const catUpper = String(e.category || "").toUpperCase().trim();
    const idUpper = String(e.id || "").toUpperCase().trim();
    if (isNonFieldEntryCategory(catUpper) || catUpper === "DISCONNECTION" || idUpper.startsWith("TASK-DISC-") || idUpper.startsWith("PWR-DIS-")) {
      return false;
    }
    return true;
  });
  const resultMap = /* @__PURE__ */ new Map();
  for (const e of filteredSheet) {
    const k = String(e.id || e.submissionId || e.consumerId || "").trim().toLowerCase();
    if (k) resultMap.set(k, e);
  }
  const now = Date.now();
  for (const [k, ov] of localEntriesOverlayMap.entries()) {
    if (isRecordDeleted(ov)) continue;
    const ovCatUpper = String(ov?.category || "").toUpperCase().trim();
    const ovIdUpper = String(ov?.id || "").toUpperCase().trim();
    if (isNonFieldEntryCategory(ovCatUpper) || ovCatUpper === "DISCONNECTION" || ovIdUpper.startsWith("TASK-DISC-") || ovIdUpper.startsWith("PWR-DIS-")) {
      continue;
    }
    const existing = resultMap.get(k);
    const isRecent = !ov._localUpdatedAt || now - Number(ov._localUpdatedAt) < 864e5;
    if (existing) {
      if (!ov._syncedToSheet || isRecent) {
        resultMap.set(k, normalizeServerEntry({ ...existing, ...ov }));
      }
    } else if (!ov._syncedToSheet || isRecent) {
      resultMap.set(k, normalizeServerEntry(ov));
    }
  }
  return Array.from(resultMap.values());
}
async function refreshEntriesFromSheetInBackground() {
  if (isRefreshingEntriesInBg || activeGasWriteCount > 0) return;
  isRefreshingEntriesInBg = true;
  try {
    const allModuleLists = [];
    for (const tab of ISOLATED_FIELD_MODULES) {
      if (activeGasWriteCount > 0) break;
      try {
        const list = await fetchIsolatedModuleEntriesFromSheet(tab, true);
        allModuleLists.push(list);
      } catch {
        allModuleLists.push(moduleEntriesCacheMap.get(tab)?.entries || []);
      }
    }
    const combined = mergeEntriesWithOverlay(allModuleLists.flat());
    cachedEntriesState = { entries: combined, timestamp: Date.now() };
    try {
      fs2.writeFileSync(ENTRIES_CACHE_FILE, JSON.stringify(combined), "utf-8");
    } catch {
    }
  } catch (err) {
    console.warn("[Background Entries Sync] Notice:", err);
  } finally {
    isRefreshingEntriesInBg = false;
  }
}
var officeSpreadsheetCacheMap = /* @__PURE__ */ new Map();
function getTargetSpreadsheetId(req) {
  const headerId = req.headers["x-spreadsheet-id"] || "";
  const queryId = req.query.spreadsheetId || "";
  const bodyId = req.body?.spreadsheetId || "";
  let candidate = (headerId || queryId || bodyId || "").trim();
  if (candidate.includes("/spreadsheets/d/")) {
    const match = candidate.match(/\/spreadsheets\/d\/([a-zA-Z0-9_\-]+)/i);
    if (match && match[1]) candidate = match[1].trim();
  }
  const officeId = (req.headers["x-office-id"] || req.query.officeId || req.body?.officeId || "").trim();
  if (officeId) {
    const offices = readRegisteredOfficesCache();
    const found = offices.find((o) => o.id === officeId || o.adminUserId.toLowerCase() === officeId.toLowerCase());
    if (found && found.verifiedSpreadsheetId) {
      return found.verifiedSpreadsheetId;
    }
  }
  if (candidate && candidate.length > 15 && candidate !== GOOGLE_SHEET_ID && candidate !== DEDICATED_REGISTRY_SPREADSHEET_ID) {
    return candidate;
  }
  return null;
}
async function fetchOfficeSpreadsheetData(officeSpreadsheetId, forceRefresh = false) {
  const cached = officeSpreadsheetCacheMap.get(officeSpreadsheetId);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < 3e4) {
    return cached;
  }
  const creds = getServiceAccountCredentials();
  if (!creds) {
    let tasks = [];
    let entries = [];
    try {
      const gasDisc = await callGoogleAppsScript("getDisconnectionTasks", { spreadsheetId: officeSpreadsheetId }, "GET", 15e3);
      const rawTasks = Array.isArray(gasDisc?.tasks) ? gasDisc.tasks : Array.isArray(gasDisc?.data) ? gasDisc.data : [];
      if (rawTasks.length > 0) {
        tasks = rawTasks.filter(isValidDisconnectionConsumerRow).map((t, idx) => convertSheetEntryToDisconnectionTask(t, idx + 1));
      }
    } catch {
    }
    try {
      const gasEntries = await callGoogleAppsScript("entries", { spreadsheetId: officeSpreadsheetId }, "GET", 15e3);
      const rawEntries = Array.isArray(gasEntries?.entries) ? gasEntries.entries : Array.isArray(gasEntries?.data) ? gasEntries.data : [];
      if (rawEntries.length > 0) {
        entries = rawEntries.map(normalizeServerEntry);
      }
    } catch {
    }
    const gasResult = {
      tasks,
      entries,
      workOrders: [],
      sheetNames: [],
      spreadsheetId: officeSpreadsheetId,
      timestamp: Date.now()
    };
    if (tasks.length > 0 || entries.length > 0) {
      officeSpreadsheetCacheMap.set(officeSpreadsheetId, gasResult);
    }
    return gasResult;
  }
  try {
    const token = await getGoogleSheetsAccessToken(creds);
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${officeSpreadsheetId}?fields=sheets.properties`, {
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    });
    if (!metaRes.ok) {
      return cached || { tasks: [], entries: [], workOrders: [], sheetNames: [], spreadsheetId: officeSpreadsheetId, timestamp: Date.now() };
    }
    const metaData = await metaRes.json();
    const sheets = metaData.sheets || [];
    const sheetNames = sheets.map((s) => s.properties?.title || "").filter(Boolean);
    let tasks = [];
    let entries = [];
    let workOrders = [];
    const discSheet = sheets.find((s) => {
      const t = String(s.properties?.title || "").toUpperCase().trim();
      return t === "DISCONNECTION" || t.includes("DISCON") || t === "TASKS";
    });
    if (discSheet) {
      const title = discSheet.properties.title;
      const range = encodeURIComponent(`'${title}'!A1:ZZ`);
      const valRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${officeSpreadsheetId}/values/${range}`, {
        headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
      });
      if (valRes.ok) {
        const valData = await valRes.json();
        const rows = valData.values || [];
        if (rows.length > 1) {
          const headers = rows[0].map((h) => String(h || "").trim());
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0 || !row[0]) continue;
            const obj = {};
            for (let c = 0; c < headers.length; c++) {
              const h = headers[c];
              if (h) obj[h] = row[c] !== void 0 ? row[c] : "";
            }
            const consumerId = String(obj["Consumer Id"] || obj.consumerId || obj.consumer_id || obj["Consumer ID"] || row[2] || row[0] || "").trim();
            if (!consumerId) continue;
            const converted = convertSheetEntryToDisconnectionTask({
              ...obj,
              id: obj.id || `DISC-${consumerId}`,
              consumerId,
              consumerName: String(obj["Name"] || obj.consumerName || row[3] || "").trim(),
              address: String(obj["Address"] || obj.address || row[4] || "").trim(),
              disconStatus: String(obj["Discon Status"] || obj.status || row[14] || "Pending").trim(),
              arrearAmount: String(obj["D2 Net O/S"] || obj.arrearAmount || row[9] || "0").trim(),
              mobileNumber: String(obj["Mobile Number"] || obj.mobile || row[10] || "").trim(),
              agency: String(obj["Agency"] || row[11] || "").trim(),
              meterNo: String(obj["Device"] || obj["Meter"] || row[7] || "").trim(),
              substation: String(obj["off_code"] || row[0] || "").trim(),
              feederName: String(obj["MRU"] || row[1] || "").trim(),
              disconDate: String(obj["Discon Date"] || row[15] || "").trim(),
              reading: String(obj["Reading"] || row[17] || "").trim(),
              paymentStatus: String(obj["Payment Status"] || row[18] || "").trim(),
              notes: String(obj["Notes"] || row[21] || "").trim(),
              officeSpreadsheetId
            }, i);
            tasks.push(converted);
          }
        }
      }
    }
    const entriesSheet = sheets.find((s) => {
      const t = String(s.properties?.title || "").toUpperCase().trim();
      return t === "ENTRIES" || t === "NSC" || t === "SUBMISSIONS";
    });
    if (entriesSheet) {
      const title = entriesSheet.properties.title;
      const range = encodeURIComponent(`'${title}'!A1:ZZ`);
      const valRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${officeSpreadsheetId}/values/${range}`, {
        headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
      });
      if (valRes.ok) {
        const valData = await valRes.json();
        const rows = valData.values || [];
        if (rows.length > 1) {
          const headers = rows[0].map((h) => String(h || "").trim());
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0 || !row[0]) continue;
            const obj = {};
            for (let c = 0; c < headers.length; c++) {
              const h = headers[c];
              if (h) obj[h] = row[c] !== void 0 ? row[c] : "";
            }
            entries.push(normalizeServerEntry(obj));
          }
        }
      }
    }
    const result = {
      tasks,
      entries,
      workOrders,
      sheetNames,
      spreadsheetId: officeSpreadsheetId,
      timestamp: Date.now()
    };
    officeSpreadsheetCacheMap.set(officeSpreadsheetId, result);
    return result;
  } catch (err) {
    console.warn("[OfficeSpreadsheetData] Fetch notice:", err?.message || err);
    return cached || { tasks: [], entries: [], workOrders: [], sheetNames: [], spreadsheetId: officeSpreadsheetId, timestamp: Date.now() };
  }
}
async function getFastMergedEntries(query = {}, forceRefresh = false) {
  if (query?.category && String(query.category).toUpperCase().trim() !== "ALL") {
    const canonicalTab = toSheetTabCategory(query.category);
    if (canonicalTab === "Disconnection") {
      if (cachedDisconnectionState && Array.isArray(cachedDisconnectionState.tasks) && cachedDisconnectionState.tasks.length > 0) {
        if (forceRefresh) refreshDisconnectionFromSheetInBackground();
        return mergeSheetDisconnectionTasksWithOverlay(cachedDisconnectionState.tasks).map(
          (t) => normalizeServerEntry({ ...t, category: "DISCONNECTION" })
        );
      }
      const tasks = await fetchDisconnectionTasksFromGoogleSheet();
      return tasks.map((t) => normalizeServerEntry({ ...t, category: "DISCONNECTION" }));
    }
    const modCached = moduleEntriesCacheMap.get(canonicalTab);
    if (modCached && Array.isArray(modCached.entries)) {
      if (forceRefresh || Date.now() - modCached.timestamp >= 45e3) {
        fetchIsolatedModuleEntriesFromSheet(canonicalTab, true).catch(() => {
        });
      }
      return mergeEntriesWithOverlay(modCached.entries).filter((e) => e.category === toFrontendCategory(canonicalTab));
    }
    return await fetchIsolatedModuleEntriesFromSheet(canonicalTab, forceRefresh);
  }
  if (cachedEntriesState && Array.isArray(cachedEntriesState.entries)) {
    if (forceRefresh || Date.now() - cachedEntriesState.timestamp >= 45e3) {
      refreshEntriesFromSheetInBackground();
    }
    return mergeEntriesWithOverlay(cachedEntriesState.entries);
  }
  try {
    const fetchAllPromise = (async () => {
      const allModuleLists = await Promise.all(
        ISOLATED_FIELD_MODULES.map(
          (tab) => fetchIsolatedModuleEntriesFromSheet(tab, forceRefresh).catch(() => {
            return moduleEntriesCacheMap.get(tab)?.entries || [];
          })
        )
      );
      const combined = mergeEntriesWithOverlay(allModuleLists.flat());
      if (combined.length > 0 || !cachedEntriesState) {
        cachedEntriesState = { entries: combined, timestamp: Date.now() };
        try {
          fs2.writeFileSync(ENTRIES_CACHE_FILE, JSON.stringify(combined), "utf-8");
        } catch {
        }
      }
      return combined;
    })();
    const result = await Promise.race([
      fetchAllPromise,
      new Promise(
        (resolve) => setTimeout(() => resolve(cachedEntriesState?.entries || []), 6e3)
      )
    ]);
    return mergeEntriesWithOverlay(result);
  } catch {
    return mergeEntriesWithOverlay(cachedEntriesState?.entries || []);
  }
}
app.get("/api/entries", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const force = req.query.refresh === "true" || req.query.force === "true";
    const officeSheetId = getTargetSpreadsheetId(req);
    if (officeSheetId) {
      const officeData = await fetchOfficeSpreadsheetData(officeSheetId, force);
      let list = officeData.entries;
      if (req.query?.category && String(req.query.category).toUpperCase().trim() !== "ALL") {
        const cat = String(req.query.category).trim().toUpperCase();
        list = list.filter((e) => String(e.category || "").toUpperCase() === cat);
      }
      return res.json(list);
    }
    const entries = await getFastMergedEntries(req.query, force);
    return res.json(entries);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch entries from Google Sheets" });
  }
});
app.post("/api/entries", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const payload = req.body.data || req.body;
    const saved = await handleFastCreateEntry(payload, "createEntry");
    return res.status(201).json({ success: true, entry: saved, data: saved });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Failed to submit entry to Google Sheets" });
  }
});
var handleEntryUpdateRequest = async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const id = req.params?.id || req.body?.id || req.query?.id;
    const cleanId = String(id || "").trim();
    if (!cleanId) {
      return res.status(400).json({ success: false, error: "Record ID is required for update." });
    }
    const bodyData = req.body && typeof req.body.data === "object" ? req.body.data : req.body;
    const updated = await handleFastUpdateEntry(cleanId, bodyData);
    return res.json({ success: true, entry: updated, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Failed to update entry in Google Sheets" });
  }
};
app.put("/api/entries/:id", handleEntryUpdateRequest);
app.patch("/api/entries/:id", handleEntryUpdateRequest);
app.post("/api/entries/:id/update", handleEntryUpdateRequest);
app.post("/api/entries/update", handleEntryUpdateRequest);
var handleEntryDeleteRequest = async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const id = req.params?.id || req.body?.id || req.query?.id;
    const cleanId = String(id || "").trim();
    if (!cleanId) {
      return res.status(400).json({ success: false, error: "Record ID is required for deletion." });
    }
    const clientPayload = { ...req.query, ...req.body };
    const cleanConsumerId = String(clientPayload.consumerId || clientPayload["Consumer Id"] || cleanId).replace(/^(TASK-DISC-|PWR-DIS-|SUB-DISC-)/i, "").trim();
    const existingEntry = cachedEntriesState?.entries?.find(
      (e) => String(e.id || "").trim().toLowerCase() === cleanId.toLowerCase() || String(e.submissionId || "").trim().toLowerCase() === cleanId.toLowerCase() || cleanConsumerId && String(e.consumerId || "").trim().toLowerCase() === cleanConsumerId.toLowerCase()
    ) || localEntriesOverlayMap.get(cleanId.toLowerCase()) || clientPayload.entry || null;
    const resolvedPayload = {
      ...clientPayload,
      category: clientPayload.category || existingEntry?.category,
      submissionId: clientPayload.submissionId || existingEntry?.submissionId || cleanId
    };
    registerDeletedRecord(cleanId, cleanConsumerId, resolvedPayload.submissionId);
    executeSheetDelete(cleanId, cleanConsumerId, resolvedPayload).catch(() => {
    });
    return res.json({
      success: true,
      deleted: true,
      id: cleanId,
      message: `Record #${cleanId} deleted from Google Sheets`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Failed to delete entry" });
  }
};
var handleClearAllEntriesRequest = async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const body = { ...req.query, ...req.body };
    const confirmToken = String(body.confirmClearAll || body.confirmation || "").trim();
    if (confirmToken && confirmToken !== "CONFIRM_PERMANENT_WIPE" && confirmToken !== "CLEAR ALL") {
      return res.status(403).json({
        success: false,
        error: "Explicit confirmation phrase required to wipe database."
      });
    }
    const result = await handleClearAllProductionDatabase();
    return res.json({
      success: true,
      cleared: true,
      ...result
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Failed to clear entries" });
  }
};
app.post("/api/entries/clear", handleClearAllEntriesRequest);
app.delete("/api/entries", handleClearAllEntriesRequest);
app.delete("/api/entries/:id", handleEntryDeleteRequest);
app.post("/api/entries/:id/delete", handleEntryDeleteRequest);
app.post("/api/entries/delete", handleEntryDeleteRequest);
app.get("/api/users", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const forceRefresh = req.query.refresh === "true" || req.query.force === "true";
    const users = await fetchVerifiedUsersFromSheet(forceRefresh);
    return res.json({
      success: true,
      data: { users },
      users,
      error: null,
      requestId: `REQ-${Date.now()}`
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { code: "USERS_FETCH_ERROR", message: err.message },
      requestId: `REQ-${Date.now()}`
    });
  }
});
app.post("/api/users", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const payload = req.body.data || req.body;
    const cleanName = String(payload.name || payload.idNo || payload.phone || "Worker").trim();
    const cleanIdNo = normalizeUniversal(payload.idNo || payload.name || payload.phone || "").trim();
    const cleanPhone = normalizeUniversal(payload.phone || "").replace(/\D/g, "");
    const plainPass = normalizeUniversal(payload.password || "1234").trim();
    const passHash = crypto2.createHash("sha256").update(plainPass).digest("hex").toLowerCase();
    const rawRoleInput = String(payload.role || "worker").trim().toLowerCase();
    const cleanRole = rawRoleInput === "admin" ? "admin" : rawRoleInput === "agency" ? "agency" : "worker";
    const cleanStatus = String(payload.status || "active").trim().toLowerCase() === "hold" ? "hold" : "active";
    const defaultDesignation = cleanRole === "admin" ? "Assistant Engineer / Admin (WBSEDCL)" : cleanRole === "agency" ? "Agency Partner (WBSEDCL)" : "Lineman / Worker (WBSEDCL)";
    const cleanDesig = String(payload.designation || defaultDesignation).trim();
    const cleanBadge = String(payload.badgeNo || cleanIdNo).trim();
    const existingUsers = cachedUsersState?.users && cachedUsersState.users.length > 0 ? cachedUsersState.users : await fetchVerifiedUsersFromSheet();
    const existingMatch = existingUsers.find(
      (u) => String(u.idNo || "").trim().toLowerCase() === cleanIdNo.toLowerCase() || payload.id && String(u.id || "").trim().toLowerCase() === String(payload.id).trim().toLowerCase()
    );
    const recordId = existingMatch ? existingMatch.id : payload.id || `USR-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    deletedTombstoneSet.delete(String(recordId).trim().toLowerCase());
    deletedTombstoneSet.delete(`usr_${cleanIdNo.toLowerCase()}`);
    saveTombstonesToDisk();
    const syncTag = buildUserSyncTag({
      idNo: cleanIdNo,
      password: plainPass,
      phone: cleanPhone,
      designation: cleanDesig,
      badgeNo: cleanBadge,
      role: cleanRole,
      status: cleanStatus,
      createdAt: existingMatch?.createdAt
    });
    const userRowData = {
      id: recordId,
      category: "Users",
      idNo: cleanIdNo,
      "User ID": cleanIdNo,
      password: plainPass,
      "Password": plainPass,
      passwordHash: passHash,
      "Password Hash": passHash,
      name: cleanName,
      "Name": cleanName,
      "Full Name": cleanName,
      consumerName: cleanName,
      phone: cleanPhone,
      "Phone": cleanPhone,
      role: cleanRole,
      "Role": cleanRole,
      status: cleanStatus,
      "Status": cleanStatus,
      designation: cleanDesig,
      "Designation": cleanDesig,
      badgeNo: cleanBadge,
      "Badge No": cleanBadge,
      createdAt: syncTag,
      "Created At": syncTag,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const savedUser = normalizeUserRecord(userRowData);
    upsertUserIntoCachedState(savedUser);
    clearUsersStateCache();
    (async () => {
      try {
        if (existingMatch) {
          await callGoogleAppsScript("updateEntry", {
            id: recordId,
            category: "Users",
            status: cleanStatus,
            role: cleanRole,
            ...userRowData,
            data: userRowData
          }, "POST");
        } else {
          await callGoogleAppsScript("submitRecord", {
            id: recordId,
            category: "Users",
            status: cleanStatus,
            role: cleanRole,
            ...userRowData,
            data: userRowData
          }, "POST");
        }
        await callGoogleAppsScript("updateEntry", {
          id: recordId,
          category: "Users",
          status: cleanStatus,
          role: cleanRole,
          createdAt: syncTag,
          "Created At": syncTag,
          data: {
            ...userRowData,
            createdAt: syncTag,
            "Created At": syncTag
          }
        }, "POST").catch(() => {
        });
      } catch (err) {
        console.warn("[Users Sheet Sync] Background save notice:", err);
      }
    })();
    return res.status(201).json({
      success: true,
      user: savedUser,
      data: { user: savedUser }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
var handleUserDeleteRequest = async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const id = String(req.params?.id || req.body?.id || req.query?.id || "").trim();
    const clientPayload = { ...req.query, ...req.body };
    const validation = await validateUserDeletion(id, clientPayload);
    if (!validation.allowed) {
      return res.status(403).json({
        success: false,
        error: validation.error
      });
    }
    const existingUsers = cachedUsersState?.users && cachedUsersState.users.length > 0 ? cachedUsersState.users : await fetchVerifiedUsersFromSheet();
    const targetUser = existingUsers.find(
      (u) => String(u.id).trim().toLowerCase() === id.toLowerCase() || String(u.idNo).trim().toLowerCase() === id.toLowerCase()
    );
    const rowId = targetUser ? targetUser.id : id;
    const idNo = targetUser ? targetUser.idNo : id;
    deletedTombstoneSet.add(String(rowId).trim().toLowerCase());
    if (idNo) deletedTombstoneSet.add(`usr_${String(idNo).trim().toLowerCase()}`);
    saveTombstonesToDisk();
    removeUserFromCachedState(rowId);
    if (idNo) removeUserFromCachedState(idNo);
    clearUsersStateCache();
    callGoogleAppsScript("deleteUser", {
      id: rowId,
      idNo,
      category: "Users"
    }, "POST").catch(() => {
    });
    callGoogleAppsScript("deleteEntry", {
      id: rowId,
      consumerId: idNo,
      category: "Users",
      confirmDelete: true,
      confirmAdminDelete: clientPayload.confirmAdminDelete,
      reason: clientPayload.reason
    }, "POST").catch(() => {
    });
    return res.json({
      success: true,
      deleted: true,
      message: `User #${id} successfully deleted`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
app.delete("/api/users/:id", handleUserDeleteRequest);
app.post("/api/users/:id/delete", handleUserDeleteRequest);
app.put("/api/users/:id", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const paramId = String(req.params.id || "").trim();
    const payload = req.body.data || req.body;
    const existingUsers = cachedUsersState?.users && cachedUsersState.users.length > 0 ? cachedUsersState.users : await fetchVerifiedUsersFromSheet();
    const targetUser = existingUsers.find(
      (u) => String(u.id).trim().toLowerCase() === paramId.toLowerCase() || String(u.idNo).trim().toLowerCase() === paramId.toLowerCase()
    );
    const rowId = targetUser ? targetUser.id : paramId;
    const mergedUser = {
      ...targetUser || {},
      ...payload,
      id: rowId,
      category: "Users"
    };
    if (payload.password !== void 0 && String(payload.password).trim() !== "") {
      const plainPass = normalizeUniversal(payload.password).trim();
      const passHash = crypto2.createHash("sha256").update(plainPass).digest("hex").toLowerCase();
      mergedUser.password = plainPass;
      mergedUser["Password"] = plainPass;
      mergedUser.passwordHash = passHash;
      mergedUser["Password Hash"] = passHash;
    } else if (targetUser?.password) {
      mergedUser.password = targetUser.password;
      mergedUser["Password"] = targetUser.password;
    }
    if (payload.name !== void 0) {
      mergedUser.name = String(payload.name).trim();
      mergedUser["Name"] = mergedUser.name;
      mergedUser["Full Name"] = mergedUser.name;
      mergedUser.consumerName = mergedUser.name;
    }
    if (payload.phone !== void 0) {
      mergedUser.phone = normalizeUniversal(payload.phone).replace(/\D/g, "");
      mergedUser["Phone"] = mergedUser.phone;
    }
    if (payload.status !== void 0) {
      mergedUser.status = payload.status === "hold" ? "hold" : "active";
      mergedUser["Status"] = mergedUser.status;
    } else {
      mergedUser.status = targetUser?.status || "active";
      mergedUser["Status"] = mergedUser.status;
    }
    if (payload.role !== void 0) {
      mergedUser.role = payload.role;
      mergedUser["Role"] = payload.role;
    }
    const syncTag = buildUserSyncTag({
      idNo: mergedUser.idNo || targetUser?.idNo || paramId,
      password: mergedUser.password || targetUser?.password || "",
      phone: mergedUser.phone || targetUser?.phone || "",
      designation: mergedUser.designation || targetUser?.designation || "",
      badgeNo: mergedUser.badgeNo || targetUser?.badgeNo || mergedUser.idNo || paramId,
      role: mergedUser.role || targetUser?.role || "worker",
      status: mergedUser.status || targetUser?.status || "active",
      createdAt: targetUser?.createdAt
    });
    mergedUser.createdAt = syncTag;
    mergedUser["Created At"] = syncTag;
    const updatedUser = normalizeUserRecord(mergedUser);
    upsertUserIntoCachedState(updatedUser);
    clearUsersStateCache();
    callGoogleAppsScript("updateEntry", {
      id: rowId,
      category: "Users",
      status: mergedUser.status,
      role: mergedUser.role,
      ...mergedUser,
      data: mergedUser
    }, "POST").catch(() => {
    });
    return res.json({
      success: true,
      user: updatedUser,
      data: { user: updatedUser }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
var WORK_ORDERS_CACHE_FILE = path2.join(process.cwd(), ".work-orders-cache.json");
var WO_SHEET_CATEGORY = "Work Orders";
var serverWorkOrdersCache = [];
var lastWorkOrdersFetchTime = Date.now();
var hasLoadedWorkOrdersOnce = true;
var isSyncingWorkOrdersFromSheet = false;
try {
  if (fs2.existsSync(WORK_ORDERS_CACHE_FILE)) {
    const parsed = JSON.parse(fs2.readFileSync(WORK_ORDERS_CACHE_FILE, "utf-8"));
    if (Array.isArray(parsed)) {
      serverWorkOrdersCache = parsed.filter((w) => w && w.id && !deletedTombstoneSet.has(String(w.id).trim().toLowerCase()));
    }
  }
} catch {
}
function saveWorkOrdersToDisk() {
  try {
    fs2.writeFileSync(WORK_ORDERS_CACHE_FILE, JSON.stringify(serverWorkOrdersCache), "utf-8");
  } catch (err) {
    console.warn("[WorkOrders] Disk save notice:", err);
  }
}
function normalizeServerWorkOrder(raw) {
  const id = String(raw.id || `WO-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`).trim();
  const rawImg = String(raw.photoUrl || raw.fileData || raw.fileUrl || raw.directImageUrl || "").trim();
  const binaryEndpoint = `/api/work-orders/${encodeURIComponent(id)}/file`;
  const effectivePhotoUrl = rawImg || binaryEndpoint;
  return {
    id,
    category: String(raw.category || "NSC").trim(),
    title: String(raw.title || "WBSEDCL Work Order / Khata Notice").trim(),
    description: String(raw.description || raw.notes || "").trim(),
    photoUrl: effectivePhotoUrl,
    directImageUrl: effectivePhotoUrl,
    fileData: rawImg || effectivePhotoUrl,
    fileUrl: effectivePhotoUrl,
    fileName: String(raw.fileName || `WorkOrder_${id}.jpg`).trim(),
    fileType: String(raw.fileType || "image/jpeg").trim(),
    fileSize: Number(raw.fileSize || (rawImg ? Math.round(rawImg.length * 0.75) : 0)),
    uploadedBy: String(raw.uploadedBy || "8695716192").trim(),
    adminName: String(raw.adminName || "Admin Controller").trim(),
    adminPhone: String(raw.adminPhone || "8695716192").trim(),
    uploadDate: String(raw.uploadDate || (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB").replace(/\//g, "-")).trim(),
    uploadTime: String(raw.uploadTime || (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })).trim(),
    createdAt: String(raw.createdAt || (/* @__PURE__ */ new Date()).toISOString()).trim(),
    isHidden: Boolean(raw.isHidden === true || raw.isHidden === "true" || raw.isHidden === "TRUE" || raw.status === "Hidden"),
    _localSavedAt: raw._localSavedAt || Date.now()
  };
}
async function syncWorkOrderToSheet(wo, isUpdate = false) {
  const rawBase64 = String(wo.fileData || wo.photoUrl || "").trim();
  const CHUNK_SIZE = 43e3;
  const chunks = [];
  if (rawBase64 && rawBase64.startsWith("data:")) {
    for (let i = 0; i < rawBase64.length && chunks.length < 12; i += CHUNK_SIZE) {
      chunks.push(rawBase64.slice(i, i + CHUNK_SIZE));
    }
  } else if (rawBase64) {
    chunks.push(rawBase64.slice(0, CHUNK_SIZE));
  }
  const meta = {
    id: wo.id,
    category: wo.category || "NSC",
    title: wo.title || "Work Order / Khata Notice",
    description: wo.description || "",
    fileName: wo.fileName || "WorkOrder.jpg",
    fileType: wo.fileType || "image/jpeg",
    fileSize: wo.fileSize || 0,
    uploadedBy: wo.uploadedBy || "8695716192",
    adminName: wo.adminName || "Admin Controller",
    adminPhone: wo.adminPhone || "8695716192",
    uploadDate: wo.uploadDate || "",
    uploadTime: wo.uploadTime || "",
    createdAt: wo.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
    isHidden: Boolean(wo.isHidden)
  };
  const sheetPayload = {
    id: wo.id,
    submissionId: wo.id,
    category: WO_SHEET_CATEGORY,
    status: wo.isHidden ? "Hidden" : "Active",
    consumerName: wo.title,
    workerName: wo.adminName || "Admin Controller",
    workerId: wo.uploadedBy || "8695716192",
    workOrderNo: wo.category || "NSC",
    workOrderDate: wo.uploadDate || "",
    workOrderNoticeId: wo.id,
    workOrderNoticeTitle: wo.title,
    notes: JSON.stringify(meta),
    photoUrl: chunks[0] || "",
    address: chunks[1] || "",
    substation: chunks[2] || "",
    feederName: chunks[3] || "",
    "Feeder Name": chunks[3] || "",
    fatherName: chunks[4] || "",
    locationGps: chunks[5] || "",
    serviceCableLength: chunks[6] || "",
    earthResistance: chunks[7] || "",
    meterNo: chunks[8] || "",
    sealNo: chunks[9] || "",
    initialReading: chunks[10] || "",
    appliedLoad: chunks[11] || ""
  };
  try {
    if (isUpdate) {
      const upRes = await callGoogleAppsScript("updateEntry", {
        id: wo.id,
        submissionId: wo.id,
        category: WO_SHEET_CATEGORY,
        ...sheetPayload,
        data: sheetPayload
      }, "POST", 35e3);
      if (upRes && upRes.success) return;
    }
    await callGoogleAppsScript("submitRecord", {
      id: wo.id,
      submissionId: wo.id,
      category: WO_SHEET_CATEGORY,
      ...sheetPayload,
      data: sheetPayload
    }, "POST", 35e3);
  } catch (err) {
    console.warn("[WorkOrders] syncWorkOrderToSheet notice:", err?.message || err);
  }
}
async function fetchWorkOrdersFromSheet() {
  if (isSyncingWorkOrdersFromSheet) return serverWorkOrdersCache;
  isSyncingWorkOrdersFromSheet = true;
  try {
    const res = await callGoogleAppsScript("entries", { category: WO_SHEET_CATEGORY }, "GET", 25e3);
    const rows = Array.isArray(res?.entries) ? res.entries : Array.isArray(res?.data) ? res.data : [];
    const fromSheet = [];
    for (const r of rows) {
      const rowId = String(r.id || r.submissionId || r.workOrderNoticeId || "").trim();
      if (!rowId || deletedTombstoneSet.has(rowId.toLowerCase())) continue;
      let meta = {};
      const notesStr = String(r.notes || r["Notes"] || "").trim();
      if (notesStr.startsWith("{")) {
        try {
          meta = JSON.parse(notesStr);
        } catch {
        }
      }
      const reassembledBase64 = [
        r.photoUrl || "",
        r.address || "",
        r.substation || "",
        r.feederName || r["Feeder Name"] || "",
        r.fatherName || "",
        r.locationGps || "",
        r.serviceCableLength || "",
        r.earthResistance || "",
        r.meterNo || "",
        r.sealNo || "",
        r.initialReading || "",
        r.appliedLoad || ""
      ].join("");
      const localMatch = serverWorkOrdersCache.find((w) => w.id === (meta.id || rowId));
      const bestImage = localMatch?.fileData && localMatch.fileData.length > reassembledBase64.length ? localMatch.fileData : reassembledBase64;
      const item = normalizeServerWorkOrder({
        id: meta.id || rowId,
        category: meta.category || r.workOrderNo || "NSC",
        title: meta.title || r.consumerName || r.workOrderNoticeTitle || "Work Order & Khata Notice",
        description: meta.description || "",
        photoUrl: bestImage,
        fileData: bestImage,
        fileName: meta.fileName || `WorkOrder_${rowId}.jpg`,
        fileType: meta.fileType || "image/jpeg",
        fileSize: meta.fileSize || 0,
        uploadedBy: meta.uploadedBy || r.workerId || "8695716192",
        adminName: meta.adminName || r.workerName || "Admin Controller",
        adminPhone: meta.adminPhone || "8695716192",
        uploadDate: meta.uploadDate || r.workOrderDate || r.date || "",
        uploadTime: meta.uploadTime || "",
        createdAt: meta.createdAt || r.createdAt || r.date || (/* @__PURE__ */ new Date()).toISOString(),
        isHidden: meta.isHidden !== void 0 ? Boolean(meta.isHidden) : String(r.status).toLowerCase() === "hidden"
      });
      fromSheet.push(item);
    }
    const sheetIds = new Set(fromSheet.map((w) => w.id));
    for (const localWo of serverWorkOrdersCache) {
      if (!localWo || !localWo.id) continue;
      if (deletedTombstoneSet.has(String(localWo.id).trim().toLowerCase())) continue;
      if (!sheetIds.has(localWo.id) && !localWo._syncedToSheet && localWo._localSavedAt && Date.now() - localWo._localSavedAt < 6e4) {
        fromSheet.unshift(localWo);
      }
    }
    fromSheet.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    serverWorkOrdersCache = fromSheet;
    lastWorkOrdersFetchTime = Date.now();
    saveWorkOrdersToDisk();
  } catch (err) {
    console.warn("[WorkOrders] fetchWorkOrdersFromSheet notice:", err?.message || err);
  } finally {
    isSyncingWorkOrdersFromSheet = false;
  }
  return serverWorkOrdersCache;
}
async function getMergedWorkOrders(categoryFilter, forceRefresh = false) {
  if (!hasLoadedWorkOrdersOnce) {
    hasLoadedWorkOrdersOnce = true;
    await Promise.race([
      fetchWorkOrdersFromSheet(),
      new Promise((resolve) => setTimeout(resolve, 2500))
    ]);
  } else if (forceRefresh || Date.now() - lastWorkOrdersFetchTime > 45e3) {
    fetchWorkOrdersFromSheet().catch(() => {
    });
  }
  let list = serverWorkOrdersCache.filter((w) => w && w.id && !deletedTombstoneSet.has(String(w.id).trim().toLowerCase()));
  const cat = String(categoryFilter || "").trim().toUpperCase();
  if (cat && cat !== "ALL") {
    list = list.filter((o) => {
      const oCat = String(o.category || "NSC").trim().toUpperCase();
      return oCat === cat || oCat === "ALL";
    });
  }
  return list;
}
async function handleCreateWorkOrder(rawPayload) {
  const payload = rawPayload && typeof rawPayload.data === "object" ? rawPayload.data : rawPayload || {};
  const newOrder = normalizeServerWorkOrder({
    ...payload,
    id: payload.id || `WO-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    createdAt: payload.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
    _localSavedAt: Date.now(),
    _syncedToSheet: false
  });
  deletedTombstoneSet.delete(newOrder.id.toLowerCase());
  saveTombstonesToDisk();
  serverWorkOrdersCache = [newOrder, ...serverWorkOrdersCache.filter((w) => w.id !== newOrder.id)];
  saveWorkOrdersToDisk();
  enqueueGasWrite(async () => {
    await syncWorkOrderToSheet(newOrder, false);
    newOrder._syncedToSheet = true;
    saveWorkOrdersToDisk();
  }).catch(() => {
  });
  return newOrder;
}
async function handleToggleWorkOrderVisibility(id, isHidden) {
  const cleanId = String(id || "").trim();
  let updatedItem = null;
  serverWorkOrdersCache = serverWorkOrdersCache.map((w) => {
    if (w.id === cleanId) {
      updatedItem = { ...w, isHidden: Boolean(isHidden), _localSavedAt: Date.now(), _syncedToSheet: false };
      return updatedItem;
    }
    return w;
  });
  saveWorkOrdersToDisk();
  if (updatedItem) {
    const itemToSync = updatedItem;
    enqueueGasWrite(async () => {
      await syncWorkOrderToSheet(itemToSync, true);
      itemToSync._syncedToSheet = true;
      saveWorkOrdersToDisk();
    }).catch(() => {
    });
  }
  return updatedItem || { id: cleanId, isHidden: Boolean(isHidden) };
}
async function handleDeleteWorkOrder(id) {
  const cleanId = String(id || "").trim();
  if (!cleanId) return false;
  deletedTombstoneSet.add(cleanId.toLowerCase());
  saveTombstonesToDisk();
  serverWorkOrdersCache = serverWorkOrdersCache.filter((w) => w.id !== cleanId);
  saveWorkOrdersToDisk();
  callGoogleAppsScript("deleteWorkOrder", { id: cleanId }, "POST", 2e4).catch(() => {
  });
  callGoogleAppsScript("deleteEntry", { id: cleanId, submissionId: cleanId, category: WO_SHEET_CATEGORY }, "POST", 2e4).catch(() => {
  });
  return true;
}
app.get("/api/work-orders/:id/file", (req, res) => {
  const cleanId = String(req.params.id || "").trim();
  const found = serverWorkOrdersCache.find((w) => w.id === cleanId);
  const rawData = found ? String(found.fileData || found.photoUrl || "") : "";
  if (rawData && rawData.startsWith("data:")) {
    const match = rawData.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const mimeType = match[1] || found?.fileType || "image/jpeg";
      const buffer = Buffer.from(match[2], "base64");
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(buffer);
    }
  }
  return res.status(404).send("Work order file not found");
});
app.get("/api/work-orders", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const force = req.query.refresh === "true" || req.query.force === "true";
    const officeSheetId = getTargetSpreadsheetId(req);
    if (officeSheetId) {
      const officeData = await fetchOfficeSpreadsheetData(officeSheetId, force);
      return res.json({
        success: true,
        workOrders: officeData.workOrders,
        data: { workOrders: officeData.workOrders }
      });
    }
    const orders = await getMergedWorkOrders(req.query.category, force);
    return res.json({
      success: true,
      workOrders: orders,
      data: { workOrders: orders }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Failed to load work orders" });
  }
});
app.post("/api/work-orders", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const saved = await handleCreateWorkOrder(req.body);
    return res.status(201).json({
      success: true,
      workOrder: saved,
      data: { workOrder: saved }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Failed to upload work order" });
  }
});
var handleWorkOrderDeleteRequest = async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const targetId = String(req.params?.id || req.body?.id || req.query?.id || "").trim();
    await handleDeleteWorkOrder(targetId);
    return res.json({ success: true, deleted: true, id: targetId });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
app.delete("/api/work-orders/:id", handleWorkOrderDeleteRequest);
app.post("/api/work-orders/:id/delete", handleWorkOrderDeleteRequest);
var handleToggleVisibility = async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const updated = await handleToggleWorkOrderVisibility(req.params.id, Boolean(req.body?.isHidden));
    return res.json({ success: true, workOrder: updated, data: { workOrder: updated } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
app.patch("/api/work-orders/:id/visibility", handleToggleVisibility);
app.post("/api/work-orders/:id/visibility", handleToggleVisibility);
app.put("/api/work-orders/:id/visibility", handleToggleVisibility);
app.get("/api/drive-proxy/:fileId", async (req, res) => {
  const { fileId } = req.params;
  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return res.status(400).send("Invalid file ID");
  }
  const driveUrls = [
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`,
    `https://lh3.googleusercontent.com/d/${fileId}`,
    `https://drive.google.com/uc?export=view&id=${fileId}`
  ];
  for (const driveUrl of driveUrls) {
    try {
      const response = await fetch(driveUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        }
      });
      if (response.ok) {
        const contentType = response.headers.get("content-type") || "image/jpeg";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
        const arrayBuffer = await response.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
      }
    } catch {
    }
  }
  return res.status(404).send("Image could not be retrieved from Google Drive");
});
async function computeLiveDashboardStats() {
  const entries = await getFastMergedEntries({}, false);
  const stats = {
    total: entries.length,
    categories: {
      NSC: 0,
      DISCONNECTION: 0,
      POLE_CASE: 0,
      METER_REPLESMENT: 0,
      DTR_REPLESMENT: 0
    },
    status: {
      pending: 0,
      completed: 0,
      approved: 0
    }
  };
  for (const e of entries) {
    const cat = String(e.category || "").toUpperCase().trim();
    if (cat === "NSC") stats.categories.NSC++;
    else if (cat === "DISCONNECTION" || cat === "DISCONNECT") stats.categories.DISCONNECTION++;
    else if (cat === "POLE CASE" || cat === "BROKEN") stats.categories.POLE_CASE++;
    else if (cat === "METER REPLESMENT" || cat === "METER REPLACEMENT") stats.categories.METER_REPLESMENT++;
    else if (cat === "DTR REPLESMENT" || cat === "DTR REPLACEMENT") stats.categories.DTR_REPLESMENT++;
    const st = String(e.status || "").toLowerCase();
    if (st === "pending") stats.status.pending++;
    else if (st === "approved") stats.status.approved++;
    else stats.status.completed++;
  }
  return stats;
}
app.get("/api/stats", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const officeSheetId = getTargetSpreadsheetId(req);
    if (officeSheetId) {
      const officeData = await fetchOfficeSpreadsheetData(officeSheetId, false);
      const total = officeData.entries.length + officeData.tasks.length;
      return res.json({
        total,
        categories: {
          NSC: officeData.entries.filter((e) => e.category === "NSC").length,
          DISCONNECTION: officeData.tasks.length,
          POLE_CASE: officeData.entries.filter((e) => e.category === "POLE_CASE").length,
          METER_REPLESMENT: officeData.entries.filter((e) => e.category === "METER_REPLESMENT").length,
          DTR_REPLESMENT: officeData.entries.filter((e) => e.category === "DTR_REPLESMENT").length
        },
        status: {
          pending: officeData.tasks.filter((t) => t.disconStatus === "Pending").length,
          completed: officeData.tasks.filter((t) => t.disconStatus === "Completed").length,
          approved: officeData.tasks.filter((t) => t.disconStatus === "Approved").length
        }
      });
    }
    const stats = await computeLiveDashboardStats();
    return res.json(stats);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch dashboard stats" });
  }
});
var CHAT_CACHE_FILE = path2.join(process.cwd(), ".chat-messages-cache.json");
var serverChatCache = [];
try {
  if (fs2.existsSync(CHAT_CACHE_FILE)) {
    const arr = JSON.parse(fs2.readFileSync(CHAT_CACHE_FILE, "utf-8"));
    if (Array.isArray(arr)) serverChatCache = arr;
  }
} catch {
}
function saveChatToDisk() {
  try {
    fs2.writeFileSync(CHAT_CACHE_FILE, JSON.stringify(serverChatCache), "utf-8");
  } catch {
  }
}
async function getChatMessagesList(workerId) {
  if (workerId) {
    const wid = String(workerId).trim().toLowerCase();
    return serverChatCache.filter(
      (m) => String(m.workerId || "").toLowerCase() === wid || String(m.senderId || "").toLowerCase() === wid || String(m.recipientId || "").toLowerCase() === wid || m.recipientId === "ALL"
    );
  }
  return serverChatCache;
}
async function handleSendChatMessage(rawMsg) {
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const msg = {
    id: rawMsg.id || `MSG-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    workerId: String(rawMsg.workerId || rawMsg.senderId || "").trim(),
    senderId: String(rawMsg.senderId || "").trim(),
    senderName: String(rawMsg.senderName || "User").trim(),
    senderRole: rawMsg.senderRole || "worker",
    recipientId: String(rawMsg.recipientId || "admin").trim(),
    message: String(rawMsg.message || "").trim(),
    timestamp: rawMsg.timestamp || nowIso,
    createdAt: nowIso
  };
  serverChatCache.push(msg);
  saveChatToDisk();
  callGoogleAppsScript("submitRecord", {
    id: msg.id,
    submissionId: msg.id,
    category: "Chat",
    workerId: msg.senderId,
    workerName: msg.senderName,
    role: msg.senderRole,
    notes: JSON.stringify(msg)
  }, "POST", 2e4).catch(() => {
  });
  return msg;
}
async function handleClearChatMessages() {
  serverChatCache = [];
  saveChatToDisk();
}
app.get("/api/chat", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const messages = await getChatMessagesList(req.query.workerId);
    return res.json(messages);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/chat", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const msg = await handleSendChatMessage(req.body?.data || req.body || {});
    return res.status(201).json({ success: true, message: msg });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.delete("/api/chat", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    await handleClearChatMessages();
    return res.json({ success: true, message: "Chat cleared" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
function parseSlNumber(sl) {
  if (!sl) return 0;
  const match = String(sl).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}
function formatSlNumber(num) {
  return `SL ${String(num).padStart(3, "0")}`;
}
function normalizeTaskPhone(t) {
  if (!t) return "";
  const candidates = [
    t.phoneNumber,
    t.mobileNumber,
    t.mobile,
    t.phone,
    t.contactNumber,
    t.contact,
    t["Mobile Number"],
    t["Mobile No"],
    t["Mobile No."],
    t["Mobile"],
    t["Mobile_No"],
    t["Mob No"],
    t["Mob"],
    t["MOB_NO"],
    t["MOB_NUM"],
    t["Phone Number"],
    t["Phone No"],
    t["Phone"],
    t["Contact"],
    t["Contact No"],
    t["\u09AE\u09CB\u09AC\u09BE\u0987\u09B2"],
    t["\u09AB\u09CB\u09A8"]
  ];
  for (const c of candidates) {
    if (c !== void 0 && c !== null) {
      let str = String(c).trim();
      str = str.replace(/\.0+$/, "");
      if (/^\d+\.?\d*e[+-]?\d+$/i.test(str)) {
        const num = Number(str);
        if (!isNaN(num)) str = Math.round(num).toString();
      }
      if (str && str.toLowerCase() !== "null" && str.toLowerCase() !== "undefined" && str.toLowerCase() !== "n/a" && str !== "-") {
        return str;
      }
    }
  }
  const text = `${t.consumerAddress || t.Address || ""} ${t.workerRemarks || ""} ${t.disconnectionReason || ""}`;
  const m = text.match(/(?:^|\D)([6-9]\d{9})(?:\D|$)/);
  return m ? m[1] : "";
}
function computeLocalStats(tasks, workerId, workerName) {
  const totalTasks = tasks.length;
  let completedTasks = 0;
  let disconnectedTasks = 0;
  let pendingTasks = 0;
  let inProgressTasks = 0;
  let unableTasks = 0;
  let reportedTasks = 0;
  let cancelledTasks = 0;
  let paidTasks = 0;
  let notFoundTasks = 0;
  let disputeTasks = 0;
  let officeTeamTasks = 0;
  let reissueTasks = 0;
  let urgentTasks = 0;
  let myAssignedTasks = 0;
  let myCompletedTasks = 0;
  let myPendingTasks = 0;
  const wId = String(workerId || "").toLowerCase().trim();
  const wNm = String(workerName || "").toLowerCase().trim();
  const workerMap = /* @__PURE__ */ new Map();
  for (const t of tasks) {
    const st = String(t.taskStatus || t.disconStatus || t["Discon Status"] || t.status || "PENDING").trim().toUpperCase();
    if (st === "DISCONNECT" || st === "DISCONNECTED") {
      disconnectedTasks++;
      completedTasks++;
    } else if (st === "COMPLETED") {
      completedTasks++;
    } else if (st === "PENDING") {
      pendingTasks++;
    } else if (st === "PAID") {
      paidTasks++;
    } else if (st === "NOT FOUND" || st === "NOT_FOUND") {
      notFoundTasks++;
    } else if (st === "DISPUTE") {
      disputeTasks++;
    } else if (st === "OFFICE TEAM" || st === "OFFICE_TEAM") {
      officeTeamTasks++;
    } else if (st === "REISSUE") {
      reissueTasks++;
    } else if (st === "IN PROGRESS" || st === "IN_PROGRESS") {
      inProgressTasks++;
    } else if (st === "UNABLE") {
      unableTasks++;
    } else if (st === "REPORTED") {
      reportedTasks++;
    } else if (st === "CANCELLED") {
      cancelledTasks++;
    }
    if (String(t.priority || "").toUpperCase() === "URGENT") urgentTasks++;
    const aId = String(t.assignedWorkerId || "").toLowerCase().trim();
    const aNm = String(t.assignedWorkerName || "").toLowerCase().trim();
    const isMine = wId && aId === wId || wNm && aNm === wNm;
    if (isMine) {
      myAssignedTasks++;
      if (st === "COMPLETED" || st === "DISCONNECT" || st === "PAID") myCompletedTasks++;
      else if (st === "PENDING" || st === "IN PROGRESS") myPendingTasks++;
    }
    const workerKey = t.assignedWorkerName || t.submittedBy || "Unassigned";
    if (!workerMap.has(workerKey)) {
      workerMap.set(workerKey, {
        workerName: workerKey,
        assigned: 0,
        completed: 0,
        pending: 0,
        reportsSubmitted: 0,
        completionRate: 0
      });
    }
    const wRecord = workerMap.get(workerKey);
    wRecord.assigned++;
    if (st === "DISCONNECT" || st === "COMPLETED" || st === "PAID") {
      wRecord.completed++;
    } else if (st === "PENDING" || st === "IN PROGRESS") {
      wRecord.pending++;
    }
    if (t.workerReport || t.workerRemarks || t.reportDate || st !== "PENDING" && st !== "IN PROGRESS") {
      wRecord.reportsSubmitted++;
    }
  }
  const workerPerformance = Array.from(workerMap.values()).map((w) => ({
    ...w,
    completionRate: w.assigned > 0 ? Math.round(w.completed / w.assigned * 100) : 0
  }));
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks + paidTasks) / totalTasks * 100) : 0;
  const myCompletionPercentage = myAssignedTasks > 0 ? Math.round(myCompletedTasks / myAssignedTasks * 100) : 0;
  return {
    totalTasks,
    completedTasks,
    disconnectedTasks,
    pendingTasks,
    inProgressTasks,
    unableTasks,
    reportedTasks,
    cancelledTasks,
    paidTasks,
    notFoundTasks,
    disputeTasks,
    officeTeamTasks,
    reissueTasks,
    urgentTasks,
    completionPercentage,
    myAssignedTasks,
    myCompletedTasks,
    myPendingTasks,
    myCompletionPercentage,
    workerPerformance
  };
}
function convertSheetEntryToDisconnectionTask(entry, index) {
  const offCode = String(entry["off_code"] ?? entry.off_code ?? entry.offCode ?? entry.area ?? entry.substation ?? "").trim();
  const mru = String(entry["MRU"] ?? entry.MRU ?? entry.mru ?? entry.mruSection ?? "").trim();
  const consumerId = String(entry["Consumer Id"] || entry["Consumer ID"] || entry.consumerId || entry.accountNumber || "").trim();
  const consumerName = String(entry["Name"] || entry.Name || entry.consumerName || entry.name || "").trim();
  const consumerAddress = String(entry["Address"] || entry.Address || entry.consumerAddress || entry.address || "").trim();
  const baseClass = String(entry["Base Class"] ?? entry.baseClass ?? "").trim();
  const consumerClass = String(entry["Class"] ?? entry.classType ?? entry.class ?? "").trim();
  const device = String(entry["Device"] ?? entry.device ?? "").trim();
  const dueDateRange = String(entry["O/S Duedate Range"] || entry["O/S Due date Range"] || entry.dueDateRange || entry.osDueDateRange || "").trim();
  const outstandingDue = String(entry["D2 Net O/S"] || entry.outstandingDue || entry.arrearAmount || entry.d2NetOs || "").trim();
  const mobile = normalizeTaskPhone(entry) || String(entry["Mobile"] || entry["Mobile Number"] || entry["Mobile No"] || entry.mobile || "").trim();
  const numberVal = String(entry["Number"] ?? entry.number ?? entry["Meter"] ?? "").trim();
  const latitude = String(entry["Latitude"] ?? entry.latitude ?? "").trim();
  const longitude = String(entry["Longitude"] ?? entry.longitude ?? "").trim();
  const rawStatus = String(entry["Discon Status"] || entry.disconStatus || entry.taskStatus || "PENDING").trim().toUpperCase();
  const reportDate = String(entry["Discon Date"] ?? entry.disconDate ?? entry.reportDate ?? "").trim();
  const imageUrl = String(entry["Image"] ?? entry.image ?? entry.photoUrl ?? entry["Photo Evidence"] ?? "").trim();
  const reading = String(entry["Reading"] ?? entry.reading ?? entry.meterReading ?? "").trim();
  const gisPole = String(entry["Gis Pole"] ?? entry.gisPole ?? entry.poleNo ?? "").trim();
  const agency = String(entry["Agency"] ?? entry.agency ?? entry.assignedAgency ?? entry["Agency Name"] ?? "").trim();
  const notes = String(entry["Notes"] ?? entry.notes ?? entry.workerRemarks ?? entry.workerReport ?? "").replace(/\[DELETED_BY_ADMIN\]/gi, "").trim();
  const natureOfConn = String(entry["Nature of Conn"] ?? entry.natureOfConn ?? "").trim();
  const govNonGov = String(entry["Gov/Non-Gov"] ?? entry.govNonGov ?? entry.govStatus ?? "").trim();
  const lastUpdated = String(entry["Last Updated"] || entry.lastUpdated || entry.updatedAt || "").trim();
  const priority = String(entry["Priority"] || entry.priority || (parseFloat(outstandingDue.replace(/[^0-9.]/g, "")) > 1e4 ? "URGENT" : "NORMAL")).trim().toUpperCase();
  const paidAmount = String(entry["Paid Amount"] ?? entry.paidAmount ?? "").trim();
  const status = !rawStatus || rawStatus === "CONNECTED" || rawStatus === "COMPLETED" ? "PENDING" : rawStatus;
  const paymentStatus = status === "PAID" ? "PAID" : "PENDING";
  const paidDate = String(entry["Paid Date"] ?? entry.paidDate ?? entry.paymentDate ?? "").trim();
  const paidType = String(entry["Paid Type"] ?? entry.paidType ?? entry.paymentReference ?? "").trim();
  const outstandingAfter = String(entry["Outstanding After"] ?? entry.outstandingAfter ?? "").trim();
  const nextPaymentDate = String(entry["Next Payment Date"] ?? entry.nextPaymentDate ?? "").trim();
  const paymentSource = String(entry["Payment Source"] ?? entry.paymentSource ?? "").trim();
  const uploadDate = String(entry["Upload Date"] ?? entry.uploadDate ?? entry.createdAt ?? "").trim();
  const rawSl = entry.serialNumber || entry["SL No"] || entry.slNo || entry.sl;
  const parsedSl = parseSlNumber(rawSl) || index;
  const serialNumber = formatSlNumber(parsedSl);
  const taskId = String(entry.taskId || entry["Task ID"] || entry.id || entry["Submission ID"] || `TASK-DISC-${consumerId || index}`).trim();
  const resolvedMeterNumber = (device && device.toUpperCase() !== "I" && device.toUpperCase() !== "III" ? device : "") || numberVal || reading;
  return {
    // Exact 33 Google Sheet Columns (A:AG)
    "off_code": offCode,
    "MRU": mru,
    "Consumer Id": consumerId,
    "Name": consumerName,
    "Address": consumerAddress,
    "Base Class": baseClass,
    "Class": consumerClass,
    "Device": device,
    "O/S Duedate Range": dueDateRange,
    "D2 Net O/S": outstandingDue,
    "Mobile": mobile,
    "Number": numberVal,
    "Latitude": latitude,
    "Longitude": longitude,
    "Discon Status": status,
    "Status": status,
    "Discon Date": reportDate,
    "Image": imageUrl,
    "Reading": reading,
    "Payment Status": paymentStatus,
    "Gis Pole": gisPole,
    "Agency": agency,
    "Notes": notes,
    "Nature of Conn": natureOfConn,
    "Gov/Non-Gov": govNonGov,
    "Last Updated": lastUpdated,
    "Priority": priority,
    "Paid Amount": paidAmount,
    "Paid Date": paidDate,
    "Paid Type": paidType,
    "Outstanding After": outstandingAfter,
    "Next Payment Date": nextPaymentDate,
    "Payment Source": paymentSource,
    "Upload Date": uploadDate,
    // Developer Aliases & Frontend compatibility
    serialNumber,
    taskId,
    consumerId,
    consumerName,
    accountNumber: consumerId,
    meterNumber: resolvedMeterNumber,
    reading,
    meterReading: reading,
    consumerAddress,
    phoneNumber: mobile,
    mobileNumber: mobile,
    mobile,
    area: offCode,
    offCode,
    mru,
    mruSection: mru,
    cccFeeder: mru,
    disconnectionReason: `Outstanding Bill (D2 Net O/S: ${outstandingDue})`,
    assignedWorkerId: String(entry.workerId || entry.assignedWorkerId || entry["Worker ID"] || "").trim(),
    assignedWorkerName: String(
      (entry.assignedWorkerName && entry.assignedWorkerName !== "Worker" ? entry.assignedWorkerName : "") || (entry.workerName && entry.workerName !== "Worker" ? entry.workerName : "") || (entry["Worker Name"] && entry["Worker Name"] !== "Worker" ? entry["Worker Name"] : "") || agency || ""
    ).trim(),
    assignedAgency: agency,
    agency,
    status,
    taskStatus: status,
    disconStatus: status,
    disconDate: reportDate,
    workerReport: notes,
    workerRemarks: notes,
    notes,
    reportDate,
    reportTime: String(entry.reportTime || "").trim(),
    submittedBy: String(entry.submittedBy || entry.workerName || "").trim(),
    createdAt: uploadDate || lastUpdated || (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: lastUpdated || (/* @__PURE__ */ new Date()).toISOString(),
    lastUpdated,
    completionPercentage: status === "COMPLETED" || status === "DISCONNECT" || status === "PAID" ? 100 : status === "IN PROGRESS" ? 50 : 0,
    photoUrl: imageUrl,
    imageUrl,
    outstandingDue,
    d2NetOs: outstandingDue,
    dueDateRange,
    osDueDateRange: dueDateRange,
    baseClass,
    classType: consumerClass,
    deviceType: device,
    device,
    priority,
    paidAmount,
    paidDate,
    paymentDate: paidDate,
    paidType,
    paymentReference: paidType,
    paymentStatus,
    gisPole,
    natureOfConn,
    govNonGov,
    outstandingAfter,
    nextPaymentDate,
    paymentSource,
    uploadDate,
    latitude,
    longitude,
    statusHistory: Array.isArray(entry.statusHistory) ? entry.statusHistory : []
  };
}
var activeGasWriteCount = 0;
var gasWriteQueue = Promise.resolve();
function enqueueGasWrite(taskFn) {
  activeGasWriteCount++;
  const next = gasWriteQueue.catch(() => {
  }).then(async () => {
    try {
      return await taskFn();
    } finally {
      activeGasWriteCount = Math.max(0, activeGasWriteCount - 1);
    }
  });
  gasWriteQueue = next.catch(() => {
  });
  return next;
}
function isValidDisconnectionConsumerRow(e) {
  if (!e || typeof e !== "object") return false;
  const rawStatus = String(
    e["Discon Status"] || e.disconStatus || e.taskStatus || e.status || e["Status"] || ""
  ).trim().toUpperCase();
  if (rawStatus === "DELETED" || rawStatus === "[DELETED_BY_ADMIN]") {
    return false;
  }
  const rawCId = String(
    e["Consumer Id"] ?? e["Consumer ID"] ?? e.consumerId ?? e.accountNumber ?? e["Consumer No"] ?? ""
  ).trim();
  const isInvalidId = !rawCId || /^(PWR-DIS-|TASK-DISC-|DISC[-_]|SUB-|ROW-|SL\s*\d+|ID$|N\/A$|null$|undefined$|none$|-+$)/i.test(rawCId);
  if (isInvalidId) return false;
  const rawName = String(
    e["Name"] ?? e.Name ?? e["Consumer Name"] ?? e.consumerName ?? e.name ?? ""
  ).trim();
  const isInvalidName = !rawName || rawName.length < 2 || /^(Worker|Consumer|Consumer\s*\(.*\)|Unnamed(\s+Consumer)?|Unknown(\s+Consumer)?|Demo.*|Sample.*|Test.*|N\/A|null|undefined|none|-+)$/i.test(rawName);
  if (isInvalidName) return false;
  return true;
}
(function purgeBogusDisconnectionRecordsFromDisk() {
  try {
    let discOverlayChanged = false;
    const now = Date.now();
    for (const [k, v] of Array.from(localDisconnectionOverlayMap.entries())) {
      const isStaleOrSynced = !v || v._syncedToSheet === true || !v._localUpdatedAt || now - Number(v._localUpdatedAt) >= 35e3;
      if (!isValidDisconnectionConsumerRow(v) || isStaleOrSynced) {
        localDisconnectionOverlayMap.delete(k);
        discOverlayChanged = true;
      }
    }
    if (discOverlayChanged) saveDiscOverlayToDisk();
    let entriesOverlayChanged = false;
    for (const [k, v] of Array.from(localEntriesOverlayMap.entries())) {
      const cat = String(v?.category || v?.Category || "").toUpperCase().trim();
      if ((cat === "DISCONNECTION" || cat === "DISCONNECT") && !isValidDisconnectionConsumerRow(v)) {
        localEntriesOverlayMap.delete(k);
        entriesOverlayChanged = true;
      }
    }
    if (entriesOverlayChanged) saveEntriesOverlayToDisk();
    if (cachedEntriesState && Array.isArray(cachedEntriesState.entries)) {
      const beforeLen = cachedEntriesState.entries.length;
      cachedEntriesState.entries = cachedEntriesState.entries.filter((e) => {
        const cat = String(e?.category || e?.Category || "").toUpperCase().trim();
        if (cat === "DISCONNECTION" || cat === "DISCONNECT") {
          return isValidDisconnectionConsumerRow(e);
        }
        return true;
      });
      if (cachedEntriesState.entries.length !== beforeLen) {
        try {
          fs2.writeFileSync(ENTRIES_CACHE_FILE, JSON.stringify(cachedEntriesState.entries), "utf-8");
        } catch {
        }
      }
    }
  } catch {
  }
})();
var cachedDisconnectionState = null;
try {
  if (fs2.existsSync(DISC_CACHE_FILE)) {
    const diskTasks = JSON.parse(fs2.readFileSync(DISC_CACHE_FILE, "utf-8"));
    if (Array.isArray(diskTasks)) {
      const validDiskTasks = diskTasks.filter(
        (t) => !isRecordDeleted(t) && isValidDisconnectionConsumerRow(t)
      );
      if (validDiskTasks.length !== diskTasks.length) {
        try {
          fs2.writeFileSync(DISC_CACHE_FILE, JSON.stringify(validDiskTasks), "utf-8");
        } catch {
        }
      }
      if (validDiskTasks.length > 0) {
        cachedDisconnectionState = { tasks: validDiskTasks, timestamp: 0 };
      }
    }
  }
} catch {
}
var DISCONNECTION_CACHE_TTL_MS = 8e3;
function normalizeConsumerIdKey(val) {
  if (val === void 0 || val === null) return "";
  let s = String(val).trim();
  s = s.replace(/^(PWR-DIS-|TASK-DISC-|SUB-DISC-|PWR-)/i, "").trim();
  s = s.replace(/\.0+$/, "");
  s = s.replace(/[, \-_]/g, "");
  if (/^\d+$/.test(s)) {
    s = s.replace(/^0+/, "") || "0";
  }
  return s.toLowerCase();
}
function mergeSheetDisconnectionTasksWithOverlay(sheetTasks) {
  const mergedMap = /* @__PURE__ */ new Map();
  const now = Date.now();
  let overlayChanged = false;
  for (const t of sheetTasks) {
    if (isRecordDeleted(t) || !isValidDisconnectionConsumerRow(t)) continue;
    const key = normalizeConsumerIdKey(t.consumerId || t["Consumer Id"] || t.taskId);
    if (!key) continue;
    const ov = localDisconnectionOverlayMap.get(key) || (t.taskId ? localDisconnectionOverlayMap.get(normalizeConsumerIdKey(t.taskId)) : void 0);
    if (ov && !isRecordDeleted(ov) && isValidDisconnectionConsumerRow(ov)) {
      const sheetStatus = String(t.taskStatus || t.disconStatus || t["Discon Status"] || "PENDING").trim().toUpperCase();
      const ovStatus = String(ov.taskStatus || ov.disconStatus || ov["Discon Status"] || "PENDING").trim().toUpperCase();
      const sheetNotes = String(t.notes || t["Notes"] || t.workerRemarks || "").trim();
      const ovNotes = String(ov.notes || ov["Notes"] || ov.workerRemarks || "").trim();
      const sheetMatchesOverlay = sheetStatus === ovStatus && sheetNotes === ovNotes;
      const isRecentUnsynced = !ov._syncedToSheet && Boolean(ov._localUpdatedAt) && now - Number(ov._localUpdatedAt) < 35e3;
      if (!sheetMatchesOverlay && isRecentUnsynced && (ovStatus !== "PENDING" || ovNotes !== "" || ov._hasUserRemarkUpdate)) {
        mergedMap.set(key, {
          ...t,
          ...ov,
          consumerName: ov.consumerName || t.consumerName || t["Name"] || "",
          "Name": ov["Name"] || ov.consumerName || t["Name"] || t.consumerName || "",
          consumerAddress: ov.consumerAddress || t.consumerAddress || t["Address"] || "",
          "Address": ov["Address"] || ov.consumerAddress || t["Address"] || t.consumerAddress || "",
          outstandingDue: ov.outstandingDue || t.outstandingDue || t["D2 Net O/S"] || "",
          "D2 Net O/S": ov["D2 Net O/S"] || ov.outstandingDue || t["D2 Net O/S"] || t.outstandingDue || ""
        });
      } else {
        localDisconnectionOverlayMap.delete(key);
        overlayChanged = true;
        if (mergedMap.has(key)) {
          const existing = mergedMap.get(key);
          const tStatus = String(t.taskStatus || t.disconStatus || t["Discon Status"] || "PENDING").trim().toUpperCase();
          const existingStatus = String(existing.taskStatus || existing.disconStatus || existing["Discon Status"] || "PENDING").trim().toUpperCase();
          const tNotes = String(t.notes || t["Notes"] || t.workerRemarks || "").trim();
          const existingNotes = String(existing.notes || existing["Notes"] || existing.workerRemarks || "").trim();
          if (tStatus !== "PENDING" && existingStatus === "PENDING" || tNotes && !existingNotes) {
            mergedMap.set(key, { ...existing, ...t });
          }
        } else {
          mergedMap.set(key, t);
        }
      }
    } else {
      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key);
        const tStatus = String(t.taskStatus || t.disconStatus || t["Discon Status"] || "PENDING").trim().toUpperCase();
        const existingStatus = String(existing.taskStatus || existing.disconStatus || existing["Discon Status"] || "PENDING").trim().toUpperCase();
        const tNotes = String(t.notes || t["Notes"] || t.workerRemarks || "").trim();
        const existingNotes = String(existing.notes || existing["Notes"] || existing.workerRemarks || "").trim();
        if (tStatus !== "PENDING" && existingStatus === "PENDING" || tNotes && !existingNotes) {
          mergedMap.set(key, { ...existing, ...t });
        }
      } else {
        mergedMap.set(key, t);
      }
    }
  }
  for (const [key, ov] of Array.from(localDisconnectionOverlayMap.entries())) {
    const normKey = normalizeConsumerIdKey(key || ov.consumerId || ov["Consumer Id"] || ov.taskId);
    if (!normKey) continue;
    if (isRecordDeleted(ov) || !isValidDisconnectionConsumerRow(ov)) {
      localDisconnectionOverlayMap.delete(key);
      overlayChanged = true;
      continue;
    }
    if (!mergedMap.has(normKey)) {
      const isRecentUnsynced = !ov._syncedToSheet && Boolean(ov._localUpdatedAt) && now - Number(ov._localUpdatedAt) < 35e3;
      if (isRecentUnsynced) {
        mergedMap.set(normKey, ov);
      } else {
        localDisconnectionOverlayMap.delete(key);
        overlayChanged = true;
      }
    }
  }
  if (overlayChanged) {
    saveDiscOverlayToDisk();
  }
  const sortedValues = Array.from(mergedMap.values()).sort((a, b) => {
    const idA = String(a.consumerId || a["Consumer Id"] || a.taskId || "").trim();
    const idB = String(b.consumerId || b["Consumer Id"] || b.taskId || "").trim();
    return idA.localeCompare(idB, void 0, { numeric: true });
  });
  const finalTasks = sortedValues.map((t, idx) => {
    const cIdKey = String(t.consumerId || t["Consumer Id"] || t.taskId || "").replace(/^(TASK-DISC-|PWR-DIS-|SUB-DISC-)/i, "").trim().toLowerCase();
    const rawSt = String(t.taskStatus || t.disconStatus || t["Discon Status"] || "PENDING").trim().toUpperCase();
    const isInitialPending = rawSt === "" || rawSt === "PENDING" || rawSt === "CONNECTED";
    let rawNotes = String(t.notes || t["Notes"] || t.workerRemarks || t.workerReport || "").trim();
    const cleanBaseNotes = rawNotes.replace(/\[REISSUE_REQ[^\]]*\]/gi, "").replace(/\[REISSUE_APPROVED[^\]]*\]/gi, "").replace(/\[REISSUE_REJECTED[^\]]*\]/gi, "").replace(/\s*\|\s*$/, "").trim();
    let reissueRequested = Boolean(t.reissueRequested || /\[REISSUE_REQ:/i.test(rawNotes));
    let reissueApproved = Boolean(t.reissueApproved || rawSt === "REISSUE" || /\[REISSUE_APPROVED/i.test(rawNotes));
    let reissueRejected = Boolean(t.reissueRejected || /\[REISSUE_REJECTED/i.test(rawNotes));
    let reissueRequestedBy = t.reissueRequestedBy || "";
    let reissueRequestedAt = t.reissueRequestedAt || "";
    const reqMatch = rawNotes.match(/\[REISSUE_REQ:([^|\]]*)(?:\|([^\]]*))?\]/i);
    if (reqMatch) {
      reissueRequestedBy = reissueRequestedBy || reqMatch[1] || "";
      reissueRequestedAt = reissueRequestedAt || reqMatch[2] || "";
    }
    const rEntry = cIdKey ? reissueRequestsMap.get(cIdKey) : void 0;
    if (rEntry) {
      if (rEntry.status === "PENDING") {
        reissueRequested = true;
        reissueApproved = false;
        reissueRejected = false;
        reissueRequestedBy = rEntry.requestedBy || reissueRequestedBy || "Worker";
        reissueRequestedAt = rEntry.requestedAt || reissueRequestedAt || "";
        rawNotes = `${cleanBaseNotes} [REISSUE_REQ:${reissueRequestedBy}|${reissueRequestedAt}]`.trim();
      } else if (rEntry.status === "APPROVED") {
        reissueRequested = false;
        reissueApproved = true;
        reissueRejected = false;
        rawNotes = `${cleanBaseNotes} [REISSUE_APPROVED]`.trim();
      } else if (rEntry.status === "REJECTED") {
        reissueRequested = false;
        reissueApproved = false;
        reissueRejected = true;
        reissueRequestedBy = rEntry.requestedBy || reissueRequestedBy || "Worker";
        reissueRequestedAt = rEntry.requestedAt || reissueRequestedAt || "";
        rawNotes = `${cleanBaseNotes} [REISSUE_REJECTED]`.trim();
      } else if (rEntry.status === "COMPLETED") {
        reissueRequested = false;
        reissueApproved = false;
        reissueRejected = false;
        rawNotes = cleanBaseNotes;
      }
    } else if (isInitialPending) {
      reissueRequested = false;
      reissueApproved = false;
      reissueRejected = false;
    }
    const effectiveTaskStatus = reissueApproved ? "REISSUE" : t.taskStatus || t.disconStatus || t["Discon Status"] || "PENDING";
    return {
      ...t,
      serialNumber: formatSlNumber(idx + 1),
      taskStatus: effectiveTaskStatus,
      disconStatus: effectiveTaskStatus,
      status: effectiveTaskStatus,
      "Discon Status": effectiveTaskStatus,
      "Status": effectiveTaskStatus,
      notes: rawNotes,
      "Notes": rawNotes,
      workerRemarks: rawNotes,
      workerReport: rawNotes,
      reissueRequested,
      reissueApproved,
      reissueRejected,
      reissueRequestedBy,
      reissueRequestedAt
    };
  });
  return finalTasks;
}
async function syncSingleDisconnectionRowToSheet(taskOrRow) {
  if (!taskOrRow) return false;
  const rawCId = String(
    taskOrRow.consumerId ?? taskOrRow["Consumer Id"] ?? taskOrRow["Consumer ID"] ?? taskOrRow.accountNumber ?? ""
  ).replace(/^(PWR-DIS-|TASK-DISC-|SUB-DISC-)/i, "").trim();
  if (!rawCId) return false;
  const cIdKey = rawCId.toLowerCase();
  const existingCached = cachedDisconnectionState?.tasks?.find(
    (t) => String(t.consumerId || t["Consumer Id"] || "").trim().toLowerCase() === cIdKey
  ) || localDisconnectionOverlayMap.get(cIdKey) || {};
  const mergedSource = {
    ...existingCached,
    ...taskOrRow,
    consumerId: rawCId,
    "Consumer Id": rawCId,
    Name: taskOrRow.Name || taskOrRow["Name"] || taskOrRow.consumerName || existingCached.Name || existingCached["Name"] || existingCached.consumerName || ""
  };
  if (!isValidDisconnectionConsumerRow(mergedSource)) return false;
  const rawImgVal = String(mergedSource.photoDataUrl || mergedSource.photoUrl || mergedSource["Image"] || mergedSource.image || "").trim();
  if (rawImgVal && (rawImgVal.startsWith("data:") || rawImgVal.includes("/api/stored-images/"))) {
    const clickablePhotoUrl = await convertDataUrlToClickablePhotoLink(rawImgVal, rawCId);
    mergedSource.photoUrl = clickablePhotoUrl;
    mergedSource.imageUrl = clickablePhotoUrl;
    mergedSource.image = clickablePhotoUrl;
    mergedSource["Image"] = clickablePhotoUrl;
    delete mergedSource.photoDataUrl;
    if (cachedDisconnectionState && Array.isArray(cachedDisconnectionState.tasks)) {
      const idx = cachedDisconnectionState.tasks.findIndex(
        (t) => String(t.consumerId || t["Consumer Id"] || "").trim().toLowerCase() === cIdKey
      );
      if (idx !== -1) {
        cachedDisconnectionState.tasks[idx] = {
          ...cachedDisconnectionState.tasks[idx],
          photoUrl: clickablePhotoUrl,
          imageUrl: clickablePhotoUrl,
          "Image": clickablePhotoUrl
        };
      }
    }
  }
  const full33 = buildComplete33ColumnPayload(mergedSource);
  const cId = String(full33.consumerId || full33["Consumer Id"] || "").trim();
  if (!cId) return false;
  const discId = `PWR-DIS-${cId}`;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const safeBaseClass = full33["Base Class"] || existingCached["Base Class"] || existingCached.baseClass || " ";
  const safeClass = full33["Class"] || existingCached["Class"] || existingCached.classType || " ";
  const safeDevice = full33["Device"] || existingCached["Device"] || existingCached.deviceType || " ";
  const safeNotes = full33["Notes"] || " ";
  const cleanedAgencyVal = String(full33["Agency"] || existingCached["Agency"] || existingCached.assignedAgency || "").replace(/\s*\(ID:[^)]+\)/gi, "").trim();
  const safeAgency = cleanedAgencyVal || " ";
  const targetSheetId = GOOGLE_SHEET_ID;
  const gasPayload = {
    ...full33,
    id: discId,
    submissionId: discId,
    spreadsheetId: targetSheetId,
    baseClass: safeBaseClass,
    "Base Class": safeBaseClass,
    class: safeClass,
    classType: safeClass,
    consumerClass: safeClass,
    "Class": safeClass,
    device: safeDevice,
    deviceType: safeDevice,
    bClassPhase: safeDevice,
    "Device": safeDevice,
    "BClass/Phase": safeDevice,
    "Agency": safeAgency,
    agency: safeAgency,
    assignedAgency: safeAgency,
    workerName: safeAgency,
    "Notes": safeNotes,
    notes: safeNotes,
    "Remark": safeNotes,
    "Remarks": safeNotes,
    workerRemarks: safeNotes,
    lastUpdated: nowIso,
    "Last Updated": nowIso,
    updatedAt: nowIso
  };
  if (taskOrRow._isNewInsert) {
    try {
      const crFirst = await callGoogleAppsScript(
        "createEntry",
        { id: discId, submissionId: discId, consumerId: cId, "Consumer Id": cId, category: "Disconnection", _isNewInsert: true, ...gasPayload, data: gasPayload },
        "POST",
        25e3
      );
      if (crFirst && crFirst.success !== false) {
        return true;
      }
    } catch {
    }
  }
  try {
    const discRes = await callGoogleAppsScript(
      "submitDisconnectionReport",
      { id: discId, submissionId: discId, consumerId: cId, "Consumer Id": cId, ...gasPayload, data: gasPayload, _isNewInsert: false },
      "POST",
      25e3
    );
    if (discRes && discRes.success !== false) {
      return true;
    }
  } catch (err) {
    console.warn(`[Disconnection Sheet Sync] submitDisconnectionReport notice for ${cId}:`, err);
  }
  try {
    const upRes = await callGoogleAppsScript(
      "updateEntry",
      { id: discId, submissionId: discId, consumerId: cId, "Consumer Id": cId, category: "Disconnection", ...gasPayload, data: gasPayload },
      "POST",
      25e3
    );
    if (upRes && upRes.success === true) {
      return true;
    }
  } catch (err) {
    console.warn(`[Disconnection Sheet Sync] updateEntry notice for ${cId}:`, err);
  }
  return false;
}
async function fetchDisconnectionTasksFromGoogleSheet() {
  try {
    if (activeGasWriteCount > 0) {
      await gasWriteQueue.catch(() => {
      });
    }
    gasCache.delete("getDisconnectionTasks_{}");
    gasCache.delete('entries_{"category":"Disconnection"}');
    gasCache.delete('entries:{"category":"Disconnection"}');
    let rawTasks = [];
    const entriesRes = await callGoogleAppsScript("entries", { category: "Disconnection" }, "GET", 2e4);
    if (entriesRes && entriesRes.success !== false) {
      const candidateEntries = Array.isArray(entriesRes.entries) ? entriesRes.entries : Array.isArray(entriesRes.data?.entries) ? entriesRes.data.entries : Array.isArray(entriesRes.data) ? entriesRes.data : [];
      if (candidateEntries.length > 0) {
        rawTasks = candidateEntries;
      }
    }
    if (rawTasks.length === 0) {
      const gasRes = await callGoogleAppsScript("getDisconnectionTasks", {}, "GET", 2e4);
      if (gasRes && gasRes.success !== false) {
        const candidate = Array.isArray(gasRes.tasks) ? gasRes.tasks : Array.isArray(gasRes.data?.tasks) ? gasRes.data.tasks : Array.isArray(gasRes.data) ? gasRes.data : [];
        if (candidate.length > 0) {
          rawTasks = candidate;
        }
      }
    }
    if (rawTasks.length > 0) {
      const validRawTasks = rawTasks.filter((t) => !isRecordDeleted(t) && isValidDisconnectionConsumerRow(t));
      const convertedList = validRawTasks.map((t, idx) => convertSheetEntryToDisconnectionTask(t, idx + 1));
      const merged = mergeSheetDisconnectionTasksWithOverlay(convertedList);
      cachedDisconnectionState = {
        tasks: merged,
        timestamp: Date.now()
      };
      try {
        fs2.writeFileSync(DISC_CACHE_FILE, JSON.stringify(merged), "utf-8");
      } catch {
      }
      for (const [k, ov] of localDisconnectionOverlayMap.entries()) {
        if (ov && !ov._syncedToSheet && isValidDisconnectionConsumerRow(ov)) {
          enqueueGasWrite(async () => {
            const ok = await syncSingleDisconnectionRowToSheet(ov);
            if (ok) {
              localDisconnectionOverlayMap.delete(k);
              saveDiscOverlayToDisk();
            }
            return ok;
          }).catch(() => {
          });
        }
      }
      return merged;
    }
  } catch (err) {
    console.warn("[fetchDisconnectionTasksFromGoogleSheet] Notice:", err);
  }
  return mergeSheetDisconnectionTasksWithOverlay(cachedDisconnectionState?.tasks || []);
}
function refreshDisconnectionFromSheetInBackground() {
  if (isRefreshingDiscInBg || activeGasWriteCount > 0) return;
  isRefreshingDiscInBg = true;
  (async () => {
    try {
      await fetchDisconnectionTasksFromGoogleSheet();
    } catch (err) {
      console.warn("[Background Disconnection Sync] Notice:", err);
    } finally {
      isRefreshingDiscInBg = false;
    }
  })();
}
if (!process.env.VERCEL) {
  setInterval(() => {
    if (activeGasWriteCount === 0) {
      refreshDisconnectionFromSheetInBackground();
    }
  }, 1e4).unref();
  setInterval(() => {
    if (activeGasWriteCount === 0) {
      refreshEntriesFromSheetInBackground();
    }
  }, 9e4).unref();
}
app.all("/api/disconnection-tasks/refresh-sheet", async (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    gasCache.clear();
    const tasks = await fetchDisconnectionTasksFromGoogleSheet();
    const stats = computeLocalStats(tasks);
    return res.json({
      success: true,
      sheetConnected: true,
      spreadsheetId: GOOGLE_SHEET_ID,
      spreadsheetUrl: GOOGLE_SHEET_URL,
      sheetName: "Disconnection",
      fetchedCount: tasks.length,
      tasks,
      stats
    });
  } catch (err) {
    const fallbackTasks = mergeSheetDisconnectionTasksWithOverlay(cachedDisconnectionState?.tasks || []);
    return res.json({
      success: false,
      sheetConnected: false,
      spreadsheetId: GOOGLE_SHEET_ID,
      spreadsheetUrl: GOOGLE_SHEET_URL,
      sheetName: "Disconnection",
      fetchedCount: fallbackTasks.length,
      tasks: fallbackTasks,
      stats: computeLocalStats(fallbackTasks),
      error: err?.message || "Failed to refresh from Google Sheet"
    });
  }
});
app.get("/api/disconnection-tasks", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  const query = req.query;
  const workerId = String(query.workerId || "").toLowerCase().trim();
  const workerName = String(query.workerName || "").toLowerCase().trim();
  const forceRefresh = query.refresh === "true" || query.force === "true";
  const officeSheetId = getTargetSpreadsheetId(req);
  if (officeSheetId) {
    const officeData = await fetchOfficeSpreadsheetData(officeSheetId, forceRefresh);
    const stats2 = computeLocalStats(officeData.tasks, workerId, workerName);
    return res.json({
      success: true,
      sheetConnected: true,
      spreadsheetId: officeSheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${officeSheetId}/edit`,
      sheetName: "Disconnection",
      tasks: officeData.tasks,
      stats: stats2
    });
  }
  if (cachedDisconnectionState && Array.isArray(cachedDisconnectionState.tasks) && cachedDisconnectionState.tasks.length > 0) {
    const isStale = Date.now() - cachedDisconnectionState.timestamp > DISCONNECTION_CACHE_TTL_MS;
    if (forceRefresh || isStale) {
      if (forceRefresh) {
        gasCache.delete("getDisconnectionTasks_{}");
        gasCache.delete('entries_{"category":"Disconnection"}');
        gasCache.delete('entries:{"category":"Disconnection"}');
        const freshTasks2 = await Promise.race([
          fetchDisconnectionTasksFromGoogleSheet(),
          new Promise(
            (resolve) => setTimeout(() => resolve(mergeSheetDisconnectionTasksWithOverlay(cachedDisconnectionState.tasks)), 5e3)
          )
        ]);
        const stats3 = computeLocalStats(freshTasks2, workerId, workerName);
        return res.json({
          success: true,
          sheetConnected: true,
          spreadsheetId: GOOGLE_SHEET_ID,
          spreadsheetUrl: GOOGLE_SHEET_URL,
          sheetName: "Disconnection",
          tasks: freshTasks2,
          stats: stats3
        });
      }
      refreshDisconnectionFromSheetInBackground();
    }
    const cleanList = mergeSheetDisconnectionTasksWithOverlay(cachedDisconnectionState.tasks);
    const stats2 = computeLocalStats(cleanList, workerId, workerName);
    return res.json({
      success: true,
      sheetConnected: true,
      spreadsheetId: GOOGLE_SHEET_ID,
      spreadsheetUrl: GOOGLE_SHEET_URL,
      sheetName: "Disconnection",
      tasks: cleanList,
      stats: stats2
    });
  }
  const freshTasks = await fetchDisconnectionTasksFromGoogleSheet();
  const stats = computeLocalStats(freshTasks, workerId, workerName);
  return res.json({
    success: true,
    sheetConnected: true,
    spreadsheetId: GOOGLE_SHEET_ID,
    spreadsheetUrl: GOOGLE_SHEET_URL,
    sheetName: "Disconnection",
    tasks: freshTasks,
    stats
  });
});
function buildComplete33ColumnPayload(t) {
  const cId = String(t["Consumer Id"] ?? t.consumerId ?? t["Consumer ID"] ?? t.accountNumber ?? "").trim();
  const name = String(t["Name"] ?? t["Consumer Name"] ?? t.consumerName ?? t.name ?? "").trim();
  const offCode = String(t["off_code"] ?? t.offCode ?? t.area ?? "").trim();
  const mru = String(t["MRU"] ?? t.mru ?? t.mruSection ?? "").trim();
  const address = String(t["Address"] ?? t.consumerAddress ?? t.address ?? "").trim();
  const baseClass = String(t["Base Class"] ?? t.baseClass ?? "").trim();
  const consumerClass = String(t["Class"] ?? t.classType ?? t.class ?? "").trim();
  const device = String(t["Device"] ?? t.device ?? t.deviceType ?? "").trim();
  const dueDateRange = String(t["O/S Duedate Range"] ?? t["O/S Due date Range"] ?? t.dueDateRange ?? "").trim();
  const d2NetOs = String(t["D2 Net O/S"] ?? t.outstandingDue ?? t.arrearAmount ?? "").trim();
  const mobile = String(t["Mobile"] ?? t["Mobile Number"] ?? t.phoneNumber ?? t.mobile ?? "").trim();
  const numberVal = String(t["Number"] ?? t.number ?? t["Meter"] ?? "").trim();
  const status = String(t["Discon Status"] ?? t.taskStatus ?? t.disconStatus ?? t.status ?? "PENDING").trim().toUpperCase();
  const notes = String(t["Notes"] ?? t.notes ?? t.workerRemarks ?? t.workerReport ?? "").replace(/\[DELETED_BY_ADMIN\]/gi, "").trim();
  const disconDate = String(t["Discon Date"] ?? t.disconDate ?? t.reportDate ?? "").trim();
  const reading = String(t["Reading"] ?? t.reading ?? t.meterReading ?? "").trim();
  const image = String(t["Image"] ?? t.image ?? t.photoUrl ?? "").trim();
  const paymentStatus = status === "PAID" ? "PAID" : "PENDING";
  const gisPole = String(t["Gis Pole"] || t.gisPole || t.poleNo || "").trim();
  const agency = String(
    t["Agency"] || t.Agency || t.agency || t.assignedAgency || t["Agency Name"] || (t.assignedWorkerName && t.assignedWorkerName !== "Worker" ? t.assignedWorkerName : "") || (t.workerName && t.workerName !== "Worker" ? t.workerName : "") || ""
  ).trim();
  const natureOfConn = String(t["Nature of Conn"] || t.natureOfConn || "").trim();
  const govNonGov = String(t["Gov/Non-Gov"] ?? t.govNonGov ?? "").trim();
  const lastUpdated = String(t["Last Updated"] ?? t.lastUpdated ?? t.updatedAt ?? "").trim();
  const priority = String(t["Priority"] ?? t.priority ?? "").trim();
  const paidAmount = String(t["Paid Amount"] ?? t.paidAmount ?? "").trim();
  const paidDate = String(t["Paid Date"] ?? t.paidDate ?? t.paymentDate ?? "").trim();
  const paidType = String(t["Paid Type"] ?? t.paidType ?? t.paymentReference ?? "").trim();
  const outstandingAfter = String(t["Outstanding After"] ?? t.outstandingAfter ?? "").trim();
  const nextPaymentDate = String(t["Next Payment Date"] ?? t.nextPaymentDate ?? "").trim();
  const paymentSource = String(t["Payment Source"] ?? t.paymentSource ?? "").trim();
  const uploadDate = String(t["Upload Date"] ?? t.uploadDate ?? t.createdAt ?? "").trim();
  const discId = `PWR-DIS-${cId}`;
  const latVal = String(t["Latitude"] ?? t.latitude ?? "").trim();
  const lngVal = String(t["Longitude"] ?? t.longitude ?? "").trim();
  return {
    id: discId,
    submissionId: discId,
    category: "Disconnection",
    consumerId: cId,
    consumerName: name,
    name,
    address,
    consumerAddress: address,
    offCode,
    off_code: offCode,
    mru,
    mruSection: mru,
    baseClass,
    class: consumerClass,
    classType: consumerClass,
    consumerClass,
    device,
    deviceType: device,
    bClassPhase: device,
    dueDateRange,
    osDueDateRange: dueDateRange,
    d2NetOs,
    outstandingDue: d2NetOs,
    arrearAmount: d2NetOs,
    mobile,
    mobileNumber: mobile,
    phoneNumber: mobile,
    phone: mobile,
    number: numberVal,
    meterNo: numberVal,
    meterNumber: (device && device.toUpperCase() !== "I" && device.toUpperCase() !== "III" ? device : "") || numberVal,
    latitude: latVal,
    longitude: lngVal,
    status,
    disconStatus: status,
    taskStatus: status,
    disconDate,
    reportDate: disconDate,
    image,
    photoUrl: image,
    reading,
    meterReading: reading,
    paymentStatus,
    gisPole,
    poleNo: gisPole,
    agency,
    assignedAgency: agency,
    notes,
    workerRemarks: notes,
    workerReport: notes,
    natureOfConn,
    govNonGov,
    lastUpdated,
    updatedAt: lastUpdated,
    priority,
    paidAmount,
    paidDate,
    paymentDate: paidDate,
    paidType,
    paymentReference: paidType,
    outstandingAfter,
    nextPaymentDate,
    paymentSource,
    uploadDate,
    createdAt: uploadDate,
    "MRU": mru,
    "Consumer Id": cId,
    "Name": name,
    "Consumer Name": name,
    "Address": address,
    "Base Class": baseClass,
    "Class": consumerClass,
    "Device": device,
    "BClass/Phase": device,
    "O/S Duedate Range": dueDateRange,
    "O/S Due date Range": dueDateRange,
    "D2 Net O/S": d2NetOs,
    "Mobile": mobile,
    "Mobile Number": mobile,
    "Number": numberVal,
    "Meter": numberVal,
    "Latitude": latVal,
    "Longitude": lngVal,
    "Discon Status": status,
    "Discon Date": disconDate,
    "Image": image,
    "Reading": reading,
    "Payment Status": paymentStatus,
    "Gis Pole": gisPole,
    "Agency": agency,
    "Notes": notes,
    "Remarks": notes,
    "Nature of Conn": natureOfConn,
    "Gov/Non-Gov": govNonGov,
    "Last Updated": lastUpdated,
    "Priority": priority,
    "Paid Amount": paidAmount,
    "Paid Date": paidDate,
    "Paid Type": paidType,
    "Outstanding After": outstandingAfter,
    "Next Payment Date": nextPaymentDate,
    "Payment Source": paymentSource,
    "Upload Date": uploadDate
  };
}
app.post("/api/disconnection-tasks/upload", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const rawTasksArray = Array.isArray(req.body?.tasks) ? req.body.tasks : Array.isArray(req.body) ? req.body : [];
    const tasksArray = rawTasksArray.filter(isValidDisconnectionConsumerRow);
    if (tasksArray.length === 0) {
      return res.json({ success: true, count: 0, insertedCount: 0, updatedCount: 0, tasks: cachedDisconnectionState?.tasks || [] });
    }
    let insertedCount = 0;
    let updatedCount = 0;
    const preparedPayloads = [];
    let nextIndex = (cachedDisconnectionState?.tasks?.length || 0) + 1;
    for (const rawTask of tasksArray) {
      const fullRow = buildComplete33ColumnPayload(rawTask);
      const cIdKey = String(fullRow.consumerId || fullRow.id || "").trim().toLowerCase();
      if (!cIdKey) continue;
      deletedTombstoneSet.delete(cIdKey);
      deletedTombstoneSet.delete(`task-disc-${cIdKey}`);
      deletedTombstoneSet.delete(`pwr-dis-${cIdKey}`);
      const existingInCache = cachedDisconnectionState?.tasks?.find(
        (ct) => String(ct.consumerId || ct["Consumer Id"] || "").trim().toLowerCase() === cIdKey
      );
      const isNewConsumer = !existingInCache && !localDisconnectionOverlayMap.has(cIdKey);
      if (!isNewConsumer) {
        updatedCount++;
      } else {
        insertedCount++;
      }
      const convertedTask = convertSheetEntryToDisconnectionTask(
        { ...existingInCache || {}, ...fullRow },
        nextIndex++
      );
      convertedTask._localUpdatedAt = Date.now();
      convertedTask._syncedToSheet = false;
      convertedTask._isNewInsert = isNewConsumer;
      localDisconnectionOverlayMap.set(cIdKey, convertedTask);
      preparedPayloads.push({ ...fullRow, _isNewInsert: isNewConsumer });
    }
    saveTombstonesToDisk();
    saveDiscOverlayToDisk();
    const mergedAllTasks = mergeSheetDisconnectionTasksWithOverlay(cachedDisconnectionState?.tasks || []);
    cachedDisconnectionState = { tasks: mergedAllTasks, timestamp: Date.now() };
    try {
      fs2.writeFileSync(DISC_CACHE_FILE, JSON.stringify(mergedAllTasks), "utf-8");
    } catch {
    }
    const syncRow = (rowPayload) => {
      const k = String(rowPayload.consumerId || rowPayload.id || "").trim().toLowerCase();
      enqueueGasWrite(async () => {
        const ok = await syncSingleDisconnectionRowToSheet(rowPayload);
        if (ok) {
          localDisconnectionOverlayMap.delete(k);
          saveDiscOverlayToDisk();
          gasCache.clear();
        }
        return ok;
      }).catch(() => {
      });
    };
    for (const rowPayload of preparedPayloads) {
      syncRow(rowPayload);
    }
    return res.json({
      success: true,
      count: preparedPayloads.length,
      insertedCount,
      updatedCount,
      tasks: mergedAllTasks,
      message: `Successfully uploaded ${preparedPayloads.length} consumer records (${insertedCount} new, ${updatedCount} updated) to Disconnection sheet.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Failed to upload disconnection list" });
  }
});
var BACKEND_DISCONNECTION_HEADERS_33 = [
  "off_code",
  "MRU",
  "Consumer Id",
  "Name",
  "Address",
  "Base Class",
  "Class",
  "Device",
  "O/S Duedate Range",
  "D2 Net O/S",
  "Mobile",
  "Number",
  "Latitude",
  "Longitude",
  "Discon Status",
  "Discon Date",
  "Image",
  "Reading",
  "Payment Status",
  "Gis Pole",
  "Agency",
  "Notes",
  "Nature of Conn",
  "Gov/Non-Gov",
  "Last Updated",
  "Priority",
  "Paid Amount",
  "Paid Date",
  "Paid Type",
  "Outstanding After",
  "Next Payment Date",
  "Payment Source",
  "Upload Date"
];
app.get("/api/disconnection/sample-excel", (req, res) => {
  try {
    const ws = XLSX.utils.aoa_to_sheet([BACKEND_DISCONNECTION_HEADERS_33]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Disconnection");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="WBSEDCL_Disconnection_Sheet_Template.xlsx"');
    res.send(buf);
  } catch (err) {
    res.status(500).send("Error generating Excel template: " + err.message);
  }
});
app.get("/api/disconnection/sample-csv", (req, res) => {
  try {
    const ws = XLSX.utils.aoa_to_sheet([BACKEND_DISCONNECTION_HEADERS_33]);
    const csv = XLSX.utils.sheet_to_csv(ws);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="WBSEDCL_Disconnection_Sheet_Template.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).send("Error generating CSV template: " + err.message);
  }
});
var genAIClient = null;
function getGenAI() {
  if (!genAIClient && process.env.GEMINI_API_KEY) {
    genAIClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genAIClient;
}
app.post("/api/disconnection-tasks/ocr", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const { base64Data, mimeType, fileName } = req.body;
    if (!base64Data) {
      return res.status(400).json({ success: false, error: "No image or document data provided for OCR" });
    }
    const ai = getGenAI();
    if (!ai) {
      return res.status(500).json({ success: false, error: "AI OCR service is not configured (GEMINI_API_KEY missing)" });
    }
    const cleanBase64 = String(base64Data).replace(/^data:[^;]+;base64,/, "");
    const cleanMime = mimeType || (fileName && fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    const prompt = `You are an expert utility operations data extraction assistant for WBSEDCL (West Bengal State Electricity Distribution Company Limited).
Analyze this uploaded document/image (${fileName || "document"}) containing electrical disconnection / defaulter consumer lists, spreadsheets, or notices.
Extract EVERY consumer record visible into a structured JSON array.

WBSEDCL Disconnection Sheet has 33 columns. Map and extract every row carefully:
- consumerId / "Consumer Id": string (9-digit consumer ID)
- consumerName / "Name": string (Full consumer name in UPPERCASE or Title Case)
- offCode / "off_code": string (Office/Substation code)
- mru / "MRU": string (MRU section)
- consumerAddress / "Address": string (Full consumer premises/village/address)
- phoneNumber / "Mobile": string (10-digit Indian mobile number)
- meterNumber / "Number": string (Meter serial number)
- outstandingDue / "D2 Net O/S": string (Outstanding arrear due amount in Rupees, numbers only)
- dueDateRange / "O/S Duedate Range": string (Bill or disconnection due date range)
- baseClass / "Base Class": string (e.g. "Domestic", "Commercial", "Industrial")
- classType / "Class": string (e.g. "Domestic", "Commercial")
- deviceType / "Device": string (Phase or device, e.g. "I", "III", or meter model)
- reading / "Reading": string (Meter reading if visible)
- gisPole / "Gis Pole": string (Pole number or GIS Pole reference)
- agency / "Agency": string (Agency name)
- notes / "Notes": string (Remarks or reason for disconnection)
- priority / "Priority": string ("URGENT" if amount > 10000 or marked urgent, otherwise "NORMAL")
- taskStatus / "Discon Status": string (Default "PENDING" if not already disconnected)

If a field is not visible in the document, use an empty string "" (do not invent fake data).

Return ONLY a valid JSON object matching this schema:
{
  "tasks": [
    {
      "consumerId": "string",
      "consumerName": "string",
      "offCode": "string",
      "mru": "string",
      "consumerAddress": "string",
      "phoneNumber": "string",
      "meterNumber": "string",
      "outstandingDue": "string",
      "dueDateRange": "string",
      "baseClass": "string",
      "classType": "string",
      "deviceType": "string",
      "reading": "string",
      "gisPole": "string",
      "agency": "POWER",
      "notes": "string",
      "priority": "NORMAL",
      "taskStatus": "PENDING",
      "off_code": "string",
      "MRU": "string",
      "Consumer Id": "string",
      "Name": "string",
      "Address": "string",
      "Base Class": "string",
      "Class": "string",
      "Device": "string",
      "O/S Duedate Range": "string",
      "D2 Net O/S": "string",
      "Mobile": "string",
      "Number": "string",
      "Discon Status": "PENDING"
    }
  ]
}`;
    const candidateModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    let lastAiError = null;
    let responseText = "";
    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                { inlineData: { mimeType: cleanMime, data: cleanBase64 } }
              ]
            }
          ],
          config: {
            responseMimeType: "application/json"
          }
        });
        if (response.text) {
          responseText = response.text;
          break;
        }
      } catch (aiErr) {
        lastAiError = aiErr;
        console.warn(`[Gemini OCR] Model ${modelName} notice:`, aiErr?.message || aiErr);
        if (String(aiErr?.message || "").includes("quota") || String(aiErr?.message || "").includes("resource_exhausted") || String(aiErr?.message || "").includes("overloaded")) {
          continue;
        }
        break;
      }
    }
    if (!responseText && lastAiError) {
      const isQuotaErr = String(lastAiError?.message || "").includes("quota") || String(lastAiError?.message || "").includes("resource_exhausted") || String(lastAiError?.message || "").includes("overloaded");
      return res.status(isQuotaErr ? 429 : 500).json({
        success: false,
        tasks: [],
        count: 0,
        error: isQuotaErr ? 'AI \u099F\u09CB\u0995\u09C7\u09A8 \u0995\u09CB\u099F\u09BE \u09B6\u09C7\u09B7 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964 \u0986\u09AA\u09A8\u09BF \u0997\u09C1\u0997\u09B2 \u09B6\u09BF\u099F\u09C7\u09B0 "Disconnection" \u099F\u09CD\u09AF\u09BE\u09AC\u09C7 \u09B8\u09B0\u09BE\u09B8\u09B0\u09BF \u09A1\u09C7\u099F\u09BE \u0995\u09AA\u09BF-\u09AA\u09C7\u09B8\u09CD\u099F \u0995\u09B0\u09C7 \u0985\u09A5\u09AC\u09BE \u09AE\u09CD\u09AF\u09BE\u09A8\u09C1\u09AF\u09BC\u09BE\u09B2 \u098F\u09A8\u09CD\u099F\u09CD\u09B0\u09BF \u0995\u09B0\u09C7 \u0995\u09BE\u099C \u099A\u09BE\u09B2\u09BF\u09AF\u09BC\u09C7 \u09AF\u09C7\u09A4\u09C7 \u09AA\u09BE\u09B0\u09C7\u09A8\u0964' : lastAiError?.message || "AI OCR extraction failed"
      });
    }
    let parsed = {};
    try {
      parsed = JSON.parse(responseText || "{}");
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : Array.isArray(parsed) ? parsed : [];
    return res.json({
      success: true,
      tasks,
      count: tasks.length
    });
  } catch (err) {
    console.error("[OCR Error]", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to extract text from document using OCR" });
  }
});
app.post("/api/disconnection-tasks/report", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  const report = req.body;
  const taskId = String(report.taskId || report.id || "").trim();
  const subId = String(report.submissionId || report.requestId || `REQ-${Date.now()}`).trim();
  if (subId && submissionIdMap.has(subId)) {
    return res.json(submissionIdMap.get(subId).result);
  }
  const newStatus = String(report.taskStatus || report.disconStatus || report["Discon Status"] || report.status || "COMPLETED").trim().toUpperCase();
  const cId = String(report.consumerId || report["Consumer Id"] || taskId).replace(/^(TASK-DISC-|PWR-DIS-|SUB-DISC-)/i, "").trim();
  const dateStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const remarksStr = String(report.workerRemarks ?? report.workerReport ?? report.notes ?? report["Notes"] ?? report["Remark"] ?? "").trim();
  const cIdKey = cId.toLowerCase();
  let existingTask = cachedDisconnectionState?.tasks?.find(
    (t) => String(t.consumerId || t["Consumer Id"] || "").trim().toLowerCase() === cIdKey || String(t.taskId) === taskId
  ) || localDisconnectionOverlayMap.get(cIdKey);
  if (!cachedDisconnectionState || !Array.isArray(cachedDisconnectionState.tasks) || cachedDisconnectionState.tasks.length === 0) {
    refreshDisconnectionFromSheetInBackground();
  }
  if (!existingTask || !isValidDisconnectionConsumerRow(existingTask)) {
    const fallbackName = String(
      report.consumerName || report["Name"] || report.Name || report["Consumer Name"] || existingTask && (existingTask.consumerName || existingTask["Name"]) || `Consumer #${cId}`
    ).trim();
    existingTask = convertSheetEntryToDisconnectionTask(
      {
        ...existingTask || {},
        ...report,
        consumerId: cId,
        "Consumer Id": cId,
        Name: fallbackName,
        consumerName: fallbackName
      },
      (cachedDisconnectionState?.tasks?.length || 0) + 1
    );
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const prevStatus = String(existingTask.taskStatus || existingTask.disconStatus || existingTask["Discon Status"] || "PENDING").toUpperCase();
  const updatedReading = report.reading !== void 0 || report["Reading"] !== void 0 || report.meterReading !== void 0 ? String(report.reading ?? report["Reading"] ?? report.meterReading ?? "").trim() : String(existingTask.reading ?? existingTask["Reading"] ?? "").trim();
  const updatedPaymentStatus = newStatus === "PAID" ? "PAID" : "PENDING";
  const updatedPaidAmount = report.paidAmount !== void 0 || report["Paid Amount"] !== void 0 ? String(report.paidAmount ?? report["Paid Amount"] ?? "").trim() : String(existingTask.paidAmount ?? existingTask["Paid Amount"] ?? "").trim();
  const updatedPaidDate = report.paidDate !== void 0 || report["Paid Date"] !== void 0 || report.paymentDate !== void 0 ? String(report.paidDate ?? report["Paid Date"] ?? report.paymentDate ?? "").trim() : String(existingTask.paidDate ?? existingTask["Paid Date"] ?? "").trim();
  const updatedPaidType = report.paidType !== void 0 || report["Paid Type"] !== void 0 || report.paymentReference !== void 0 ? String(report.paidType ?? report["Paid Type"] ?? report.paymentReference ?? "").trim() : String(existingTask.paidType ?? existingTask["Paid Type"] ?? "").trim();
  const updatedDisconDate = report.disconDate !== void 0 || report["Discon Date"] !== void 0 || report.reportDate !== void 0 ? String(report.disconDate ?? report["Discon Date"] ?? report.reportDate ?? "").trim() : String(existingTask.disconDate ?? existingTask["Discon Date"] ?? dateStr).trim();
  const updatedGisPole = report.gisPole !== void 0 || report["Gis Pole"] !== void 0 ? String(report.gisPole ?? report["Gis Pole"] ?? "").trim() : String(existingTask.gisPole ?? existingTask["Gis Pole"] ?? "").trim();
  const updatedAgency = report.agency !== void 0 || report["Agency"] !== void 0 || report.assignedAgency !== void 0 ? String(report.agency ?? report["Agency"] ?? report.assignedAgency ?? "").trim() : String(existingTask.agency ?? existingTask["Agency"] ?? existingTask.assignedAgency ?? "").trim();
  const rawUpdatedImage = report.photoUrl !== void 0 || report["Image"] !== void 0 || report.photoDataUrl !== void 0 ? String(report.photoUrl ?? report["Image"] ?? report.photoDataUrl ?? "").trim() : String(existingTask.photoUrl ?? existingTask["Image"] ?? "").trim();
  let updatedImage = rawUpdatedImage;
  if (rawUpdatedImage && (rawUpdatedImage.startsWith("data:") || rawUpdatedImage.includes("/api/stored-images/"))) {
    updatedImage = await convertDataUrlToClickablePhotoLink(rawUpdatedImage, cId);
  }
  const effectiveHistoryDate = newStatus === "PAID" && updatedPaidDate ? updatedPaidDate : updatedDisconDate || dateStr;
  const newHistoryEntry = {
    date: effectiveHistoryDate,
    time: (/* @__PURE__ */ new Date()).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
    previousStatus: prevStatus,
    newStatus,
    workerName: String(report.workerName || updatedAgency || existingTask.assignedAgency || existingTask.agency || "Worker"),
    remarks: remarksStr,
    paidAmount: updatedPaidAmount,
    meterReading: updatedReading,
    photoUrl: updatedImage,
    action: "UPDATE"
  };
  const reqTagMatch = remarksStr.match(/\[REISSUE_REQ:([^|\]]*)(?:\|([^\]]*))?\]/i);
  const hasApproveTag = /\[REISSUE_APPROVED/i.test(remarksStr) || newStatus === "REISSUE" || report.reissueAction === "APPROVE" || report.reissueApproved === true;
  const hasRejectTag = !hasApproveTag && (/\[REISSUE_REJECTED/i.test(remarksStr) || report.reissueAction === "REJECT" || report.reissueRejected === true);
  const hasRequestTag = !hasApproveTag && !hasRejectTag && (Boolean(reqTagMatch) || report.reissueAction === "REQUEST" || report.reissueRequested === true);
  const cleanBaseRemarks = remarksStr.replace(/\[REISSUE_REQ[^\]]*\]/gi, "").replace(/\[REISSUE_APPROVED[^\]]*\]/gi, "").replace(/\[REISSUE_REJECTED[^\]]*\]/gi, "").replace(/\s*\|\s*$/, "").trim();
  let finalStatus = hasApproveTag ? "REISSUE" : newStatus;
  let finalRemarks = cleanBaseRemarks;
  let isReissueReq = false;
  let isReissueApp = false;
  let isReissueRej = false;
  let reqByStr = String(report.reissueRequestedBy || reqTagMatch && reqTagMatch[1] || existingTask.reissueRequestedBy || report.workerName || "Worker").trim();
  let reqAtStr = String(report.reissueRequestedAt || reqTagMatch && reqTagMatch[2] || existingTask.reissueRequestedAt || dateStr).trim();
  if (cIdKey) {
    if (hasApproveTag) {
      isReissueApp = true;
      const prevReq = reissueRequestsMap.get(cIdKey);
      reqByStr = prevReq?.requestedBy || reqByStr;
      reqAtStr = prevReq?.requestedAt || reqAtStr;
      finalRemarks = `${cleanBaseRemarks} [REISSUE_APPROVED]`.trim();
      reissueRequestsMap.set(cIdKey, {
        consumerId: cId,
        status: "APPROVED",
        requestedBy: reqByStr,
        requestedAt: reqAtStr,
        updatedAt: Date.now()
      });
      saveReissueRequestsToDisk();
    } else if (hasRejectTag) {
      isReissueRej = true;
      const prevReq = reissueRequestsMap.get(cIdKey);
      reqByStr = prevReq?.requestedBy || reqByStr;
      reqAtStr = prevReq?.requestedAt || reqAtStr;
      finalRemarks = `${cleanBaseRemarks} [REISSUE_REJECTED]`.trim();
      reissueRequestsMap.set(cIdKey, {
        consumerId: cId,
        status: "REJECTED",
        requestedBy: reqByStr,
        requestedAt: reqAtStr,
        updatedAt: Date.now()
      });
      saveReissueRequestsToDisk();
    } else if (hasRequestTag) {
      isReissueReq = true;
      finalRemarks = `${cleanBaseRemarks} [REISSUE_REQ:${reqByStr}|${reqAtStr}]`.trim();
      reissueRequestsMap.set(cIdKey, {
        consumerId: cId,
        status: "PENDING",
        requestedBy: reqByStr,
        requestedAt: reqAtStr,
        updatedAt: Date.now()
      });
      saveReissueRequestsToDisk();
    } else {
      finalRemarks = cleanBaseRemarks;
      reissueRequestsMap.set(cIdKey, {
        consumerId: cId,
        status: "COMPLETED",
        requestedBy: "",
        requestedAt: "",
        updatedAt: Date.now()
      });
      saveReissueRequestsToDisk();
    }
  }
  const updatedTaskObj = {
    ...existingTask,
    taskId: existingTask.taskId || taskId || `TASK-DISC-${cId}`,
    consumerId: cId,
    "Consumer Id": cId,
    taskStatus: finalStatus,
    disconStatus: finalStatus,
    status: finalStatus,
    "Discon Status": finalStatus,
    "Status": finalStatus,
    workerRemarks: finalRemarks,
    workerReport: finalRemarks,
    notes: finalRemarks,
    "Notes": finalRemarks,
    "Remark": finalRemarks,
    "Remarks": finalRemarks,
    reading: updatedReading,
    meterReading: updatedReading,
    "Reading": updatedReading,
    paymentStatus: updatedPaymentStatus,
    "Payment Status": updatedPaymentStatus,
    paidAmount: updatedPaidAmount,
    "Paid Amount": updatedPaidAmount,
    paidDate: updatedPaidDate,
    paymentDate: updatedPaidDate,
    "Paid Date": updatedPaidDate,
    paidType: updatedPaidType,
    paymentReference: updatedPaidType,
    "Paid Type": updatedPaidType,
    disconDate: updatedDisconDate,
    reportDate: updatedDisconDate,
    "Discon Date": updatedDisconDate,
    gisPole: updatedGisPole,
    "Gis Pole": updatedGisPole,
    agency: updatedAgency,
    assignedAgency: updatedAgency,
    "Agency": updatedAgency,
    photoUrl: updatedImage,
    imageUrl: updatedImage,
    "Image": updatedImage,
    photoDataUrl: rawUpdatedImage && rawUpdatedImage.startsWith("data:") ? rawUpdatedImage : void 0,
    lastUpdated: nowIso,
    "Last Updated": nowIso,
    updatedAt: nowIso,
    reissueRequested: isReissueReq,
    reissueApproved: isReissueApp,
    reissueRejected: isReissueRej,
    reissueRequestedBy: reqByStr,
    reissueRequestedAt: reqAtStr,
    statusHistory: [newHistoryEntry, ...Array.isArray(existingTask.statusHistory) ? existingTask.statusHistory : []],
    _onlyUpdateStatusAndRemark: true,
    _localUpdatedAt: Date.now(),
    _hasUserRemarkUpdate: true,
    _syncedToSheet: false
  };
  const normCIdKey = normalizeConsumerIdKey(cIdKey || cId);
  if (normCIdKey) {
    localDisconnectionOverlayMap.set(normCIdKey, updatedTaskObj);
    saveDiscOverlayToDisk();
  }
  if (cachedDisconnectionState && Array.isArray(cachedDisconnectionState.tasks)) {
    const cacheCopy = { ...updatedTaskObj };
    delete cacheCopy.photoDataUrl;
    const foundIdx = cachedDisconnectionState.tasks.findIndex(
      (t) => {
        const tKey = normalizeConsumerIdKey(t.consumerId || t["Consumer Id"] || t.taskId);
        return tKey === normCIdKey || String(t.taskId) === taskId;
      }
    );
    if (foundIdx !== -1) {
      cachedDisconnectionState.tasks[foundIdx] = { ...cachedDisconnectionState.tasks[foundIdx], ...cacheCopy };
    } else {
      const digitsOnly = normCIdKey.replace(/\D/g, "");
      const altIdx = digitsOnly ? cachedDisconnectionState.tasks.findIndex((t) => {
        const altKey = normalizeConsumerIdKey(t.consumerId || t["Consumer Id"] || t.taskId).replace(/\D/g, "");
        return altKey && altKey === digitsOnly;
      }) : -1;
      if (altIdx !== -1) {
        cachedDisconnectionState.tasks[altIdx] = { ...cachedDisconnectionState.tasks[altIdx], ...cacheCopy };
      } else {
        cachedDisconnectionState.tasks.push(cacheCopy);
      }
    }
    const seenCIds = /* @__PURE__ */ new Set();
    cachedDisconnectionState.tasks = cachedDisconnectionState.tasks.filter((t) => {
      const k = normalizeConsumerIdKey(t.consumerId || t["Consumer Id"] || t.taskId);
      if (!k) return true;
      if (seenCIds.has(k)) return false;
      seenCIds.add(k);
      return true;
    });
    try {
      fs2.writeFileSync(DISC_CACHE_FILE, JSON.stringify(cachedDisconnectionState.tasks), "utf-8");
    } catch {
    }
  }
  enqueueGasWrite(async () => {
    const ok = await syncSingleDisconnectionRowToSheet(updatedTaskObj);
    if (ok && normCIdKey) {
      localDisconnectionOverlayMap.delete(normCIdKey);
      saveDiscOverlayToDisk();
    }
    gasCache.clear();
    return ok;
  }).catch((err) => {
    console.warn(`[Disconnection Report Sync] Background sync notice for ${cId}:`, err);
  });
  const responseTask = { ...updatedTaskObj };
  delete responseTask.photoDataUrl;
  const responseObj = {
    success: true,
    message: `Consumer ${cId} remark & status (${newStatus}) saved to Disconnection sheet`,
    taskId: updatedTaskObj.taskId,
    consumerId: cId,
    status: newStatus,
    imageUrl: updatedImage,
    task: responseTask
  };
  submissionIdMap.set(subId, { timestamp: Date.now(), result: responseObj });
  return res.json(responseObj);
});
app.all("/api/wbsedcl/live-check", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const rawConsumerId = String(req.body?.consumerId || req.query?.consumerId || req.body?.id || req.body?.taskId || req.query?.id || "").trim();
    const cleanId = cleanAndNormalizeConsumerId(rawConsumerId);
    if (!cleanId) {
      return res.status(400).json({
        success: false,
        error: "A valid Consumer ID is required for Outstanding & LPSC check."
      });
    }
    const officialReport = await fetchOfficialWbsedclReportAsync(cleanId);
    if (officialReport.success && officialReport.data) {
      return res.json({
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
        reportType: officialReport.data.reportType,
        pdfBase64: officialReport.pdfBase64,
        officialPortalUrl: officialReport.officialPortalUrl
      });
    }
    return res.json({
      success: false,
      liveConnected: false,
      consumerId: cleanId,
      officialPortalUrl: officialReport.officialPortalUrl || `https://portal.wbsedcl.in/webdynpro/resources/wbsedcl/noduesandoutstandingreport/OutstandingReport?consumerId=${cleanId}`,
      requiresBrowserOpen: true,
      error: officialReport.error || 'Direct automated retrieval from WBSEDCL was restricted. Please click "Open Official WBSEDCL Report Page" to view/verify the report directly in your browser.'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Internal server error during live check"
    });
  }
});
app.get("/api/wbsedcl/download-official-pdf", async (req, res) => {
  const cleanId = String(req.query.consumerId || "").replace(/^(PWR-DIS-|TASK-DISC-|SUB-DISC-|PWR-)/i, "").replace(/\.0+$/, "").replace(/[, \-_]/g, "").trim();
  if (!cleanId) {
    return res.status(400).send("Consumer ID is required.");
  }
  const outPdf = `/tmp/wbsedcl_pdf_${cleanId}.pdf`;
  if (fs2.existsSync(outPdf)) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="WBSEDCL_Outstanding_Report_${cleanId}.pdf"`);
    return res.sendFile(outPdf);
  }
  const report = await fetchOfficialWbsedclReportAsync(cleanId);
  if (report.success && report.pdfBase64) {
    const pdfBuf = Buffer.from(report.pdfBase64, "base64");
    try {
      fs2.writeFileSync(outPdf, pdfBuf);
    } catch {
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="WBSEDCL_Outstanding_Report_${cleanId}.pdf"`);
    return res.send(pdfBuf);
  }
  return res.redirect(`https://portal.wbsedcl.in/webdynpro/resources/wbsedcl/noduesandoutstandingreport/OutstandingReport?consumerId=${cleanId}`);
});
app.post("/api/disconnection-tasks/assign", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const rawIds = Array.isArray(req.body?.consumerIds) ? req.body.consumerIds : [req.body?.consumerId || req.body?.["Consumer Id"] || req.body?.taskId || ""];
    const cleanIds = rawIds.map((v) => String(v || "").replace(/^(TASK-DISC-|PWR-DIS-|SUB-DISC-)/i, "").trim()).filter(Boolean);
    const agency = String(req.body?.assignedAgency ?? req.body?.agency ?? req.body?.workerName ?? "").trim();
    const workerId = String(req.body?.workerId || "").trim();
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    for (const cId of cleanIds) {
      const cIdKey = cId.toLowerCase();
      if (!cIdKey) continue;
      const existing = cachedDisconnectionState?.tasks?.find(
        (t) => String(t.consumerId || t["Consumer Id"] || "").trim().toLowerCase() === cIdKey
      ) || localDisconnectionOverlayMap.get(cIdKey);
      if (existing) {
        const updated = {
          ...existing,
          assignedAgency: agency,
          agency,
          "Agency": agency,
          assignedWorkerId: workerId || existing.assignedWorkerId || "",
          assignedWorkerName: agency || existing.assignedWorkerName || "",
          lastUpdated: nowIso,
          "Last Updated": nowIso,
          _localUpdatedAt: Date.now(),
          _syncedToSheet: false
        };
        localDisconnectionOverlayMap.set(cIdKey, updated);
        if (cachedDisconnectionState && Array.isArray(cachedDisconnectionState.tasks)) {
          const idx = cachedDisconnectionState.tasks.findIndex(
            (t) => String(t.consumerId || t["Consumer Id"] || "").trim().toLowerCase() === cIdKey
          );
          if (idx !== -1) {
            cachedDisconnectionState.tasks[idx] = updated;
          }
        }
        enqueueGasWrite(async () => {
          const synced = await syncSingleDisconnectionRowToSheet(updated);
          if (synced) {
            updated._syncedToSheet = true;
            saveDiscOverlayToDisk();
          }
          gasCache.clear();
          return synced;
        }).catch(() => {
        });
      }
    }
    saveDiscOverlayToDisk();
    if (cachedDisconnectionState && Array.isArray(cachedDisconnectionState.tasks)) {
      try {
        fs2.writeFileSync(DISC_CACHE_FILE, JSON.stringify(cachedDisconnectionState.tasks), "utf-8");
      } catch {
      }
    }
    gasCache.clear();
    const mergedList = mergeSheetDisconnectionTasksWithOverlay(cachedDisconnectionState?.tasks || []);
    return res.json({
      success: true,
      assignedCount: cleanIds.length,
      tasks: mergedList
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Failed to assign task" });
  }
});
app.post("/api/disconnection-tasks/archive", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const cId = String(req.body?.consumerId || req.body?.["Consumer Id"] || req.body?.taskId || "").replace(/^TASK-DISC-/i, "").trim();
    const cIdKey = cId.toLowerCase();
    if (cIdKey) {
      const existing = cachedDisconnectionState?.tasks?.find((t) => String(t.consumerId || t["Consumer Id"] || "").trim().toLowerCase() === cIdKey) || localDisconnectionOverlayMap.get(cIdKey);
      if (existing) {
        const updated = {
          ...existing,
          taskStatus: "ARCHIVED",
          disconStatus: "ARCHIVED",
          "Discon Status": "ARCHIVED",
          _localUpdatedAt: Date.now(),
          _syncedToSheet: false
        };
        localDisconnectionOverlayMap.set(cIdKey, updated);
        saveDiscOverlayToDisk();
        enqueueGasWrite(async () => {
          const synced = await syncSingleDisconnectionRowToSheet(updated);
          if (synced) {
            updated._syncedToSheet = true;
            saveDiscOverlayToDisk();
          }
          gasCache.clear();
          return synced;
        }).catch(() => {
        });
      }
    }
    gasCache.clear();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Failed to archive task" });
  }
});
app.post("/api/disconnection-tasks/restore", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const cId = String(req.body?.consumerId || req.body?.["Consumer Id"] || req.body?.taskId || "").replace(/^TASK-DISC-/i, "").trim();
    const cIdKey = cId.toLowerCase();
    if (cIdKey) {
      const existing = cachedDisconnectionState?.tasks?.find((t) => String(t.consumerId || t["Consumer Id"] || "").trim().toLowerCase() === cIdKey) || localDisconnectionOverlayMap.get(cIdKey);
      if (existing) {
        const updated = {
          ...existing,
          taskStatus: "PENDING",
          disconStatus: "PENDING",
          "Discon Status": "PENDING",
          _localUpdatedAt: Date.now(),
          _syncedToSheet: false
        };
        localDisconnectionOverlayMap.set(cIdKey, updated);
        saveDiscOverlayToDisk();
        const ok = await enqueueGasWrite(async () => {
          const synced = await syncSingleDisconnectionRowToSheet(updated);
          if (synced) {
            updated._syncedToSheet = true;
            saveDiscOverlayToDisk();
          }
          return synced;
        });
        if (!ok) {
          return res.status(500).json({ success: false, error: "Failed to restore task in Google Sheets Disconnection tab" });
        }
      }
    }
    gasCache.clear();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Failed to restore task" });
  }
});
var handleDisconnectionTaskDelete = async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const paramId = String(req.params?.id || req.body?.consumerId || req.body?.taskId || req.body?.id || req.query?.consumerId || req.query?.id || "").trim();
    const cleanConsumerId = String(req.body?.consumerId || req.body?.["Consumer Id"] || paramId).replace(/^TASK-DISC-/i, "").trim();
    const cleanTaskId = String(req.body?.taskId || (cleanConsumerId ? `TASK-DISC-${cleanConsumerId}` : paramId)).trim();
    if (!cleanConsumerId && !cleanTaskId) {
      return res.status(400).json({ success: false, error: "Consumer ID or Task ID is required for deletion." });
    }
    registerDeletedRecord(paramId, cleanConsumerId, cleanTaskId);
    executeSheetDelete(cleanConsumerId || cleanTaskId, cleanConsumerId, {
      ...req.body,
      category: "Disconnection",
      taskId: cleanTaskId
    }).catch(() => {
    });
    return res.json({
      success: true,
      deleted: true,
      consumerId: cleanConsumerId,
      taskId: cleanTaskId,
      message: `Consumer ${cleanConsumerId || cleanTaskId} permanently deleted from Disconnection module and backend sheet`
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err?.message || "Failed to delete consumer from Disconnection sheet"
    });
  }
};
app.delete("/api/disconnection-tasks/:id", handleDisconnectionTaskDelete);
app.post("/api/disconnection-tasks/delete", handleDisconnectionTaskDelete);
app.post("/api/disconnection-tasks/:id/delete", handleDisconnectionTaskDelete);
app.get("/api/disconnection-tasks/history", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  return res.json({ success: true, history: [] });
});
app.get("/api/superadmin/registry-status", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  const diag = inspectServiceAccountConfiguration();
  return res.json({
    success: true,
    configured: diag.configured,
    keyValid: diag.keyValid,
    source: diag.source,
    keyFormatStatus: diag.keyFormatStatus,
    spreadsheetId: diag.spreadsheetId,
    serviceAccountEmail: diag.serviceAccountEmail,
    message: diag.message
  });
});
app.post("/api/superadmin/offices", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const session = req.body.session || req.body;
    const callerId = String(session?.idNo || session?.loginId || "").trim().toLowerCase();
    const callerRole = String(session?.role || "").trim().toLowerCase();
    const isSuper = callerRole === "admin" || callerRole === "superadmin" || callerId === "8695716192" || callerId === "admin" || callerId === "controller";
    if (!isSuper) {
      return res.status(403).json({ success: false, error: "Unauthorized: Super Admin access required." });
    }
    const creds = getServiceAccountCredentials();
    if (!creds) {
      const diag = inspectServiceAccountConfiguration();
      return res.status(503).json({
        success: false,
        error: diag.message || "Google Service Account credentials (GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) are not yet configured in environment variables."
      });
    }
    const token = await getGoogleSheetsAccessToken(creds);
    const registryData = await fetchAllRegisteredOffices(token);
    return res.json({ success: true, offices: registryData.records });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Failed to read from dedicated Registry Spreadsheet." });
  }
});
app.post("/api/superadmin/register-office", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const payload = req.body;
    const session = payload.session;
    const callerId = String(session?.idNo || session?.loginId || "").trim().toLowerCase();
    const callerRole = String(session?.role || "").trim().toLowerCase();
    const isSuper = callerRole === "admin" || callerRole === "superadmin" || callerId === "8695716192" || callerId === "admin" || callerId === "controller";
    if (!isSuper) {
      return res.status(403).json({ success: false, error: "Unauthorized: Only authorized Super Admin can register offices." });
    }
    const officeName = String(payload.officeName || "").trim();
    const adminName = String(payload.adminName || "").trim();
    const cleanPhone = String(payload.adminMobile || "").replace(/\D/g, "");
    const adminUserId = String(payload.adminUserId || "").trim();
    const plainPass = String(payload.adminPassword || "").trim();
    const databaseName = String(payload.databaseName || "").trim();
    const spreadsheetLink = String(payload.spreadsheetLink || "").trim();
    if (!officeName) return res.status(400).json({ success: false, error: "Office Name is required." });
    if (!adminName) return res.status(400).json({ success: false, error: "Office Admin Name is required." });
    if (!cleanPhone || cleanPhone.length !== 10) return res.status(400).json({ success: false, error: "Valid 10-digit Admin Mobile Number is required." });
    if (!adminUserId || adminUserId.length < 3) return res.status(400).json({ success: false, error: "Admin User ID must be at least 3 characters." });
    if (!plainPass || plainPass.length < 4) return res.status(400).json({ success: false, error: "Admin Password must be at least 4 characters." });
    if (!databaseName) return res.status(400).json({ success: false, error: "Database Name is required." });
    const urlCheck = extractAndValidateSpreadsheetId(spreadsheetLink);
    if (!urlCheck.valid || !urlCheck.id) {
      return res.status(400).json({ success: false, error: urlCheck.error || "Invalid Google Spreadsheet URL." });
    }
    const verifiedSpreadsheetId = urlCheck.id;
    const creds = getServiceAccountCredentials();
    if (!creds) {
      const diag = inspectServiceAccountConfiguration();
      return res.status(503).json({
        success: false,
        error: diag.message || "Service Account credentials not configured: Please set GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in environment variables."
      });
    }
    const token = await getGoogleSheetsAccessToken(creds);
    const accessCheck = await verifySpreadsheetAccessible(verifiedSpreadsheetId, token);
    if (!accessCheck.accessible) {
      return res.status(400).json({
        success: false,
        error: `Cannot access assigned spreadsheet "${verifiedSpreadsheetId}": ${accessCheck.error}. Please share this Google Spreadsheet with "${creds.client_email}" as Editor in Google Sheets.`,
        serviceAccountEmail: creds.client_email,
        spreadsheetId: verifiedSpreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${verifiedSpreadsheetId}/edit`,
        needsOfficeSheetSharing: true
      });
    }
    const existingRegistry = await fetchAllRegisteredOffices(token);
    const isDuplicateOfficeName = existingRegistry.records.some((r) => r.officeName.toLowerCase() === officeName.toLowerCase());
    if (isDuplicateOfficeName) {
      return res.status(409).json({ success: false, error: `Duplicate: Office Name "${officeName}" is already registered.` });
    }
    const isDuplicateUserId = existingRegistry.records.some((r) => r.adminUserId.toLowerCase() === adminUserId.toLowerCase());
    if (isDuplicateUserId) {
      return res.status(409).json({ success: false, error: `Duplicate: Admin User ID "${adminUserId}" is already assigned to another office.` });
    }
    const isDuplicateSheetId = existingRegistry.records.some((r) => r.verifiedSpreadsheetId === verifiedSpreadsheetId);
    if (isDuplicateSheetId) {
      return res.status(409).json({ success: false, error: `Duplicate: This Google Spreadsheet ID is already assigned to another office.` });
    }
    const { salt, hash } = hashPasswordSecurely(plainPass);
    const officeId = `OFFICE-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const recordToSave = {
      id: officeId,
      officeName,
      adminName,
      adminMobile: cleanPhone,
      adminUserId,
      passwordHash: hash,
      passwordSalt: salt,
      databaseName,
      spreadsheetLink,
      verifiedSpreadsheetId,
      status: "active",
      registeredAt: nowIso,
      registeredBy: callerId || "SuperAdmin"
    };
    await appendOfficeToRegistry(recordToSave, existingRegistry.sheetTitle, existingRegistry.hasHeaders, token);
    const verifyRegistry = await fetchAllRegisteredOffices(token);
    const verifiedRecord = verifyRegistry.records.find((r) => r.id === officeId || r.officeName.toLowerCase() === officeName.toLowerCase() && r.adminUserId.toLowerCase() === adminUserId.toLowerCase());
    if (!verifiedRecord) {
      return res.status(500).json({
        success: false,
        error: "Persistence verification failed: Record was appended but could not be confirmed in Registry Spreadsheet read-back."
      });
    }
    try {
      const cached = readRegisteredOfficesCache();
      const filtered = cached.filter((o) => o.id !== officeId && o.adminUserId.toLowerCase() !== adminUserId.toLowerCase());
      filtered.push(recordToSave);
      saveRegisteredOfficesCache(filtered);
    } catch {
    }
    return res.json({
      success: true,
      message: `Office "${officeName}" (${databaseName}) has been durably registered in the dedicated Registry Spreadsheet!`,
      data: verifiedRecord
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "An unexpected error occurred during office registration."
    });
  }
});
app.post("/api/superadmin/configure-service-account", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const session = req.body.session;
    const callerId = String(session?.idNo || session?.loginId || "").trim().toLowerCase();
    const callerRole = String(session?.role || "").trim().toLowerCase();
    const isSuper = callerRole === "admin" || callerRole === "superadmin" || callerId === "8695716192" || callerId === "admin" || callerId === "controller";
    if (!isSuper) {
      return res.status(403).json({ success: false, error: "Unauthorized: Only authorized Super Admin can configure service account credentials." });
    }
    const rawInput = String(req.body.keyJson || req.body.keyData || req.body.keyContent || "").trim();
    if (!rawInput) {
      return res.status(400).json({ success: false, error: "Credential input is empty. Please select or paste the service account JSON file." });
    }
    if (isHexKeyId(rawInput)) {
      return res.status(400).json({
        success: false,
        error: 'Google Cloud Key ID detected: The provided value is a 40-character Key ID (private_key_id) rather than the actual RSA private key. In Google Cloud Console, click "Add Key" -> "Create new key" -> "JSON" to download the key file, then upload that .json file.'
      });
    }
    let parsed;
    let jsonStr = rawInput;
    if (!jsonStr.startsWith("{")) {
      try {
        const b64 = Buffer.from(jsonStr, "base64").toString("utf8").trim();
        if (b64.startsWith("{")) jsonStr = b64;
      } catch {
      }
    }
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return res.status(400).json({
        success: false,
        error: "Invalid JSON syntax: Please ensure the entire contents of the downloaded service-account .json file are provided."
      });
    }
    const email = String(parsed.client_email || parsed.clientEmail || "").trim();
    const rawKey = String(parsed.private_key || parsed.privateKey || "");
    if (!email || !email.includes("@")) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Service Account JSON: "client_email" is missing or invalid in the credential file.'
      });
    }
    const cleanKey = normalizePrivateKey(rawKey);
    if (isHexKeyId(cleanKey)) {
      return res.status(400).json({
        success: false,
        error: "The private_key in the provided JSON is a 40-character Key ID rather than the full RSA PEM private key."
      });
    }
    if (!isValidPrivateKeyFormat(cleanKey)) {
      return res.status(400).json({
        success: false,
        error: 'The private_key in the provided JSON is malformed or not a valid RSA PEM key (must include "-----BEGIN PRIVATE KEY-----").'
      });
    }
    const creds = {
      client_email: email,
      private_key: cleanKey,
      project_id: String(parsed.project_id || parsed.projectId || "gen-lang-client-0685870335").trim()
    };
    let token;
    try {
      token = await getGoogleSheetsAccessToken(creds);
    } catch (tokenErr) {
      return res.status(400).json({
        success: false,
        error: `Google OAuth verification failed: ${tokenErr?.message || "Unable to authenticate with Google"}.`
      });
    }
    const jsonText = JSON.stringify(parsed, null, 2);
    try {
      fs2.writeFileSync(path2.join(process.cwd(), ".service-account.json"), jsonText, { encoding: "utf8", mode: 384 });
    } catch {
    }
    try {
      fs2.writeFileSync(path2.join(process.cwd(), ".service-account-backup.json"), jsonText, { encoding: "utf8", mode: 384 });
    } catch {
    }
    try {
      fs2.writeFileSync(path2.join(process.cwd(), "service-account.json"), jsonText, { encoding: "utf8", mode: 384 });
    } catch {
    }
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify(parsed);
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = creds.client_email;
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = creds.private_key;
    try {
      const envLocalPath = path2.join(process.cwd(), ".env.local");
      let envLines = [];
      if (fs2.existsSync(envLocalPath)) {
        envLines = fs2.readFileSync(envLocalPath, "utf8").split("\n").filter((l) => !l.startsWith("GOOGLE_SERVICE_ACCOUNT_KEY=") && !l.startsWith("GOOGLE_SERVICE_ACCOUNT_EMAIL="));
      }
      envLines.push(`GOOGLE_SERVICE_ACCOUNT_KEY=${JSON.stringify(JSON.stringify(parsed))}`);
      envLines.push(`GOOGLE_SERVICE_ACCOUNT_EMAIL=${creds.client_email}`);
      fs2.writeFileSync(envLocalPath, envLines.join("\n"), "utf8");
    } catch {
    }
    const accessCheck = await verifySpreadsheetAccessible(DEDICATED_REGISTRY_SPREADSHEET_ID, token);
    if (!accessCheck.accessible) {
      return res.json({
        success: false,
        needsSharing: true,
        email: creds.client_email,
        spreadsheetId: DEDICATED_REGISTRY_SPREADSHEET_ID,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${DEDICATED_REGISTRY_SPREADSHEET_ID}/edit`,
        message: `Authentication succeeded with Google! However, the Registry Spreadsheet (ID: ${DEDICATED_REGISTRY_SPREADSHEET_ID}) is not accessible yet: ${accessCheck.error}. Please share the Google Spreadsheet with "${email}" as Editor in Google Sheets, then click "Verify Now".`
      });
    }
    return res.json({
      success: true,
      needsSharing: false,
      message: `Service Account "${email}" verified successfully with Google Sheets API and saved! Dedicated Registry Spreadsheet is live and accessible.`,
      email: creds.client_email,
      spreadsheetId: DEDICATED_REGISTRY_SPREADSHEET_ID
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err?.message || "Failed to configure service account credentials."
    });
  }
});
app.post("/api/superadmin/test-registry-connection", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const session = req.body.session;
    const callerId = String(session?.idNo || session?.loginId || "").trim().toLowerCase();
    const callerRole = String(session?.role || "").trim().toLowerCase();
    const isSuper = callerRole === "admin" || callerRole === "superadmin" || callerId === "8695716192" || callerId === "admin" || callerId === "controller";
    if (!isSuper) {
      return res.status(403).json({ success: false, error: "Unauthorized: Only Super Admin can test connection." });
    }
    const creds = getServiceAccountCredentials();
    if (!creds) {
      return res.status(400).json({ success: false, error: "No Service Account credentials found. Please upload the service-account .json file first." });
    }
    const token = await getGoogleSheetsAccessToken(creds);
    const accessCheck = await verifySpreadsheetAccessible(DEDICATED_REGISTRY_SPREADSHEET_ID, token);
    if (!accessCheck.accessible) {
      return res.json({
        success: false,
        needsSharing: true,
        email: creds.client_email,
        spreadsheetId: DEDICATED_REGISTRY_SPREADSHEET_ID,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${DEDICATED_REGISTRY_SPREADSHEET_ID}/edit`,
        message: `Still not accessible: ${accessCheck.error}. Please make sure you added "${creds.client_email}" as Editor in Google Sheets.`
      });
    }
    return res.json({
      success: true,
      needsSharing: false,
      message: `Google Sheets connection verified! Dedicated Registry Spreadsheet is fully accessible by "${creds.client_email}".`,
      email: creds.client_email,
      spreadsheetId: DEDICATED_REGISTRY_SPREADSHEET_ID
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Connection test failed." });
  }
});
async function startServer() {
  const distPath = path2.join(process.cwd(), "dist");
  const isProduction = process.env.NODE_ENV === "production";
  const desiredPort = isProduction ? parseInt(process.env.PORT || "3000", 10) : 3e3;
  let viteMiddleware = null;
  let viteInitPromise = null;
  if (!isProduction) {
    viteInitPromise = (async () => {
      try {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
          server: { middlewareMode: true, hmr: false },
          appType: "spa",
          plugins: [
            {
              name: "disable-hmr-ws-rejection",
              transform(code, id) {
                if (id.includes("vite/dist/client/client.mjs")) {
                  return code.replace(
                    'reject(new Error("WebSocket closed without opened."));',
                    "resolve();"
                  ).replace(
                    "transport.connect(createHMRHandler(handleMessage));",
                    "/* HMR disabled */"
                  );
                }
              }
            }
          ]
        });
        viteMiddleware = vite.middlewares;
      } catch (viteErr) {
        console.warn("Vite middleware initialization notice, serving static:", viteErr);
      }
    })();
    app.use(async (req, res, next) => {
      if (viteInitPromise) {
        await viteInitPromise;
        viteInitPromise = null;
      }
      if (viteMiddleware) {
        return viteMiddleware(req, res, next);
      }
      next();
    });
  }
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html") || filePath.endsWith("sw.js")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      }
    }
  }));
  app.get("*", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    const indexPath = path2.join(distPath, "index.html");
    if (fs2.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(200).send('<!DOCTYPE html><html><head><meta charset="utf-8"/><title>POWER</title></head><body><div id="root"></div></body></html>');
    }
  });
  function startListening(port) {
    const s = app.listen(port, "0.0.0.0", () => {
      console.log(`\u26A1 POWER server running on http://localhost:${port}`);
      console.log(`\u{1F4CA} Google Spreadsheet ID: ${GOOGLE_SHEET_ID}`);
      console.log(`\u{1F517} Google Apps Script URL: ${GOOGLE_APPS_SCRIPT_URL}`);
      setTimeout(() => {
        fetchVerifiedUsersFromSheet(false).catch(() => {
        });
        refreshEntriesFromSheetInBackground();
        refreshDisconnectionFromSheetInBackground();
      }, 250);
    });
    s.on("error", (err) => {
      if (err.code === "EADDRINUSE" && port !== 3e3) {
        console.warn(`Port ${port} in use, falling back to port 3000...`);
        startListening(3e3);
      } else {
        console.error("Server listen error:", err);
        process.exit(1);
      }
    });
    process.on("SIGTERM", () => {
      s.close(() => {
        process.exit(0);
      });
    });
    process.on("SIGINT", () => {
      s.close(() => {
        process.exit(0);
      });
    });
    return s;
  }
  startListening(desiredPort);
}
if (!process.env.VERCEL && process.env.NODE_ENV !== "test") {
  startServer();
}
var server_default = app;
export {
  server_default as default
};
