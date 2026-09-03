import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  ChevronRight, 
  ExternalLink, 
  Calendar, 
  User, 
  Zap, 
  CheckCircle2, 
  Sparkles,
  ArrowRight,
  Eye,
  X
} from 'lucide-react';
import { WorkOrderNotice, CategoryType } from '../types';
import { Language, translations } from '../utils/translations';

interface AdminNoticesBannerProps {
  workOrders: WorkOrderNotice[];
  onSelectNoticeForEntry: (notice: WorkOrderNotice) => void;
  onViewAllNotices: () => void;
  lang?: Language;
  isAdmin?: boolean;
}

export const AdminNoticesBanner: React.FC<AdminNoticesBannerProps> = ({
  workOrders,
  onSelectNoticeForEntry,
  onViewAllNotices,
  lang = 'bn',
  isAdmin = false,
}) => {
  const t = translations[lang] || translations.bn;
  const [selectedPreviewNotice, setSelectedPreviewNotice] = useState<WorkOrderNotice | null>(null);

  // Filter for visible notices
  const visibleNotices = workOrders.filter(n => !n.isHidden);
  const latestNotices = visibleNotices.slice(0, 3);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
      {/* Section Header */}
      <div className="px-5 py-4 bg-linear-to-r from-amber-500/15 via-orange-500/10 to-transparent border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>{lang === 'bn' ? 'এডমিন নোটিশ ও ওয়ার্ক অর্ডার' : 'Admin Notice & Work Orders'}</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                {visibleNotices.length > 0 ? `${visibleNotices.length} টি সচল` : 'LIVE'}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {lang === 'bn' 
                ? 'এডমিন কন্ট্রোলারের দেওয়া অফিসিয়াল ওয়ার্ক অর্ডার ও খাতা দেখে সরাসরি ডাটা এন্ট্রি করুন' 
                : 'View official work orders & khatas issued by Admin and start entry'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewAllNotices}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
        >
          <span>{lang === 'bn' ? 'সকল নোটিশ ও খাতা দেখুন' : 'View All Notices'}</span>
          <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
        </button>
      </div>

      {/* Notices Content */}
      <div className="p-4 sm:p-5">
        {latestNotices.length === 0 ? (
          <div className="p-5 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-700">
              {lang === 'bn' 
                ? 'বর্তমানে এডমিন থেকে কোনো নতুন ওয়ার্ক অর্ডার বা খাতার নোটিশ নেই' 
                : 'No pending work order notices from Admin at the moment'}
            </p>
            <p className="text-[11px] text-slate-500 max-w-lg mx-auto">
              {lang === 'bn'
                ? 'এডমিন কোনো কাজের নির্দেশ বা নোটিশ পোস্ট করলে আপনি এখানে সরাসরি দেখতে পাবেন। নিচে যেকোনো ক্যাটাগরি নির্বাচন করে সাধারণ এন্ট্রি সম্পন্ন করুন।'
                : 'When Admin issues work orders, they will appear here. Select a category below to perform entry directly.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {latestNotices.map((notice) => {
              const isNsc = notice.category === 'NSC';
              const isDisc = notice.category === 'DISCONNECTION';
              const isPole = notice.category === 'POLE CASE';
              const isMeter = notice.category === 'METER REPLESMENT';

              return (
                <div
                  key={notice.id}
                  className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-3.5 flex flex-col justify-between gap-3 transition-all shadow-2xs hover:shadow-md group"
                >
                  <div className="space-y-2.5">
                    {/* Top Row: Category badge & Date */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider ${
                        isNsc ? 'bg-amber-100 text-amber-900 border-amber-300' :
                        isDisc ? 'bg-rose-100 text-rose-900 border-rose-300' :
                        isPole ? 'bg-sky-100 text-sky-900 border-sky-300' :
                        isMeter ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                        'bg-purple-100 text-purple-900 border-purple-300'
                      }`}>
                        {notice.category}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{notice.uploadDate}</span>
                      </span>
                    </div>

                    {/* Notice Title */}
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {notice.title}
                    </h4>

                    {/* Photo Preview Thumbnail & Admin Info */}
                    <div className="flex items-center gap-3">
                      {notice.photoUrl && (
                        <div 
                          onClick={() => setSelectedPreviewNotice(notice)}
                          className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-900 border border-slate-200 shrink-0 cursor-pointer group/img"
                          title="Click to view full photo"
                        >
                          <img
                            src={notice.photoUrl}
                            alt="Work Order"
                            className="w-full h-full object-cover group-hover/img:scale-110 transition-transform"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity text-white">
                            <Eye className="w-4 h-4" />
                          </div>
                        </div>
                      )}
                      <div className="text-[11px] text-slate-500 space-y-0.5">
                        <p className="flex items-center gap-1 text-slate-700 font-medium line-clamp-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{notice.adminName || 'Admin Controller'}</span>
                        </p>
                        {notice.description && (
                          <p className="text-[10px] text-slate-500 line-clamp-1 italic">
                            "{notice.description}"
                          </p>
                        )}
                        <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>অফিসিয়াল খাতা সংযুক্ত</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Direct Action Button */}
                  <button
                    type="button"
                    onClick={() => onSelectNoticeForEntry(notice)}
                    className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs active:scale-98 cursor-pointer mt-1"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>{lang === 'bn' ? 'এই কাজের ডাটা এন্ট্রি শুরু করুন' : 'Start Entry on this Notice'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Image Preview Modal */}
      {selectedPreviewNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  {selectedPreviewNotice.category}
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1">
                  {selectedPreviewNotice.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreviewNotice(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950 max-h-[65vh] flex items-center justify-center">
              <img
                src={selectedPreviewNotice.photoUrl}
                alt="Work Order Large"
                className="max-h-[65vh] w-auto object-contain mx-auto"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-500">
                <span>আপলোড: {selectedPreviewNotice.uploadDate} {selectedPreviewNotice.uploadTime}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const n = selectedPreviewNotice;
                  setSelectedPreviewNotice(null);
                  onSelectNoticeForEntry(n);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>এই কাজের ডাটা এন্ট্রি খুলুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
