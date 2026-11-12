import React, { useState, useEffect, useRef, useMemo } from 'react';
import appLogo from './assets/images/power_round_logo_1787860440979.jpg';
import { Header } from './components/Header';
import { CategorySelector } from './components/CategorySelector';
import { PerformanceDashboard } from './components/PerformanceDashboard';
import { EntryForm } from './components/EntryForm';
import { AdminDashboard } from './components/AdminDashboard';
import { WorkerRecentSubmissions } from './components/WorkerRecentSubmissions';
import { CornerOptionsModal } from './components/CornerOptionsModal';
import { LoginScreen } from './components/LoginScreen';
import { InstallAppModal } from './components/InstallAppModal';
import { LanguageModal } from './components/LanguageModal';
import { HelpSupportModal } from './components/HelpSupportModal';
import { DisconnectionTaskManagement } from './components/DisconnectionTaskManagement';
import { LiveOutstandingModal } from './components/disconnection/LiveOutstandingModal';
import { TransmissionPylonSvg } from './components/TransmissionPylonSvg';
import { CategoryType, PowerEntry, ActiveTab, CornerOptionKey, UserSession, WorkOrderNotice, SyncMode, DisconnectionTask, ThemeMode } from './types';
import {
  fetchEntries,
  fetchStats,
  fetchWorkOrders,
  logoutUser,
  fetchDisconnectionTasks,
  getCachedEntriesSync,
  getCachedDisconnectionTasksSync,
  getCachedWorkOrdersSync
} from './services/api';
import { Language, translations } from './utils/translations';
import { WorkOrderNoticeSection } from './components/WorkOrderNoticeSection';
import { formatDateTime12Hour, formatTime12Hour, getNowDateDDMMYYYY } from './utils/dateTimeFormat';
import { filterDisconnectionTasksForUser, filterEntriesForUser, isAgencyUserSession } from './utils/disconnectionClassifier';
import { 
  Zap, 
  ShieldCheck, 
  Clock, 
  Layers, 
  Sparkles, 
  RefreshCw, 
  X, 
  Printer, 
  LayoutDashboard, 
  CheckCircle2, 
  ChevronRight,
  ChevronDown,
  Radio,
  FileSpreadsheet,
  AlertTriangle,
  UserCheck,
  Home,
  PowerOff,
  ArrowLeft,
  Plus,
  LogOut,
  Download,
  Smartphone,
  Globe,
  BarChart3,
  TrendingUp,
  HelpCircle,
  WifiOff,
  Settings,
  Scissors,
  Sun,
  Moon
} from 'lucide-react';

/**
 * Formats Date as 12-hour hh:mm:ss AM/PM for Last synced indicator
 */
function formatTimeHHMMSS(date: Date | null): string {
  return formatTime12Hour(date || new Date(), true);
}

/**
 * Computes a fast signature from serialized JSON data.
 * Used for change-tracking in loadData to verify if server data has actually updated
 * before triggering a React state update, preventing unnecessary component re-renders and UI lag.
 */
function computeJsonChangeHash(data: unknown): string {
  if (!Array.isArray(data)) return '0_empty';
  if (data.length === 0) return '0_empty';
  let sig = `${data.length}`;
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (item) {
      const agencyVal = item['Agency'] || item.Agency || item.agency || item.assignedAgency || item.agencyName || '';
      sig += `|${item.id || item.consumerId || item['Consumer Id'] || ''}:${item.status || ''}:${item.disconStatus || item.taskStatus || ''}:${item.notes || item.workerRemarks || ''}:${agencyVal}:${item.assignedWorkerName || ''}:${item.photoUrl || item['Image'] || ''}:${item.reissueRequested ? '1' : '0'}:${item.reissueApproved ? '1' : '0'}:${item.reissueRejected ? '1' : '0'}:${item.updatedAt || item.date || ''}`;
    }
  }
  return sig;
}

export default function App() {
  const [currentLanguage, setCurrentLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('power_app_lang') as Language;
    if (saved && (saved === 'en' || saved === 'bn' || saved === 'hi' || saved === 'ur')) {
      return saved;
    }
    return 'en'; // Primary / Default Language is English
  });
  const [showLanguageModal, setShowLanguageModal] = useState<boolean>(false);

  const t = translations[currentLanguage] || translations.en;

  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('power_user_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.idNo) return parsed;
      } catch (e) {
        // ignore
      }
    }
    return null;
  });

  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    const saved = localStorage.getItem('power_user_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.role === 'worker' || parsed?.role === 'agency') return false;
        return parsed?.role === 'admin' || parsed?.idNo === '8695716192' || parsed?.idNo === 'controller' || parsed?.idNo === 'administration';
      } catch (e) {}
    }
    return false;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const saved = localStorage.getItem('power_user_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const isAdm =
          parsed?.role !== 'worker' &&
          parsed?.role !== 'agency' &&
          (parsed?.role === 'admin' || parsed?.idNo === '8695716192' || parsed?.idNo === 'controller' || parsed?.idNo === 'administration');
        if (isAdm) return 'admin';
        const isAg =
          parsed?.role === 'agency' ||
          String(parsed?.role || '').toLowerCase().includes('agency') ||
          /^(agn|agency)[-_0-9]/i.test(parsed?.idNo || '') ||
          /agency|এজেন্সি/i.test(parsed?.designation || '') ||
          Boolean((parsed as any)?.agencyName) ||
          /enterprise|agency|associates|traders|construction/i.test(parsed?.name || '');
        if (isAg) return 'disconnection';
        return 'entry';
      } catch (e) {}
    }
    return 'entry';
  });
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>(() => {
    const saved = localStorage.getItem('power_user_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const isAg =
          parsed?.role === 'agency' ||
          String(parsed?.role || '').toLowerCase().includes('agency') ||
          /^(agn|agency)[-_0-9]/i.test(parsed?.idNo || '') ||
          /agency|এজেন্সি/i.test(parsed?.designation || '') ||
          Boolean((parsed as any)?.agencyName) ||
          /enterprise|agency|associates|traders|construction/i.test(parsed?.name || '');
        if (isAg) return 'DISCONNECTION';
      } catch {}
    }
    return 'NSC';
  });
  const [activeFormCategory, setActiveFormCategory] = useState<CategoryType | null>(() => {
    const saved = localStorage.getItem('power_user_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const isAg =
          parsed?.role === 'agency' ||
          String(parsed?.role || '').toLowerCase().includes('agency') ||
          /^(agn|agency)[-_0-9]/i.test(parsed?.idNo || '') ||
          /agency|এজেন্সি/i.test(parsed?.designation || '') ||
          Boolean((parsed as any)?.agencyName) ||
          /enterprise|agency|associates|traders|construction/i.test(parsed?.name || '');
        if (isAg) return 'DISCONNECTION';
      } catch {}
    }
    return null;
  });
  const [selectedWorkOrderForEntry, setSelectedWorkOrderForEntry] = useState<WorkOrderNotice | null>(null);
  const [entries, setEntries] = useState<PowerEntry[]>(() => getCachedEntriesSync());
  const [disconnectionTasks, setDisconnectionTasks] = useState<DisconnectionTask[]>(() => getCachedDisconnectionTasksSync());
  const [workOrders, setWorkOrders] = useState<WorkOrderNotice[]>(() => getCachedWorkOrdersSync());
  const [loading, setLoading] = useState<boolean>(false);
  const lastDataHashRef = useRef<string>('');
  const [workerName, setWorkerName] = useState<string>(() => {
    return localStorage.getItem('power_worker_name') || '';
  });
  const [cornerModalOption, setCornerModalOption] = useState<CornerOptionKey>(null);
  const [previewEntry, setPreviewEntry] = useState<PowerEntry | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showGlobalLiveOsdModal, setShowGlobalLiveOsdModal] = useState<boolean>(false);
  const [liveOsdConsumerId, setLiveOsdConsumerId] = useState<string>('');
  const [isHomeDashboardExpanded, setIsHomeDashboardExpanded] = useState<boolean>(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('power_theme_mode');
      if (saved === 'night' || saved === 'day') return saved;
    } catch {}
    return 'day';
  });

  const handleToggleTheme = () => {
    setTheme(prev => {
      const next: ThemeMode = prev === 'day' ? 'night' : 'day';
      try {
        localStorage.setItem('power_theme_mode', next);
      } catch {}
      if (next === 'night') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  useEffect(() => {
    if (theme === 'night') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleSelectLanguage = (lang: Language) => {
    setCurrentLanguage(lang);
    localStorage.setItem('power_app_lang', lang);
  };

  // Capture Android/PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handlePromptInstall = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    }
  };

  // Purge any legacy local user storage on mount & listen for global app events
  useEffect(() => {
    try {
      localStorage.removeItem('power_registered_users');
    } catch {}

    const handleOpenLiveOsdEvent = (e: any) => {
      const consumerId = e?.detail?.consumerId || e?.detail || '';
      setLiveOsdConsumerId(typeof consumerId === 'string' ? consumerId : '');
      setShowGlobalLiveOsdModal(true);
    };

    const handleOpenCornerOptionEvent = (e: any) => {
      const option = e?.detail;
      if (option) {
        setCornerModalOption(option);
      }
    };

    const handleOpenSettingsEvent = () => {
      setCornerModalOption('app_settings');
    };

    window.addEventListener('power-open-live-osd', handleOpenLiveOsdEvent);
    window.addEventListener('power-open-corner-option', handleOpenCornerOptionEvent);
    window.addEventListener('power-open-settings', handleOpenSettingsEvent);

    return () => {
      window.removeEventListener('power-open-live-osd', handleOpenLiveOsdEvent);
      window.removeEventListener('power-open-corner-option', handleOpenCornerOptionEvent);
      window.removeEventListener('power-open-settings', handleOpenSettingsEvent);
    };
  }, []);

  const inFlightRef = useRef(false);
  const lastOrdersHashRef = useRef<string>('');
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const recentDiscUpdatesRef = useRef<Map<string, { task: DisconnectionTask; timestamp: number }>>(new Map());
  const [syncMode, setSyncMode] = useState<SyncMode>('auto');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [forceRefreshState, setForceRefreshState] = useState<'idle' | 'refreshing' | 'completed' | 'failed'>('idle');
  const [disconnectionInitialTab, setDisconnectionInitialTab] = useState<'DASHBOARD' | 'UPLOAD' | 'REPORT' | 'VIEW_LIST'>('VIEW_LIST');

  // Keep App-level disconnectionTasks synced immediately whenever DisconnectionTaskManagement updates a consumer
  useEffect(() => {
    const normKey = (t: any) =>
      String(t?.consumerId || t?.['Consumer Id'] || t?.taskId || '')
        .replace(/^(PWR-DIS-|TASK-DISC-|SUB-DISC-|PWR-)/i, '')
        .replace(/\.0+$/, '')
        .replace(/[, \-_]/g, '')
        .trim()
        .toLowerCase();

    const onTaskUpdated = (e: Event) => {
      const updated = (e as CustomEvent<DisconnectionTask>)?.detail;
      if (!updated) return;
      const k = normKey(updated);
      if (k) {
        recentDiscUpdatesRef.current.set(k, { task: updated, timestamp: Date.now() });
      }
      setDisconnectionTasks((prev) => {
        const next = prev.map((t) => {
          const tk = normKey(t);
          const match = (k && tk === k) || (t.taskId && updated.taskId && t.taskId === updated.taskId);
          return match ? { ...t, ...updated } : t;
        });
        lastDataHashRef.current = `${computeJsonChangeHash(entries)}_disc:${computeJsonChangeHash(next)}`;
        return next;
      });
    };

    window.addEventListener('power-disconnection-task-updated', onTaskUpdated);
    return () => window.removeEventListener('power-disconnection-task-updated', onTaskUpdated);
  }, [entries]);

  const loadData = async (silent: boolean | unknown = false, forceRefresh = false, throwOnError = false) => {
    if (!currentUser) return;
    if (inFlightRef.current && !forceRefresh) return;
    inFlightRef.current = true;
    setIsSyncing(true);
    const isSilent = typeof silent === 'boolean' ? silent : false;
    try {
      if (!isSilent && entries.length === 0 && disconnectionTasks.length === 0) setLoading(true);

      const [data, orders, discRes] = await Promise.all([
        fetchEntries({ refresh: forceRefresh }),
        fetchWorkOrders(),
        fetchDisconnectionTasks({
          role: currentUser?.role,
          workerId: currentUser?.idNo,
          workerName: currentUser?.name,
          refresh: forceRefresh
        })
      ]);
      const rawEntries = (Array.isArray(data) ? data : []).filter((e) => {
        const catUp = String(e?.category || '').toUpperCase().trim();
        const idUp = String(e?.id || '').toUpperCase().trim();
        return catUp !== 'DISCONNECTION' && !idUp.startsWith('TASK-DISC-') && !idUp.startsWith('PWR-DIS-');
      });
      const rawValidDiscTasks: DisconnectionTask[] = Array.isArray(discRes)
        ? discRes
        : Array.isArray((discRes as any)?.tasks)
          ? (discRes as any).tasks
          : [];

      const validDiscTasks: DisconnectionTask[] = rawValidDiscTasks.map((t) => {
        const k = String(t?.consumerId || (t as any)?.['Consumer Id'] || t?.taskId || '')
          .replace(/^(PWR-DIS-|TASK-DISC-|SUB-DISC-|PWR-)/i, '')
          .replace(/\.0+$/, '')
          .replace(/[, \-_]/g, '')
          .trim()
          .toLowerCase();
        const rec = k ? recentDiscUpdatesRef.current.get(k) : undefined;
        if (rec && Date.now() - rec.timestamp < 60000) {
          const inSt = String(t.taskStatus || t.disconStatus || 'PENDING').trim().toUpperCase();
          const locSt = String(rec.task.taskStatus || rec.task.disconStatus || 'PENDING').trim().toUpperCase();
          const inRem = String(t.workerRemarks || t.notes || '').trim();
          const locRem = String(rec.task.workerRemarks || rec.task.notes || '').trim();
          if (inSt !== locSt || inRem !== locRem) {
            return {
              ...t,
              taskStatus: rec.task.taskStatus,
              disconStatus: rec.task.disconStatus,
              'Discon Status': rec.task['Discon Status'],
              workerRemarks: rec.task.workerRemarks,
              workerReport: rec.task.workerReport,
              notes: rec.task.notes,
              Notes: rec.task.Notes,
              updatedAt: rec.task.updatedAt || t.updatedAt,
              statusHistory: rec.task.statusHistory || t.statusHistory
            };
          }
        }
        return t;
      });

      const newHash = `${computeJsonChangeHash(rawEntries)}_disc:${computeJsonChangeHash(validDiscTasks)}`;

      if (forceRefresh || newHash !== lastDataHashRef.current || (disconnectionTasks.length === 0 && validDiscTasks.length > 0)) {
        lastDataHashRef.current = newHash;
        setDisconnectionTasks(validDiscTasks);
        setEntries(rawEntries);
      }
      if (Array.isArray(orders)) {
        const ordersHash = computeJsonChangeHash(orders);
        if (forceRefresh || ordersHash !== lastOrdersHashRef.current) {
          lastOrdersHashRef.current = ordersHash;
          setWorkOrders(orders);
        }
      }
      setLastSyncedAt(new Date());
      if (throwOnError) {
        setForceRefreshState('completed');
      }
    } catch (err) {
      console.warn('Power entries sync notice:', err);
      if (throwOnError) {
        setForceRefreshState('failed');
      }
    } finally {
      inFlightRef.current = false;
      setIsSyncing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      setEntries([]);
      setDisconnectionTasks([]);
      setWorkOrders([]);
      return;
    }

    try {
      localStorage.setItem('power_sync_mode', 'auto');
    } catch {}

    lastDataHashRef.current = '';
    lastOrdersHashRef.current = '';
    setEntries(getCachedEntriesSync());
    setDisconnectionTasks(getCachedDisconnectionTasksSync());
    setWorkOrders(getCachedWorkOrdersSync());
    loadData(true, false);

    // Single active 10-second background timer per authenticated app session (POWER APP & SHEETS REFRESH)
    const interval = setInterval(() => {
      if (!document.hidden && !inFlightRef.current) {
        loadData(true, true);
      }
    }, 10000);

    const onFocus = () => {
      if (!inFlightRef.current) loadData(true, true);
    };
    const onVisibilityChange = () => {
      if (!document.hidden && !inFlightRef.current) loadData(true, true);
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [currentUser?.idNo, currentUser?.name, currentUser?.role]);

  const handleToggleSyncMode = (_mode: SyncMode) => {
    setSyncMode('auto');
    try {
      localStorage.setItem('power_sync_mode', 'auto');
    } catch {}
    if (!inFlightRef.current) {
      loadData(true);
    }
  };

  // Option 1 (Main Module): POWER APP & SHEETS REFRESH
  const handlePowerAppSheetsRefresh = () => {
    inFlightRef.current = false;
    lastDataHashRef.current = '';
    lastOrdersHashRef.current = '';
    try {
      window.dispatchEvent(new CustomEvent('power-app-sheets-refresh'));
    } catch {}
    loadData(true, true);
  };

  // Option 2 (App Settings): FORCE SYSTEM REFRESH (Manual emergency/full recovery refresh)
  const handleForceSystemRefresh = async () => {
    if (forceRefreshState === 'refreshing' || inFlightRef.current) return;
    setForceRefreshState('refreshing');
    try {
      // 1. Safely invalidate stale app-side cached data while preserving login/session
      try {
        localStorage.removeItem('power_entries_local_cache_v1');
        localStorage.removeItem('power_app_entries_cache');
        localStorage.removeItem('power_disconnection_tasks_cache');
        localStorage.removeItem('power_disconnection_tasks_cache_v2');
        localStorage.removeItem('power_disconnection_client_overlay_v1');
        localStorage.removeItem('power_work_orders_local_v1');
      } catch {}
      lastDataHashRef.current = '';
      lastOrdersHashRef.current = '';
      try {
        window.dispatchEvent(new CustomEvent('power-app-sheets-refresh'));
      } catch {}

      // 2-5. Request fresh production data from backend Google Sheets & rebuild state
      await loadData(true, true, true);
    } catch (err) {
      console.warn('Force system refresh notice:', err);
      setForceRefreshState('failed');
    }
  };

  // Strict role sync: Workers NEVER have Admin privileges
  useEffect(() => {
    const isUserAdmin = Boolean(
      currentUser && 
      currentUser.role !== 'worker' && 
      currentUser.role !== 'agency' && 
      (currentUser.role === 'admin' || currentUser.idNo === '8695716192' || currentUser.idNo === 'controller' || currentUser.idNo === 'administration')
    );
    setIsAdmin(isUserAdmin);
    if (isUserAdmin) {
      localStorage.setItem('power_is_admin', 'true');
    } else {
      localStorage.removeItem('power_is_admin');
      if (activeTab === 'admin') {
        const isAgency =
          currentUser?.role === 'agency' ||
          String(currentUser?.role || '').toLowerCase().includes('agency') ||
          /^(agn|agency)[-_0-9]/i.test(currentUser?.idNo || '') ||
          /agency|এজেন্সি/i.test(currentUser?.designation || '') ||
          Boolean((currentUser as any)?.agencyName) ||
          /enterprise|agency|associates|traders|construction/i.test(currentUser?.name || '');
        setActiveTab(isAgency ? 'disconnection' : 'entry');
      }
    }
  }, [currentUser, activeTab]);

  const handleEntrySuccess = (newEntry: PowerEntry) => {
    setEntries((prev) => {
      const updated = [
        newEntry,
        ...prev.filter(e => e.id !== newEntry.id && (!newEntry.submissionId || e.submissionId !== newEntry.submissionId))
      ];
      lastDataHashRef.current = `${computeJsonChangeHash(updated)}_disc:${disconnectionTasks.length}`;
      return updated;
    });
    setActiveFormCategory(null);
    setTimeout(() => {
      loadData(true, true);
    }, 800);
  };

  const handleAdminLogin = (pin?: string): boolean => {
    if (pin && pin.trim() !== '6293') {
      return false;
    }
    setIsAdmin(true);
    localStorage.setItem('power_is_admin', 'true');
    setActiveTab('admin');
    return true;
  };

  // Enforce access control: If user is not admin, never allow staying in the admin panel
  useEffect(() => {
    if (!isAdmin && activeTab === 'admin') {
      const isAgency =
        currentUser?.role === 'agency' ||
        String(currentUser?.role || '').toLowerCase().includes('agency') ||
        /^(agn|agency)[-_0-9]/i.test(currentUser?.idNo || '') ||
        /agency|এজেন্সি/i.test(currentUser?.designation || '') ||
        Boolean((currentUser as any)?.agencyName) ||
        /enterprise|agency|associates|traders|construction/i.test(currentUser?.name || '');
      setActiveTab(isAgency ? 'disconnection' : 'entry');
    }
  }, [isAdmin, activeTab, currentUser]);

  const handleAdminLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('power_is_admin');
    setActiveTab('entry');
  };

  const handleUserLoginSuccess = (session: UserSession) => {
    localStorage.setItem('power_user_session', JSON.stringify(session));
    localStorage.setItem('power_worker_name', session.name);

    const isUserAdmin = Boolean(
      session.role !== 'worker' && 
      session.role !== 'agency' && 
      (session.role === 'admin' || session.idNo === '8695716192' || session.idNo === 'controller' || session.idNo === 'administration')
    );
    const isAgency = Boolean(
      !isUserAdmin &&
      (session.role === 'agency' ||
        String(session.role || '').toLowerCase().includes('agency') ||
        /^(agn|agency)[-_0-9]/i.test(session.idNo || '') ||
        /agency|এজেন্সি/i.test(session.designation || '') ||
        Boolean(session.agencyName) ||
        /enterprise|agency|associates|traders|construction/i.test(session.name || '') ||
        isAgencyUserSession(session, getCachedDisconnectionTasksSync()))
    );

    setIsAdmin(isUserAdmin);
    if (isUserAdmin) {
      localStorage.setItem('power_is_admin', 'true');
      setActiveTab('admin');
    } else if (isAgency) {
      localStorage.removeItem('power_is_admin');
      setActiveTab('disconnection');
      setActiveFormCategory('DISCONNECTION');
      setSelectedCategory('DISCONNECTION');
    } else {
      localStorage.removeItem('power_is_admin');
      setActiveTab('entry');
    }

    setWorkerName(session.name);
    setCurrentUser(session);
  };

  const handleUserLogout = () => {
    logoutUser().catch(() => {});
    localStorage.removeItem('power_user_session');
    localStorage.removeItem('power_is_admin');
    localStorage.removeItem('power_worker_name');
    setCurrentUser(null);
    setIsAdmin(false);
    setWorkerName('');
    setActiveTab('entry');
    setEntries([]);
    setDisconnectionTasks([]);
    setWorkOrders([]);
    lastDataHashRef.current = '';
    lastOrdersHashRef.current = '';
  };

  const handleExportCsv = () => {
    if (entries.length === 0) {
      alert('এক্সপোর্ট করার মতো কোনো ডাটা নেই');
      return;
    }

    const headers = [
      'ID', 'Date', 'Category', 'Worker Name', 'Feeder', 'Substation', 'Status',
      'Consumer Name', 'Consumer ID', 'Mobile', 'Address', 'Pole No', 'Applied Load',
      'Phase', 'Meter No', 'Initial Reading', 'Final Reading', 'Seal No',
      'Arrear Amount', 'Reason', 'Issue Type', 'Priority', 'Action Taken',
      'Material Used', 'Old Meter No', 'New Meter No', 'DTR Name', 'Existing Capacity',
      'New Capacity', 'Notes', 'GPS Coordinates'
    ];

    const rows = entries.map(e => [
      e.id,
      `"${formatDateTime12Hour(e.date)}"`,
      `"${e.category}"`,
      `"${e.workerName || ''}"`,
      `"${e.feederName || ''}"`,
      `"${e.substation || ''}"`,
      `"${e.status}"`,
      `"${e.consumerName || ''}"`,
      `"${e.consumerId || ''}"`,
      `"${e.mobile || ''}"`,
      `"${e.address || ''}"`,
      `"${e.poleNo || ''}"`,
      `"${e.appliedLoad || ''}"`,
      `"${e.phase || ''}"`,
      `"${e.meterNo || ''}"`,
      `"${e.initialReading || ''}"`,
      `"${e.finalReading || ''}"`,
      `"${e.sealNo || ''}"`,
      `"${e.arrearAmount || ''}"`,
      `"${e.reason || ''}"`,
      `"${e.issueType || ''}"`,
      `"${e.priority || ''}"`,
      `"${e.actionTaken || ''}"`,
      `"${e.materialUsed || ''}"`,
      `"${e.oldMeterNo || ''}"`,
      `"${e.newMeterNo || ''}"`,
      `"${e.dtrName || ''}"`,
      `"${e.existingCapacity || ''}"`,
      `"${e.newCapacity || ''}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
      `"${e.locationGps || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `POWER_FIELD_EXPORT_${getNowDateDDMMYYYY()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const navToCategory = (cat: CategoryType) => {
    if (cat === 'DISCONNECTION') {
      setActiveTab('disconnection');
      setActiveFormCategory('DISCONNECTION');
      setSelectedCategory('DISCONNECTION');
      setSidebarOpen(false);
      return;
    }
    setSelectedCategory(cat);
    setActiveFormCategory(cat);
    setActiveTab('entry');
    setSidebarOpen(false);
  };

  const isAgencyUser = useMemo(() => {
    if (isAdmin) return false;
    return isAgencyUserSession(currentUser, disconnectionTasks);
  }, [isAdmin, currentUser, disconnectionTasks]);

  const userVisibleDisconnectionTasks = isAdmin
    ? disconnectionTasks
    : filterDisconnectionTasksForUser(disconnectionTasks, currentUser);

  const userVisibleEntries = isAdmin
    ? entries
    : filterEntriesForUser(entries, currentUser);

  // Helper count badges (strictly 1-to-1 per backend Google Sheet tab, scoped for Agency accounts)
  const categoryCounts: Record<CategoryType, number> = {
    'NSC': userVisibleEntries.filter(e => e.category === 'NSC').length,
    'DISCONNECTION': userVisibleDisconnectionTasks.length,
    'POLE CASE': userVisibleEntries.filter(e => e.category === 'POLE CASE').length,
    'METER REPLESMENT': userVisibleEntries.filter(e => e.category === 'METER REPLESMENT').length,
    'DTR REPLESMENT': userVisibleEntries.filter(e => e.category === 'DTR REPLESMENT').length,
  };

  // Ensure top of Home Screen & content viewport is always visible on mount or navigation
  useEffect(() => {
    const resetTop = () => {
      if (mainScrollRef.current) {
        mainScrollRef.current.scrollTop = 0;
      }
      try {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      } catch {
        // ignore
      }
    };
    resetTop();
    const t1 = setTimeout(resetTop, 80);
    const t2 = setTimeout(resetTop, 250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [activeTab, activeFormCategory, currentUser]);

  // If user is not logged in with ID & Password, display LoginScreen
  if (!currentUser) {
    return (
      <LoginScreen 
        onLoginSuccess={handleUserLoginSuccess}
        lang={currentLanguage}
        onOpenLanguageModal={() => setShowLanguageModal(true)}
      />
    );
  }

  return (
    <div className={`flex min-h-screen w-full select-none font-sans antialiased ${
      theme === 'night' ? 'bg-[#060a17] text-slate-100 dark' : 'bg-slate-100 text-slate-900'
    }`}>
      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-xs md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* LEFT NAVIGATION SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-200 ease-in-out md:static md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${theme === 'night' ? 'bg-[#0b1226] border-r border-slate-800 text-slate-100 shadow-2xl md:shadow-none' : 'bg-white border-r border-slate-200 text-slate-800 shadow-sm md:shadow-none'}
      `}>
        {/* Brand Header with Round Logo */}
        <div className={`p-4 border-b flex items-center justify-between ${
          theme === 'night' ? 'border-slate-800 bg-[#0a1022]' : 'border-slate-200 bg-slate-50/70'
        }`}>
          <div className="flex items-center gap-3">
            <img 
              src={appLogo} 
              alt="Power of Construction Logo" 
              className={`w-10 h-10 rounded-full object-cover shadow-sm border-2 border-amber-400 p-0.5 bg-white shrink-0 ring-2 ${
                theme === 'night' ? 'ring-slate-800' : 'ring-amber-200'
              }`}
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`font-extrabold text-sm tracking-wide ${theme === 'night' ? 'text-white' : 'text-slate-900'}`}>{t.appName}</span>
                <span className="text-[10px] font-bold bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded">WBSEDCL</span>
              </div>
              <p className={`text-[10px] leading-tight ${theme === 'night' ? 'text-slate-400' : 'text-slate-500'}`}>Field Utility Standard</p>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className={`md:hidden p-1.5 rounded-lg cursor-pointer ${
              theme === 'night' ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>



        {/* Navigation Sections */}
        <div className="px-4 py-3">
          <p className={`px-3 text-[11px] font-black uppercase tracking-wider ${theme === 'night' ? 'text-slate-400' : 'text-slate-900'}`}>{t.mainModules}</p>
        </div>
        <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto">
          <button
            onClick={() => { setActiveTab('entry'); setSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'entry'
                ? theme === 'night' ? 'bg-slate-800 text-white shadow-xs font-bold' : 'bg-slate-900 text-white shadow-xs font-bold'
                : theme === 'night' ? 'text-slate-300 hover:text-white hover:bg-slate-800/50' : 'text-slate-900 font-bold hover:bg-slate-100 hover:text-black border border-slate-200/60 bg-slate-50/70'
            }`}
          >
            <div className="flex items-center gap-3">
              <Home className={`w-4 h-4 ${theme === 'night' ? 'text-amber-400' : 'text-amber-600'}`} />
              <span className={theme === 'night' ? 'text-white' : 'text-slate-900 font-black'}>{t.dataEntry}</span>
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              theme === 'night' ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-900 border border-amber-300'
            }`}>Home</span>
          </button>

          <button
            onClick={() => { setActiveTab('my-submissions'); setSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'my-submissions'
                ? theme === 'night' ? 'bg-slate-800 text-white shadow-xs font-bold' : 'bg-sky-600 text-white shadow-xs font-bold'
                : theme === 'night' ? 'text-slate-300 hover:text-white hover:bg-slate-800/50' : 'text-slate-900 font-bold hover:bg-sky-50 hover:text-sky-900 border border-slate-200/60 bg-slate-50/70'
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock className={`w-4 h-4 ${theme === 'night' ? 'text-sky-400' : 'text-sky-600'}`} />
              <span className={theme === 'night' ? 'text-white' : 'text-slate-900 font-black'}>{t.mySubmissions}</span>
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              theme === 'night' ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-900 font-extrabold'
            }`}>{entries.length}</span>
          </button>

          <button
            id="sidebar-nav-disconnection-btn"
            onClick={() => { setActiveTab('disconnection'); setSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'disconnection'
                ? 'bg-rose-600 text-white shadow-xs font-bold'
                : theme === 'night' ? 'text-slate-300 hover:text-white hover:bg-slate-800/50' : 'text-rose-950 font-bold bg-rose-50/80 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <PowerOff className={`w-4 h-4 ${theme === 'night' ? 'text-rose-400' : 'text-rose-600'}`} />
              <span className={theme === 'night' ? 'text-white' : 'text-slate-900 font-black'}>{t.disconnectionTasks || 'ডিসকানেকশন (Disconnection)'}</span>
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              theme === 'night' ? 'bg-rose-950/80 text-rose-300' : 'bg-rose-100 text-rose-900 font-extrabold border border-rose-300'
            }`}>{disconnectionTasks.length}</span>
          </button>

          <button
            id="sidebar-nav-work-orders-btn"
            onClick={() => { setActiveTab('work-orders'); setSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'work-orders'
                ? 'bg-amber-600 text-white shadow-xs font-bold'
                : theme === 'night' ? 'text-slate-300 hover:text-white hover:bg-slate-800/50' : 'text-amber-950 font-bold bg-amber-50/80 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <FileSpreadsheet className={`w-4 h-4 ${theme === 'night' ? 'text-amber-400' : 'text-amber-600'}`} />
              <span className={theme === 'night' ? 'text-white' : 'text-slate-900 font-black'}>{t.workOrders || 'ওয়ার্ক অর্ডার ও খাতা'}</span>
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              theme === 'night' ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-900 font-extrabold border border-amber-300'
            }`}>Live</span>
          </button>

          <button
            id="sidebar-nav-performance-btn"
            onClick={() => { setActiveTab('performance'); setSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'performance'
                ? theme === 'night' ? 'bg-slate-800 text-white shadow-xs font-bold' : 'bg-blue-600 text-white shadow-xs font-bold'
                : theme === 'night' ? 'text-slate-300 hover:text-white hover:bg-slate-800/50' : 'text-blue-950 font-bold bg-blue-50/80 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <BarChart3 className={`w-4 h-4 ${theme === 'night' ? 'text-blue-400' : 'text-blue-600'}`} />
              <span className={theme === 'night' ? 'text-white' : 'text-slate-900 font-black'}>{t.performanceDashboard}</span>
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              theme === 'night' ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-900 font-extrabold border border-blue-300'
            }`}>Live</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => { setActiveTab('admin'); setSidebarOpen(false); loadData(false, true); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'admin'
                  ? theme === 'night' ? 'bg-slate-800 text-white shadow-xs font-bold' : 'bg-slate-900 text-white shadow-xs font-bold'
                  : theme === 'night' ? 'text-slate-300 hover:text-white hover:bg-slate-800/50' : 'text-slate-900 font-bold hover:bg-slate-100 border border-slate-200/60 bg-slate-50/70'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className={`w-4 h-4 ${theme === 'night' ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <span className={theme === 'night' ? 'text-white' : 'text-slate-900 font-black'}>{t.adminCenter}</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </button>
          )}

          {/* LIVE OSD & BILL CHECK OPTION IN SIDEBAR */}
          <button
            id="sidebar-nav-live-osd-btn"
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              setLiveOsdConsumerId('');
              setShowGlobalLiveOsdModal(true);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs group ${
              theme === 'night'
                ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-white border border-emerald-500/40'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300'
            }`}
            title="লাইভ OSD ও বকেয়া চেক (WBSEDCL Live Outstanding & No Dues)"
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg shrink-0 group-hover:scale-105 transition-transform ${
                theme === 'night' ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-emerald-600 text-white font-bold'
              }`}>
                <Zap className="w-4 h-4 fill-current" />
              </div>
              <div className="text-left">
                <span className={`block leading-tight font-black text-[12px] ${
                  theme === 'night' ? 'text-white' : 'text-slate-950'
                }`}>
                  {currentLanguage === 'bn' ? 'লাইভ OSD ও বকেয়া চেক' : 'Live OSD & Bill Check'}
                </span>
                <span className={`text-[10px] block leading-tight font-semibold ${
                  theme === 'night' ? 'text-emerald-300' : 'text-emerald-800'
                }`}>
                  WBSEDCL Live Portal
                </span>
              </div>
            </div>
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-2xs ${
              theme === 'night' ? 'bg-emerald-500 text-slate-950' : 'bg-emerald-600 text-white'
            }`}>
              Live
            </span>
          </button>

          {/* DAY / NIGHT MODE SWITCHER OPTION INSIDE MAIN MODULES */}
          <button
            id="sidebar-nav-day-night-btn"
            type="button"
            onClick={handleToggleTheme}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs border ${
              theme === 'night'
                ? 'bg-[#121c38] hover:bg-[#18264d] text-amber-300 hover:text-amber-200 border-indigo-500/40 hover:border-amber-400/60 ring-1 ring-amber-400/20'
                : 'bg-amber-50/90 hover:bg-amber-100/90 text-amber-950 border-amber-300 hover:border-amber-400 ring-1 ring-amber-200'
            }`}
            title={
              theme === 'night'
                ? (currentLanguage === 'bn' ? 'রাত মোড সক্রিয় • দিন মোড করতে ক্লিক করুন' : 'Night Mode Active • Click for Day Mode')
                : (currentLanguage === 'bn' ? 'দিন মোড সক্রিয় • রাত মোড করতে ক্লিক করুন' : 'Day Mode Active • Click for Night Mode')
            }
          >
            <div className="flex items-center gap-2.5">
              <div className={`p-1.5 rounded-lg shrink-0 ${
                theme === 'night'
                  ? 'bg-indigo-950 text-amber-300 border border-indigo-500/40 shadow-xs'
                  : 'bg-amber-400 text-slate-950 shadow-xs'
              }`}>
                {theme === 'night' ? <Moon className="w-4 h-4 text-indigo-300" /> : <Sun className="w-4 h-4 text-slate-950 fill-amber-300" />}
              </div>
              <div className="text-left">
                <span className={`block leading-tight font-black text-[12px] ${
                  theme === 'night' ? 'text-white' : 'text-slate-950'
                }`}>
                  {currentLanguage === 'bn' ? 'দিন বা রাত (Day / Night)' : 'Day / Night Mode'}
                </span>
                <span className={`text-[10px] block leading-tight font-bold ${
                  theme === 'night' ? 'text-indigo-200' : 'text-amber-900'
                }`}>
                  {theme === 'night' 
                    ? (currentLanguage === 'bn' ? 'রাত মোড সক্রিয় (Night)' : 'Night Mode Active') 
                    : (currentLanguage === 'bn' ? 'দিন মোড সক্রিয় (Day)' : 'Day Mode Active')}
                </span>
              </div>
            </div>
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${
              theme === 'night'
                ? 'bg-indigo-900/90 text-amber-300 border-indigo-400/50 shadow-xs'
                : 'bg-amber-200 text-amber-950 border-amber-400 shadow-xs'
            }`}>
              {theme === 'night' ? '🌙 Night' : '☀️ Day'}
            </span>
          </button>

          {/* LANGUAGE OPTION INSIDE MAIN MODULES BELOW ADMIN CENTER */}
          <button
            id="sidebar-nav-language-btn"
            onClick={() => {
              setSidebarOpen(false);
              setShowLanguageModal(true);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs ${
              theme === 'night'
                ? 'text-blue-300 hover:text-white hover:bg-blue-500/10 border border-blue-500/30'
                : 'text-blue-950 bg-blue-50/90 hover:bg-blue-100 border border-blue-200 font-black'
            }`}
            title="ভাষা পরিবর্তন করুন (Change Language: Bengali, English, Hindi, Urdu)"
          >
            <div className="flex items-center gap-3">
              <Globe className={`w-4 h-4 ${theme === 'night' ? 'text-blue-400' : 'text-blue-600'}`} />
              <span className={theme === 'night' ? 'text-blue-300' : 'text-slate-950 font-black'}>{t.language}</span>
            </div>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
              theme === 'night' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'bg-blue-200 text-blue-950 border border-blue-300'
            }`}>
              {currentLanguage}
            </span>
          </button>

          {/* Install App Option inside MAIN MODULES below Language */}
          <button
            id="sidebar-nav-install-app-btn"
            onClick={() => {
              setSidebarOpen(false);
              setShowInstallModal(true);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs ${
              theme === 'night'
                ? 'text-amber-300 hover:text-white hover:bg-amber-500/10 border border-amber-500/30'
                : 'text-amber-950 bg-amber-50/90 hover:bg-amber-100 border border-amber-200 font-black'
            }`}
            title="অ্যান্ড্রয়েড ফোনে অ্যাপ ইনস্টল করুন"
          >
            <div className="flex items-center gap-3">
              <Download className={`w-4 h-4 ${theme === 'night' ? 'text-amber-400' : 'text-amber-600'}`} />
              <span className={theme === 'night' ? 'text-amber-300' : 'text-slate-950 font-black'}>{t.installApp}</span>
            </div>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
              theme === 'night' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-amber-200 text-amber-950 border-amber-300'
            }`}>
              Android
            </span>
          </button>

          {/* Help & Support Option inside MAIN MODULES (Live Chat & Email Support) */}
          <button
            id="sidebar-nav-help-support-btn"
            onClick={() => {
              setSidebarOpen(false);
              setShowHelpModal(true);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs ${
              theme === 'night'
                ? 'text-emerald-300 hover:text-white hover:bg-emerald-500/10 border border-emerald-500/30'
                : 'text-emerald-950 bg-emerald-50/90 hover:bg-emerald-100 border border-emerald-200 font-black'
            }`}
            title="হেল্প ও সাপোর্ট (Email: powerof2026@gmail.com & Admin Live Chat)"
          >
            <div className="flex items-center gap-3">
              <HelpCircle className={`w-4 h-4 ${theme === 'night' ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <span className={theme === 'night' ? 'text-emerald-300' : 'text-slate-950 font-black'}>{t.helpSupport}</span>
            </div>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
              theme === 'night' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-emerald-200 text-emerald-950 border-emerald-300'
            }`}>
              Live Chat
            </span>
          </button>

          {/* App Settings Option with Settings Icon inside MAIN MODULES */}
          <button
            id="sidebar-nav-app-settings-btn"
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              setCornerModalOption('app_settings');
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs ${
              theme === 'night'
                ? 'text-purple-300 hover:text-white hover:bg-purple-500/10 border border-purple-500/30'
                : 'text-purple-950 bg-purple-50/90 hover:bg-purple-100 border border-purple-200 font-black'
            }`}
            title="অ্যাপ সেটিংস (App Settings - Force System Refresh)"
          >
            <div className="flex items-center gap-3">
              <Settings className={`w-4 h-4 ${theme === 'night' ? 'text-purple-400' : 'text-purple-600'}`} />
              <span className={theme === 'night' ? 'text-purple-300' : 'text-slate-950 font-black'}>{currentLanguage === 'bn' ? 'অ্যাপ সেটিংস (App Settings)' : 'App Settings'}</span>
            </div>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
              theme === 'night' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-purple-200 text-purple-950 border-purple-300'
            }`}>
              Settings
            </span>
          </button>

          {/* OPTION 1 — MAIN MODULE: POWER APP & SHEETS REFRESH */}
          <button
            id="sidebar-power-app-sheets-refresh-btn"
            type="button"
            onClick={handlePowerAppSheetsRefresh}
            disabled={isSyncing}
            className={`w-full text-left rounded-lg p-2.5 space-y-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-90 ${
              theme === 'night'
                ? 'bg-slate-800/85 hover:bg-slate-800 border border-emerald-500/30 text-white'
                : 'bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-300 text-emerald-950'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                  theme === 'night' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-600 text-white'
                }`}>
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                </div>
                <span className={`text-[11px] font-black tracking-wide leading-tight ${
                  theme === 'night' ? 'text-white' : 'text-slate-950'
                }`}>
                  POWER APP & SHEETS REFRESH
                </span>
              </div>
              <span className={`w-2 h-2 rounded-full animate-pulse shrink-0 ${
                theme === 'night' ? 'bg-emerald-400' : 'bg-emerald-600'
              }`} />
            </div>

            {isSyncing ? (
              <div className={`text-[10px] font-bold pl-8 ${
                theme === 'night' ? 'text-emerald-300' : 'text-emerald-800 font-extrabold'
              }`}>
                Refreshing...
              </div>
            ) : (
              <div className={`text-[10px] pl-8 space-y-0.5 font-semibold ${
                theme === 'night' ? 'text-slate-300' : 'text-slate-800'
              }`}>
                <div className={theme === 'night' ? 'text-emerald-400 font-bold' : 'text-emerald-800 font-black'}>Auto refresh: ON</div>
                <div className={theme === 'night' ? 'text-slate-400' : 'text-slate-700 font-bold'}>Last synced: {formatTimeHHMMSS(lastSyncedAt)}</div>
              </div>
            )}
          </button>

          {/* Direct Logout Option Right Below Help & Support */}
          <button
            id="sidebar-nav-logout-btn"
            onClick={() => {
              setSidebarOpen(false);
              handleUserLogout();
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              theme === 'night'
                ? 'text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-900/30'
                : 'text-red-900 bg-red-50 hover:bg-red-100 border border-red-200 font-black'
            }`}
            title="একাউন্ট থেকে লগআউট করুন"
          >
            <div className="flex items-center gap-3">
              <LogOut className={`w-4 h-4 ${theme === 'night' ? 'text-red-400' : 'text-red-600'}`} />
              <span className={theme === 'night' ? 'text-red-300' : 'text-red-900 font-black'}>{t.logout}</span>
            </div>
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
              theme === 'night' ? 'bg-red-950 text-red-400 border-red-900/40' : 'bg-red-200 text-red-900 border-red-300 font-bold'
            }`}>Exit</span>
          </button>

          <div className="pt-4 pb-2">
            <p className={`px-3 text-[11px] font-black uppercase tracking-wider ${
              theme === 'night' ? 'text-slate-400' : 'text-slate-900 font-extrabold'
            }`}>{t.fiveCategories}</p>
          </div>

          <button
            onClick={() => navToCategory('NSC')}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeFormCategory === 'NSC' 
                ? theme === 'night' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'bg-amber-100 text-amber-950 font-black border border-amber-300'
                : theme === 'night' ? 'text-slate-400 hover:text-white hover:bg-slate-800/40' : 'text-slate-900 font-bold hover:bg-amber-50 hover:text-amber-900 bg-slate-50/60 border border-slate-200/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>1. NSC</span>
            </div>
            <span className={`text-[10px] font-extrabold ${theme === 'night' ? 'text-slate-400' : 'text-slate-700'}`}>{categoryCounts['NSC']}</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('disconnection');
              setActiveFormCategory('DISCONNECTION');
              setSelectedCategory('DISCONNECTION');
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'disconnection' || activeFormCategory === 'DISCONNECTION'
                ? theme === 'night' ? 'bg-rose-500/20 text-rose-300 font-bold ring-1 ring-rose-500/30' : 'bg-rose-100 text-rose-950 font-black border border-rose-300'
                : theme === 'night' ? 'text-slate-400 hover:text-white hover:bg-slate-800/40' : 'text-slate-900 font-bold hover:bg-rose-50 hover:text-rose-900 bg-slate-50/60 border border-slate-200/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>2. DISCONNECTION</span>
            </div>
            <span className={`text-[10px] font-extrabold ${theme === 'night' ? 'text-slate-400' : 'text-slate-700'}`}>{categoryCounts['DISCONNECTION']}</span>
          </button>

          <button
            onClick={() => navToCategory('POLE CASE')}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeFormCategory === 'POLE CASE' 
                ? theme === 'night' ? 'bg-sky-500/20 text-sky-300 font-bold' : 'bg-sky-100 text-sky-950 font-black border border-sky-300'
                : theme === 'night' ? 'text-slate-400 hover:text-white hover:bg-slate-800/40' : 'text-slate-900 font-bold hover:bg-sky-50 hover:text-sky-900 bg-slate-50/60 border border-slate-200/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-sky-500"></span>
              <span>3. POLE CASE</span>
            </div>
            <span className={`text-[10px] font-extrabold ${theme === 'night' ? 'text-slate-400' : 'text-slate-700'}`}>{categoryCounts['POLE CASE']}</span>
          </button>

          <button
            onClick={() => navToCategory('METER REPLESMENT')}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeFormCategory === 'METER REPLESMENT' 
                ? theme === 'night' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'bg-emerald-100 text-emerald-950 font-black border border-emerald-300'
                : theme === 'night' ? 'text-slate-400 hover:text-white hover:bg-slate-800/40' : 'text-slate-900 font-bold hover:bg-emerald-50 hover:text-emerald-900 bg-slate-50/60 border border-slate-200/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>4. METER REPLESMENT</span>
            </div>
            <span className={`text-[10px] font-extrabold ${theme === 'night' ? 'text-slate-400' : 'text-slate-700'}`}>{categoryCounts['METER REPLESMENT']}</span>
          </button>

          <button
            onClick={() => navToCategory('DTR REPLESMENT')}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeFormCategory === 'DTR REPLESMENT' 
                ? theme === 'night' ? 'bg-indigo-500/20 text-indigo-300 font-bold' : 'bg-indigo-100 text-indigo-950 font-black border border-indigo-300'
                : theme === 'night' ? 'text-slate-400 hover:text-white hover:bg-slate-800/40' : 'text-slate-900 font-bold hover:bg-indigo-50 hover:text-indigo-900 bg-slate-50/60 border border-slate-200/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <span>5. DTR REPLESMENT</span>
            </div>
            <span className={`text-[10px] font-extrabold ${theme === 'night' ? 'text-slate-400' : 'text-slate-700'}`}>{categoryCounts['DTR REPLESMENT']}</span>
          </button>
        </nav>

        {/* User / Admin Profile & Logout at Bottom */}
        <div className={`p-3.5 border-t ${theme === 'night' ? 'border-slate-800 bg-[#090f20]' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                currentUser.role === 'admin' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-blue-950 text-blue-400 border border-blue-800'
              }`}>
                {currentUser.role === 'admin' ? <ShieldCheck className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
              </div>
              <div className="text-xs overflow-hidden">
                <p className={`font-bold leading-tight truncate ${theme === 'night' ? 'text-white' : 'text-slate-900'}`}>{currentUser.name}</p>
                <p className={`text-[10px] truncate ${theme === 'night' ? 'text-slate-400' : 'text-slate-500'}`}>{currentUser.designation}</p>
              </div>
            </div>

            <button
              onClick={handleUserLogout}
              className={`p-2 rounded-lg transition-colors shrink-0 cursor-pointer ${
                theme === 'night' ? 'text-slate-400 hover:text-red-400 hover:bg-slate-800/80' : 'text-slate-500 hover:text-red-600 hover:bg-red-50'
              }`}
              title="লগআউট করুন (Logout)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT (Top Header + Scrollable Content) */}
      <main className={`flex-1 flex flex-col min-w-0 relative ${
        theme === 'night' ? 'bg-[#060a17]' : 'bg-slate-50'
      }`}>
        {/* Top Operations Header */}
        <Header
          isAdmin={isAdmin}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          workerName={workerName}
          setWorkerName={setWorkerName}
          currentUser={currentUser}
          onOpenCornerOption={(opt) => setCornerModalOption(opt)}
          onLogoutAdmin={handleAdminLogout}
          onLogoutUser={handleUserLogout}
          totalEntriesCount={entries.length}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          currentLanguage={currentLanguage}
          onOpenLanguageModal={() => setShowLanguageModal(true)}
          forceRefreshState={forceRefreshState}
          onForceSystemRefresh={handleForceSystemRefresh}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onOpenLiveOsdCheck={() => {
            setLiveOsdConsumerId('');
            setShowGlobalLiveOsdModal(true);
          }}
        />

        {/* Content Container */}
        <section
          ref={mainScrollRef}
          className={`flex-1 p-4 sm:p-6 lg:p-8 space-y-6 ${
          theme === 'night' ? 'bg-[#030712] text-slate-100' : 'bg-[#f8fafc] text-slate-900'
        }`}>
              {/* VIEW 1: DATA ENTRY VIEW (HOME PAGE) */}
              {activeTab === 'entry' && (
                <div className="space-y-6">
                  {/* If no form is currently opened inside, show the 5 Categories and Worker Overview */}
                  {activeFormCategory === null ? (
                    <div className="space-y-6">
                      {/* CLICKABLE PERFORMANCE DASHBOARD OPTION (ANIMATED ACCORDION TOGGLE) */}
                      <div className="space-y-4">
                        <div 
                          onClick={() => setIsHomeDashboardExpanded(!isHomeDashboardExpanded)}
                          className={`rounded-3xl p-5 sm:p-6 transition-all duration-300 cursor-pointer group relative overflow-hidden select-none ${
                            theme === 'night'
                              ? 'bg-gradient-to-r from-[#030d22] via-[#051638] to-[#020b1f] border-2 border-[#0ea5e9] text-white shadow-[0_0_25px_rgba(14,165,233,0.35)] hover:shadow-[0_0_35px_rgba(14,165,233,0.5)]'
                              : 'bg-gradient-to-br from-[#1d2f6f] via-[#142358] to-[#0d163a] text-white shadow-md hover:shadow-lg'
                          }`}
                          role="button"
                          tabIndex={0}
                          aria-expanded={isHomeDashboardExpanded}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsHomeDashboardExpanded(!isHomeDashboardExpanded); }}
                        >
                          {theme === 'night' && (
                            <TransmissionPylonSvg
                              theme={theme}
                              mode="banner"
                              className="absolute right-0 top-0 bottom-0 w-64 sm:w-84 h-full pointer-events-none select-none"
                            />
                          )}
                          
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                            {/* Left: Icon, Title, Subtitle, Live Badge */}
                            <div className="flex items-start sm:items-center gap-3.5">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                                theme === 'night'
                                  ? 'bg-gradient-to-br from-[#0284c7] to-[#1e40af] text-white shadow-[0_0_15px_rgba(14,165,233,0.6)] border border-cyan-400/30'
                                  : 'bg-blue-600/30 border border-blue-400/30 text-blue-400'
                              }`}>
                                <BarChart3 className="w-6 h-6" />
                              </div>
                              <div>
                                <h2 className="text-base sm:text-lg font-black tracking-wide text-white uppercase">
                                  <span>{t.performanceDashboard}</span>
                                </h2>
                                <div className="mt-1">
                                  <span className="bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 text-[10px] sm:text-[11px] font-black px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 shadow-2xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    LIVE METRICS
                                  </span>
                                </div>
                                <p className="text-xs text-slate-200/90 font-medium mt-1 line-clamp-1">
                                  {isHomeDashboardExpanded
                                    ? (currentLanguage === 'bn' 
                                        ? 'ক্লিক করে ড্যাশবোর্ড সংক্ষেপ বা বন্ধ করুন' 
                                        : 'Click to collapse performance dashboard')
                                    : (currentLanguage === 'bn' 
                                        ? 'ক্লিক করুন — রিয়েল-টাইম পারফরম্যান্স দেখুন...' 
                                        : 'Click to open real-time performance...')}
                                </p>
                              </div>
                            </div>

                            {/* Right: CTA Open / Close Button matching photo */}
                            <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                              <div className={`px-5 py-2.5 font-bold rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md cursor-pointer ${
                                theme === 'night'
                                  ? 'bg-gradient-to-r from-[#00d2ff] to-[#0072ff] text-white shadow-[0_0_15px_rgba(0,180,255,0.6)] hover:brightness-110'
                                  : 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md'
                              }`}>
                                <span>
                                  {isHomeDashboardExpanded
                                    ? (currentLanguage === 'bn' ? 'ড্যাশবোর্ড বন্ধ করুন' : 'Close Dashboard')
                                    : (currentLanguage === 'bn' ? 'ড্যাশবোর্ড খুলুন' : 'Open Dashboard')}
                                </span>
                                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isHomeDashboardExpanded ? 'rotate-180' : ''}`} />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Smooth Animated Accordion Container for Performance Dashboard on Home Screen */}
                        {isHomeDashboardExpanded && (
                          <div className="overflow-hidden transition-all duration-500 ease-in-out animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className={`border rounded-2xl p-4 sm:p-6 shadow-md space-y-4 ${
                              theme === 'night' ? 'bg-[#0c1428] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                            }`}>
                              <div className={`flex items-center justify-between border-b pb-3 ${
                                theme === 'night' ? 'border-slate-800' : 'border-slate-100'
                              }`}>
                                <div className="flex items-center gap-2">
                                  <BarChart3 className="w-5 h-5 text-blue-500" />
                                  <h3 className={`text-sm font-bold ${theme === 'night' ? 'text-white' : 'text-slate-900'}`}>
                                    {t.performanceDashboard} - {currentLanguage === 'bn' ? '৫টি ক্যাটাগরির লাইভ পরিসংখ্যান' : '5 Categories Live Analytics'}
                                  </h3>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setActiveTab('performance')}
                                    className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                                      theme === 'night' ? 'text-blue-300 hover:text-white bg-blue-950/60 hover:bg-blue-900/60 border border-blue-500/30' : 'text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100'
                                    }`}
                                    title={currentLanguage === 'bn' ? 'পূর্ণাঙ্গ ডেডিকেটেড পেজে দেখুন' : 'View full dedicated page'}
                                  >
                                    <span>{currentLanguage === 'bn' ? 'পূর্ণাঙ্গ ভিউ' : 'Fullscreen'}</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setIsHomeDashboardExpanded(false)}
                                    className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                                      theme === 'night' ? 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700' : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
                                    }`}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>{currentLanguage === 'bn' ? 'বন্ধ করুন' : 'Close'}</span>
                                  </button>
                                </div>
                              </div>

                              <PerformanceDashboard
                                entries={userVisibleEntries}
                                categoryCounts={categoryCounts}
                                onSelectCategory={navToCategory}
                                currentLanguage={currentLanguage}
                                disconnectionTasks={userVisibleDisconnectionTasks}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 5 Work Category Cards Selector */}
                      <CategorySelector
                        selectedCategory={selectedCategory}
                        onSelectCategory={(cat) => {
                          if (cat === 'DISCONNECTION') {
                            setActiveTab('disconnection');
                            setActiveFormCategory('DISCONNECTION');
                            setSelectedCategory('DISCONNECTION');
                            return;
                          }
                          setSelectedCategory(cat);
                          setActiveFormCategory(cat);
                        }}
                        categoryCounts={categoryCounts}
                        currentLanguage={currentLanguage}
                        theme={theme}
                      />

                      {/* Work Order & Khata Quick Access Banner on Home Screen */}
                      <div className={`border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        theme === 'night'
                          ? 'bg-gradient-to-r from-amber-950/40 via-[#0d162d] to-orange-950/30 border-amber-500/40 text-white'
                          : 'bg-gradient-to-r from-amber-50 via-white to-amber-50/80 border-amber-300/90 text-slate-900'
                      }`}>
                        <div className="flex items-center gap-3.5">
                          <div className="w-11 h-11 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-xs shrink-0">
                            <FileSpreadsheet className="w-5.5 h-5.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className={`text-sm sm:text-base font-extrabold tracking-tight ${theme === 'night' ? 'text-amber-300' : 'text-slate-900'}`}>
                                {t.workOrders || 'ওয়ার্ক অর্ডার ও খাতা (Work Order & Khata)'}
                              </h3>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                                {workOrders.filter(w => isAdmin || !w.isHidden).length} Live
                              </span>
                            </div>
                            <p className={`text-xs mt-0.5 font-medium ${theme === 'night' ? 'text-slate-300' : 'text-slate-600'}`}>
                              {t.workOrderNoticeDesc}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setActiveTab('work-orders')}
                            className="w-full sm:w-auto px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>{currentLanguage === 'bn' ? 'ওয়ার্ক অর্ডার ও খাতা খুলুন' : 'Open Work Order & Khata'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Recent Submissions */}
                      <div className={`border rounded-2xl sm:rounded-3xl p-4 sm:p-5.5 shadow-xs ${
                        theme === 'night' ? 'bg-[#0c1428] border-slate-800 text-white' : 'bg-white border-slate-200/90 text-slate-900'
                      }`}>
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Clock className={`w-4 h-4 ${theme === 'night' ? 'text-slate-400' : 'text-slate-600'}`} />
                              <h4 className={`text-xs font-bold uppercase tracking-wide ${theme === 'night' ? 'text-slate-200' : 'text-slate-800'}`}>
                                {t.recordsCount} ({userVisibleEntries.length})
                              </h4>
                            </div>
                          </div>
                          <WorkerRecentSubmissions
                            entries={userVisibleEntries.slice(0, 6)}
                            workerName={workerName}
                            currentUser={currentUser}
                            onLogout={handleUserLogout}
                            onSelectEntry={(entry) => setPreviewEntry(entry)}
                            onNewEntry={() => {
                              setSelectedCategory('NSC');
                              setActiveFormCategory('NSC');
                            }}
                            lang={currentLanguage}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* INSIDE FORM VIEW */
                    <div className="space-y-4">
                      {/* Category Switcher & Back Navigation Bar */}
                      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setActiveFormCategory(null)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            <span>← {t.filterAll} {t.fiveCategories}</span>
                          </button>
                          <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>
                          <span className="text-xs font-bold text-slate-700 hidden sm:inline">
                            {t.category}: <span className="text-blue-600 font-black">{activeFormCategory}</span>
                          </span>
                        </div>

                        {/* Quick Switch Pills */}
                        <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
                          {(['NSC', 'DISCONNECTION', 'POLE CASE', 'METER REPLESMENT', 'DTR REPLESMENT'] as CategoryType[]).map((cat, idx) => (
                            <button
                              key={`${cat}-${idx}`}
                              onClick={() => {
                                if (cat === 'DISCONNECTION') {
                                  setActiveTab('disconnection');
                                  setActiveFormCategory('DISCONNECTION');
                                  setSelectedCategory('DISCONNECTION');
                                  return;
                                }
                                setSelectedCategory(cat);
                                setActiveFormCategory(cat);
                              }}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                                (activeTab === 'disconnection' ? cat === 'DISCONNECTION' : activeFormCategory === cat)
                                  ? 'bg-slate-900 text-white shadow-xs'
                                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* If category is DISCONNECTION, embed the full Disconnection module connected to backend */}
                      {activeFormCategory === 'DISCONNECTION' ? (
                        <div className="space-y-4 animate-in fade-in duration-150">
                          <DisconnectionTaskManagement
                            currentUser={currentUser}
                            lang={currentLanguage}
                            initialTab="VIEW_LIST"
                            onBack={() => {
                              setActiveFormCategory(null);
                              setActiveTab('entry');
                            }}
                            onTasksChange={() => loadData(true)}
                            externalTasks={userVisibleDisconnectionTasks}
                          />
                        </div>
                      ) : (
                        <>
                          {isAgencyUser ? (
                            <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-4 sm:p-5 text-white shadow-md space-y-2">
                              <div className="flex items-center gap-2.5 text-amber-400 font-black text-sm sm:text-base">
                                <ShieldCheck className="w-5 h-5 shrink-0" />
                                <span>
                                  {currentLanguage === 'bn' 
                                    ? `${activeFormCategory} — শুধুমাত্র দেখার জন্য অনুমোদিত (View Only)` 
                                    : `${activeFormCategory} — View Only (Agency)`}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                {currentLanguage === 'bn'
                                  ? 'এজেন্সি অ্যাকাউন্ট শুধুমাত্র Disconnection মডিউলে কাজ (স্ট্যাটাস আপডেট ও রিমার্ক সাবমিট) করতে পারবে। NSC, Pole Case বা অন্যান্য মডিউলে নতুন ডেটা এন্ট্রি বা সেভ করা অনুমোদিত নয়। আপনি নিচে শুধুমাত্র এই মডিউলের লাইভ রেকর্ডগুলো দেখতে পারেন।'
                                  : 'Agency accounts can work in the Disconnection module only. Creating or saving new entries for NSC, Pole Case, and other modules is disabled. You may view the live records in the table below.'}
                              </p>
                            </div>
                          ) : (
                            <EntryForm
                              category={activeFormCategory}
                              workerName={workerName}
                              currentUser={currentUser}
                              initialNotice={selectedWorkOrderForEntry}
                              availableWorkOrders={workOrders}
                              disconnectionTasks={userVisibleDisconnectionTasks}
                              onSuccess={(newEntry) => {
                                handleEntrySuccess(newEntry);
                                setSelectedWorkOrderForEntry(null);
                              }}
                              onBack={() => {
                                setActiveFormCategory(null);
                                setSelectedWorkOrderForEntry(null);
                              }}
                              onDataUpdated={() => loadData(false, true)}
                              lang={currentLanguage}
                            />
                          )}

                          {/* Dedicated Module Records List strictly from the corresponding Backend Google Sheet tab */}
                          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-600" />
                                <h4 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">
                                  {activeFormCategory} — {t.recordsCount} ({userVisibleEntries.filter(e => e.category === activeFormCategory).length})
                                </h4>
                              </div>
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                                Live {activeFormCategory} Sheet Data
                              </span>
                            </div>
                            <WorkerRecentSubmissions
                              entries={userVisibleEntries.filter(e => e.category === activeFormCategory)}
                              workerName={workerName}
                              currentUser={currentUser}
                              onSelectEntry={(entry) => setPreviewEntry(entry)}
                              onNewEntry={isAgencyUser ? undefined : () => {
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              lang={currentLanguage}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* VIEW: PERFORMANCE DASHBOARD (DEDICATED FULL VIEW) */}
              {activeTab === 'performance' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Back to Home & Actions Bar */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setActiveTab('entry')}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>{currentLanguage === 'bn' ? '← হোম স্ক্রিনে ফিরে যান' : '← Back to Home'}</span>
                      </button>
                      <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <span>{t.performanceDashboard}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Live Analytics
                          </span>
                        </h2>
                        <p className="text-[11px] text-slate-500">
                          {currentLanguage === 'bn' ? 'WBSEDCL ৫টি ক্যাটাগরির কাজের বিস্তারিত রিপোর্ট' : 'WBSEDCL 5 Categories Field Performance Report'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={loadData}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCategory('NSC');
                          setActiveFormCategory('NSC');
                          setActiveTab('entry');
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ New Entry</span>
                      </button>
                    </div>
                  </div>

                  {/* Full Performance Dashboard Component */}
                  <PerformanceDashboard
                    entries={userVisibleEntries}
                    categoryCounts={categoryCounts}
                    onSelectCategory={(cat) => {
                      setSelectedCategory(cat);
                      setActiveFormCategory(cat);
                      setActiveTab('entry');
                    }}
                    currentLanguage={currentLanguage}
                    disconnectionTasks={userVisibleDisconnectionTasks}
                  />

                  {/* Recent Activity in Performance view */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-600" />
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">
                          {t.recordsCount} ({userVisibleEntries.length})
                        </h3>
                      </div>
                      <span className="text-xs text-slate-400">All Field Logs</span>
                    </div>

                    <WorkerRecentSubmissions
                      entries={userVisibleEntries}
                      workerName={workerName}
                      currentUser={currentUser}
                      onLogout={handleUserLogout}
                      onSelectEntry={(entry) => setPreviewEntry(entry)}
                      onNewEntry={() => {
                        setSelectedCategory('NSC');
                        setActiveFormCategory('NSC');
                        setActiveTab('entry');
                      }}
                      lang={currentLanguage}
                    />
                  </div>
                </div>
              )}

              {/* VIEW 2: ADMIN DASHBOARD (EXCLUSIVELY FOR LOGGED-IN ADMINS) */}
              {activeTab === 'admin' && isAdmin && (
                <div>
                  <AdminDashboard
                    entries={entries}
                    disconnectionTasks={disconnectionTasks}
                    onRefresh={() => loadData(true, true)}
                    onExportCsv={handleExportCsv}
                    onLogout={handleUserLogout}
                    lang={currentLanguage}
                    onOpenLanguageModal={() => setShowLanguageModal(true)}
                    syncMode="auto"
                    onNavigateToDisconnection={(tab) => {
                      setDisconnectionInitialTab(tab || 'VIEW_LIST');
                      setActiveTab('disconnection');
                    }}
                    isSyncing={isSyncing}
                    lastSyncedTimeStr={formatTimeHHMMSS(lastSyncedAt)}
                    onPowerAppSheetsRefresh={handlePowerAppSheetsRefresh}
                    forceRefreshState={forceRefreshState}
                    onForceSystemRefresh={handleForceSystemRefresh}
                  />
                </div>
              )}

              {/* VIEW 3: WORKER'S RECENT SUBMISSIONS (MAIN MODULE) */}
              {activeTab === 'my-submissions' && (
                <div className="space-y-6">
                  <WorkerRecentSubmissions
                    entries={userVisibleEntries}
                    workerName={workerName}
                    currentUser={currentUser}
                    onLogout={handleUserLogout}
                    onSelectEntry={(entry) => setPreviewEntry(entry)}
                    onNewEntry={() => setActiveTab('entry')}
                    lang={currentLanguage}
                  />
                </div>
              )}

              {/* VIEW 4: OFFICIAL WORK ORDER & KHATA NOTICE BOARD */}
              {activeTab === 'work-orders' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <WorkOrderNoticeSection
                    category="ALL"
                    currentUser={currentUser}
                    isAdmin={isAdmin}
                    lang={currentLanguage}
                    standalonePage={true}
                    syncMode="auto"
                    onStartWorkWithNotice={(notice) => {
                      setSelectedWorkOrderForEntry(notice);
                      const targetCat = (notice.category === 'ALL' || !notice.category ? 'NSC' : notice.category) as CategoryType;
                      setSelectedCategory(targetCat);
                      setActiveFormCategory(targetCat);
                      setActiveTab('entry');
                    }}
                  />
                </div>
              )}

              {/* VIEW 5: DISCONNECTION MODULE (TWO-WAY SYNC WITH GOOGLE SHEET) */}
              {activeTab === 'disconnection' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <DisconnectionTaskManagement
                    currentUser={currentUser}
                    lang={currentLanguage}
                    initialTab={disconnectionInitialTab}
                    onBack={() => setActiveTab('entry')}
                    onTasksChange={() => loadData(true)}
                    externalTasks={userVisibleDisconnectionTasks}
                  />
                </div>
              )}
        </section>
      </main>

      {/* Modal for Corner Options & App Settings */}
      <CornerOptionsModal
        activeOption={cornerModalOption}
        onClose={() => setCornerModalOption(null)}
        isAdmin={isAdmin}
        onLoginAdmin={handleAdminLogin}
        onLogoutAdmin={handleAdminLogout}
        onSwitchToAdminTab={() => setActiveTab('admin')}
        entries={entries}
        onExportCsv={handleExportCsv}
        forceRefreshState={forceRefreshState}
        onForceSystemRefresh={handleForceSystemRefresh}
        onOpenLanguageModal={() => setShowLanguageModal(true)}
      />

      {/* Language Selector Modal */}
      <LanguageModal
        isOpen={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
        currentLanguage={currentLanguage}
        onSelectLanguage={handleSelectLanguage}
        forceRefreshState={forceRefreshState}
        onForceSystemRefresh={handleForceSystemRefresh}
      />

      {/* Android & PWA App Install Modal */}
      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        deferredPrompt={deferredPrompt}
        onPromptInstall={handlePromptInstall}
      />

      {/* Help & Support Modal (Live Chat with Admin + Email to powerof2026@gmail.com) */}
      <HelpSupportModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        currentUser={currentUser}
        lang={currentLanguage}
      />

      {/* Global WBSEDCL Live OSD & Bill Check Modal */}
      {showGlobalLiveOsdModal && (
        <LiveOutstandingModal
          isOpen={showGlobalLiveOsdModal}
          initialId={liveOsdConsumerId}
          onClose={() => setShowGlobalLiveOsdModal(false)}
          lang={currentLanguage === 'bn' ? 'bn' : 'en'}
        />
      )}

      {/* Quick Preview & Slip Modal */}
      {previewEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900">{previewEntry.id}</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {previewEntry.category}
                </span>
              </div>
              <button
                onClick={() => setPreviewEntry(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div><strong className="text-slate-800">Consumer / Site:</strong> {previewEntry.consumerName || previewEntry.dtrName || previewEntry.poleNo}</div>
              <div><strong className="text-slate-800">Worker:</strong> {previewEntry.workerName}</div>
              <div><strong className="text-slate-800">Date & Time:</strong> {formatDateTime12Hour(previewEntry.date)}</div>
              <div><strong className="text-slate-800">Feeder:</strong> {previewEntry.feederName}</div>
              {previewEntry.notes && <div><strong className="text-slate-800">Notes:</strong> {previewEntry.notes}</div>}
            </div>

            <div className="flex gap-2 pt-2">
              {isAdmin && (
                <button
                  onClick={() => {
                    setPreviewEntry(null);
                    setActiveTab('admin');
                  }}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  View in Admin Console
                </button>
              )}
              <button
                onClick={() => setPreviewEntry(null)}
                className={`py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer ${
                  isAdmin ? 'px-4' : 'w-full'
                }`}
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
