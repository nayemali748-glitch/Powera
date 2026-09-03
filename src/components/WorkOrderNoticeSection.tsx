import React, { useState, useEffect } from 'react';
import { 
  FileImage, 
  Upload, 
  Trash2, 
  Clock, 
  Calendar, 
  Eye, 
  EyeOff,
  Download, 
  PlusCircle, 
  ShieldCheck, 
  X, 
  ZoomIn, 
  Sparkles, 
  RefreshCw,
  FileText,
  AlertCircle,
  Lock,
  Unlock,
  CheckCircle2,
  SlidersHorizontal,
  ExternalLink
} from 'lucide-react';
import { CategoryType, WorkOrderNotice, UserSession } from '../types';
import { fetchWorkOrders, uploadWorkOrder, deleteWorkOrder, toggleWorkOrderVisibility } from '../services/api';
import { Language } from '../utils/translations';
import { compressImageFile } from '../utils/imageCompressor';

interface WorkOrderNoticeSectionProps {
  category?: CategoryType | 'ALL';
  currentUser: UserSession | null;
  lang?: Language;
  selectedNoticeId?: string;
  onSelectNotice?: (notice: WorkOrderNotice | null) => void;
  onStartWorkWithNotice?: (notice: WorkOrderNotice) => void;
  isAdmin?: boolean;
  standalonePage?: boolean;
}

export const WorkOrderNoticeSection: React.FC<WorkOrderNoticeSectionProps> = ({
  category = 'ALL',
  currentUser,
  lang = 'bn',
  selectedNoticeId,
  onSelectNotice,
  onStartWorkWithNotice,
  isAdmin: propIsAdmin,
  standalonePage = false,
}) => {
  const [notices, setNotices] = useState<WorkOrderNotice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [previewNotice, setPreviewNotice] = useState<WorkOrderNotice | null>(null);

  // Active Category Filter for viewing
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>(category || 'ALL');

  // Upload Form State
  const [uploadCategory, setUploadCategory] = useState<string>(category && category !== 'ALL' ? category : 'ALL');
  const [uploadTitle, setUploadTitle] = useState<string>('WBSEDCL Daily Work Order & Khata Slip');
  const [uploadDescription, setUploadDescription] = useState<string>('');
  const [uploadIsHidden, setUploadIsHidden] = useState<boolean>(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);

  // In-App Toast & Confirmation Modal States (eliminates buggy browser alert / confirm)
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [confirmDeleteNotice, setConfirmDeleteNotice] = useState<WorkOrderNotice | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast(prev => prev?.text === text ? null : prev);
    }, 4000);
  };

  // Strictly verify Admin role: Workers NEVER have admin rights
  const isAdmin = currentUser?.role === 'worker'
    ? false
    : Boolean(
        propIsAdmin ||
        currentUser?.role?.toLowerCase() === 'admin' ||
        currentUser?.idNo === '8695716192' ||
        currentUser?.idNo === 'controller' ||
        currentUser?.idNo === 'administration' ||
        currentUser?.phone?.replace(/[^0-9]/g, '') === '8695716192' ||
        localStorage.getItem('power_is_admin') === 'true'
      );

  const loadNotices = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      // If ALL is selected, fetch all notices; otherwise fetch by category
      const filter = selectedCategoryTab === 'ALL' ? undefined : (selectedCategoryTab as CategoryType);
      const data = await fetchWorkOrders(filter);
      setNotices(data);
      // Auto select latest visible notice if not yet selected and onSelectNotice provided
      const currentVisible = isAdmin ? data : data.filter(n => !n.isHidden);
      if (currentVisible.length > 0 && onSelectNotice && !selectedNoticeId) {
        onSelectNotice(currentVisible[0]);
      }
    } catch (err) {
      console.error('Failed to load work orders:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadNotices(false);
    // Background polling every 12 seconds when tab is visible
    const interval = setInterval(() => {
      if (!document.hidden) {
        loadNotices(true);
      }
    }, 12000);

    const onFocus = () => {
      if (!document.hidden) loadNotices(true);
    };
    const onVisibilityChange = () => {
      if (!document.hidden) loadNotices(true);
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [selectedCategoryTab, isAdmin]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        showToast(lang === 'bn' ? 'ফাইল সাইজ ৫০ MB এর কম হতে হবে' : 'File size must be under 50 MB', 'error');
        return;
      }
      try {
        setIsCompressing(true);
        const compressedBase64 = await compressImageFile(file, {
          maxDimension: 1600,
          quality: 0.82,
          watermarkText: 'WBSEDCL OFFICIAL NOTICE',
        });
        if (compressedBase64) {
          setPhotoPreview(compressedBase64);
        } else {
          showToast(lang === 'bn' ? 'ছবি পড়তে সমস্যা হয়েছে, অনুগ্রহ করে আবার চেষ্টা করুন' : 'Failed to read image, please try again', 'error');
        }
      } catch (err) {
        console.error('Photo compression error:', err);
      } finally {
        setIsCompressing(false);
        e.target.value = '';
      }
    }
  };

  const handleCreateSampleKhataPhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#fffbeb';
      ctx.fillRect(0, 0, 600, 400);

      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 3;
      ctx.strokeRect(10, 10, 580, 380);

      ctx.fillStyle = '#78350f';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('⚡ WBSEDCL - NSC DAILY WORK ORDER KHATA', 25, 45);

      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`DATE: ${new Date().toLocaleDateString('en-GB')}  |  FEEDER: TOWN-1`, 25, 75);

      // Lines simulating khata
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      for (let y = 100; y <= 350; y += 30) {
        ctx.beginPath();
        ctx.moveTo(25, y);
        ctx.lineTo(575, y);
        ctx.stroke();
      }

      ctx.fillStyle = '#1e293b';
      ctx.font = '13px sans-serif';
      ctx.fillText('1. Con: Anup Das | App: CA-9812 | Meter: WB26-88124 | Load: 2kW', 30, 120);
      ctx.fillText('2. Con: Rekha Roy | App: CA-9815 | Meter: WB26-88125 | Load: 1kW', 30, 150);
      ctx.fillText('3. Con: Subir Paul | App: CA-9820 | Meter: WB26-88128 | Load: 3kW', 30, 180);
      ctx.fillText('4. Con: Sk. Nazrul | App: CA-9822 | Meter: WB26-88130 | Load: 2kW', 30, 210);

      ctx.fillStyle = '#059669';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('✓ Approved by WBSEDCL Sub-Division Office', 30, 320);

      setPhotoPreview(canvas.toDataURL('image/jpeg', 0.85));
    }
  };

  const handleUploadSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!uploadTitle.trim()) {
      showToast(lang === 'bn' ? 'অনুগ্রহ করে ওয়ার্ক অর্ডারের শিরোনাম দিন' : 'Please provide a title for the work order', 'error');
      return;
    }
    if (!photoPreview) {
      showToast(lang === 'bn' ? 'অনুগ্রহ করে ওয়ার্ক অর্ডার বা খাতার ছবি নির্বাচন করুন' : 'Please select work order or khata photo', 'error');
      return;
    }

    try {
      setIsUploading(true);
      const savedNotice = await uploadWorkOrder({
        category: (uploadCategory === 'ALL' ? 'NSC' : uploadCategory) as CategoryType,
        title: uploadTitle.trim() || 'WBSEDCL Work Order / Khata Notice',
        photoUrl: photoPreview,
        description: uploadDescription.trim(),
        uploadedBy: currentUser?.idNo || '8695716192',
        adminName: currentUser?.name || 'Engr. N. Ali (Admin Controller)',
        adminPhone: currentUser?.phone || '8695716192',
        isHidden: uploadIsHidden,
      });

      setShowUploadModal(false);
      setPhotoPreview(null);
      setUploadDescription('');
      setUploadIsHidden(false);
      
      // Reload notices list
      await loadNotices();
      
      // Auto select the newly uploaded notice for current NSC entry
      if (savedNotice && onSelectNotice) {
        onSelectNotice(savedNotice);
      }
      
      showToast(lang === 'bn' ? '✓ ওয়ার্ক অর্ডার / খাতার ছবি সফলভাবে আপলোড হয়েছে!' : '✓ Work Order photo uploaded successfully!', 'success');
    } catch (err: any) {
      console.error('Work order upload error:', err);
      showToast(`Upload failed: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleHide = async (id: string, currentHidden: boolean, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      const newHiddenState = !currentHidden;
      
      // Optimistic UI update immediately
      setNotices(prev => prev.map(n => n.id === id ? { ...n, isHidden: newHiddenState } : n));
      if (previewNotice?.id === id) {
        setPreviewNotice(prev => prev ? { ...prev, isHidden: newHiddenState } : null);
      }
      
      await toggleWorkOrderVisibility(id, newHiddenState);
      
      const msg = newHiddenState
        ? (lang === 'bn' ? '🔒 ছবিটি ফিল্ড কর্মীদের থেকে সফলভাবে লুকিয়ে রাখা হয়েছে (Hidden from Workers)' : '🔒 Photo is now hidden from field workers')
        : (lang === 'bn' ? '👁️ ছবিটি এখন ফিল্ড কর্মীদের কাছে দৃশ্যমান করা হয়েছে (Visible to Workers)' : '👁️ Photo is now visible to field workers');
      
      showToast(msg, newHiddenState ? 'info' : 'success');
    } catch (err: any) {
      console.error('Toggle hide error:', err);
      showToast(`Visibility update failed: ${err.message || 'Error'}`, 'error');
    }
  };

  const handleOpenDeleteConfirm = (notice: WorkOrderNotice, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setConfirmDeleteNotice(notice);
  };

  const executeDeleteNotice = async () => {
    if (!confirmDeleteNotice) return;
    try {
      setIsDeleting(true);
      const id = confirmDeleteNotice.id;
      
      // Execute deletion
      await deleteWorkOrder(id);
      
      // Update local state
      setNotices(prev => prev.filter(n => n.id !== id));
      if (previewNotice?.id === id) setPreviewNotice(null);
      if (selectedNoticeId === id && onSelectNotice) onSelectNotice(null);
      
      setConfirmDeleteNotice(null);
      showToast(lang === 'bn' ? '✓ ওয়ার্ক অর্ডার ছবিটি সফলভাবে মুছে ফেলা হয়েছে।' : '✓ Work Order photo deleted successfully.', 'success');
      
      // Reload in background
      loadNotices();
    } catch (err: any) {
      console.error('Delete error:', err);
      showToast(`Delete failed: ${err.message || 'Error'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = (photoUrl: string, title: string) => {
    const link = document.createElement('a');
    link.href = photoUrl;
    link.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter notices for display: Admins see all with hidden badges; Workers ONLY see non-hidden ones
  const displayedNotices = isAdmin ? notices : notices.filter(n => !n.isHidden);
  const hiddenCount = notices.filter(n => n.isHidden).length;

  return (
    <div className="bg-linear-to-r from-amber-500/10 via-amber-50/70 to-emerald-500/10 border-2 border-amber-400/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-300/60 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs shrink-0">
            <FileImage className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-amber-950 tracking-tight flex items-center gap-1.5">
                <span>{lang === 'bn' ? 'অফিসিয়াল ওয়ার্ক অর্ডার ও খাতার ছবি (Work Order / Khata Photo)' : 'Official Work Order & Khata Photo Board'}</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs">
                {displayedNotices.length > 0 ? `${displayedNotices.length} Photo${displayedNotices.length > 1 ? 's' : ''}` : 'Live Notice'}
              </span>
              {isAdmin && hiddenCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white shadow-xs flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>{hiddenCount} {lang === 'bn' ? 'কর্মীদের থেকে লুকানো' : 'Hidden'}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-amber-900/80 mt-0.5">
              {lang === 'bn' 
                ? 'এডমিন কর্তৃক আপলোডকৃত ওয়ার্ক অর্ডার বা খাতার ছবি দেখে ফিল্ডে সঠিক কনজিউমার ও মিটার ডেটা পূরণ করুন'
                : 'View official work orders / khata slips uploaded by Admin with real-time Date & Time'}
            </p>
          </div>
        </div>

        {/* Action Buttons: Admin Upload + Refresh */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadNotices}
            className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 shadow-xs text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            title="Refresh Notices"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
            <span className="hidden sm:inline text-[11px] font-semibold">{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
          </button>

          {isAdmin ? (
            <button
              type="button"
              id="admin-upload-work-order-btn"
              onClick={() => {
                setUploadIsHidden(false);
                setShowUploadModal(true);
              }}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{lang === 'bn' ? '+ ওয়ার্ক অর্ডার / খাতার ছবি আপলোড' : '+ Upload Work Order Photo'}</span>
            </button>
          ) : (
            <div className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-xs">
              <Eye className="w-3.5 h-3.5 text-emerald-700" />
              <span>{lang === 'bn' ? '👁️ ভিউ মোড (Worker View Only)' : '👁️ View Only Mode'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Category Filter Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
        <span className="text-[11px] font-black text-amber-900 flex items-center gap-1 mr-1 shrink-0">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? 'ক্যাটাগরি ফিল্টার:' : 'Category Filter:'}</span>
        </span>
        {[
          { id: 'ALL', label: lang === 'bn' ? 'সব ক্যাটাগরি (All)' : 'All Notices' },
          { id: 'NSC', label: 'NSC' },
          { id: 'DISCONNECTION', label: 'DISCONNECTION' },
          { id: 'POLE CASE', label: 'POLE CASE' },
          { id: 'METER REPLESMENT', label: 'METER REPLESMENT' },
          { id: 'DTR REPLESMENT', label: 'DTR REPLESMENT' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSelectedCategoryTab(tab.id)}
            className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategoryTab === tab.id
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white/90 hover:bg-white text-slate-700 border border-amber-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notice Photos Carousel / Grid */}
      {displayedNotices.length === 0 ? (
        <div className="bg-white/80 border border-dashed border-amber-300 rounded-xl p-5 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <p className="text-xs font-bold text-slate-700">
            {lang === 'bn' ? 'বর্তমানে কোনো ওয়ার্ক অর্ডার বা খাতার ছবি দৃশ্যমান নেই' : 'No Work Order or Khata photos available'}
          </p>
          <p className="text-[11px] text-slate-500 max-w-md mx-auto">
            {lang === 'bn' 
              ? 'এডমিন ব্যক্তি খাতা বা ওয়ার্ক অর্ডারের ছবি আপলোড ও দৃশ্যমান রাখলে কর্মীরা এখানে দেখতে পাবেন।'
              : 'When Admin uploads a work order photo, it will appear here for field workers.'}
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setUploadIsHidden(false);
                setShowUploadModal(true);
              }}
              className="mt-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{lang === 'bn' ? 'ওয়ার্ক অর্ডার ছবি আপলোড করুন' : 'Upload Work Order Photo'}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {displayedNotices.map((notice) => {
            const isSelected = selectedNoticeId === notice.id;
            const isNoticeHidden = Boolean(notice.isHidden);
            return (
              <div
                key={notice.id}
                onClick={() => setPreviewNotice(notice)}
                className={`bg-white border-2 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between ${
                  isNoticeHidden
                    ? 'border-dashed border-rose-300 bg-rose-50/20'
                    : isSelected 
                      ? 'border-emerald-500 ring-2 ring-emerald-400/40' 
                      : 'border-amber-200/90 hover:border-amber-400'
                }`}
              >
                {/* Photo Header & Action Controls */}
                <div className={`p-3 border-b flex items-start justify-between gap-2 ${
                  isNoticeHidden ? 'bg-rose-50/80 border-rose-200' : 'bg-amber-50/70 border-amber-100'
                }`}>
                  <div className="overflow-hidden flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-black text-slate-900 truncate group-hover:text-amber-700 transition-colors">
                        {notice.title}
                      </h4>
                      {isNoticeHidden ? (
                        <span className="shrink-0 bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" />
                          <span>{lang === 'bn' ? 'লুকানো' : 'Hidden'}</span>
                        </span>
                      ) : isSelected ? (
                        <span className="shrink-0 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                          {lang === 'bn' ? 'লিংকড' : 'Attached'}
                        </span>
                      ) : null}
                    </div>
                    {/* UPLOAD DATE & TIME BADGE */}
                    <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-slate-600 flex-wrap">
                      <span className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-amber-200 text-amber-900">
                        <Calendar className="w-3 h-3 text-amber-600" />
                        <span>{notice.uploadDate}</span>
                      </span>
                      <span className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-900">
                        <Clock className="w-3 h-3 text-blue-600" />
                        <span>{notice.uploadTime}</span>
                      </span>
                    </div>
                  </div>

                  {/* Admin Direct Action Buttons (Hide / Unhide & Delete) */}
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Hide / Unhide Toggle Button */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleHide(notice.id, isNoticeHidden, e)}
                        className={`p-1.5 sm:px-2 sm:py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs border ${
                          isNoticeHidden 
                            ? 'text-white bg-rose-600 hover:bg-rose-700 border-rose-700' 
                            : 'text-amber-900 bg-amber-100 hover:bg-amber-200 border-amber-300'
                        }`}
                        title={
                          isNoticeHidden 
                            ? (lang === 'bn' ? 'কর্মীদের জন্য দৃশ্যমান করুন (Show to Workers)' : 'Show to workers') 
                            : (lang === 'bn' ? 'কর্মীদের থেকে লুকান (Hide from Workers)' : 'Hide from workers')
                        }
                      >
                        {isNoticeHidden ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">
                          {isNoticeHidden ? (lang === 'bn' ? 'দৃশ্যমান করুন' : 'Unhide') : (lang === 'bn' ? 'লুকান' : 'Hide')}
                        </span>
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenDeleteConfirm(notice, e)}
                        className="p-1.5 text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 rounded-lg transition-colors cursor-pointer shadow-xs"
                        title={lang === 'bn' ? 'মুছে ফেলুন (Delete Work Order Photo)' : 'Delete Work Order Photo'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Photo Thumbnail */}
                <div className="relative h-44 bg-slate-900 overflow-hidden flex items-center justify-center">
                  <img
                    src={notice.photoUrl}
                    alt={notice.title}
                    className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${
                      isNoticeHidden ? 'opacity-70 filter grayscale-[30%]' : ''
                    }`}
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Status Banner when Hidden */}
                  {isNoticeHidden && (
                    <div className="absolute top-2 left-2 bg-rose-900/90 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded border border-rose-400 flex items-center gap-1 shadow-sm">
                      <Lock className="w-3 h-3 text-rose-300" />
                      <span>{lang === 'bn' ? 'কর্মীদের থেকে লুকানো (Hidden)' : 'Hidden from Workers'}</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="px-3 py-1.5 bg-amber-500 text-slate-950 font-black text-xs rounded-lg flex items-center gap-1.5 shadow-md">
                      <ZoomIn className="w-4 h-4" />
                      <span>{lang === 'bn' ? 'বড় করে দেখুন' : 'Full Screen'}</span>
                    </span>
                  </div>

                  {/* Date & Time Watermark on Bottom Right of Image */}
                  <div className="absolute bottom-2 right-2 bg-slate-950/80 backdrop-blur-xs text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded border border-white/20">
                    {notice.uploadDate} {notice.uploadTime}
                  </div>
                </div>

                {/* Footer Info & Attach Button */}
                <div className="p-2.5 bg-white flex items-center justify-between gap-2 text-[11px] border-t border-slate-100 flex-wrap">
                  <span className="text-slate-500 font-medium truncate text-[10px]">
                    Admin: <strong className="text-slate-800">{notice.adminName}</strong>
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    {onStartWorkWithNotice && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartWorkWithNotice(notice);
                        }}
                        className="px-2.5 py-1 rounded text-[10px] font-black bg-amber-600 hover:bg-amber-700 text-white shadow-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                        title="এই ওয়ার্ক অর্ডার নিয়ে ফর্ম পূরণ শুরু করুন"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{lang === 'bn' ? 'কাজ শুরু করুন' : 'Start Work'}</span>
                      </button>
                    )}

                    {onSelectNotice ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectNotice(notice);
                        }}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-emerald-600 text-white shadow-xs' 
                            : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                        }`}
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{isSelected ? (lang === 'bn' ? '✓ ফর্মের সাথে যুক্ত' : '✓ Linked') : (lang === 'bn' ? 'লিংক করুন' : 'Link')}</span>
                      </button>
                    ) : !onStartWorkWithNotice ? (
                      <span className="text-amber-700 font-bold flex items-center gap-1 text-[10px]">
                        <Eye className="w-3 h-3" />
                        {lang === 'bn' ? 'ক্লিক করে দেখুন' : 'Click to View'}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FULL SCREEN PHOTO PREVIEW LIGHTBOX MODAL */}
      {previewNotice && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header with Date and Time */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 text-white">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-amber-400">
                    {previewNotice.title}
                  </h3>
                  {previewNotice.isHidden && (
                    <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center gap-1 shadow-xs">
                      <Lock className="w-3 h-3" />
                      <span>{lang === 'bn' ? 'কর্মীদের থেকে লুকানো' : 'Hidden from Workers'}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-300 mt-1 font-mono flex-wrap">
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Upload Date: {previewNotice.uploadDate}</span>
                  </span>
                  <span className="flex items-center gap-1 text-sky-400 font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Time: {previewNotice.uploadTime}</span>
                  </span>
                  <span className="text-slate-400 hidden sm:inline">
                    By: {previewNotice.adminName}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Admin Toggle Hide/Unhide in Modal */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => handleToggleHide(previewNotice.id, Boolean(previewNotice.isHidden), e)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                      previewNotice.isHidden 
                        ? 'bg-rose-700 hover:bg-rose-800 text-white border-rose-600' 
                        : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                    }`}
                    title="Toggle worker visibility"
                  >
                    {previewNotice.isHidden ? <Unlock className="w-3.5 h-3.5 text-emerald-300" /> : <Lock className="w-3.5 h-3.5 text-rose-300" />}
                    <span>
                      {previewNotice.isHidden 
                        ? (lang === 'bn' ? '👁️ কর্মীদের দেখান (Unhide)' : '👁️ Show to Workers') 
                        : (lang === 'bn' ? '🔒 কর্মীদের থেকে লুকান (Hide)' : '🔒 Hide from Workers')}
                    </span>
                  </button>
                )}

                {/* Admin Delete in Modal */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => handleOpenDeleteConfirm(previewNotice, e)}
                    className="px-3 py-1.5 bg-red-950/80 hover:bg-red-900 text-red-300 hover:text-white border border-red-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Delete Work Order Photo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'ডিলিট' : 'Delete'}</span>
                  </button>
                )}

                {onStartWorkWithNotice && (
                  <button
                    type="button"
                    onClick={() => {
                      onStartWorkWithNotice(previewNotice);
                      setPreviewNotice(null);
                    }}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? '⚡ এই কাজ শুরু করুন' : '⚡ Start Work'}</span>
                  </button>
                )}

                {onSelectNotice && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectNotice(previewNotice);
                      setPreviewNotice(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      selectedNoticeId === previewNotice.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {selectedNoticeId === previewNotice.id
                        ? (lang === 'bn' ? '✓ ফর্মের সাথে যুক্ত আছে' : '✓ Linked to Form')
                        : (lang === 'bn' ? '✓ এই খাতার ছবি সংযুক্ত করুন' : '✓ Link This Photo to Entry')}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDownload(previewNotice.photoUrl, previewNotice.title)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                  title="Download Photo"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">{lang === 'bn' ? 'ডাউনলোড' : 'Download'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewNotice(null)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Zoomable Image View */}
            <div className="flex-1 overflow-auto p-4 bg-slate-950 flex items-center justify-center">
              <img
                src={previewNotice.photoUrl}
                alt={previewNotice.title}
                className="max-w-full max-h-[68vh] object-contain rounded-lg border border-slate-800 shadow-lg"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Modal Footer */}
            {previewNotice.description && (
              <div className="p-3 bg-slate-900 border-t border-slate-800 text-xs text-slate-300">
                <span className="font-bold text-amber-400">{lang === 'bn' ? 'নির্দেশনা / বিবরণ:' : 'Instructions:'} </span>
                {previewNotice.description}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADMIN UPLOAD WORK ORDER MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white border-2 border-amber-400/80 rounded-2xl w-full max-w-lg max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Sticky Header */}
            <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-amber-500/30">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer mr-1"
                  title="Back / পেছনে যান"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white leading-tight">
                    {lang === 'bn' ? 'ওয়ার্ক অর্ডার বা খাতার ছবি আপলোড' : 'Upload Work Order / Khata Photo'}
                  </h3>
                  <p className="text-[11px] text-amber-300 font-medium">
                    {lang === 'bn' ? 'তারিখ ও সময় স্বয়ংক্রিয়ভাবে সেভ হবে' : 'Date & Time will be auto recorded'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-2.5 py-1 bg-red-600/80 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'বন্ধ করুন' : 'Close'}</span>
              </button>
            </div>

            {/* Modal Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  {lang === 'bn' ? '১. ওয়ার্ক অর্ডার / খাতার শিরোনাম (Title)' : '1. Work Order Title'} *
                </label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. NSC Daily Work Order / Khata Slip - Feeder 1"
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 focus:border-amber-500 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  {lang === 'bn' ? 'ক্যাটাগরি নির্ধারণ করুন (Work Category)' : 'Select Category'} *
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 focus:border-amber-500 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
                >
                  <option value="ALL">{lang === 'bn' ? 'সব ক্যাটাগরি / সাধারণ নোটিশ (সকল ফিল্ড কর্মী দেখতে পাবেন)' : 'ALL (Visible to All Field Workers)'}</option>
                  <option value="NSC">NSC (নতুন বিদ্যুৎ সংযোগ)</option>
                  <option value="DISCONNECTION">DISCONNECTION (লাইন বিচ্ছিন্নকরণ)</option>
                  <option value="POLE CASE">POLE CASE (খুঁটি সংক্রান্ত কাজ)</option>
                  <option value="METER REPLESMENT">METER REPLESMENT (মিটার পরিবর্তন)</option>
                  <option value="DTR REPLESMENT">DTR REPLESMENT (ট্রান্সফরমার কাজ)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {lang === 'bn' ? 'যে ক্যাটাগরি নির্বাচন করবেন, সেই ক্যাটাগরির কর্মীরা এটি দ্রুত দেখতে পাবেন।' : 'Field workers in this category will see this order notice.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  {lang === 'bn' ? '২. খাতা বা ওয়ার্ক অর্ডারের ছবি সিলেক্ট করুন (Photo)' : '2. Select Khata / Work Order Photo'} *
                </label>
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-600 file:text-white hover:file:bg-amber-700 cursor-pointer border-2 border-amber-300 rounded-lg p-2 bg-amber-50/50"
                  />
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] text-slate-500">
                      {lang === 'bn' ? '📷 ক্যামেরা বা ফাইল থেকে ছবি দিন' : '📷 Take photo or upload from gallery'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCreateSampleKhataPhoto}
                      className="text-[11px] font-bold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded-md border border-amber-300 cursor-pointer transition-colors"
                    >
                      {lang === 'bn' ? '⚡ ডেমো খাতার ছবি তৈরি করুন' : '⚡ Generate Sample Khata'}
                    </button>
                  </div>
                  {isCompressing && (
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs font-bold flex items-center gap-2 animate-pulse">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span>{lang === 'bn' ? 'ছবি প্রস্তুত ও অপ্টিমাইজ করা হচ্ছে...' : 'Optimizing and processing photo...'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Photo Preview Box */}
              {photoPreview && (
                <div className="border-2 border-emerald-500 rounded-xl overflow-hidden bg-slate-950 p-2 relative shadow-md">
                  <div className="flex items-center justify-between px-1 pb-1 mb-1 border-b border-slate-800 text-[11px]">
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {lang === 'bn' ? 'নির্বাচিত ছবি প্রিভিউ:' : 'Photo Selected Preview:'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPhotoPreview(null)}
                      className="text-red-400 hover:text-red-300 font-bold text-[10px] underline cursor-pointer"
                    >
                      {lang === 'bn' ? 'ছবি সরান' : 'Remove'}
                    </button>
                  </div>
                  <img
                    src={photoPreview}
                    alt="Work Order Preview"
                    className="max-h-44 w-full object-contain rounded-lg bg-black/40"
                    referrerPolicy="no-referrer"
                  />
                  <div className="mt-1.5 text-center bg-slate-900/90 py-1 rounded border border-slate-800">
                    <span className="text-[10px] text-emerald-400 font-bold font-mono">
                      ✓ Ready: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </div>
                </div>
              )}

              {/* Visibility / Hide from Workers Option */}
              <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uploadIsHidden}
                    onChange={(e) => setUploadIsHidden(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-rose-600" />
                      <span className="text-xs font-black text-slate-900">
                        {lang === 'bn' ? 'ফিল্ড কর্মীদের থেকে লুকিয়ে রাখুন (Hide from Workers)' : 'Hide from field workers'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-tight">
                      {lang === 'bn' 
                        ? 'এটি টিক দিলে কর্মীরা এই ওয়ার্ক অর্ডারটি দেখতে পাবেন না, শুধু এডমিন প্যানেলে সংরক্ষিত থাকবে। যেকোনো সময় উন্মুক্ত করতে পারবেন।'
                        : 'If checked, workers will not see this photo until unhidden by Admin.'}
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  {lang === 'bn' ? '৩. ফিল্ড নির্দেশ বা নোট (ঐচ্ছিক)' : '3. Field Instructions / Notes (Optional)'}
                </label>
                <textarea
                  rows={2}
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="e.g. আজকের সব নতুন সার্ভিস কানেকশন ৩টার মধ্যে সম্পন্ন করুন"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Current Date & Time Banner */}
              <div className="p-2.5 bg-amber-50/90 rounded-xl border border-amber-200 text-amber-950 text-xs flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="font-medium">
                  <strong>{lang === 'bn' ? 'রেকর্ডকৃত আপলোড সময়:' : 'Recorded Time:'}</strong> {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} - {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
              </div>
            </div>

            {/* Modal STICKY ALWAYS-VISIBLE Footer with Save, Cancel & Back Buttons */}
            <div className="p-3 sm:p-4 bg-slate-50 border-t-2 border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-3 sm:px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <X className="w-4 h-4 text-slate-500" />
                  <span>{lang === 'bn' ? 'বাতিল / পেছনে যান (Back)' : 'Cancel / Back'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleUploadSubmit}
                disabled={isUploading || !photoPreview}
                className="px-4 sm:px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>
                  {isUploading
                    ? (lang === 'bn' ? 'আপলোড হচ্ছে...' : 'Uploading...')
                    : (lang === 'bn' ? '✓ সেভ ও আপলোড করুন (Save & Upload)' : '✓ Save & Upload Photo')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP TOAST ALERT BANNER */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className={`p-4 rounded-xl shadow-2xl border flex items-center gap-3 ${
            toast.type === 'error'
              ? 'bg-red-900/95 border-red-500 text-white'
              : toast.type === 'info'
                ? 'bg-slate-900/95 border-amber-500 text-amber-200'
                : 'bg-emerald-950/95 border-emerald-500 text-emerald-100'
          }`}>
            <div className="shrink-0">
              {toast.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-400" />
              ) : toast.type === 'info' ? (
                <Lock className="w-5 h-5 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <p className="text-xs sm:text-sm font-bold flex-1">{toast.text}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* CUSTOM IN-APP DELETE CONFIRMATION MODAL */}
      {confirmDeleteNotice && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border-2 border-red-500 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-red-600 text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black leading-tight">
                  {lang === 'bn' ? 'ওয়ার্ক অর্ডার ডিলিট নিশ্চিত করুন' : 'Confirm Delete Work Order'}
                </h3>
                <p className="text-xs text-red-100 font-medium">
                  {lang === 'bn' ? 'স্থায়ীভাবে মুছে ফেলার সতর্কতা' : 'Permanent deletion warning'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDeleteNotice(null)}
                className="p-1 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 font-medium">
                {lang === 'bn' 
                  ? '⚠️ আপনি কি নিশ্চিতভাবে এই ওয়ার্ক অর্ডার / খাতার ছবিটি মুছে ফেলতে চান? মুছে ফেললে সার্ভার ও ক্লাউড ডাটাবেস থেকে স্থায়ীভাবে অপসারিত হবে।'
                  : '⚠️ Are you sure you want to permanently delete this Work Order / Khata photo? This action cannot be undone.'}
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <img
                  src={confirmDeleteNotice.photoUrl}
                  alt={confirmDeleteNotice.title}
                  className="w-14 h-14 object-cover rounded-lg border border-slate-300 shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="overflow-hidden flex-1 text-xs">
                  <h4 className="font-bold text-slate-900 truncate">{confirmDeleteNotice.title}</h4>
                  <p className="text-slate-500 font-mono text-[11px] mt-0.5">
                    {confirmDeleteNotice.uploadDate} - {confirmDeleteNotice.uploadTime}
                  </p>
                  <p className="text-slate-600 text-[11px]">By: {confirmDeleteNotice.adminName}</p>
                </div>
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteNotice(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                {lang === 'bn' ? 'বাতিল (Cancel)' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={executeDeleteNotice}
                disabled={isDeleting}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-xl text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>
                  {isDeleting
                    ? (lang === 'bn' ? 'মুছে ফেলা হচ্ছে...' : 'Deleting...')
                    : (lang === 'bn' ? 'হ্যাঁ, ডিলিট করুন' : 'Yes, Delete Permanently')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
