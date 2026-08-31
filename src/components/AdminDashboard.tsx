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
  Edit3,
  Globe,
  FileText,
  Camera
} from 'lucide-react';
import { PowerEntry, CategoryType, StatusType } from '../types';
import { updateEntry, deleteEntry, clearAllEntries } from '../services/api';
import { UserManagementModal } from './UserManagementModal';
import { EditEntryModal } from './EditEntryModal';
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
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);

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
              id="admin-manage-users-btn"
              onClick={() => setIsUserModalOpen(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
              title="Create new worker or admin IDs and manage accounts"
            >
              <UserPlus className="w-4 h-4 text-emerald-200" />
              <span>User ID & Worker Management</span>
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
            onClick={() => setSelectedCategory('ALL')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-1 ring-slate-900'
                : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300'
            }`}
          >
            <div className={`text-[11px] font-bold uppercase ${selectedCategory === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>Total Entries</div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${selectedCategory === 'ALL' ? 'text-amber-400' : 'text-slate-900'}`}>{total}</div>
            <div className={`text-[10px] ${selectedCategory === 'ALL' ? 'text-slate-400' : 'text-slate-500'}`}>All Categories</div>
          </div>

          <div 
            onClick={() => setSelectedCategory('NSC')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              selectedCategory === 'NSC'
                ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm ring-1 ring-amber-500'
                : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300'
            }`}
          >
            <div className={`text-[11px] font-bold uppercase flex items-center justify-between ${selectedCategory === 'NSC' ? 'text-slate-950' : 'text-amber-700'}`}>
              <span>NSC</span>
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${selectedCategory === 'NSC' ? 'text-slate-950' : 'text-slate-900'}`}>{nscCount}</div>
            <div className={`text-[10px] ${selectedCategory === 'NSC' ? 'text-slate-800' : 'text-slate-500'}`}>New Connection</div>
          </div>

          <div 
            onClick={() => setSelectedCategory('DISCONNECTION')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              selectedCategory === 'DISCONNECTION'
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm ring-1 ring-rose-600'
                : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300'
            }`}
          >
            <div className={`text-[11px] font-bold uppercase flex items-center justify-between ${selectedCategory === 'DISCONNECTION' ? 'text-rose-100' : 'text-rose-700'}`}>
              <span>DISCONNECT</span>
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${selectedCategory === 'DISCONNECTION' ? 'text-white' : 'text-slate-900'}`}>{discCount}</div>
            <div className={`text-[10px] ${selectedCategory === 'DISCONNECTION' ? 'text-rose-200' : 'text-slate-500'}`}>Disconnections</div>
          </div>

          <div 
            onClick={() => setSelectedCategory('POLE CASE')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              selectedCategory === 'POLE CASE'
                ? 'bg-sky-600 text-white border-sky-600 shadow-sm ring-1 ring-sky-600'
                : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300'
            }`}
          >
            <div className={`text-[11px] font-bold uppercase flex items-center justify-between ${selectedCategory === 'POLE CASE' ? 'text-sky-100' : 'text-sky-700'}`}>
              <span>POLE CASE</span>
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${selectedCategory === 'POLE CASE' ? 'text-white' : 'text-slate-900'}`}>{poleCount}</div>
            <div className={`text-[10px] ${selectedCategory === 'POLE CASE' ? 'text-sky-200' : 'text-slate-500'}`}>Poles & Lines</div>
          </div>

          <div 
            onClick={() => setSelectedCategory('METER REPLESMENT')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              selectedCategory === 'METER REPLESMENT'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-1 ring-emerald-600'
                : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300'
            }`}
          >
            <div className={`text-[11px] font-bold uppercase flex items-center justify-between ${selectedCategory === 'METER REPLESMENT' ? 'text-emerald-100' : 'text-emerald-700'}`}>
              <span>METER REP.</span>
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${selectedCategory === 'METER REPLESMENT' ? 'text-white' : 'text-slate-900'}`}>{meterCount}</div>
            <div className={`text-[10px] ${selectedCategory === 'METER REPLESMENT' ? 'text-emerald-200' : 'text-slate-500'}`}>Replacement</div>
          </div>

          <div 
            onClick={() => setSelectedCategory('DTR REPLESMENT')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              selectedCategory === 'DTR REPLESMENT'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-1 ring-indigo-600'
                : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300'
            }`}
          >
            <div className={`text-[11px] font-bold uppercase flex items-center justify-between ${selectedCategory === 'DTR REPLESMENT' ? 'text-indigo-100' : 'text-indigo-700'}`}>
              <span>DTR REP.</span>
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${selectedCategory === 'DTR REPLESMENT' ? 'text-white' : 'text-slate-900'}`}>{dtrCount}</div>
            <div className={`text-[10px] ${selectedCategory === 'DTR REPLESMENT' ? 'text-indigo-200' : 'text-slate-500'}`}>Transformer</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="admin-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Consumer, ID, Pole, Meter, Worker..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <span className="text-slate-500 px-2 font-semibold">Category:</span>
            {['ALL', 'NSC', 'DISCONNECTION', 'POLE CASE', 'METER REPLESMENT', 'DTR REPLESMENT'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all text-xs ${
                  selectedCategory === cat
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {cat === 'ALL' ? 'All' : cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <span className="text-slate-500 px-2 font-semibold">Status:</span>
            {['ALL', 'Completed', 'Approved', 'Pending'].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all text-xs ${
                  selectedStatus === st
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {st === 'ALL' ? 'All' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table / Entry List */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 sm:px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-700" />
            <span className="text-sm font-bold text-slate-900">
              Recorded Entries List ({filteredEntries.length})
            </span>
          </div>
          <span className="text-xs text-slate-500">
            Click row to view details, edit, approve, or print receipt
          </span>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="font-semibold text-slate-700">No records found</p>
            <p className="text-xs text-slate-500">
              Try resetting the search filters or submit a new entry from the form.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider border-b border-slate-200 font-bold">
                <tr>
                  <th className="px-4 py-3">ID & Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Consumer / Pole / Site</th>
                  <th className="px-4 py-3">Worker Name</th>
                  <th className="px-4 py-3">Feeder / Location</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
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
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setSelectedEntry(item)}
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900">{item.id}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(item.date).toLocaleDateString('en-IN')} {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
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

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 group-hover:text-amber-700 transition-colors">
                            {item.consumerName || item.dtrName || item.poleNo || 'Field Point'}
                          </span>
                          {item.workOrderPhoto && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.2 rounded" title="Admin Work Order / Khata Slip Attached">
                              <FileText className="w-2.5 h-2.5 text-amber-700" />
                              <span>Khata Slip</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">
                          {item.consumerId && `ID: ${item.consumerId} • `}
                          {item.meterNo && `Meter: ${item.meterNo} • `}
                          {item.oldMeterNo && `Old Mtr: ${item.oldMeterNo} • `}
                          {item.arrearAmount && `Arrear: ₹ ${item.arrearAmount} • `}
                          {item.issueType || item.notes || item.address || ''}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.workerName || 'Worker'}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 text-xs">
                        <div>{item.feederName || 'Main Feeder'}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                          {item.address || item.locationGps || 'Site'}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          item.status === 'Approved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : item.status === 'Completed'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {item.status}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedEntry(item)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingEntry(item)}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors cursor-pointer"
                            title="Edit Data"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePrintCertificate(item)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 transition-colors cursor-pointer"
                            title="Print Receipt"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
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
      />
    </div>
  );
};
