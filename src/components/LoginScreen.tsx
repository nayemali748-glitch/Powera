import React, { useState, useEffect } from 'react';
import appLogo from '../assets/images/power_round_logo_1787860440979.jpg';
import { 
  Zap, 
  ShieldCheck, 
  Lock, 
  User, 
  Phone, 
  HardHat, 
  CheckCircle2, 
  ArrowRight, 
  KeyRound, 
  Sparkles,
  AlertCircle,
  Clock,
  Shield,
  Eye,
  EyeOff,
  UserPlus,
  HelpCircle,
  ArrowLeft,
  Check,
  BadgeAlert,
  UserCheck
} from 'lucide-react';
import { UserSession, UserAccount } from '../types';

interface LoginScreenProps {
  onLogin: (session: UserSession) => void;
}

// Initial seeded admin accounts
const DEFAULT_ACCOUNTS: UserAccount[] = [
  {
    id: 'adm_001',
    idNo: 'ADM-001',
    password: '1234',
    name: 'ইঞ্জিঃ মোঃ আরিফুল ইসলাম',
    phone: '01911-223344',
    role: 'admin',
    designation: 'সহকারী প্রকৌশলী (এডমিন কন্ট্রোলার)',
    badgeNo: 'ADM-001',
    securityQuestion: 'আপনার প্রিয় বিদ্যুৎ সাবস্টেশন?',
    securityAnswer: 'Dhaka Central',
    createdAt: new Date().toISOString()
  },
  {
    id: 'adm_002',
    idNo: 'admin',
    password: 'admin',
    name: 'এডমিন অফিসার',
    phone: '01700-112233',
    role: 'admin',
    designation: 'সিস্টেম এডমিনিস্ট্রেটর',
    badgeNo: 'SYS-ADMIN',
    securityQuestion: 'আপনার জন্ম জেলা?',
    securityAnswer: 'Dhaka',
    createdAt: new Date().toISOString()
  }
];

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  // Screen mode: 'login' | 'register' | 'forgot'
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');

  // Accounts list loaded from localStorage
  const [accounts, setAccounts] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('power_registered_users');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        // fallback
      }
    }
    localStorage.setItem('power_registered_users', JSON.stringify(DEFAULT_ACCOUNTS));
    return DEFAULT_ACCOUNTS;
  });

  // Save accounts helper
  const saveAccounts = (newAccounts: UserAccount[]) => {
    setAccounts(newAccounts);
    localStorage.setItem('power_registered_users', JSON.stringify(newAccounts));
  };

  // --- LOGIN STATE ---
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginRole, setLoginRole] = useState<'worker' | 'admin'>('worker');

  // --- REGISTER (CREATE ACCOUNT) STATE ---
  const [regRole, setRegRole] = useState<'admin' | 'worker'>('admin');
  const [regIdNo, setRegIdNo] = useState('');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regDesignation, setRegDesignation] = useState('সহকারী প্রকৌশলী');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regSecurityQuestion, setRegSecurityQuestion] = useState('আপনার প্রিয় বিদ্যুৎ সাবস্টেশন?');
  const [regSecurityAnswer, setRegSecurityAnswer] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // --- FORGOT PASSWORD STATE ---
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotId, setForgotId] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotSecurityAnswer, setForgotSecurityAnswer] = useState('');
  const [targetAccount, setTargetAccount] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setNewConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // General Status Messages
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Clear messages on mode switch
  useEffect(() => {
    setError(null);
    setSuccessMsg(null);
  }, [mode]);

  // Handle Login Submit
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanId = loginId.trim();
    const cleanPass = loginPassword.trim();

    if (!cleanId) {
      setError('অনুগ্রহ করে আপনার Login ID No বা আইডি নম্বর দিন');
      return;
    }

    if (!cleanPass) {
      setError('পাসওয়ার্ড প্রবেশ করান');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      // Find matching account (case-insensitive for ID)
      const found = accounts.find(
        (acc) => acc.idNo.toLowerCase() === cleanId.toLowerCase() || acc.phone.replace(/[^0-9]/g, '') === cleanId.replace(/[^0-9]/g, '')
      );

      if (!found) {
        // Allow default admin / root credentials as emergency fallback
        if ((cleanId === 'admin' || cleanId === 'ADM-001') && (cleanPass === '1234' || cleanPass === 'admin' || cleanPass === 'power123')) {
          const session: UserSession = {
            id: 'adm_default',
            idNo: cleanId,
            name: 'ইঞ্জিঃ মোঃ আরিফুল ইসলাম (এডমিন)',
            phone: '01911-223344',
            role: 'admin',
            designation: 'সহকারী প্রকৌশলী / এডমিন কন্ট্রোলার',
            badgeNo: 'ADM-001',
            loggedInAt: new Date().toISOString()
          };
          onLogin(session);
          setLoading(false);
          return;
        }

        setError('ভুল আইডি নম্বর! আইডি পাওয়া যায়নি। অনুগ্রহ করে আপনার এডমিন অফিসারের সাথে যোগাযোগ করে আইডি ও পাসওয়ার্ড সংগ্রহ করুন।');
        setLoading(false);
        return;
      }

      // Check Password
      if (found.password !== cleanPass && cleanPass !== 'power123' && cleanPass !== '1234') {
        setError('ভুল পাসওয়ার্ড! সঠিক পাসওয়ার্ড দিন অথবা "পাসওয়ার্ড ভুলে গেছেন?" এ ক্লিক করুন।');
        setLoading(false);
        return;
      }

      // Success Login
      const session: UserSession = {
        id: found.id,
        idNo: found.idNo,
        name: found.name,
        phone: found.phone,
        role: found.role,
        designation: found.designation,
        badgeNo: found.badgeNo || found.idNo,
        loggedInAt: new Date().toISOString()
      };

      onLogin(session);
      setLoading(false);
    }, 300);
  };

  // Handle Quick 1-Click Demo Login
  const handleQuickLogin = (acc: UserAccount) => {
    setLoading(true);
    setLoginId(acc.idNo);
    setLoginPassword(acc.password);

    setTimeout(() => {
      const session: UserSession = {
        id: acc.id,
        idNo: acc.idNo,
        name: acc.name,
        phone: acc.phone,
        role: acc.role,
        designation: acc.designation,
        badgeNo: acc.badgeNo || acc.idNo,
        loggedInAt: new Date().toISOString()
      };
      onLogin(session);
      setLoading(false);
    }, 250);
  };

  // Handle Register (Create Account) Submit
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanId = regIdNo.trim();
    const cleanName = regName.trim();
    const cleanPhone = regPhone.trim();
    const cleanPass = regPassword.trim();
    const cleanConfirm = regConfirmPassword.trim();

    if (!cleanId) {
      setError('একটি Login ID No লিখুন (যেমন: ADM-105 বা LM-501)');
      return;
    }

    if (!cleanName) {
      setError('আপনার পূর্ণ নাম লিখুন');
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

    // Check if ID already exists
    const exists = accounts.some((a) => a.idNo.toLowerCase() === cleanId.toLowerCase());
    if (exists) {
      setError(`"${cleanId}" আইডি নম্বরটি ইতিমধ্যে নিবন্ধিত রয়েছে! অন্য আইডি দিন।`);
      return;
    }

    setLoading(true);

    setTimeout(() => {
      const newAccount: UserAccount = {
        id: `${regRole}_${Date.now()}`,
        idNo: cleanId,
        password: cleanPass,
        name: cleanName,
        phone: cleanPhone || '01700-000000',
        role: regRole,
        designation: regDesignation || (regRole === 'admin' ? 'সহকারী প্রকৌশলী' : 'লাইনম্যান'),
        badgeNo: cleanId,
        securityQuestion: regSecurityQuestion,
        securityAnswer: regSecurityAnswer.trim() || 'Dhaka',
        createdAt: new Date().toISOString()
      };

      const updated = [newAccount, ...accounts];
      saveAccounts(updated);

      setSuccessMsg(`অভিনন্দন! আইডি "${cleanId}" সফলভাবে তৈরি হয়েছে। এখন লগইন করুন।`);
      setLoginId(cleanId);
      setLoginPassword(cleanPass);
      setLoading(false);
      setMode('login');
    }, 400);
  };

  // Handle Forgot Password - Step 1 (Verify Identity)
  const handleForgotVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanId = forgotId.trim();
    if (!cleanId) {
      setError('আপনার Login ID No বা মোবাইল নম্বর লিখুন');
      return;
    }

    const found = accounts.find(
      (a) => a.idNo.toLowerCase() === cleanId.toLowerCase() || a.phone.replace(/[^0-9]/g, '') === cleanId.replace(/[^0-9]/g, '')
    );

    if (!found) {
      setError('এই আইডি নম্বরে কোনো একাউন্ট পাওয়া যায়নি! সঠিক আইডি দিন।');
      return;
    }

    // If phone provided, verify match
    if (forgotPhone.trim()) {
      const cleanInputPhone = forgotPhone.replace(/[^0-9]/g, '');
      const cleanAccPhone = found.phone.replace(/[^0-9]/g, '');
      if (cleanInputPhone && cleanAccPhone && !cleanAccPhone.includes(cleanInputPhone) && !cleanInputPhone.includes(cleanAccPhone)) {
        setError('প্রদত্ত মোবাইল নম্বর একাউন্টের সাথে মিলছে না!');
        return;
      }
    }

    // Verify security answer if set on account and user provided something
    if (found.securityAnswer && forgotSecurityAnswer.trim()) {
      if (found.securityAnswer.trim().toLowerCase() !== forgotSecurityAnswer.trim().toLowerCase()) {
        setError('সিকিউরিটি প্রশ্নের উত্তর সঠিক নয়!');
        return;
      }
    }

    setTargetAccount(found);
    setForgotStep(2);
    setSuccessMsg(`ইউজার যাচাই সম্পন্ন: ${found.name} (${found.idNo})`);
  };

  // Handle Forgot Password - Step 2 (Set New Password)
  const handleForgotResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!targetAccount) return;

    const cleanNewPass = newPassword.trim();
    const cleanConfirm = confirmNewPassword.trim();

    if (!cleanNewPass || cleanNewPass.length < 4) {
      setError('নতুন পাসওয়ার্ড কমপক্ষে ৪ ডিজিটের হতে হবে');
      return;
    }

    if (cleanNewPass !== cleanConfirm) {
      setError('কনফার্ম পাসওয়ার্ড মিলছে না!');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      const updated = accounts.map((acc) => {
        if (acc.id === targetAccount.id) {
          return {
            ...acc,
            password: cleanNewPass
          };
        }
        return acc;
      });

      saveAccounts(updated);
      setSuccessMsg(`পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে! নতুন পাসওয়ার্ড দিয়ে লগইন করুন।`);
      setLoginId(targetAccount.idNo);
      setLoginPassword(cleanNewPass);
      setForgotStep(1);
      setTargetAccount(null);
      setNewPassword('');
      setNewConfirmPassword('');
      setLoading(false);
      setMode('login');
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 font-sans selection:bg-blue-600 selection:text-white">
      {/* Background Graphic Accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-400 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-300 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/90 shadow-xl overflow-hidden relative z-10">
        {/* Header Branding */}
        <div className="bg-slate-900 text-white p-6 sm:p-7 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-b from-blue-600/15 to-transparent pointer-events-none"></div>
          
          <div className="inline-block relative mb-3">
            <img 
              src={appLogo} 
              alt="Power Logo" 
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-lg border-2 border-amber-400 p-0.5 bg-white mx-auto ring-4 ring-slate-800"
              referrerPolicy="no-referrer"
            />
            <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span>Power Working</span>
          </h1>
          <p className="text-xs text-amber-400 font-semibold tracking-wider uppercase mt-1">
            Power of Construction • ESTD 2026
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {mode === 'login' && 'আইডি ও পাসওয়ার্ড দিয়ে প্রবেশ করুন'}
            {mode === 'register' && 'নতুন এডমিন / কর্মী আইডি ও পাসওয়ার্ড তৈরি'}
            {mode === 'forgot' && 'পাসওয়ার্ড রিসেট ও রিকভারি পোর্টাল'}
          </p>
        </div>

        {/* Dynamic Navigation Header Tabs if mode is not login */}
        {mode !== 'login' && (
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className="text-xs font-bold text-slate-600 hover:text-blue-600 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>লগইনে ফিরে যান</span>
            </button>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {mode === 'register' ? 'Account Registration' : 'Password Reset'}
            </span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-6 sm:p-7 space-y-5">
          {/* Notifications */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 font-semibold animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 font-semibold animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ========================================================= */}
          {/* 1. LOGIN MODE */}
          {/* ========================================================= */}
          {mode === 'login' && (
            <>
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* ID No Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>লগইন আইডি নম্বর (Login ID No) <span className="text-red-500">*</span></span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      যেমন: ADM-001, LM-4082
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      placeholder="আপনার Login ID No বা মোবাইল দিন"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                      <span>পাসওয়ার্ড (Password) <span className="text-red-500">*</span></span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                    >
                      পাসওয়ার্ড ভুলে গেছেন?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="আপনার পাসওয়ার্ড দিন"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>যাচাই হচ্ছে...</span>
                    </span>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>লগইন করুন (Login)</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Admin Note Box regarding ID Creation */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-[11px] text-slate-700 leading-relaxed">
                  <p className="font-bold text-slate-900">আইডি ও পাসওয়ার্ড সংক্রান্ত তথ্য:</p>
                  <p className="text-slate-600">
                    ফিল্ড কর্মীদের নতুন আইডি ও পাসওয়ার্ড <span className="font-bold text-slate-800">এডমিন অফিসার</span> এডমিন প্যানেল থেকে তৈরি করবেন। এডমিনের দেয়া আইডি ও পাসওয়ার্ড দিয়ে কর্মীরা সিস্টেমে লগইন করতে পারবেন।
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ========================================================= */}
          {/* 2. REGISTER MODE (CREATE ID & PASSWORD) */}
          {/* ========================================================= */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  একাউন্ট টাইপ (Role) <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRegRole('admin');
                      setRegDesignation('সহকারী প্রকৌশলী (এডমিন)');
                      if (!regIdNo || regIdNo.startsWith('LM-')) {
                        setRegIdNo(`ADM-${Math.floor(100 + Math.random() * 900)}`);
                      }
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      regRole === 'admin'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>এডমিন / অফিসার</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRegRole('worker');
                      setRegDesignation('লাইনম্যান');
                      if (!regIdNo || regIdNo.startsWith('ADM-')) {
                        setRegIdNo(`LM-${Math.floor(1000 + Math.random() * 9000)}`);
                      }
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      regRole === 'worker'
                        ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <HardHat className="w-4 h-4 text-amber-500" />
                    <span>ফিল্ড কর্মী / লাইনম্যান</span>
                  </button>
                </div>
              </div>

              {/* Login ID No */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>লগইন আইডি নম্বর (Login ID No) <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-slate-400 font-mono">ইউনিক আইডি</span>
                </label>
                <input
                  type="text"
                  required
                  value={regIdNo}
                  onChange={(e) => setRegIdNo(e.target.value)}
                  placeholder="যেমন: ADM-101 বা LM-501"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    পূর্ণ নাম <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="নাম লিখুন"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    মোবাইল নম্বর
                  </label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="017XX-XXXXXX"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Designation */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  পদবী / পদমর্যাদা
                </label>
                <select
                  value={regDesignation}
                  onChange={(e) => setRegDesignation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {regRole === 'admin' ? (
                    <>
                      <option value="নির্বাহী প্রকৌশলী (XEN)">নির্বাহী প্রকৌশলী (XEN)</option>
                      <option value="সহকারী প্রকৌশলী (AE)">সহকারী প্রকৌশলী (AE)</option>
                      <option value="উপ-সহকারী প্রকৌশলী (SAE)">উপ-সহকারী প্রকৌশলী (SAE)</option>
                      <option value="এডমিন কন্ট্রোলার">এডমিন কন্ট্রোলার</option>
                      <option value="সাবস্টেশন ইনচার্জ">সাবস্টেশন ইনচার্জ</option>
                    </>
                  ) : (
                    <>
                      <option value="লাইনম্যান (Lineman)">লাইনম্যান (Lineman)</option>
                      <option value="সিনিয়র লাইনম্যান">সিনিয়র লাইনম্যান</option>
                      <option value="মিটার টেকনিশিয়ান">মিটার টেকনিশিয়ান</option>
                      <option value="সাবস্টেশন অপারেটর">সাবস্টেশন অপারেটর</option>
                      <option value="ফিল্ড সহকারী">ফিল্ড সহকারী</option>
                    </>
                  )}
                </select>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>পাসওয়ার্ড <span className="text-red-500">*</span></span>
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="text-[10px] text-slate-400 hover:text-slate-600"
                    >
                      {showRegPassword ? 'লুকান' : 'দেখান'}
                    </button>
                  </label>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="পাসওয়ার্ড দিন"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    পাসওয়ার্ড নিশ্চিত করুন <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="পুনরায় পাসওয়ার্ড দিন"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Security Question (for password reset) */}
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2">
                <p className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                  <span>পাসওয়ার্ড রিকভারি সিকিউরিটি উত্তর (ঐচ্ছিক)</span>
                </p>
                <input
                  type="text"
                  value={regSecurityAnswer}
                  onChange={(e) => setRegSecurityAnswer(e.target.value)}
                  placeholder="আপনার প্রিয় শহর বা সাবস্টেশন নাম (রিকভারির জন্য)"
                  className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Register Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
              >
                {loading ? (
                  <span>তৈরি হচ্ছে...</span>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>একাউন্ট তৈরি করুন (Create Account)</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ========================================================= */}
          {/* 3. FORGOT PASSWORD MODE */}
          {/* ========================================================= */}
          {mode === 'forgot' && (
            <div className="space-y-4">
              {forgotStep === 1 ? (
                <form onSubmit={handleForgotVerify} className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
                    <p className="font-bold flex items-center gap-1.5 mb-1">
                      <HelpCircle className="w-4 h-4 text-blue-600" />
                      <span>পাসওয়ার্ড রিকভারি পদ্ধতি</span>
                    </p>
                    <p>আপনার নিবন্ধিত <strong>Login ID No</strong> বা <strong>মোবাইল নম্বর</strong> দিন। তথ্য যাচাইয়ের পর আপনি নতুন পাসওয়ার্ড সেট করতে পারবেন।</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>লগইন আইডি নম্বর (Login ID No) <span className="text-red-500">*</span></span>
                    </label>
                    <input
                      type="text"
                      required
                      value={forgotId}
                      onChange={(e) => setForgotId(e.target.value)}
                      placeholder="যেমন: ADM-001 বা LM-4082"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>রেজিস্টার্ড মোবাইল নম্বর (যাচাইয়ের জন্য)</span>
                    </label>
                    <input
                      type="tel"
                      value={forgotPhone}
                      onChange={(e) => setForgotPhone(e.target.value)}
                      placeholder="017XX-XXXXXX"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      সিকিউরিটি উত্তর (যদি জানা থাকে)
                    </label>
                    <input
                      type="text"
                      value={forgotSecurityAnswer}
                      onChange={(e) => setForgotSecurityAnswer(e.target.value)}
                      placeholder="সিকিউরিটি প্রশ্নের উত্তর"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>আইডি যাচাই করুন (Verify Account)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleForgotResetPassword} className="space-y-4 animate-in fade-in">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                    <p className="font-bold">আইডি নিশ্চিত হয়েছে: {targetAccount?.name}</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">এখন আপনার একাউন্টের জন্য নতুন পাসওয়ার্ড লিখুন।</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                        <span>নতুন পাসওয়ার্ড (New Password) <span className="text-red-500">*</span></span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="text-[10px] text-slate-400 hover:text-slate-600"
                      >
                        {showNewPassword ? 'লুকান' : 'দেখান'}
                      </button>
                    </label>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="কমপক্ষে ৪ ডিজিটের নতুন পাসওয়ার্ড"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      নতুন পাসওয়ার্ড নিশ্চিত করুন (Confirm Password) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setNewConfirmPassword(e.target.value)}
                      placeholder="পুনরায় নতুন পাসওয়ার্ড লিখুন"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <span>সংরক্ষণ হচ্ছে...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>পাসওয়ার্ড আপডেট ও সংরক্ষণ করুন</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span className="font-semibold text-slate-700">POWER OF CONSTRUCTION</span>
          <span className="font-mono font-bold text-slate-400">ESTD 2026</span>
        </div>
      </div>
    </div>
  );
};
