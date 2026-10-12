import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Users,
  Trash2,
  ShieldCheck,
  HardHat,
  KeyRound,
  Phone,
  User,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  PauseCircle,
  PlayCircle,
  Edit2,
  Save,
  Eye,
  EyeOff,
  Search,
  ShieldAlert,
  AlertTriangle,
  Copy,
  Check,
  Sparkles,
  Building2,
  ArrowLeft,
  LayoutGrid,
  ChevronRight
} from 'lucide-react';
import { UserAccount } from '../types';
import { fetchUsers, createUserAccount, deleteUserAccount, updateUserStatus, updateUserAccount } from '../services/api';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalPageOption = 'hub' | 'create' | 'agency' | 'list' | 'change-password';

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalPageOption>('hub');
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'worker' | 'agency' | 'admin' | 'hold'>('all');

  // Form states
  const [idNo, setIdNo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'worker' | 'agency' | 'admin'>('worker');
  const [designation, setDesignation] = useState('Lineman / Worker (WBSEDCL)');

  // Newly created credentials highlight card
  const [createdUserCard, setCreatedUserCard] = useState<{
    name: string;
    idNo: string;
    password: string;
    role: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Edit Password / User inline states
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPasswordValue, setEditPasswordValue] = useState('');
  const [editNameValue, setEditNameValue] = useState('');
  const [editPhoneValue, setEditPhoneValue] = useState('');
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // Dedicated Change Password Tab States
  const [selectedChangeUserId, setSelectedChangeUserId] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [showNewPasswordInput, setShowNewPasswordInput] = useState<boolean>(true);
  const [changePassSearch, setChangePassSearch] = useState<string>('');

  // Mandatory User Deletion Confirmation Modal States
  const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);
  const [userDeleteConfirmText, setUserDeleteConfirmText] = useState('');
  const [userDeleteReason, setUserDeleteReason] = useState('');
  const [userDeleteAcknowledge, setUserDeleteAcknowledge] = useState(false);
  const [userDeleteError, setUserDeleteError] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadUsersList = async () => {
    setLoading(true);
    try {
      const list = await fetchUsers();
      setUsers(Array.isArray(list) ? list : []);
    } catch {
      setError('Failed to load user list from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadUsersList();
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  const navigateToOption = (page: ModalPageOption) => {
    setError(null);
    setSuccess(null);
    setCreatedUserCard(null);
    if (page === 'agency') {
      setRole('agency');
      setDesignation('Agency Partner (WBSEDCL)');
      if (!idNo.startsWith('AGN-')) {
        setIdNo(`AGN-${Math.floor(1000 + Math.random() * 9000)}`);
      }
      if (!password) {
        setPassword('1234');
      }
    } else if (page === 'create') {
      if (!idNo) {
        setIdNo(
          role === 'admin'
            ? `ADM-${Math.floor(100 + Math.random() * 900)}`
            : role === 'agency'
            ? `AGN-${Math.floor(1000 + Math.random() * 9000)}`
            : `LM-${Math.floor(1000 + Math.random() * 9000)}`
        );
      }
      if (!password) {
        setPassword('1234');
      }
    } else if (page === 'change-password') {
      if (!selectedChangeUserId && users.length > 0) {
        setSelectedChangeUserId(users[0].id || users[0].idNo);
      }
    }
    setActiveTab(page);
  };

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGenerateId = (prefix: 'LM' | 'WRK' | 'AGN' | 'ADM') => {
    const random4 = Math.floor(1000 + Math.random() * 9000);
    setIdNo(`${prefix}-${random4}`);
  };

  const handleSelectRolePreset = (newRole: 'worker' | 'agency' | 'admin') => {
    setRole(newRole);
    if (newRole === 'worker') {
      setDesignation('Lineman / Worker (WBSEDCL)');
      setIdNo(`LM-${Math.floor(1000 + Math.random() * 9000)}`);
    } else if (newRole === 'agency') {
      setDesignation('Agency Partner (WBSEDCL)');
      setIdNo(`AGN-${Math.floor(1000 + Math.random() * 9000)}`);
    } else {
      setDesignation('Assistant Engineer / Admin (WBSEDCL)');
      setIdNo(`ADM-${Math.floor(100 + Math.random() * 900)}`);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCreatedUserCard(null);

    const effectiveRole: 'worker' | 'agency' | 'admin' = activeTab === 'agency' ? 'agency' : role;
    const rawIdInput = idNo.trim() || name.trim();

    if (!rawIdInput || !password.trim()) {
      setError('Please enter both User ID and Password.');
      return;
    }

    setLoading(true);
    try {
      const cleanId = rawIdInput;
      const cleanPass = password.trim();
      const roleDefaultName =
        effectiveRole === 'admin'
          ? `Admin (${cleanId})`
          : effectiveRole === 'agency'
          ? cleanId
          : `Worker (${cleanId})`;
      const cleanName = name.trim() || roleDefaultName;
      const defaultDesig =
        effectiveRole === 'admin'
          ? 'Assistant Engineer / Admin (WBSEDCL)'
          : effectiveRole === 'agency'
          ? 'Agency Partner (WBSEDCL)'
          : 'Lineman / Worker (WBSEDCL)';

      const res = await createUserAccount({
        idNo: cleanId,
        password: cleanPass,
        name: cleanName,
        phone: phone.trim(),
        role: effectiveRole,
        designation: designation.trim() || defaultDesig,
      });

      if (res && res.success !== false) {
        const roleLabel =
          effectiveRole === 'admin'
            ? 'Admin / Supervisor'
            : effectiveRole === 'agency'
            ? 'Agency Partner'
            : 'Field Worker / Lineman';
        setSuccess(
          `New ${effectiveRole === 'agency' ? 'Agency' : effectiveRole === 'admin' ? 'Admin' : 'Worker'} ID "${cleanId}" (${cleanName}) created and saved successfully!`
        );
        setCreatedUserCard({
          name: cleanName,
          idNo: cleanId,
          password: cleanPass,
          role: roleLabel
        });
        setRevealedPasswords(prev => ({ ...prev, [cleanId]: true }));
        setIdNo(
          effectiveRole === 'agency'
            ? `AGN-${Math.floor(1000 + Math.random() * 9000)}`
            : effectiveRole === 'admin'
            ? `ADM-${Math.floor(100 + Math.random() * 900)}`
            : `LM-${Math.floor(1000 + Math.random() * 9000)}`
        );
        setPassword('1234');
        setName('');
        setPhone('');
        await loadUsersList();
      } else {
        setError(res?.message || 'Failed to create user account.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  const isAdminAccount = (u: UserAccount): boolean => {
    const roleStr = String(u.role || '').toLowerCase();
    const desigStr = String(u.designation || '').toLowerCase();
    return (
      roleStr === 'admin' ||
      roleStr === 'supervisor' ||
      desigStr.includes('admin') ||
      desigStr.includes('প্রকৌশলী') ||
      desigStr.includes('engineer')
    );
  };

  const handleDeleteUserClick = (user: UserAccount) => {
    if (user.idNo === '8695716192' || user.idNo === 'admin') {
      setError('Primary Master Admin ID cannot be deleted!');
      return;
    }
    setError(null);
    setSuccess(null);
    setUserToDelete(user);
    setUserDeleteConfirmText('');
    setUserDeleteReason('');
    setUserDeleteAcknowledge(false);
    setUserDeleteError(null);
  };

  const executeDeleteUser = async () => {
    if (!userToDelete) return;

    const targetIsAdmin = isAdminAccount(userToDelete);

    if (targetIsAdmin) {
      const expectedId = String(userToDelete.idNo || '').trim();
      if (
        userDeleteConfirmText.trim() !== expectedId &&
        userDeleteConfirmText.trim().toUpperCase() !== 'DELETE'
      ) {
        setUserDeleteError(
          `Please type the exact User ID "${expectedId}" or "DELETE" to confirm deletion.`
        );
        return;
      }

      if (!userDeleteReason || userDeleteReason.trim().length < 3) {
        setUserDeleteError(
          'Please enter a valid administrative reason for deleting this Admin account.'
        );
        return;
      }

      if (!userDeleteAcknowledge) {
        setUserDeleteError('Please check the confirmation checkbox to proceed.');
        return;
      }
    } else {
      if (!userDeleteAcknowledge) {
        setUserDeleteError('Please check the confirmation checkbox to proceed.');
        return;
      }
    }

    setIsDeletingUser(true);
    setUserDeleteError(null);

    try {
      const res = await deleteUserAccount(userToDelete.id || userToDelete.idNo, {
        confirmText: targetIsAdmin ? userDeleteConfirmText.trim() : 'DELETE',
        reason: targetIsAdmin ? userDeleteReason.trim() : 'Removed by Admin',
      });

      if (res.success) {
        const deletedName = userToDelete.name;
        const deletedIdNo = userToDelete.idNo;
        const deletedInternalId = userToDelete.id;
        setUserToDelete(null);
        setUsers(prev => prev.filter(u => u.id !== deletedInternalId && u.idNo !== deletedIdNo));
        setSuccess(`"${deletedName}" (ID: ${deletedIdNo}) has been permanently deleted.`);
        await loadUsersList();
      } else {
        setUserDeleteError(res.message || 'Failed to delete user account.');
      }
    } catch {
      setUserDeleteError('Failed to connect to the server.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleToggleStatus = async (user: UserAccount) => {
    if (user.idNo === '8695716192' || user.idNo === 'admin') {
      setError('Primary Master Admin ID cannot be placed on hold!');
      return;
    }
    const newStatus = user.status === 'hold' ? 'active' : 'hold';
    const actionName = newStatus === 'hold' ? 'placed on HOLD' : 'ACTIVATED';

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await updateUserStatus(user.id || user.idNo, newStatus);
      if (res.success) {
        setSuccess(`Account for "${user.name}" has been ${actionName} successfully.`);
        await loadUsersList();
      } else {
        setError(res.message || 'Failed to update account status.');
      }
    } catch {
      setError('Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (user: UserAccount) => {
    setEditingUserId(user.id || user.idNo);
    setEditPasswordValue(user.password || '');
    setEditNameValue(user.name || '');
    setEditPhoneValue(user.phone || '');
    setError(null);
    setSuccess(null);
  };

  const handleSaveEdit = async (user: UserAccount) => {
    if (!editPasswordValue.trim()) {
      setError('Password cannot be empty!');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await updateUserAccount(user.id || user.idNo, {
        password: editPasswordValue.trim(),
        name: editNameValue.trim() || user.name,
        phone: editPhoneValue.trim(),
      });
      if (res.success) {
        setSuccess(`Updated credentials for "${editNameValue.trim() || user.name}" (ID: ${user.idNo}) — New Password: "${editPasswordValue.trim()}"!`);
        setEditingUserId(null);
        setRevealedPasswords(prev => ({ ...prev, [user.idNo]: true }));
        await loadUsersList();
      } else {
        setError(res.message || 'Failed to update user details.');
      }
    } catch {
      setError('Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedChangeUserId) {
      setError('Please select a user account from the list.');
      return;
    }
    if (!newPasswordInput.trim()) {
      setError('Please enter a new Password or PIN.');
      return;
    }

    const targetUser = users.find(u => (u.id === selectedChangeUserId || u.idNo === selectedChangeUserId));
    if (!targetUser) {
      setError('Selected user account was not found.');
      return;
    }

    setLoading(true);
    try {
      const cleanNewPass = newPasswordInput.trim();
      const res = await updateUserAccount(targetUser.id || targetUser.idNo, {
        password: cleanNewPass,
        name: targetUser.name,
        phone: targetUser.phone,
        designation: targetUser.designation,
        role: targetUser.role,
        status: targetUser.status || 'active',
      });

      if (res.success) {
        setSuccess(`Password for "${targetUser.name}" (ID: ${targetUser.idNo}) has been updated to "${cleanNewPass}"!`);
        setRevealedPasswords(prev => ({ ...prev, [targetUser.idNo]: true }));
        setNewPasswordInput('');
        await loadUsersList();
      } else {
        setError(res.message || 'Failed to change password.');
      }
    } catch {
      setError('Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = (Array.isArray(users) ? users : []).filter(u => {
    if (!u) return false;
    if (filterRole === 'worker' && u.role !== 'worker') return false;
    if (filterRole === 'agency' && u.role !== 'agency') return false;
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

  const workerCount = users.filter(u => u && u.role === 'worker').length;
  const agencyCount = users.filter(u => u && u.role === 'agency').length;
  const adminCount = users.filter(u => u && u.role === 'admin').length;
  const holdCount = users.filter(u => u && u.status === 'hold').length;

  const renderUserCard = (u: UserAccount, idx: number) => {
    const isPrimaryAdmin = u.idNo === '8695716192' || u.idNo === 'admin';
    const isHold = u.status === 'hold';
    const isEditing = editingUserId === (u.id || u.idNo);

    return (
      <div
        key={`${u.id || u.idNo || 'user'}-${idx}`}
        className={`p-3 sm:p-3.5 rounded-2xl border flex flex-col gap-2.5 transition-all shadow-2xs ${
          isPrimaryAdmin
            ? 'bg-gradient-to-r from-amber-50/90 via-white to-amber-50/50 border-amber-300 ring-1 ring-amber-400/30'
            : isHold
            ? 'bg-rose-50/50 border-rose-200 opacity-90'
            : u.role === 'admin'
            ? 'bg-gradient-to-r from-emerald-50/60 via-white to-teal-50/30 border-emerald-200/90'
            : u.role === 'agency'
            ? 'bg-gradient-to-r from-purple-50/70 via-white to-fuchsia-50/40 border-purple-200/90'
            : 'bg-white border-slate-200/90 hover:border-blue-300'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center font-black text-[10px] shrink-0 shadow-xs ${
              isPrimaryAdmin
                ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950'
                : isHold
                ? 'bg-rose-500 text-white'
                : u.role === 'admin'
                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                : u.role === 'agency'
                ? 'bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white'
                : 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white'
            }`}>
              <span>{isPrimaryAdmin ? 'HQ' : isHold ? 'HLD' : u.role === 'admin' ? 'ADM' : u.role === 'agency' ? 'AGN' : 'WRK'}</span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <h4 className={`text-xs sm:text-sm font-black ${isHold ? 'text-rose-900 line-through' : 'text-slate-900'}`}>
                  {u.name}
                </h4>
                <span className="text-[11px] font-mono font-bold bg-slate-100 border border-slate-300 text-slate-900 px-2 py-0.5 rounded-lg flex items-center gap-1">
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

                {/* Role Badge */}
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                  u.role === 'admin'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : u.role === 'agency'
                    ? 'bg-purple-100 text-purple-800 border border-purple-300'
                    : 'bg-blue-100 text-blue-800 border border-blue-300'
                }`}>
                  {u.role === 'admin' ? 'ADMIN' : u.role === 'agency' ? 'AGENCY' : 'WORKER'}
                </span>

                {/* Status Badge */}
                {isHold ? (
                  <span className="text-[9px] bg-rose-100 text-rose-700 font-black border border-rose-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <PauseCircle className="w-2.5 h-2.5" />
                    <span>HOLD</span>
                  </span>
                ) : (
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-black border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                    <span>ACTIVE</span>
                  </span>
                )}
              </div>

              <div className="text-[11px] text-slate-500 font-medium flex flex-wrap items-center gap-2 mt-0.5">
                <span>{u.designation}</span>
                {u.phone && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-slate-700">📞 {u.phone}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Password Vault Pill & Quick Actions */}
          <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-center">
            <div className="flex items-center gap-1.5 bg-slate-900 text-white px-2.5 py-1.5 rounded-xl text-xs shadow-2xs" title="User Login Password / PIN">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono font-bold text-amber-300 text-xs tracking-wider">
                {revealedPasswords[u.idNo] !== false ? (u.password || '••••') : '••••'}
              </span>
              <button
                type="button"
                onClick={() => setRevealedPasswords(prev => ({ ...prev, [u.idNo]: prev[u.idNo] === false ? true : false }))}
                className="text-slate-400 hover:text-white cursor-pointer ml-0.5"
                title={revealedPasswords[u.idNo] !== false ? 'Hide Password' : 'Show Password'}
              >
                {revealedPasswords[u.idNo] !== false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              {u.password && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(String(u.password), `pass_${u.idNo}`)}
                  className="text-slate-400 hover:text-emerald-400 cursor-pointer ml-0.5"
                  title="Copy Password"
                >
                  {copiedKey === `pass_${u.idNo}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                const passCard = `WBSEDCL Login Pass\nRole: ${(u.role || 'worker').toUpperCase()}\nName: ${u.name}\nUser ID: ${u.idNo}\nPIN/Password: ${u.password || '1234'}`;
                copyToClipboard(passCard, `card_${u.idNo}`);
              }}
              className="p-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Copy Full Login Credentials"
            >
              {copiedKey === `card_${u.idNo}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
              <span className="hidden md:inline">{copiedKey === `card_${u.idNo}` ? 'Copied' : 'Pass'}</span>
            </button>

            {!isPrimaryAdmin && (
              <button
                type="button"
                onClick={() => isEditing ? setEditingUserId(null) : handleStartEdit(u)}
                className="p-1.5 px-2.5 text-blue-700 hover:bg-blue-50 bg-blue-50/50 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title="Edit password or name"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isEditing ? 'Cancel' : 'Edit'}</span>
              </button>
            )}

            {!isPrimaryAdmin && (
              <button
                type="button"
                onClick={() => handleToggleStatus(u)}
                className={`p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer ${
                  isHold
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                }`}
                title={isHold ? 'Activate ID' : 'Place ID on Hold'}
              >
                {isHold ? (
                  <>
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Activate</span>
                  </>
                ) : (
                  <>
                    <PauseCircle className="w-3.5 h-3.5 text-amber-700" />
                    <span className="hidden sm:inline">Hold</span>
                  </>
                )}
              </button>
            )}

            {!isPrimaryAdmin && (
              <button
                type="button"
                onClick={() => handleDeleteUserClick(u)}
                className="p-1.5 text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                title="Delete ID permanently"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Inline Edit Form */}
        {isEditing && (
          <div className="p-3 bg-blue-50/90 border border-blue-200 rounded-xl space-y-2.5 animate-in slide-in-from-top-1 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Update Profile & Password (ID: {u.idNo})</span>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">New Password / PIN</label>
                <input
                  type="text"
                  value={editPasswordValue}
                  onChange={(e) => setEditPasswordValue(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900"
                  placeholder="New password"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Full Name</label>
                <input
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900"
                  placeholder="Full Name"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Phone Number</label>
                <input
                  type="tel"
                  value={editPhoneValue}
                  onChange={(e) => setEditPhoneValue(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-900"
                  placeholder="Phone Number"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingUserId(null)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveEdit(u)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[95vh] sm:h-[90vh]">
        {/* Sleek, Compact Top Header Bar */}
        <div className="px-4 py-3 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {activeTab !== 'hub' ? (
              <button
                type="button"
                onClick={() => navigateToOption('hub')}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-xs"
                title="Back to All Options"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>All Options</span>
              </button>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-slate-950 shrink-0 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
                  {activeTab === 'hub' && "Manage ID's & Access Control Hub"}
                  {activeTab === 'create' && 'Create New User ID & Password'}
                  {activeTab === 'agency' && 'Agency ID & Password Studio'}
                  {activeTab === 'list' && `All User IDs & Passwords (ID Vault: ${users.length})`}
                  {activeTab === 'change-password' && 'PIN & Password Reset Studio'}
                </h2>
              </div>
              <p className="text-[11px] text-slate-400 truncate hidden sm:block">
                Worker, Agency & Admin Identity and Password Management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeTab !== 'hub' && (
              <div className="hidden md:flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => navigateToOption('create')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    activeTab === 'create' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  + Create ID
                </button>
                <button
                  type="button"
                  onClick={() => navigateToOption('agency')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    activeTab === 'agency' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Agency ID ({agencyCount})
                </button>
                <button
                  type="button"
                  onClick={() => navigateToOption('list')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    activeTab === 'list' ? 'bg-blue-500 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  ID List ({users.length})
                </button>
                <button
                  type="button"
                  onClick={() => navigateToOption('change-password')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    activeTab === 'change-password' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Reset PIN
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white rounded-xl bg-white/10 hover:bg-rose-600 border border-white/10 transition-colors cursor-pointer shrink-0"
              title="Close Modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Spacious Full-Height Page Body */}
        <div className="p-3.5 sm:p-5 overflow-y-auto flex-1 bg-slate-50/70 space-y-3.5">
          {/* Notifications */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 font-semibold animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 font-semibold animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <div className="leading-relaxed">{success}</div>
            </div>
          )}

          {/* Newly Created Credentials Copy Card */}
          {createdUserCard && (
            <div className="p-3.5 bg-gradient-to-br from-emerald-50 via-white to-teal-50 border-2 border-emerald-500/70 rounded-2xl space-y-2.5 shadow-sm animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                    Smart Login Pass Issued & Ready
                  </span>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full">
                  {createdUserCard.role}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">USER LOGIN ID</span>
                    <span className="font-mono font-black text-slate-900 text-sm">{createdUserCard.idNo}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdUserCard.idNo, 'new_id')}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs flex items-center gap-1 font-bold cursor-pointer"
                  >
                    {copiedKey === 'new_id' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'new_id' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">SECRET PIN / PASSWORD</span>
                    <span className="font-mono font-black text-slate-900 text-sm">{createdUserCard.password}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdUserCard.password, 'new_pass')}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs flex items-center gap-1 font-bold cursor-pointer"
                  >
                    {copiedKey === 'new_pass' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'new_pass' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-xs text-emerald-900">
                  Name: <strong>{createdUserCard.name}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const text = `WBSEDCL App Login:\nRole: ${createdUserCard.role}\nUser ID: ${createdUserCard.idNo}\nPassword: ${createdUserCard.password}\nName: ${createdUserCard.name}`;
                    copyToClipboard(text, 'all_cred');
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {copiedKey === 'all_cred' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'all_cred' ? 'Copied All Credentials' : 'Copy All Credentials'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* OPTION HUB VIEW: CLICK AN OPTION TO OPEN DEDICATED PAGE    */}
          {/* ========================================================= */}
          {activeTab === 'hub' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Top Quick Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <button
                  type="button"
                  onClick={() => { setFilterRole('all'); navigateToOption('list'); }}
                  className="p-3 rounded-2xl bg-slate-900 text-white border border-slate-800 text-left hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total IDs</span>
                  <span className="text-lg font-black text-amber-400 font-mono">{users.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setFilterRole('worker'); navigateToOption('list'); }}
                  className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-left hover:bg-blue-100/70 transition-all cursor-pointer"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">Workers</span>
                  <span className="text-lg font-black text-blue-900 font-mono">{workerCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateToOption('agency')}
                  className="p-3 rounded-2xl bg-purple-50 border border-purple-200 text-left hover:bg-purple-100/70 transition-all cursor-pointer"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">Agency IDs</span>
                  <span className="text-lg font-black text-purple-900 font-mono">{agencyCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setFilterRole('admin'); navigateToOption('list'); }}
                  className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-left hover:bg-emerald-100/70 transition-all cursor-pointer"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Admins</span>
                  <span className="text-lg font-black text-emerald-900 font-mono">{adminCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setFilterRole('hold'); navigateToOption('list'); }}
                  className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-left hover:bg-rose-100/70 transition-all cursor-pointer col-span-2 sm:col-span-1"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">On Hold</span>
                  <span className="text-lg font-black text-rose-900 font-mono">{holdCount}</span>
                </button>
              </div>

              <div className="bg-amber-50/90 border border-amber-200/80 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                  <LayoutGrid className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Select an option below to open its dedicated full-screen workspace:</span>
                </div>
              </div>

              {/* 4 Dedicated Option Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* OPTION 1: CREATE NEW ID (WORKER / AGENCY / ADMIN) */}
                <button
                  type="button"
                  onClick={() => {
                    handleSelectRolePreset('worker');
                    navigateToOption('create');
                  }}
                  className="p-5 rounded-2xl bg-white hover:bg-blue-50/50 border-2 border-blue-200 hover:border-blue-500 text-left transition-all shadow-xs hover:shadow-md flex items-start justify-between gap-3 group cursor-pointer"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                      <UserPlus className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        OPTION 1 • CREATE NEW ID
                      </span>
                      <h3 className="text-base font-black text-slate-900 mt-1.5">
                        Create New User ID & Password
                      </h3>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Issue a new Login ID & PIN for Field Workers, Agency Partners, or Admins.
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                </button>

                {/* OPTION 2: AGENCY ID & PASSWORD STUDIO */}
                <button
                  type="button"
                  onClick={() => navigateToOption('agency')}
                  className="p-5 rounded-2xl bg-white hover:bg-purple-50/50 border-2 border-purple-200 hover:border-purple-500 text-left transition-all shadow-xs hover:shadow-md flex items-start justify-between gap-3 group cursor-pointer"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                        OPTION 2 • AGENCY ID ({agencyCount})
                      </span>
                      <h3 className="text-base font-black text-slate-900 mt-1.5">
                        Agency ID & Password Studio
                      </h3>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Create new Agency login credentials and manage all registered Agency IDs & PINs.
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                </button>

                {/* OPTION 3: VIEW ALL IDS & PASSWORDS VAULT */}
                <button
                  type="button"
                  onClick={() => {
                    setFilterRole('all');
                    navigateToOption('list');
                  }}
                  className="p-5 rounded-2xl bg-white hover:bg-emerald-50/50 border-2 border-emerald-200 hover:border-emerald-500 text-left transition-all shadow-xs hover:shadow-md flex items-start justify-between gap-3 group cursor-pointer"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        OPTION 3 • ID & PASSWORD LIST ({users.length})
                      </span>
                      <h3 className="text-base font-black text-slate-900 mt-1.5">
                        View All IDs & Passwords (ID Vault)
                      </h3>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Browse, search, copy, edit, or hold any Worker, Agency, or Admin ID & Password.
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                </button>

                {/* OPTION 4: PIN & PASSWORD RESET STUDIO */}
                <button
                  type="button"
                  onClick={() => navigateToOption('change-password')}
                  className="p-5 rounded-2xl bg-white hover:bg-amber-50/50 border-2 border-amber-200 hover:border-amber-500 text-left transition-all shadow-xs hover:shadow-md flex items-start justify-between gap-3 group cursor-pointer"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                      <KeyRound className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                        OPTION 4 • RESET PASSWORD / PIN
                      </span>
                      <h3 className="text-base font-black text-slate-900 mt-1.5">
                        Change Password / PIN Studio
                      </h3>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        View the current PIN or set a new Password for any Worker, Agency, or Admin account.
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PAGE 1: SPACIOUS CREATE USER ID PAGE (WORKER/AGENCY/ADMIN) */}
          {/* ========================================================= */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateUser} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 animate-in fade-in duration-150">
              {/* Step 1: Compact 3-Column Role Selector (Worker / Agency / Admin) */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  1. Select Account Role <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSelectRolePreset('worker')}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                      role === 'worker'
                        ? 'border-blue-600 bg-blue-50/90 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${role === 'worker' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        <HardHat className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900">Worker / Lineman</h4>
                        <p className="text-[10px] text-slate-500">Field Staff Account</p>
                      </div>
                    </div>
                    {role === 'worker' && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectRolePreset('agency')}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                      role === 'agency'
                        ? 'border-purple-600 bg-purple-50/90 ring-2 ring-purple-500/20'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${role === 'agency' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900">Agency ID</h4>
                        <p className="text-[10px] text-slate-500">Agency Partner Login</p>
                      </div>
                    </div>
                    {role === 'agency' && <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectRolePreset('admin')}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                      role === 'admin'
                        ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${role === 'admin' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900">Admin / Supervisor</h4>
                        <p className="text-[10px] text-slate-500">Admin Control Access</p>
                      </div>
                    </div>
                    {role === 'admin' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                  </button>
                </div>
              </div>

              {/* Step 2: User ID & Password in a Clean 2-Column Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      <span>User Login ID <span className="text-red-500">*</span></span>
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleGenerateId('LM')}
                        className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded text-[10px] font-mono font-bold cursor-pointer"
                      >
                        LM-ID
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGenerateId('AGN')}
                        className="px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 rounded text-[10px] font-mono font-bold cursor-pointer"
                      >
                        AGN-ID
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGenerateId('ADM')}
                        className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded text-[10px] font-mono font-bold cursor-pointer"
                      >
                        ADM-ID
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    required
                    value={idNo}
                    onChange={(e) => setIdNo(e.target.value)}
                    placeholder="e.g. LM-4085, AGN-2040 or Phone No"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                      <span>Password / PIN <span className="text-red-500">*</span></span>
                    </label>
                    <div className="flex items-center gap-1">
                      {['1234', '0000', '1122', '8899'].map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPassword(p)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer ${
                            password === p ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter PIN or Password (e.g. 1234)"
                      className="w-full pl-3.5 pr-16 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono tracking-wider"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-blue-600 font-bold hover:underline cursor-pointer px-1.5 py-0.5 rounded bg-blue-50"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3: Name, Phone, Designation */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {role === 'agency' ? 'Agency Name' : 'Full Name'}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={role === 'agency' ? 'e.g. Maa Tara Agency' : 'e.g. Asit Kumar Das'}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>Phone Number</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="98300XXXXX"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Lineman / Agency (WBSEDCL)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl text-white font-black text-sm bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 hover:from-blue-700 hover:to-indigo-800 active:scale-[0.99] shadow-lg shadow-slate-900/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Creating ID...</span>
                  </span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 text-amber-400" />
                    <span>Create & Save {role === 'agency' ? 'Agency' : role === 'admin' ? 'Admin' : 'Worker'} ID & Password</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ========================================================= */}
          {/* PAGE 2: DEDICATED AGENCY ID & PASSWORD STUDIO              */}
          {/* ========================================================= */}
          {activeTab === 'agency' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Create Agency ID Box */}
              <form onSubmit={handleCreateUser} className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-purple-200 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-purple-100 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Create New Agency ID & Password</h3>
                      <p className="text-[11px] text-slate-500">Agency users can sign in with this ID and Password to access field tasks</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                    ROLE: AGENCY
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">Agency Login ID *</label>
                      <button
                        type="button"
                        onClick={() => handleGenerateId('AGN')}
                        className="px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-mono font-bold cursor-pointer"
                      >
                        Auto AGN-ID
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={idNo}
                      onChange={(e) => setIdNo(e.target.value)}
                      placeholder="e.g. AGN-2050"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 font-mono"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">Password / PIN *</label>
                      <div className="flex gap-1">
                        {['1234', '0000'].map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPassword(p)}
                            className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-mono font-bold cursor-pointer"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="e.g. 1234"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Agency Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. R.K. Electrical Agency"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number (Optional)</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="98300XXXXX"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 px-4 rounded-xl text-white font-black text-xs sm:text-sm bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Create Agency ID & Password</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Existing Agency IDs List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-purple-600" />
                    <span>Registered Agency IDs & Passwords ({agencyCount})</span>
                  </h4>
                </div>
                {users.filter(u => u.role === 'agency').length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-purple-200">
                    No Agency IDs created yet. Use the form above to create a new Agency ID.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {users.filter(u => u.role === 'agency').map((u, idx) => renderUserCard(u, idx))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PAGE 3: FULL-HEIGHT ID & PASSWORD VAULT LIST               */}
          {/* ========================================================= */}
          {activeTab === 'list' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              {/* Search & Filter Controls */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by Name, User ID, or Phone Number..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setFilterRole('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                      filterRole === 'all' ? 'bg-slate-900 text-amber-400 shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All ({users.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterRole('worker')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                      filterRole === 'worker' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Workers ({workerCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterRole('agency')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                      filterRole === 'agency' ? 'bg-purple-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Agency ({agencyCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterRole('admin')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                      filterRole === 'admin' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Admins ({adminCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterRole('hold')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                      filterRole === 'hold' ? 'bg-rose-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Hold ({holdCount})
                  </button>

                  <button
                    type="button"
                    onClick={loadUsersList}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer shrink-0"
                    title="Reload users"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Users Smart ID Cards List */}
              <div className="space-y-2.5">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-200">
                    No matching user IDs found.
                  </div>
                ) : (
                  filteredUsers.map((u, idx) => renderUserCard(u, idx))
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PAGE 4: PIN & PASSWORD RESET STUDIO                        */}
          {/* ========================================================= */}
          {activeTab === 'change-password' && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4 animate-in fade-in duration-150">
              <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-950">
                <KeyRound className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Instant PIN & Password Studio:</strong> Quickly view or reset the login password for any Worker, Agency, or Admin ID.
                </div>
              </div>

              <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-600" />
                      <span>Select User Account <span className="text-red-500">*</span></span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">Total IDs: {users.length}</span>
                  </label>

                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={changePassSearch}
                      onChange={(e) => setChangePassSearch(e.target.value)}
                      placeholder="Filter user by Name, Login ID, or Phone..."
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                    />
                  </div>

                  <select
                    value={selectedChangeUserId}
                    onChange={(e) => setSelectedChangeUserId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-mono"
                  >
                    <option value="">-- Select User Account --</option>
                    {users
                      .filter(u => {
                        if (!changePassSearch.trim()) return true;
                        const q = changePassSearch.toLowerCase();
                        return (
                          String(u.name || '').toLowerCase().includes(q) ||
                          String(u.idNo || '').toLowerCase().includes(q) ||
                          String(u.phone || '').includes(q) ||
                          String(u.role || '').toLowerCase().includes(q)
                        );
                      })
                      .map((u, idx) => (
                        <option key={`${u.id || u.idNo || 'user'}-${idx}`} value={u.id || u.idNo}>
                          {u.role === 'admin' ? '👑 [ADMIN]' : u.role === 'agency' ? '🏢 [AGENCY]' : '👷 [WORKER]'} {u.name} (Login ID: {u.idNo}) {u.status === 'hold' ? '⚠️ [ON HOLD]' : ''}
                        </option>
                      ))}
                  </select>
                </div>

                {(() => {
                  const currentSelected = users.find(u => (u.id === selectedChangeUserId || u.idNo === selectedChangeUserId));
                  if (!currentSelected) return null;
                  return (
                    <div className="p-3.5 bg-slate-900 text-white border border-slate-800 rounded-2xl space-y-2.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            currentSelected.role === 'admin'
                              ? 'bg-amber-500 text-slate-950'
                              : currentSelected.role === 'agency'
                              ? 'bg-purple-600 text-white'
                              : 'bg-blue-600 text-white'
                          }`}>
                            {currentSelected.role === 'admin' ? <ShieldCheck className="w-4 h-4" /> : currentSelected.role === 'agency' ? <Building2 className="w-4 h-4" /> : <HardHat className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="text-xs sm:text-sm font-black text-white">{currentSelected.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">Login ID: <strong className="text-amber-300">{currentSelected.idNo}</strong> • Role: <strong className="uppercase text-sky-300">{currentSelected.role}</strong></div>
                          </div>
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${currentSelected.status === 'hold' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                          {currentSelected.status === 'hold' ? 'ON HOLD' : 'ACTIVE'}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
                        <span>Current Password / PIN:</span>
                        <div className="flex items-center gap-1.5 font-mono font-bold bg-white/10 px-2.5 py-1 rounded-lg border border-white/15 text-amber-300">
                          <span>{revealedPasswords[currentSelected.idNo] !== false ? (currentSelected.password || 'Secured in Auth') : '••••'}</span>
                          <button
                            type="button"
                            onClick={() => setRevealedPasswords(prev => ({ ...prev, [currentSelected.idNo]: prev[currentSelected.idNo] === false ? true : false }))}
                            className="text-slate-300 hover:text-white cursor-pointer"
                          >
                            {revealedPasswords[currentSelected.idNo] !== false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                      <span>New Password / PIN <span className="text-red-500">*</span></span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const randomPin = String(Math.floor(1000 + Math.random() * 9000));
                        setNewPasswordInput(randomPin);
                      }}
                      className="text-xs font-bold text-amber-700 hover:text-amber-800 cursor-pointer flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200"
                    >
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      <span>Auto 4-Digit PIN</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showNewPasswordInput ? 'text' : 'password'}
                      required
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Enter new Password or PIN (e.g. 0000, 1234)"
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

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Quick Preset PINs
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: '0000', val: '0000' },
                      { label: '1234', val: '1234' },
                      { label: '6293', val: '6293' },
                      { label: '8899', val: '8899' },
                    ].map(preset => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => setNewPasswordInput(preset.val)}
                        className={`py-2 px-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer text-center ${
                          newPasswordInput === preset.val
                            ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        {preset.val}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !selectedChangeUserId || !newPasswordInput.trim()}
                  className="w-full py-3.5 px-4 rounded-xl text-white font-black text-sm bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-md shadow-amber-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Updating...</span>
                    </span>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Update Password / PIN</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Compact Footer */}
        <div className="py-2.5 px-4 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-2.5 font-medium flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Workers: <strong>{workerCount}</strong></span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>Agency: <strong>{agencyCount}</strong></span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Admins: <strong>{adminCount}</strong></span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {activeTab !== 'hub' && (
              <button
                type="button"
                onClick={() => navigateToOption('hub')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition-colors cursor-pointer text-xs"
              >
                ← All Options
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors cursor-pointer text-xs"
            >
              Close
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MANDATORY USER DELETION CONFIRMATION MODAL                               */}
        {/* ========================================================================= */}
        {userToDelete && (
          <div 
            id="mandatory-user-deletion-modal"
            className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
            onClick={() => {
              if (!isDeletingUser) setUserToDelete(null);
            }}
          >
            <div 
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`px-5 py-4 flex items-center justify-between text-white ${
                isAdminAccount(userToDelete) ? 'bg-gradient-to-r from-red-600 to-rose-700' : 'bg-gradient-to-r from-slate-800 to-slate-900'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <ShieldAlert className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm tracking-wide">
                      {isAdminAccount(userToDelete)
                        ? 'Confirm Admin Account Deletion'
                        : 'Confirm User Account Deletion'}
                    </h3>
                    <p className="text-[11px] text-white/80 font-mono">
                      ID: {userToDelete.idNo} • {userToDelete.role.toUpperCase()}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isDeletingUser) setUserToDelete(null);
                  }}
                  disabled={isDeletingUser}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                {isAdminAccount(userToDelete) ? (
                  <div className="p-3.5 bg-red-50 border-l-4 border-red-600 rounded-r-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-red-900">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Administrative Security Policy Active</span>
                    </div>
                    <p className="text-xs text-red-700 leading-relaxed">
                      Deleting an Admin account permanently revokes all administrative privileges. ID confirmation and reason are required.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Deleting this User ID will permanently prevent this user from signing in with these credentials.
                    </span>
                  </div>
                )}

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-1.5">
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                    <span className="text-slate-500 font-medium">User Name:</span>
                    <span className="font-bold text-slate-900">{userToDelete.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">User ID (ID No):</span>
                    <span className="font-mono font-bold text-slate-900">{userToDelete.idNo}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Role / Designation:</span>
                    <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                      isAdminAccount(userToDelete) ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {userToDelete.designation || userToDelete.role}
                    </span>
                  </div>
                  {userToDelete.phone && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Phone Number:</span>
                      <span className="font-mono text-slate-800">{userToDelete.phone}</span>
                    </div>
                  )}
                </div>

                {isAdminAccount(userToDelete) ? (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        1. Type "{userToDelete.idNo}" or "DELETE" to confirm:
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      <input
                        type="text"
                        value={userDeleteConfirmText}
                        onChange={(e) => setUserDeleteConfirmText(e.target.value)}
                        placeholder={userToDelete.idNo}
                        className="w-full px-3 py-2 border-2 border-red-200 focus:border-red-500 rounded-xl text-xs font-mono font-bold outline-none bg-red-50/40 text-red-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        2. Reason for deletion:
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      <input
                        type="text"
                        value={userDeleteReason}
                        onChange={(e) => setUserDeleteReason(e.target.value)}
                        placeholder="e.g. Role transfer / Resignation"
                        className="w-full px-3 py-2 border border-slate-300 focus:border-red-500 rounded-xl text-xs outline-none bg-white text-slate-800"
                      />
                    </div>

                    <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={userDeleteAcknowledge}
                        onChange={(e) => setUserDeleteAcknowledge(e.target.checked)}
                        className="mt-0.5 rounded text-red-600 focus:ring-red-500 h-4 w-4 border-slate-300 cursor-pointer"
                      />
                      <span className="text-xs text-slate-700 font-medium">
                        I confirm that I want to permanently revoke all access for this Admin account.
                      </span>
                    </label>
                  </div>
                ) : (
                  <div className="pt-1">
                    <label className="flex items-start gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={userDeleteAcknowledge}
                        onChange={(e) => setUserDeleteAcknowledge(e.target.checked)}
                        className="mt-0.5 rounded text-slate-900 focus:ring-slate-700 h-4 w-4 border-slate-300 cursor-pointer"
                      />
                      <span className="text-xs text-slate-700 font-medium">
                        I confirm that I want to delete the account for "{userToDelete.name}" (ID: {userToDelete.idNo}).
                      </span>
                    </label>
                  </div>
                )}

                {userDeleteError && (
                  <div className="p-3 bg-red-100 border border-red-300 rounded-xl flex items-start gap-2 text-xs text-red-900 font-medium animate-in shake-1 duration-150">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Validation Error: </span>
                      <span>{userDeleteError}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  disabled={isDeletingUser}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  id="confirm-delete-user-modal-btn"
                  onClick={executeDeleteUser}
                  disabled={
                    isDeletingUser ||
                    (isAdminAccount(userToDelete)
                      ? ((userDeleteConfirmText.trim() !== userToDelete.idNo.trim() && userDeleteConfirmText.trim().toUpperCase() !== 'DELETE') ||
                         userDeleteReason.trim().length < 3 ||
                         !userDeleteAcknowledge)
                      : !userDeleteAcknowledge)
                  }
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                    isAdminAccount(userToDelete)
                      ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
                      : 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300'
                  } disabled:cursor-not-allowed`}
                >
                  {isDeletingUser ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirm Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
