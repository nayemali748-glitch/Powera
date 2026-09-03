import React from 'react';
import { 
  Clock, 
  CheckCircle2, 
  FileText, 
  Printer, 
  Zap, 
  Scissors, 
  TowerControl, 
  Gauge, 
  Activity,
  MapPin,
  User,
  ArrowRight,
  LogOut,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { PowerEntry, UserSession } from '../types';
import { Language, translations } from '../utils/translations';

interface WorkerRecentSubmissionsProps {
  entries: PowerEntry[];
  workerName: string;
  currentUser?: UserSession | null;
  onLogout?: () => void;
  onSelectEntry: (entry: PowerEntry) => void;
  onNewEntry: () => void;
  lang?: Language;
}

export const WorkerRecentSubmissions: React.FC<WorkerRecentSubmissionsProps> = ({
  entries,
  workerName,
  currentUser,
  onLogout,
  onSelectEntry,
  onNewEntry,
  lang = 'bn',
}) => {
  const t = translations[lang] || translations.bn;

  // Filter for this worker or show all recent
  const workerEntries = entries.filter(
    e => !workerName || e.workerName?.toLowerCase().includes(workerName.toLowerCase()) || workerName === 'Worker-1'
  );

  const displayEntries = workerEntries.length > 0 ? workerEntries : entries;

  return (
    <div className="space-y-4">
      {/* User Account & Session Bar with Logout Option */}
      {currentUser && onLogout && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shadow-xs ${
              currentUser.role === 'admin' 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {currentUser.role === 'admin' ? <ShieldCheck className="w-6 h-6" /> : <UserCheck className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {currentUser.name}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  currentUser.role === 'admin' 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {currentUser.role === 'admin' ? 'Admin' : 'Staff / Lineman'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                <span>{currentUser.designation || 'WBSEDCL Field Operator'}</span>
                {currentUser.phone && <span>• {currentUser.phone}</span>}
                {currentUser.badgeNo && <span className="font-mono">({currentUser.badgeNo})</span>}
              </p>
            </div>
          </div>

          <button
            id="module-worker-logout-btn"
            onClick={onLogout}
            className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 border border-red-200/80 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs cursor-pointer self-start sm:self-auto"
            title={t.logout}
          >
            <LogOut className="w-4 h-4" />
            <span>{t.logout}</span>
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden space-y-4 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {t.mySubmissions}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.recordsCount} ({displayEntries.length}) • {t.wbsedclStandard}
            </p>
          </div>

          <button
            onClick={onNewEntry}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto shadow-xs transition-colors cursor-pointer"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>{t.dataEntry}</span>
          </button>
        </div>

        {/* Sync Reassurance Banner for Worker */}
        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            {lang === 'bn' 
              ? 'আপনার প্রতিটি ডাটা এন্ট্রি সরাসরি এডমিন প্যানেলে রিয়েল-টাইমে পৌঁছে যায় এবং এডমিন বা কন্ট্রোলার তা পর্যবেক্ষণ করতে পারেন।' 
              : 'All your entries are synchronized in real-time to the Admin Panel for review and verification.'}
          </span>
        </div>

      {displayEntries.length === 0 ? (
        <div className="text-center py-10 text-slate-500 space-y-2">
          <FileText className="w-8 h-8 mx-auto text-slate-400" />
          <p className="text-sm font-semibold text-slate-700">{t.noDataFound}</p>
          <p className="text-xs text-slate-500">{t.clickToOpenForm}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {displayEntries.map((item) => {
            const isNsc = item.category === 'NSC';
            const isDisc = item.category === 'DISCONNECTION';
            const isPole = item.category === 'POLE CASE';
            const isMeter = item.category === 'METER REPLESMENT';

            return (
              <div
                key={item.id}
                onClick={() => onSelectEntry(item)}
                className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 hover:border-slate-300 hover:bg-white transition-all cursor-pointer space-y-2.5 group shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">{item.id}</span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                      isNsc ? 'bg-amber-50 text-amber-800 border-amber-200' :
                      isDisc ? 'bg-rose-50 text-rose-800 border-rose-200' :
                      isPole ? 'bg-sky-50 text-sky-800 border-sky-200' :
                      isMeter ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                      'bg-indigo-50 text-indigo-800 border-indigo-200'
                    }`}>
                      {item.category}
                    </span>
                  </div>

                  {/* Status Badge */}
                  {(() => {
                    const status = item.status || 'Pending';
                    const isApproved = status === 'Approved';
                    const isCompleted = status === 'Completed';
                    const isPending = status === 'Pending';
                    const isRejected = status === 'Rejected';

                    return (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 shadow-2xs ${
                        isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                        isCompleted ? 'bg-blue-50 text-blue-700 border-blue-300' :
                        isRejected ? 'bg-rose-50 text-rose-700 border-rose-300' :
                        'bg-amber-50 text-amber-700 border-amber-300'
                      }`}>
                        {isApproved && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {isCompleted && <CheckCircle2 className="w-3 h-3 text-blue-600" />}
                        {isPending && <Clock className="w-3 h-3 text-amber-600 animate-pulse" />}
                        {isRejected && <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>}
                        <span>
                          {isApproved ? (t.approved || 'Approved') :
                           isCompleted ? (t.completed || 'Completed') :
                           isPending ? (t.pending || 'Pending') :
                           status}
                        </span>
                      </span>
                    );
                  })()}
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">
                    {item.consumerName || item.dtrName || item.poleNo || 'WBSEDCL Field Operation'}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {item.address || item.feederName || item.issueType || item.notes || 'No extra remarks'}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{item.workerName}</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded font-bold ml-1 flex items-center gap-1">
                      <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                      এডমিনে সিঙ্কড
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-900 font-semibold group-hover:text-blue-700 transition-colors">
                    <span>{t.printReceipt}</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
};
