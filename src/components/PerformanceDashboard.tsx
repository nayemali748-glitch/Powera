import React, { useState, useMemo } from 'react';
import { 
  Zap, 
  Scissors, 
  TowerControl, 
  Gauge, 
  Activity, 
  CheckCircle2, 
  TrendingUp, 
  Clock, 
  BarChart3, 
  ShieldCheck,
  Award,
  CreditCard,
  Power,
  HelpCircle,
  AlertCircle,
  Users,
  Search,
  X,
  Phone,
  MapPin,
  ExternalLink,
  MoreVertical,
  Building2,
  ChevronsUpDown,
  Check
} from 'lucide-react';
import { CategoryType, PowerEntry, DisconnectionTask, UserSession } from '../types';
import { Language, translations } from '../utils/translations';
import { cleanNameOnly } from '../utils/entryNormalizer';
import {
  getTaskPhase,
  getTaskConnectionClass,
  matchesDisconnectionStatus,
  PhaseFilterType,
  ClassFilterType,
  StatusFilterType
} from '../utils/disconnectionClassifier';

interface PerformanceDashboardProps {
  entries: PowerEntry[];
  categoryCounts: Record<string, number>;
  onSelectCategory: (category: CategoryType) => void;
  currentLanguage?: Language;
  disconnectionTasks?: DisconnectionTask[];
  currentUser?: UserSession | null;
  onNavigateToDisconnection?: () => void;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  entries,
  categoryCounts,
  onSelectCategory,
  currentLanguage = 'en',
  disconnectionTasks = [],
  currentUser,
  onNavigateToDisconnection,
}) => {
  const t = translations[currentLanguage] || translations.en;

  const [selectedDiscStatus, setSelectedDiscStatus] = useState<StatusFilterType | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilterType>('ALL');
  const [classFilter, setClassFilter] = useState<ClassFilterType>('ALL');
  const [deckSearch, setDeckSearch] = useState('');
  const [showThreeDotFilter, setShowThreeDotFilter] = useState(false);

  // Derive Disconnection tasks from prop or fallback to DISCONNECTION entries
  const effectiveDiscTasks: DisconnectionTask[] = useMemo(() => {
    if (disconnectionTasks && disconnectionTasks.length > 0) {
      return disconnectionTasks;
    }
    return entries
      .filter((e) => e.category === 'DISCONNECTION')
      .map((e) => ({
        id: e.id || `TASK-DISC-${e.consumerId}`,
        consumerId: e.consumerId || e.id,
        consumerName: e.consumerName || 'N/A',
        address: e.address || '',
        mobile: e.mobile || '',
        meterNo: e.meterNo || '',
        poleNo: e.poleNo || '',
        arrearAmount: e.arrearAmount || '0',
        disconStatus: e.disconStatus || e.status || 'CONNECTED',
        agencyName: e.agencyName || '',
        updatedBy: e.workerName || '',
        updatedAt: e.date || '',
        remarks: e.notes || e.reason || '',
        baseClass: e.baseClass || e.tariffCategory || '',
        device: e.device || e.phase || '',
        category: e.tariffCategory || e.baseClass || '',
      }));
  }, [disconnectionTasks, entries]);

  const totalDisconnectionListCount = Math.max(
    categoryCounts['DISCONNECTION'] || 0,
    effectiveDiscTasks.length
  );

  const nonDiscCount =
    (categoryCounts['NSC'] || 0) +
    (categoryCounts['POLE CASE'] || 0) +
    (categoryCounts['METER REPLESMENT'] || 0) +
    (categoryCounts['DTR REPLESMENT'] || 0);

  const totalEntries = Math.max(entries.length, nonDiscCount + totalDisconnectionListCount);
  const completedEntries = entries.filter(e => e.status === 'Completed' || e.status === 'Approved').length;
  const pendingEntries = entries.filter(e => e.status === 'Pending' || e.status === 'In Progress').length;
  const withGps = entries.filter(e => !!e.locationGps).length;
  const withMedia = entries.filter(e => !!e.photoUrl).length;

  const completionRate = totalEntries > 0 ? Math.round((completedEntries / totalEntries) * 100) : 100;

  // Filtered Disconnection tasks by Phase & Category
  const filteredDiscByPhaseClass = useMemo(() => {
    return effectiveDiscTasks.filter((task) => {
      if (phaseFilter !== 'ALL' && getTaskPhase(task) !== phaseFilter) return false;
      if (classFilter !== 'ALL' && getTaskConnectionClass(task) !== classFilter) return false;
      return true;
    });
  }, [effectiveDiscTasks, phaseFilter, classFilter]);

  // Disconnection Status Counts
  const discMetrics = useMemo(() => {
    const total = filteredDiscByPhaseClass.length;
    const paid = filteredDiscByPhaseClass.filter((t) => matchesDisconnectionStatus(t, 'Paid')).length;
    const disconnected = filteredDiscByPhaseClass.filter((t) => matchesDisconnectionStatus(t, 'Disconnected')).length;
    const connected = filteredDiscByPhaseClass.filter((t) => matchesDisconnectionStatus(t, 'Connected')).length;
    const notFound = filteredDiscByPhaseClass.filter((t) => matchesDisconnectionStatus(t, 'Not Found')).length;
    const dispute = filteredDiscByPhaseClass.filter((t) => matchesDisconnectionStatus(t, 'Dispute')).length;
    return { total, paid, disconnected, connected, notFound, dispute };
  }, [filteredDiscByPhaseClass]);

  const activeDeckConsumers = useMemo(() => {
    if (!selectedDiscStatus) return [];
    const q = deckSearch.trim().toLowerCase();
    return filteredDiscByPhaseClass.filter((task) => {
      const statusMatch =
        selectedDiscStatus === 'ALL'
          ? true
          : matchesDisconnectionStatus(task, selectedDiscStatus);
      if (!statusMatch) return false;
      if (!q) return true;
      return (
        (task.consumerId || '').toLowerCase().includes(q) ||
        (task.consumerName || '').toLowerCase().includes(q) ||
        (task.meterNo || '').toLowerCase().includes(q) ||
        (task.mobile || '').toLowerCase().includes(q) ||
        (task.address || '').toLowerCase().includes(q)
      );
    });
  }, [filteredDiscByPhaseClass, selectedDiscStatus, deckSearch]);

  const categoryStats = [
    {
      id: 'NSC' as CategoryType,
      name: 'NSC',
      label: t.nscTitle,
      count: categoryCounts['NSC'] || 0,
      icon: Zap,
      color: 'amber',
      bgLight: 'bg-amber-50',
      textAccent: 'text-amber-700',
      borderAccent: 'border-amber-300',
      barColor: 'bg-amber-500',
      badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
    },
    {
      id: 'DISCONNECTION' as CategoryType,
      name: 'DISCONNECTION',
      label: t.disconnectionTitle,
      count: totalDisconnectionListCount,
      icon: Scissors,
      color: 'rose',
      bgLight: 'bg-rose-50',
      textAccent: 'text-rose-700',
      borderAccent: 'border-rose-300',
      barColor: 'bg-rose-500',
      badgeBg: 'bg-rose-100 text-rose-900 border-rose-300',
    },
    {
      id: 'POLE CASE' as CategoryType,
      name: 'POLE CASE',
      label: t.poleCaseTitle,
      count: categoryCounts['POLE CASE'] || 0,
      icon: TowerControl,
      color: 'sky',
      bgLight: 'bg-sky-50',
      textAccent: 'text-sky-700',
      borderAccent: 'border-sky-300',
      barColor: 'bg-sky-500',
      badgeBg: 'bg-sky-100 text-sky-900 border-sky-300',
    },
    {
      id: 'METER REPLESMENT' as CategoryType,
      name: 'METER REPLESMENT',
      label: t.meterReplacementTitle,
      count: categoryCounts['METER REPLESMENT'] || 0,
      icon: Gauge,
      color: 'emerald',
      bgLight: 'bg-emerald-50',
      textAccent: 'text-emerald-700',
      borderAccent: 'border-emerald-300',
      barColor: 'bg-emerald-500',
      badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    },
    {
      id: 'DTR REPLESMENT' as CategoryType,
      name: 'DTR REPLESMENT',
      label: t.dtrReplacementTitle,
      count: categoryCounts['DTR REPLESMENT'] || 0,
      icon: Activity,
      color: 'indigo',
      bgLight: 'bg-indigo-50',
      textAccent: 'text-indigo-700',
      borderAccent: 'border-indigo-300',
      barColor: 'bg-indigo-500',
      badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    },
  ];

  const handleToggleDiscDeck = (status: StatusFilterType) => {
    setSelectedDiscStatus((prev) => (prev === status ? null : status));
  };

  const isAgency = currentUser?.role === 'agency';

  // Agency Specific Filter States (Exact match for IMG_6108.jpeg)
  const [agencySelectedAgency, setAgencySelectedAgency] = useState<string>('All');
  const [agencySelectedClass, setAgencySelectedClass] = useState<string>('All');
  const [agencyActiveStatusCard, setAgencyActiveStatusCard] = useState<string | null>(null);
  const [agencyConsumerSearch, setAgencyConsumerSearch] = useState<string>('');

  const parseAmount = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    const clean = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const formatCurrency = (val: number): string => {
    return '₹' + Math.round(val || 0).toLocaleString('en-IN');
  };

  // Helper classification for Class in WBSEDCL (Domestic, Commercial, Industrial, STW, Other)
  const getTaskCategoryClass = (task: DisconnectionTask): 'DOMESTIC' | 'COMMERCIAL' | 'INDUSTRIAL' | 'STW' | 'OTHER' => {
    const base = String(task.baseClass || (task as any)['Base Class'] || '').trim().toLowerCase();
    const cls = String((task as any)['Class'] || task.classType || '').trim().toLowerCase();
    
    if (cls.includes('commercial') || /^c\s*-/.test(base)) {
      return 'COMMERCIAL';
    }
    if (cls.includes('industrial') || /^i\s*-/.test(base)) {
      return 'INDUSTRIAL';
    }
    if (cls.includes('domestic') || /^a\s*-|^d\s*-/.test(base)) {
      return 'DOMESTIC';
    }
    if (cls.includes('agriculture') || cls.includes('stw') || cls.includes('agri')) {
      return 'STW';
    }
    const fallback = getTaskConnectionClass(task);
    if (fallback) return fallback;
    return 'OTHER';
  };

  // Unique Agencies for Agency Dropdown
  const agencyListOptions = useMemo(() => {
    const set = new Set<string>();
    effectiveDiscTasks.forEach(t => {
      const ag = cleanNameOnly(t.assignedAgency || (t as any).Agency || t.assignedWorkerName || '');
      if (ag && ag !== 'Worker' && ag !== 'Admin') set.add(ag);
    });
    const currentName = cleanNameOnly(currentUser?.name || currentUser?.agencyName || '');
    if (currentName) set.add(currentName);
    return Array.from(set).sort();
  }, [effectiveDiscTasks, currentUser]);

  // Filter tasks based on Agency dropdown and Class dropdown
  const agencyFilteredTasks = useMemo(() => {
    return effectiveDiscTasks.filter(t => {
      if (agencySelectedAgency !== 'All') {
        const ag = cleanNameOnly(t.assignedAgency || (t as any).Agency || t.assignedWorkerName || '').toLowerCase();
        const sel = agencySelectedAgency.toLowerCase();
        if (!ag.includes(sel) && !sel.includes(ag)) return false;
      }
      if (agencySelectedClass !== 'All') {
        const c = getTaskCategoryClass(t);
        if (agencySelectedClass.toUpperCase() === 'DOMESTIC' && c !== 'DOMESTIC') return false;
        if (agencySelectedClass.toUpperCase() === 'COMMERCIAL' && c !== 'COMMERCIAL') return false;
        if (agencySelectedClass.toUpperCase() === 'INDUSTRIAL' && c !== 'INDUSTRIAL') return false;
        if (agencySelectedClass.toUpperCase() === 'STW' && c !== 'STW') return false;
        if (agencySelectedClass.toUpperCase() === 'OTHER' && c !== 'OTHER') return false;
      }
      return true;
    });
  }, [effectiveDiscTasks, agencySelectedAgency, agencySelectedClass]);

  // Metrics for the 8 Cards exactly matching IMG_6108.jpeg
  const agencyMetrics = useMemo(() => {
    let totalCount = 0;
    let totalAmount = 0;
    let connectedCount = 0;
    let connectedAmount = 0;
    let disconnectedCount = 0;
    let disconnectedAmount = 0;
    let paidCount = 0;
    let paidAmount = 0;
    let officeTeamCount = 0;
    let officeTeamAmount = 0;
    let billDisputeCount = 0;
    let billDisputeAmount = 0;
    let notFoundCount = 0;
    let notFoundAmount = 0;

    agencyFilteredTasks.forEach(t => {
      const due = parseAmount(t.outstandingDue || (t as any)['D2 Net O/S'] || t.arrearAmount);
      const paid = parseAmount(t.paidAmount || (t as any)['Paid Amount']);

      totalCount++;
      totalAmount += due;

      if (matchesDisconnectionStatus(t, 'PAID')) {
        paidCount++;
        paidAmount += (paid > 0 ? paid : due);
      } else if (matchesDisconnectionStatus(t, 'DISCONNECT')) {
        disconnectedCount++;
        disconnectedAmount += due;
      } else if (matchesDisconnectionStatus(t, 'OFFICE TEAM')) {
        officeTeamCount++;
        officeTeamAmount += due;
      } else if (matchesDisconnectionStatus(t, 'DISPUTE')) {
        billDisputeCount++;
        billDisputeAmount += due;
      } else if (matchesDisconnectionStatus(t, 'NOT FOUND')) {
        notFoundCount++;
        notFoundAmount += due;
      } else {
        connectedCount++;
        connectedAmount += due;
      }
    });

    return {
      total: { count: totalCount, amount: totalAmount },
      connected: { count: connectedCount, amount: connectedAmount },
      disconnected: { count: disconnectedCount, amount: disconnectedAmount },
      paid: { count: paidCount, amount: paidAmount },
      officeTeam: { count: officeTeamCount, amount: officeTeamAmount },
      billDispute: { count: billDisputeCount, amount: billDisputeAmount },
      notFound: { count: notFoundCount, amount: notFoundAmount },
      totalOutstanding: totalAmount
    };
  }, [agencyFilteredTasks]);

  // Table rows for Agency Breakdown
  const agencyTableRows = useMemo(() => {
    const map = new Map<string, {
      agency: string;
      totalCount: number;
      totalAmount: number;
      discCount: number;
      discAmount: number;
      paidCount: number;
      paidAmount: number;
      officeCount: number;
      officeAmount: number;
      disputeCount: number;
      disputeAmount: number;
      notFoundCount: number;
      notFoundAmount: number;
    }>();

    const targetAgencies = agencySelectedAgency === 'All'
      ? (agencyListOptions.length > 0 ? agencyListOptions : [cleanNameOnly(currentUser?.name || currentUser?.agencyName || 'Agency')])
      : [agencySelectedAgency];

    targetAgencies.forEach(ag => {
      map.set(ag, {
        agency: ag,
        totalCount: 0,
        totalAmount: 0,
        discCount: 0,
        discAmount: 0,
        paidCount: 0,
        paidAmount: 0,
        officeCount: 0,
        officeAmount: 0,
        disputeCount: 0,
        disputeAmount: 0,
        notFoundCount: 0,
        notFoundAmount: 0
      });
    });

    agencyFilteredTasks.forEach(t => {
      const rawAg = cleanNameOnly(t.assignedAgency || (t as any).Agency || t.assignedWorkerName || '');
      const matchedAgency = targetAgencies.find(a => rawAg.toLowerCase().includes(a.toLowerCase())) || targetAgencies[0];
      const row = map.get(matchedAgency);
      if (!row) return;

      const due = parseAmount(t.outstandingDue || (t as any)['D2 Net O/S'] || t.arrearAmount);
      const paid = parseAmount(t.paidAmount || (t as any)['Paid Amount']);

      row.totalCount++;
      row.totalAmount += due;

      if (matchesDisconnectionStatus(t, 'PAID')) {
        row.paidCount++;
        row.paidAmount += (paid > 0 ? paid : due);
      } else if (matchesDisconnectionStatus(t, 'DISCONNECT')) {
        row.discCount++;
        row.discAmount += due;
      } else if (matchesDisconnectionStatus(t, 'OFFICE TEAM')) {
        row.officeCount++;
        row.officeAmount += due;
      } else if (matchesDisconnectionStatus(t, 'DISPUTE')) {
        row.disputeCount++;
        row.disputeAmount += due;
      } else if (matchesDisconnectionStatus(t, 'NOT FOUND')) {
        row.notFoundCount++;
        row.notFoundAmount += due;
      }
    });

    return Array.from(map.values());
  }, [agencyFilteredTasks, agencySelectedAgency, agencyListOptions, currentUser]);

  // Consumers matching active clicked card (optional drill-down)
  const agencyActiveCardConsumers = useMemo(() => {
    if (!agencyActiveStatusCard) return [];
    return agencyFilteredTasks.filter(t => {
      let matches = false;
      if (agencyActiveStatusCard === 'ALL') {
        matches = true;
      } else if (agencyActiveStatusCard === 'CONNECTED') {
        matches = !matchesDisconnectionStatus(t, 'PAID') &&
                  !matchesDisconnectionStatus(t, 'DISCONNECT') &&
                  !matchesDisconnectionStatus(t, 'OFFICE TEAM') &&
                  !matchesDisconnectionStatus(t, 'DISPUTE') &&
                  !matchesDisconnectionStatus(t, 'NOT FOUND');
      } else {
        matches = matchesDisconnectionStatus(t, agencyActiveStatusCard as any);
      }

      if (!matches) return false;

      if (agencyConsumerSearch.trim()) {
        const q = agencyConsumerSearch.toLowerCase().trim();
        const cId = String(t.consumerId || (t as any)['Consumer Id'] || '').toLowerCase();
        const cNm = String(t.consumerName || (t as any)['Name'] || '').toLowerCase();
        const ph = String(t.phoneNumber || (t as any)['Mobile'] || '').toLowerCase();
        const meter = String((t as any).meterNo || t.meterNumber || (t as any)['Meter No'] || '').toLowerCase();
        const pole = String((t as any).poleNo || (t as any).gisPole || (t as any)['Gis Pole'] || (t as any)['Pole No'] || '').toLowerCase();
        const addr = String(t.consumerAddress || (t as any).address || t.Address || '').toLowerCase();
        return cId.includes(q) || cNm.includes(q) || ph.includes(q) || meter.includes(q) || pole.includes(q) || addr.includes(q);
      }
      return true;
    });
  }, [agencyFilteredTasks, agencyActiveStatusCard, agencyConsumerSearch]);

  const getCardStatusLabel = (status: string | null) => {
    switch (status) {
      case 'CONNECTED': return 'Connected';
      case 'DISCONNECT': return 'Disconnected';
      case 'PAID': return 'Paid';
      case 'OFFICE TEAM': return 'Office Team';
      case 'DISPUTE': return 'Bill Dispute';
      case 'NOT FOUND': return 'Not Found';
      default: return 'Total';
    }
  };

  // IF AGENCY LOGIN: Render ONLY the Agency Disconnection Performance Dashboard format!
  // IF AGENCY LOGIN: Render EXACT Same-to-Same format as in IMG_6108.jpeg!
  if (isAgency) {
    return (
      <div className="space-y-4 mb-6 animate-in fade-in duration-150">
        {/* Top Dropdowns: Agency (Left) & Class (Right) */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              Agency
            </label>
            <div className="relative">
              <select
                value={agencySelectedAgency}
                onChange={(e) => setAgencySelectedAgency(e.target.value)}
                className="w-full appearance-none bg-white border border-slate-200/90 rounded-xl py-2.5 px-3.5 pr-8 text-sm font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="All">All</option>
                {agencyListOptions.map((ag) => (
                  <option key={ag} value={ag}>
                    {ag}
                  </option>
                ))}
              </select>
              <ChevronsUpDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              Class
            </label>
            <div className="relative">
              <select
                value={agencySelectedClass}
                onChange={(e) => setAgencySelectedClass(e.target.value)}
                className="w-full appearance-none bg-white border border-slate-200/90 rounded-xl py-2.5 px-3.5 pr-8 text-sm font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="All">All</option>
                <option value="DOMESTIC">Domestic</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="INDUSTRIAL">Industrial</option>
                <option value="STW">STW</option>
                <option value="OTHER">Other</option>
              </select>
              <ChevronsUpDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* 8 Statistics Cards exactly as in IMG_6108.jpeg */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* 1. Total */}
          <button
            type="button"
            onClick={() => setAgencyActiveStatusCard(agencyActiveStatusCard === 'ALL' ? null : 'ALL')}
            className={`text-left bg-white border rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-blue-500 cursor-pointer ${
              agencyActiveStatusCard === 'ALL' ? 'border-blue-600 ring-2 ring-blue-500/30 bg-blue-50/20' : 'border-slate-200/80'
            }`}
          >
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-600">Total</div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {agencyMetrics.total.count}
              </div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">
                Total Amount: {formatCurrency(agencyMetrics.total.amount)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </button>

          {/* 2. Connected */}
          <button
            type="button"
            onClick={() => setAgencyActiveStatusCard(agencyActiveStatusCard === 'CONNECTED' ? null : 'CONNECTED')}
            className={`text-left bg-white border rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-emerald-500 cursor-pointer ${
              agencyActiveStatusCard === 'CONNECTED' ? 'border-emerald-600 ring-2 ring-emerald-500/30 bg-emerald-50/20' : 'border-slate-200/80'
            }`}
          >
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-600">Connected</div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {agencyMetrics.connected.count}
              </div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">
                Connected Amount: {formatCurrency(agencyMetrics.connected.amount)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 stroke-[2.5]" />
            </div>
          </button>

          {/* 3. Disconnected */}
          <button
            type="button"
            onClick={() => setAgencyActiveStatusCard(agencyActiveStatusCard === 'DISCONNECT' ? null : 'DISCONNECT')}
            className={`text-left bg-white border rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-rose-500 cursor-pointer ${
              agencyActiveStatusCard === 'DISCONNECT' ? 'border-rose-600 ring-2 ring-rose-500/30 bg-rose-50/20' : 'border-slate-200/80'
            }`}
          >
            <div>
              <div className="text-xs sm:text-sm font-bold text-rose-600">Disconnected</div>
              <div className="text-2xl sm:text-3xl font-black text-rose-600 mt-1">
                {agencyMetrics.disconnected.count}
              </div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">
                Disconnected Amount: {formatCurrency(agencyMetrics.disconnected.amount)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
              <Power className="w-5 h-5 stroke-[2.5]" />
            </div>
          </button>

          {/* 4. Paid */}
          <button
            type="button"
            onClick={() => setAgencyActiveStatusCard(agencyActiveStatusCard === 'PAID' ? null : 'PAID')}
            className={`text-left bg-white border rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-emerald-500 cursor-pointer ${
              agencyActiveStatusCard === 'PAID' ? 'border-emerald-600 ring-2 ring-emerald-500/30 bg-emerald-50/30' : 'border-slate-200/80'
            }`}
          >
            <div>
              <div className="text-xs sm:text-sm font-bold text-emerald-700">Paid</div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">
                {agencyMetrics.paid.count}
              </div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">
                Paid Amount: {formatCurrency(agencyMetrics.paid.amount)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
            </div>
          </button>

          {/* 5. Office Team */}
          <button
            type="button"
            onClick={() => setAgencyActiveStatusCard(agencyActiveStatusCard === 'OFFICE TEAM' ? null : 'OFFICE TEAM')}
            className={`text-left bg-white border rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-amber-500 cursor-pointer ${
              agencyActiveStatusCard === 'OFFICE TEAM' ? 'border-amber-600 ring-2 ring-amber-500/30 bg-amber-50/20' : 'border-slate-200/80'
            }`}
          >
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-600">Office Team</div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {agencyMetrics.officeTeam.count}
              </div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">
                Office Team Amount: {formatCurrency(agencyMetrics.officeTeam.amount)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 stroke-[2.5]" />
            </div>
          </button>

          {/* 6. Bill Dispute */}
          <button
            type="button"
            onClick={() => setAgencyActiveStatusCard(agencyActiveStatusCard === 'DISPUTE' ? null : 'DISPUTE')}
            className={`text-left bg-white border rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-orange-500 cursor-pointer ${
              agencyActiveStatusCard === 'DISPUTE' ? 'border-orange-600 ring-2 ring-orange-500/30 bg-orange-50/20' : 'border-slate-200/80'
            }`}
          >
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-600">Bill Dispute</div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {agencyMetrics.billDispute.count}
              </div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">
                Dispute Amount: {formatCurrency(agencyMetrics.billDispute.amount)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 stroke-[2.5]" />
            </div>
          </button>

          {/* 7. Not Found */}
          <button
            type="button"
            onClick={() => setAgencyActiveStatusCard(agencyActiveStatusCard === 'NOT FOUND' ? null : 'NOT FOUND')}
            className={`text-left bg-white border rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-indigo-500 cursor-pointer ${
              agencyActiveStatusCard === 'NOT FOUND' ? 'border-indigo-600 ring-2 ring-indigo-500/30 bg-indigo-50/20' : 'border-slate-200/80'
            }`}
          >
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-600">Not Found</div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {agencyMetrics.notFound.count}
              </div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">
                Not Found Amount: {formatCurrency(agencyMetrics.notFound.amount)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5 stroke-[2.5]" />
            </div>
          </button>

          {/* 8. Total Outstanding */}
          <button
            type="button"
            onClick={() => setAgencyActiveStatusCard(agencyActiveStatusCard === 'ALL' ? null : 'ALL')}
            className={`text-left bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center justify-between transition-all hover:border-purple-400 cursor-pointer ${
              agencyActiveStatusCard === 'ALL' ? 'border-purple-600 ring-2 ring-purple-500/30 bg-purple-50/20' : ''
            }`}
          >
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-600">Total Outstanding</div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {formatCurrency(agencyMetrics.totalOutstanding)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            </div>
          </button>
        </div>

        {/* Agency Breakdown Table (EXACT Same-to-Same format as in IMG_6108.jpeg) */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-3 sm:p-5 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-600" />
              <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">
                Agency Performance Breakdown Table
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-500">
              {agencyTableRows.length} Agencies
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-center">
                  <th rowSpan={2} className="p-3 text-left border-r border-slate-200 min-w-[130px]">
                    Agency
                  </th>
                  <th colSpan={2} className="p-2 border-r border-slate-200">
                    Total
                  </th>
                  <th colSpan={2} className="p-2 border-r border-slate-200 bg-rose-50/50 text-rose-700">
                    Disconnected
                  </th>
                  <th colSpan={2} className="p-2 border-r border-slate-200 bg-emerald-50/50 text-emerald-700">
                    Paid
                  </th>
                  <th colSpan={2} className="p-2 border-r border-slate-200 bg-amber-50/50 text-amber-700">
                    Office Team
                  </th>
                  <th colSpan={2} className="p-2 border-r border-slate-200 bg-orange-50/50 text-orange-700">
                    Bill Dispute
                  </th>
                  <th colSpan={2} className="p-2 bg-indigo-50/50 text-indigo-700">
                    Not Found
                  </th>
                </tr>
                <tr className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200 text-center text-[11px]">
                  <th className="p-2 border-r border-slate-200 min-w-[60px]">Count</th>
                  <th className="p-2 border-r border-slate-200 min-w-[85px]">Amount</th>
                  <th className="p-2 border-r border-slate-200 min-w-[60px]">Count</th>
                  <th className="p-2 border-r border-slate-200 min-w-[85px]">Amount</th>
                  <th className="p-2 border-r border-slate-200 min-w-[60px]">Count</th>
                  <th className="p-2 border-r border-slate-200 min-w-[85px]">Amount</th>
                  <th className="p-2 border-r border-slate-200 min-w-[60px]">Count</th>
                  <th className="p-2 border-r border-slate-200 min-w-[85px]">Amount</th>
                  <th className="p-2 border-r border-slate-200 min-w-[60px]">Count</th>
                  <th className="p-2 border-r border-slate-200 min-w-[85px]">Amount</th>
                  <th className="p-2 border-r border-slate-200 min-w-[60px]">Count</th>
                  <th className="p-2 min-w-[85px]">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-center font-medium">
                {agencyTableRows.map((row, idx) => (
                  <tr
                    key={row.agency + idx}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="p-2.5 text-left font-bold text-slate-900 border-r border-slate-200">
                      {row.agency}
                    </td>
                    <td
                      onClick={() => setAgencyActiveStatusCard(agencyActiveStatusCard === 'ALL' ? null : 'ALL')}
                      className="p-2 font-bold text-slate-800 border-r border-slate-200 cursor-pointer hover:underline"
                    >
                      {row.totalCount}
                    </td>
                    <td className="p-2 text-slate-600 border-r border-slate-200">
                      {formatCurrency(row.totalAmount)}
                    </td>
                    <td
                      onClick={() => setAgencyActiveStatusCard(agencyActiveStatusCard === 'DISCONNECT' ? null : 'DISCONNECT')}
                      className="p-2 font-bold text-rose-600 border-r border-slate-200 cursor-pointer hover:underline"
                    >
                      {row.discCount}
                    </td>
                    <td className="p-2 text-slate-600 border-r border-slate-200">
                      {formatCurrency(row.discAmount)}
                    </td>
                    <td
                      onClick={() => setAgencyActiveStatusCard(agencyActiveStatusCard === 'PAID' ? null : 'PAID')}
                      className="p-2 font-bold text-emerald-600 border-r border-slate-200 cursor-pointer hover:underline"
                    >
                      {row.paidCount}
                    </td>
                    <td className="p-2 text-slate-600 border-r border-slate-200">
                      {formatCurrency(row.paidAmount)}
                    </td>
                    <td
                      onClick={() => setAgencyActiveStatusCard(agencyActiveStatusCard === 'OFFICE TEAM' ? null : 'OFFICE TEAM')}
                      className="p-2 font-bold text-amber-600 border-r border-slate-200 cursor-pointer hover:underline"
                    >
                      {row.officeCount}
                    </td>
                    <td className="p-2 text-slate-600 border-r border-slate-200">
                      {formatCurrency(row.officeAmount)}
                    </td>
                    <td
                      onClick={() => setAgencyActiveStatusCard(agencyActiveStatusCard === 'DISPUTE' ? null : 'DISPUTE')}
                      className="p-2 font-bold text-orange-600 border-r border-slate-200 cursor-pointer hover:underline"
                    >
                      {row.disputeCount}
                    </td>
                    <td className="p-2 text-slate-600 border-r border-slate-200">
                      {formatCurrency(row.disputeAmount)}
                    </td>
                    <td
                      onClick={() => setAgencyActiveStatusCard(agencyActiveStatusCard === 'NOT FOUND' ? null : 'NOT FOUND')}
                      className="p-2 font-bold text-indigo-600 border-r border-slate-200 cursor-pointer hover:underline"
                    >
                      {row.notFoundCount}
                    </td>
                    <td className="p-2 text-slate-600">
                      {formatCurrency(row.notFoundAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300 text-center">
                  <td className="p-3 text-left font-black border-r border-slate-300">
                    Total
                  </td>
                  <td className="p-2 border-r border-slate-300">
                    {agencyMetrics.total.count}
                  </td>
                  <td className="p-2 border-r border-slate-300">
                    {formatCurrency(agencyMetrics.total.amount)}
                  </td>
                  <td className="p-2 text-rose-600 border-r border-slate-300">
                    {agencyMetrics.disconnected.count}
                  </td>
                  <td className="p-2 border-r border-slate-300">
                    {formatCurrency(agencyMetrics.disconnected.amount)}
                  </td>
                  <td className="p-2 text-emerald-600 border-r border-slate-300">
                    {agencyMetrics.paid.count}
                  </td>
                  <td className="p-2 border-r border-slate-300">
                    {formatCurrency(agencyMetrics.paid.amount)}
                  </td>
                  <td className="p-2 text-amber-600 border-r border-slate-300">
                    {agencyMetrics.officeTeam.count}
                  </td>
                  <td className="p-2 border-r border-slate-300">
                    {formatCurrency(agencyMetrics.officeTeam.amount)}
                  </td>
                  <td className="p-2 text-orange-600 border-r border-slate-300">
                    {agencyMetrics.billDispute.count}
                  </td>
                  <td className="p-2 border-r border-slate-300">
                    {formatCurrency(agencyMetrics.billDispute.amount)}
                  </td>
                  <td className="p-2 text-indigo-600 border-r border-slate-300">
                    {agencyMetrics.notFound.count}
                  </td>
                  <td className="p-2">
                    {formatCurrency(agencyMetrics.notFound.amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ACTIVE CONSUMER DATA PANEL (When any card or table count is clicked) */}
        {agencyActiveStatusCard && (
          <div className="bg-white border-2 border-slate-900 rounded-3xl p-4 sm:p-5 shadow-md space-y-4 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-slate-900 text-amber-400 text-xs font-black uppercase">
                  {getCardStatusLabel(agencyActiveStatusCard)}
                </span>
                <span className="text-sm font-black text-slate-900">
                  ({agencyActiveCardConsumers.length} {currentLanguage === 'bn' ? 'জন উপভোক্তা' : 'Consumers'})
                </span>
                {agencySelectedClass !== 'All' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                    {agencySelectedClass}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={agencyConsumerSearch}
                    onChange={(e) => setAgencyConsumerSearch(e.target.value)}
                    placeholder={currentLanguage === 'bn' ? 'উপভোক্তার নাম বা আইডি খুঁজুন...' : 'Search consumer...'}
                    className="w-full sm:w-56 pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setAgencyActiveStatusCard(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {agencyActiveCardConsumers.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs sm:text-sm font-semibold">
                {currentLanguage === 'bn'
                  ? 'এই স্ট্যাটাসে কোনো উপভোক্তার ডেটা নেই।'
                  : 'No consumers found for this status filter.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-1">
                {agencyActiveCardConsumers.slice(0, 90).map((task, idx) => {
                  const ph = getTaskPhase(task);
                  const cl = getTaskCategoryClass(task);
                  const dueAmt = parseAmount(task.outstandingDue || (task as any)['D2 Net O/S'] || task.arrearAmount);
                  const paidAmt = parseAmount(task.paidAmount || (task as any)['Paid Amount']);
                  const isPaid = matchesDisconnectionStatus(task, 'PAID');
                  const isDisc = matchesDisconnectionStatus(task, 'DISCONNECT');
                  const isOffice = matchesDisconnectionStatus(task, 'OFFICE TEAM');
                  const isDispute = matchesDisconnectionStatus(task, 'DISPUTE');
                  const isNotFound = matchesDisconnectionStatus(task, 'NOT FOUND');

                  return (
                    <div
                      key={`${task.taskId || task.consumerId || idx}-${idx}`}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50/70 hover:bg-white transition-all space-y-2 shadow-2xs group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            ID: {task.consumerId || (task as any)['Consumer Id']}
                          </span>
                          <h4 className="text-xs font-black text-slate-900 mt-1 line-clamp-1 group-hover:text-blue-700 transition-colors">
                            {task.consumerName || (task as any)['Name'] || 'Consumer'}
                          </h4>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 border ${
                          isPaid ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                          isDisc ? 'bg-rose-100 text-rose-800 border-rose-300' :
                          isOffice ? 'bg-amber-100 text-amber-800 border-amber-300' :
                          isDispute ? 'bg-orange-100 text-orange-800 border-orange-300' :
                          isNotFound ? 'bg-indigo-100 text-indigo-800 border-indigo-300' :
                          'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {task.disconStatus || (task as any)['Discon Status'] || (isPaid ? 'PAID' : isDisc ? 'DISCONNECT' : 'CONNECTED')}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                        <span className={`px-1.5 py-0.5 rounded border ${
                          cl === 'DOMESTIC' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                          cl === 'COMMERCIAL' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                          cl === 'INDUSTRIAL' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                          'bg-slate-100 text-slate-800 border-slate-200'
                        }`}>
                          {cl}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                          {ph === '1PH' ? '1-Phase' : '3-Phase'}
                        </span>
                        {dueAmt > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 font-mono border border-rose-200">
                            Due: {formatCurrency(dueAmt)}
                          </span>
                        )}
                        {paidAmt > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono border border-emerald-200">
                            Paid: {formatCurrency(paidAmt)}
                          </span>
                        )}
                      </div>

                      {(task.meterNo || (task as any)['Meter No'] || task.consumerAddress || task.address) && (
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                          {task.meterNo || (task as any)['Meter No'] ? `Mtr: ${task.meterNo || (task as any)['Meter No']} • ` : ''}
                          {task.consumerAddress || task.address || (task as any)['Address'] || ''}
                        </p>
                      )}

                      {(task.workerRemarks || task.notes || (task as any)['Notes']) && (
                        <div className="text-[10px] font-semibold text-slate-600 bg-amber-50/70 border border-amber-200/80 rounded-lg p-1.5 line-clamp-2">
                          <span className="text-amber-800 font-bold">আপডেট: </span>
                          {task.workerRemarks || task.notes || (task as any)['Notes']}
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {task.updatedAt || task.lastUpdated ? String(task.updatedAt || task.lastUpdated).slice(0, 16) : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (onNavigateToDisconnection) onNavigateToDisconnection();
                            else onSelectCategory('DISCONNECTION');
                          }}
                          className="text-[10px] font-black text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                        >
                          <span>{currentLanguage === 'bn' ? 'মডিউলে দেখুন' : 'View in Module'}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs mb-6 space-y-5">
      {/* Dashboard Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-extrabold text-blue-700 tracking-tight uppercase">
                {t.performanceDashboard}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                LIVE
              </span>
            </div>
            <p className="text-xs text-slate-500">
              WBSEDCL 5 Work Category Real-Time Operational Performance
            </p>
          </div>
        </div>

        {/* Top summary badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => onSelectCategory('DISCONNECTION')}
            className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl font-black flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            title="Open Disconnection Consumer List"
          >
            <Scissors className="w-3.5 h-3.5 text-rose-200" />
            <span>
              {currentLanguage === 'bn'
                ? `মোট ডিসকানেকশন লিস্ট: ${totalDisconnectionListCount}`
                : `Total Disconnection List: ${totalDisconnectionListCount}`}
            </span>
          </button>
          <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 shadow-xs">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>{totalEntries} Total Entries</span>
          </div>
        </div>
      </div>

      {/* 5 Work Category Visual Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {categoryStats.map((item, idx) => {
          const Icon = item.icon;
          const percentage = totalEntries > 0 ? Math.round((item.count / totalEntries) * 100) : 0;

          return (
            <button
              key={`${item.id}-${idx}`}
              type="button"
              onClick={() => onSelectCategory(item.id)}
              className={`text-left p-3 rounded-xl border ${item.borderAccent} ${item.bgLight} hover:shadow-md transition-all cursor-pointer group relative overflow-hidden`}
              title={`Open ${item.name} form`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-white/90 shadow-2xs flex items-center justify-center">
                  <Icon className={`w-4 h-4 ${item.textAccent}`} />
                </div>
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border ${item.badgeBg}`}>
                  {item.id === 'DISCONNECTION'
                    ? (currentLanguage === 'bn' ? `মোট লিস্ট: ${item.count}` : `Total List: ${item.count}`)
                    : `${percentage}%`}
                </span>
              </div>

              <div className="mt-1">
                <p className="text-[11px] font-bold text-slate-700 truncate">{item.name}</p>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className={`text-lg font-black ${item.textAccent}`}>{item.count}</span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {item.id === 'DISCONNECTION'
                      ? (currentLanguage === 'bn' ? 'টি ডিসকানেকশন লিস্ট' : 'total list')
                      : 'records'}
                  </span>
                </div>
              </div>

              {/* Mini progress track */}
              <div className="w-full bg-slate-200/80 rounded-full h-1.5 mt-2 overflow-hidden">
                <div 
                  className={`h-full ${item.barColor} rounded-full transition-all duration-500`}
                  style={{ width: `${Math.max(percentage, totalEntries === 0 ? 0 : 5)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* ACTIVE DISCONNECTION PERFORMANCE DECK BOARD (Click Paid, Disconnected, etc. to view consumer data) */}
      <div className="bg-slate-50/90 border border-rose-200/90 rounded-2xl p-3.5 sm:p-4 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-rose-200/60 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-rose-600 text-white shadow-2xs">
              <Scissors className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">
                  {currentLanguage === 'bn'
                    ? '⚡ ডিসকানেকশন পারফরম্যান্স ডেক বোর্ড (ক্লিক করে কনজিউমার ডাটা দেখুন)'
                    : '⚡ Disconnection Performance Deck Board (Click status to view consumer data)'}
                </h3>
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                  {currentLanguage === 'bn'
                    ? `মোট লিস্ট: ${discMetrics.total} টি`
                    : `Total List: ${discMetrics.total}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto relative">
            <button
              type="button"
              onClick={() => onSelectCategory('DISCONNECTION')}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <span>{currentLanguage === 'bn' ? 'ডিসকানেকশন মডিউল খুলুন' : 'Open Disconnection Module'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            {/* Three-Dot Menu for All / Phase / Class */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowThreeDotFilter(prev => !prev)}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                  phaseFilter !== 'ALL' || classFilter !== 'ALL'
                    ? 'bg-slate-900 text-amber-400 border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title="Filter Options (All / Phase / Class)"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showThreeDotFilter && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowThreeDotFilter(false)} />
                  <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl border border-slate-200 shadow-xl p-3 z-40 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-700">Filter Options</span>
                      {(phaseFilter !== 'ALL' || classFilter !== 'ALL') && (
                        <button
                          type="button"
                          onClick={() => {
                            setPhaseFilter('ALL');
                            setClassFilter('ALL');
                            setShowThreeDotFilter(false);
                          }}
                          className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          Reset All
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Phase</span>
                      <div className="grid grid-cols-3 gap-1">
                        {([
                          { id: 'ALL', label: 'All' },
                          { id: '1PH', label: '1 PH' },
                          { id: '3PH', label: '3 PH' },
                        ] as { id: PhaseFilterType; label: string }[]).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPhaseFilter(p.id)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer ${
                              phaseFilter === p.id
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Class</span>
                      <div className="grid grid-cols-2 gap-1">
                        {([
                          { id: 'ALL', label: 'All Class' },
                          { id: 'DOMESTIC', label: 'Domestic' },
                          { id: 'COMMERCIAL', label: 'Commercial' },
                          { id: 'INDUSTRIAL', label: 'Industrial' },
                          { id: 'STW', label: 'STW' },
                        ] as { id: ClassFilterType; label: string }[]).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setClassFilter(c.id)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer ${
                              classFilter === c.id
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {c.label}
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

        {/* Clickable Disconnection Status Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <button
            type="button"
            onClick={() => handleToggleDiscDeck('ALL')}
            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
              selectedDiscStatus === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-400 shadow-sm'
                : 'bg-white text-slate-900 border-slate-200 hover:border-slate-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase ${selectedDiscStatus === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>
                {currentLanguage === 'bn' ? 'মোট লিস্ট' : 'Total List'}
              </span>
              <Users className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-xl font-black mt-1">{discMetrics.total}</div>
            <div className={`text-[10px] font-bold mt-0.5 ${selectedDiscStatus === 'ALL' ? 'text-amber-300' : 'text-blue-600'}`}>
              {currentLanguage === 'bn' ? 'ক্লিক করে দেখুন →' : 'Click to view →'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleToggleDiscDeck('Paid')}
            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
              selectedDiscStatus === 'Paid'
                ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-300 shadow-sm'
                : 'bg-blue-50/70 text-blue-950 border-blue-200 hover:border-blue-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase ${selectedDiscStatus === 'Paid' ? 'text-blue-100' : 'text-blue-700'}`}>
                Paid (পরিশোধিত)
              </span>
              <CreditCard className={`w-3.5 h-3.5 ${selectedDiscStatus === 'Paid' ? 'text-white' : 'text-blue-600'}`} />
            </div>
            <div className="text-xl font-black mt-1">{discMetrics.paid}</div>
            <div className={`text-[10px] font-bold mt-0.5 ${selectedDiscStatus === 'Paid' ? 'text-white' : 'text-blue-700'}`}>
              {currentLanguage === 'bn' ? 'Paid ডাটা দেখুন →' : 'View Paid Data →'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleToggleDiscDeck('Disconnected')}
            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
              selectedDiscStatus === 'Disconnected'
                ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-300 shadow-sm'
                : 'bg-rose-50/70 text-rose-950 border-rose-200 hover:border-rose-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase ${selectedDiscStatus === 'Disconnected' ? 'text-rose-100' : 'text-rose-700'}`}>
                Disconnected
              </span>
              <Power className={`w-3.5 h-3.5 ${selectedDiscStatus === 'Disconnected' ? 'text-white' : 'text-rose-600'}`} />
            </div>
            <div className="text-xl font-black mt-1">{discMetrics.disconnected}</div>
            <div className={`text-[10px] font-bold mt-0.5 ${selectedDiscStatus === 'Disconnected' ? 'text-white' : 'text-rose-700'}`}>
              {currentLanguage === 'bn' ? 'Disconnected ডাটা →' : 'View Disconnected →'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleToggleDiscDeck('Connected')}
            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
              selectedDiscStatus === 'Connected'
                ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-300 shadow-sm'
                : 'bg-emerald-50/70 text-emerald-950 border-emerald-200 hover:border-emerald-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase ${selectedDiscStatus === 'Connected' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                Connected / Pending
              </span>
              <Clock className={`w-3.5 h-3.5 ${selectedDiscStatus === 'Connected' ? 'text-white' : 'text-emerald-600'}`} />
            </div>
            <div className="text-xl font-black mt-1">{discMetrics.connected}</div>
            <div className={`text-[10px] font-bold mt-0.5 ${selectedDiscStatus === 'Connected' ? 'text-white' : 'text-emerald-700'}`}>
              {currentLanguage === 'bn' ? 'Pending ডাটা →' : 'View Pending →'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleToggleDiscDeck('Not Found')}
            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
              selectedDiscStatus === 'Not Found'
                ? 'bg-purple-600 text-white border-purple-600 ring-2 ring-purple-300 shadow-sm'
                : 'bg-purple-50/70 text-purple-950 border-purple-200 hover:border-purple-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase ${selectedDiscStatus === 'Not Found' ? 'text-purple-100' : 'text-purple-700'}`}>
                Not Found
              </span>
              <HelpCircle className={`w-3.5 h-3.5 ${selectedDiscStatus === 'Not Found' ? 'text-white' : 'text-purple-600'}`} />
            </div>
            <div className="text-xl font-black mt-1">{discMetrics.notFound}</div>
            <div className={`text-[10px] font-bold mt-0.5 ${selectedDiscStatus === 'Not Found' ? 'text-white' : 'text-purple-700'}`}>
              {currentLanguage === 'bn' ? 'Not Found ডাটা →' : 'View Not Found →'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleToggleDiscDeck('Dispute')}
            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
              selectedDiscStatus === 'Dispute'
                ? 'bg-orange-600 text-white border-orange-600 ring-2 ring-orange-300 shadow-sm'
                : 'bg-orange-50/70 text-orange-950 border-orange-200 hover:border-orange-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase ${selectedDiscStatus === 'Dispute' ? 'text-orange-100' : 'text-orange-700'}`}>
                Dispute
              </span>
              <AlertCircle className={`w-3.5 h-3.5 ${selectedDiscStatus === 'Dispute' ? 'text-white' : 'text-orange-600'}`} />
            </div>
            <div className="text-xl font-black mt-1">{discMetrics.dispute}</div>
            <div className={`text-[10px] font-bold mt-0.5 ${selectedDiscStatus === 'Dispute' ? 'text-white' : 'text-orange-700'}`}>
              {currentLanguage === 'bn' ? 'Dispute ডাটা →' : 'View Dispute →'}
            </div>
          </button>
        </div>

        {/* Consumer Data Drawer when Paid / Disconnected / etc. is clicked */}
        {selectedDiscStatus && (
          <div className="bg-white border-2 border-blue-500 rounded-xl p-3.5 space-y-3 shadow-md animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-black uppercase">
                  {selectedDiscStatus === 'ALL' ? 'ALL CONSUMERS' : selectedDiscStatus}
                </span>
                <span className="text-xs font-extrabold text-slate-800">
                  {currentLanguage === 'bn'
                    ? `মোট ${activeDeckConsumers.length} জন কনজিউমারের ডাটা`
                    : `${activeDeckConsumers.length} Consumers Found`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={deckSearch}
                    onChange={(e) => setDeckSearch(e.target.value)}
                    placeholder={currentLanguage === 'bn' ? 'নাম বা আইডি খুঁজুন...' : 'Search consumer...'}
                    className="pl-7 pr-6 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                  {deckSearch && (
                    <button
                      type="button"
                      onClick={() => setDeckSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDiscStatus(null)}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                  title="Close list"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {activeDeckConsumers.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 font-semibold">
                {currentLanguage === 'bn'
                  ? 'এই স্ট্যাটাসে কোনো কনজিউমার ডাটা পাওয়া যায়নি।'
                  : 'No consumer records found in this status.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
                {activeDeckConsumers.slice(0, 90).map((c) => {
                  const ph = getTaskPhase(c);
                  const cl = getTaskConnectionClass(c);
                  return (
                    <div
                      key={c.id || c.consumerId}
                      onClick={() => onSelectCategory('DISCONNECTION')}
                      className="p-3 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50/70 hover:bg-white transition-all cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            ID: {c.consumerId}
                          </span>
                          <h4 className="text-xs font-extrabold text-slate-900 mt-1 line-clamp-1">
                            {c.consumerName || 'N/A'}
                          </h4>
                        </div>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-900 text-white shrink-0">
                          {c.disconStatus || 'Connected'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1 text-[10px] font-bold">
                        {c.meterNo && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-800 font-mono">
                            Mtr: {c.meterNo}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                          {ph === '1PH' ? '1-Phase' : '3-Phase'}
                        </span>
                        {c.arrearAmount && Number(c.arrearAmount) > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-mono">
                            ₹{c.arrearAmount}
                          </span>
                        )}
                      </div>

                      {(c.address || c.mobile) && (
                        <div className="text-[10px] text-slate-500 flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                          {c.address && (
                            <span className="truncate flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5 shrink-0" />
                              {c.address}
                            </span>
                          )}
                          {c.mobile && (
                            <span className="font-mono shrink-0 flex items-center gap-0.5">
                              <Phone className="w-2.5 h-2.5" />
                              {c.mobile}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Operational Key Performance Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500 font-semibold">Completed</p>
            <p className="font-bold text-slate-800">{completedEntries} ({completionRate}%)</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500 font-semibold">Active / Pending</p>
            <p className="font-bold text-slate-800">{pendingEntries}</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500 font-semibold">GPS Verified</p>
            <p className="font-bold text-slate-800">{withGps} records</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center gap-2.5">
          <Award className="w-4 h-4 text-purple-600 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500 font-semibold">Media Evidence</p>
            <p className="font-bold text-slate-800">{withMedia} uploads</p>
          </div>
        </div>
      </div>
    </div>
  );
};
