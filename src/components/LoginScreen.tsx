import React, { useState } from 'react';
import appLogo from '../assets/images/power_round_logo_1787860440979.jpg';
import { 
  Lock, 
  User, 
  ArrowRight, 
  KeyRound, 
  AlertCircle,
  Eye,
  EyeOff,
  Globe,
  LogIn,
  HelpCircle,
  Phone,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';
import { UserSession } from '../types';
import { loginUser, resetUserPassword } from '../services/api';
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

  const [mode, setMode] = useState<'login' | 'forgot'>('login');

  // Login form state
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [forgotId, setForgotId] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanId = loginId.trim();
    const cleanPass = loginPassword.trim();

    if (!cleanId) {
      setError(lang === 'bn' ? 'অনুগ্রহ করে আপনার User ID লিখুন' : 'Please enter your User ID');
      return;
    }

    if (!cleanPass) {
      setError(lang === 'bn' ? 'অনুগ্রহ করে পাসওয়ার্ড লিখুন' : 'Please enter your password');
      return;
    }

    setLoading(true);

    try {
      const session = await loginUser(cleanId, cleanPass);
      handleSuccess(session);
    } catch (err: any) {
      setError(err.message || (lang === 'bn' ? 'ভুল User ID বা পাসওয়ার্ড! সঠিক তথ্য দিন।' : 'Invalid User ID or Password!'));
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password Submit
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);

    const cleanId = forgotId.trim();
    const cleanPhone = forgotPhone.trim();
    const cleanPass = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanId) {
      setForgotError(lang === 'bn' ? 'অনুগ্রহ করে আপনার User ID প্রদান করুন।' : 'Please provide your User ID.');
      return;
    }

    if (!cleanPass) {
      setForgotError(lang === 'bn' ? 'অনুগ্রহ করে নতুন পাসওয়ার্ড লিখুন।' : 'Please enter a new password.');
      return;
    }

    if (cleanPass.length < 4) {
      setForgotError(lang === 'bn' ? 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।' : 'Password must be at least 4 characters.');
      return;
    }

    if (cleanPass !== cleanConfirm) {
      setForgotError(lang === 'bn' ? 'দুইটি পাসওয়ার্ড মেলেনি! পুনরায় যাচাই করুন।' : 'Passwords do not match! Please check again.');
      return;
    }

    setForgotLoading(true);

    try {
      await resetUserPassword(cleanId, cleanPass, cleanPhone || undefined);
      setForgotSuccess(lang === 'bn' ? 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে! এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।' : 'Password updated successfully! You can now log in.');
      setLoginId(cleanId);
      setLoginPassword('');
    } catch (err: any) {
      setForgotError(err.message || (lang === 'bn' ? 'পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে। এডমিনের সাথে যোগাযোগ করুন।' : 'Failed to reset password. Please contact Admin.'));
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 font-sans selection:bg-blue-600 selection:text-white">
      {/* Background Subtle Gradient Accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-400 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-300 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden relative z-10">
        {/* Header Branding */}
        <div className="bg-slate-900 text-white p-6 sm:p-7 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-600/20 to-transparent pointer-events-none"></div>

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
            <span>Power of Construction</span>
          </h1>
          <p className="text-xs text-amber-400 font-bold tracking-wider mt-1">
            App Developed By Nayem
          </p>
          <p className="text-xs text-slate-300 mt-1">
            WBSEDCL বিদ্যুৎ কন্ট্রোল ও কাজের পোর্টাল
          </p>
        </div>

        {/* Content Box */}
        <div className="p-6 sm:p-7 space-y-5">
          {mode === 'login' ? (
            /* Login Mode */
            <>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700 font-semibold animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* User ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>User ID <span className="text-red-500">*</span></span>
                  </label>
                  <input
                    id="login-user-id"
                    type="text"
                    required
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="User ID লিখুন"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
                    autoComplete="username"
                  />
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                      <span>Password <span className="text-red-500">*</span></span>
                    </label>
                    <button
                      id="btn-forgot-password-trigger"
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setForgotError(null);
                        setForgotSuccess(null);
                        if (loginId) setForgotId(loginId);
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-all cursor-pointer"
                    >
                      পাসওয়ার্ড ভুলে গেছেন?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Password লিখুন"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      autoComplete="current-password"
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
                  id="login-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer mt-2"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>লগইন যাচাই হচ্ছে...</span>
                    </span>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>লগইন করুন</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* Forgot Password Mode */
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">পাসওয়ার্ড রিসেট / Forgot Password</h2>
                    <p className="text-[11px] text-slate-500">আপনার User ID দিয়ে নতুন পাসওয়ার্ড সেট করুন</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setForgotError(null);
                    setForgotSuccess(null);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>ফিরে যান</span>
                </button>
              </div>

              {forgotError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  <span>{forgotError}</span>
                </div>
              )}

              {forgotSuccess ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex items-start gap-2 text-xs text-emerald-800 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                    <span>{forgotSuccess}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setForgotSuccess(null);
                    }}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>এখন লগইন করুন</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-3.5">
                  {/* User ID */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>User ID <span className="text-red-500">*</span></span>
                    </label>
                    <input
                      id="forgot-user-id"
                      type="text"
                      required
                      value={forgotId}
                      onChange={(e) => setForgotId(e.target.value)}
                      placeholder="আপনার User ID লিখুন"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  {/* Registered Phone (Optional) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>রেজিস্টার্ড ফোন নম্বর</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">(ঐচ্ছিক যাচাইকরণ)</span>
                    </label>
                    <input
                      id="forgot-phone"
                      type="tel"
                      value={forgotPhone}
                      onChange={(e) => setForgotPhone(e.target.value)}
                      placeholder="মোবাইল নম্বর (যদি থাকে)"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                      <span>নতুন পাসওয়ার্ড (New Password) <span className="text-red-500">*</span></span>
                    </label>
                    <div className="relative">
                      <input
                        id="forgot-new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="কমপক্ষে ৪ অক্ষরের নতুন পাসওয়ার্ড"
                        className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                      <span>পাসওয়ার্ড নিশ্চিত করুন (Confirm Password) <span className="text-red-500">*</span></span>
                    </label>
                    <input
                      id="forgot-confirm-password"
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="নতুন পাসওয়ার্ডটি আবার লিখুন"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    id="forgot-submit-btn"
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-2.5 px-4 rounded-xl text-white font-bold text-sm bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
                  >
                    {forgotLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>রিসেট করা হচ্ছে...</span>
                      </span>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>পাসওয়ার্ড রিসেট সম্পন্ন করুন</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Admin Support Info */}
              <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-[11px] space-y-1">
                <p className="font-bold text-slate-700 flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                  <span>এডমিন সরাসরি সহায়তা:</span>
                </p>
                <p>পাসওয়ার্ড রিসেট করতে সমস্যা হলে সরাসরি মাস্টার এডমিনের সাথে যোগাযোগ করুন।</p>
                <p className="font-semibold text-slate-800">হেল্পলাইন: 8695716192 • ইমেইল: powerof2026@gmail.com</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-100 flex items-center justify-center text-xs font-bold text-slate-700">
          <span className="tracking-wide text-slate-800 font-extrabold">App Developed By Nayem</span>
        </div>
      </div>
    </div>
  );
};
