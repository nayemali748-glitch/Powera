import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import { Download, Printer, X, Calendar, Filter } from 'lucide-react';
import { DisconnectionTask } from '../../types';
import {
  getTaskConnectionClass,
  ConnectionClassFilterType,
  cleanDisconnectionNotes,
  matchesDisconnectionStatusFilter
} from '../../utils/disconnectionClassifier';

interface DisconnectionDailyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: DisconnectionTask[];
  activeClassFilter?: ConnectionClassFilterType;
  onClassFilterChange?: (cls: ConnectionClassFilterType) => void;
  activeStatusFilter?: string;
}

export function parseTaskDateToYMD(rawDate: unknown): string {
  if (rawDate === null || rawDate === undefined) return '';
  const str = String(rawDate).trim();
  if (!str || str === 'undefined' || str === 'null' || str === 'NaN') return '';

  // Match DD.MM.YYYY, DD/MM/YYYY, or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, '0');
    const mm = dmyMatch[2].padStart(2, '0');
    const yyyy = dmyMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // Match YYYY-MM-DD or ISO
  const ymdMatch = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (ymdMatch) {
    const yyyy = ymdMatch[1];
    const mm = ymdMatch[2].padStart(2, '0');
    const dd = ymdMatch[3].padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return '';
}

export function formatYMDToDotDate(ymd: string): string {
  if (!ymd) return '-';
  const parts = ymd.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return ymd;
}

export function getTodayYMD(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function getTaskReportYMD(task: DisconnectionTask): string {
  const candidates = [
    (task as any)['Discon Date'],
    task.disconDate,
    (task as any)['Paid Date'],
    (task as any).paidDate,
    task.reportDate,
    Array.isArray(task.statusHistory) && task.statusHistory.length > 0 ? task.statusHistory[0]?.date : '',
    (task as any)['Last Updated'],
    task.updatedAt,
    (task as any)['Upload Date'],
    task.createdAt
  ];

  for (const c of candidates) {
    if (c !== null && c !== undefined && String(c).trim() !== '') {
      const ymd = parseTaskDateToYMD(c);
      if (ymd) return ymd;
    }
  }

  return '';
}

export function getTaskPrintedDateDot(task: DisconnectionTask): string {
  const ymd = getTaskReportYMD(task);
  if (!ymd) return '-';
  return formatYMDToDotDate(ymd);
}

export function getShortClassLetter(task: DisconnectionTask): string {
  const mapped = getTaskConnectionClass(task);
  if (mapped === 'DOMESTIC') return 'D';
  if (mapped === 'COMMERCIAL') return 'C';
  if (mapped === 'INDUSTRIAL') return 'I';
  if (mapped === 'STW') return 'S';

  const raw = String(
    (task as any)['Class'] ??
      task.classType ??
      (task as any)['Base Class'] ??
      task.baseClass ??
      ''
  ).trim();
  if (!raw || raw === 'undefined' || raw === 'null' || raw === 'NaN') return '-';

  const up = raw.toUpperCase();
  if (up === 'D' || up.startsWith('D ') || up.startsWith('D-')) return 'D';
  if (up === 'C' || up.startsWith('C ') || up.startsWith('C-')) return 'C';
  if (up === 'I' || up.startsWith('I ') || up.startsWith('I-')) return 'I';
  if (up === 'S' || up === 'A' || up.startsWith('A ') || up.startsWith('A-') || up.startsWith('S ') || up.startsWith('S-')) return 'S';
  return raw;
}

export function getDisplayStatusPair(task: DisconnectionTask): { tableLabel: string; summaryLabel: string } {
  const rawPaymentStatus = String((task as any)['Payment Status'] ?? task.paymentStatus ?? '').trim();
  const rawDisconStatus = String(
    (task as any)['Discon Status'] ?? task.disconStatus ?? task.taskStatus ?? ''
  ).trim();

  const combinedUpper = (rawDisconStatus || rawPaymentStatus).toUpperCase();

  if (
    matchesDisconnectionStatusFilter(task, 'PAID') ||
    combinedUpper === 'PAID' ||
    combinedUpper === 'AGENCY PAID' ||
    rawPaymentStatus.toUpperCase() === 'PAID' ||
    rawPaymentStatus.toUpperCase() === 'AGENCY PAID'
  ) {
    return { tableLabel: 'agency paid', summaryLabel: 'Agency Paid' };
  }

  if (
    matchesDisconnectionStatusFilter(task, 'DISCONNECT') ||
    combinedUpper === 'DISCONNECT' ||
    combinedUpper === 'DISCONNECTED' ||
    combinedUpper === 'COMPLETED' ||
    combinedUpper === 'ALREADY DISCONNECTED'
  ) {
    return { tableLabel: 'disconnected', summaryLabel: 'Disconnected' };
  }

  if (matchesDisconnectionStatusFilter(task, 'OFFICE TEAM') || combinedUpper === 'OFFICE TEAM') {
    return { tableLabel: 'office team', summaryLabel: 'Office Team' };
  }

  if (matchesDisconnectionStatusFilter(task, 'DISPUTE') || combinedUpper === 'DISPUTE') {
    return { tableLabel: 'dispute', summaryLabel: 'Dispute' };
  }

  if (matchesDisconnectionStatusFilter(task, 'NOT FOUND') || combinedUpper === 'NOT FOUND' || combinedUpper === 'UNABLE') {
    return { tableLabel: 'not found', summaryLabel: 'Not Found' };
  }

  if (matchesDisconnectionStatusFilter(task, 'REISSUE') || combinedUpper === 'REISSUE') {
    return { tableLabel: 'reissue', summaryLabel: 'Reissue' };
  }

  if (combinedUpper === 'PENDING' || combinedUpper === 'CONNECTED' || combinedUpper === 'IN PROGRESS') {
    return { tableLabel: 'connected', summaryLabel: 'Connected' };
  }

  if (rawDisconStatus && rawDisconStatus !== 'undefined' && rawDisconStatus !== 'null') {
    return {
      tableLabel: rawDisconStatus.toLowerCase(),
      summaryLabel: rawDisconStatus.replace(/\b\w/g, ch => ch.toUpperCase())
    };
  }

  return { tableLabel: '-', summaryLabel: 'Pending' };
}

export function getTaskOsdInfo(task: DisconnectionTask): { hasValue: boolean; numeric: number; formatted: string } {
  const raw = (task as any)['D2 Net O/S'] ?? task.outstandingDue ?? (task as any).arrearAmount;
  if (raw === null || raw === undefined) {
    return { hasValue: false, numeric: 0, formatted: '-' };
  }
  const str = String(raw).trim();
  if (!str || str === '-' || str === 'undefined' || str === 'null' || str === 'NaN') {
    return { hasValue: false, numeric: 0, formatted: '-' };
  }
  const cleaned = str.replace(/[^0-9.-]/g, '');
  if (!cleaned) {
    return { hasValue: false, numeric: 0, formatted: '-' };
  }
  const val = parseFloat(cleaned);
  if (isNaN(val)) {
    return { hasValue: false, numeric: 0, formatted: '-' };
  }
  return {
    hasValue: true,
    numeric: val,
    formatted: val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  };
}

export function getTaskSummaryAmount(task: DisconnectionTask): number {
  const paidRaw = (task as any)['Paid Amount'] ?? task.paidAmount;
  if (paidRaw !== null && paidRaw !== undefined && String(paidRaw).trim() !== '') {
    const pVal = parseFloat(String(paidRaw).replace(/[^0-9.-]/g, ''));
    if (!isNaN(pVal) && pVal > 0) {
      return pVal;
    }
  }
  return getTaskOsdInfo(task).numeric;
}

export function formatIndianCurrency(val: number): string {
  if (isNaN(val)) return '0.00';
  return val.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatSafeField(val: unknown): string {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'object') return '-';
  const str = String(val).trim();
  if (!str || str === 'undefined' || str === 'null' || str === 'NaN' || str === '[object Object]') {
    return '-';
  }
  return str;
}

export function formatGeneratedTimestamp(date = new Date()): string {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  return `${d}/${m}/${y}, ${timeStr}`;
}

export function downloadDailyDisconnectionReportPdf(
  reportTasks: DisconnectionTask[],
  fromDateDot: string,
  toDateDot: string
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm

  const colX = {
    sl: marginX + 1,           // #
    cid: marginX + 10,         // CONSUMER ID
    name: marginX + 33,        // NAME
    osdRight: marginX + 104,   // OSD (₹) right-aligned
    cls: marginX + 107,        // CLASS
    status: marginX + 119,     // STATUS
    date: marginX + 141,       // DATE
    reading: marginX + 160,    // READING
    remarks: marginX + 174     // REMARKS
  };

  const drawTableHeader = (startY: number): number => {
    let currY = startY;
    doc.setDrawColor(15, 15, 15);
    doc.setLineWidth(0.6);
    doc.line(marginX, currY, marginX + contentWidth, currY);

    currY += 5.2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 15, 15);
    doc.text('#', colX.sl, currY);
    doc.text('CONSUMER ID', colX.cid, currY);
    doc.text('NAME', colX.name, currY);
    doc.text('OSD (Rs.)', colX.osdRight, currY, { align: 'right' });
    doc.text('CLASS', colX.cls, currY);
    doc.text('STATUS', colX.status, currY);
    doc.text('DATE', colX.date, currY);
    doc.text('READING', colX.reading, currY);
    doc.text('REMARKS', colX.remarks - 4, currY);

    currY += 2.4;
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.25);
    doc.line(marginX, currY, marginX + contentWidth, currY);
    return currY;
  };

  let y = 20;

  // 1. HEADER
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(35, 35, 35);
  const title1 = 'DAILY DISCONNECTION REPORT';
  doc.text(title1, pageWidth / 2, y, { align: 'center' });
  const title1Width = doc.getTextWidth(title1);
  doc.setDrawColor(35, 35, 35);
  doc.setLineWidth(0.35);
  doc.line((pageWidth - title1Width) / 2, y + 1.2, (pageWidth + title1Width) / 2, y + 1.2);

  y += 8.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 15, 15);
  doc.text('BISHAL ENTERPRISE', pageWidth / 2, y, { align: 'center' });

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(95, 95, 95);
  doc.text('D I S C O N N E C T I O N   &   R E C O V E R Y   S E R V I C E S', pageWidth / 2, y, { align: 'center' });

  y += 4.8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(65, 65, 65);
  doc.text('UNDER SAMSI CCC', pageWidth / 2, y, { align: 'center' });

  // 2. DATE RANGE & TOTAL RECORDS
  y += 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text('Date Range: ', marginX, y);
  const drLabelW = doc.getTextWidth('Date Range: ');
  doc.setFont('helvetica', 'normal');
  doc.text(`${fromDateDot} to ${toDateDot}`, marginX + drLabelW, y);

  y += 6.5;
  doc.setFont('helvetica', 'bold');
  doc.text('Total Records: ', marginX, y);
  const trLabelW = doc.getTextWidth('Total Records: ');
  doc.setFont('helvetica', 'normal');
  doc.text(`${reportTasks.length}`, marginX + trLabelW, y);

  // 3. MAIN TABLE HEADER
  y = drawTableHeader(y + 6);

  // 4. TABLE ROWS
  const summaryMap = new Map<string, { count: number; amount: number }>();
  let grandTotalAmount = 0;

  reportTasks.forEach((task, idx) => {
    if (y > pageHeight - 28) {
      doc.addPage();
      y = drawTableHeader(18);
    }

    const cid = formatSafeField((task as any)['Consumer Id'] ?? task.consumerId);
    const name = formatSafeField((task as any)['Name'] ?? task.consumerName).slice(0, 34);
    const osdInfo = getTaskOsdInfo(task);
    const summaryAmt = getTaskSummaryAmount(task);
    const clsLetter = getShortClassLetter(task);
    const { tableLabel, summaryLabel } = getDisplayStatusPair(task);
    const dateStr = getTaskPrintedDateDot(task);
    const readingStr = formatSafeField((task as any)['Reading'] ?? task.reading ?? task.meterReading);
    const cleanedNotes = cleanDisconnectionNotes(
      (task as any)['Notes'] ?? task.notes ?? task.workerRemarks ?? task.workerReport ?? ''
    );
    const remarksStr = formatSafeField(cleanedNotes).slice(0, 16);

    grandTotalAmount += summaryAmt;
    const prevSum = summaryMap.get(summaryLabel) || { count: 0, amount: 0 };
    summaryMap.set(summaryLabel, {
      count: prevSum.count + 1,
      amount: prevSum.amount + summaryAmt
    });

    y += 5.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(40, 40, 40);
    doc.text(String(idx + 1), colX.sl, y);
    doc.text(cid, colX.cid, y);
    doc.text(name, colX.name, y);
    doc.text(osdInfo.formatted, colX.osdRight, y, { align: 'right' });
    doc.text(clsLetter, colX.cls, y);
    doc.text(tableLabel, colX.status, y);
    doc.text(dateStr, colX.date, y);
    doc.text(readingStr, colX.reading, y);
    doc.text(remarksStr, colX.remarks - 4, y);

    y += 2.2;
    doc.setDrawColor(235, 235, 235);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, marginX + contentWidth, y);
  });

  // 5. STATUS SUMMARY SECTION
  if (y > pageHeight - 75) {
    doc.addPage();
    y = 24;
  } else {
    y += 10;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(45, 45, 45);
  doc.text('STATUS SUMMARY', marginX, y);

  const summaryEntries = Array.from(summaryMap.entries());
  if (summaryEntries.length === 0) {
    summaryEntries.push(['Agency Paid', { count: 0, amount: 0 }]);
  }

  const summaryWidth = Math.min(contentWidth, Math.max(92, 42 + (summaryEntries.length + 1) * 26));
  y += 3.5;
  doc.setDrawColor(15, 15, 15);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, marginX + summaryWidth, y);

  y += 5.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 15, 15);
  doc.text('METRIC', marginX + 1, y);

  const colSpanWidth = (summaryWidth - 34) / (summaryEntries.length + 1);
  summaryEntries.forEach(([statusTitle], sIdx) => {
    const rightX = marginX + 34 + colSpanWidth * (sIdx + 1) - 1;
    doc.text(statusTitle, rightX, y, { align: 'right' });
  });
  doc.text('TOTAL', marginX + summaryWidth - 1, y, { align: 'right' });

  y += 2.4;
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.25);
  doc.line(marginX, y, marginX + summaryWidth, y);

  // Count row
  y += 5.2;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 55, 55);
  doc.text('Count', marginX + 1, y);
  doc.setFont('helvetica', 'normal');
  summaryEntries.forEach(([, data], sIdx) => {
    const rightX = marginX + 34 + colSpanWidth * (sIdx + 1) - 1;
    doc.text(String(data.count), rightX, y, { align: 'right' });
  });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 15, 15);
  doc.text(String(reportTasks.length), marginX + summaryWidth - 1, y, { align: 'right' });

  y += 2.4;
  doc.setDrawColor(235, 235, 235);
  doc.setLineWidth(0.2);
  doc.line(marginX, y, marginX + summaryWidth, y);

  // Amount row
  y += 5.2;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 55, 55);
  doc.text('Amount', marginX + 1, y);
  doc.setFont('helvetica', 'normal');
  summaryEntries.forEach(([, data], sIdx) => {
    const rightX = marginX + 34 + colSpanWidth * (sIdx + 1) - 1;
    doc.text(formatIndianCurrency(data.amount), rightX, y, { align: 'right' });
  });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 15, 15);
  doc.text(formatIndianCurrency(grandTotalAmount), marginX + summaryWidth - 1, y, { align: 'right' });

  y += 2.4;
  doc.setDrawColor(235, 235, 235);
  doc.setLineWidth(0.2);
  doc.line(marginX, y, marginX + summaryWidth, y);

  // 6. FOOTER (Generated on + Stamp Box + Authorised Signatory)
  const footerY = Math.max(y + 28, Math.min(pageHeight - 25, y + 42));
  const stampW = 32;
  const stampH = 14;
  const stampX = marginX + contentWidth - stampW;
  const stampY = footerY - stampH - 4.5;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  (doc as any).setLineDashPattern?.([1.2, 1.2], 0);
  doc.rect(stampX, stampY, stampW, stampH);
  (doc as any).setLineDashPattern?.([], 0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(190, 190, 190);
  doc.text('Stamp', stampX + stampW / 2, stampY + stampH / 2 + 1, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  doc.text(`Generated on: ${formatGeneratedTimestamp()}`, marginX, footerY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(75, 75, 75);
  doc.text('Authorised Signatory', stampX + stampW / 2, footerY, { align: 'center' });

  doc.save(`Daily_Disconnection_Report_${fromDateDot.replace(/\./g, '-')}.pdf`);
}

interface ReportDocumentViewProps {
  tasks: DisconnectionTask[];
  fromDot: string;
  toDot: string;
  summaryEntries: Array<[string, { count: number; amount: number }]>;
  totalCount: number;
  totalAmount: number;
  generatedTimestamp: string;
}

const ReportDocumentView: React.FC<ReportDocumentViewProps> = ({
  tasks,
  fromDot,
  toDot,
  summaryEntries,
  totalCount,
  totalAmount,
  generatedTimestamp
}) => {
  return (
    <div className="bg-white text-slate-900 w-full flex flex-col justify-between">
      <div>
        {/* 1-4. EXACT REPORT HEADER */}
        <div className="text-center space-y-1.5 mb-8">
          <div className="inline-block border-b-2 border-slate-900 pb-0.5">
            <h2 className="text-xs sm:text-sm font-extrabold tracking-[0.08em] text-slate-900 uppercase">
              DAILY DISCONNECTION REPORT
            </h2>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-wider text-slate-950 uppercase pt-1">
            BISHAL ENTERPRISE
          </h1>
          <p className="text-[10px] sm:text-xs font-medium tracking-[0.22em] text-slate-600 uppercase">
            DISCONNECTION &amp; RECOVERY SERVICES
          </p>
          <p className="text-[10px] sm:text-[11px] font-extrabold tracking-[0.12em] text-slate-800 uppercase">
            UNDER SAMSI CCC
          </p>
        </div>

        {/* 5-6. DATE RANGE & TOTAL RECORDS */}
        <div className="mb-5 space-y-1 text-slate-800">
          <div className="text-sm sm:text-base">
            <span className="font-bold text-slate-800">Date Range: </span>
            <span className="font-normal text-slate-700">
              {fromDot} to {toDot}
            </span>
          </div>
          <div className="text-sm sm:text-base">
            <span className="font-bold text-slate-800">Total Records: </span>
            <span className="font-normal text-slate-700">{totalCount}</span>
          </div>
        </div>

        {/* 7. MAIN REPORT TABLE */}
        <div className="w-full overflow-x-auto print:overflow-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-t-2 border-slate-950 border-b border-slate-400 text-[10px] sm:text-[11px] font-extrabold text-slate-950 uppercase">
                <th className="py-2.5 pr-2 w-8">#</th>
                <th className="py-2.5 px-2">CONSUMER ID</th>
                <th className="py-2.5 px-2">NAME</th>
                <th className="py-2.5 px-2 text-right">OSD (₹)</th>
                <th className="py-2.5 px-2 text-center">CLASS</th>
                <th className="py-2.5 px-2">STATUS</th>
                <th className="py-2.5 px-2">DATE</th>
                <th className="py-2.5 px-2">READING</th>
                <th className="py-2.5 pl-2">REMARKS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px] sm:text-xs text-slate-800">
              {tasks.map((task, idx) => {
                const cid = formatSafeField((task as any)['Consumer Id'] ?? task.consumerId);
                const name = formatSafeField((task as any)['Name'] ?? task.consumerName);
                const osdInfo = getTaskOsdInfo(task);
                const clsLetter = getShortClassLetter(task);
                const { tableLabel } = getDisplayStatusPair(task);
                const dateDot = getTaskPrintedDateDot(task);
                const reading = formatSafeField(
                  (task as any)['Reading'] ?? task.reading ?? task.meterReading
                );
                const cleanedNotes = cleanDisconnectionNotes(
                  (task as any)['Notes'] ?? task.notes ?? task.workerRemarks ?? task.workerReport ?? ''
                );
                const remarks = formatSafeField(cleanedNotes);

                return (
                  <tr key={`${cid || idx}-${idx}`}>
                    <td className="py-2.5 pr-2 text-slate-700">{idx + 1}</td>
                    <td className="py-2.5 px-2 font-medium text-slate-900">{cid}</td>
                    <td className="py-2.5 px-2 font-medium text-slate-900">{name}</td>
                    <td className="py-2.5 px-2 text-right font-medium text-slate-900">
                      {osdInfo.formatted}
                    </td>
                    <td className="py-2.5 px-2 text-center font-medium text-slate-800">{clsLetter}</td>
                    <td className="py-2.5 px-2 text-slate-800">{tableLabel}</td>
                    <td className="py-2.5 px-2 text-slate-800">{dateDot}</td>
                    <td className="py-2.5 px-2 text-slate-700">{reading}</td>
                    <td className="py-2.5 pl-2 text-slate-800">{remarks}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 8-9. STATUS SUMMARY */}
        <div className="mt-8 max-w-md report-summary-block">
          <h3 className="text-xs font-extrabold tracking-wider text-slate-900 uppercase mb-2">
            STATUS SUMMARY
          </h3>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-t-2 border-slate-950 border-b border-slate-300 text-[11px] font-extrabold text-slate-950">
                <th className="py-2 pr-3 uppercase">METRIC</th>
                {summaryEntries.map(([statusTitle]) => (
                  <th key={statusTitle} className="py-2 px-3 text-right">
                    {statusTitle}
                  </th>
                ))}
                <th className="py-2 pl-3 text-right uppercase">TOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px] sm:text-xs">
              <tr>
                <td className="py-2 pr-3 font-bold text-slate-800">Count</td>
                {summaryEntries.map(([statusTitle, data]) => (
                  <td key={statusTitle} className="py-2 px-3 text-right text-slate-700">
                    {data.count}
                  </td>
                ))}
                <td className="py-2 pl-3 text-right font-bold text-slate-950">
                  {totalCount}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 pr-3 font-bold text-slate-800">Amount</td>
                {summaryEntries.map(([statusTitle, data]) => (
                  <td key={statusTitle} className="py-2 px-3 text-right text-slate-700">
                    {formatIndianCurrency(data.amount)}
                  </td>
                ))}
                <td className="py-2 pl-3 text-right font-bold text-slate-950">
                  {formatIndianCurrency(totalAmount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 10-12. GENERATED ON + STAMP BOX + AUTHORISED SIGNATORY */}
      <div className="mt-16 pt-6 flex items-end justify-between gap-4 report-footer-block">
        <div className="text-[11px] text-slate-600">
          Generated on: {generatedTimestamp}
        </div>

        <div className="flex flex-col items-center">
          <div className="w-36 h-16 border border-dashed border-slate-300 flex items-center justify-center text-[11px] text-slate-300 mb-2">
            Stamp
          </div>
          <div className="text-[11px] font-bold text-slate-800">
            Authorised Signatory
          </div>
        </div>
      </div>
    </div>
  );
};

export const DisconnectionDailyReportModal: React.FC<DisconnectionDailyReportModalProps> = ({
  isOpen,
  onClose,
  tasks,
  activeClassFilter = 'ALL',
  onClassFilterChange,
  activeStatusFilter = 'ALL'
}) => {
  const todayYMD = useMemo(() => getTodayYMD(), []);

  const latestTaskYMD = useMemo(() => {
    const ymds = tasks.map(getTaskReportYMD).filter(Boolean).sort();
    return ymds.length > 0 ? ymds[ymds.length - 1] : todayYMD;
  }, [tasks, todayYMD]);

  const [filterByDate, setFilterByDate] = useState<boolean>(false);
  const [fromDate, setFromDate] = useState<string>(latestTaskYMD);
  const [toDate, setToDate] = useState<string>(latestTaskYMD);
  const [reportClassFilter, setReportClassFilter] = useState<ConnectionClassFilterType>(activeClassFilter);
  const [reportStatusFilter, setReportStatusFilter] = useState<string>(activeStatusFilter);

  // Sync with parent Disconnection filters whenever opened or changed
  useEffect(() => {
    setReportClassFilter(activeClassFilter);
  }, [activeClassFilter, isOpen]);

  useEffect(() => {
    setReportStatusFilter(activeStatusFilter);
  }, [activeStatusFilter, isOpen]);

  useEffect(() => {
    if (latestTaskYMD) {
      setFromDate(latestTaskYMD);
      setToDate(latestTaskYMD);
    }
  }, [latestTaskYMD]);

  const filteredReportTasks = useMemo(() => {
    return tasks.filter(t => {
      if (reportClassFilter !== 'ALL' && getTaskConnectionClass(t) !== reportClassFilter) {
        return false;
      }
      if (reportStatusFilter !== 'ALL' && !matchesDisconnectionStatusFilter(t, reportStatusFilter)) {
        return false;
      }
      if (filterByDate && fromDate && toDate) {
        const ymd = getTaskReportYMD(t);
        if (!ymd || ymd < fromDate || ymd > toDate) return false;
      }
      return true;
    });
  }, [tasks, reportClassFilter, reportStatusFilter, filterByDate, fromDate, toDate]);

  const effectiveDateRange = useMemo(() => {
    if (filterByDate && fromDate && toDate) {
      return {
        fromDot: formatYMDToDotDate(fromDate),
        toDot: formatYMDToDotDate(toDate)
      };
    }
    if (filteredReportTasks.length > 0) {
      const ymds = filteredReportTasks.map(getTaskReportYMD).filter(Boolean).sort();
      if (ymds.length > 0) {
        return {
          fromDot: formatYMDToDotDate(ymds[0]),
          toDot: formatYMDToDotDate(ymds[ymds.length - 1])
        };
      }
    }
    return {
      fromDot: formatYMDToDotDate(todayYMD),
      toDot: formatYMDToDotDate(todayYMD)
    };
  }, [filterByDate, fromDate, toDate, filteredReportTasks, todayYMD]);

  const summaryData = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    let totalAmount = 0;

    filteredReportTasks.forEach(t => {
      const amt = getTaskSummaryAmount(t);
      const { summaryLabel } = getDisplayStatusPair(t);
      totalAmount += amt;
      const prev = map.get(summaryLabel) || { count: 0, amount: 0 };
      map.set(summaryLabel, {
        count: prev.count + 1,
        amount: prev.amount + amt
      });
    });

    const entries = Array.from(map.entries());
    if (entries.length === 0) {
      entries.push(['Agency Paid', { count: 0, amount: 0 }]);
    }

    return {
      entries,
      totalCount: filteredReportTasks.length,
      totalAmount
    };
  }, [filteredReportTasks]);

  const generatedTimestamp = useMemo(() => formatGeneratedTimestamp(), [isOpen, filteredReportTasks.length]);

  // Dedicated top-level portal for @media print (.print-only-report) so printing ONLY prints the A4 report
  const printPortal =
    typeof document !== 'undefined'
      ? createPortal(
          <div className="print-only-report">
            <ReportDocumentView
              tasks={filteredReportTasks}
              fromDot={effectiveDateRange.fromDot}
              toDot={effectiveDateRange.toDot}
              summaryEntries={summaryData.entries}
              totalCount={summaryData.totalCount}
              totalAmount={summaryData.totalAmount}
              generatedTimestamp={generatedTimestamp}
            />
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {printPortal}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs overflow-y-auto flex flex-col items-center p-2 sm:p-6 animate-in fade-in duration-150 print:hidden">
          {/* Top Control Bar (Date Range + Class Filter + Status Filter + Print / Save as PDF) */}
          <div className="w-full max-w-4xl bg-slate-900 text-white border border-slate-700 rounded-2xl p-3 sm:p-4 mb-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {/* Date Mode Toggle */}
              <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl px-2 py-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <button
                  type="button"
                  onClick={() => setFilterByDate(false)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                    !filterByDate ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  All Dates
                </button>
                <button
                  type="button"
                  onClick={() => setFilterByDate(true)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                    filterByDate ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Date Filter
                </button>
              </div>

              {/* Date Range Pickers */}
              <div className="flex items-center gap-1.5 text-xs">
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => {
                    setFromDate(e.target.value);
                    if (e.target.value > toDate) setToDate(e.target.value);
                    setFilterByDate(true);
                  }}
                  className="bg-slate-800 border border-slate-700 text-white rounded-xl px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <span className="text-slate-400 font-bold">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={e => {
                    setToDate(e.target.value);
                    if (e.target.value < fromDate) setFromDate(e.target.value);
                    setFilterByDate(true);
                  }}
                  className="bg-slate-800 border border-slate-700 text-white rounded-xl px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {/* Class Filter (All Class | D | C | I | S) */}
              <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
                {(['ALL', 'DOMESTIC', 'COMMERCIAL', 'INDUSTRIAL', 'STW'] as ConnectionClassFilterType[]).map(cls => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => {
                      setReportClassFilter(cls);
                      if (onClassFilterChange) onClassFilterChange(cls);
                    }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-black cursor-pointer transition-all ${
                      reportClassFilter === cls
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {cls === 'ALL'
                      ? 'All'
                      : cls === 'DOMESTIC'
                      ? 'D'
                      : cls === 'COMMERCIAL'
                      ? 'C'
                      : cls === 'INDUSTRIAL'
                      ? 'I'
                      : 'S'}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5">
                <Filter className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <select
                  value={reportStatusFilter}
                  onChange={e => setReportStatusFilter(e.target.value)}
                  className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="text-slate-900">All Status</option>
                  <option value="PAID" className="text-slate-900">Agency Paid</option>
                  <option value="DISCONNECT" className="text-slate-900">Disconnected</option>
                  <option value="OFFICE TEAM" className="text-slate-900">Office Team</option>
                  <option value="DISPUTE" className="text-slate-900">Dispute</option>
                  <option value="NOT FOUND" className="text-slate-900">Not Found</option>
                  <option value="PENDING" className="text-slate-900">Connected</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Save as PDF</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  downloadDailyDisconnectionReportPdf(
                    filteredReportTasks,
                    effectiveDateRange.fromDot,
                    effectiveDateRange.toDot
                  )
                }
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer border border-slate-700"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl cursor-pointer transition-colors"
                title="Close Report"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* On-Screen A4 Sheet Preview */}
          <div className="w-full max-w-4xl bg-white text-slate-900 shadow-2xl px-6 sm:px-12 py-8 sm:py-12 min-h-[840px]">
            <ReportDocumentView
              tasks={filteredReportTasks}
              fromDot={effectiveDateRange.fromDot}
              toDot={effectiveDateRange.toDot}
              summaryEntries={summaryData.entries}
              totalCount={summaryData.totalCount}
              totalAmount={summaryData.totalAmount}
              generatedTimestamp={generatedTimestamp}
            />
          </div>
        </div>
      )}
    </>
  );
};
