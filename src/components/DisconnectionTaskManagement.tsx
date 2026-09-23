import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Zap,
  ArrowLeft,
  LayoutDashboard,
  UploadCloud,
  FileSpreadsheet,
  Users,
  Search,
  Filter,
  RefreshCw,
  Flame,
  CreditCard,
  Building2,
  HelpCircle,
  Clock,
  CheckCircle2,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  DisconnectionTask,
  DisconnectionTaskStatus,
  DisconnectionStats,
  UserSession,
  UserAccount
} from '../types';
import { fetchDisconnectionTasks, fetchUsers } from '../services/api';
import { Language } from '../utils/translations';
import { DisconnectionDashboard } from './disconnection/DisconnectionDashboard';
import { DisconnectionUpload } from './disconnection/DisconnectionUpload';
import { DisconnectionReport } from './disconnection/DisconnectionReport';
import { DisconnectionConsumerCard } from './disconnection/DisconnectionConsumerCard';
import { DisconnectionUpdateModal } from './disconnection/DisconnectionUpdateModal';

interface DisconnectionTaskManagementProps {
  currentUser?: UserSession | null;
  lang?: Language;
  onBack?: () => void;
}

type DisconnectionTab = 'DASHBOARD' | 'UPLOAD' | 'REPORT' | 'VIEW_LIST';

export const DisconnectionTaskManagement: React.FC<DisconnectionTaskManagementProps> = ({
  currentUser,
  lang = 'en',
  onBack
}) => {
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.idNo === 'ADMIN';

  // Navigation tab state (Defaults to VIEW_LIST so dashboard is not always open)
  const [activeTab, setActiveTab] = useState<DisconnectionTab>('VIEW_LIST');
  const [isDashboardExpanded, setIsDashboardExpanded] = useState<boolean>(false);

  // Core Data States
  const [tasks, setTasks] = useState<DisconnectionTask[]>([]);
  const [stats, setStats] = useState<DisconnectionStats>({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    completionPercentage: 0,
    myAssignedTasks: 0,
    myCompletedTasks: 0,
    myPendingTasks: 0,
    myCompletionPercentage: 0
  });
  const [availableWorkers, setAvailableWorkers] = useState<Array<{ idNo: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // View List Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [agencyFilter, setAgencyFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'SERIAL_ASC' | 'DUE_DESC' | 'DUE_ASC' | 'NAME_ASC' | 'URGENT_FIRST' | 'NEWEST'>('SERIAL_ASC');
  const [workerOnlyFilter, setWorkerOnlyFilter] = useState<boolean>(!isAdmin);

  // Update Status Modal
  const [selectedTaskForUpdate, setSelectedTaskForUpdate] = useState<DisconnectionTask | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // Initial Data Fetch
  const loadData = useCallback(async (showRefreshingSpinner = false) => {
    if (showRefreshingSpinner) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      // 1. Fetch Disconnection Tasks & Stats
      const discResult = await fetchDisconnectionTasks({
        role: currentUser?.role,
        workerId: currentUser?.idNo,
        workerName: currentUser?.name
      });

      if (discResult && discResult.tasks) {
        setTasks(discResult.tasks);
        if (discResult.stats) {
          setStats(discResult.stats);
        }
      }

      // 2. Fetch Users to populate Agency/Worker dropdown
      try {
        const usersResult = await fetchUsers();
        if (Array.isArray(usersResult)) {
          const mapped = usersResult
            .filter((u: any) => u.status !== 'hold' && u.status !== 'inactive')
            .map((u: any) => ({
              idNo: String(u.idNo || u['User ID'] || u.username || ''),
              name: String(u.name || u['User Name'] || u.username || '')
            }))
            .filter(u => u.name.trim() !== '');
          setAvailableWorkers(mapped);
        }
      } catch (userErr) {
        console.warn('Failed to load user accounts for assignment:', userErr);
      }
    } catch (err: any) {
      console.error('Failed to load disconnection tasks:', err);
      setError(err.message || 'Failed to load disconnection tasks');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle task update from modal
  const handleTaskUpdated = (updatedTask: DisconnectionTask) => {
    // Confetti celebration if completed or paid
    if (updatedTask.taskStatus === 'COMPLETED' || updatedTask.taskStatus === 'DISCONNECT' || updatedTask.taskStatus === 'PAID') {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 }
        });
      } catch {
        // ignore
      }
    }

    setTasks(prev => {
      const idx = prev.findIndex(t => t.taskId === updatedTask.taskId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedTask;
        return next;
      }
      return [updatedTask, ...prev];
    });

    // Background reload to sync all aggregated stats
    loadData(true);
  };

  // Handle upload success
  const handleUploadSuccess = (newTasks: DisconnectionTask[]) => {
    setTasks(prev => {
      const existingMap = new Map(prev.map(t => [t.taskId, t]));
      newTasks.forEach(nt => {
        existingMap.set(nt.taskId, nt);
      });
      return Array.from(existingMap.values());
    });
    loadData(true);
  };

  // Quick navigation from Dashboard Stat Card directly to View List
  const handleSelectStatusFilterFromDashboard = (status: string) => {
    setStatusFilter(status);
    setActiveTab('VIEW_LIST');
  };

  const handleSelectWorkerFilterFromDashboard = (workerName: string) => {
    setAgencyFilter(workerName);
    setActiveTab('VIEW_LIST');
  };

  // Open Update Modal
  const handleOpenUpdateModal = (task: DisconnectionTask) => {
    setSelectedTaskForUpdate(task);
    setIsUpdateModalOpen(true);
  };

  // Unique Agencies from tasks for filter dropdown
  const uniqueAgencies = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => {
      const ag = t.assignedAgency?.trim() || t.assignedWorkerName?.trim();
      if (ag) set.add(ag);
    });
    return Array.from(set).sort();
  }, [tasks]);

  // Filtered & Sorted View List Consumers
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Worker only restriction if toggled or worker mode
      if (workerOnlyFilter && !isAdmin) {
        const myName = String(currentUser?.name || currentUser?.username || '').toLowerCase().trim();
        const myId = String(currentUser?.idNo || '').toLowerCase().trim();
        const assignedName = String(t.assignedWorkerName || t.assignedAgency || '').toLowerCase().trim();
        const assignedId = String(t.assignedWorkerId || '').toLowerCase().trim();

        const isMine = (myName && assignedName.includes(myName)) || (myId && assignedId === myId);
        if (!isMine && t.assignedWorkerName) return false;
      }

      // Status Filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'URGENT') {
          if (String(t.priority || '').toUpperCase() !== 'URGENT') return false;
        } else {
          const st = String(t.taskStatus || 'PENDING').toUpperCase();
          if (st !== statusFilter) return false;
        }
      }

      // Agency / Worker Filter
      if (agencyFilter !== 'ALL') {
        const ag = t.assignedAgency?.trim() || t.assignedWorkerName?.trim() || '';
        if (ag !== agencyFilter) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          (t.serialNumber && t.serialNumber.toLowerCase().includes(q)) ||
          (t.consumerName && t.consumerName.toLowerCase().includes(q)) ||
          (t.consumerId && t.consumerId.toLowerCase().includes(q)) ||
          (t.accountNumber && t.accountNumber.toLowerCase().includes(q)) ||
          (t.consumerAddress && t.consumerAddress.toLowerCase().includes(q)) ||
          (t.meterNumber && t.meterNumber.toLowerCase().includes(q)) ||
          (t.mruSection && t.mruSection.toLowerCase().includes(q)) ||
          (t.phoneNumber && t.phoneNumber.includes(q)) ||
          (t.taskId && t.taskId.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'SERIAL_ASC') {
        const getSl = (s?: string) => {
          const m = String(s || '').match(/(\d+)/);
          return m ? parseInt(m[1], 10) : 999999;
        };
        return getSl(a.serialNumber) - getSl(b.serialNumber);
      }

      if (sortBy === 'URGENT_FIRST') {
        const aUrgent = String(a.priority || '').toUpperCase() === 'URGENT' ? 1 : 0;
        const bUrgent = String(b.priority || '').toUpperCase() === 'URGENT' ? 1 : 0;
        if (aUrgent !== bUrgent) return bUrgent - aUrgent;
      }

      if (sortBy === 'DUE_DESC') {
        const amtA = parseFloat(String(a.outstandingDue || '0').replace(/[^0-9.-]/g, '')) || 0;
        const amtB = parseFloat(String(b.outstandingDue || '0').replace(/[^0-9.-]/g, '')) || 0;
        return amtB - amtA;
      }

      if (sortBy === 'DUE_ASC') {
        const amtA = parseFloat(String(a.outstandingDue || '0').replace(/[^0-9.-]/g, '')) || 0;
        const amtB = parseFloat(String(b.outstandingDue || '0').replace(/[^0-9.-]/g, '')) || 0;
        return amtA - amtB;
      }

      if (sortBy === 'NAME_ASC') {
        return String(a.consumerName || '').localeCompare(String(b.consumerName || ''));
      }

      // Default: Newest first
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [tasks, statusFilter, agencyFilter, searchQuery, sortBy, workerOnlyFilter, isAdmin, currentUser]);

  // Counts for pills
  const counts = useMemo(() => {
    let urgent = 0;
    let disconnect = 0;
    let paid = 0;
    let pending = 0;
    let dispute = 0;
    let officeTeam = 0;
    let notFound = 0;
    let reissue = 0;

    tasks.forEach(t => {
      const st = String(t.taskStatus || 'PENDING').toUpperCase();
      if (String(t.priority || '').toUpperCase() === 'URGENT') urgent++;
      if (st === 'DISCONNECT' || st === 'COMPLETED') disconnect++;
      else if (st === 'PAID') paid++;
      else if (st === 'PENDING' || st === 'IN PROGRESS') pending++;
      else if (st === 'DISPUTE') dispute++;
      else if (st === 'OFFICE TEAM') officeTeam++;
      else if (st === 'NOT FOUND') notFound++;
      else if (st === 'REISSUE') reissue++;
    });

    return { total: tasks.length, urgent, disconnect, paid, pending, dispute, officeTeam, notFound, reissue };
  }, [tasks]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-200" id="disconnection-module-root">
      {/* Top Banner Navigation Bar */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {onBack && (
              <button
                type="button"
                id="disconnection-back-btn"
                onClick={onBack}
                className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer shadow-xs active:scale-95"
                title="Back to Main Menu"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Zap className="w-4 h-4 fill-amber-400" />
                </div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  {lang === 'bn' ? 'বিদ্যুৎ সংযোগ বিচ্ছিন্নকরণ ও পরিচালনা' : 'Disconnection & Utility Operations'}
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                WBSEDCL Defaulter Consumer Enactment, Field Disconnection & Arrears Collection Engine
              </p>
            </div>
          </div>

          {/* User Badge & Live Refresh */}
          <div className="flex items-center gap-3 self-end md:self-center">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-black text-slate-200 block">{currentUser?.name || 'Operator'}</span>
              <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">
                {isAdmin ? 'ADMINISTRATOR' : 'FIELD WORKER'}
              </span>
            </div>

            <button
              id="global-refresh-btn"
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer active:scale-95 shadow-xs"
              title="Synchronize live backend records"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Workflow Tabs (Admin: 4 Tabs, Worker: View List + Dashboard) */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-1 border-t border-slate-800/80 pt-4">
          {/* Tab 1: PERFORMANCE DASHBOARD */}
          <button
            id="tab-dashboard"
            onClick={() => {
              if (activeTab === 'VIEW_LIST') {
                setIsDashboardExpanded(prev => !prev);
              } else {
                setActiveTab('VIEW_LIST');
                setIsDashboardExpanded(true);
              }
            }}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              (activeTab === 'DASHBOARD' || (activeTab === 'VIEW_LIST' && isDashboardExpanded))
                ? 'bg-amber-500 text-slate-950 shadow-md font-black ring-2 ring-amber-300'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>{lang === 'bn' ? '১. পারফরম্যান্স ড্যাশবোর্ড' : '1. PERFORMANCE DASHBOARD'}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${
              (activeTab === 'DASHBOARD' || (activeTab === 'VIEW_LIST' && isDashboardExpanded)) ? 'rotate-180' : ''
            }`} />
          </button>

          {/* Tab 2: UPLOAD LIST (Admin Only) */}
          {isAdmin && (
            <button
              id="tab-upload"
              onClick={() => setActiveTab('UPLOAD')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'UPLOAD'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>{lang === 'bn' ? '২. তালিকা আপলোড' : '2. UPLOAD LIST'}</span>
            </button>
          )}

          {/* Tab 3: WORKER-WISE REPORT */}
          <button
            id="tab-report"
            onClick={() => setActiveTab('REPORT')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'REPORT'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{lang === 'bn' ? '৩. কর্মীভিত্তিক রিপোর্ট' : '3. WORKER-WISE REPORT'}</span>
          </button>

          {/* Tab 4: VIEW LIST (Both Admin & Worker) */}
          <button
            id="tab-view-list"
            onClick={() => setActiveTab('VIEW_LIST')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'VIEW_LIST'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{lang === 'bn' ? '৪. উপভোক্তা তালিকা' : '4. VIEW LIST'}</span>
            <span
              className={`ml-1 px-2 py-0.5 rounded-md text-[10px] font-black ${
                activeTab === 'VIEW_LIST' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {tasks.length}
            </span>
          </button>
        </div>
      </div>

      {/* Error Alert if any */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadData(true)}
            className="px-3 py-1 bg-rose-200 hover:bg-rose-300 text-rose-900 rounded-lg text-xs cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Content Sections */}
      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3 animate-pulse">
            <Zap className="w-6 h-6 fill-amber-500" />
          </div>
          <h3 className="text-base font-black text-slate-900">
            {lang === 'bn' ? 'ডিসকানেকশন ডাটা লোড হচ্ছে...' : 'Loading Disconnection Module...'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">Synchronizing live consumer records from Google Sheets...</p>
        </div>
      ) : (
        <>
          {/* SECTION 1: PERFORMANCE DASHBOARD */}
          {activeTab === 'DASHBOARD' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm">
                <div className="flex items-center gap-2.5 text-white">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <LayoutDashboard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold leading-tight">
                      {lang === 'bn' ? 'পারফরম্যান্স ড্যাশবোর্ড' : 'Performance Dashboard'}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {lang === 'bn' ? 'লাইভ ডিসকানেকশন ও কর্মী পারফরম্যান্স মেট্রিক্স' : 'Live disconnection & worker performance metrics'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('VIEW_LIST')}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'উপভোক্তা তালিকায় যান' : 'Go to Consumer List'}</span>
                </button>
              </div>

              <DisconnectionDashboard
                tasks={tasks}
                stats={stats}
                onRefresh={() => loadData(true)}
                isRefreshing={isRefreshing}
                onSelectStatusFilter={handleSelectStatusFilterFromDashboard}
                onSelectWorkerFilter={handleSelectWorkerFilterFromDashboard}
                lang={lang}
              />
            </div>
          )}

          {/* SECTION 2: UPLOAD LIST */}
          {activeTab === 'UPLOAD' && isAdmin && (
            <DisconnectionUpload
              existingTasks={tasks}
              onUploadSuccess={handleUploadSuccess}
              onNavigateToViewList={() => setActiveTab('VIEW_LIST')}
              adminUser={{
                idNo: currentUser?.idNo,
                username: currentUser?.username,
                name: currentUser?.name
              }}
              lang={lang}
            />
          )}

          {/* SECTION 3: REPORT */}
          {activeTab === 'REPORT' && isAdmin && (
            <DisconnectionReport
              tasks={tasks}
              onRefresh={() => loadData(true)}
              isRefreshing={isRefreshing}
              lang={lang}
            />
          )}

          {/* SECTION 4: VIEW LIST */}
          {activeTab === 'VIEW_LIST' && (
            <div className="space-y-4" id="disconnection-view-list-container">
              {/* INTERACTIVE COLLAPSIBLE PERFORMANCE DASHBOARD OPTION (ANIMATED ACCORDION TOGGLE) */}
              <div className="space-y-3">
                <div
                  onClick={() => setIsDashboardExpanded(!isDashboardExpanded)}
                  className="bg-linear-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-500/30 hover:border-amber-400/60 rounded-2xl p-4 text-white cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md group select-none relative overflow-hidden"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isDashboardExpanded}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setIsDashboardExpanded(!isDashboardExpanded); }}
                >
                  {/* Subtle amber glow */}
                  <div className="absolute top-0 right-0 -mt-6 -mr-6 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/20 transition-all"></div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0 ${
                        isDashboardExpanded
                          ? 'bg-amber-500 text-slate-950 scale-105 shadow-md'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 group-hover:scale-105 group-hover:bg-amber-500 group-hover:text-slate-950'
                      }`}>
                        <LayoutDashboard className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black tracking-wide text-white uppercase flex items-center gap-2">
                            <span>{lang === 'bn' ? '১. পারফরম্যান্স ড্যাশবোর্ড' : '1. PERFORMANCE DASHBOARD'}</span>
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            LIVE
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5 line-clamp-1">
                          {isDashboardExpanded
                            ? (lang === 'bn' 
                                ? 'ক্লিক করে ড্যাশবোর্ড সংক্ষেপ বা বন্ধ করুন' 
                                : 'Click to collapse performance dashboard')
                            : (lang === 'bn' 
                                ? 'ক্লিক করুন — অ্যানিমেশনের সাহায্যে পারফরম্যান্স ড্যাশবোর্ড ওপেন হবে' 
                                : 'Click to open live performance dashboard with animation')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                      {/* Micro stats counter */}
                      <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold">
                        <span className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                          {lang === 'bn' ? 'মোট:' : 'Total:'} <strong className="text-white font-extrabold">{tasks.length}</strong>
                        </span>
                        <span className="px-2.5 py-1.5 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                          {lang === 'bn' ? 'সম্পন্ন:' : 'Done:'} <strong className="text-emerald-400 font-extrabold">{stats.completedTasks || tasks.filter(t => t.taskStatus === 'COMPLETED' || t.taskStatus === 'DISCONNECT').length}</strong>
                        </span>
                        <span className="px-2.5 py-1.5 rounded-lg bg-amber-950/80 text-amber-300 border border-amber-800/80">
                          {lang === 'bn' ? 'পেন্ডিং:' : 'Pending:'} <strong className="text-amber-400 font-extrabold">{stats.pendingTasks || tasks.filter(t => t.taskStatus === 'PENDING' || t.taskStatus === 'IN PROGRESS').length}</strong>
                        </span>
                      </div>

                      {/* CTA Toggle Button with Animated Rotating Chevron */}
                      <div className={`px-4 py-2 font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all duration-300 ${
                        isDashboardExpanded
                          ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 shadow-md font-black'
                          : 'bg-slate-800 group-hover:bg-slate-700 text-amber-400 border border-amber-500/40'
                      }`}>
                        <span>
                          {isDashboardExpanded
                            ? (lang === 'bn' ? 'ড্যাশবোর্ড বন্ধ করুন' : 'Close Dashboard')
                            : (lang === 'bn' ? 'ড্যাশবোর্ড খুলুন' : 'Open Dashboard')}
                        </span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ease-out ${
                          isDashboardExpanded ? 'rotate-180 text-slate-950' : 'text-amber-400'
                        }`} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Animated Accordion Body for Disconnection Dashboard */}
                {isDashboardExpanded && (
                  <div className="overflow-hidden transition-all duration-500 ease-in-out animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="bg-slate-900/95 border border-amber-500/30 rounded-3xl p-4 sm:p-6 shadow-2xl relative">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                        <div className="flex items-center gap-2 text-slate-200">
                          <LayoutDashboard className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-bold uppercase tracking-wider">
                            {lang === 'bn' ? 'লাইভ ডিসকানেকশন কার্যক্ষমতা মেট্রিক্স' : 'Live Disconnection Performance Metrics'}
                          </span>
                        </div>
                        <button
                          onClick={() => setIsDashboardExpanded(false)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <span>{lang === 'bn' ? 'ড্যাশবোর্ড সংক্ষেপ করুন' : 'Collapse'}</span>
                          <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                        </button>
                      </div>

                      <DisconnectionDashboard
                        tasks={tasks}
                        stats={stats}
                        onRefresh={() => loadData(true)}
                        isRefreshing={isRefreshing}
                        onSelectStatusFilter={handleSelectStatusFilterFromDashboard}
                        onSelectWorkerFilter={handleSelectWorkerFilterFromDashboard}
                        lang={lang}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Search, Status Pills & Sort Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                {/* Search & Selectors */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={
                        lang === 'bn'
                          ? 'ক্রমিক নং (SL 001...), উপভোক্তার নাম, ঠিকানা বা ফোন দিয়ে খুঁজুন...'
                          : 'Search by Serial No (SL 001...), Consumer Name, Address or Phone...'
                      }
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Agency Dropdown */}
                    <select
                      value={agencyFilter}
                      onChange={e => setAgencyFilter(e.target.value)}
                      className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="ALL">{lang === 'bn' ? 'সকল এজেন্সি / কর্মী' : 'All Agencies / Workers'}</option>
                      {uniqueAgencies.map((ag, idx) => (
                        <option key={idx} value={ag}>
                          {ag}
                        </option>
                      ))}
                    </select>

                    {/* Sort Dropdown */}
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value as any)}
                      className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="SERIAL_ASC">{lang === 'bn' ? 'ক্রমিক নং (SL 001...)' : 'Serial No (SL 001...)'}</option>
                      <option value="URGENT_FIRST">{lang === 'bn' ? 'জরুরি অগ্রাধিকার' : 'Urgent First'}</option>
                      <option value="DUE_DESC">{lang === 'bn' ? 'বকেয়া: বেশি থেকে কম' : 'Dues: High to Low'}</option>
                      <option value="DUE_ASC">{lang === 'bn' ? 'বকেয়া: কম থেকে বেশি' : 'Dues: Low to High'}</option>
                      <option value="NAME_ASC">{lang === 'bn' ? 'নাম: A থেকে Z' : 'Name: A to Z'}</option>
                      <option value="NEWEST">{lang === 'bn' ? 'সর্বশেষ আপডেট' : 'Newest'}</option>
                    </select>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold pt-1">
                  <button
                    onClick={() => setStatusFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
                      statusFilter === 'ALL'
                        ? 'bg-slate-900 text-white shadow-2xs font-black'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    All ({counts.total})
                  </button>

                  <button
                    onClick={() => setStatusFilter('URGENT')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all flex items-center gap-1 whitespace-nowrap ${
                      statusFilter === 'URGENT'
                        ? 'bg-red-600 text-white shadow-2xs font-black'
                        : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>Urgent ({counts.urgent})</span>
                  </button>

                  <button
                    onClick={() => setStatusFilter('DISCONNECT')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
                      statusFilter === 'DISCONNECT'
                        ? 'bg-rose-600 text-white shadow-2xs font-black'
                        : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    Disconnect ({counts.disconnect})
                  </button>

                  <button
                    onClick={() => setStatusFilter('PAID')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
                      statusFilter === 'PAID'
                        ? 'bg-teal-600 text-white shadow-2xs font-black'
                        : 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100'
                    }`}
                  >
                    Paid ({counts.paid})
                  </button>

                  <button
                    onClick={() => setStatusFilter('PENDING')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
                      statusFilter === 'PENDING'
                        ? 'bg-amber-500 text-slate-950 shadow-2xs font-black'
                        : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    Pending ({counts.pending})
                  </button>

                  <button
                    onClick={() => setStatusFilter('DISPUTE')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
                      statusFilter === 'DISPUTE'
                        ? 'bg-orange-500 text-white shadow-2xs font-black'
                        : 'bg-orange-50 text-orange-900 border border-orange-200 hover:bg-orange-100'
                    }`}
                  >
                    Dispute ({counts.dispute})
                  </button>

                  <button
                    onClick={() => setStatusFilter('OFFICE TEAM')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
                      statusFilter === 'OFFICE TEAM'
                        ? 'bg-indigo-600 text-white shadow-2xs font-black'
                        : 'bg-indigo-50 text-indigo-900 border border-indigo-200 hover:bg-indigo-100'
                    }`}
                  >
                    Office Team ({counts.officeTeam})
                  </button>

                  <button
                    onClick={() => setStatusFilter('NOT FOUND')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
                      statusFilter === 'NOT FOUND'
                        ? 'bg-slate-700 text-white shadow-2xs font-black'
                        : 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    Not Found ({counts.notFound})
                  </button>

                  <button
                    onClick={() => setStatusFilter('REISSUE')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
                      statusFilter === 'REISSUE'
                        ? 'bg-purple-600 text-white shadow-2xs font-black'
                        : 'bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100'
                    }`}
                  >
                    Reissue ({counts.reissue})
                  </button>
                </div>
              </div>

              {/* Consumer Card Grid */}
              {filteredTasks.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">
                    {lang === 'bn' ? 'কোনো উপভোক্তা পাওয়া যায়নি' : 'No consumers match your search / filter'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {lang === 'bn'
                      ? 'ফিল্টার রিসেট করুন অথবা অ্যাডমিনকে নতুন তালিকা আপলোড করতে বলুন।'
                      : 'Try resetting filters, or upload a new disconnection list from the Upload tab.'}
                  </p>
                  {(searchQuery || statusFilter !== 'ALL' || agencyFilter !== 'ALL') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('ALL');
                        setAgencyFilter('ALL');
                      }}
                      className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTasks.map(task => (
                    <DisconnectionConsumerCard
                      key={task.taskId || task.consumerId}
                      task={task}
                      onUpdateStatus={handleOpenUpdateModal}
                      lang={lang}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* UPDATE STATUS MODAL */}
      {selectedTaskForUpdate && (
        <DisconnectionUpdateModal
          task={selectedTaskForUpdate}
          isOpen={isUpdateModalOpen}
          onClose={() => {
            setIsUpdateModalOpen(false);
            setSelectedTaskForUpdate(null);
          }}
          onUpdateSuccess={handleTaskUpdated}
          currentUser={{
            idNo: currentUser?.idNo,
            username: currentUser?.username,
            name: currentUser?.name,
            role: currentUser?.role
          }}
          availableWorkers={availableWorkers}
          lang={lang}
        />
      )}
    </div>
  );
};

export default DisconnectionTaskManagement;
