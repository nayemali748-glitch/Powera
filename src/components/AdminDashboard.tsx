import React, { useState } from 'react';
import appLogo from '../assets/images/power_round_logo_1787860440979.jpg';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Download, 
  FileSpreadsheet, 
  Printer, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Eye, 
  Zap, 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  Layers, 
  AlertCircle,
  X,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  LogOut,
  UserPlus,
  Users,
  KeyRound,
  Edit3,
  Globe,
  FileText,
  Camera,
  FileImage,
  ChevronDown,
  ChevronUp,
  PowerOff,
  Wrench,
  ShieldAlert,
  Coins,
  Sparkles,
  Check,
  Activity,
  Hash,
  ArrowRight
} from 'lucide-react';
import { PowerEntry, CategoryType, StatusType } from '../types';
import { updateEntry, deleteEntry, clearAllEntries } from '../services/api';
import { UserManagementModal } from './UserManagementModal';
import { EditEntryModal } from './EditEntryModal';
import { WorkOrderNoticeSection } from './WorkOrderNoticeSection';
import { Language, translations } from '../utils/translations';

interface AdminDashboardProps {
  entries: PowerEntry[];
  onRefresh: () => void;
  onExportCsv: () => void;
  onLogout?: () => void;
  lang?: Language;
  onOpenLanguageModal?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  entries,
  onRefresh,
  onExportCsv,
  onLogout,
  lang = 'bn',
  onOpenLanguageModal,
}) => {
  const t = translations[lang] || translations.bn;
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEntry, setSelectedEntry] = useState<PowerEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<PowerEntry | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [userModalTab, setUserModalTab] = useState<'create' | 'list' | 'change-password'>('create');
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [showWorkOrdersManager, setShowWorkOrdersManager] = useState<boolean>(false);

  // Category-specific Excel/CSV Export handler
  const handleExportCategoryExcel = (targetCategory: string = selectedCategory) => {
    let targetEntries = entries;
    if (targetCategory !== 'ALL') {
      targetEntries = entries.filter((e) => e.category === targetCategory);
    }

    if (targetEntries.length === 0) {
      alert(
        lang === 'bn'
          ? `"${targetCategory}" ক্যাটাগরিতে কোনো ডাটা পাওয়া যায়নি`
          : `No data found in category "${targetCategory}"`
      );
      return;
    }

    const dateStamp = new Date().toISOString().slice(0, 10);
    let filename = `WBSEDCL_${targetCategory}_Report_${dateStamp}.csv`;
    let headers: string[] = [];
    let rows: string[][] = [];

    if (targetCategory === 'NSC') {
      filename = `WBSEDCL_NSC_Report_${dateStamp}.csv`;
      headers = [
        'SL No',
        'Record ID',
        'Date Time',
        'Work Order No',
        'Work Order Date',
        'Application No',
        'Consumer ID',
        'Meter No',
        'Meter Seal No',
        'Consumer Name',
        "Father's / Husband's Name",
        'Mobile No',
        'Initial Reading',
        'Sanctioned Load (kW)',
        'Supply Phase',
        'Tariff Category',
        'Service Cable Length (Meters)',
        'Premises / Location Address',
        'Meter Installation Date',
        'Inspection Agency Name',
        'Lineman / Staff Name',
        'Agency Name',
        'CCC Name',
        'Feeder Name',
        'Substation',
        'Status',
        'GPS Coordinates',
        'Remarks / Notes'
      ];
      rows = targetEntries.map((e, idx) => [
        String(idx + 1),
        `"${e.id}"`,
        `"${new Date(e.date).toLocaleString()}"`,
        `"${e.workOrderNo || ''}"`,
        `"${e.workOrderDate || ''}"`,
        `"${e.applicationNo || ''}"`,
        `"${e.consumerId || ''}"`,
        `"${e.meterNo || ''}"`,
        `"${e.sealNo || ''}"`,
        `"${(e.consumerName || '').replace(/"/g, '""')}"`,
        `"${(e.fatherName || '').replace(/"/g, '""')}"`,
        `"${e.mobile || ''}"`,
        `"${e.initialReading || ''}"`,
        `"${e.appliedLoad || ''}"`,
        `"${e.phase || ''}"`,
        `"${e.tariffCategory || ''}"`,
        `"${e.serviceCableLength || ''}"`,
        `"${(e.address || '').replace(/"/g, '""')}"`,
        `"${e.meterInstallDate || ''}"`,
        `"${(e.inspectionAgencyName || '').replace(/"/g, '""')}"`,
        `"${(e.workerName || '').replace(/"/g, '""')}"`,
        `"${(e.agencyName || '').replace(/"/g, '""')}"`,
        `"${(e.cccName || e.cccOffice || '').replace(/"/g, '""')}"`,
        `"${(e.feederName || '').replace(/"/g, '""')}"`,
        `"${(e.substation || '').replace(/"/g, '""')}"`,
        `"${e.status}"`,
        `"${e.locationGps || ''}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ]);
    } else if (targetCategory === 'DISCONNECTION') {
      filename = `WBSEDCL_Disconnection_Report_${dateStamp}.csv`;
      headers = [
        'SL No',
        'Record ID',
        'Date Time',
        'Consumer ID',
        'Consumer Name',
        'Mobile No',
        'Address / Location',
        'Arrear Amount (INR)',
        'Disconnection Reason',
        'Final Meter Reading (kWh)',
        'Meter No',
        'Pole No',
        'Lineman / Staff Name',
        'Feeder Name',
        'CCC Office',
        'Status',
        'GPS Coordinates',
        'Remarks / Notes'
      ];
      rows = targetEntries.map((e, idx) => [
        String(idx + 1),
        `"${e.id}"`,
        `"${new Date(e.date).toLocaleString()}"`,
        `"${e.consumerId || ''}"`,
        `"${(e.consumerName || '').replace(/"/g, '""')}"`,
        `"${e.mobile || ''}"`,
        `"${(e.address || '').replace(/"/g, '""')}"`,
        `"${e.arrearAmount || ''}"`,
        `"${(e.reason || '').replace(/"/g, '""')}"`,
        `"${e.finalReading || ''}"`,
        `"${e.meterNo || ''}"`,
        `"${e.poleNo || ''}"`,
        `"${(e.workerName || '').replace(/"/g, '""')}"`,
        `"${(e.feederName || '').replace(/"/g, '""')}"`,
        `"${(e.cccOffice || '').replace(/"/g, '""')}"`,
        `"${e.status}"`,
        `"${e.locationGps || ''}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ]);
    } else if (targetCategory === 'POLE CASE') {
      filename = `WBSEDCL_Pole_Case_Report_${dateStamp}.csv`;
      headers = [
        'SL No',
        'Record ID',
        'Date Time',
        'Pole Number',
        'Fault / Issue Type',
        'Priority Level',
        'Location / Address',
        'Maintenance Action Taken',
        'Materials Consumed',
        'Lineman / Staff Name',
        'Feeder Name',
        'Substation',
        'Status',
        'GPS Coordinates',
        'Remarks / Notes'
      ];
      rows = targetEntries.map((e, idx) => [
        String(idx + 1),
        `"${e.id}"`,
        `"${new Date(e.date).toLocaleString()}"`,
        `"${e.poleNo || ''}"`,
        `"${(e.issueType || '').replace(/"/g, '""')}"`,
        `"${e.priority || ''}"`,
        `"${(e.address || '').replace(/"/g, '""')}"`,
        `"${(e.actionTaken || '').replace(/"/g, '""')}"`,
        `"${(e.materialUsed || '').replace(/"/g, '""')}"`,
        `"${(e.workerName || '').replace(/"/g, '""')}"`,
        `"${(e.feederName || '').replace(/"/g, '""')}"`,
        `"${(e.substation || '').replace(/"/g, '""')}"`,
        `"${e.status}"`,
        `"${e.locationGps || ''}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ]);
    } else if (targetCategory === 'METER REPLESMENT') {
      filename = `WBSEDCL_Meter_Replacement_Report_${dateStamp}.csv`;
      headers = [
        'SL No',
        'Record ID',
        'Date Time',
        'Consumer ID',
        'Consumer Name',
        'Mobile No',
        'Address / Location',
        'Old Defective Meter No',
        'Old Meter Final Reading',
        'New Meter Serial No',
        'New Initial Reading',
        'Security Seal No',
        'Replacement Reason',
        'Lineman / Staff Name',
        'Feeder Name',
        'Status',
        'GPS Coordinates',
        'Remarks / Notes'
      ];
      rows = targetEntries.map((e, idx) => [
        String(idx + 1),
        `"${e.id}"`,
        `"${new Date(e.date).toLocaleString()}"`,
        `"${e.consumerId || ''}"`,
        `"${(e.consumerName || '').replace(/"/g, '""')}"`,
        `"${e.mobile || ''}"`,
        `"${(e.address || '').replace(/"/g, '""')}"`,
        `"${e.oldMeterNo || ''}"`,
        `"${e.finalReading || ''}"`,
        `"${e.newMeterNo || ''}"`,
        `"${e.initialReading || ''}"`,
        `"${e.sealNo || ''}"`,
        `"${(e.reason || '').replace(/"/g, '""')}"`,
        `"${(e.workerName || '').replace(/"/g, '""')}"`,
        `"${(e.feederName || '').replace(/"/g, '""')}"`,
        `"${e.status}"`,
        `"${e.locationGps || ''}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ]);
    } else if (targetCategory === 'DTR REPLESMENT') {
      filename = `WBSEDCL_DTR_Replacement_Report_${dateStamp}.csv`;
      headers = [
        'SL No',
        'Record ID',
        'Date Time',
        'DTR Code / Name',
        'Existing Capacity',
        'Upgraded / New Capacity',
        'Old DTR Serial No',
        'New DTR Serial No',
        'Earth Resistance (Ohms)',
        'Substation',
        'Feeder Name',
        'Location / Address',
        'Lineman / Staff Name',
        'Status',
        'GPS Coordinates',
        'Remarks / Notes'
      ];
      rows = targetEntries.map((e, idx) => [
        String(idx + 1),
        `"${e.id}"`,
        `"${new Date(e.date).toLocaleString()}"`,
        `"${(e.dtrName || '').replace(/"/g, '""')}"`,
        `"${e.existingCapacity || ''}"`,
        `"${e.newCapacity || ''}"`,
        `"${e.oldDtrSerial || ''}"`,
        `"${e.newDtrSerial || ''}"`,
        `"${e.earthResistance || ''}"`,
        `"${(e.substation || '').replace(/"/g, '""')}"`,
        `"${(e.feederName || '').replace(/"/g, '""')}"`,
        `"${(e.address || '').replace(/"/g, '""')}"`,
        `"${(e.workerName || '').replace(/"/g, '""')}"`,
        `"${e.status}"`,
        `"${e.locationGps || ''}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ]);
    } else {
      // ALL CATEGORIES COMPREHENSIVE MASTER REPORT
      filename = `WBSEDCL_Master_All_Categories_Report_${dateStamp}.csv`;
      headers = [
        'SL No',
        'Record ID',
        'Date Time',
        'Category',
        'Lineman / Worker Name',
        'Agency Name',
        'CCC Name',
        'Feeder Name',
        'Substation',
        'Status',
        'Work Order No',
        'Work Order Date',
        'Application No',
        'Consumer ID',
        'Consumer Name',
        "Father's / Husband's Name",
        'Mobile No',
        'Address / Location',
        'Meter No',
        'Meter Seal No',
        'Initial Reading',
        'Final Reading',
        'Applied Load',
        'Supply Phase',
        'Tariff Category',
        'Service Cable Length',
        'Meter Install Date',
        'Inspection Agency',
        'Pole No',
        'Arrear Amount',
        'Reason',
        'Issue Type',
        'Priority',
        'Action Taken',
        'Material Used',
        'Old Meter No',
        'New Meter No',
        'DTR Name',
        'Existing Capacity',
        'New Capacity',
        'Old DTR Serial',
        'New DTR Serial',
        'Earth Resistance',
        'GPS Coordinates',
        'Notes'
      ];
      rows = targetEntries.map((e, idx) => [
        String(idx + 1),
        `"${e.id}"`,
        `"${new Date(e.date).toLocaleString()}"`,
        `"${e.category}"`,
        `"${(e.workerName || '').replace(/"/g, '""')}"`,
        `"${(e.agencyName || '').replace(/"/g, '""')}"`,
        `"${(e.cccName || e.cccOffice || '').replace(/"/g, '""')}"`,
        `"${(e.feederName || '').replace(/"/g, '""')}"`,
        `"${(e.substation || '').replace(/"/g, '""')}"`,
        `"${e.status}"`,
        `"${e.workOrderNo || ''}"`,
        `"${e.workOrderDate || ''}"`,
        `"${e.applicationNo || ''}"`,
        `"${e.consumerId || ''}"`,
        `"${(e.consumerName || '').replace(/"/g, '""')}"`,
        `"${(e.fatherName || '').replace(/"/g, '""')}"`,
        `"${e.mobile || ''}"`,
        `"${(e.address || '').replace(/"/g, '""')}"`,
        `"${e.meterNo || ''}"`,
        `"${e.sealNo || ''}"`,
        `"${e.initialReading || ''}"`,
        `"${e.finalReading || ''}"`,
        `"${e.appliedLoad || ''}"`,
        `"${e.phase || ''}"`,
        `"${e.tariffCategory || ''}"`,
        `"${e.serviceCableLength || ''}"`,
        `"${e.meterInstallDate || ''}"`,
        `"${(e.inspectionAgencyName || '').replace(/"/g, '""')}"`,
        `"${e.poleNo || ''}"`,
        `"${e.arrearAmount || ''}"`,
        `"${(e.reason || '').replace(/"/g, '""')}"`,
        `"${(e.issueType || '').replace(/"/g, '""')}"`,
        `"${e.priority || ''}"`,
        `"${(e.actionTaken || '').replace(/"/g, '""')}"`,
        `"${(e.materialUsed || '').replace(/"/g, '""')}"`,
        `"${e.oldMeterNo || ''}"`,
        `"${e.newMeterNo || ''}"`,
        `"${(e.dtrName || '').replace(/"/g, '""')}"`,
        `"${e.existingCapacity || ''}"`,
        `"${e.newCapacity || ''}"`,
        `"${e.oldDtrSerial || ''}"`,
        `"${e.newDtrSerial || ''}"`,
        `"${e.earthResistance || ''}"`,
        `"${e.locationGps || ''}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ]);
    }

    // UTF-8 BOM prefix \uFEFF ensures Microsoft Excel opens Bengali text and numbers cleanly
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Auto-refresh entries when Admin Dashboard is active to immediately reflect worker submissions
  React.useEffect(() => {
    onRefresh();
    const interval = setInterval(() => {
      onRefresh();
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Filter calculations
  const filteredEntries = entries.filter((item) => {
    if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
      return false;
    }
    if (selectedStatus !== 'ALL' && item.status !== selectedStatus) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const stringified = JSON.stringify(item).toLowerCase();
      return stringified.includes(q);
    }
    return true;
  });

  // Metrics summary
  const total = entries.length;
  const nscCount = entries.filter(e => e.category === 'NSC').length;
  const discCount = entries.filter(e => e.category === 'DISCONNECTION').length;
  const poleCount = entries.filter(e => e.category === 'POLE CASE').length;
  const meterCount = entries.filter(e => e.category === 'METER REPLESMENT').length;
  const dtrCount = entries.filter(e => e.category === 'DTR REPLESMENT').length;
  
  const pendingCount = entries.filter(e => e.status === 'Pending').length;
  const completedCount = entries.filter(e => e.status === 'Completed').length;
  const approvedCount = entries.filter(e => e.status === 'Approved').length;

  const handleStatusChange = async (id: string, newStatus: StatusType) => {
    setUpdatingId(id);
    try {
      const updated = await updateEntry(id, { status: newStatus });
      if (selectedEntry && selectedEntry.id === id) {
        setSelectedEntry(updated);
      }
      onRefresh();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(`Are you sure you want to delete entry #${id}?`)) {
      try {
        await deleteEntry(id);
        if (selectedEntry?.id === id) setSelectedEntry(null);
        onRefresh();
      } catch (err: any) {
        alert(`Failed to delete entry: ${err.message}`);
      }
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to permanently clear all recorded entries? This action cannot be undone.')) {
      try {
        await clearAllEntries();
        setSelectedEntry(null);
        onRefresh();
      } catch (err: any) {
        alert(`Failed to clear entries: ${err.message}`);
      }
    }
  };

  const handlePrintCertificate = (entry: PowerEntry) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>POWER Utility Work Receipt - ${entry.id}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #111; }
          .header { text-align: center; border-bottom: 2px solid #f59e0b; padding-bottom: 15px; margin-bottom: 20px; }
          .title { font-size: 26px; font-weight: bold; color: #b45309; }
          .subtitle { font-size: 14px; color: #555; }
          .badge { display: inline-block; padding: 4px 12px; background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; border-radius: 6px; font-weight: bold; font-size: 13px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
          .card { border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px; background: #fafafa; }
          .card-title { font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: bold; margin-bottom: 4px; }
          .card-val { font-size: 15px; font-weight: 600; color: #111827; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 13px; }
          th { background: #f3f4f6; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; padding-top: 30px; border-top: 1px dashed #9ca3af; }
          .sig-line { width: 180px; border-top: 1px solid #374151; text-align: center; font-size: 12px; padding-top: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">⚡ POWER DISTRIBUTION FIELD REPORT</div>
          <div class="subtitle">Electric Utility Work Order & Verification Certificate</div>
          <div style="margin-top: 10px;">
            <span class="badge">Category: ${entry.category}</span>
            <span class="badge" style="background:#e0f2fe; color:#0369a1; border-color:#38bdf8;">Work ID: ${entry.id}</span>
            <span class="badge" style="background:#dcfce7; color:#15803d; border-color:#22c55e;">Status: ${entry.status}</span>
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-title">Worker / Lineman Name</div>
            <div class="card-val">${entry.workerName || 'N/A'}</div>
          </div>
          <div class="card">
            <div class="card-title">Submission Date & Time</div>
            <div class="card-val">${new Date(entry.date).toLocaleString()}</div>
          </div>
          <div class="card">
            <div class="card-title">Substation & Feeder</div>
            <div class="card-val">${entry.feederName || 'N/A'}</div>
          </div>
          <div class="card">
            <div class="card-title">Site / GPS Coordinates</div>
            <div class="card-val">${entry.locationGps || entry.address || 'Field Location Recorded'}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Field Parameter</th>
              <th>Recorded Value / Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${entry.consumerName ? `<tr><td><strong>Consumer Name</strong></td><td>${entry.consumerName} ${entry.fatherName ? `(Father: ${entry.fatherName})` : ''}</td></tr>` : ''}
            ${entry.consumerId ? `<tr><td><strong>Consumer / Account ID</strong></td><td>${entry.consumerId}</td></tr>` : ''}
            ${entry.mobile ? `<tr><td><strong>Mobile Contact</strong></td><td>${entry.mobile}</td></tr>` : ''}
            ${entry.address ? `<tr><td><strong>Address / Location</strong></td><td>${entry.address}</td></tr>` : ''}
            ${entry.poleNo ? `<tr><td><strong>Pole Number</strong></td><td>${entry.poleNo}</td></tr>` : ''}
            ${entry.appliedLoad ? `<tr><td><strong>Applied Load / Phase</strong></td><td>${entry.appliedLoad} (${entry.phase || '1-Phase'})</td></tr>` : ''}
            ${entry.meterNo ? `<tr><td><strong>Meter Serial No.</strong></td><td>${entry.meterNo} (Initial Reading: ${entry.initialReading || '000000'})</td></tr>` : ''}
            ${entry.sealNo ? `<tr><td><strong>Security Seal No.</strong></td><td>${entry.sealNo}</td></tr>` : ''}
            ${entry.arrearAmount ? `<tr><td><strong>Arrear Amount</strong></td><td>₹ ${entry.arrearAmount}</td></tr>` : ''}
            ${entry.reason ? `<tr><td><strong>Disconnection Reason</strong></td><td>${entry.reason}</td></tr>` : ''}
            ${entry.finalReading ? `<tr><td><strong>Final Meter Reading</strong></td><td>${entry.finalReading} kWh</td></tr>` : ''}
            ${entry.issueType ? `<tr><td><strong>Pole Fault / Issue</strong></td><td>${entry.issueType}</td></tr>` : ''}
            ${entry.priority ? `<tr><td><strong>Priority Level</strong></td><td>${entry.priority}</td></tr>` : ''}
            ${entry.actionTaken ? `<tr><td><strong>Maintenance Action</strong></td><td>${entry.actionTaken}</td></tr>` : ''}
            ${entry.materialUsed ? `<tr><td><strong>Materials Consumed</strong></td><td>${entry.materialUsed}</td></tr>` : ''}
            ${entry.oldMeterNo ? `<tr><td><strong>Old Meter No. & Reading</strong></td><td>${entry.oldMeterNo} (Reading: ${entry.finalReading || 'N/A'})</td></tr>` : ''}
            ${entry.newMeterNo ? `<tr><td><strong>New Meter Serial No.</strong></td><td>${entry.newMeterNo} (Reading: ${entry.initialReading || '000000'})</td></tr>` : ''}
            ${entry.dtrName ? `<tr><td><strong>DTR Code & Capacity</strong></td><td>${entry.dtrName} (${entry.existingCapacity || ''} ➔ ${entry.newCapacity || ''})</td></tr>` : ''}
            ${entry.oldDtrSerial ? `<tr><td><strong>Old DTR Serial</strong></td><td>${entry.oldDtrSerial}</td></tr>` : ''}
            ${entry.newDtrSerial ? `<tr><td><strong>New DTR Serial</strong></td><td>${entry.newDtrSerial}</td></tr>` : ''}
            ${entry.earthResistance ? `<tr><td><strong>Earth Resistance</strong></td><td>${entry.earthResistance}</td></tr>` : ''}
            ${entry.notes ? `<tr><td><strong>Technician Notes</strong></td><td>${entry.notes}</td></tr>` : ''}
          </tbody>
        </table>

        <div class="footer">
          <div>
            <div class="sig-line">Lineman / Field Technician Signature</div>
          </div>
          <div>
            <div class="sig-line">Sub-Assistant Engineer / Officer</div>
          </div>
          <div>
            <div class="sig-line">POWER Admin Approval Seal</div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      {/* Admin Top Dashboard Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <img 
              src={appLogo} 
              alt="Power of Construction Round Logo" 
              className="w-12 h-12 rounded-full object-cover shadow-sm border-2 border-amber-400 p-0.5 bg-white shrink-0 ring-2 ring-slate-100"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  POWER Admin Control Panel
                </h1>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live Master Data
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                All field entries submitted by linemen and workers are synced and secured here in real time
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              id="admin-work-orders-toggle-btn"
              onClick={() => setShowWorkOrdersManager(!showWorkOrdersManager)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer ${
                showWorkOrdersManager 
                  ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400' 
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
              title="Upload and manage NSC Work Orders and Khata Slips for field workers"
            >
              <FileImage className="w-4 h-4 text-amber-200" />
              <span>NSC Work Order & Khata Photo ({showWorkOrdersManager ? 'Hide' : 'Manage'})</span>
            </button>

            <button
              id="admin-manage-users-btn"
              onClick={() => {
                setUserModalTab('create');
                setIsUserModalOpen(true);
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
              title="Create new worker or admin IDs and manage accounts"
            >
              <UserPlus className="w-4 h-4 text-emerald-200" />
              <span>User ID & Worker Management</span>
            </button>

            <button
              id="admin-change-password-btn"
              onClick={() => {
                setUserModalTab('change-password');
                setIsUserModalOpen(true);
              }}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
              title="যেকোনো কর্মী বা এডমিনের পাসওয়ার্ড পরিবর্তন করুন"
            >
              <KeyRound className="w-4 h-4 text-amber-200" />
              <span>Change Password (পাসওয়ার্ড পরিবর্তন)</span>
            </button>

            {/* Category-Specific Excel / CSV Export Button & Dropdown */}
            <div className="relative">
              <div className="inline-flex rounded-lg shadow-xs">
                <button
                  id="admin-export-csv-btn"
                  onClick={() => handleExportCategoryExcel(selectedCategory)}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-l-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  title={`Download ${selectedCategory === 'ALL' ? 'All' : selectedCategory} Excel / CSV Report`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>
                    Export {selectedCategory === 'ALL' ? 'Master' : selectedCategory} Excel
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="px-2 py-2 bg-slate-800 hover:bg-slate-700 text-white border-l border-slate-700 rounded-r-lg text-xs transition-colors cursor-pointer"
                  title="Choose Category to Export"
                >
                  ▼
                </button>
              </div>

              {/* Category Export Dropdown */}
              {showExportMenu && (
                <div 
                  className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-1 animate-in fade-in"
                  onClick={() => setShowExportMenu(false)}
                >
                  <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400 tracking-wider border-b border-slate-100">
                    {lang === 'bn' ? 'ক্যাটাগরি ভিত্তিক এক্সেল ডাউনলোড' : 'Category-Specific Excel Export'}
                  </div>
                  
                  <button
                    onClick={() => handleExportCategoryExcel('NSC')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-amber-50 text-xs font-bold text-slate-800 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5 text-amber-700">
                      <Zap className="w-3.5 h-3.5" />
                      1. NSC Only ({nscCount})
                    </span>
                    <Download className="w-3 h-3 text-slate-400" />
                  </button>

                  <button
                    onClick={() => handleExportCategoryExcel('DISCONNECTION')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-xs font-bold text-slate-800 flex items-center justify-between"
                  >
                    <span className="text-rose-700">2. Disconnection Only ({discCount})</span>
                    <Download className="w-3 h-3 text-slate-400" />
                  </button>

                  <button
                    onClick={() => handleExportCategoryExcel('POLE CASE')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-xs font-bold text-slate-800 flex items-center justify-between"
                  >
                    <span className="text-blue-700">3. Pole Case Only ({poleCount})</span>
                    <Download className="w-3 h-3 text-slate-400" />
                  </button>

                  <button
                    onClick={() => handleExportCategoryExcel('METER REPLESMENT')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-50 text-xs font-bold text-slate-800 flex items-center justify-between"
                  >
                    <span className="text-purple-700">4. Meter Replacement ({meterCount})</span>
                    <Download className="w-3 h-3 text-slate-400" />
                  </button>

                  <button
                    onClick={() => handleExportCategoryExcel('DTR REPLESMENT')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 text-xs font-bold text-slate-800 flex items-center justify-between"
                  >
                    <span className="text-emerald-700">5. DTR Replacement ({dtrCount})</span>
                    <Download className="w-3 h-3 text-slate-400" />
                  </button>

                  <div className="border-t border-slate-100 my-1"></div>

                  <button
                    onClick={() => handleExportCategoryExcel('ALL')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center justify-between hover:bg-slate-800"
                  >
                    <span>Download All 5 Categories ({total})</span>
                    <Download className="w-3 h-3 text-emerald-400" />
                  </button>
                </div>
              )}
            </div>

            <button
              id="admin-refresh-btn"
              onClick={onRefresh}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-200 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {onOpenLanguageModal && (
              <button
                id="admin-language-btn"
                onClick={onOpenLanguageModal}
                className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-blue-200 transition-all cursor-pointer shadow-xs"
                title="Change Language"
              >
                <Globe className="w-4 h-4 text-blue-600" />
                <span className="uppercase text-[11px] font-mono">{lang}</span>
              </button>
            )}

            {entries.length > 0 && (
              <button
                id="admin-clear-all-btn"
                onClick={handleClearAll}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-rose-200 transition-colors cursor-pointer"
                title="Clear All Data"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span className="hidden sm:inline">Clear All</span>
              </button>
            )}

            {onLogout && (
              <button
                id="admin-module-logout-btn"
                onClick={onLogout}
                className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/80 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                title="Logout from Admin Session"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </div>

        {/* 5 Requested Category Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 mt-4">
          <div 
            onClick={() => {
              setSelectedCategory('ALL');
              document.getElementById('admin-category-data-view')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all active:scale-[0.98] ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-800 scale-[1.02]'
                : 'bg-slate-50/80 border-slate-200 hover:bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold uppercase ${selectedCategory === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>Total Entries</span>
              <Layers className={`w-3.5 h-3.5 ${selectedCategory === 'ALL' ? 'text-amber-400' : 'text-slate-400'}`} />
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${selectedCategory === 'ALL' ? 'text-amber-400' : 'text-slate-900'}`}>{total}</div>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-[10px] ${selectedCategory === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>All 5 Categories</span>
              {selectedCategory === 'ALL' && (
                <span className="text-[9px] bg-amber-400 text-slate-950 font-bold px-1.5 py-0.2 rounded">Active</span>
              )}
            </div>
          </div>

          <div 
            onClick={() => {
              setSelectedCategory('NSC');
              document.getElementById('admin-category-data-view')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all active:scale-[0.98] ${
              selectedCategory === 'NSC'
                ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md ring-2 ring-amber-400 scale-[1.02]'
                : 'bg-slate-50/80 border-slate-200 hover:bg-white hover:border-amber-300'
            }`}
          >
            <div className={`text-[11px] font-bold uppercase flex items-center justify-between ${selectedCategory === 'NSC' ? 'text-slate-950' : 'text-amber-700'}`}>
              <span>1. NSC</span>
              <Zap className="w-3.5 h-3.5 fill-current" />
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${selectedCategory === 'NSC' ? 'text-slate-950' : 'text-slate-900'}`}>{nscCount}</div>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-[10px] ${selectedCategory === 'NSC' ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>New Connection</span>
              {selectedCategory === 'NSC' && (
                <span className="text-[9px] bg-slate-950 text-amber-400 font-bold px-1.5 py-0.2 rounded">Active</span>
              )}
            </div>
          </div>

          <div 
            onClick={() => {
              setSelectedCategory('DISCONNECTION');
              document.getElementById('admin-category-data-view')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all active:scale-[0.98] ${
              selectedCategory === 'DISCONNECTION'
                ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-400 scale-[1.02]'
                : 'bg-slate-50/80 border-slate-200 hover:bg-white hover:border-rose-300'
            }`}
          >
            <div className={`text-[11px] font-bold uppercase flex items-center justify-between ${selectedCategory === 'DISCONNECTION' ? 'text-rose-100' : 'text-rose-700'}`}>
              <span>2. DISCONNECT</span>
              <PowerOff className="w-3.5 h-3.5" />
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${selectedCategory === 'DISCONNECTION' ? 'text-white' : 'text-slate-900'}`}>{discCount}</div>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-[10px] ${selectedCategory === 'DISCONNECTION' ? 'text-rose-100 font-semibold' : 'text-slate-500'}`}>Disconnections</span>
              {selectedCategory === 'DISCONNECTION' && (
                <span className="text-[9px] bg-white text-rose-700 font-bold px-1.5 py-0.2 rounded">Active</span>
              )}
            </div>
          </div>

          <div 
            onClick={() => {
              setSelectedCategory('POLE CASE');
              document.getElementById('admin-category-data-view')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all active:scale-[0.98] ${
              selectedCategory === 'POLE CASE'
                ? 'bg-sky-600 text-white border-sky-600 shadow-md ring-2 ring-sky-400 scale-[1.02]'
                : 'bg-slate-50/80 border-slate-200 hover:bg-white hover:border-sky-300'
            }`}
          >
            <div className={`text-[11px] font-bold uppercase flex items-center justify-between ${selectedCategory === 'POLE CASE' ? 'text-sky-100' : 'text-sky-700'}`}>
              <span>3. POLE CASE</span>
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${selectedCategory === 'POLE CASE' ? 'text-white' : 'text-slate-900'}`}>{poleCount}</div>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-[10px] ${selectedCategory === 'POLE CASE' ? 'text-sky-100 font-semibold' : 'text-slate-500'}`}>Poles & Lines</span>
              {selectedCategory === 'POLE CASE' && (
                <span className="text-[9px] bg-white text-sky-700 font-bold px-1.5 py-0.2 rounded">Active</span>
              )}
            </div>
          </div>

          <div 
            onClick={() => {
              setSelectedCategory('METER REPLESMENT');
              document.getElementById('admin-category-data-view')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all active:scale-[0.98] ${
              selectedCategory === 'METER REPLESMENT'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400 scale-[1.02]'
                : 'bg-slate-50/80 border-slate-200 hover:bg-white hover:border-emerald-300'
            }`}
          >
            <div className={`text-[11px] font-bold uppercase flex items-center justify-between ${selectedCategory === 'METER REPLESMENT' ? 'text-emerald-100' : 'text-emerald-700'}`}>
              <span>4. METER REP.</span>
              <RefreshCw className="w-3.5 h-3.5" />
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${selectedCategory === 'METER REPLESMENT' ? 'text-white' : 'text-slate-900'}`}>{meterCount}</div>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-[10px] ${selectedCategory === 'METER REPLESMENT' ? 'text-emerald-100 font-semibold' : 'text-slate-500'}`}>Replacement</span>
              {selectedCategory === 'METER REPLESMENT' && (
                <span className="text-[9px] bg-white text-emerald-700 font-bold px-1.5 py-0.2 rounded">Active</span>
              )}
            </div>
          </div>

          <div 
            onClick={() => {
              setSelectedCategory('DTR REPLESMENT');
              document.getElementById('admin-category-data-view')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all active:scale-[0.98] ${
              selectedCategory === 'DTR REPLESMENT'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-400 scale-[1.02]'
                : 'bg-slate-50/80 border-slate-200 hover:bg-white hover:border-indigo-300'
            }`}
          >
            <div className={`text-[11px] font-bold uppercase flex items-center justify-between ${selectedCategory === 'DTR REPLESMENT' ? 'text-indigo-100' : 'text-indigo-700'}`}>
              <span>5. DTR REP.</span>
              <Activity className="w-3.5 h-3.5" />
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${selectedCategory === 'DTR REPLESMENT' ? 'text-white' : 'text-slate-900'}`}>{dtrCount}</div>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-[10px] ${selectedCategory === 'DTR REPLESMENT' ? 'text-indigo-100 font-semibold' : 'text-slate-500'}`}>Transformer</span>
              {selectedCategory === 'DTR REPLESMENT' && (
                <span className="text-[9px] bg-white text-indigo-700 font-bold px-1.5 py-0.2 rounded">Active</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ADMIN WORK ORDER / KHATA PHOTO MANAGEMENT SECTION */}
      {showWorkOrdersManager && (
        <div className="bg-slate-900/5 p-4 sm:p-6 rounded-2xl border border-amber-300 shadow-sm animate-in fade-in space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-500 text-slate-950 rounded-lg">
                <FileImage className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {lang === 'bn' ? '⚡ NSC ওয়ার্ক অর্ডার ও খাতার ফটো ম্যানেজমেন্ট (Admin Upload & Control)' : '⚡ NSC Work Order & Khata Photo Management'}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'bn' ? 'এখানে আপলোড করা ছবি ফিল্ড কর্মীরা NSC এন্ট্রি করার সময় সঙ্গে সঙ্গে দেখতে পাবে' : 'Photos uploaded here will be instantly visible to field workers during NSC entries'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowWorkOrdersManager(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              title="Close Panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <WorkOrderNoticeSection
            category="NSC"
            currentUser={{
              idNo: '8695716192',
              phone: '8695716192',
              name: 'Admin Controller',
              role: 'admin',
              status: 'active'
            }}
            lang={lang}
            isAdmin={true}
          />
        </div>
      )}

      {/* DEDICATED CATEGORY DATA SECTION CONTAINER */}
      <div id="admin-category-data-view" className="space-y-4 pt-2">
        {/* Dynamic Category Hero Banner */}
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all shadow-sm ${
          selectedCategory === 'NSC' ? 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-300' :
          selectedCategory === 'DISCONNECTION' ? 'bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border-rose-300' :
          selectedCategory === 'POLE CASE' ? 'bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent border-sky-300' :
          selectedCategory === 'METER REPLESMENT' ? 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-300' :
          selectedCategory === 'DTR REPLESMENT' ? 'bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-transparent border-indigo-300' :
          'bg-gradient-to-r from-slate-900/10 via-slate-900/5 to-transparent border-slate-300'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white shadow-sm shrink-0 ${
                selectedCategory === 'NSC' ? 'bg-amber-500 text-slate-950' :
                selectedCategory === 'DISCONNECTION' ? 'bg-rose-600 text-white' :
                selectedCategory === 'POLE CASE' ? 'bg-sky-600 text-white' :
                selectedCategory === 'METER REPLESMENT' ? 'bg-emerald-600 text-white' :
                selectedCategory === 'DTR REPLESMENT' ? 'bg-indigo-600 text-white' :
                'bg-slate-900 text-white'
              }`}>
                {selectedCategory === 'NSC' && <Zap className="w-6 h-6 fill-current" />}
                {selectedCategory === 'DISCONNECTION' && <PowerOff className="w-6 h-6" />}
                {selectedCategory === 'POLE CASE' && <ShieldAlert className="w-6 h-6" />}
                {selectedCategory === 'METER REPLESMENT' && <RefreshCw className="w-6 h-6" />}
                {selectedCategory === 'DTR REPLESMENT' && <Activity className="w-6 h-6" />}
                {selectedCategory === 'ALL' && <Layers className="w-6 h-6" />}
              </div>
              
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    {selectedCategory === 'NSC' && (lang === 'bn' ? '⚡ NSC — নতুন সার্ভিস কানেকশন ডাটা (New Service Connection)' : '⚡ NSC — New Service Connection Data')}
                    {selectedCategory === 'DISCONNECTION' && (lang === 'bn' ? '🚫 DISCONNECTION — বিদ্যুৎ বিচ্ছিন্নকরণ ডাটা' : '🚫 DISCONNECTION — Power Disconnection Data')}
                    {selectedCategory === 'POLE CASE' && (lang === 'bn' ? '🏗️ POLE CASE — খুঁটি ও তার লাইন মেরামত ডাটা' : '🏗️ POLE CASE — Poles & Overhead Line Data')}
                    {selectedCategory === 'METER REPLESMENT' && (lang === 'bn' ? '🔄 METER REPLACEMENT — মিটার পরিবর্তন ও নতুন সিল ডাটা' : '🔄 METER REPLACEMENT — Meter Replacement Data')}
                    {selectedCategory === 'DTR REPLESMENT' && (lang === 'bn' ? '⚡ DTR REPLACEMENT — ট্রান্সফরমার পরিবর্তন ও মেরামত ডাটা' : '⚡ DTR REPLACEMENT — Distribution Transformer Data')}
                    {selectedCategory === 'ALL' && (lang === 'bn' ? '📋 MASTER OVERVIEW — সমস্ত ৫টি ক্যাটাগরির মাস্টার ডাটা' : '📋 MASTER OVERVIEW — All 5 Categories Master Data')}
                  </h2>
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border shadow-xs ${
                    selectedCategory === 'NSC' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                    selectedCategory === 'DISCONNECTION' ? 'bg-rose-100 text-rose-900 border-rose-300' :
                    selectedCategory === 'POLE CASE' ? 'bg-sky-100 text-sky-900 border-sky-300' :
                    selectedCategory === 'METER REPLESMENT' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                    selectedCategory === 'DTR REPLESMENT' ? 'bg-indigo-100 text-indigo-900 border-indigo-300' :
                    'bg-slate-200 text-slate-900 border-slate-300'
                  }`}>
                    {filteredEntries.length} Records Found
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  {selectedCategory === 'NSC' && (lang === 'bn' ? 'ওয়ার্ক অর্ডার, কনজিউমার নাম, মোবাইল, মিটার নম্বর, সিকিউরিটি সিল, লোড, ফেজ ও খাতার ফটোর লাইভ রেকর্ড' : 'Live records of work orders, consumers, meter & seal numbers, loads, phases, and khata slips')}
                  {selectedCategory === 'DISCONNECTION' && (lang === 'bn' ? 'কনজিউমার আইডি, মোট বকেয়া টাকা (Arrears), ডিসকানেকশনের কারণ, ফাইনাল রিডিং ও পোল রেকর্ডের লাইভ ডাটা' : 'Live records of consumer IDs, arrear amounts, disconnection reasons, and final meter readings')}
                  {selectedCategory === 'POLE CASE' && (lang === 'bn' ? 'পোল নম্বর, ত্রুটির ধরন, প্রায়োরিটি, লাইনে কাজ ও ব্যবহৃত উপাদানের লাইভ ডাটা' : 'Live records of pole numbers, fault types, breakdown priority, and repair materials used')}
                  {selectedCategory === 'METER REPLESMENT' && (lang === 'bn' ? 'পুরোনো মিটার নম্বর ও রিডিং, নতুন মিটার নম্বর, ইনিশিয়াল রিডিং, নতুন সিল ও কারণ' : 'Live records of old defective meters, final readings, new meter serials, and security seals')}
                  {selectedCategory === 'DTR REPLESMENT' && (lang === 'bn' ? 'ট্রান্সফরমার নাম, পূর্বের ও নতুন ক্ষমতা (kVA), সিরিয়াল নম্বর ও আর্থ রেজিস্ট্যান্স' : 'Live records of transformer names, existing vs new capacity (kVA), serials, and earth resistance')}
                  {selectedCategory === 'ALL' && (lang === 'bn' ? 'WBSEDCL এর ৫টি ডিপার্টমেন্টাল কাজের সমন্বিত মাস্টার তালিকা' : 'Consolidated master table of all departmental electrical operations')}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons for Active Category */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                onClick={() => handleExportCategoryExcel(selectedCategory)}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                title={`Export ${selectedCategory} Data to Excel / CSV`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export {selectedCategory === 'ALL' ? 'Master' : selectedCategory} Excel</span>
              </button>

              {selectedCategory === 'NSC' && (
                <button
                  onClick={() => setShowWorkOrdersManager(!showWorkOrdersManager)}
                  className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Upload or Manage NSC Work Orders & Khata Slips"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  <span>{showWorkOrdersManager ? 'Hide Khata Slips' : 'NSC Khata Slips'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter and Search Controls Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Quick Option Pill Switcher */}
          <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline mr-1">
              Select Option:
            </span>
            {[
              { id: 'ALL', label: 'All', count: total },
              { id: 'NSC', label: '1. NSC', count: nscCount },
              { id: 'DISCONNECTION', label: '2. Disconnection', count: discCount },
              { id: 'POLE CASE', label: '3. Pole Case', count: poleCount },
              { id: 'METER REPLESMENT', label: '4. Meter Rep.', count: meterCount },
              { id: 'DTR REPLESMENT', label: '5. DTR Rep.', count: dtrCount }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === tab.id
                    ? tab.id === 'NSC' ? 'bg-amber-500 text-slate-950 shadow-xs ring-1 ring-amber-400' :
                      tab.id === 'DISCONNECTION' ? 'bg-rose-600 text-white shadow-xs' :
                      tab.id === 'POLE CASE' ? 'bg-sky-600 text-white shadow-xs' :
                      tab.id === 'METER REPLESMENT' ? 'bg-emerald-600 text-white shadow-xs' :
                      tab.id === 'DTR REPLESMENT' ? 'bg-indigo-600 text-white shadow-xs' :
                      'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  selectedCategory === tab.id ? 'bg-black/20 text-inherit' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search and Status Dropdown */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="admin-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search in ${selectedCategory}...`}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-slate-900"
            >
              <option value="ALL">All Status</option>
              <option value="Approved">Approved</option>
              <option value="Completed">Completed</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Specialized Data Table Container */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-4 sm:px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-700" />
              <span className="text-xs sm:text-sm font-bold text-slate-900">
                {selectedCategory === 'ALL' ? 'All Recorded Entries' : `${selectedCategory} Data List`} ({filteredEntries.length})
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              Click any record to inspect, approve, edit or print receipt
            </span>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="font-semibold text-slate-700">
                No records found in {selectedCategory}
              </p>
              <p className="text-xs text-slate-500">
                Try clearing the search query or switch to another category option above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                {/* 1. Specialized Headers for NSC */}
                {selectedCategory === 'NSC' && (
                  <thead className="bg-amber-50/70 text-amber-950 text-[11px] uppercase tracking-wider border-b border-amber-200 font-extrabold">
                    <tr>
                      <th className="px-3.5 py-3">ID & Date</th>
                      <th className="px-3.5 py-3">App & Work Order No</th>
                      <th className="px-3.5 py-3">Consumer Details</th>
                      <th className="px-3.5 py-3">Meter No & Seal No</th>
                      <th className="px-3.5 py-3">Load & Phase & Reading</th>
                      <th className="px-3.5 py-3">Lineman & Substation</th>
                      <th className="px-3.5 py-3">Khata Slip / Photo</th>
                      <th className="px-3.5 py-3">Status</th>
                      <th className="px-3.5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                )}

                {/* 2. Specialized Headers for DISCONNECTION */}
                {selectedCategory === 'DISCONNECTION' && (
                  <thead className="bg-rose-50/70 text-rose-950 text-[11px] uppercase tracking-wider border-b border-rose-200 font-extrabold">
                    <tr>
                      <th className="px-3.5 py-3">ID & Date</th>
                      <th className="px-3.5 py-3">Consumer ID & Name</th>
                      <th className="px-3.5 py-3">Mobile & Address</th>
                      <th className="px-3.5 py-3 text-rose-700">Arrear Amount (বকেয়া ₹)</th>
                      <th className="px-3.5 py-3">Disconnection Reason</th>
                      <th className="px-3.5 py-3">Final Reading (kWh)</th>
                      <th className="px-3.5 py-3">Meter & Pole No</th>
                      <th className="px-3.5 py-3">Lineman & Feeder</th>
                      <th className="px-3.5 py-3">Status</th>
                      <th className="px-3.5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                )}

                {/* 3. Specialized Headers for POLE CASE */}
                {selectedCategory === 'POLE CASE' && (
                  <thead className="bg-sky-50/70 text-sky-950 text-[11px] uppercase tracking-wider border-b border-sky-200 font-extrabold">
                    <tr>
                      <th className="px-3.5 py-3">ID & Date</th>
                      <th className="px-3.5 py-3">Pole No & Location</th>
                      <th className="px-3.5 py-3">Issue / Fault Type</th>
                      <th className="px-3.5 py-3">Priority Level</th>
                      <th className="px-3.5 py-3">Action Taken & Materials</th>
                      <th className="px-3.5 py-3">Lineman & Feeder</th>
                      <th className="px-3.5 py-3">Site Photo</th>
                      <th className="px-3.5 py-3">Status</th>
                      <th className="px-3.5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                )}

                {/* 4. Specialized Headers for METER REPLESMENT */}
                {selectedCategory === 'METER REPLESMENT' && (
                  <thead className="bg-emerald-50/70 text-emerald-950 text-[11px] uppercase tracking-wider border-b border-emerald-200 font-extrabold">
                    <tr>
                      <th className="px-3.5 py-3">ID & Date</th>
                      <th className="px-3.5 py-3">Consumer ID & Name</th>
                      <th className="px-3.5 py-3 text-rose-700">Old Meter & Final Reading</th>
                      <th className="px-3.5 py-3 text-emerald-800">New Meter & Initial Reading</th>
                      <th className="px-3.5 py-3">Seal No & Reason</th>
                      <th className="px-3.5 py-3">Lineman & CCC Office</th>
                      <th className="px-3.5 py-3">Site Photo</th>
                      <th className="px-3.5 py-3">Status</th>
                      <th className="px-3.5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                )}

                {/* 5. Specialized Headers for DTR REPLESMENT */}
                {selectedCategory === 'DTR REPLESMENT' && (
                  <thead className="bg-indigo-50/70 text-indigo-950 text-[11px] uppercase tracking-wider border-b border-indigo-200 font-extrabold">
                    <tr>
                      <th className="px-3.5 py-3">ID & Date</th>
                      <th className="px-3.5 py-3">DTR / Transformer Name</th>
                      <th className="px-3.5 py-3">Capacity (Old ➔ New kVA)</th>
                      <th className="px-3.5 py-3">Serial No (Old ➔ New)</th>
                      <th className="px-3.5 py-3">Earth Resistance (Ω) & Oil</th>
                      <th className="px-3.5 py-3">Substation & Feeder</th>
                      <th className="px-3.5 py-3">Lineman & Agency</th>
                      <th className="px-3.5 py-3">Status</th>
                      <th className="px-3.5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                )}

                {/* 6. Headers for ALL */}
                {selectedCategory === 'ALL' && (
                  <thead className="bg-slate-50 text-slate-700 text-[11px] uppercase tracking-wider border-b border-slate-200 font-extrabold">
                    <tr>
                      <th className="px-3.5 py-3">ID & Date</th>
                      <th className="px-3.5 py-3">Category</th>
                      <th className="px-3.5 py-3">Consumer / Pole / Site</th>
                      <th className="px-3.5 py-3">Key Attributes & Specifics</th>
                      <th className="px-3.5 py-3">Lineman / Worker</th>
                      <th className="px-3.5 py-3">Feeder & Location</th>
                      <th className="px-3.5 py-3">Status</th>
                      <th className="px-3.5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                )}

                {/* Dynamic Table Body */}
                <tbody className="divide-y divide-slate-100">
                  {filteredEntries.map((item) => {
                    const isNsc = item.category === 'NSC';
                    const isDisc = item.category === 'DISCONNECTION';
                    const isPole = item.category === 'POLE CASE';
                    const isMeter = item.category === 'METER REPLESMENT';
                    const isDtr = item.category === 'DTR REPLESMENT';

                    return (
                      <tr 
                        key={item.id} 
                        className="hover:bg-slate-50/90 transition-colors group cursor-pointer"
                        onClick={() => setSelectedEntry(item)}
                      >
                        {/* Common ID & Date Column */}
                        <td className="px-3.5 py-3 whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-900">{item.id}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {new Date(item.date).toLocaleDateString('en-IN')} {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        {/* NSC Specific Row Cells */}
                        {selectedCategory === 'NSC' && (
                          <>
                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-semibold text-slate-900">App: {item.applicationNo || 'N/A'}</div>
                              <div className="text-[10px] text-slate-500 font-mono">WO: {item.workOrderNo || 'N/A'}</div>
                            </td>

                            <td className="px-3.5 py-3">
                              <div className="font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                                {item.consumerName || 'N/A'}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {item.fatherName ? `C/O: ${item.fatherName} • ` : ''}
                                {item.mobile ? `Ph: ${item.mobile}` : ''}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[160px]">
                                {item.address || ''}
                              </div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-mono font-bold text-slate-900">Mtr: {item.meterNo || 'N/A'}</div>
                              <div className="text-[10px] text-slate-500 font-mono">Seal: {item.sealNo || 'N/A'}</div>
                              <div className="text-[10px] text-amber-700 font-mono">ID: {item.consumerId || 'N/A'}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-semibold text-slate-900">{item.appliedLoad || '1'} kW ({item.phase || '1-Phase'})</div>
                              <div className="text-[10px] text-slate-500">Init: {item.initialReading || '0'} kWh</div>
                              <div className="text-[10px] text-slate-400">{item.tariffCategory || 'Domestic'}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-medium text-slate-800 flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400" />
                                <span>{item.workerName || 'Worker'}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[130px]">
                                {item.substation || item.feederName || 'Substation'}
                              </div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              {item.workOrderPhoto ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded">
                                  <FileImage className="w-3 h-3 text-amber-700" />
                                  <span>Khata Slip Attached</span>
                                </span>
                              ) : item.photoUrl ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2 py-0.5 rounded">
                                  <Camera className="w-3 h-3 text-emerald-700" />
                                  <span>Field Photo</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">None</span>
                              )}
                            </td>
                          </>
                        )}

                        {/* DISCONNECTION Specific Row Cells */}
                        {selectedCategory === 'DISCONNECTION' && (
                          <>
                            <td className="px-3.5 py-3">
                              <div className="font-bold text-slate-900">{item.consumerName || 'N/A'}</div>
                              <div className="text-[10px] text-rose-700 font-mono font-bold">ID: {item.consumerId || 'N/A'}</div>
                            </td>

                            <td className="px-3.5 py-3">
                              <div className="text-slate-800">{item.mobile || 'N/A'}</div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{item.address || ''}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="text-sm font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block font-mono">
                                ₹ {item.arrearAmount || '0'}
                              </div>
                            </td>

                            <td className="px-3.5 py-3">
                              <div className="text-slate-800 truncate max-w-[180px]" title={item.reason}>
                                {item.reason || 'Non-Payment of Electricity Dues'}
                              </div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap font-mono font-bold text-slate-900">
                              {item.finalReading || '0'} kWh
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-mono text-slate-900">Mtr: {item.meterNo || 'N/A'}</div>
                              <div className="text-[10px] text-slate-500">Pole: {item.poleNo || 'N/A'}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-medium text-slate-800">{item.workerName || 'Worker'}</div>
                              <div className="text-[10px] text-slate-500">{item.cccOffice || item.feederName || 'CCC'}</div>
                            </td>
                          </>
                        )}

                        {/* POLE CASE Specific Row Cells */}
                        {selectedCategory === 'POLE CASE' && (
                          <>
                            <td className="px-3.5 py-3">
                              <div className="font-bold text-slate-900">Pole #{item.poleNo || 'N/A'}</div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[160px]">{item.address || 'Site'}</div>
                            </td>

                            <td className="px-3.5 py-3">
                              <div className="font-semibold text-slate-800">{item.issueType || 'General Fault'}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                item.priority === 'High' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                                item.priority === 'Medium' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                'bg-sky-100 text-sky-800 border-sky-200'
                              }`}>
                                {item.priority || 'Normal'}
                              </span>
                            </td>

                            <td className="px-3.5 py-3">
                              <div className="text-slate-900 font-medium truncate max-w-[180px]">{item.actionTaken || 'Repair complete'}</div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[180px]">{item.materialUsed ? `Materials: ${item.materialUsed}` : ''}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-medium text-slate-800">{item.workerName || 'Worker'}</div>
                              <div className="text-[10px] text-slate-500">{item.feederName || 'Feeder'}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              {item.photoUrl ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-sky-100 text-sky-900 border border-sky-300 font-bold px-2 py-0.5 rounded">
                                  <Camera className="w-3 h-3 text-sky-700" />
                                  <span>Site Photo</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">None</span>
                              )}
                            </td>
                          </>
                        )}

                        {/* METER REPLESMENT Specific Row Cells */}
                        {selectedCategory === 'METER REPLESMENT' && (
                          <>
                            <td className="px-3.5 py-3">
                              <div className="font-bold text-slate-900">{item.consumerName || 'N/A'}</div>
                              <div className="text-[10px] text-slate-500 font-mono">ID: {item.consumerId || 'N/A'} • Ph: {item.mobile || ''}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-mono font-bold text-rose-700">Old: {item.oldMeterNo || 'N/A'}</div>
                              <div className="text-[10px] text-slate-500 font-mono">Final Rdg: {item.finalReading || '0'} kWh</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-mono font-bold text-emerald-700">New: {item.newMeterNo || item.meterNo || 'N/A'}</div>
                              <div className="text-[10px] text-slate-500 font-mono">Init Rdg: {item.initialReading || '0'} kWh</div>
                            </td>

                            <td className="px-3.5 py-3">
                              <div className="font-mono text-slate-800">Seal: {item.sealNo || 'N/A'}</div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{item.replacementReason || 'Burnt/Defective'}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-medium text-slate-800">{item.workerName || 'Worker'}</div>
                              <div className="text-[10px] text-slate-500">{item.cccOffice || 'CCC'}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              {item.photoUrl ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2 py-0.5 rounded">
                                  <Camera className="w-3 h-3 text-emerald-700" />
                                  <span>Photo</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">None</span>
                              )}
                            </td>
                          </>
                        )}

                        {/* DTR REPLESMENT Specific Row Cells */}
                        {selectedCategory === 'DTR REPLESMENT' && (
                          <>
                            <td className="px-3.5 py-3">
                              <div className="font-bold text-slate-900">{item.dtrName || 'Transformer'}</div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{item.address || ''}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-semibold text-indigo-950">
                                {item.existingCapacity || '63 kVA'} ➔ <span className="font-bold text-indigo-700">{item.newCapacity || '100 kVA'}</span>
                              </div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap font-mono text-[11px]">
                              <div>Old: {item.oldDtrSerial || 'N/A'}</div>
                              <div className="text-indigo-700 font-bold">New: {item.newDtrSerial || 'N/A'}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-mono text-slate-900">Earth: {item.earthResistance || 'N/A'} Ω</div>
                              <div className="text-[10px] text-slate-500">Oil: {item.oilLevel || 'Normal'}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div>{item.substation || 'Substation'}</div>
                              <div className="text-[10px] text-slate-500">{item.feederName || 'Feeder'}</div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-medium text-slate-800">{item.workerName || 'Worker'}</div>
                              <div className="text-[10px] text-slate-500">{item.agencyName || 'Agency'}</div>
                            </td>
                          </>
                        )}

                        {/* ALL Specific Row Cells */}
                        {selectedCategory === 'ALL' && (
                          <>
                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                                isNsc ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                isDisc ? 'bg-rose-50 text-rose-800 border-rose-200' :
                                isPole ? 'bg-sky-50 text-sky-800 border-sky-200' :
                                isMeter ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                'bg-indigo-50 text-indigo-800 border-indigo-200'
                              }`}>
                                {item.category}
                              </span>
                            </td>

                            <td className="px-3.5 py-3">
                              <div className="font-semibold text-slate-900 group-hover:text-amber-700 transition-colors">
                                {item.consumerName || item.dtrName || item.poleNo || 'Field Point'}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate max-w-xs">
                                {item.consumerId && `ID: ${item.consumerId} • `}
                                {item.meterNo && `Meter: ${item.meterNo} • `}
                                {item.arrearAmount && `₹ ${item.arrearAmount} • `}
                                {item.address || ''}
                              </div>
                            </td>

                            <td className="px-3.5 py-3 text-slate-600 text-[11px]">
                              {isNsc && <div>Load: {item.appliedLoad || '1 kW'} • WO: {item.workOrderNo || 'N/A'}</div>}
                              {isDisc && <div className="text-rose-700 font-bold">Arrear: ₹ {item.arrearAmount || '0'} • Rdg: {item.finalReading}</div>}
                              {isPole && <div>Issue: {item.issueType || 'Line fault'} (Priority: {item.priority || 'Normal'})</div>}
                              {isMeter && <div>Old: {item.oldMeterNo || 'N/A'} ➔ New: {item.newMeterNo || 'N/A'}</div>}
                              {isDtr && <div>Cap: {item.existingCapacity} ➔ {item.newCapacity}</div>}
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <span>{item.workerName || 'Worker'}</span>
                              </div>
                            </td>

                            <td className="px-3.5 py-3 whitespace-nowrap text-slate-600 text-xs">
                              <div>{item.feederName || 'Main Feeder'}</div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                                {item.substation || item.address || 'Site'}
                              </div>
                            </td>
                          </>
                        )}

                        {/* Status Column */}
                        <td className="px-3.5 py-3 whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            item.status === 'Approved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : item.status === 'Completed'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {item.status}
                          </span>
                        </td>

                        {/* Actions Column */}
                        <td className="px-3.5 py-3 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setSelectedEntry(item)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              title="View Full Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingEntry(item)}
                              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors cursor-pointer"
                              title="Edit Data"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handlePrintCertificate(item)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 transition-colors cursor-pointer"
                              title="Print Receipt"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 transition-colors cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Entry Detail Inspector Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-base sm:text-lg">
                      {selectedEntry.id}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                      {selectedEntry.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Complete entry records and admin verification panel
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedEntry(null)}
                className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
              {/* Status and Action Buttons */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-slate-500 text-xs">Current Status: </span>
                  <span className={`font-bold ml-1 px-2 py-0.5 rounded text-xs border ${
                    selectedEntry.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {selectedEntry.status}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={updatingId === selectedEntry.id}
                    onClick={() => handleStatusChange(selectedEntry.id, 'Approved')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-all shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Entry</span>
                  </button>

                  <button
                    disabled={updatingId === selectedEntry.id}
                    onClick={() => handleStatusChange(selectedEntry.id, 'Completed')}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold text-xs transition-all shadow-xs"
                  >
                    Completed
                  </button>
                </div>
              </div>

              {/* Grid of Key Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Worker</div>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedEntry.workerName}</div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Date & Time</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {new Date(selectedEntry.date).toLocaleDateString('en-IN')}
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Feeder Name</div>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedEntry.feederName || 'N/A'}</div>
                </div>
              </div>

              {/* Category specific details list */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                  Field Data Details ({selectedEntry.category})
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pt-1 text-slate-700">
                  {selectedEntry.consumerName && (
                    <div><strong className="text-slate-900">Consumer Name:</strong> {selectedEntry.consumerName}</div>
                  )}
                  {selectedEntry.fatherName && (
                    <div><strong className="text-slate-900">Father / Husband:</strong> {selectedEntry.fatherName}</div>
                  )}
                  {selectedEntry.consumerId && (
                    <div><strong className="text-slate-900">Consumer ID:</strong> {selectedEntry.consumerId}</div>
                  )}
                  {selectedEntry.mobile && (
                    <div><strong className="text-slate-900">Mobile No:</strong> {selectedEntry.mobile}</div>
                  )}
                  {selectedEntry.address && (
                    <div className="sm:col-span-2"><strong className="text-slate-900">Address / Location:</strong> {selectedEntry.address}</div>
                  )}
                  {selectedEntry.poleNo && (
                    <div><strong className="text-slate-900">Pole Number:</strong> {selectedEntry.poleNo}</div>
                  )}
                  {selectedEntry.appliedLoad && (
                    <div><strong className="text-slate-900">Load & Phase:</strong> {selectedEntry.appliedLoad} ({selectedEntry.phase})</div>
                  )}
                  {selectedEntry.meterNo && (
                    <div><strong className="text-slate-900">Meter Number:</strong> {selectedEntry.meterNo}</div>
                  )}
                  {selectedEntry.initialReading && (
                    <div><strong className="text-slate-900">Initial Reading:</strong> {selectedEntry.initialReading}</div>
                  )}
                  {selectedEntry.sealNo && (
                    <div><strong className="text-slate-900">Seal Number:</strong> {selectedEntry.sealNo}</div>
                  )}
                  {selectedEntry.arrearAmount && (
                    <div><strong className="text-slate-900">Arrear Amount:</strong> ₹ {selectedEntry.arrearAmount}</div>
                  )}
                  {selectedEntry.reason && (
                    <div className="sm:col-span-2"><strong className="text-slate-900">Disconnection Reason:</strong> {selectedEntry.reason}</div>
                  )}
                  {selectedEntry.finalReading && (
                    <div><strong className="text-slate-900">Final Reading:</strong> {selectedEntry.finalReading} kWh</div>
                  )}
                  {selectedEntry.issueType && (
                    <div className="sm:col-span-2"><strong className="text-slate-900">Pole Issue:</strong> {selectedEntry.issueType} (Priority: {selectedEntry.priority})</div>
                  )}
                  {selectedEntry.actionTaken && (
                    <div className="sm:col-span-2"><strong className="text-slate-900">Action Taken:</strong> {selectedEntry.actionTaken}</div>
                  )}
                  {selectedEntry.materialUsed && (
                    <div className="sm:col-span-2"><strong className="text-slate-900">Materials Used:</strong> {selectedEntry.materialUsed}</div>
                  )}
                  {selectedEntry.oldMeterNo && (
                    <div><strong className="text-slate-900">Old Meter No:</strong> {selectedEntry.oldMeterNo}</div>
                  )}
                  {selectedEntry.newMeterNo && (
                    <div><strong className="text-slate-900">New Meter No:</strong> {selectedEntry.newMeterNo}</div>
                  )}
                  {selectedEntry.replacementReason && (
                    <div className="sm:col-span-2"><strong className="text-slate-900">Replacement Reason:</strong> {selectedEntry.replacementReason}</div>
                  )}
                  {selectedEntry.dtrName && (
                    <div><strong className="text-slate-900">DTR Name / Code:</strong> {selectedEntry.dtrName}</div>
                  )}
                  {selectedEntry.existingCapacity && (
                    <div><strong className="text-slate-900">Capacity:</strong> {selectedEntry.existingCapacity} ➔ {selectedEntry.newCapacity}</div>
                  )}
                  {selectedEntry.oldDtrSerial && (
                    <div><strong className="text-slate-900">Old DTR Serial:</strong> {selectedEntry.oldDtrSerial}</div>
                  )}
                  {selectedEntry.newDtrSerial && (
                    <div><strong className="text-slate-900">New DTR Serial:</strong> {selectedEntry.newDtrSerial}</div>
                  )}
                  {selectedEntry.earthResistance && (
                    <div><strong className="text-slate-900">Earth Resistance:</strong> {selectedEntry.earthResistance}</div>
                  )}
                  {selectedEntry.locationGps && (
                    <div className="sm:col-span-2"><strong className="text-slate-900">GPS Coordinates:</strong> {selectedEntry.locationGps}</div>
                  )}
                </div>

                {selectedEntry.notes && (
                  <div className="mt-3 pt-2 border-t border-slate-200">
                    <strong className="text-slate-900">Notes: </strong>
                    <span className="text-slate-700">{selectedEntry.notes}</span>
                  </div>
                )}
              </div>

              {/* Photos Section: Field Photo & Official Work Order Khata Photo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. Official Admin Work Order / Khata Slip Photo */}
                {selectedEntry.workOrderPhoto && (
                  <div className="bg-amber-50/90 p-3.5 rounded-xl border-2 border-amber-300 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-amber-700" />
                          <span>Official Work Order & Khata Slip</span>
                        </span>
                        <span className="text-[10px] bg-amber-600 text-white font-bold px-2 py-0.5 rounded">
                          Admin Order
                        </span>
                      </div>
                      {selectedEntry.workOrderNoticeTitle && (
                        <div className="text-[11px] font-bold text-amber-900 mb-1">
                          {selectedEntry.workOrderNoticeTitle}
                        </div>
                      )}
                      {selectedEntry.workOrderNoticeDate && (
                        <div className="text-[10px] text-amber-800 font-mono mb-2 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-700" />
                          <span>Uploaded: {selectedEntry.workOrderNoticeDate}</span>
                        </div>
                      )}
                    </div>
                    <div className="relative group rounded-lg overflow-hidden border border-amber-300 bg-slate-950">
                      <img 
                        src={selectedEntry.workOrderPhoto} 
                        alt="Work Order Khata Slip" 
                        className="max-h-52 w-full object-contain mx-auto"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                )}

                {/* 2. Field Site Photo / Lineman Installation Evidence */}
                {selectedEntry.photoUrl && (
                  <div className="bg-emerald-50/90 p-3.5 rounded-xl border-2 border-emerald-300 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                          <Camera className="w-4 h-4 text-emerald-700" />
                          <span>Field Site / Installation Media</span>
                        </span>
                        <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded">
                          Worker Evidence
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-800 mb-2">
                        Captured by Lineman / Staff at field location
                      </div>
                    </div>
                    <div className="relative group rounded-lg overflow-hidden border border-emerald-300 bg-slate-950">
                      <img 
                        src={selectedEntry.photoUrl} 
                        alt="Field evidence" 
                        className="max-h-52 w-full object-contain mx-auto"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  const toDelete = selectedEntry.id;
                  handleDelete(toDelete);
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t.delete}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = selectedEntry;
                    setSelectedEntry(null);
                    setEditingEntry(toEdit);
                  }}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>{t.edit}</span>
                </button>
                <button
                  onClick={() => handlePrintCertificate(selectedEntry)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>{t.printReceipt}</span>
                </button>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-bold text-xs cursor-pointer"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Edit / Correction Modal */}
      <EditEntryModal
        isOpen={!!editingEntry}
        entry={editingEntry}
        lang={lang}
        onClose={() => setEditingEntry(null)}
        onUpdated={(updated) => {
          onRefresh();
          setEditingEntry(null);
        }}
        onDeleted={(id) => {
          onRefresh();
          setEditingEntry(null);
        }}
      />

      {/* Admin Worker ID Management Modal */}
      <UserManagementModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        lang={lang}
        initialTab={userModalTab}
      />
    </div>
  );
};
