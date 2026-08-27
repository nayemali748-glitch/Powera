import React, { useState } from 'react';
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
  HelpCircle
} from 'lucide-react';
import { UserAccount } from '../types';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose
}) => {
  // Load users from localStorage
  const [users, setUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('power_registered_users');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // ignore
      }
    }
    return [];
  });

  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [search, setSearch] = useState('');

  // Form State
  const [role, setRole] = useState<'worker' | 'admin'>('worker');
  const [idNo, setIdNo] = useState(() => `LM-${Math.floor(1000 + Math.random() * 9000)}`);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('লাইনম্যান');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('আপনার প্রিয় ফিডার / সাবস্টেশন?');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const saveUsers = (updated: UserAccount[]) => {
    setUsers(updated);
    localStorage.setItem('power_registered_users', JSON.stringify(updated));
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanId = idNo.trim();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanPass = password.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanId) {
      setError('একটি Login ID No লিখুন (যেমন: LM-4085 বা ADM-102)');
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

    const newUser: UserAccount = {
      id: `${role}_${Date.now()}`,
      idNo: cleanId,
      password: cleanPass,
      name: cleanName,
      phone: cleanPhone || '01700-000000',
      role,
      designation: designation || (role === 'admin' ? 'সহকারী প্রকৌশলী' : 'লাইনম্যান'),
      badgeNo: cleanId,
      securityQuestion,
      securityAnswer: securityAnswer.trim() || 'Dhaka',
      createdAt: new Date().toISOString()
    };

    const updated = [newUser, ...users];
    saveUsers(updated);

    setSuccess(`নতুন ${role === 'admin' ? 'এডমিন' : 'ওয়ার্কার'} আইডি "${cleanId}" (পাসওয়ার্ড: ${cleanPass}) সফলভাবে তৈরি হয়েছে! কর্মী এখন এই আইডি ও পাসওয়ার্ড দিয়ে অ্যাপে লগইন করতে পারবেন।`);
    
    // Reset form
    setName('');
    setPhone('');
    setIdNo(role === 'worker' ? `LM-${Math.floor(1000 + Math.random() * 9000)}` : `ADM-${Math.floor(100 + Math.random() * 900)}`);
  };

  const handleDeleteUser = (id: string, userName: string) => {
    if (window.confirm(`আপনি কি নিশ্চিত যে "${userName}" এর একাউন্ট মুছে ফেলতে চান?`)) {
      const updated = users.filter(u => u.id !== id);
      saveUsers(updated);
      setSuccess(`"${userName}" এর একাউন্ট মুছে ফেলা হয়েছে।`);
    }
  };

  const filteredUsers = users.filter(u => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.idNo.toLowerCase().includes(q) || u.phone.includes(q) || u.designation.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>ওয়ার্কার ও এডমিন আইডি ম্যানেজমেন্ট</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Admin Only
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                এডমিন হিসেবে নতুন লাইনম্যান/কর্মীর জন্য আইডি ও পাসওয়ার্ড তৈরি ও নিয়ন্ত্রণ করুন
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
            <span>নতুন আইডি ও পাসওয়ার্ড তৈরি (Create)</span>
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'list'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>নিবন্ধিত আইডি তালিকা ({users.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-800 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {activeTab === 'create' ? (
            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* Role Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  কার জন্য আইডি তৈরি করবেন? (Account Type) <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRole('worker');
                      setDesignation('লাইনম্যান');
                      setIdNo(`LM-${Math.floor(1000 + Math.random() * 9000)}`);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                      role === 'worker'
                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <HardHat className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">ফিল্ড কর্মী / লাইনম্যান</p>
                      <p className="text-[10px] text-slate-500">ফর্ম পূরণ ও ডাটা এন্ট্রি করতে পারবে</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRole('admin');
                      setDesignation('সহকারী প্রকৌশলী');
                      setIdNo(`ADM-${Math.floor(100 + Math.random() * 900)}`);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                      role === 'admin'
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">এডমিন / প্রকৌশলী</p>
                      <p className="text-[10px] text-slate-500">সব ডাটা ও কর্মী নিয়ন্ত্রণ করতে পারবে</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* ID No & Designation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    লগইন আইডি নম্বর (Login ID No) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={idNo}
                    onChange={(e) => setIdNo(e.target.value)}
                    placeholder="যেমন: LM-4082, ADM-002"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">কর্মী এই আইডি নম্বর দিয়ে লগইন করবেন</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    পদবী (Designation) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {role === 'worker' ? (
                      <>
                        <option value="লাইনম্যান (Lineman)">লাইনম্যান (Lineman)</option>
                        <option value="সিনিয়র লাইনম্যান (Feeder-01)">সিনিয়র লাইনম্যান (Feeder-01)</option>
                        <option value="মিটার টেকনিশিয়ান">মিটার টেকনিশিয়ান</option>
                        <option value="সাবস্টেশন অপারেটর">সাবস্টেশন অপারেটর</option>
                        <option value="ফিল্ড টেকনিশিয়ান">ফিল্ড টেকনিশিয়ান</option>
                        <option value="হেল্পার / সহকারী">হেল্পার / সহকারী</option>
                      </>
                    ) : (
                      <>
                        <option value="নির্বাহী প্রকৌশলী (XEN)">নির্বাহী প্রকৌশলী (XEN)</option>
                        <option value="সহকারী প্রকৌশলী (AE)">সহকারী প্রকৌশলী (AE)</option>
                        <option value="উপ-সহকারী প্রকৌশলী (SAE)">উপ-সহকারী প্রকৌশলী (SAE)</option>
                        <option value="এডমিন কন্ট্রোলার">এডমিন কন্ট্রোলার</option>
                        <option value="সাবস্টেশন ইনচার্জ">সাবস্টেশন ইনচার্জ</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    কর্মীর নাম (Worker Name) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="যেমন: মোঃ রফিকুল ইসলাম"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    মোবাইল নম্বর (Phone)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="017XX-XXXXXX"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Password & Confirm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>লগইন পাসওয়ার্ড <span className="text-red-500">*</span></span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[10px] text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? 'লুকান' : 'দেখান'}
                    </button>
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="পাসওয়ার্ড লিখুন"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    পাসওয়ার্ড নিশ্চিত করুন <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="পুনরায় পাসওয়ার্ড দিন"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>আইডি ও পাসওয়ার্ড তৈরি করুন (Create Account)</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="নাম, আইডি বা পদবী দিয়ে খুঁজুন..."
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Users List */}
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {filteredUsers.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    কোনো ইউজার পাওয়া যায়নি
                  </div>
                ) : (
                  filteredUsers.map((u) => (
                    <div key={u.id} className="p-3.5 bg-white hover:bg-slate-50/80 flex items-center justify-between gap-3 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          u.role === 'admin' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {u.role === 'admin' ? <ShieldCheck className="w-4 h-4" /> : <HardHat className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-slate-900">{u.name}</span>
                            <span className="text-[10px] font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-bold text-slate-700">
                              ID: {u.idNo}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              u.role === 'admin' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                            }`}>
                              {u.role === 'admin' ? 'এডমিন' : 'কর্মী'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{u.designation}</span>
                            {u.phone && <span>• {u.phone}</span>}
                            <span className="text-slate-400 font-mono">| Pass: ••••</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="ইউজার ডিলিট করুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            বন্ধ করুন (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
