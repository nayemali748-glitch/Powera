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
  AlertTriangle,
  Copy,
  Check,
  Edit2,
  Save
} from 'lucide-react';
import { UserAccount } from '../types';
import { fetchUsers, createUserAccount, deleteUserAccount, updateUserStatus, updateUserAccount, DEFAULT_WBSEDCL_ACCOUNTS } from '../services/api';
import { normalizeUniversalText, normalizePassword } from '../utils/textNormalizer';
import { Language, translations } from '../utils/translations';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: Language;
  initialTab?: 'create' | 'list' | 'change-password';
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  lang = 'bn',
  initialTab = 'create'
}) => {
  const t = translations[lang] || translations.bn;
  // Load users from backend / localStorage
  const [users, setUsers] = useState<UserAccount[]>(DEFAULT_WBSEDCL_ACCOUNTS);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'list' | 'change-password'>(initialTab);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'worker' | 'admin' | 'hold'>('all');

  // Form State (Create User)
  const [role, setRole] = useState<'worker' | 'admin'>('worker');
  const [idNo, setIdNo] = useState(() => `LM-${Math.floor(1000 + Math.random() * 9000)}`);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('লাইনম্যান / Worker (WBSEDCL)');
  const [password, setPassword] = useState('1234');
  const [showPassword, setShowPassword] = useState(true);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // Change Password Tab State
  const [selectedChangeUserId, setSelectedChangeUserId] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('0000');
  const [showNewPasswordInput, setShowNewPasswordInput] = useState<boolean>(true);
  const [changePassSearch, setChangePassSearch] = useState<string>('');

  // Editing state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPasswordValue, setEditPasswordValue] = useState('');
  const [editNameValue, setEditNameValue] = useState('');
  const [editPhoneValue, setEditPhoneValue] = useState('');

  // Notifications & Copy state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdUserCard, setCreatedUserCard] = useState<{ idNo: string; password: string; name: string; role: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Fetch users when modal opens
  useEffect(() => {
    if (isOpen) {
      loadUsersList();
      setError(null);
      setSuccess(null);
      setCreatedUserCard(null);
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTab]);

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

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGenerateId = (prefix: 'LM' | 'ADM' | 'WRK') => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setIdNo(`${prefix}-${randomNum}`);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCreatedUserCard(null);

    const cleanId = normalizeUniversalText(idNo);
    const cleanName = (name.trim() || cleanId || 'কর্মী');
    const cleanPhone = normalizeUniversalText(phone).replace(/[^0-9]/g, '');
    const cleanPass = normalizePassword(password);

    if (!cleanId) {
      setError('User ID লিখুন (যেমন: LM-4085 বা ADM-102 বা কর্মীর মোবাইল নম্বর)');
      return;
    }

    if (!cleanPass) {
      setError('পাসওয়ার্ড লিখুন (কমপক্ষে ৪ সংখ্যা বা অক্ষর)');
      return;
    }

    const isExisting = users.some(u => u && u.idNo && normalizeUniversalText(u.idNo).toLowerCase() === cleanId.toLowerCase());

    setLoading(true);

    try {
      const savedUser = await createUserAccount({
        idNo: cleanId,
        password: cleanPass,
        name: cleanName,
        phone: cleanPhone || '',
        role,
        status: 'active',
        designation: designation || (role === 'admin' ? 'সহকারী প্রকৌশলী / Admin (WBSEDCL)' : 'লাইনম্যান / Worker (WBSEDCL)'),
        badgeNo: cleanId,
      });

      setUsers(prev => {
        const filtered = prev.filter(u => u && normalizeUniversalText(u.idNo)?.toLowerCase() !== cleanId.toLowerCase() && u.id !== savedUser.id);
        return [savedUser, ...filtered];
      });

      setCreatedUserCard({
        idNo: cleanId,
        password: cleanPass,
        name: cleanName,
        role: role === 'admin' ? 'এডমিন (Admin)' : 'ফিল্ড ওয়ার্কার (Worker)'
      });

      if (isExisting) {
        setSuccess(`User ID "${cleanId}" (${cleanName}) এর পাসওয়ার্ড ও তথ্য সফলভাবে আপডেট করা হয়েছে!`);
      } else {
        setSuccess(`নতুন ${role === 'admin' ? 'এডমিন' : 'ওয়ার্কার'} আইডি "${cleanId}" সফলভাবে তৈরি হয়েছে!`);
      }
      
      // Reset form for next user
      setName('');
      setPhone('');
      setPassword('1234');
      setIdNo(role === 'worker' ? `LM-${Math.floor(1000 + Math.random() * 9000)}` : `ADM-${Math.floor(100 + Math.random() * 900)}`);
    } catch (err: any) {
      setError(err.message || 'ইউজার তৈরি বা আপডেট করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (userAcc: UserAccount) => {
    setEditingUserId(userAcc.id || userAcc.idNo);
    setEditPasswordValue(userAcc.password || '');
    setEditNameValue(userAcc.name || '');
    setEditPhoneValue(userAcc.phone || '');
  };

  const handleSaveEdit = async (userAcc: UserAccount) => {
    const cleanPass = normalizePassword(editPasswordValue);
    if (!cleanPass) {
      alert('পাসওয়ার্ড খালি রাখা যাবে না');
      return;
    }

    setLoading(true);
    try {
      const updated = await updateUserAccount(userAcc.id || userAcc.idNo, {
        password: cleanPass,
        name: editNameValue.trim() || userAcc.name,
        phone: normalizeUniversalText(editPhoneValue).replace(/[^0-9]/g, '')
      });

      setUsers(prev => prev.map(u => (u.id === userAcc.id || u.idNo === userAcc.idNo) ? { ...u, ...updated } : u));
      setEditingUserId(null);
      setSuccess(`User ID "${userAcc.idNo}" এর তথ্য ও পাসওয়ার্ড আপডেট সফল হয়েছে!`);
    } catch (err: any) {
      setError(err.message || 'আপডেট করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const targetUser = users.find(u => (u.id === selectedChangeUserId || u.idNo === selectedChangeUserId));
    if (!targetUser) {
      setError('অনুগ্রহ করে একজন ইউজার সিলেক্ট করুন');
      return;
    }

    if (!newPasswordInput.trim()) {
      setError('নতুন পাসওয়ার্ড খালি রাখা যাবে না');
      return;
    }

    setLoading(true);
    try {
      const updated = await updateUserAccount(targetUser.id || targetUser.idNo, {
        password: newPasswordInput.trim()
      });

      setUsers(prev => prev.map(u => (u.id === targetUser.id || u.idNo === targetUser.idNo) ? { ...u, ...updated, password: newPasswordInput.trim() } : u));
      setSuccess(`User ID "${targetUser.idNo}" (${targetUser.name}) এর পাসওয়ার্ড সফলভাবে "${newPasswordInput.trim()}" পরিবর্তন করা হয়েছে!`);
      setCreatedUserCard({
        idNo: targetUser.idNo,
        password: newPasswordInput.trim(),
        name: targetUser.name,
        role: targetUser.role === 'admin' ? 'এডমিন (Admin)' : 'ফিল্ড ওয়ার্কার (Worker)'
      });
    } catch (err: any) {
      setError(err.message || 'পাসওয়ার্ড পরিবর্তন করতে সমস্যা হয়েছে');
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
    
    if (window.confirm(`আপনি কি "${userAcc.name}" (ID: ${userAcc.idNo}) একাউন্টটি ${actionText} করতে চান? ${nextStatus === 'hold' ? 'হোল্ড করলে এই আইডি দিয়ে লগইন করা যাবে না।' : 'একটিভ করলে সাথে সাথে লগইন করতে পারবে।'}`)) {
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

        setSuccess(`User ID "${userAcc.idNo}" স্ট্যাটাস পরিবর্তন হয়েছে: ${nextStatus === 'hold' ? 'ON HOLD (লগইন ব্লক)' : 'ACTIVE (সক্রিয়)'}`);
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

    if (window.confirm(`আপনি কি নিশ্চিত যে "${userAcc.name}" (ID: ${userAcc.idNo}) এর একাউন্ট ডিলিট করতে চান? এই আইডি ও পাসওয়ার্ড দিয়ে আর কখনো লগইন করা যাবে না।`)) {
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

        setSuccess(`User ID "${userAcc.idNo}" স্থায়ীভাবে মুছে ফেলা হয়েছে।`);
      } catch (err: any) {
        setError(err.message || 'Failed to delete user account');
      } finally {
        setLoading(false);
      }
    }
  };

  const filteredUsers = users.filter(u => {
    if (!u) return false;
    if (filterRole === 'worker' && u.role !== 'worker') return false;
    if (filterRole === 'admin' && u.role !== 'admin') return false;
    if (filterRole === 'hold' && u.status !== 'hold') return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const nameMatch = (u.name || '').toLowerCase().includes(q);
    const idMatch = (u.idNo || '').toString().toLowerCase().includes(q);
    const phoneMatch = (u.phone || '').includes(q);
    const desMatch = (u.designation || '').toLowerCase().includes(q);
    return nameMatch || idMatch || phoneMatch || desMatch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>User ID & Password Management</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                  WBSEDCL Admin
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                নতুন ইউজার আইডি ও পাসওয়ার্ড তৈরি, এডিট এবং একটিভ/হোল্ড নিয়ন্ত্রণ
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
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'create'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Create New User (নতুন আইডি তৈরি)</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('list');
              loadUsersList();
            }}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'list'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User List & Passwords ({users.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('change-password');
              loadUsersList();
              if (!selectedChangeUserId && users.length > 0) {
                setSelectedChangeUserId(users[0].id || users[0].idNo);
              }
            }}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'change-password'
                ? 'border-amber-600 text-amber-700 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-amber-700/80 hover:text-amber-900 bg-amber-50/60 rounded-t-lg'
            }`}
          >
            <KeyRound className="w-4 h-4 text-amber-600" />
            <span>Change Password (পাসওয়ার্ড পরিবর্তন)</span>
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
          {/* NEW CREATED USER CREDENTIALS CARD (COPYABLE) */}
          {/* ========================================================= */}
          {createdUserCard && (
            <div className="p-4 bg-emerald-50/80 border-2 border-emerald-500/50 rounded-2xl space-y-3 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                    Login Credentials Ready (লগইন তথ্য)
                  </span>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-200/60 text-emerald-800 rounded-md">
                  {createdUserCard.role}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block">USER ID</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">{createdUserCard.idNo}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdUserCard.idNo, 'new_id')}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    {copiedKey === 'new_id' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'new_id' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block">PASSWORD</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">{createdUserCard.password}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdUserCard.password, 'new_pass')}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    {copiedKey === 'new_pass' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'new_pass' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-emerald-800">
                  কর্মীর নাম: <strong>{createdUserCard.name}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const text = `WBSEDCL App Login:\nUser ID: ${createdUserCard.idNo}\nPassword: ${createdUserCard.password}\nName: ${createdUserCard.name}`;
                    copyToClipboard(text, 'all_cred');
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {copiedKey === 'all_cred' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'all_cred' ? 'সব তথ্য কপি হয়েছে' : 'সব তথ্য কপি করুন'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 1: CREATE USER FORM */}
          {/* ========================================================= */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  একাউন্ট টাইপ (Account Role) <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRole('worker');
                      setDesignation('লাইনম্যান / Worker (WBSEDCL)');
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
                      <p className="text-[11px] text-slate-500">কাজের এন্ট্রি, ফটো আপলোড</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRole('admin');
                      setDesignation('সহকারী প্রকৌশলী / Admin (WBSEDCL)');
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
                      <h4 className="text-xs font-bold text-slate-900">Admin / Supervisor</h4>
                      <p className="text-[11px] text-slate-500">অনুমোদন, রিপোর্ট, আইডি কন্ট্রোল</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* User ID Field with Quick Generators */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>User ID (ইউজার আইডি) <span className="text-red-500">*</span></span>
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-medium">Quick Auto ID:</span>
                    <button
                      type="button"
                      onClick={() => handleGenerateId('LM')}
                      className="px-1.5 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[10px] font-mono font-bold cursor-pointer"
                    >
                      LM-XXXX
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerateId('ADM')}
                      className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[10px] font-mono font-bold cursor-pointer"
                    >
                      ADM-XXX
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  required
                  value={idNo}
                  onChange={(e) => setIdNo(e.target.value)}
                  placeholder="যেমন: LM-4085, ADM-102, বা কর্মীর ফোন নম্বর"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>

              {/* Password Field with Quick Presets */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                    <span>পাসওয়ার্ড (Password) <span className="text-red-500">*</span></span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">Presets:</span>
                    {['1234', '1122', '8899'].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPassword(p)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer ${
                          password === p ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] text-blue-600 font-medium hover:underline ml-1"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="পাসওয়ার্ড লিখুন (যেমন: 1234)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono tracking-wider"
                  />
                </div>
              </div>

              {/* Name & Mobile Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    পূর্ণ নাম (Full Name)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="যেমন: অসিত কুমার দাস"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>মোবাইল নম্বর (Phone)</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="98300XXXXX"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Designation */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  পদবী (Designation)
                </label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="যেমন: লাইনম্যান (WBSEDCL) বা সহকারী প্রকৌশলী"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl text-white font-bold text-sm bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-md shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer mt-3"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>তৈরি হচ্ছে...</span>
                  </span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create User ID & Password (তৈরি করুন)</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ========================================================= */}
          {/* TAB 2: REGISTERED USERS LIST & EDIT */}
          {/* ========================================================= */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {/* Instructions Callout */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-[11px] text-amber-900 leading-relaxed">
                  <p><strong>নিরাপত্তা ও একাউন্ট পরিচালনা:</strong></p>
                  <p>• <strong>Edit Password:</strong> কর্মীর পাসওয়ার্ড ভুলে গেলে সরাসরি এখান থেকে পরিবর্তন করে দিন।</p>
                  <p>• <strong>Hold ID:</strong> সাময়িক ব্লক করুন; <strong>Delete ID:</strong> স্থায়ীভাবে মুছে দিন।</p>
                </div>
              </div>

              {/* Search & Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="নাম, ID নম্বর বা ফোন দিয়ে খুঁজুন..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setFilterRole('all')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      filterRole === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All ({users.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterRole('worker')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      filterRole === 'worker' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Worker ({users.filter(u => u.role === 'worker').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterRole('admin')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      filterRole === 'admin' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Admin ({users.filter(u => u.role === 'admin').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterRole('hold')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      filterRole === 'hold' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Hold ({users.filter(u => u.status === 'hold').length})
                  </button>

                  <button
                    type="button"
                    onClick={loadUsersList}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                    title="Reload users"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Users Cards List */}
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    কোনো ইউজার পাওয়া যায়নি।
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const isPrimaryAdmin = u.idNo === '8695716192' || u.idNo === 'admin';
                    const isHold = u.status === 'hold';
                    const isEditing = editingUserId === (u.id || u.idNo);

                    return (
                      <div
                        key={u.id || u.idNo}
                        className={`p-3.5 rounded-xl border flex flex-col gap-2.5 transition-all ${
                          isPrimaryAdmin
                            ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/30'
                            : isHold
                            ? 'bg-red-50/40 border-red-200 opacity-90'
                            : u.role === 'admin'
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
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
                                <span className="text-[11px] font-mono font-bold bg-slate-100 border border-slate-300 text-slate-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <span>ID: {u.idNo}</span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(u.idNo, `id_${u.idNo}`)}
                                    className="text-slate-400 hover:text-blue-600 cursor-pointer"
                                    title="Copy ID"
                                  >
                                    {copiedKey === `id_${u.idNo}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </span>

                                {/* Status Badge */}
                                {isHold ? (
                                  <span className="text-[9px] bg-red-100 text-red-700 font-bold border border-red-300 px-1.5 py-0.2 rounded flex items-center gap-1">
                                    <PauseCircle className="w-2.5 h-2.5" />
                                    <span>ON HOLD</span>
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 px-1.5 py-0.2 rounded flex items-center gap-1">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                    <span>ACTIVE</span>
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
                                {u.phone && (
                                  <>
                                    <span>•</span>
                                    <span>📞 {u.phone}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Password & Quick Actions */}
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            {/* Password Box */}
                            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg text-xs">
                              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                              <span className="font-mono font-bold text-slate-800">
                                {revealedPasswords[u.id || u.idNo] ? u.password : '••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setRevealedPasswords(prev => ({
                                  ...prev,
                                  [u.id || u.idNo]: !prev[u.id || u.idNo]
                                }))}
                                className="text-slate-400 hover:text-slate-700 ml-0.5"
                                title="Show / Hide Password"
                              >
                                {revealedPasswords[u.id || u.idNo] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(u.password, `pass_${u.idNo}`)}
                                className="text-slate-400 hover:text-blue-600 ml-0.5"
                                title="Copy Password"
                              >
                                {copiedKey === `pass_${u.idNo}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>

                            {/* Edit Password Button */}
                            {!isPrimaryAdmin && (
                              <button
                                type="button"
                                onClick={() => isEditing ? setEditingUserId(null) : handleStartEdit(u)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                title="Edit password or name"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{isEditing ? 'Cancel' : 'Edit'}</span>
                              </button>
                            )}

                            {/* Toggle Hold / Active */}
                            {!isPrimaryAdmin && (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(u)}
                                className={`p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                                  isHold
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                                }`}
                                title={isHold ? 'আইডি সক্রিয় করুন (Activate ID)' : 'আইডি স্থগিত করুন (Hold ID)'}
                              >
                                {isHold ? (
                                  <>
                                    <PlayCircle className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Active</span>
                                  </>
                                ) : (
                                  <>
                                    <PauseCircle className="w-3.5 h-3.5 text-amber-700" />
                                    <span className="hidden sm:inline">Hold</span>
                                  </>
                                )}
                              </button>
                            )}

                            {/* Delete ID */}
                            {!isPrimaryAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                title="Delete ID permanently"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline Edit Form */}
                        {isEditing && (
                          <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2.5 animate-in slide-in-from-top-1 duration-150">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>তথ্য ও পাসওয়ার্ড আপডেট ({u.idNo})</span>
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">নতুন পাসওয়ার্ড</label>
                                <input
                                  type="text"
                                  value={editPasswordValue}
                                  onChange={(e) => setEditPasswordValue(e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900"
                                  placeholder="New password"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">নাম</label>
                                <input
                                  type="text"
                                  value={editNameValue}
                                  onChange={(e) => setEditNameValue(e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                                  placeholder="Worker name"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">মোবাইল নম্বর</label>
                                <input
                                  type="tel"
                                  value={editPhoneValue}
                                  onChange={(e) => setEditPhoneValue(e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900"
                                  placeholder="Phone"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingUserId(null)}
                                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(u)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer shadow-xs"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>Save Changes</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: CHANGE PASSWORD (পাসওয়ার্ড পরিবর্তন) */}
          {/* ========================================================= */}
          {activeTab === 'change-password' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                <KeyRound className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>পাসওয়ার্ড পরিবর্তন প্যানেল:</strong> যেকোনো কর্মী বা এডমিন আইডির পাসওয়ার্ড তাৎক্ষণিকভাবে পরিবর্তন করুন। পরিবর্তন করার সাথে সাথে নতুন পাসওয়ার্ড দিয়ে সিস্টেমে লগইন করা যাবে।
                </div>
              </div>

              <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                {/* 1. Select User Account */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-600" />
                      <span>ইউজার নির্বাচন করুন (Select User ID) <span className="text-red-500">*</span></span>
                    </span>
                    <span className="text-[11px] text-slate-500">মোট ইউজার: {users.length}</span>
                  </label>

                  {/* Filter / Quick Search */}
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={changePassSearch}
                      onChange={(e) => setChangePassSearch(e.target.value)}
                      placeholder="নাম, User ID বা মোবাইল দিয়ে ইউজার খুঁজুন..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                    />
                  </div>

                  <select
                    value={selectedChangeUserId}
                    onChange={(e) => setSelectedChangeUserId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-mono"
                  >
                    <option value="">-- ইউজার নির্বাচন করুন (Select User) --</option>
                    {users
                      .filter(u => {
                        if (!changePassSearch.trim()) return true;
                        const q = changePassSearch.toLowerCase();
                        return (
                          (u.name || '').toLowerCase().includes(q) ||
                          (u.idNo || '').toLowerCase().includes(q) ||
                          (u.phone || '').includes(q) ||
                          (u.role || '').toLowerCase().includes(q)
                        );
                      })
                      .map((u) => (
                        <option key={u.id || u.idNo} value={u.id || u.idNo}>
                          {u.role === 'admin' ? '👑 [ADMIN]' : '👷 [WORKER]'} {u.name} (ID: {u.idNo}) {u.phone ? `- Tel: ${u.phone}` : ''} {u.status === 'hold' ? '⚠️ [ON HOLD]' : ''}
                        </option>
                      ))}
                  </select>
                </div>

                {/* 2. Selected User Overview Card */}
                {(() => {
                  const currentSelected = users.find(u => (u.id === selectedChangeUserId || u.idNo === selectedChangeUserId));
                  if (!currentSelected) return null;
                  return (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${currentSelected.role === 'admin' ? 'bg-slate-900 text-amber-400' : 'bg-blue-600 text-white'}`}>
                            {currentSelected.role === 'admin' ? <ShieldCheck className="w-4 h-4" /> : <HardHat className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">{currentSelected.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">User ID: <strong className="text-slate-800">{currentSelected.idNo}</strong></div>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${currentSelected.status === 'hold' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {currentSelected.status === 'hold' ? 'ON HOLD' : 'ACTIVE'}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
                        <span>বর্তমান পাসওয়ার্ড (Current Password):</span>
                        <div className="flex items-center gap-1.5 font-mono font-bold bg-white px-2.5 py-1 rounded border border-slate-200 text-slate-900">
                          <span>{revealedPasswords[currentSelected.idNo] ? currentSelected.password : '••••'}</span>
                          <button
                            type="button"
                            onClick={() => setRevealedPasswords(prev => ({ ...prev, [currentSelected.idNo]: !prev[currentSelected.idNo] }))}
                            className="text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            {revealedPasswords[currentSelected.idNo] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. New Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                      <span>নতুন পাসওয়ার্ড দিন (New Password) <span className="text-red-500">*</span></span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const randomPin = String(Math.floor(1000 + Math.random() * 9000));
                        setNewPasswordInput(randomPin);
                      }}
                      className="text-xs font-bold text-amber-700 hover:text-amber-800 cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      <span>Generate 4-Digit PIN</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showNewPasswordInput ? 'text' : 'password'}
                      required
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="নতুন পাসওয়ার্ড লিখুন (যেমন: 0000, 1234, ইত্যাদি)"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 font-mono tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPasswordInput(!showNewPasswordInput)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showNewPasswordInput ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Quick Presets Buttons */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    দ্রুত পাসওয়ার্ড নির্বাচন (Quick Preset PINs)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: '0000 (Worker)', val: '0000' },
                      { label: '1234 (Standard)', val: '1234' },
                      { label: '6293 (Admin)', val: '6293' },
                      { label: '8899 (Custom)', val: '8899' },
                    ].map(preset => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => setNewPasswordInput(preset.val)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer text-center ${
                          newPasswordInput === preset.val
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        {preset.val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={loading || !selectedChangeUserId || !newPasswordInput.trim()}
                  className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-md shadow-amber-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>আপডেট হচ্ছে...</span>
                    </span>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Update Password (পাসওয়ার্ড সংরক্ষণ করুন)</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 px-6">
          <span>
            Active: <strong>{users.filter(u => u.status !== 'hold').length}</strong> | On Hold: <strong>{users.filter(u => u.status === 'hold').length}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors cursor-pointer text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
