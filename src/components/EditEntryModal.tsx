import React, { useState } from 'react';
import { 
  X, 
  Save, 
  Trash2, 
  Zap, 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { PowerEntry, StatusType } from '../types';
import { updateEntry, deleteEntry } from '../services/api';
import { Language, translations } from '../utils/translations';

interface EditEntryModalProps {
  entry: PowerEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updated: PowerEntry) => void;
  onDeleted: (id: string) => void;
  lang?: Language;
}

export const EditEntryModal: React.FC<EditEntryModalProps> = ({
  entry,
  isOpen,
  onClose,
  onUpdated,
  onDeleted,
  lang = 'bn',
}) => {
  if (!isOpen || !entry) return null;

  const t = translations[lang] || translations.en;

  const [formData, setFormData] = useState<Partial<PowerEntry>>({ ...entry });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleChange = (field: keyof PowerEntry, val: any) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const updated = await updateEntry(entry.id, formData);
      if (updated && updated.id) {
        onUpdated(updated);
        onClose();
      } else {
        setError('Failed to update entry. Please check server.');
      }
    } catch (err: any) {
      setError(err.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setDeleteError(null);
      return;
    }

    setLoading(true);
    setDeleteError(null);
    try {
      await deleteEntry(entry.id, entry.category, entry.submissionId, {
        confirmCritical: true,
        reason: 'Confirmed by user in edit modal',
        status: entry.status,
        meterNo: entry.meterNo,
        sealNo: entry.sealNo,
        entry: entry
      });
      onDeleted(entry.id);
      onClose();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete entry');
      setLoading(false);
    }
  };

  const isNsc = entry.category === 'NSC';
  const isDisc = entry.category === 'DISCONNECTION';
  const isPole = entry.category === 'POLE CASE';
  const isMeter = entry.category === 'METER REPLESMENT';
  const isDtr = entry.category === 'DTR REPLESMENT';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-mono">{entry.id}</h3>
                <span className="text-xs bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded">
                  {entry.category}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{t.editEntryTitle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Top Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase block">{t.workerName}</label>
              <input
                type="text"
                value={formData.workerName || ''}
                onChange={(e) => handleChange('workerName', e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase block">{t.status}</label>
              <select
                value={formData.status || 'Pending'}
                onChange={(e) => handleChange('status', e.target.value as StatusType)}
                className="mt-1 w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Pending">{t.pending}</option>
                <option value="In Progress">{t.inProgress}</option>
                <option value="Completed">{t.completed}</option>
                <option value="Approved">{t.approved}</option>
                <option value="Rejected">{t.rejected}</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase block">{t.feeder}</label>
              <input
                type="text"
                value={formData.feederName || ''}
                onChange={(e) => handleChange('feederName', e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Detailed Editable Fields Based on Category */}
          <div className="space-y-3 p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              {t.wbsedclStandard}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Consumer / Account Info */}
              {(isNsc || isDisc || isMeter) && (
                <>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block">{t.consumerName}</label>
                    <input
                      type="text"
                      value={formData.consumerName || ''}
                      onChange={(e) => handleChange('consumerName', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white"
                    />
                  </div>

                  {isNsc && (
                    <>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block">{t.workOrderNo} (Work Order No)</label>
                        <input
                          type="text"
                          value={formData.workOrderNo || ''}
                          onChange={(e) => handleChange('workOrderNo', e.target.value)}
                          className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-teal-700 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block">{t.workOrderDate} (Work Order Date)</label>
                        <input
                          type="date"
                          value={formData.workOrderDate || ''}
                          onChange={(e) => handleChange('workOrderDate', e.target.value)}
                          className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block">{t.agencyName} (Agency Name)</label>
                        <input
                          type="text"
                          value={formData.agencyName || ''}
                          onChange={(e) => handleChange('agencyName', e.target.value)}
                          className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block">{t.cccName} (CCC Name)</label>
                        <input
                          type="text"
                          value={formData.cccName || ''}
                          onChange={(e) => handleChange('cccName', e.target.value)}
                          className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block">{t.applicationNo}</label>
                        <input
                          type="text"
                          value={formData.applicationNo || ''}
                          onChange={(e) => handleChange('applicationNo', e.target.value)}
                          className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-purple-700 focus:bg-white"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block">{t.consumerId}</label>
                    <input
                      type="text"
                      value={formData.consumerId || ''}
                      onChange={(e) => handleChange('consumerId', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block">{t.mobileNo}</label>
                    <input
                      type="text"
                      value={formData.mobile || ''}
                      onChange={(e) => handleChange('mobile', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:bg-white"
                    />
                  </div>
                </>
              )}

              {/* Address / Location */}
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block">{t.addressLocation}</label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white"
                />
              </div>

              {/* Pole No (Hidden for NSC) */}
              {!isNsc && (
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block">{t.poleNo}</label>
                  <input
                    type="text"
                    value={formData.poleNo || ''}
                    onChange={(e) => handleChange('poleNo', e.target.value)}
                    className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:bg-white"
                  />
                </div>
              )}

              {/* NSC Specifics */}
              {isNsc && (
                <>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block">{t.meterNo}</label>
                    <input
                      type="text"
                      value={formData.meterNo || ''}
                      onChange={(e) => handleChange('meterNo', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block">{t.initialReading}</label>
                    <input
                      type="text"
                      value={formData.initialReading || ''}
                      onChange={(e) => handleChange('initialReading', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block">{t.sealNo}</label>
                    <input
                      type="text"
                      value={formData.sealNo || ''}
                      onChange={(e) => handleChange('sealNo', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:bg-white"
                    />
                  </div>
                </>
              )}

              {/* DISCONNECTION Specifics */}
              {isDisc && (
                <>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block">{t.arrearAmount}</label>
                    <input
                      type="text"
                      value={formData.arrearAmount || ''}
                      onChange={(e) => handleChange('arrearAmount', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-rose-600 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block">{t.finalReading}</label>
                    <input
                      type="text"
                      value={formData.finalReading || ''}
                      onChange={(e) => handleChange('finalReading', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:bg-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-600 block">{t.disconnectionReason}</label>
                    <input
                      type="text"
                      value={formData.reason || ''}
                      onChange={(e) => handleChange('reason', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white"
                    />
                  </div>
                </>
              )}

              {/* POLE CASE Specifics */}
              {isPole && (
                <>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block">{t.issueType}</label>
                    <input
                      type="text"
                      value={formData.issueType || ''}
                      onChange={(e) => handleChange('issueType', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block">{t.priority}</label>
                    <select
                      value={formData.priority || 'Normal'}
                      onChange={(e) => handleChange('priority', e.target.value as any)}
                      className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white font-bold"
                    >
                      <option value="Urgent">Urgent</option>
                      <option value="High">High</option>
                      <option value="Normal">Normal</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-600 block">{t.actionTaken}</label>
                    <input
                      type="text"
                      value={formData.actionTaken || ''}
                      onChange={(e) => handleChange('actionTaken', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white"
                    />
                  </div>
                </>
              )}

              {/* METER REPLESMENT Specifics */}
              {isMeter && (
                <>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block">{t.oldMeterNo}</label>
                    <input
                      type="text"
                      value={formData.oldMeterNo || ''}
                      onChange={(e) => handleChange('oldMeterNo', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block">{t.newMeterNo}</label>
                    <input
                      type="text"
                      value={formData.newMeterNo || ''}
                      onChange={(e) => handleChange('newMeterNo', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:bg-white"
                    />
                  </div>
                </>
              )}

              {/* DTR REPLESMENT Specifics */}
              {isDtr && (
                <>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block">{t.dtrName}</label>
                    <input
                      type="text"
                      value={formData.dtrName || ''}
                      onChange={(e) => handleChange('dtrName', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block">{t.newCapacity}</label>
                    <input
                      type="text"
                      value={formData.newCapacity || ''}
                      onChange={(e) => handleChange('newCapacity', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white"
                    />
                  </div>
                </>
              )}

              {/* Notes */}
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block">{t.notes}</label>
                <textarea
                  rows={2}
                  value={formData.notes || ''}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white resize-none"
                />
              </div>
            </div>
          </div>

          {/* Delete confirmation panel if triggered */}
          {deleteConfirm && (
            <div className="p-4 bg-red-50/90 border border-red-200 rounded-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start gap-2.5 text-red-900">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-red-950">
                    {lang === 'bn' ? 'আপনি কি নিশ্চিত যে এই রেকর্ডটি ডিলিট করতে চান?' : 'Are you sure you want to permanently delete this record?'}
                  </p>
                  <p className="text-[11px] text-red-700 mt-0.5">
                    {lang === 'bn' 
                      ? 'ডিলিট নিশ্চিত করলে এই রেকর্ডটি Google Sheets এবং সিস্টেম থেকে সম্পূর্ণভাবে মুছে যাবে।'
                      : 'Once confirmed, this record will be permanently deleted from Google Sheets and the system.'}
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="p-2 bg-red-100 border border-red-300 rounded-lg text-[11px] text-red-900 font-medium">
                  {deleteError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-red-200">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  disabled={loading}
                  className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  disabled={loading}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold rounded-lg text-xs shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{lang === 'bn' ? 'মুছে ফেলা হচ্ছে...' : 'Deleting...'}</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{lang === 'bn' ? 'ডিলিট নিশ্চিত করুন' : 'Confirm Delete'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                if (deleteConfirm) {
                  setDeleteConfirm(false);
                } else {
                  handleDeleteClick();
                }
              }}
              disabled={loading}
              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>{deleteConfirm ? (lang === 'bn' ? 'বাতিল' : 'Cancel') : t.delete}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4 text-emerald-400" />
                <span>{loading ? t.submitting : t.saveChanges}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
