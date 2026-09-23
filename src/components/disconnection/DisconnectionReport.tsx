import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  Eye,
  Calendar,
  User,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Building2,
  CreditCard,
  HelpCircle,
  RefreshCw,
  X,
  ExternalLink,
  Camera
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DisconnectionTask } from '../../types';

interface DisconnectionReportProps {
  tasks: DisconnectionTask[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lang?: 'en' | 'bn';
}

export const DisconnectionReport: React.FC<DisconnectionReportProps> = ({
  tasks,
  onRefresh,
  isRefreshing = false,
  lang = 'en'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string; meta?: string } | null>(null);

  // Extract all unique workers from tasks
  const workers = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => {
      const w = t.assignedWorkerName || t.assignedAgency || t.submittedBy;
      if (w && w.trim()) set.add(w.trim());
    });
    return Array.from(set).sort();
  }, [tasks]);

  // Tasks that have reports or non-pending status
  const reportedTasks = useMemo(() => {
    return tasks.filter(t => {
      // Must have some status update or report
      const st = String(t.taskStatus || '').toUpperCase();
      const hasReport = t.workerReport || t.workerRemarks || t.reportDate || t.photoUrl || (st !== 'PENDING' && st !== 'IN PROGRESS');
      if (!hasReport) return false;

      // Filter Worker
      if (selectedWorker !== 'ALL') {
        const w = t.assignedWorkerName || t.assignedAgency || t.submittedBy || '';
        if (w !== selectedWorker) return false;
      }

      // Filter Status
      if (selectedStatus !== 'ALL') {
        if (st !== selectedStatus) return false;
      }

      // Date Filter
      if (dateFilter) {
        const dateStr = t.reportDate || t.updatedAt || t.createdAt || '';
        if (!dateStr.includes(dateFilter)) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          (t.consumerName && t.consumerName.toLowerCase().includes(q)) ||
          (t.consumerId && t.consumerId.toLowerCase().includes(q)) ||
          (t.accountNumber && t.accountNumber.toLowerCase().includes(q)) ||
          (t.taskId && t.taskId.toLowerCase().includes(q)) ||
          (t.workerRemarks && t.workerRemarks.toLowerCase().includes(q)) ||
          (t.workerReport && t.workerReport.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.reportDate || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.reportDate || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [tasks, selectedWorker, selectedStatus, dateFilter, searchQuery]);

  // Status badge styler
  const getStatusBadge = (status: string) => {
    const st = String(status || 'PENDING').toUpperCase();
    switch (st) {
      case 'DISCONNECT':
      case 'COMPLETED':
        return {
          label: 'DISCONNECT',
          bg: 'bg-rose-100 text-rose-800 border-rose-200',
          icon: Zap
        };
      case 'PAID':
        return {
          label: 'PAID',
          bg: 'bg-teal-100 text-teal-800 border-teal-200',
          icon: CreditCard
        };
      case 'DISPUTE':
        return {
          label: 'DISPUTE',
          bg: 'bg-orange-100 text-orange-800 border-orange-200',
          icon: AlertTriangle
        };
      case 'OFFICE TEAM':
        return {
          label: 'OFFICE TEAM',
          bg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          icon: Building2
        };
      case 'NOT FOUND':
        return {
          label: 'NOT FOUND',
          bg: 'bg-slate-200 text-slate-800 border-slate-300',
          icon: HelpCircle
        };
      case 'REISSUE':
        return {
          label: 'REISSUE',
          bg: 'bg-purple-100 text-purple-800 border-purple-200',
          icon: RefreshCw
        };
      default:
        return {
          label: st,
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: CheckCircle2
        };
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (reportedTasks.length === 0) {
      alert('No reported records available to export.');
      return;
    }

    const exportRows = reportedTasks.map((t, idx) => ({
      'Serial No': t.serialNumber || `SL ${String(idx + 1).padStart(3, '0')}`,
      'Worker / Agency': t.assignedWorkerName || t.assignedAgency || t.submittedBy || 'Unassigned',
      'Worker ID': t.assignedWorkerId || '',
      'Consumer Name': t.consumerName || '',
      'MRU Section': t.mruSection || '',
      'CCC / Feeder': t.cccFeeder || '',
      'Consumer Address': t.consumerAddress || '',
      'Contact Mobile': t.phoneNumber || '',
      'Status': t.taskStatus || 'COMPLETED',
      'Report / Observation': t.workerReport || t.workerRemarks || '',
      'Remarks': t.workerRemarks || '',
      'Paid Amount': t.paidAmount || '',
      'Payment Date': t.paymentDate || '',
      'Payment Reference': t.paymentReference || '',
      'Meter Reading': t.meterReading || '',
      'Photo Evidence URL': t.photoUrl || '',
      'Updated Date': t.reportDate || t.updatedAt?.split('T')[0] || '',
      'Updated Time': t.reportTime || (t.updatedAt ? new Date(t.updatedAt).toLocaleTimeString() : '')
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Disconnection_Reports');
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `WBSEDCL_Disconnection_Reports_${dateStr}.xlsx`);
  };

  return (
    <div className="space-y-6" id="disconnection-reports-section">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            <span>{lang === 'bn' ? 'ফিল্ড রিপোর্ট ও পর্যবেক্ষণ বিবরণী' : 'Worker Field Reports & Observations'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'bn'
              ? 'মাঠের কর্মীদের জমা দেওয়া ডিসকানেকশন রিপোর্ট, মিটার রিডিং, আদায় ও ফটো প্রমাণপত্র'
              : 'Detailed operational logs of worker actions, evidence photos, payments, and site observations.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
              title="Refresh reports"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}

          <button
            id="export-reports-btn"
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
            title="Export filtered reports to Excel"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>{lang === 'bn' ? 'এক্সেল রিপোর্ট ডাউনলোড' : 'Export Reports to Excel'}</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={lang === 'bn' ? 'উপভোক্তা / আইডি / মন্তব্য খুঁজুন...' : 'Search consumer, ID, remarks...'}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Worker Filter */}
          <div>
            <select
              value={selectedWorker}
              onChange={e => setSelectedWorker(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="ALL">{lang === 'bn' ? 'সকল কর্মী / এজেন্সি' : 'All Workers / Agencies'}</option>
              {workers.map((w, idx) => (
                <option key={idx} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="ALL">{lang === 'bn' ? 'সকল স্ট্যাটাস' : 'All Statuses'}</option>
              <option value="DISCONNECT">DISCONNECT (Power Cut)</option>
              <option value="PAID">PAID (Collected)</option>
              <option value="DISPUTE">DISPUTE (Objection)</option>
              <option value="OFFICE TEAM">OFFICE TEAM (Special Squad)</option>
              <option value="NOT FOUND">NOT FOUND (Locked/Moved)</option>
              <option value="REISSUE">REISSUE (Verify Again)</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        {/* Filter count indicator */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>
            {lang === 'bn' ? 'মোট ফিল্টারকৃত রিপোর্ট:' : 'Showing filtered reports:'}{' '}
            <strong className="text-slate-900">{reportedTasks.length}</strong>
          </span>
          {(searchQuery || selectedWorker !== 'ALL' || selectedStatus !== 'ALL' || dateFilter) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedWorker('ALL');
                setSelectedStatus('ALL');
                setDateFilter('');
              }}
              className="text-amber-600 hover:text-amber-700 font-bold hover:underline cursor-pointer"
            >
              {lang === 'bn' ? 'সব ফিল্টার মুছুন' : 'Clear all filters'}
            </button>
          )}
        </div>
      </div>

      {/* Reports Table */}
      {reportedTasks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            {lang === 'bn' ? 'কোনো রিপোর্ট পাওয়া যায়নি' : 'No submitted reports found'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {lang === 'bn'
              ? 'ফিল্টার পরিবর্তন করুন অথবা ফিল্ড কর্মীদের দ্বারা কাজের স্ট্যাটাস আপডেট হওয়ার জন্য অপেক্ষা করুন।'
              : 'Try clearing filters or wait for field workers to log execution updates.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3">{lang === 'bn' ? 'ক্রমিক নং' : 'Serial No'}</th>
                  <th className="py-3 px-3">{lang === 'bn' ? 'কর্মী ও সময়' : 'Worker & Date'}</th>
                  <th className="py-3 px-3">{lang === 'bn' ? 'উপভোক্তা বিবরণ' : 'Consumer Details'}</th>
                  <th className="py-3 px-3">{lang === 'bn' ? 'স্ট্যাটাস' : 'Status'}</th>
                  <th className="py-3 px-3">{lang === 'bn' ? 'পর্যবেক্ষণ ও মন্তব্য' : 'Report & Remarks'}</th>
                  <th className="py-3 px-3">{lang === 'bn' ? 'পরিশোধ / রিডিং' : 'Paid / Reading'}</th>
                  <th className="py-3 px-3 text-center">{lang === 'bn' ? 'প্রমাণ ছবি' : 'Evidence'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportedTasks.map((t, idx) => {
                  const badge = getStatusBadge(t.taskStatus || 'COMPLETED');
                  const BadgeIcon = badge.icon;
                  const workerName = t.assignedWorkerName || t.assignedAgency || t.submittedBy || 'Field Worker';
                  const dateDisplay = t.reportDate || t.updatedAt?.split('T')[0] || t.createdAt?.split('T')[0] || '—';
                  const serialText = t.serialNumber || ('SL ' + String(idx + 1).padStart(3, '0'));

                  return (
                    <tr key={t.taskId || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3">
                        <span className="px-2.5 py-1 bg-amber-500/10 text-amber-900 border border-amber-300 rounded-md font-mono text-xs font-black select-all whitespace-nowrap">
                          {serialText}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-black text-[10px] flex items-center justify-center shrink-0 border border-slate-200 mt-0.5">
                            {workerName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{workerName}</div>
                            {t.assignedWorkerId && (
                              <span className="text-[10px] text-slate-400 font-mono">ID: {t.assignedWorkerId}</span>
                            )}
                            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{dateDisplay}</span>
                              {t.reportTime && <span>• {t.reportTime}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 text-[13px]">{t.consumerName || '—'}</div>
                        {t.phoneNumber && (
                          <div className="text-[11px] text-amber-600 font-bold">{t.phoneNumber}</div>
                        )}
                        {t.consumerAddress && (
                          <div className="text-[10px] text-slate-500 line-clamp-1 max-w-xs mt-0.5">
                            {t.consumerAddress}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black border ${badge.bg}`}
                        >
                          <BadgeIcon className="w-3 h-3" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      <td className="py-3 px-3 max-w-xs">
                        <div className="text-slate-800 font-medium text-xs">
                          {t.workerReport || t.workerRemarks || '—'}
                        </div>
                        {t.workerRemarks && t.workerReport && t.workerRemarks !== t.workerReport && (
                          <div className="text-[10px] text-slate-400 italic mt-0.5">
                            Note: {t.workerRemarks}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        {t.paidAmount ? (
                          <div className="text-emerald-700 font-bold text-xs">
                            ₹{t.paidAmount}
                            {t.paymentReference && (
                              <div className="text-[10px] font-mono text-slate-400 font-normal">
                                Ref: {t.paymentReference}
                              </div>
                            )}
                          </div>
                        ) : t.meterReading ? (
                          <div className="text-slate-800 font-mono font-bold text-xs">
                            Reading: {t.meterReading}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        {t.photoUrl ? (
                          <button
                            onClick={() =>
                              setPreviewPhoto({
                                url: t.photoUrl!,
                                title: `${t.consumerName || 'Consumer'} - ${t.consumerId || t.taskId}`,
                                meta: `${workerName} • ${dateDisplay}`
                              })
                            }
                            className="relative group inline-block cursor-pointer"
                            title="Click to view full photo evidence"
                          >
                            <img
                              src={t.photoUrl}
                              alt="Evidence"
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 object-cover rounded-lg border border-slate-300 shadow-2xs group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-slate-900/40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Eye className="w-3.5 h-3.5 text-white" />
                            </div>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No Photo</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{previewPhoto.title}</h4>
                {previewPhoto.meta && <p className="text-xs text-slate-500">{previewPhoto.meta}</p>}
              </div>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-900 flex items-center justify-center max-h-[70vh] overflow-hidden">
              <img
                src={previewPhoto.url}
                alt="Evidence Full Preview"
                referrerPolicy="no-referrer"
                className="max-h-[65vh] w-auto object-contain rounded-lg"
              />
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500">WBSEDCL Geotagged Field Evidence</span>
              <a
                href={previewPhoto.url}
                target="_blank"
                rel="noreferrer"
                download="disconnection_evidence.jpg"
                className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-bold flex items-center gap-1.5 hover:bg-slate-800"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Download</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
