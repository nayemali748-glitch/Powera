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
  Sparkles,
  MoreVertical,
  MessageSquareWarning,
  RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  DisconnectionTask,
  DisconnectionTaskStatus,
  DisconnectionStats,
  UserSession,
  UserAccount
} from '../types';
import {
  fetchDisconnectionTasks,
  fetchUsers,
  deleteDisconnectionTask,
  submitDisconnectionTaskReport,
  getCachedDisconnectionTasksSync,
  setCachedDisconnectionTasksSync,
  isValidDisconnectionTaskOrRow
} from '../services/api';
import { Language } from '../utils/translations';
import {
  getTaskPhase,
  getTaskConnectionClass,
  matchesDisconnectionStatusFilter,
  PhaseFilterType,
  ConnectionClassFilterType,
  getReissueLockState,
  cleanDisconnectionNotes,
  cleanWorkerOrAgencyName
} from '../utils/disconnectionClassifier';
import { getNowDateDDMMYYYY, getNowTime12Hour } from '../utils/dateTimeFormat';
import { DisconnectionDashboard } from './disconnection/DisconnectionDashboard';
import { DisconnectionUpload } from './disconnection/DisconnectionUpload';
import { DisconnectionReport } from './disconnection/DisconnectionReport';
import { DisconnectionConsumerCard } from './disconnection/DisconnectionConsumerCard';
import { DisconnectionUpdateModal } from './disconnection/DisconnectionUpdateModal';

export type DisconnectionTab = 'DASHBOARD' | 'UPLOAD' | 'REPORT' | 'VIEW_LIST';

interface DisconnectionTaskManagementProps {
  currentUser?: UserSession | null;
  lang?: Language;
  onBack?: () => void;
  onTasksChange?: (count: number) => void;
  initialTab?: DisconnectionTab;
}

export const DisconnectionTaskManagement: React.FC<DisconnectionTaskManagementProps> = ({
  currentUser,
  lang = 'en',
  onBack,
  onTasksChange,
  initialTab = 'VIEW_LIST'
}) => {
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.idNo === 'ADMIN' || currentUser?.idNo === '8695716192';

  // Navigation tab state (Workers always view the Consumer List directly)
  const [activeTab, setActiveTab] = useState<DisconnectionTab>(isAdmin ? initialTab : 'VIEW_LIST');
  const [isDashboardExpanded, setIsDashboardExpanded] = useState<boolean>(isAdmin && initialTab === 'DASHBOARD');

  useEffect(() => {
    if (!isAdmin) {
      setActiveTab('VIEW_LIST');
      setIsDashboardExpanded(false);
      return;
    }
    if (initialTab) {
      setActiveTab(initialTab);
      if (initialTab === 'DASHBOARD') {
        setIsDashboardExpanded(true);
      }
    }
  }, [initialTab, isAdmin]);

  // Core Data States (Initialized synchronously from local cache for 0ms instant rendering)
  const [tasks, setTasks] = useState<DisconnectionTask[]>(() => getCachedDisconnectionTasksSync());
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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // View List Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilterType>('ALL');
  const [classFilter, setClassFilter] = useState<ConnectionClassFilterType>('ALL');
  const [agencyFilter, setAgencyFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'SERIAL_ASC' | 'DUE_DESC' | 'DUE_ASC' | 'NAME_ASC' | 'URGENT_FIRST' | 'NEWEST'>('SERIAL_ASC');
  const [workerOnlyFilter, setWorkerOnlyFilter] = useState<boolean>(!isAdmin);
  const [showThreeDotMenu, setShowThreeDotMenu] = useState<boolean>(false);

  // Update Status Modal
  const [selectedTaskForUpdate, setSelectedTaskForUpdate] = useState<DisconnectionTask | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // Fast Non-Blocking Data Fetch & Background Sync (Preserves stable card order so consumer list never jumps)
  const loadData = useCallback(async (showRefreshingSpinner = false) => {
    if (showRefreshingSpinner) {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const discResult = await fetchDisconnectionTasks({
        role: currentUser?.role,
        workerId: currentUser?.idNo,
        workerName: currentUser?.name
      });

      if (discResult && Array.isArray(discResult.tasks)) {
        const cleanIncoming = discResult.tasks.filter(isValidDisconnectionTaskOrRow);
        setTasks(prev => {
          const cleanPrev = prev.filter(isValidDisconnectionTaskOrRow);
          const incomingList = cleanIncoming;
          if (cleanPrev.length === 0) {
            setCachedDisconnectionTasksSync(incomingList);
            return incomingList;
          }

          // Preserve existing visual order for already-rendered consumers so cards never jump around
          const incomingMap = new Map<string, DisconnectionTask>();
          incomingList.forEach(item => {
            const key = String(item.consumerId || (item as any)['Consumer Id'] || item.taskId || '').trim().toLowerCase();
            if (key) incomingMap.set(key, item);
          });

          const nextOrdered: DisconnectionTask[] = [];
          const visitedKeys = new Set<string>();

          for (const oldItem of cleanPrev) {
            const key = String(oldItem.consumerId || (oldItem as any)['Consumer Id'] || oldItem.taskId || '').trim().toLowerCase();
            if (key && incomingMap.has(key)) {
              const updated = incomingMap.get(key)!;
              visitedKeys.add(key);
              nextOrdered.push({
                ...updated,
                serialNumber: oldItem.serialNumber || updated.serialNumber
              });
            }
          }

          // Append any newly added consumers at the end
          for (const newItem of incomingList) {
            const key = String(newItem.consumerId || (newItem as any)['Consumer Id'] || newItem.taskId || '').trim().toLowerCase();
            if (key && !visitedKeys.has(key)) {
              visitedKeys.add(key);
              nextOrdered.push({
                ...newItem,
                serialNumber: `SL ${String(nextOrdered.length + 1).padStart(3, '0')}`
              });
            }
          }

          // Only trigger a React state update if data actually changed
          const hasChanged =
            nextOrdered.length !== prev.length ||
            nextOrdered.some((item, idx) => {
              const p = prev[idx];
              if (!p) return true;
              return (
                item.consumerId !== p.consumerId ||
                item.taskStatus !== p.taskStatus ||
                item.disconStatus !== p.disconStatus ||
                item.workerRemarks !== p.workerRemarks ||
                item.notes !== p.notes ||
                item.assignedAgency !== p.assignedAgency ||
                item.assignedWorkerName !== p.assignedWorkerName ||
                item.outstandingDue !== p.outstandingDue ||
                item.meterNumber !== p.meterNumber ||
                item.deviceType !== p.deviceType
              );
            });

          if (!hasChanged) {
            return prev;
          }

          setCachedDisconnectionTasksSync(nextOrdered);
          return nextOrdered;
        });

        if (onTasksChange) onTasksChange(discResult.tasks.length);
        if (discResult.stats) {
          setStats(discResult.stats);
        }
      }
    } catch (err: any) {
      console.error('Failed to load disconnection tasks:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentUser?.role, currentUser?.idNo, currentUser?.name, onTasksChange]);

  // Load users in parallel without blocking Disconnection list rendering
  useEffect(() => {
    fetchUsers()
      .then(usersResult => {
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
      })
      .catch(() => {});
  }, []);

  // Initial load + Continuous 8s Live Auto-Sync with Backend Google Sheet
  useEffect(() => {
    loadData(false);
    const interval = setInterval(() => {
      loadData(false);
    }, 8000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Handle task update from modal (keeps consumer details unchanged; updates status badge, remark & backend sheet)
  const handleTaskUpdated = (updatedTask: DisconnectionTask) => {
    try {
      confetti({
        particleCount: 40,
        spread: 55,
        origin: { y: 0.7 }
      });
    } catch {
      // ignore
    }

    setTasks(prev => {
      const next = prev.map(t =>
        (t.taskId === updatedTask.taskId || (t.consumerId && t.consumerId === updatedTask.consumerId))
          ? {
              ...t,
              ...updatedTask,
              taskStatus: updatedTask.taskStatus,
              disconStatus: updatedTask.disconStatus,
              'Discon Status': updatedTask['Discon Status'],
              workerRemarks: updatedTask.workerRemarks,
              workerReport: updatedTask.workerReport,
              Notes: updatedTask.Notes,
              notes: updatedTask.notes,
              statusHistory: updatedTask.statusHistory
            }
          : t
      );
      setCachedDisconnectionTasksSync(next);
      return next;
    });
  };

  // Handle upload success (immediately shows uploaded consumers and syncs to backend sheet)
  const handleUploadSuccess = (newTasks: DisconnectionTask[]) => {
    setTasks(prev => {
      const existingMap = new Map<string, DisconnectionTask>();
      prev.forEach(t => {
        const key = String(t.consumerId || (t as any)['Consumer Id'] || t.taskId || '').trim();
        if (key) existingMap.set(key, t);
      });
      newTasks.forEach((nt, idx) => {
        const key = String(nt.consumerId || (nt as any)['Consumer Id'] || nt.taskId || `NEW-${idx}`).trim();
        const prevItem = existingMap.get(key);
        existingMap.set(key, {
          ...(prevItem || {}),
          ...nt,
          taskId: nt.taskId || prevItem?.taskId || `TASK-DISC-${key}`,
          serialNumber: nt.serialNumber || prevItem?.serialNumber || `SL ${String(existingMap.size + 1).padStart(3, '0')}`
        } as DisconnectionTask);
      });
      const merged = Array.from(existingMap.values()).map((item, idx) => ({
        ...item,
        serialNumber: `SL ${String(idx + 1).padStart(3, '0')}`
      }));
      setCachedDisconnectionTasksSync(merged);
      if (onTasksChange) onTasksChange(merged.length);
      return merged;
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

  // Delete Consumer Handler (Admin Only - Instant 0ms UI removal + Permanent Backend Sheet deletion)
  const handleDeleteTask = async (task: DisconnectionTask) => {
    if (!isAdmin) return;
    const cId = String(task.consumerId || (task as any)['Consumer Id'] || '').trim();
    const tId = String(task.taskId || '').trim();

    // 1. Immediately remove from UI & local cache in 0ms
    setTasks(prev => {
      const next = prev.filter(t => {
        const curCId = String(t.consumerId || (t as any)['Consumer Id'] || '').trim();
        const curTId = String(t.taskId || '').trim();
        if (cId && curCId === cId) return false;
        if (tId && curTId === tId) return false;
        return true;
      });
      setCachedDisconnectionTasksSync(next);
      if (onTasksChange) onTasksChange(next.length);
      return next;
    });

    // 2. Permanently delete from server & backend Google Sheet
    await deleteDisconnectionTask(task);
  };

  // Open Update Modal (Enforce 1-time update lock for Workers unless Admin Re-issued)
  const handleOpenUpdateModal = (task: DisconnectionTask) => {
    if (!isAdmin) {
      const lockState = getReissueLockState(task);
      if (lockState.isLockedForWorker) {
        return;
      }
    }
    setSelectedTaskForUpdate(task);
    setIsUpdateModalOpen(true);
  };

  // Worker requests Re-issue so Admin can unlock the consumer for another status update
  const handleRequestReissue = async (task: DisconnectionTask) => {
    const workerName = cleanWorkerOrAgencyName(currentUser?.name || currentUser?.username || 'Worker');
    const timeStr = `${getNowDateDDMMYYYY()} ${getNowTime12Hour()}`;
    const existingNotes = cleanDisconnectionNotes(task.workerRemarks || task.workerReport || task.notes || (task as any)['Notes'] || '');
    const taggedNotes = `${existingNotes} [REISSUE_REQ:${workerName}|${timeStr}]`.trim();

    setTasks(prev => {
      const next = prev.map(t =>
        (t.taskId === task.taskId || (t.consumerId && t.consumerId === task.consumerId))
          ? {
              ...t,
              workerRemarks: taggedNotes,
              workerReport: taggedNotes,
              notes: taggedNotes,
              Notes: taggedNotes,
              reissueRequested: true,
              reissueRequestedBy: workerName,
              reissueRequestedAt: timeStr,
              reissueApproved: false
            }
          : t
      );
      setCachedDisconnectionTasksSync(next);
      return next;
    });

    try {
      await submitDisconnectionTaskReport({
        ...task,
        taskId: task.taskId,
        consumerId: task.consumerId || (task as any)['Consumer Id'],
        workerId: currentUser?.idNo || 'WORKER',
        workerName,
        taskStatus: task.taskStatus,
        disconStatus: task.disconStatus || task.taskStatus,
        workerRemarks: taggedNotes,
        workerReport: taggedNotes,
        notes: taggedNotes
      });
    } catch (err) {
      console.warn('Re-issue request sync notice:', err);
    }
  };

  // Admin approves Re-issue request -> unlocks consumer for Worker to update status once more
  const handleApproveReissue = async (task: DisconnectionTask) => {
    if (!isAdmin) return;
    const adminName = cleanWorkerOrAgencyName(currentUser?.name || 'Admin');
    const existingNotes = cleanDisconnectionNotes(task.workerRemarks || task.workerReport || task.notes || (task as any)['Notes'] || '');
    const approvedNotes = `${existingNotes} [REISSUE_APPROVED]`.trim();

    setTasks(prev => {
      const next = prev.map(t =>
        (t.taskId === task.taskId || (t.consumerId && t.consumerId === task.consumerId))
          ? {
              ...t,
              taskStatus: 'REISSUE' as DisconnectionTaskStatus,
              disconStatus: 'REISSUE',
              'Discon Status': 'REISSUE',
              workerRemarks: approvedNotes,
              workerReport: approvedNotes,
              notes: approvedNotes,
              Notes: approvedNotes,
              reissueRequested: false,
              reissueApproved: true
            }
          : t
      );
      setCachedDisconnectionTasksSync(next);
      return next;
    });

    try {
      await submitDisconnectionTaskReport({
        ...task,
        taskId: task.taskId,
        consumerId: task.consumerId || (task as any)['Consumer Id'],
        workerId: currentUser?.idNo || 'ADMIN',
        workerName: adminName,
        taskStatus: 'REISSUE',
        disconStatus: 'REISSUE',
        workerRemarks: approvedNotes,
        workerReport: approvedNotes,
        notes: approvedNotes
      });
    } catch (err) {
      console.warn('Re-issue approval sync notice:', err);
    }
  };

  // Pending Re-issue SMS Requests for Admin
  const pendingReissueTasks = useMemo(() => {
    return tasks.filter(t => getReissueLockState(t).isReissueRequested);
  }, [tasks]);

  // Unique Agencies / Workers (Name Only, No ID) from tasks for filter dropdown
  const uniqueAgencies = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => {
      const ag = cleanWorkerOrAgencyName(t.assignedAgency || t.Agency || t.assignedWorkerName || '');
      if (ag) set.add(ag);
    });
    return Array.from(set).sort();
  }, [tasks]);

  // Filtered & Sorted View List Consumers
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (!isValidDisconnectionTaskOrRow(t)) return false;
      // Worker only restriction if toggled or worker mode
      if (workerOnlyFilter && !isAdmin) {
        const myName = cleanWorkerOrAgencyName(currentUser?.name || currentUser?.username || '').toLowerCase();
        const myId = String(currentUser?.idNo || '').toLowerCase().trim();
        const assignedWorker = cleanWorkerOrAgencyName(t.assignedWorkerName || t.assignedAgency || t.Agency || '').toLowerCase();
        const assignedId = String(t.assignedWorkerId || '').toLowerCase().trim();

        // If explicitly assigned to a specific worker, check if it belongs to this worker
        if (assignedId || assignedWorker) {
          const isMine = (myName && assignedWorker.includes(myName)) || (myId && assignedId === myId);
          if (!isMine) return false;
        }
      }

      // Status Filter (Unified matcher supports PAID, DISCONNECT, COMPLETED, PENDING, DISPUTE, OFFICE TEAM, NOT FOUND, REISSUE, URGENT)
      if (!matchesDisconnectionStatusFilter(t, statusFilter)) {
        return false;
      }

      // Phase Filter (1PH / 3PH)
      if (phaseFilter !== 'ALL' && getTaskPhase(t) !== phaseFilter) {
        return false;
      }

      // Connection Class Filter (DOMESTIC / COMMERCIAL / INDUSTRIAL / STW)
      if (classFilter !== 'ALL' && getTaskConnectionClass(t) !== classFilter) {
        return false;
      }

      // Agency / Worker Filter
      if (agencyFilter !== 'ALL') {
        const ag = cleanWorkerOrAgencyName(t.assignedAgency || t.Agency || t.assignedWorkerName || '');
        if (ag !== agencyFilter) return false;
      }

      // Search Query: Consumer Id / Name / MRU / off_code / Phone / Meter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          (t.serialNumber && t.serialNumber.toLowerCase().includes(q)) ||
          (t.consumerName && t.consumerName.toLowerCase().includes(q)) ||
          (t.Name && t.Name.toLowerCase().includes(q)) ||
          (t.consumerId && t.consumerId.toLowerCase().includes(q)) ||
          (t['Consumer Id'] && t['Consumer Id'].toLowerCase().includes(q)) ||
          (t.accountNumber && t.accountNumber.toLowerCase().includes(q)) ||
          (t.mru && t.mru.toLowerCase().includes(q)) ||
          (t.MRU && t.MRU.toLowerCase().includes(q)) ||
          (t.mruSection && t.mruSection.toLowerCase().includes(q)) ||
          (t.offCode && t.offCode.toLowerCase().includes(q)) ||
          (t.off_code && t.off_code.toLowerCase().includes(q)) ||
          (t.area && t.area.toLowerCase().includes(q)) ||
          (t.consumerAddress && t.consumerAddress.toLowerCase().includes(q)) ||
          (t.Address && t.Address.toLowerCase().includes(q)) ||
          (t.meterNumber && t.meterNumber.toLowerCase().includes(q)) ||
          (t.Number && t.Number.toLowerCase().includes(q)) ||
          (t.phoneNumber && t.phoneNumber.includes(q)) ||
          (t.Mobile && t.Mobile.includes(q)) ||
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
  }, [tasks, statusFilter, phaseFilter, classFilter, agencyFilter, searchQuery, sortBy, workerOnlyFilter, isAdmin, currentUser]);

  // Counts for pills (Status + 1PH/3PH + Domestic/Commercial/Industrial/STW)
  const counts = useMemo(() => {
    let urgent = 0;
    let disconnect = 0;
    let paid = 0;
    let pending = 0;
    let dispute = 0;
    let officeTeam = 0;
    let notFound = 0;
    let reissue = 0;
    let completed = 0;

    let phase1 = 0;
    let phase3 = 0;
    let domestic = 0;
    let commercial = 0;
    let industrial = 0;
    let stw = 0;

    tasks.forEach(t => {
      if (matchesDisconnectionStatusFilter(t, 'URGENT')) urgent++;
      if (matchesDisconnectionStatusFilter(t, 'DISCONNECT')) {
        disconnect++;
        completed++;
      } else if (matchesDisconnectionStatusFilter(t, 'PAID')) {
        paid++;
        completed++;
      } else if (matchesDisconnectionStatusFilter(t, 'DISPUTE')) {
        dispute++;
      } else if (matchesDisconnectionStatusFilter(t, 'OFFICE TEAM')) {
        officeTeam++;
      } else if (matchesDisconnectionStatusFilter(t, 'NOT FOUND')) {
        notFound++;
      } else if (matchesDisconnectionStatusFilter(t, 'REISSUE')) {
        reissue++;
      } else {
        pending++;
      }

      const ph = getTaskPhase(t);
      if (ph === '3PH') phase3++;
      else phase1++;

      const cls = getTaskConnectionClass(t);
      if (cls === 'COMMERCIAL') commercial++;
      else if (cls === 'INDUSTRIAL') industrial++;
      else if (cls === 'STW') stw++;
      else domestic++;
    });

    return {
      total: tasks.length,
      urgent,
      disconnect,
      paid,
      pending,
      dispute,
      officeTeam,
      notFound,
      reissue,
      completed,
      phase1,
      phase3,
      domestic,
      commercial,
      industrial,
      stw
    };
  }, [tasks]);

  return (
    <div className="space-y-3.5 w-full max-w-full overflow-x-hidden mx-auto pb-12 animate-in fade-in duration-150 box-border" id="disconnection-module-root">
      {/* Compact Top Banner Bar: Disconnection Management */}
      <div className="bg-slate-900 text-white rounded-2xl px-3 py-2.5 shadow-md border border-slate-800 flex items-center justify-between gap-2 w-full max-w-full box-border">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {onBack && (
            <button
              type="button"
              id="disconnection-back-btn"
              onClick={onBack}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
              title="Back to Main Menu"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Zap className="w-3.5 h-3.5 fill-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xs sm:text-base font-black tracking-tight text-white leading-snug">
              {lang === 'bn' ? 'ডিসকানেকশন ম্যানেজমেন্ট' : 'Disconnection Management'}
            </h1>
          </div>
        </div>

        {/* Live Auto-Sync Badge & Refresh */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-black tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>LIVE AUTO-SYNC</span>
          </div>
          <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-black whitespace-nowrap">
            {tasks.length} Records
          </span>
          <button
            id="global-refresh-btn"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer active:scale-95 shadow-xs shrink-0"
            title="Synchronize live backend records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Compact Option Cards (Admin Only - Workers view the consumer list directly) */}
      {isAdmin && (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" id="disconnection-compact-options">
        {/* 1. PERFORMANCE DASHBOARD */}
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
          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all text-left cursor-pointer ${
            (activeTab === 'DASHBOARD' || (activeTab === 'VIEW_LIST' && isDashboardExpanded))
              ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-200'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50/60 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              (activeTab === 'DASHBOARD' || (activeTab === 'VIEW_LIST' && isDashboardExpanded))
                ? 'bg-white/20 text-white'
                : 'bg-amber-100 text-amber-700'
            }`}>
              <LayoutDashboard className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] font-black tracking-tight leading-tight">
                {lang === 'bn' ? '১. পারফরম্যান্স ড্যাশবোর্ড' : '1. PERFORMANCE DASHBOARD'}
              </div>
              <div className={`text-[9px] font-bold leading-tight mt-0.5 ${
                (activeTab === 'DASHBOARD' || (activeTab === 'VIEW_LIST' && isDashboardExpanded)) ? 'text-amber-100' : 'text-slate-400'
              }`}>
                {counts.paid} Paid • {counts.disconnect} Discon
              </div>
            </div>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
            (activeTab === 'DASHBOARD' || (activeTab === 'VIEW_LIST' && isDashboardExpanded)) ? 'rotate-180 text-white' : 'text-slate-400'
          }`} />
        </button>

        {/* 2. UPLOAD LIST (Admin Only) */}
        {isAdmin && (
          <button
            id="tab-upload"
            onClick={() => setActiveTab('UPLOAD')}
            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all text-left cursor-pointer ${
              activeTab === 'UPLOAD'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50/60 hover:border-indigo-300'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                activeTab === 'UPLOAD' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
              }`}>
                <UploadCloud className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-[11px] font-black tracking-tight leading-tight">
                  {lang === 'bn' ? '২. তালিকা আপলোড' : '2. UPLOAD LIST'}
                </div>
                <div className={`text-[9px] font-bold leading-tight mt-0.5 ${
                  activeTab === 'UPLOAD' ? 'text-indigo-100' : 'text-slate-400'
                }`}>
                  Excel / CSV / Sheet Sync
                </div>
              </div>
            </div>
          </button>
        )}

        {/* 3. WORKER-WISE REPORT */}
        <button
          id="tab-report"
          onClick={() => setActiveTab('REPORT')}
          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all text-left cursor-pointer ${
            activeTab === 'REPORT'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-200'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50/60 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              activeTab === 'REPORT' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
            }`}>
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] font-black tracking-tight leading-tight">
                {lang === 'bn' ? '৩. কর্মীভিত্তিক রিপোর্ট' : '3. WORKER-WISE REPORT'}
              </div>
              <div className={`text-[9px] font-bold leading-tight mt-0.5 ${
                activeTab === 'REPORT' ? 'text-emerald-100' : 'text-slate-400'
              }`}>
                Field Progress Summary
              </div>
            </div>
          </div>
        </button>

        {/* 4. VIEW LIST */}
        <button
          id="tab-view-list"
          onClick={() => setActiveTab('VIEW_LIST')}
          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all text-left cursor-pointer ${
            activeTab === 'VIEW_LIST'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-300'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              activeTab === 'VIEW_LIST' ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-700'
            }`}>
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] font-black tracking-tight leading-tight">
                {lang === 'bn' ? '৪. উপভোক্তা তালিকা' : '4. VIEW LIST'}
              </div>
              <div className={`text-[9px] font-bold leading-tight mt-0.5 ${
                activeTab === 'VIEW_LIST' ? 'text-slate-300' : 'text-slate-400'
              }`}>
                All Consumers
              </div>
            </div>
          </div>
          <span
            className={`ml-1 px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
              activeTab === 'VIEW_LIST' ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {tasks.length}
          </span>
        </button>
      </div>
      )}

      {/* ADMIN SMS-STYLE RE-ISSUE REQUEST NOTIFICATION BANNER */}
      {isAdmin && pendingReissueTasks.length > 0 && (
        <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-purple-950 border-2 border-purple-400/70 rounded-2xl p-4 shadow-lg text-white space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500 text-white flex items-center justify-center shadow-sm shrink-0 animate-bounce">
                <MessageSquareWarning className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-black tracking-wide uppercase text-purple-200">
                    {lang === 'bn'
                      ? `নতুন Re-issue SMS রিকোয়েস্ট (${pendingReissueTasks.length})`
                      : `Incoming Worker Re-issue SMS (${pendingReissueTasks.length})`}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/30 border border-purple-400/40 text-[10px] font-black text-purple-200">
                    SMS ALERT
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  {lang === 'bn'
                    ? 'কর্মী পুনরায় স্ট্যাটাস আপডেট করার জন্য Re-issue অনুমোদন চাইছেন'
                    : 'Field worker requested Re-issue permission to update consumer status again'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {pendingReissueTasks.map(reqTask => {
              const lockInfo = getReissueLockState(reqTask);
              return (
                <div
                  key={reqTask.taskId || reqTask.consumerId}
                  className="bg-slate-900/90 border border-purple-500/40 rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-amber-400">
                        {lockInfo.requestedBy}
                      </span>
                      <span className="text-[10px] text-slate-400">• {lockInfo.requestedAt}</span>
                    </div>
                    <div className="text-xs font-bold text-white truncate">
                      {reqTask.consumerName} (#{reqTask.consumerId})
                    </div>
                    <div className="text-[11px] text-purple-200 italic">
                      {lang === 'bn'
                        ? `"স্যার, এই উপভোক্তার স্ট্যাটাস (${reqTask.taskStatus}) পুনরায় আপডেট করার জন্য Re-issue করুন।"`
                        : `"Please Re-issue Consumer #${reqTask.consumerId} (Current: ${reqTask.taskStatus}) so I can update status."`}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApproveReissue(reqTask)}
                    className="px-3.5 py-2 bg-purple-500 hover:bg-purple-400 text-white font-black rounded-xl text-xs shrink-0 cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'Re-issue করুন' : 'Approve & Re-issue'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error Alert if any */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-3 text-xs font-bold flex items-center justify-between shadow-xs">
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
                onSelectPhaseFilter={ph => setPhaseFilter(ph)}
                onSelectClassFilter={cls => setClassFilter(cls)}
                onUpdateStatus={handleOpenUpdateModal}
                onRequestReissue={handleRequestReissue}
                onApproveReissue={isAdmin ? handleApproveReissue : undefined}
                onDeleteTask={isAdmin ? handleDeleteTask : undefined}
                isAdmin={isAdmin}
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
          {(activeTab === 'VIEW_LIST' || !isAdmin) && (
            <div className="space-y-4" id="disconnection-view-list-container">
              {/* INTERACTIVE COLLAPSIBLE PERFORMANCE DASHBOARD OPTION (ADMIN ONLY) */}
              {isAdmin && (
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
                        onSelectStatusFilter={status => {
                          setStatusFilter(status);
                          setIsDashboardExpanded(false);
                        }}
                        onSelectWorkerFilter={worker => {
                          setAgencyFilter(worker);
                          setIsDashboardExpanded(false);
                        }}
                        onSelectPhaseFilter={ph => setPhaseFilter(ph)}
                        onSelectClassFilter={cls => setClassFilter(cls)}
                        onUpdateStatus={handleOpenUpdateModal}
                        onRequestReissue={handleRequestReissue}
                        onApproveReissue={isAdmin ? handleApproveReissue : undefined}
                        onDeleteTask={isAdmin ? handleDeleteTask : undefined}
                        isAdmin={isAdmin}
                        lang={lang}
                      />
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* Search & Three-Dot Menu Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-3.5 shadow-xs w-full max-w-full box-border">
                <div className="flex items-center gap-2 w-full">
                  <div className="relative flex-1 min-w-0">
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
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>

                  {/* Three-Dot Menu Button containing Status Pills, Agency, Sort, Phase & Class */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      id="disconnection-three-dot-filter-btn"
                      onClick={() => setShowThreeDotMenu(prev => !prev)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center relative ${
                        showThreeDotMenu ||
                        statusFilter !== 'ALL' ||
                        agencyFilter !== 'ALL' ||
                        sortBy !== 'SERIAL_ASC' ||
                        phaseFilter !== 'ALL' ||
                        classFilter !== 'ALL'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                      title="Filters & Sort Options"
                    >
                      <MoreVertical className="w-4 h-4" />
                      {(statusFilter !== 'ALL' ||
                        agencyFilter !== 'ALL' ||
                        sortBy !== 'SERIAL_ASC' ||
                        phaseFilter !== 'ALL' ||
                        classFilter !== 'ALL') && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 absolute -top-0.5 -right-0.5" />
                      )}
                    </button>

                    {showThreeDotMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-40 bg-slate-900/20"
                          onClick={() => setShowThreeDotMenu(false)}
                        />
                        <div className="fixed right-3 sm:right-6 top-28 sm:top-32 w-[min(92vw,340px)] max-h-[78vh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 z-50 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                              {lang === 'bn' ? 'ফিল্টার ও সর্ট অপশন' : 'Filter & Sort Options'}
                            </span>
                            {(statusFilter !== 'ALL' ||
                              agencyFilter !== 'ALL' ||
                              sortBy !== 'SERIAL_ASC' ||
                              phaseFilter !== 'ALL' ||
                              classFilter !== 'ALL') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setStatusFilter('ALL');
                                  setAgencyFilter('ALL');
                                  setSortBy('SERIAL_ASC');
                                  setPhaseFilter('ALL');
                                  setClassFilter('ALL');
                                  setShowThreeDotMenu(false);
                                }}
                                className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                              >
                                Reset All
                              </button>
                            )}
                          </div>

                          {/* 1. STATUS FILTER PILLS */}
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                              {lang === 'bn' ? 'স্ট্যাটাস ফিল্টার (Status)' : 'Status Filter'}
                            </span>
                            <div className="grid grid-cols-2 gap-1.5 text-xs font-bold">
                              <button
                                type="button"
                                onClick={() => {
                                  setStatusFilter('ALL');
                                  setShowThreeDotMenu(false);
                                }}
                                className={`px-3 py-2 rounded-xl cursor-pointer transition-all text-left flex items-center justify-between ${
                                  statusFilter === 'ALL'
                                    ? 'bg-slate-900 text-white shadow-2xs font-black'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                <span>All</span>
                                <span>({counts.total})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setStatusFilter('URGENT');
                                  setShowThreeDotMenu(false);
                                }}
                                className={`px-3 py-2 rounded-xl cursor-pointer transition-all text-left flex items-center justify-between ${
                                  statusFilter === 'URGENT'
                                    ? 'bg-red-600 text-white shadow-2xs font-black'
                                    : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                                }`}
                              >
                                <span className="flex items-center gap-1">
                                  <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span>Urgent</span>
                                </span>
                                <span>({counts.urgent})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setStatusFilter('DISCONNECT');
                                  setShowThreeDotMenu(false);
                                }}
                                className={`px-3 py-2 rounded-xl cursor-pointer transition-all text-left flex items-center justify-between ${
                                  statusFilter === 'DISCONNECT'
                                    ? 'bg-rose-600 text-white shadow-2xs font-black'
                                    : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                                }`}
                              >
                                <span>Disconnect</span>
                                <span>({counts.disconnect})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setStatusFilter('PAID');
                                  setShowThreeDotMenu(false);
                                }}
                                className={`px-3 py-2 rounded-xl cursor-pointer transition-all text-left flex items-center justify-between ${
                                  statusFilter === 'PAID'
                                    ? 'bg-teal-600 text-white shadow-2xs font-black'
                                    : 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100'
                                }`}
                              >
                                <span>Paid</span>
                                <span>({counts.paid})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setStatusFilter('PENDING');
                                  setShowThreeDotMenu(false);
                                }}
                                className={`px-3 py-2 rounded-xl cursor-pointer transition-all text-left flex items-center justify-between ${
                                  statusFilter === 'PENDING'
                                    ? 'bg-amber-500 text-slate-950 shadow-2xs font-black'
                                    : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                                }`}
                              >
                                <span>Pending</span>
                                <span>({counts.pending})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setStatusFilter('DISPUTE');
                                  setShowThreeDotMenu(false);
                                }}
                                className={`px-3 py-2 rounded-xl cursor-pointer transition-all text-left flex items-center justify-between ${
                                  statusFilter === 'DISPUTE'
                                    ? 'bg-orange-500 text-white shadow-2xs font-black'
                                    : 'bg-orange-50 text-orange-900 border border-orange-200 hover:bg-orange-100'
                                }`}
                              >
                                <span>Dispute</span>
                                <span>({counts.dispute})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setStatusFilter('OFFICE TEAM');
                                  setShowThreeDotMenu(false);
                                }}
                                className={`px-3 py-2 rounded-xl cursor-pointer transition-all text-left flex items-center justify-between ${
                                  statusFilter === 'OFFICE TEAM'
                                    ? 'bg-indigo-600 text-white shadow-2xs font-black'
                                    : 'bg-indigo-50 text-indigo-900 border border-indigo-200 hover:bg-indigo-100'
                                }`}
                              >
                                <span>Office Team</span>
                                <span>({counts.officeTeam})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setStatusFilter('NOT FOUND');
                                  setShowThreeDotMenu(false);
                                }}
                                className={`px-3 py-2 rounded-xl cursor-pointer transition-all text-left flex items-center justify-between ${
                                  statusFilter === 'NOT FOUND'
                                    ? 'bg-slate-700 text-white shadow-2xs font-black'
                                    : 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'
                                }`}
                              >
                                <span>Not Found</span>
                                <span>({counts.notFound})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setStatusFilter('REISSUE');
                                  setShowThreeDotMenu(false);
                                }}
                                className={`col-span-2 px-3 py-2 rounded-xl cursor-pointer transition-all text-left flex items-center justify-between ${
                                  statusFilter === 'REISSUE'
                                    ? 'bg-purple-600 text-white shadow-2xs font-black'
                                    : 'bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100'
                                }`}
                              >
                                <span>Reissue</span>
                                <span>({counts.reissue})</span>
                              </button>
                            </div>
                          </div>

                          {/* 2. AGENCY / WORKER DROPDOWN */}
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">
                              {lang === 'bn' ? 'এজেন্সি / কর্মী (Agency)' : 'All Agency / Worker'}
                            </span>
                            <select
                              value={agencyFilter}
                              onChange={e => {
                                setAgencyFilter(e.target.value);
                                setShowThreeDotMenu(false);
                              }}
                              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                            >
                              <option value="ALL">{lang === 'bn' ? 'সকল এজেন্সি / কর্মী' : 'All Agencies / Workers'}</option>
                              {uniqueAgencies.map((ag, idx) => (
                                <option key={idx} value={ag}>
                                  {ag}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* 3. SERIAL NO / SORT DROPDOWN */}
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">
                              {lang === 'bn' ? 'ক্রমিক নং / সর্ট (Serial No / Sort)' : 'Serial No / Sort By'}
                            </span>
                            <select
                              value={sortBy}
                              onChange={e => {
                                setSortBy(e.target.value as any);
                                setShowThreeDotMenu(false);
                              }}
                              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                            >
                              <option value="SERIAL_ASC">{lang === 'bn' ? 'ক্রমিক নং (SL 001...)' : 'Serial No (SL 001...)'}</option>
                              <option value="URGENT_FIRST">{lang === 'bn' ? 'জরুরি অগ্রাধিকার' : 'Urgent First'}</option>
                              <option value="DUE_DESC">{lang === 'bn' ? 'বকেয়া: বেশি থেকে কম' : 'Dues: High to Low'}</option>
                              <option value="DUE_ASC">{lang === 'bn' ? 'বকেয়া: কম থেকে বেশি' : 'Dues: Low to High'}</option>
                              <option value="NAME_ASC">{lang === 'bn' ? 'নাম: A থেকে Z' : 'Name: A to Z'}</option>
                              <option value="NEWEST">{lang === 'bn' ? 'সর্বশেষ আপডেট' : 'Newest'}</option>
                            </select>
                          </div>

                          {/* 4. PHASE OPTION */}
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">
                              {lang === 'bn' ? 'ফেজ ফিল্টার (Phase)' : 'Phase Filter'}
                            </span>
                            <div className="grid grid-cols-3 gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setPhaseFilter('ALL');
                                  setShowThreeDotMenu(false);
                                }}
                                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold cursor-pointer ${
                                  phaseFilter === 'ALL'
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                All
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPhaseFilter('1PH');
                                  setShowThreeDotMenu(false);
                                }}
                                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold cursor-pointer ${
                                  phaseFilter === '1PH'
                                    ? 'bg-sky-600 text-white'
                                    : 'bg-sky-50 text-sky-800 hover:bg-sky-100'
                                }`}
                              >
                                1 PH ({counts.phase1})
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPhaseFilter('3PH');
                                  setShowThreeDotMenu(false);
                                }}
                                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold cursor-pointer ${
                                  phaseFilter === '3PH'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
                                }`}
                              >
                                3 PH ({counts.phase3})
                              </button>
                            </div>
                          </div>

                          {/* 5. CLASS OPTION */}
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">
                              {lang === 'bn' ? 'ক্লাস ফিল্টার (Class)' : 'Class Filter'}
                            </span>
                            <div className="grid grid-cols-2 gap-1.5">
                              {(['ALL', 'DOMESTIC', 'COMMERCIAL', 'INDUSTRIAL', 'STW'] as ConnectionClassFilterType[]).map(cls => (
                                <button
                                  key={cls}
                                  type="button"
                                  onClick={() => {
                                    setClassFilter(cls);
                                    setShowThreeDotMenu(false);
                                  }}
                                  className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold text-left cursor-pointer ${
                                    classFilter === cls
                                      ? 'bg-slate-900 text-white'
                                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  }`}
                                >
                                  {cls === 'ALL' ? 'All Class' : cls}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
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
                  {(searchQuery || statusFilter !== 'ALL' || phaseFilter !== 'ALL' || classFilter !== 'ALL' || agencyFilter !== 'ALL') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('ALL');
                        setPhaseFilter('ALL');
                        setClassFilter('ALL');
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
                      onRequestReissue={handleRequestReissue}
                      onApproveReissue={isAdmin ? handleApproveReissue : undefined}
                      isAdmin={isAdmin}
                      onDeleteTask={isAdmin ? handleDeleteTask : undefined}
                      lang={lang}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>

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
