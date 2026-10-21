import React, { useState, useRef, useEffect } from 'react';
import loginBgExact from '../assets/images/login_bg_exact_1791747702919.jpg';
import powerEmblemLogo from '../assets/images/power_emblem_logo_1791747068587.jpg';
import {
  User,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Globe,
  Eye,
  EyeOff,
  Lock,
  ChevronDown,
  Phone,
  RefreshCw,
  X,
  Key,
  Activity,
  Code2,
  Headphones,
  Copyright,
  Zap,
} from 'lucide-react';
import { UserSession } from '../types';
import {
  loginUser,
  sendLoginOtp,
  verifyLoginOtp,
  sendForgotPasswordOtp,
  verifyResetPasswordOtp,
} from '../services/api';
import { Language } from '../utils/translations';

interface LoginScreenProps {
  onLogin?: (session: UserSession) => void;
  onLoginSuccess?: (session: UserSession) => void;
  lang?: Language;
  onOpenLanguageModal?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  onLoginSuccess,
  lang = 'en',
  onOpenLanguageModal,
}) => {
  const onProceedSession = onLoginSuccess || onLogin || (() => {});
  const handleSuccess = (session: UserSession) => {
    localStorage.setItem('power_user_session', JSON.stringify(session));
    const isAdminUser = Boolean(
      session.role !== 'worker' &&
        session.role !== 'agency' &&
        (session.role === 'admin' ||
          session.idNo === '8695716192' ||
          session.phone?.includes('8695716192') ||
          session.idNo === 'controller' ||
          session.idNo === 'admin')
    );
    if (isAdminUser) {
      localStorage.setItem('power_is_admin', 'true');
    } else {
      localStorage.removeItem('power_is_admin');
    }
    onProceedSession(session);
  };

  // Selector state: (A) User ID + Password/PIN or (B) Mobile Number + OTP
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');

  // Form states - User ID + Password
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP Login states
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSessionId, setOtpSessionId] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Forgot Password modal states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [fpMobile, setFpMobile] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpSessionId, setFpSessionId] = useState<string | null>(null);
  const [fpOtpSent, setFpOtpSent] = useState(false);
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpConfirmPassword, setFpConfirmPassword] = useState('');
  const [fpShowNewPass, setFpShowNewPass] = useState(false);
  const [fpResendCooldown, setFpResendCooldown] = useState(0);
  const [fpError, setFpError] = useState<string | null>(null);
  const [fpSuccess, setFpSuccess] = useState<string | null>(null);

  // Status states
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Submission lock ref to prevent duplicate concurrent requests
  const isSubmittingRef = useRef<boolean>(false);

  // Cooldown timer for login OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  // Cooldown timer for forgot password OTP resend
  useEffect(() => {
    if (fpResendCooldown <= 0) return;
    const t = setInterval(() => {
      setFpResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [fpResendCooldown]);

  // Handle standard User ID + Password/PIN submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || loading) return;

    setError(null);
    setSuccessMsg(null);

    const cleanId = loginId.trim();
    const cleanPass = password.trim();

    if (!cleanId) {
      setError(
        lang === 'bn'
          ? 'অনুগ্রহ করে ইউজার আইডি বা মোবাইল নম্বর দিন'
          : 'Please enter User ID or Phone Number'
      );
      return;
    }

    if (!cleanPass) {
      setError(
        lang === 'bn'
          ? 'অনুগ্রহ করে পাসওয়ার্ড বা পিন দিন'
          : 'Please enter PIN or Password'
      );
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const session = await loginUser(cleanId, cleanPass);
      setSuccessMsg(
        lang === 'bn'
          ? 'লগইন সফল হয়েছে! প্রবেশ করা হচ্ছে...'
          : 'Login successful! Redirecting...'
      );
      handleSuccess(session);
    } catch (err: any) {
      console.error('Login error:', err);
      const msg =
        err.message ||
        (lang === 'bn'
          ? 'ভুল ইউজার আইডি বা পাসওয়ার্ড! সঠিক তথ্য দিন।'
          : 'Invalid User ID or Password.');
      setError(msg);
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  // Handle Send Login OTP
  const handleSendLoginOtp = async () => {
    if (loading) return;
    setError(null);
    setSuccessMsg(null);

    const cleanPhone = mobileNumber.replace(/\D/g, '').trim();
    if (!cleanPhone || cleanPhone.length !== 10) {
      setError(
        lang === 'bn'
          ? 'অনুগ্রহ করে সঠিক ১০ সংখ্যার মোবাইল নম্বর দিন'
          : 'Please enter a valid 10-digit mobile number'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await sendLoginOtp(cleanPhone);
      setOtpSessionId(res.sessionId);
      setOtpSent(true);
      setResendCooldown(60);
      setSuccessMsg(
        lang === 'bn'
          ? 'আপনার মোবাইল নম্বরে ওটিপি পাঠানো হয়েছে।'
          : 'OTP sent to your registered mobile number.'
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to send OTP. Please check mobile number.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify Login OTP
  const handleVerifyLoginOtp = async () => {
    if (loading || !otpSessionId) return;
    setError(null);
    setSuccessMsg(null);

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      setError(
        lang === 'bn'
          ? 'অনুগ্রহ করে সঠিক ওটিপি দিন'
          : 'Please enter valid OTP code'
      );
      return;
    }

    const cleanPhone = mobileNumber.replace(/\D/g, '').trim();
    setLoading(true);
    try {
      const session = await verifyLoginOtp(cleanPhone, cleanOtp, otpSessionId);
      setSuccessMsg(
        lang === 'bn'
          ? 'ওটিপি যাচাই সফল হয়েছে! প্রবেশ করা হচ্ছে...'
          : 'OTP verified successfully! Redirecting...'
      );
      handleSuccess(session);
    } catch (err: any) {
      setError(err?.message || 'Invalid OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Send Forgot Password OTP
  const handleSendFpOtp = async () => {
    if (loading) return;
    setFpError(null);
    setFpSuccess(null);

    const cleanPhone = fpMobile.replace(/\D/g, '').trim();
    if (!cleanPhone || cleanPhone.length !== 10) {
      setFpError(
        lang === 'bn'
          ? 'অনুগ্রহ করে সঠিক ১০ সংখ্যার মোবাইল নম্বর দিন'
          : 'Please enter a valid 10-digit mobile number'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await sendForgotPasswordOtp(cleanPhone);
      setFpSessionId(res.sessionId);
      setFpOtpSent(true);
      setFpResendCooldown(60);
      setFpSuccess(
        lang === 'bn'
          ? 'পাসওয়ার্ড রিসেট ওটিপি আপনার নম্বরে পাঠানো হয়েছে।'
          : 'Password reset OTP sent to your registered phone number.'
      );
    } catch (err: any) {
      setFpError(err?.message || 'Failed to send reset OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify Forgot Password OTP & Reset
  const handleVerifyFpReset = async () => {
    if (loading || !fpSessionId) return;
    setFpError(null);
    setFpSuccess(null);

    const cleanPhone = fpMobile.replace(/\D/g, '').trim();
    const cleanOtp = fpOtp.trim();
    const cleanPass = fpNewPassword.trim();
    const cleanConf = fpConfirmPassword.trim();

    if (!cleanOtp || cleanOtp.length < 4) {
      setFpError(
        lang === 'bn' ? 'অনুগ্রহ করে সঠিক ওটিপি দিন' : 'Please enter valid OTP'
      );
      return;
    }

    if (!cleanPass || cleanPass.length < 4) {
      setFpError(
        lang === 'bn'
          ? 'নতুন পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে'
          : 'Password must be at least 4 characters'
      );
      return;
    }

    if (cleanPass !== cleanConf) {
      setFpError(
        lang === 'bn'
          ? 'পাসওয়ার্ড দুটি মিলছে না! পুনরায় চেক করুন।'
          : 'Passwords do not match. Please re-enter.'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await verifyResetPasswordOtp(
        cleanPhone,
        cleanOtp,
        fpSessionId,
        cleanPass
      );
      setFpSuccess(
        res.message ||
          (lang === 'bn'
            ? 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে! এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।'
            : 'Password updated successfully! You can now log in.')
      );
      // Pre-fill login inputs with new credentials
      setLoginId(cleanPhone);
      setPassword(cleanPass);
      setTimeout(() => {
        setShowForgotPassword(false);
        setLoginMethod('password');
        setSuccessMsg(
          lang === 'bn'
            ? 'পাসওয়ার্ড আপডেট সফল হয়েছে। নতুন পাসওয়ার্ড দিয়ে লগইন করুন।'
            : 'Password reset successful. Please sign in.'
        );
      }, 2000);
    } catch (err: any) {
      setFpError(err?.message || 'Failed to reset password. Please check OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#020917] text-white flex flex-col items-center justify-center relative overflow-x-hidden font-sans select-none">
      {/* Ambient Desktop Surround Backdrop */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-[#020917]">
        <img
          src={loginBgExact}
          alt=""
          className="w-full h-full object-cover opacity-35 blur-2xl scale-110"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Main Portrait Viewport Matching Reference Photo 100% */}
      <div className="relative z-10 w-full max-w-[440px] min-h-screen flex flex-col justify-between items-center px-5 pt-5 pb-7 overflow-hidden bg-[#030c1d] shadow-[0_0_80px_rgba(0,0,0,0.95)]">
        {/* ================================================================= */}
        {/* BACKGROUND ARTWORK: STORMY SKY, PYLONS, LIGHTNING, NEON WAVES     */}
        {/* ================================================================= */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          {/* Base Photo Layer */}
          <img
            src={loginBgExact}
            alt=""
            className="w-full h-full object-cover object-top opacity-90"
            referrerPolicy="no-referrer"
          />

          {/* Precision SVG Overlay for Exact Top Pylons, Lightning, Top Neon Waves & Bottom Skyline + Waves */}
          <svg
            viewBox="0 0 440 956"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute inset-0 w-full h-full object-cover"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="skyFade" x1="220" y1="0" x2="220" y2="956" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#04152e" stopOpacity="0.15" />
                <stop offset="22%" stopColor="#031024" stopOpacity="0.25" />
                <stop offset="30%" stopColor="#030d20" stopOpacity="0.82" />
                <stop offset="76%" stopColor="#030d1e" stopOpacity="0.86" />
                <stop offset="90%" stopColor="#041229" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#020916" stopOpacity="0.25" />
              </linearGradient>

              <linearGradient id="goldWaveGrad" x1="0" y1="0" x2="440" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="30%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.35" />
                <stop offset="75%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#fef08a" />
              </linearGradient>

              <linearGradient id="cyanWaveGrad" x1="0" y1="0" x2="440" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                <stop offset="25%" stopColor="#00e5ff" />
                <stop offset="50%" stopColor="#22d3ee" />
                <stop offset="80%" stopColor="#00e5ff" />
                <stop offset="100%" stopColor="#7dd3fc" />
              </linearGradient>

              <linearGradient id="bottomCyanWave" x1="0" y1="900" x2="440" y2="900" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0284c7" stopOpacity="0.65" />
                <stop offset="45%" stopColor="#00e5ff" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>

              <linearGradient id="bottomGoldWave" x1="160" y1="920" x2="440" y2="875" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0" />
                <stop offset="35%" stopColor="#f59e0b" stopOpacity="0.85" />
                <stop offset="75%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#fef08a" />
              </linearGradient>

              <filter id="neonGlowGold" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="neonGlowCyan" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Smooth Mid-Section Dark Navy Vignette so Title & Card Pop Clearly */}
            <rect width="440" height="956" fill="url(#skyFade)" />

            {/* Top Lightning Bolts Behind Pylons & Logo */}
            <g filter="url(#neonGlowCyan)" opacity="0.85">
              <path
                d="M95 55 L118 88 L108 94 L142 132 L132 138 L168 168"
                stroke="#7dd3fc"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M118 88 L148 96 L162 115"
                stroke="#38bdf8"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
              <path
                d="M105 162 L132 152 L146 164 L165 158"
                stroke="#bae6fd"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M342 96 L316 118 L324 126 L296 154"
                stroke="#7dd3fc"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </g>

            {/* Top Curved Neon Cyan & Gold Waves Sweeping Under the Emblem */}
            <path
              d="M-10 165 Q 110 232 220 232 Q 330 232 450 175"
              stroke="url(#cyanWaveGrad)"
              strokeWidth="2.5"
              filter="url(#neonGlowCyan)"
              opacity="0.9"
            />
            <path
              d="M-10 138 Q 95 218 220 226 Q 345 218 450 146"
              stroke="url(#goldWaveGrad)"
              strokeWidth="3"
              filter="url(#neonGlowGold)"
              opacity="0.95"
            />

            {/* Bottom Sweeping Neon Cyan & Gold Waves Along Footer Edge */}
            <path
              d="M-10 890 Q 170 950 450 865"
              stroke="url(#bottomCyanWave)"
              strokeWidth="3"
              filter="url(#neonGlowCyan)"
              opacity="0.9"
            />
            <path
              d="M135 954 Q 295 942 450 882"
              stroke="url(#bottomGoldWave)"
              strokeWidth="3.5"
              filter="url(#neonGlowGold)"
              opacity="0.98"
            />
          </svg>
        </div>

        {/* ================================================================= */}
        {/* TOP-RIGHT LANGUAGE SELECTOR PILL (🌐 EN ⌄)                        */}
        {/* ================================================================= */}
        <div className="relative z-20 w-full flex justify-end pt-0.5">
          <button
            type="button"
            onClick={onOpenLanguageModal}
            className="px-3.5 py-1.5 rounded-full bg-[#04152d]/85 hover:bg-[#082246] text-white border-[1.5px] border-[#00e5ff]/85 shadow-[0_0_14px_rgba(0,229,255,0.38)] flex items-center gap-2 text-[13.5px] font-bold transition-all cursor-pointer backdrop-blur-md"
            title="Change Language"
          >
            <Globe className="w-[17px] h-[17px] text-[#00e5ff]" />
            <span className="uppercase tracking-wider">{lang}</span>
            <ChevronDown className="w-4 h-4 text-white/90 stroke-[2.5]" />
          </button>
        </div>

        {/* ================================================================= */}
        {/* CENTER EMBLEM, TITLE, SUBTITLES & NEON GLASS LOGIN CARD           */}
        {/* ================================================================= */}
        <div className="relative z-10 w-full flex flex-col items-center my-auto pt-0.5">
          {/* =============================================================== */}
          {/* EXACT CIRCULAR "POWER OF CONSTRUCTION" EMBLEM                   */}
          {/* =============================================================== */}
          <div className="relative mb-3 flex items-center justify-center">
            {/* Top Orange-Gold Neon Aura & Bottom Electric-Cyan Neon Aura */}
            <div
              className="absolute -inset-2.5 rounded-full blur-md opacity-95 pointer-events-none"
              style={{
                background:
                  'linear-gradient(180deg, rgba(251,191,36,0.92) 0%, rgba(245,158,11,0.55) 52%, rgba(0,229,255,0.92) 100%)',
              }}
            />

            {/* Exact Circular Emblem Photo */}
            <div className="relative w-[138px] h-[138px] sm:w-[144px] sm:h-[144px] rounded-full overflow-hidden shadow-[0_0_32px_rgba(251,191,36,0.55),0_10px_28px_rgba(0,229,255,0.55)] bg-[#041428] flex items-center justify-center">
              <img
                src={powerEmblemLogo}
                alt="POWER OF CONSTRUCTION"
                className="w-full h-full object-cover scale-[1.21] rounded-full select-none pointer-events-none"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          {/* Main Title: Power of Construction */}
          <h1 className="text-[30px] sm:text-[33px] font-extrabold tracking-tight leading-none text-center flex items-center justify-center gap-2 whitespace-nowrap mt-0.5">
            <span className="text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]">
              Power of
            </span>
            <span
              className="text-[#29b6f6]"
              style={{
                textShadow: '0 0 20px rgba(41, 182, 246, 0.65)',
              }}
            >
              Construction
            </span>
          </h1>

          {/* Subtitle 1: App Developed By Nayem with Flanking Golden Lines */}
          <div className="w-full flex items-center justify-center gap-3 mt-2.5">
            <span className="h-[2px] w-14 sm:w-16 bg-gradient-to-r from-transparent via-[#f59e0b] to-[#fbbf24] rounded-full" />
            <span className="text-[14.5px] sm:text-[15.5px] font-bold text-[#fbbf24] tracking-wide whitespace-nowrap drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
              App Developed By Nayem
            </span>
            <span className="h-[2px] w-14 sm:w-16 bg-gradient-to-l from-transparent via-[#f59e0b] to-[#fbbf24] rounded-full" />
          </div>

          {/* Subtitle 2: Google Sheets & Apps Script Backend */}
          <div className="flex items-center justify-center gap-2 mt-2.5 mb-4 text-[13.5px] sm:text-[14px] text-[#d8e2ef] font-normal tracking-wide drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-[19px] h-[19px] text-[#22c55e] shrink-0"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span>Google Sheets &amp; Apps Script Backend</span>
          </div>

          {/* =============================================================== */}
          {/* NEON DUAL GOLD & CYAN BORDERED FROSTED GLASS LOGIN CARD         */}
          {/* =============================================================== */}
          <div className="w-full relative rounded-[28px] p-[2px] shadow-[0_18px_50px_rgba(0,0,0,0.78),0_0_38px_rgba(0,210,255,0.22)]">
            {/* Dual Gold (Top-Left & Bottom-Right) + Cyan (Top-Right & Bottom-Left) Border */}
            <div
              className="absolute inset-0 rounded-[28px] pointer-events-none"
              style={{
                background:
                  'linear-gradient(135deg, #fde047 0%, #f59e0b 16%, #22d3ee 36%, #00e5ff 50%, #38bdf8 68%, #f59e0b 86%, #fde047 100%)',
              }}
            />
            {/* Corner & Bottom-Center Specular Neon Glows Matching Photo */}
            <div className="absolute -top-1.5 left-4 w-24 h-3 bg-amber-300/90 blur-xs rounded-full pointer-events-none" />
            <div className="absolute top-6 -left-1.5 w-2.5 h-20 bg-amber-400/80 blur-xs rounded-full pointer-events-none" />
            <div className="absolute -bottom-1.5 right-4 w-24 h-3 bg-amber-300/90 blur-xs rounded-full pointer-events-none" />
            <div className="absolute bottom-6 -right-1.5 w-2.5 h-20 bg-amber-400/80 blur-xs rounded-full pointer-events-none" />
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-2.5 bg-cyan-300 blur-xs rounded-full pointer-events-none" />

            {/* Inner Frosted Dark Navy Card */}
            <div
              className="relative rounded-[26px] px-5 sm:px-6 py-6 space-y-4 backdrop-blur-xl"
              style={{
                background:
                  'linear-gradient(180deg, rgba(10, 30, 64, 0.86) 0%, rgba(6, 18, 42, 0.92) 100%)',
              }}
            >
              {/* Alerts */}
              {error && (
                <div className="p-3 bg-rose-950/90 border border-rose-500/60 rounded-2xl flex items-start gap-2.5 text-xs text-rose-200 font-semibold animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-950/90 border border-emerald-500/60 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-200 font-semibold animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* =============================================================== */}
              {/* LOGIN METHOD SELECTOR: (A) User ID + Password/PIN (B) Mobile + OTP */}
              {/* =============================================================== */}
              <div className="grid grid-cols-2 p-1 bg-[#061833]/90 border border-[#38bdf8]/40 rounded-2xl gap-1 mb-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('password');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    loginMethod === 'password'
                      ? 'bg-gradient-to-r from-[#00d2ff] to-[#0072ff] text-white shadow-[0_0_12px_rgba(0,210,255,0.45)]'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>User ID + PIN</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('otp');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    loginMethod === 'otp'
                      ? 'bg-gradient-to-r from-[#00d2ff] to-[#0072ff] text-white shadow-[0_0_12px_rgba(0,210,255,0.45)]'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Mobile + OTP</span>
                </button>
              </div>

              {/* METHOD (A): USER ID + PASSWORD / PIN */}
              {loginMethod === 'password' ? (
                <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
                  {/* Hidden dummy inputs to prevent browser autofill */}
                  <input
                    type="text"
                    style={{ display: 'none' }}
                    tabIndex={-1}
                    aria-hidden="true"
                    autoComplete="off"
                  />
                  <input
                    type="password"
                    style={{ display: 'none' }}
                    tabIndex={-1}
                    aria-hidden="true"
                    autoComplete="new-password"
                  />

                  {/* Field 1: User ID / Phone Number */}
                  <div className="space-y-2">
                    <label
                      htmlFor="auth_login_id"
                      className="flex items-center gap-2.5 text-[15px] font-semibold text-white tracking-wide"
                    >
                      <User className="w-[19px] h-[19px] text-[#00e5ff] stroke-[2.2]" />
                      <span>
                        User ID / Phone Number{' '}
                        <span className="text-[#ef4444] font-bold">*</span>
                      </span>
                    </label>

                    <div className="relative">
                      <User className="w-5 h-5 text-[#94a3b8] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        name="auth_login_id"
                        id="auth_login_id"
                        required
                        value={loginId}
                        onChange={(e) => setLoginId(e.target.value)}
                        placeholder=""
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        className="w-full h-[52px] pl-12 pr-4 bg-[#0d264c]/80 border-[1.5px] border-[#38bdf8]/50 rounded-[16px] text-sm sm:text-base font-bold text-white focus:bg-[#102e5c] focus:outline-none focus:border-[#00e5ff] focus:shadow-[0_0_15px_rgba(0,229,255,0.35)] transition-all font-mono tracking-wider"
                      />
                    </div>
                  </div>

                  {/* Field 2: Password / PIN */}
                  <div className="space-y-2 pt-0.5">
                    <label
                      htmlFor="auth_login_pwd"
                      className="flex items-center gap-2.5 text-[15px] font-semibold text-white tracking-wide"
                    >
                      {/* Key Icon Oriented Exactly Like Photo (Bow Top-Right, Blade Bottom-Left) */}
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="w-[19px] h-[19px] text-[#00e5ff] shrink-0"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="15.5" cy="7.5" r="4.5" />
                        <path d="M12.3 10.7 3 20l3 3 2.5-2.5-1.5-1.5 2-2 1.5 1.5 2-2" />
                      </svg>
                      <span>
                        Password / PIN{' '}
                        <span className="text-[#ef4444] font-bold">*</span>
                      </span>
                    </label>

                    <div className="relative">
                      <Lock className="w-5 h-5 text-[#94a3b8] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="auth_login_pwd"
                        id="auth_login_pwd"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder=""
                        autoComplete="new-password"
                        className="w-full h-[52px] pl-12 pr-12 bg-[#0d264c]/80 border-[1.5px] border-[#38bdf8]/50 rounded-[16px] text-sm sm:text-base font-bold text-white focus:bg-[#102e5c] focus:outline-none focus:border-[#00e5ff] focus:shadow-[0_0_15px_rgba(0,229,255,0.35)] transition-all font-mono tracking-wider"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white cursor-pointer"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>

                    {/* Forgot Password Link */}
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setFpMobile(loginId.replace(/\D/g, ''));
                          setFpError(null);
                          setFpSuccess(null);
                          setFpOtpSent(false);
                          setFpOtp('');
                          setFpNewPassword('');
                          setFpConfirmPassword('');
                        }}
                        className="text-xs text-[#38bdf8] hover:text-[#7dd3fc] font-semibold underline cursor-pointer transition-colors"
                      >
                        {lang === 'bn' ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot Password?'}
                      </button>
                    </div>
                  </div>

                  {/* Glowing Electric Cyan-Blue Pill Sign In Button with Specular Top/Bottom Flares */}
                  <div className="pt-2 relative">
                    {/* Top & Bottom Specular Light Flares on Button Rim */}
                    <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-28 h-2 bg-cyan-200/90 blur-xs rounded-full pointer-events-none z-10" />
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-32 h-2.5 bg-cyan-300/95 blur-xs rounded-full pointer-events-none z-10" />

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-[56px] px-6 rounded-full text-white font-bold text-[18px] tracking-wide transition-all flex items-center justify-center gap-2.5 active:scale-[0.99] cursor-pointer disabled:opacity-60 border-[1.5px] border-[#a5f3fc] relative overflow-hidden"
                      style={{
                        background:
                          'linear-gradient(90deg, #00e1ff 0%, #0088ff 48%, #0044ff 100%)',
                        boxShadow:
                          '0 0 32px rgba(0, 176, 255, 0.8), inset 0 2px 4px rgba(255, 255, 255, 0.8), inset 0 -2px 4px rgba(0, 229, 255, 0.65)',
                      }}
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Signing in...</span>
                        </span>
                      ) : (
                        <>
                          <span className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
                            Sign In
                          </span>
                          <ArrowRight className="w-5 h-5 stroke-[2.6]" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* METHOD (B): MOBILE NUMBER + OTP (2FACTOR SMS) */
                <div className="space-y-4">
                  {/* Field 1: Registered Mobile Number */}
                  <div className="space-y-2">
                    <label
                      htmlFor="auth_otp_mobile"
                      className="flex items-center gap-2.5 text-[15px] font-semibold text-white tracking-wide"
                    >
                      <Phone className="w-[19px] h-[19px] text-[#00e5ff] stroke-[2.2]" />
                      <span>
                        Registered Mobile Number{' '}
                        <span className="text-[#ef4444] font-bold">*</span>
                      </span>
                    </label>

                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#38bdf8] font-bold text-sm pointer-events-none font-mono">
                        +91
                      </div>
                      <input
                        type="tel"
                        id="auth_otp_mobile"
                        maxLength={10}
                        disabled={otpSent || loading}
                        value={mobileNumber}
                        onChange={(e) =>
                          setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))
                        }
                        placeholder="10-digit mobile number"
                        className="w-full h-[52px] pl-14 pr-4 bg-[#0d264c]/80 border-[1.5px] border-[#38bdf8]/50 rounded-[16px] text-sm sm:text-base font-bold text-white focus:bg-[#102e5c] focus:outline-none focus:border-[#00e5ff] focus:shadow-[0_0_15px_rgba(0,229,255,0.35)] transition-all font-mono tracking-widest disabled:opacity-75"
                      />
                    </div>
                  </div>

                  {/* Field 2: 6-Digit OTP (Shown after OTP is dispatched) */}
                  {otpSent && (
                    <div className="space-y-2 pt-0.5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="auth_otp_code"
                          className="flex items-center gap-2 text-[15px] font-semibold text-white tracking-wide"
                        >
                          <Key className="w-[18px] h-[18px] text-[#00e5ff]" />
                          <span>Enter 6-Digit OTP</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setOtpSent(false);
                            setOtp('');
                            setOtpSessionId(null);
                            setError(null);
                          }}
                          className="text-xs text-[#38bdf8] hover:text-[#7dd3fc] underline cursor-pointer"
                        >
                          Change Number
                        </button>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          id="auth_otp_code"
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="• • • • • •"
                          autoFocus
                          className="w-full h-[52px] px-4 text-center bg-[#0d264c]/80 border-[1.5px] border-[#38bdf8]/50 rounded-[16px] text-xl font-bold text-white focus:bg-[#102e5c] focus:outline-none focus:border-[#00e5ff] focus:shadow-[0_0_15px_rgba(0,229,255,0.35)] transition-all font-mono tracking-[0.45em]"
                        />
                      </div>

                      <div className="flex justify-between items-center pt-1 text-xs">
                        <span className="text-slate-400">Didn't receive code?</span>
                        <button
                          type="button"
                          disabled={resendCooldown > 0 || loading}
                          onClick={handleSendLoginOtp}
                          className="text-[#38bdf8] hover:text-[#7dd3fc] font-semibold disabled:text-slate-500 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                        >
                          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                          <span>
                            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* OTP Action Button */}
                  <div className="pt-2 relative">
                    <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-28 h-2 bg-cyan-200/90 blur-xs rounded-full pointer-events-none z-10" />
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-32 h-2.5 bg-cyan-300/95 blur-xs rounded-full pointer-events-none z-10" />

                    <button
                      type="button"
                      disabled={loading || (otpSent && otp.length < 4) || (!otpSent && mobileNumber.length !== 10)}
                      onClick={otpSent ? handleVerifyLoginOtp : handleSendLoginOtp}
                      className="w-full h-[56px] px-6 rounded-full text-white font-bold text-[18px] tracking-wide transition-all flex items-center justify-center gap-2.5 active:scale-[0.99] cursor-pointer disabled:opacity-60 border-[1.5px] border-[#a5f3fc] relative overflow-hidden"
                      style={{
                        background:
                          'linear-gradient(90deg, #00e1ff 0%, #0088ff 48%, #0044ff 100%)',
                        boxShadow:
                          '0 0 32px rgba(0, 176, 255, 0.8), inset 0 2px 4px rgba(255, 255, 255, 0.8), inset 0 -2px 4px rgba(0, 229, 255, 0.65)',
                      }}
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Processing...</span>
                        </span>
                      ) : otpSent ? (
                        <>
                          <span className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
                            Verify &amp; Sign In
                          </span>
                          <ArrowRight className="w-5 h-5 stroke-[2.6]" />
                        </>
                      ) : (
                        <>
                          <span className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
                            Send Login OTP
                          </span>
                          <ArrowRight className="w-5 h-5 stroke-[2.6]" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

                {/* Authorized users only • Security Notice Box */}
                <div className="pt-1.5">
                  <div className="px-4 py-3.5 bg-[#06152d]/80 border border-[#94a3b8]/45 rounded-[16px] flex items-center gap-3.5 text-[13.5px] sm:text-[14px] text-[#e2e8f0]">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="w-6 h-6 text-[#22c55e] shrink-0"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    <div className="h-8 w-[1px] bg-[#94a3b8]/45 shrink-0" />
                    <div className="leading-snug text-left">
                      <div className="font-bold text-white">
                        Authorized users only
                      </div>
                      <div className="text-xs sm:text-[12.5px] text-slate-300 font-normal">
                        Keep your credentials safe and secure.
                      </div>
                    </div>
                  </div>
                </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* FOOTER: 4-COLUMN SYSTEM STATUS, APP VERSION, SUPPORT, COPYRIGHT   */}
        {/* ================================================================= */}
        <div className="relative z-10 mt-6 w-full max-w-[440px] flex flex-col items-center">
          {/* Glowing 4-Column Bar with Golden/Cyan Border */}
          <div
            className="w-full rounded-t-[20px] sm:rounded-t-[22px] px-2 py-3 bg-[#030e22]/95 backdrop-blur-xl border-t-[1.5px] border-x-[1.5px] border-[#facc15]/85"
            style={{
              boxShadow:
                '0 -4px 22px rgba(250, 204, 21, 0.22), 0 0 16px rgba(0, 229, 255, 0.16)',
            }}
          >
            <div className="flex items-center justify-between divide-x divide-[#38bdf8]/35">
              {/* Column 1: SYSTEM STATUS */}
              <div className="flex-1 flex flex-col items-center justify-center px-1 text-center min-w-0">
                <Activity className="w-[17px] h-[17px] text-[#00e5ff] stroke-[2.2] mb-1 drop-shadow-[0_0_6px_rgba(0,229,255,0.7)]" />
                <span className="text-[9px] sm:text-[9.5px] font-bold text-slate-200 tracking-wider uppercase leading-tight">
                  SYSTEM STATUS
                </span>
                <div className="flex items-center justify-center gap-1 text-[10px] sm:text-[10.5px] font-bold text-[#22c55e] leading-tight mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shadow-[0_0_6px_#22c55e]" />
                  <span>Online</span>
                </div>
                <span className="text-[7.5px] sm:text-[8px] text-slate-400 leading-tight mt-0.5 truncate max-w-full">
                  Service is operational
                </span>
              </div>

              {/* Column 2: APP VERSION */}
              <div className="flex-1 flex flex-col items-center justify-center px-1 text-center min-w-0">
                <Code2 className="w-[17px] h-[17px] text-[#00e5ff] stroke-[2.2] mb-1 drop-shadow-[0_0_6px_rgba(0,229,255,0.7)]" />
                <span className="text-[9px] sm:text-[9.5px] font-bold text-slate-200 tracking-wider uppercase leading-tight">
                  APP VERSION
                </span>
                <span className="text-[10px] sm:text-[10.5px] font-bold text-slate-100 leading-tight mt-0.5">
                  v1.0.0
                </span>
                <span className="text-[7.5px] sm:text-[8px] text-slate-400 leading-tight mt-0.5 truncate max-w-full">
                  Latest version
                </span>
              </div>

              {/* Column 3: SUPPORT */}
              <div className="flex-1 flex flex-col items-center justify-center px-1 text-center min-w-0">
                <Headphones className="w-[17px] h-[17px] text-[#00e5ff] stroke-[2.2] mb-1 drop-shadow-[0_0_6px_rgba(0,229,255,0.7)]" />
                <span className="text-[9px] sm:text-[9.5px] font-bold text-slate-200 tracking-wider uppercase leading-tight">
                  SUPPORT
                </span>
                <span className="text-[8.5px] sm:text-[9px] text-slate-300 leading-tight mt-0.5">
                  Need help?
                </span>
                <a
                  href="tel:8695716192"
                  className="text-[8.5px] sm:text-[9px] font-semibold text-[#00e5ff] hover:underline leading-tight mt-0.5 truncate max-w-full cursor-pointer"
                >
                  Contact support
                </a>
              </div>

              {/* Column 4: COPYRIGHT */}
              <div className="flex-1 flex flex-col items-center justify-center px-1 text-center min-w-0">
                <Copyright className="w-[17px] h-[17px] text-[#facc15] stroke-[2.2] mb-1 drop-shadow-[0_0_6px_rgba(250,204,21,0.8)]" />
                <span className="text-[7.5px] sm:text-[8px] text-slate-300 leading-tight text-center">
                  © 2026 Power of Construction.
                </span>
                <span className="text-[7px] sm:text-[7.5px] text-slate-400 leading-tight mt-0.5 whitespace-nowrap">
                  All Rights Reserved.
                </span>
              </div>
            </div>
          </div>

          {/* Centered Yellow Tagline with Lightning Bolt */}
          <div className="flex items-center justify-center gap-2 mt-2.5 mb-1 w-full px-2">
            <span className="h-[1px] flex-1 max-w-[80px] bg-gradient-to-r from-transparent to-[#f59e0b]/90" />
            <div className="flex items-center gap-1.5 text-[#fbbf24]">
              <Zap className="w-3.5 h-3.5 text-[#fbbf24] fill-[#fbbf24] drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
              <span className="text-[11px] sm:text-xs font-semibold tracking-wide text-[#fbbf24] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] whitespace-nowrap">
                Powering Every Connection.
              </span>
            </div>
            <span className="h-[1px] flex-1 max-w-[80px] bg-gradient-to-l from-transparent to-[#f59e0b]/90" />
          </div>
        </div>

        {/* ================================================================= */}
        {/* FORGOT PASSWORD MODAL (2FACTOR OTP VERIFICATION)                  */}
        {/* ================================================================= */}
        {showForgotPassword && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-[420px] rounded-[24px] p-[2px] shadow-2xl overflow-hidden font-sans">
              {/* Dual Gold & Cyan Neon Border */}
              <div
                className="absolute inset-0 rounded-[24px] pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg, #fde047 0%, #22d3ee 50%, #f59e0b 100%)',
                }}
              />

              <div className="relative rounded-[22px] bg-[#030d22] px-5 sm:px-6 py-6 space-y-4">
                {/* Header with Close */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                  <div className="flex items-center gap-2 text-white">
                    <Key className="w-5 h-5 text-[#00e5ff]" />
                    <h3 className="text-base sm:text-lg font-bold tracking-tight">
                      {lang === 'bn' ? 'পাসওয়ার্ড রিসেট' : 'Reset Password'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal Alerts */}
                {fpError && (
                  <div className="p-3 bg-rose-950/90 border border-rose-500/60 rounded-xl flex items-start gap-2.5 text-xs text-rose-200 font-semibold animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <span>{fpError}</span>
                  </div>
                )}
                {fpSuccess && (
                  <div className="p-3 bg-emerald-950/90 border border-emerald-500/60 rounded-xl flex items-start gap-2.5 text-xs text-emerald-200 font-semibold animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                    <span>{fpSuccess}</span>
                  </div>
                )}

                {/* Form Content */}
                <div className="space-y-3.5">
                  {/* Step 1: Mobile Number */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      {lang === 'bn' ? 'নিবন্ধিত মোবাইল নম্বর' : 'Registered Mobile Number'}
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#38bdf8] font-bold text-xs pointer-events-none font-mono">
                        +91
                      </div>
                      <input
                        type="tel"
                        maxLength={10}
                        disabled={fpOtpSent || loading}
                        value={fpMobile}
                        onChange={(e) => setFpMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="10-digit mobile number"
                        className="w-full h-11 pl-12 pr-3 bg-[#0d264c]/80 border border-[#38bdf8]/50 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-[#00e5ff] font-mono tracking-wider disabled:opacity-75"
                      />
                    </div>
                  </div>

                  {!fpOtpSent ? (
                    <button
                      type="button"
                      disabled={loading || fpMobile.length !== 10}
                      onClick={handleSendFpOtp}
                      className="w-full h-11 mt-1 rounded-xl bg-gradient-to-r from-[#00d2ff] to-[#0072ff] hover:opacity-95 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all shadow-md"
                    >
                      {loading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Sending OTP...</span>
                        </>
                      ) : (
                        <>
                          <span>Send Reset OTP</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  ) : (
                    /* Step 2: OTP + New Password */
                    <div className="space-y-3 pt-1 animate-in fade-in">
                      {/* OTP Input */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <label className="font-semibold text-slate-300">
                            {lang === 'bn' ? '৬-সংখ্যার ওটিপি' : '6-Digit OTP'}
                          </label>
                          <button
                            type="button"
                            disabled={fpResendCooldown > 0 || loading}
                            onClick={handleSendFpOtp}
                            className="text-[#38bdf8] hover:underline disabled:text-slate-500 cursor-pointer"
                          >
                            {fpResendCooldown > 0 ? `Resend (${fpResendCooldown}s)` : 'Resend OTP'}
                          </button>
                        </div>
                        <input
                          type="text"
                          maxLength={6}
                          value={fpOtp}
                          onChange={(e) => setFpOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="• • • • • •"
                          autoFocus
                          className="w-full h-11 text-center bg-[#0d264c]/80 border border-[#38bdf8]/50 rounded-xl text-lg font-bold text-white focus:outline-none focus:border-[#00e5ff] font-mono tracking-[0.4em]"
                        />
                      </div>

                      {/* New Password */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">
                          {lang === 'bn' ? 'নতুন পাসওয়ার্ড বা পিন' : 'New Password / PIN'}
                        </label>
                        <div className="relative">
                          <input
                            type={fpShowNewPass ? 'text' : 'password'}
                            value={fpNewPassword}
                            onChange={(e) => setFpNewPassword(e.target.value)}
                            placeholder="Minimum 4 characters"
                            className="w-full h-11 pl-3 pr-10 bg-[#0d264c]/80 border border-[#38bdf8]/50 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-[#00e5ff] font-mono tracking-wider"
                          />
                          <button
                            type="button"
                            onClick={() => setFpShowNewPass(!fpShowNewPass)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                          >
                            {fpShowNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Confirm New Password */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">
                          {lang === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm New Password'}
                        </label>
                        <input
                          type={fpShowNewPass ? 'text' : 'password'}
                          value={fpConfirmPassword}
                          onChange={(e) => setFpConfirmPassword(e.target.value)}
                          placeholder="Re-enter new password"
                          className="w-full h-11 px-3 bg-[#0d264c]/80 border border-[#38bdf8]/50 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-[#00e5ff] font-mono tracking-wider"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={loading || fpOtp.length < 4 || fpNewPassword.length < 4 || !fpConfirmPassword}
                        onClick={handleVerifyFpReset}
                        className="w-full h-11 mt-2 rounded-xl bg-gradient-to-r from-[#00d2ff] to-[#0072ff] hover:opacity-95 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all shadow-md"
                      >
                        {loading ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Updating Password...</span>
                          </>
                        ) : (
                          <>
                            <span>Update Password &amp; Sign In</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(false)}
                      className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      {lang === 'bn' ? 'লগইন পেজে ফিরে যান' : 'Back to Login'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
