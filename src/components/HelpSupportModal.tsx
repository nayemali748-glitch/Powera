import React, { useState, useEffect, useRef } from 'react';
import appLogo from '../assets/images/power_round_logo_1787860440979.jpg';
import { 
  HelpCircle, 
  X, 
  Mail, 
  MessageSquare, 
  Send, 
  Copy, 
  Check, 
  ShieldCheck, 
  User, 
  Phone, 
  AlertTriangle, 
  ExternalLink,
  RefreshCw,
  Sparkles,
  Clock,
  Radio,
  Trash2
} from 'lucide-react';
import { UserSession, ChatMessage } from '../types';
import { fetchChatMessages, sendChatMessage, clearChatMessages } from '../services/api';
import { Language, translations } from '../utils/translations';

interface HelpSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserSession | null;
  lang?: Language;
}

export const HelpSupportModal: React.FC<HelpSupportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  lang = 'bn',
}) => {
  const t = translations[lang] || translations.bn;
  const [activeTab, setActiveTab] = useState<'chat' | 'email'>('chat');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);

  // Email form state
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supportEmail = 'powerof2026@gmail.com';
  const isAdmin = currentUser?.role === 'admin';

  // Load chat messages
  const loadMessages = async () => {
    try {
      const data = await fetchChatMessages(isAdmin ? undefined : currentUser?.idNo);
      if (Array.isArray(data)) {
        setMessages(data);
      }
    } catch (err) {
      console.warn('Failed to load chat:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMessages();
      const interval = setInterval(loadMessages, 3000); // Polling every 3s
      return () => clearInterval(interval);
    }
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab, isOpen]);

  if (!isOpen) return null;

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(supportEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const newMsg = await sendChatMessage({
        senderId: currentUser?.idNo || '8695716192',
        senderName: currentUser?.name || 'Worker',
        senderRole: currentUser?.role || 'worker',
        recipientId: isAdmin ? 'all' : '8695716192',
        message: text,
      });

      setMessages(prev => [...prev, newMsg]);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleSendEmailDirect = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(emailSubject || `[WBSEDCL POWER App Support] - User: ${currentUser?.name || ''} (ID: ${currentUser?.idNo || ''})`);
    const body = encodeURIComponent(
      `${emailBody}\n\n-------------------------\nUser Details:\nName: ${currentUser?.name || ''}\nUser ID: ${currentUser?.idNo || ''}\nRole: ${currentUser?.role || ''}\nPhone: ${currentUser?.phone || ''}\nTime: ${new Date().toLocaleString()}`
    );
    window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
  };

  const handleQuickQuestion = (q: string) => {
    setInputText(q);
  };

  const handleClearChatHistory = async () => {
    if (window.confirm('Are you sure you want to clear chat history?')) {
      await clearChatMessages();
      setMessages([]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col h-[90vh] max-h-[640px]">
        {/* Top Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 p-1 flex items-center justify-center shrink-0">
              <img 
                src={appLogo} 
                alt="POWER Logo" 
                className="w-full h-full rounded-lg object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-emerald-400" />
                  <span>Help & Support Center</span>
                </h2>
                <span className="text-[10px] bg-emerald-500 text-slate-950 font-bold px-1.5 py-0.2 rounded uppercase">
                  Live 24x7
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                WBSEDCL Technical Assistance & Admin Live Chat
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <span>Live Chat Support</span>
            {messages.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-mono">
                {messages.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('email')}
            className={`py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'email'
                ? 'border-blue-600 text-blue-700 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="w-4 h-4 text-blue-600" />
            <span>Email Support</span>
          </button>
        </div>

        {/* TAB 1: LIVE CHAT SUPPORT */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Status Banner */}
            <div className="px-4 py-2 bg-emerald-50/80 border-b border-emerald-200 flex items-center justify-between text-xs text-emerald-950 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-semibold">
                  {isAdmin ? 'Admin Console: Viewing Worker Support Stream' : 'Admin Online: Engr. N. Ali (8695716192)'}
                </span>
              </div>
              {isAdmin && messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearChatHistory}
                  className="text-[11px] text-red-600 hover:underline flex items-center gap-1 font-bold"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            {/* Chat Messages List */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {/* Welcome Message */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>WBSEDCL Support Desk</span>
                  <span className="text-[10px] text-slate-400 font-normal">Auto Bot</span>
                </div>
                <p className="text-xs text-slate-600">
                  নমস্কার! অ্যাপ সংক্রান্ত যেকোনো সমস্যা, নতুন আইডি অনুমোদন বা পাসওয়ার্ড রিসেটের জন্য নিচে মেসেজ লিখুন। এডমিন সরাসরি আপনার সাথে চ্যাট করবেন।
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleQuickQuestion('আমার পাসওয়ার্ড ভুলে গেছি, রিসেট দরকার।')}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md transition-colors"
                  >
                    পাসওয়ার্ড রিসেট
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickQuestion('নতুন ওয়ার্কার আইডি তৈরির জন্য আবেদন।')}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md transition-colors"
                  >
                    নতুন আইডি আবেদন
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickQuestion('অ্যাপে ডাটা সাবমিট হতে সমস্যা হচ্ছে।')}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md transition-colors"
                  >
                    ডাটা সাবমিট ইস্যু
                  </button>
                </div>
              </div>

              {/* Chat Thread */}
              {messages.map((msg) => {
                const isMe = msg.senderId === currentUser?.idNo || (isAdmin && msg.senderRole === 'admin');
                const isMsgFromAdmin = msg.senderRole === 'admin';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5 px-1">
                      <span className="font-bold text-slate-600">{msg.senderName}</span>
                      {isMsgFromAdmin && (
                        <span className="bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-bold text-[9px]">
                          Admin HQ
                        </span>
                      )}
                      <span>•</span>
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div
                      className={`max-w-[82%] sm:max-w-[75%] rounded-2xl px-3.5 py-2 text-xs sm:text-sm shadow-xs ${
                        isMe
                          ? 'bg-emerald-600 text-white rounded-tr-none'
                          : isMsgFromAdmin
                          ? 'bg-slate-900 text-white rounded-tl-none border border-slate-800'
                          : 'bg-white text-slate-900 rounded-tl-none border border-slate-200'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="এখানে মেসেজ লিখুন (Type your message here)..."
                className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || sending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: EMAIL SUPPORT */}
        {activeTab === 'email' && (
          <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50">
            {/* Main Email Support Card */}
            <div className="bg-white rounded-2xl border border-blue-200 p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Official WBSEDCL Support Email</h3>
                  <p className="text-xs text-slate-500">
                    যেকোনো অভিযোগ, রিপোর্ট বা পরামর্শের জন্য সরাসরি ইমেইল করুন
                  </p>
                </div>
              </div>

              {/* Email Address Pill with Copy & Action */}
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-xs sm:text-sm font-mono font-bold text-blue-700 truncate">
                    {supportEmail}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Copy Email ID"
                  >
                    {copiedEmail ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedEmail ? 'Copied' : 'Copy'}</span>
                  </button>

                  <a
                    href={`mailto:${supportEmail}?subject=WBSEDCL%20POWER%20App%20Support`}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Mail</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Quick Email Compose Form */}
            <form onSubmit={handleSendEmailDirect} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Send Quick Support Email</span>
              </h4>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subject / বিষয়</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="e.g. Issue regarding Meter Replacement submission"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Message Description / বিস্তারিত বার্তা</label>
                <textarea
                  rows={3}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="আপনার সমস্যা বা মতামত বিস্তারিত লিখুন..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                <span>Send via Email Client (powerof2026@gmail.com)</span>
              </button>
            </form>

            {/* Emergency Hotline Numbers */}
            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <Phone className="w-3.5 h-3.5" />
                <span>Emergency Breakdown & Hotline Support:</span>
              </div>
              <p className="text-amber-800">
                • WBSEDCL Toll Free Helpline: <strong>19121</strong>
              </p>
              <p className="text-amber-800">
                • Admin Control Officer: <strong>+91 86957 16192</strong>
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 px-5 shrink-0">
          <span className="font-medium">Power of Construction • 24/7 Field Support</span>
          <button
            type="button"
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
