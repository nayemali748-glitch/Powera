import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  X, 
  ShieldCheck, 
  HardHat, 
  User, 
  Phone, 
  KeyRound, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle,
  Users,
  Trash2,
  Lock,
  Search,
  Sparkles,
  HelpCircle,
  ShieldAlert,
  Building2,
  RefreshCw,
  PauseCircle,
  PlayCircle,
  ShieldX,
  AlertTriangle
} from 'lucide-react';
import { UserAccount } from '../types';
import { fetchUsers, createUserAccount, deleteUserAccount, updateUserStatus, DEFAULT_WBSEDCL_ACCOUNTS } from '../services/api';
import { Language, translations } from '../utils/translations';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: Language;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  lang = 'bn'
}) => {
  const t = translations[lang] || translations.bn;
  // Load users from backend / localStorage
  const [users, setUsers] = useState<UserAccount[]>(DEFAULT_WBSEDCL_ACCOUNTS);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [search, setSearch] = useState('');

  // Form State
  const [role, setRole] = useState<'worker' | 'admin'>('worker');
  const [idNo, setIdNo] = useState(() => `LM-${Math.floor(1000 + Math.random() * 9000)}`);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('লাইনম্যান (WBSEDCL)');
  const [password, setPassword] = useState('1234');
  const [confirmPassword, setConfirmPassword] = useState('1234');
  const [securityQuestion, setSecurityQuestion] = useState('আপনার প্রিয় ফিডার / সাবস্টেশন?');
  const [securityAnswer, setSecurityAnswer] = useState('Vidyut Bhavan');
  const [showPassword, setShowPassword] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch users when modal opens
  useEffect(() => {
    if (isOpen) {
      loadUsersList();
    }
  }, [isOpen]);

  const loadUsersList = async () => {
    setLoading(true);
    try {
      const data = await fetchUsers();
      if (data && data.length > 0) {
        setUsers(data);
      }
    } catch (e) {
      console.warn('Failed to fetch users:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanId = idNo.trim();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanPass = password.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanId) {
      setError('একটি User ID লিখুন (যেমন: LM-4085 বা ADM-102)');
      return;
    }

    if (!cleanName) {
      setError('কর্মীর পূর্ণ নাম লিখুন');
      return;
    }

    if (!cleanPass || cleanPass.length < 4) {
      setError('পাসওয়ার্ড কমপক্ষে ৪ ডিজিট বা অক্ষরের হতে হবে');
      return;
    }

    if (cleanPass !== cleanConfirm) {
      setError('কনফার্ম পাসওয়ার্ড মিলছে না!');
      return;
    }

    // Check duplicate
    if (users.some(u => u.idNo.toLowerCase() === cleanId.toLowerCase())) {
      setError(`"${cleanId}" আইডি নম্বরটি ইতিমধ্যে নিবন্ধিত রয়েছে! ভিন্ন আইডি দিন।`);
      return;
    }

    setLoading(true);

    try {
      const newUser = await createUserAccount({
        idNo: cleanId,
        password: cleanPass,
        name: cleanName,
        phone: cleanPhone || '9830000000',
        role,
        status: 'active',
        designation: designation || (role === 'admin' ? 'সহকারী প্রকৌশলী (WBSEDCL)' : 'লাইনম্যান (WBSEDCL)'),
        badgeNo: cleanId,
        securityQuestion,
        securityAnswer: securityAnswer.trim() || 'Vidyut Bhavan',
      });

      setUsers(prev => [newUser, ...prev]);
      setSuccess(`নতুন ${role === 'admin' ? 'এডমিন' : 'ওয়ার্কার'} আইডি "${cleanId}" সফলভাবে তৈরি ও সংরক্ষিত হয়েছে! কর্মী এখন যেকোনো ডিভাইস থেকে এই আইডি দিয়ে লগইন করতে পারবেন।`);
      
      // Reset form
      setName('');
      setPhone('');
      setPassword('1234');
      setConfirmPassword('1234');
      setIdNo(role === 'worker' ? `LM-${Math.floor(1000 + Math.random() * 9000)}` : `ADM-${Math.floor(100 + Math.random() * 900)}`);
    } catch (err: any) {
      setError(err.message || 'ইউজার তৈরি ব্যর্থ হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (userAcc: UserAccount) => {
    if (userAcc.idNo === '8695716192' || userAcc.idNo === 'admin') {
      alert('মুখ্য এডমিন আইডি (8695716192) হোল্ড করা যাবে না!');
      return;
    }

    const nextStatus: 'active' | 'hold' = userAcc.status === 'hold' ? 'active' : 'hold';
    const actionText = nextStatus === 'hold' ? 'HOLD (লগইন স্থগিত)' : 'ACTIVE (লগইন সক্রিয়)';
    
    if (window.confirm(`Are you sure you want to set "${userAcc.name}" (ID: ${userAcc.idNo}) to ${actionText}? ${nextStatus === 'hold' ? 'This user will NOT be able to log in until activated.' : 'User will be able to log in immediately.'}`)) {
      setLoading(true);
      try {
        await updateUserStatus(userAcc.id || userAcc.idNo, nextStatus);
        setUsers(prev => prev.map(u => (u.id === userAcc.id || u.idNo === userAcc.idNo) ? { ...u, status: nextStatus } : u));
        
        // If holding current user, handle session
        if (nextStatus === 'hold') {
          const currentSession = localStorage.getItem('power_user_session');
          if (currentSession) {
            try {
              const parsed = JSON.parse(currentSession);
              if (parsed.idNo === userAcc.idNo) {
                localStorage.removeItem('power_user_session');
              }
            } catch {}
          }
        }

        setSuccess(`User ID "${userAcc.idNo}" is now ${nextStatus.toUpperCase()}! ${nextStatus === 'hold' ? 'Login is now blocked.' : 'Login is now active.'}`);
      } catch (err: any) {
        setError(err.message || 'Failed to update user status');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteUser = async (userAcc: UserAccount) => {
    if (userAcc.idNo === '8695716192' || userAcc.idNo === 'admin') {
      alert('মুখ্য এডমিন আইডি (8695716192) মুছে ফেলা যাবে না!');
      return;
    }

    if (window.confirm(`Are you sure you want to permanently DELETE account for "${userAcc.name}" (ID: ${userAcc.idNo})? This ID and Password will be completely deleted and will NEVER be able to log in.`)) {
      setLoading(true);
      try {
        await deleteUserAccount(userAcc.id || userAcc.idNo);
        setUsers(prev => prev.filter(u => u.id !== userAcc.id && u.idNo !== userAcc.idNo));
        
        // Invalidate active session if matching deleted user
        const currentSession = localStorage.getItem('power_user_session');
        if (currentSession) {
          try {
            const parsed = JSON.parse(currentSession);
            if (parsed.idNo === userAcc.idNo || parsed.id === userAcc.id) {
              localStorage.removeItem('power_user_session');
              localStorage.removeItem('power_worker_name');
            }
          } catch {}
        }

        setSuccess(`User ID "${userAcc.idNo}" has been DELETED permanently. Login credentials completely revoked.`);
      } catch (err: any) {
        setError(err.message || 'Failed to delete user account');
      } finally {
        setLoading(false);
      }
    }
  };

  const filteredUsers = users.filter(u => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.idNo.toLowerCase().includes(q) || u.phone.includes(q) || u.designation.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Worker & Admin ID Control</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  WBSEDCL Admin
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                আইডি তৈরি, ডিলিট, হোল্ড ও একটিভ কন্ট্রোল (Delete & Hold ID will not be able to log in)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'create'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Create New User ID</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('list');
              loadUsersList();
            }}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'list'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Registered ID List ({users.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* Notifications */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 font-semibold animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 font-semibold animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <div className="leading-relaxed">{success}</div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 1: CREATE USER */}
          {/* ========================================================= */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Account Role <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRole('worker');
                      setDesignation('Lineman (WBSEDCL)');
                      setIdNo(`LM-${Math.floor(1000 + Math.random() * 9000)}`);
                    }}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                      role === 'worker'
                        ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${role === 'worker' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      <HardHat className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Field Worker / Lineman</h4>
                      <p className="text-[11px] text-slate-500">Submit work logs, upload evidence</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRole('admin');
                      setDesignation('Assistant Engineer (WBSEDCL)');
                      setIdNo(`ADM-${Math.floor(100 + Math.random() * 900)}`);
                    }}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                      role === 'admin'
                        ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${role === 'admin' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Admin / Station In-Charge</h4>
                      <p className="text-[11px] text-slate-500">Approve, export, hold & manage IDs</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* ID No */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>User ID (Login Username) <span className="text-red-500">*</span></span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">User will log in using this ID</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={idNo}
                    onChange={(e) => setIdNo(e.target.value)}
                    placeholder="e.g. LM-4085 or ADM-102"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Asit Kumar Das"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>Mobile Number</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="98300XXXXX"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Designation */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Designation / Designation Title (WBSEDCL)
                </label>
                <select
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {role === 'admin' ? (
                    <>
                      <option value="Divisional Manager / XEN (WBSEDCL)">Divisional Manager / XEN (WBSEDCL)</option>
                      <option value="Assistant Engineer / AE (WBSEDCL)">Assistant Engineer / AE (WBSEDCL)</option>
                      <option value="Station Manager / SM (CCC)">Station Manager / SM (CCC)</option>
                      <option value="Junior Engineer / JE (WBSEDCL)">Junior Engineer / JE (WBSEDCL)</option>
                      <option value="Admin Controller">Admin Controller</option>
                    </>
                  ) : (
                    <>
                      <option value="Lineman (Lineman WBSEDCL)">Lineman (Lineman WBSEDCL)</option>
                      <option value="Senior Lineman (CCC)">Senior Lineman (CCC)</option>
                      <option value="Technical Assistant (TA)">Technical Assistant (TA)</option>
                      <option value="Meter Reader / Technician">Meter Reader / Technician</option>
                      <option value="Substation Operator">Substation Operator</option>
                    </>
                  )}
                </select>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                      <span>Login Password <span className="text-red-500">*</span></span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[10px] text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create User ID & Password</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ========================================================= */}
          {/* TAB 2: REGISTERED USERS LIST */}
          {/* ========================================================= */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {/* Security Instruction Callout */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>আইডি কন্ট্রোল নিরাপত্তা নির্দেশিকা:</strong>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    • <strong>হোল্ড (Hold):</strong> আইডি সাময়িক নিষ্ক্রিয় হবে, কর্মী লগইন করতে পারবেন না। প্রয়োজনে আবার একটিভ করা যাবে।
                    <br />
                    • <strong>ডিলিট (Delete):</strong> আইডি ও পাসওয়ার্ড স্থায়ীভাবে মুছে যাবে এবং কখনো লগইন করতে পারবে না।
                  </p>
                </div>
              </div>

              {/* Search & Refresh */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by Name, ID, or Designation..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadUsersList}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Users Cards */}
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No registered user ID found.
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const isPrimaryAdmin = u.idNo === '8695716192' || u.idNo === 'admin';
                    const isHold = u.status === 'hold';

                    return (
                      <div
                        key={u.id || u.idNo}
                        className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                          isPrimaryAdmin
                            ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/30'
                            : isHold
                            ? 'bg-red-50/40 border-red-200 opacity-90'
                            : u.role === 'admin'
                            ? 'bg-emerald-50/50 border-emerald-200'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isPrimaryAdmin
                              ? 'bg-amber-500 text-slate-950 font-black'
                              : isHold
                              ? 'bg-red-500 text-white'
                              : u.role === 'admin'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-blue-600 text-white'
                          }`}>
                            {isPrimaryAdmin ? 'HQ' : isHold ? 'HLD' : u.role === 'admin' ? 'ADM' : 'WRK'}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className={`text-xs font-bold ${isHold ? 'text-red-900 line-through' : 'text-slate-900'}`}>
                                {u.name}
                              </h4>
                              <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded">
                                ID: {u.idNo}
                              </span>

                              {/* Status Badge */}
                              {isHold ? (
                                <span className="text-[9px] bg-red-100 text-red-700 font-bold border border-red-300 px-1.5 py-0.2 rounded flex items-center gap-1">
                                  <PauseCircle className="w-2.5 h-2.5" />
                                  <span>ON HOLD / স্থগিত</span>
                                </span>
                              ) : (
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 px-1.5 py-0.2 rounded flex items-center gap-1">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                  <span>ACTIVE / সক্রিয়</span>
                                </span>
                              )}

                              {isPrimaryAdmin && (
                                <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.2 rounded">
                                  Primary Admin
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2 mt-1">
                              <span>{u.designation}</span>
                              <span>•</span>
                              <div className="flex items-center gap-1">
                                <span>Password:</span>
                                <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                                  {revealedPasswords[u.id || u.idNo] ? u.password : '••••••••'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setRevealedPasswords(prev => ({
                                    ...prev,
                                    [u.id || u.idNo]: !prev[u.id || u.idNo]
                                  }))}
                                  className="text-[10px] text-blue-600 hover:underline px-1"
                                >
                                  {revealedPasswords[u.id || u.idNo] ? 'Hide' : 'Show'}
                                </button>
                              </div>
                              {u.phone && (
                                <>
                                  <span>•</span>
                                  <span>📞 {u.phone}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons: Hold/Active & Delete */}
                        {!isPrimaryAdmin && (
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            {/* Toggle Hold / Active */}
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(u)}
                              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-xs ${
                                isHold
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                              }`}
                              title={isHold ? 'আইডি সক্রিয় করুন (Activate ID)' : 'আইডি স্থগিত করুন (Hold ID)'}
                            >
                              {isHold ? (
                                <>
                                  <PlayCircle className="w-3.5 h-3.5" />
                                  <span>Activate ID</span>
                                </>
                              ) : (
                                <>
                                  <PauseCircle className="w-3.5 h-3.5 text-amber-700" />
                                  <span>Hold ID</span>
                                </>
                              )}
                            </button>

                            {/* Delete ID */}
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="px-2.5 py-1.5 text-xs font-bold text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                              title="Delete User ID permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete ID</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 px-6">
          <span>
            Active IDs: <strong>{users.filter(u => u.status !== 'hold').length}</strong> | On Hold: <strong>{users.filter(u => u.status === 'hold').length}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg transition-colors cursor-pointer text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
