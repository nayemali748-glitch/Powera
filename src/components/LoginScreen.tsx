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
  UserCheck,
  Globe,
  LogIn,
  RotateCcw
} from 'lucide-react';
import { UserSession, UserAccount } from '../types';
import { fetchUsers, createUserAccount, loginUser, resetUserPassword, DEFAULT_WBSEDCL_ACCOUNTS } from '../services/api';
import { Language, translations } from '../utils/translations';

interface LoginScreenProps {
  onLogin?: (session: UserSession) => void;
  onLoginSuccess?: (session: UserSession) => void;
  lang?: Language;
  onOpenLanguageModal?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ 
  onLogin, 
  onLoginSuccess, 
  lang = 'bn',
  onOpenLanguageModal 
}) => {
  const handleSuccess = onLoginSuccess || onLogin || (() => {});
  const t = translations[lang] || translations.bn;
  
  // Screen mode: 'login' | 'register' | 'forgot'
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');

  // Accounts list loaded from server / localStorage
  const [accounts, setAccounts] = useState<UserAccount[]>(DEFAULT_WBSEDCL_ACCOUNTS);

  // Load latest users from backend on mount
  useEffect(() => {
    fetchUsers().then(users => {
      if (users && users.length > 0) {
        setAccounts(users);
      }
    }).catch(err => {
      console.warn('Failed to load accounts from server:', err);
    });
  }, []);

  // --- LOGIN STATE ---
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // --- REGISTER (CREATE ACCOUNT) STATE ---
  const [regRole, setRegRole] = useState<'admin' | 'worker'>('worker');
  const [regIdNo, setRegIdNo] = useState(() => `LM-${Math.floor(1000 + Math.random() * 9000)}`);
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regDesignation, setRegDesignation] = useState('লাইনম্যান (WBSEDCL)');
  const [regPassword, setRegPassword] = useState('1234');
  const [regConfirmPassword, setRegConfirmPassword] = useState('1234');
  const [regSecurityQuestion, setRegSecurityQuestion] = useState('আপনার প্রিয় বিদ্যুৎ সাবস্টেশন?');
  const [regSecurityAnswer, setRegSecurityAnswer] = useState('Vidyut Bhavan');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // --- FORGOT PASSWORD STATE ---
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotId, setForgotId] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
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
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanId = loginId.trim();
    const cleanPass = loginPassword.trim();

    if (!cleanId) {
      setError('অনুগ্রহ করে আপনার User ID প্রবেশ করান');
      return;
    }

    if (!cleanPass) {
      setError('পাসওয়ার্ড প্রবেশ করান');
      return;
    }

    setLoading(true);

    try {
      const session = await loginUser(cleanId, cleanPass);
      handleSuccess(session);
    } catch (err: any) {
      setError(err.message || 'ভুল আইডি বা পাসওয়ার্ড! সঠিক এডমিন / কর্মী আইডি প্রবেশ করান।');
    } finally {
      setLoading(false);
    }
  };

  // Handle Quick 1-Click Login (Fill and Login)
  const handleQuickLogin = async (accIdNo: string, accPass: string) => {
    setLoading(true);
    setError(null);
    setLoginId(accIdNo);
    setLoginPassword(accPass);

    try {
      const session = await loginUser(accIdNo, accPass);
      handleSuccess(session);
    } catch (err: any) {
      setError(err.message || 'লগইন ব্যর্থ হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  // Handle Register (Create Account) Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanId = regIdNo.trim();
    const cleanName = regName.trim();
    const cleanPhone = regPhone.trim();
    const cleanPass = regPassword.trim();
    const cleanConfirm = regConfirmPassword.trim();

    if (!cleanId) {
      setError('একটি User ID লিখুন');
      return;
    }

    if (!cleanName) {
      setError('ব্যবহারকারীর পূর্ণ নাম লিখুন');
      return;
    }

    if (!cleanPass || cleanPass.length < 4) {
      setError('পাসওয়ার্ড কমপক্ষে ৪ ডিজিট বা অক্ষরের হতে হবে');
      return;
    }

    if (cleanPass !== cleanConfirm) {
      setError('কনফার্ম পাসওয়ার্ড মিলছে না! পুনরায় টাইপ করুন।');
      return;
    }

    setLoading(true);

    try {
      const newUser = await createUserAccount({
        idNo: cleanId,
        name: cleanName,
        phone: cleanPhone || '9830000000',
        role: regRole,
        designation: regDesignation || (regRole === 'admin' ? 'সহকারী প্রকৌশলী (WBSEDCL)' : 'লাইনম্যান (WBSEDCL)'),
        badgeNo: cleanId,
        password: cleanPass,
        securityQuestion: regSecurityQuestion,
        securityAnswer: regSecurityAnswer.trim() || 'Vidyut Bhavan'
      });

      // Update accounts list
      setAccounts(prev => [newUser, ...prev]);

      // Direct auto-login with newly created user!
      const session: UserSession = {
        id: newUser.id,
        idNo: newUser.idNo,
        name: newUser.name,
        phone: newUser.phone,
        role: newUser.role,
        status: 'active',
        designation: newUser.designation,
        badgeNo: newUser.badgeNo,
        loggedInAt: new Date().toISOString()
      };

      try {
        localStorage.setItem('power_user_session', JSON.stringify(session));
        localStorage.setItem('power_worker_name', session.name);
        localStorage.setItem('power_is_admin', session.role === 'admin' ? 'true' : 'false');
      } catch {}

      handleSuccess(session);
    } catch (err: any) {
      setError(err.message || 'একউন্ট তৈরি ব্যর্থ হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password Step 1: Verify ID
  const handleForgotVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanForgotId = forgotId.trim();

    if (!cleanForgotId) {
      setError('আপনার Login ID No প্রবেশ করান');
      return;
    }

    let accs = accounts;
    try {
      const refreshed = await fetchUsers();
      if (refreshed && refreshed.length > 0) {
        accs = refreshed;
        setAccounts(refreshed);
      }
    } catch {}

    const cleanAlphaNum = cleanForgotId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    let found = accs.find((a) => {
      const aId = (a.idNo || '').toLowerCase();
      const aAlpha = aId.replace(/[^a-zA-Z0-9]/g, '');
      const aPhone = (a.phone || '').replace(/[^0-9]/g, '');
      return aId === cleanForgotId.toLowerCase() || (cleanAlphaNum && aAlpha === cleanAlphaNum) || (aPhone && aPhone === cleanForgotId.replace(/[^0-9]/g, ''));
    });

    if (!found && (cleanForgotId === '8695716192' || cleanAlphaNum === '8695716192' || cleanForgotId.toLowerCase() === 'admin')) {
      found = DEFAULT_WBSEDCL_ACCOUNTS[0];
    }

    if (!found) {
      // Allow general fallback reset for any ID
      found = {
        id: `user_${Date.now()}`,
        idNo: cleanForgotId,
        name: 'WBSEDCL User',
        phone: forgotPhone || '',
        role: 'worker',
        status: 'active',
        designation: 'WBSEDCL Staff',
        badgeNo: cleanForgotId,
        password: '1234',
        createdAt: new Date().toISOString()
      };
    }

    setTargetAccount(found);
    setForgotStep(2);
  };

  // Forgot Password Step 2: Set New Password
  const handleForgotResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!targetAccount) return;

    const cleanNewPass = newPassword.trim();
    const cleanConfirm = confirmNewPassword.trim();

    if (!cleanNewPass || cleanNewPass.length < 4) {
      setError('নতুন পাসওয়ার্ড কমপক্ষে ৪ ডিজিট বা অক্ষরের হতে হবে');
      return;
    }

    if (cleanNewPass !== cleanConfirm) {
      setError('কনফার্ম পাসওয়ার্ড মিলছে না!');
      return;
    }

    setLoading(true);

    try {
      await resetUserPassword(targetAccount.idNo, cleanNewPass, targetAccount.phone);

      const updatedAccounts = accounts.map((acc) => {
        if (acc.id === targetAccount.id || acc.idNo === targetAccount.idNo) {
          return { ...acc, password: cleanNewPass };
        }
        return acc;
      });

      setAccounts(updatedAccounts);
      setSuccessMsg(`পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে! নতুন পাসওয়ার্ড "${cleanNewPass}" দিয়ে লগইন করুন।`);
      setLoginId(targetAccount.idNo);
      setLoginPassword(cleanNewPass);
      setForgotStep(1);
      setTargetAccount(null);
      setNewPassword('');
      setNewConfirmPassword('');
      setMode('login');
    } catch (err: any) {
      setError('পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-3 sm:p-6 lg:p-8 font-sans selection:bg-blue-600 selection:text-white">
      {/* Background Graphic Accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-400 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-300 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden relative z-10">
        {/* Header Branding */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-b from-blue-600/20 to-transparent pointer-events-none"></div>

          {onOpenLanguageModal && (
            <button
              type="button"
              onClick={onOpenLanguageModal}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-blue-300 hover:text-white border border-blue-500/30 flex items-center gap-1.5 text-xs font-bold transition-all shadow-xs cursor-pointer z-20"
              title="Change Language / ভাষা পরিবর্তন"
            >
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span className="uppercase text-[10px]">{lang}</span>
            </button>
          )}
          
          <div className="inline-block relative mb-2.5">
            <img 
              src={appLogo} 
              alt="Power Logo" 
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-lg border-2 border-amber-400 p-0.5 bg-white mx-auto ring-4 ring-slate-800"
              referrerPolicy="no-referrer"
            />
            <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span>Power of Construction</span>
          </h1>
          <p className="text-xs text-amber-400 font-bold tracking-wider mt-1">
            App Developed By Nayem
          </p>
          <p className="text-[11px] text-slate-300 mt-1">
            WBSEDCL বিদ্যুৎ কন্ট্রোল ও কাজের রেকর্ড পোর্টাল
          </p>
        </div>

        {/* Top Navigation Mode Tabs */}
        <div className="grid grid-cols-3 bg-slate-100 border-b border-slate-200 p-1.5 gap-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <LogIn className="w-3.5 h-3.5 text-blue-600" />
            <span>লগইন</span>
          </button>
          
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-emerald-700 shadow-xs border border-slate-200 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
            <span>নতুন আইডি</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setForgotId(loginId || '');
              setMode('forgot');
            }}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'forgot'
                ? 'bg-white text-amber-700 shadow-xs border border-slate-200 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
            <span>পাসওয়ার্ড রিসেট</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Notifications */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2 text-xs text-red-700 font-semibold animate-in fade-in duration-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span>{error}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-red-200/60">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('worker', '1234')}
                  className="px-2.5 py-1 bg-white border border-red-300 text-red-800 rounded-lg text-[11px] font-bold hover:bg-red-100/50 cursor-pointer"
                >
                  ⚡ কর্মী হিসেবে লগইন (worker / 1234)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('8695716192', '6293')}
                  className="px-2.5 py-1 bg-white border border-red-300 text-red-800 rounded-lg text-[11px] font-bold hover:bg-red-100/50 cursor-pointer"
                >
                  ⚡ এডমিন হিসেবে লগইন (8695716192 / 6293)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[11px] font-bold hover:bg-emerald-700 cursor-pointer"
                >
                  ➕ নতুন আইডি তৈরি করুন
                </button>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-800 font-semibold animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ========================================================= */}
          {/* 1. LOGIN MODE */}
          {/* ========================================================= */}
          {mode === 'login' && (
            <div className="space-y-4">
              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                {/* ID No Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>User ID (ইউজার আইডি) <span className="text-red-500">*</span></span>
                    </span>
                    <span className="text-[10px] text-slate-400">কর্মী বা এডমিন আইডি</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      placeholder="যেমন: worker বা 8695716192"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                      <span>পাসওয়ার্ড (Password) <span className="text-red-500">*</span></span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotId(loginId || '');
                        setMode('forgot');
                      }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
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
                      placeholder="পাসওয়ার্ড লিখুন (যেমন: 1234 বা 6293)"
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
                      <span>লগইন যাচাই হচ্ছে...</span>
                    </span>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>লগইন করে কাজ শুরু করুন</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Quick 1-Click Fill & Instant Login */}
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-2">
                <p className="text-xs font-bold text-blue-950 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>দ্রুত ১-ক্লিকে লগইন (Quick Fill)</span>
                  </span>
                  <span className="text-[10px] text-blue-600 font-semibold">ক্লিক করলেই লগইন হবে</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('worker', '1234')}
                    disabled={loading}
                    className="p-2 bg-white hover:bg-emerald-50 border border-emerald-300 rounded-xl text-left transition-all group cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                        <HardHat className="w-3.5 h-3.5 text-amber-500" />
                        <span>ফিল্ড কর্মী (Worker)</span>
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md">১-ক্লিক</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5 font-mono">ID: <strong>worker</strong> • Pass: <strong>1234</strong></p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin('8695716192', '6293')}
                    disabled={loading}
                    className="p-2 bg-white hover:bg-blue-50 border border-blue-300 rounded-xl text-left transition-all group cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-900 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                        <span>এডমিন কন্ট্রোলার</span>
                      </span>
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-md">১-ক্লিক</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5 font-mono">ID: <strong>8695716192</strong> • Pass: <strong>6293</strong></p>
                  </button>
                </div>
              </div>

              {/* Login Info Card */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                <p className="font-bold text-slate-800 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-slate-500" />
                  <span>লগইন নির্দেশিকা (Login Credentials)</span>
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                  <li><strong>এডমিন লগইন:</strong> ID: <code className="bg-slate-200 px-1 rounded text-slate-900 font-bold">8695716192</code> বা <code className="bg-slate-200 px-1 rounded text-slate-900 font-bold">admin</code>, পাসওয়ার্ড: <code className="bg-slate-200 px-1 rounded text-slate-900 font-bold">6293</code> বা <code className="bg-slate-200 px-1 rounded text-slate-900 font-bold">1234</code></li>
                  <li><strong>কর্মী লগইন:</strong> ID: <code className="bg-slate-200 px-1 rounded text-slate-900 font-bold">worker</code> বা <code className="bg-slate-200 px-1 rounded text-slate-900 font-bold">worker2</code>, পাসওয়ার্ড: <code className="bg-slate-200 px-1 rounded text-slate-900 font-bold">1234</code></li>
                  <li>অথবা নতুন কর্মী বা অফিসার হলে উপরের <strong>"নতুন আইডি"</strong> বাটনে ক্লিক করে রেজিস্ট্রেশন করুন।</li>
                </ul>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. REGISTER MODE (CREATE ID & PASSWORD) */}
          {/* ========================================================= */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>নতুন একাউন্ট তৈরি করলেই সরাসরি লগইন হয়ে যাবে এবং যেকোনো ডিভাইস থেকে ব্যবহার করা যাবে।</span>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  একাউন্ট টাইপ (Role) <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRegRole('worker');
                      setRegDesignation('লাইনম্যান (WBSEDCL)');
                      if (!regIdNo || regIdNo.startsWith('ADM-')) {
                        setRegIdNo(`LM-${Math.floor(1000 + Math.random() * 9000)}`);
                      }
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      regRole === 'worker'
                        ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-500/20 font-extrabold'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <HardHat className="w-4 h-4 text-amber-500" />
                    <span>ফিল্ড কর্মী / লাইনম্যান</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRegRole('admin');
                      setRegDesignation('সহকারী প্রকৌশলী (WBSEDCL)');
                      if (!regIdNo || regIdNo.startsWith('LM-')) {
                        setRegIdNo(`ADM-${Math.floor(100 + Math.random() * 900)}`);
                      }
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      regRole === 'admin'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20 font-extrabold'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>এডমিন / অফিসার</span>
                  </button>
                </div>
              </div>

              {/* Login ID No */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>User ID (ইউজার আইডি) <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-slate-400 font-mono">লগইনে এই আইডি লাগবে</span>
                </label>
                <input
                  type="text"
                  required
                  value={regIdNo}
                  onChange={(e) => setRegIdNo(e.target.value)}
                  placeholder="আপনার পছন্দমত ID দিন (যেমন: worker5 বা LM-200)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
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
                    placeholder="আপনার নাম লিখুন"
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
                    placeholder="98300XXXXX"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Designation */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  পদবী / পদমর্যাদা (WBSEDCL)
                </label>
                <select
                  value={regDesignation}
                  onChange={(e) => setRegDesignation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
                >
                  {regRole === 'admin' ? (
                    <>
                      <option value="সহকারী প্রকৌশলী / AE (WBSEDCL)">সহকারী প্রকৌশলী / AE (WBSEDCL)</option>
                      <option value="ডিভিশনাল ম্যানেজার / XEN (WBSEDCL)">ডিভিশনাল ম্যানেজার / XEN (WBSEDCL)</option>
                      <option value="স্টেশন ম্যানেজার / SM (CCC WBSEDCL)">স্টেশন ম্যানেজার / SM (CCC WBSEDCL)</option>
                      <option value="জুনিয়র ইঞ্জিনিয়ার / JE (WBSEDCL)">জুনিয়র ইঞ্জিনিয়ার / JE (WBSEDCL)</option>
                      <option value="এডমিন কন্ট্রোলার (WBSEDCL)">এডমিন কন্ট্রোলার (WBSEDCL)</option>
                    </>
                  ) : (
                    <>
                      <option value="লাইনম্যান (Lineman WBSEDCL)">লাইনম্যান (Lineman WBSEDCL)</option>
                      <option value="সিনিয়র লাইনম্যান (WBSEDCL CCC)">সিনিয়র লাইনম্যান (WBSEDCL CCC)</option>
                      <option value="টেকনিক্যাল অ্যাসিস্ট্যান্ট (TA)">টেকনিক্যাল অ্যাসিস্ট্যান্ট (TA)</option>
                      <option value="মিটার রিডার / টেকনিশিয়ান (WBSEDCL)">মিটার রিডার / টেকনিশিয়ান (WBSEDCL)</option>
                      <option value="সাবস্টেশন অপারেটর (33/11kV)">সাবস্টেশন অপারেটর (33/11kV)</option>
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
                      className="text-[10px] text-slate-500 hover:text-slate-700 cursor-pointer"
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
                    <span>একাউন্ট তৈরি করে প্রবেশ করুন</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ========================================================= */}
          {/* 3. FORGOT / RESET PASSWORD MODE */}
          {/* ========================================================= */}
          {mode === 'forgot' && (
            <div className="space-y-4">
              {forgotStep === 1 ? (
                <form onSubmit={handleForgotVerify} className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
                    <p className="font-bold flex items-center gap-1.5 mb-1">
                      <HelpCircle className="w-4 h-4 text-blue-600" />
                      <span>পাসওয়ার্ড পরিবর্তন ও রিকভারি পদ্ধতি</span>
                    </p>
                    <p>আপনার <strong>User ID</strong> লিখুন এবং সহজেই নতুন পাসওয়ার্ড সেট করে নিন।</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span>User ID (ইউজার আইডি) <span className="text-red-500">*</span></span>
                      </span>
                    </label>
                    <input
                      type="text"
                      required
                      value={forgotId}
                      onChange={(e) => setForgotId(e.target.value)}
                      placeholder="আপনার User ID লিখুন"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>রেজিস্টার্ড মোবাইল নম্বর (ঐচ্ছিক)</span>
                    </label>
                    <input
                      type="tel"
                      value={forgotPhone}
                      onChange={(e) => setForgotPhone(e.target.value)}
                      placeholder="আপনার মোবাইল নম্বর"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>আইডি নিশ্চিত ও পাসওয়ার্ড পরিবর্তন করুন</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleForgotResetPassword} className="space-y-4 animate-in fade-in">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                    <p className="font-bold">আইডি যাচাই সম্পন্ন হয়েছে ({targetAccount?.idNo})</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">এখন এই একাউন্টের জন্য আপনার নতুন পাসওয়ার্ড লিখুন।</p>
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
                        className="text-[10px] text-slate-500 hover:text-slate-700 cursor-pointer"
                      >
                        {showNewPassword ? 'লুকান' : 'দেখান'}
                      </button>
                    </label>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="কমপক্ষে ৪ ডিজিটের নতুন পাসওয়ার্ড লিখুন"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex items-center justify-center text-xs font-bold text-slate-700">
          <span className="tracking-wide text-slate-800 font-extrabold">App Developed By Nayem</span>
        </div>
      </div>
    </div>
  );
};
