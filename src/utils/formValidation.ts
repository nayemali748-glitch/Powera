import { CategoryType } from '../types';
import { Language } from './translations';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// Regex format patterns for WBSEDCL parameters
export const FORMAT_PATTERNS = {
  // Consumer ID: 9 numeric digits or CON- followed by 9 digits
  consumerId: /^(CON-)?\d{9}$/i,
  // Meter Number: 4 to 20 alphanumeric characters (allowing hyphens and slashes)
  meterNo: /^[A-Za-z0-9\-\/]{4,20}$/,
  // Application / CA / Quotation No: 5 to 25 alphanumeric chars
  applicationNo: /^[A-Za-z0-9\-\/]{5,25}$/,
  // Work Order No: 3 to 25 chars
  workOrderNo: /^[A-Za-z0-9\-\/_]{3,25}$/,
  // Meter Seal No: 4 to 20 alphanumeric chars
  sealNo: /^[A-Za-z0-9\-\/]{4,20}$/,
  // Indian 10-digit mobile number
  mobile: /^[6-9]\d{9}$/,
  // Meter reading (kWh): numeric with optional decimal
  reading: /^\d+(\.\d{1,2})?$/,
  // Arrear amount: digits with optional currency symbol and commas
  arrearAmount: /^[₹]?\s*[\d,]+(\.\d{1,2})?$/,
  // DTR Serial Number
  dtrSerial: /^[A-Za-z0-9\-\/]{4,25}$/,
};

// Clean helper
export const cleanDigits = (str: string) => str.replace(/[^0-9]/g, '');

export function validateSingleField(
  field: string,
  value: any,
  category: CategoryType,
  lang: Language | string = 'bn'
): string | null {
  const isBn = lang === 'bn';
  const strVal = typeof value === 'string' ? value.trim() : String(value || '').trim();

  switch (field) {
    // 1. Consumer ID (NSC, DISCONNECTION, METER REPLESMENT)
    case 'consumerId': {
      if (!strVal) {
        return isBn
          ? 'কনজিউমার আইডি প্রদান করা আবশ্যক।'
          : 'Consumer ID is required.';
      }
      const digitsOnly = strVal.replace(/[^0-9]/g, '');
      if (digitsOnly.length !== 9 && !FORMAT_PATTERNS.consumerId.test(strVal)) {
        return isBn
          ? 'কনজিউমার আইডি অবশ্যই ৯ ডিজিটের সংখ্যা হতে হবে (যেমন: 100293847)।'
          : 'Consumer ID must be a 9-digit number (e.g., 100293847).';
      }
      return null;
    }

    // 2. Meter No (NSC)
    case 'meterNo': {
      if (!strVal) {
        return isBn
          ? 'মিটার নম্বর প্রদান করা আবশ্যক।'
          : 'Meter No is required.';
      }
      if (!FORMAT_PATTERNS.meterNo.test(strVal) || strVal.length < 4) {
        return isBn
          ? 'মিটার নম্বর ৪-২০ অক্ষরের আলফানিউমেরিক হতে হবে (যেমন: WB26-987654 বা GEN-123456)।'
          : 'Meter No must be 4 to 20 alphanumeric characters (e.g., WB26-987654 or GEN-123456).';
      }
      return null;
    }

    // 3. Old Meter No (METER REPLESMENT)
    case 'oldMeterNo': {
      if (category === 'METER REPLESMENT') {
        if (!strVal) {
          return isBn
            ? 'পুরাতন মিটার নম্বর প্রদান করা আবশ্যক।'
            : 'Old Meter No is required.';
        }
        if (!FORMAT_PATTERNS.meterNo.test(strVal) || strVal.length < 4) {
          return isBn
            ? 'পুরাতন মিটার নম্বর সঠিক ফরম্যাটে লিখুন (যেমন: OLD-WB-9821 বা 984512)।'
            : 'Enter valid Old Meter No (e.g., OLD-WB-9821 or 984512).';
        }
      }
      return null;
    }

    // 4. New Meter No (METER REPLESMENT)
    case 'newMeterNo': {
      if (category === 'METER REPLESMENT') {
        if (!strVal) {
          return isBn
            ? 'নতুন মিটার নম্বর প্রদান করা আবশ্যক।'
            : 'New Meter No is required.';
        }
        if (!FORMAT_PATTERNS.meterNo.test(strVal) || strVal.length < 4) {
          return isBn
            ? 'নতুন মিটার নম্বর সঠিক ফরম্যাটে লিখুন (যেমন: WB26-GEN-88319)।'
            : 'Enter valid New Meter No (e.g., WB26-GEN-88319).';
        }
      }
      return null;
    }

    // 5. Meter Seal No (NSC & METER REPLESMENT)
    case 'sealNo':
    case 'newMeterSealNo': {
      if (!strVal) {
        return isBn
          ? 'মিটার সিল নম্বর প্রদান করা আবশ্যক।'
          : 'Meter Seal No is required.';
      }
      if (!FORMAT_PATTERNS.sealNo.test(strVal) || strVal.length < 4) {
        return isBn
          ? 'মিটার সিল নম্বর ৪-২০ অক্ষরের হতে হবে (যেমন: WB-SL-98214)।'
          : 'Meter Seal No must be 4 to 20 characters (e.g., WB-SL-98214).';
      }
      return null;
    }

    // 6. Application No (NSC)
    case 'applicationNo': {
      if (category === 'NSC') {
        if (!strVal) {
          return isBn
            ? 'অ্যাপ্লিকেশন নম্বর প্রদান করা আবশ্যক।'
            : 'Application No is required.';
        }
        if (strVal.length < 4) {
          return isBn
            ? 'অ্যাপ্লিকেশন নম্বর কমপক্ষে ৪ অক্ষরের হতে হবে (যেমন: CA-2026-9812 বা APP-102938)।'
            : 'Application No must be at least 4 characters (e.g., CA-2026-9812).';
        }
      }
      return null;
    }

    // 7. Work Order No (NSC)
    case 'workOrderNo': {
      if (category === 'NSC') {
        if (!strVal) {
          return isBn
            ? 'ওয়ার্ক অর্ডার নম্বর প্রদান করা আবশ্যক।'
            : 'Work Order No is required.';
        }
        if (strVal.length < 3) {
          return isBn
            ? 'ওয়ার্ক অর্ডার নম্বর কমপক্ষে ৩ অক্ষরের হতে হবে (যেমন: WO-2026-98102)।'
            : 'Work Order No must be at least 3 characters (e.g., WO-2026-98102).';
        }
      }
      return null;
    }

    // 8. Work Order Date & Meter Install Date (NSC)
    case 'workOrderDate':
    case 'meterInstallDate': {
      if (category === 'NSC' && !strVal) {
        return isBn
          ? 'তারিখ নির্বাচন করা আবশ্যক।'
          : 'Date selection is required.';
      }
      return null;
    }

    // 9. Consumer Name
    case 'consumerName': {
      if (['NSC', 'DISCONNECTION', 'METER REPLESMENT'].includes(category)) {
        if (!strVal || strVal.length < 2) {
          return isBn
            ? 'গ্রাহকের পুরো নাম লিখুন (কমপক্ষে ২ অক্ষর)।'
            : 'Enter full Consumer Name (at least 2 characters).';
        }
      }
      return null;
    }

    // 10. Worker / Lineman Name
    case 'workerName':
    case 'nscWorkerName':
    case 'worker': {
      if (!strVal || strVal.length < 2) {
        return isBn
          ? 'কর্মীর নাম প্রদান করা আবশ্যক।'
          : 'Worker / Lineman name is required.';
      }
      return null;
    }

    // 11. Mobile Number (Optional, but strict format if provided)
    case 'mobile': {
      if (strVal) {
        const cleanMob = strVal.replace(/[^0-9]/g, '');
        if (cleanMob.length !== 10 || !/^[6-9]\d{9}$/.test(cleanMob)) {
          return isBn
            ? 'মোবাইল নম্বর সঠিক ১০ ডিজিটের ভারতীয় নম্বর হতে হবে (যেমন: 9830012345)।'
            : 'Mobile No must be a valid 10-digit Indian phone number (e.g., 9830012345).';
        }
      }
      return null;
    }

    // 12. Address / Location (Mandatory for all categories)
    case 'address': {
      if (!strVal || strVal.length < 3) {
        return isBn
          ? 'ঠিকানা বা লোকেশন প্রদান করা আবশ্যক (কমপক্ষে ৩ অক্ষর)।'
          : 'Address/Location landmark is required (at least 3 characters).';
      }
      return null;
    }

    // 13. Arrear Amount (DISCONNECTION)
    case 'arrearAmount': {
      if (category === 'DISCONNECTION') {
        if (!strVal) {
          return isBn
            ? 'বকেয়া বিলের পরিমাণ প্রদান করা আবশ্যক।'
            : 'Arrear Amount is required.';
        }
        const numeric = strVal.replace(/[^0-9.]/g, '');
        if (!numeric || isNaN(Number(numeric)) || Number(numeric) < 0) {
          return isBn
            ? 'সঠিক বকেয়া টাকা লিখুন (যেমন: 4500 বা 7850.50)।'
            : 'Enter valid arrear amount in digits (e.g., 4500 or 7850.50).';
        }
      }
      return null;
    }

    // 14. Readings (Final reading, Old meter reading, Initial reading)
    case 'finalReading':
    case 'oldMeterReading': {
      if (['DISCONNECTION', 'METER REPLESMENT'].includes(category)) {
        if (!strVal) {
          return isBn
            ? 'মিটার রিডিং (kWh) প্রদান করা আবশ্যক।'
            : 'Meter Reading (kWh) is required.';
        }
        const numeric = strVal.replace(/[^0-9.]/g, '');
        if (!numeric || isNaN(Number(numeric))) {
          return isBn
            ? 'মিটার রিডিং অবশ্যই সংখ্যায় হতে হবে (যেমন: 14230 বা 08945)।'
            : 'Meter reading must be numeric (e.g., 14230 or 08945).';
        }
      }
      return null;
    }

    // 15. Pole No (POLE CASE)
    case 'poleNo': {
      if (category === 'POLE CASE') {
        if (!strVal || strVal.length < 2) {
          return isBn
            ? 'পোল নম্বর প্রদান করা আবশ্যক (যেমন: P-84 বা Pole-12)।'
            : 'Pole No is required (e.g., P-84 or Pole-12).';
        }
      }
      return null;
    }

    // 16. Action Taken (POLE CASE)
    case 'actionTaken': {
      if (category === 'POLE CASE') {
        if (!strVal || strVal.length < 3) {
          return isBn
            ? 'গৃহীত পদক্ষেপের বিবরণ আবশ্যক (কমপক্ষে ৩ অক্ষর)।'
            : 'Action taken description is required (at least 3 characters).';
        }
      }
      return null;
    }

    // 17. DTR Name (DTR REPLESMENT)
    case 'dtrName': {
      if (category === 'DTR REPLESMENT') {
        if (!strVal || strVal.length < 2) {
          return isBn
            ? 'DTR নাম বা স্ট্রাকচার নম্বর আবশ্যক (যেমন: DTR-VILLAGE-04)।'
            : 'DTR Name/Structure ID is required (e.g., DTR-VILLAGE-04).';
        }
      }
      return null;
    }

    // 18. New DTR Serial (DTR REPLESMENT)
    case 'newDtrSerial': {
      if (category === 'DTR REPLESMENT') {
        if (!strVal) {
          return isBn
            ? 'নতুন DTR সিরিয়াল নম্বর প্রদান করা আবশ্যক।'
            : 'New DTR Serial No is required.';
        }
        if (!FORMAT_PATTERNS.dtrSerial.test(strVal) || strVal.length < 4) {
          return isBn
            ? 'নতুন DTR সিরিয়াল সঠিক ফরম্যাটে লিখুন (যেমন: WB-DTR-2026-081)।'
            : 'Enter valid New DTR Serial No (e.g., WB-DTR-2026-081).';
        }
      }
      return null;
    }

    // 19. Substation & Feeder (for Non-NSC categories)
    case 'substation': {
      if (category !== 'NSC') {
        if (!strVal || strVal.length < 2) {
          return isBn
            ? 'সাবস্টেশন নাম প্রদান করা আবশ্যক।'
            : 'Substation name is required.';
        }
      }
      return null;
    }

    case 'feederName': {
      if (category !== 'NSC') {
        if (!strVal || strVal.length < 2) {
          return isBn
            ? 'ফিডার নাম প্রদান করা আবশ্যক।'
            : 'Feeder name is required.';
        }
      }
      return null;
    }

    default:
      return null;
  }
}

export function validateAllFields(
  formData: Record<string, any>,
  category: CategoryType,
  lang: Language | string = 'bn'
): ValidationResult {
  const errors: Record<string, string> = {};

  // Fields to validate based on category
  const fieldsToValidate: string[] = [];

  // Common infrastructure for non-NSC
  if (category !== 'NSC') {
    fieldsToValidate.push('substation', 'feederName', 'address');
  }

  if (category === 'NSC') {
    fieldsToValidate.push(
      'nscWorkerName',
      'workOrderNo',
      'workOrderDate',
      'applicationNo',
      'consumerId',
      'meterNo',
      'sealNo',
      'consumerName',
      'address',
      'meterInstallDate'
    );
    if (formData.mobile) {
      fieldsToValidate.push('mobile');
    }
  } else if (category === 'DISCONNECTION') {
    fieldsToValidate.push(
      'consumerId',
      'consumerName',
      'arrearAmount',
      'finalReading',
      'address'
    );
    if (formData.mobile) {
      fieldsToValidate.push('mobile');
    }
  } else if (category === 'POLE CASE') {
    fieldsToValidate.push(
      'poleNo',
      'actionTaken',
      'address'
    );
  } else if (category === 'METER REPLESMENT') {
    fieldsToValidate.push(
      'consumerId',
      'consumerName',
      'oldMeterNo',
      'oldMeterReading',
      'newMeterNo',
      'newMeterSealNo',
      'address'
    );
  } else if (category === 'DTR REPLESMENT') {
    fieldsToValidate.push(
      'dtrName',
      'newDtrSerial',
      'address'
    );
  }

  for (const field of fieldsToValidate) {
    const error = validateSingleField(field, formData[field], category, lang);
    if (error) {
      errors[field] = error;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
