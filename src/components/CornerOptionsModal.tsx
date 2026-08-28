import React, { useState } from 'react';
import appLogo from '../assets/images/power_round_logo_1787860440979.jpg';
import { 
  X, 
  ShieldCheck, 
  Lock, 
  AlertTriangle, 
  FileSpreadsheet, 
  PhoneCall, 
  Download, 
  Printer, 
  CheckSquare, 
  Radio, 
  HelpCircle,
  Database,
  Sparkles,
  Zap,
  KeyRound,
  CheckCircle2,
  HardHat
} from 'lucide-react';
import { CornerOptionKey, PowerEntry } from '../types';

interface CornerOptionsModalProps {
  activeOption: CornerOptionKey;
  onClose: () => void;
  isAdmin: boolean;
  onLoginAdmin: (pin: string) => boolean;
  onLogoutAdmin: () => void;
  onSwitchToAdminTab: () => void;
  entries: PowerEntry[];
  onExportCsv: () => void;
}

export const CornerOptionsModal: React.FC<CornerOptionsModalProps> = ({
  activeOption,
  onClose,
  isAdmin,
  onLoginAdmin,
  onLogoutAdmin,
  onSwitchToAdminTab,
  entries,
  onExportCsv,
}) => {
  const [adminPin, setAdminPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [safetyChecklist, setSafetyChecklist] = useState({
    lineIsolated: true,
    earthGrounded: true,
    safetyGearEquipped: true,
    ptwSigned: false,
    dischargingTested: true,
  });

  if (!activeOption || (activeOption === 'admin_portal' && !isAdmin)) return null;

  const handleAdminPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = onLoginAdmin(adminPin);
    if (success) {
      setPinError(false);
      setAdminPin('');
      onSwitchToAdminTab();
      onClose();
    } else {
      setPinError(true);
    }
  };

  const handlePrintDailySummary = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const todayStr = new Date().toLocaleDateString('en-IN');
    const nscCount = entries.filter(e => e.category === 'NSC').length;
    const discCount = entries.filter(e => e.category === 'DISCONNECTION').length;
    const poleCount = entries.filter(e => e.category === 'POLE CASE').length;
    const meterCount = entries.filter(e => e.category === 'METER REPLESMENT').length;
    const dtrCount = entries.filter(e => e.category === 'DTR REPLESMENT').length;

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>WBSEDCL - POWER Daily Field Summary Sheet - ${todayStr}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 25px; color: #111; }
          .header { border-bottom: 2px solid #b45309; padding-bottom: 10px; margin-bottom: 15px; }
          .title { font-size: 20px; font-weight: bold; color: #92400e; }
          .subtitle { font-size: 13px; color: #475569; margin-top: 2px; }
          .stats { display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; }
          .stat-box { border: 1px solid #ddd; padding: 8px 12px; border-radius: 6px; font-size: 12px; background: #fafafa; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
          th { background: #f3f4f6; font-weight: bold; }
          .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
          .sig-box { border-top: 1px dashed #94a3b8; padding-top: 5px; width: 200px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">⚡ WBSEDCL - POWER OF CONSTRUCTION (Field Operations Log)</div>
          <div class="subtitle">West Bengal State Electricity Distribution Company Limited (Govt. of West Bengal Enterprise)</div>
          <div style="font-size: 12px; margin-top: 4px;">Date: ${todayStr} | Generated via POWER Field Portal</div>
        </div>
        <div class="stats">
          <div class="stat-box"><strong>Total Entries:</strong> ${entries.length}</div>
          <div class="stat-box"><strong>NSC (New Connection):</strong> ${nscCount}</div>
          <div class="stat-box"><strong>Disconnections:</strong> ${discCount}</div>
          <div class="stat-box"><strong>Pole Cases:</strong> ${poleCount}</div>
          <div class="stat-box"><strong>Meter Replacements:</strong> ${meterCount}</div>
          <div class="stat-box"><strong>DTR Replacements:</strong> ${dtrCount}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Category</th>
              <th>Consumer / Site</th>
              <th>Lineman / Worker</th>
              <th>Feeder / Pole</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(e => `
              <tr>
                <td style="font-family: monospace; font-weight: bold;">${e.id}</td>
                <td><strong>${e.category}</strong></td>
                <td>${e.consumerName || e.dtrName || e.poleNo || '-'}</td>
                <td>${e.workerName}</td>
                <td>${e.feederName || '-'}</td>
                <td>${e.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">
          <div class="sig-box">Field Lineman Signature</div>
          <div class="sig-box">WBSEDCL Assistant Engineer / CCC In-charge</div>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Top Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={appLogo} 
              alt="Power of Construction Round Logo" 
              className="w-9 h-9 rounded-full object-cover shadow-xs border border-amber-400 p-0.5 bg-white shrink-0"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                POWER OF CONSTRUCTION • WBSEDCL
              </div>
              <div className="text-sm font-bold text-slate-900">
                {activeOption === 'admin_portal' && '1. Admin Portal & Security Console'}
                {activeOption === 'emergency_safety' && '2. Emergency Helpline & Safety Protocol'}
                {activeOption === 'export_reports' && '3. Data Export & Daily Sheets'}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Option 1: Admin Portal & Login (Only for logged in Admin) */}
        {activeOption === 'admin_portal' && (
          <div className="p-5 space-y-4">
            {isAdmin && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3">
                  <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="font-bold text-emerald-950 text-sm">Admin Mode Active</h3>
                    <p className="text-xs text-emerald-700 mt-1">
                      You are logged in as WBSEDCL Admin. You can manage and audit all {entries.length} field records.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    id="goto-admin-dash-btn"
                    onClick={() => {
                      onSwitchToAdminTab();
                      onClose();
                    }}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Open Admin Dashboard</span>
                  </button>

                  <button
                    onClick={() => {
                      onLogoutAdmin();
                      onClose();
                    }}
                    className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 border border-rose-200 cursor-pointer"
                  >
                    <span>Admin Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Option 2: Emergency SOS & Line Safety Desk */}
        {activeOption === 'emergency_safety' && (
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Emergency Hotline Numbers (Indian WBSEDCL Standards) */}
            <div className="bg-rose-50/70 border border-rose-200 p-4 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider">
                <PhoneCall className="w-4 h-4 text-rose-600" />
                <span>WBSEDCL Emergency & Helpline (West Bengal, India)</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <a 
                  href="tel:19121"
                  className="bg-white p-2.5 rounded-lg border border-rose-200 text-center hover:bg-rose-50 transition-colors block shadow-2xs"
                >
                  <div className="text-[10px] text-slate-500">WBSEDCL 24x7 Helpline</div>
                  <div className="text-base font-black text-rose-700 font-mono">19121 / 1912</div>
                </a>

                <a 
                  href="tel:18003455220"
                  className="bg-white p-2.5 rounded-lg border border-rose-200 text-center hover:bg-rose-50 transition-colors block shadow-2xs"
                >
                  <div className="text-[10px] text-slate-500">Toll Free Call Centre</div>
                  <div className="text-xs font-black text-slate-900 font-mono mt-1">1800-345-5220</div>
                </a>

                <a 
                  href="tel:112"
                  className="bg-white p-2.5 rounded-lg border border-rose-200 text-center hover:bg-rose-50 transition-colors block shadow-2xs"
                >
                  <div className="text-[10px] text-slate-500">National Emergency</div>
                  <div className="text-base font-black text-slate-900 font-mono">112 / 100</div>
                </a>

                <a 
                  href="tel:101"
                  className="bg-white p-2.5 rounded-lg border border-rose-200 text-center hover:bg-rose-50 transition-colors block shadow-2xs"
                >
                  <div className="text-[10px] text-slate-500">Fire & Rescue Service</div>
                  <div className="text-base font-black text-rose-700 font-mono">101</div>
                </a>
              </div>
            </div>

            {/* Lineman Safety Protocol - Permit to Work */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                <HardHat className="w-4 h-4 text-amber-600" />
                <span>Lineman Safety Checklist (WBSEDCL PTW Rules)</span>
              </div>

              <div className="space-y-2 text-xs text-slate-700">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={safetyChecklist.lineIsolated}
                    onChange={(e) => setSafetyChecklist({ ...safetyChecklist, lineIsolated: e.target.checked })}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span>1. 11kV / 33kV Feeder shutdown and physical line isolation verified</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={safetyChecklist.earthGrounded}
                    onChange={(e) => setSafetyChecklist({ ...safetyChecklist, earthGrounded: e.target.checked })}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span>2. Temporary short-circuit earthing fitted on both sides with discharge rod</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={safetyChecklist.safetyGearEquipped}
                    onChange={(e) => setSafetyChecklist({ ...safetyChecklist, safetyGearEquipped: e.target.checked })}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span>3. Industrial safety helmet, full-body safety harness & tested insulating gloves equipped</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={safetyChecklist.ptwSigned}
                    onChange={(e) => setSafetyChecklist({ ...safetyChecklist, ptwSigned: e.target.checked })}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span>4. Permit-To-Work (PTW) signed and received from Sub-station Operator / CCC</span>
                </label>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        )}

        {/* Option 3: Export & Daily Reports */}
        {activeOption === 'export_reports' && (
          <div className="p-5 space-y-4">
            <div className="text-xs text-slate-600 leading-relaxed">
              Export and backup all field operational data, download CSV files, or print daily log summaries.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                id="corner-export-csv"
                onClick={() => {
                  onExportCsv();
                  onClose();
                }}
                className="p-3.5 bg-slate-50 hover:bg-white rounded-xl border border-slate-200 hover:border-emerald-300 text-left space-y-1.5 transition-all shadow-2xs group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold border border-emerald-200">.CSV</span>
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-700">
                  Download Excel File (CSV)
                </div>
                <div className="text-[10px] text-slate-500">
                  For Division Office Register and MIS Reports
                </div>
              </button>

              <button
                id="corner-print-summary"
                onClick={handlePrintDailySummary}
                className="p-3.5 bg-slate-50 hover:bg-white rounded-xl border border-slate-200 hover:border-amber-300 text-left space-y-1.5 transition-all shadow-2xs group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <Printer className="w-5 h-5 text-amber-600" />
                  <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-bold border border-amber-200">PRINT</span>
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-amber-700">
                  Print Daily Log Sheet
                </div>
                <div className="text-[10px] text-slate-500">
                  Summary list of today's total {entries.length} field tasks
                </div>
              </button>
            </div>

            {/* Sync diagnostic status */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex items-center justify-between text-slate-600">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-600" />
                <span>Database Storage Status:</span>
              </div>
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Cloud Server Sync Active
              </span>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
