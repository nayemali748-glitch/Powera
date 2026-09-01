export type Language = 'bn' | 'en' | 'hi' | 'ur';

export interface Translations {
  appName: string;
  appSubtitle: string;
  wbsedclTagline: string;
  mainModules: string;
  fiveCategories: string;
  dataEntry: string;
  mySubmissions: string;
  workOrders: string;
  workOrderKhataBoard: string;
  workOrderNoticeDesc: string;
  uploadKhataPhoto: string;
  noWorkOrdersFound: string;
  adminCenter: string;
  installApp: string;
  language: string;
  logout: string;
  login: string;
  signIn: string;
  register: string;
  createAccount: string;
  loginIdNo: string;
  password: string;
  forgotPassword: string;
  changePassword: string;
  selectCategory: string;
  workCategorySelection: string;
  clickToOpenForm: string;
  
  // Statuses
  pending: string;
  completed: string;
  approved: string;
  rejected: string;
  inProgress: string;
  
  // Common Actions
  submit: string;
  submitting: string;
  saveChanges: string;
  cancel: string;
  edit: string;
  delete: string;
  printReceipt: string;
  downloadCsv: string;
  actions: string;
  status: string;
  date: string;
  workerName: string;
  workerPhone: string;
  workerId: string;
  category: string;
  searchPlaceholder: string;
  filterAll: string;
  recordsCount: string;
  noDataFound: string;
  editEntryTitle: string;
  deleteConfirm: string;
  deleteWarning: string;
  entryUpdatedSuccess: string;
  entryDeletedSuccess: string;
  entryCreatedSuccess: string;
  userManagement: string;
  wbsedclStandard: string;
  allRightsReserved: string;
  done: string;
  close: string;
  backToCategories: string;
  liveStatus: string;
  adminAuthRequired: string;
  adminAuthDesc: string;
  openAdminPanel: string;

  // WBSEDCL Common Parameters
  feeder: string;
  substation: string;
  cccOffice: string;
  dtrName: string;
  poleNo: string;
  addressLocation: string;
  notes: string;
  gpsLocation: string;
  getGps: string;
  photoEvidence: string;
  uploadPhoto: string;
  takeSamplePhoto: string;

  // 1. NSC Fields
  nscTitle: string;
  nscSubtitle: string;
  nscShortDesc: string;
  workOrderNo: string;
  workOrderDate: string;
  consumerName: string;
  fatherHusbandName: string;
  consumerId: string;
  applicationNo: string;
  agencyName: string;
  cccName: string;
  mobileNo: string;
  appliedLoad: string;
  phaseSupply: string;
  singlePhase: string;
  threePhase: string;
  tariffCategory: string;
  domestic: string;
  commercial: string;
  agriculture: string;
  industrial: string;
  meterNo: string;
  meterMake: string;
  initialReading: string;
  sealNo: string;
  meterSealNo: string;
  serviceCableLength: string;
  earthResistance: string;
  meterInstallDate: string;
  inspectionAgencyName: string;
  performanceDashboard: string;

  // 2. DISCONNECTION Fields
  disconnectionTitle: string;
  disconnectionSubtitle: string;
  disconnectionShortDesc: string;
  arrearAmount: string;
  disconnectionReason: string;
  disconnectionType: string;
  finalReading: string;
  noticeNo: string;
  cutoutSealed: string;
  cutoutSealNo: string;
  disconnectionActionTaken: string;

  // 3. POLE CASE Fields
  poleCaseTitle: string;
  poleCaseSubtitle: string;
  poleCaseShortDesc: string;
  issueType: string;
  priority: string;
  poleType: string;
  lineVoltage: string;
  conductorType: string;
  actionTaken: string;
  materialUsed: string;
  ptwShutdownRef: string;

  // 4. METER REPLACEMENT Fields
  meterReplacementTitle: string;
  meterReplacementSubtitle: string;
  meterReplacementShortDesc: string;
  oldMeterNo: string;
  oldMeterReading: string;
  replacementReason: string;
  newMeterNo: string;
  newMeterInitialReading: string;
  newMeterSealNo: string;
  meterType: string;

  // 5. DTR REPLACEMENT Fields
  dtrReplacementTitle: string;
  dtrReplacementSubtitle: string;
  dtrReplacementShortDesc: string;
  existingCapacity: string;
  newCapacity: string;
  oldDtrSerial: string;
  newDtrSerial: string;
  dtrFailureReason: string;
  oilLevelChecked: string;
  earthPitResistance: string;
  hgFuseRating: string;
  ltMccbAmpere: string;
  lightningArrester: string;

  // Modals & Tools
  emergencyHelpline: string;
  emergencyDesc: string;
  call19123: string;
  exportReports: string;
  exportDesc: string;
  adminPortal: string;
  adminPortalDesc: string;
  languageSelectTitle: string;
  languageSelectSubtitle: string;
  installAppTitle: string;
  installAppSubtitle: string;
  helpSupport: string;
  helpSupportDesc: string;
}

export const translations: Record<Language, Translations> = {
  bn: {
    appName: 'POWER',
    appSubtitle: 'WBSEDCL ফিল্ড সার্ভিস ম্যানেজমেন্ট ও ডাটা এন্ট্রি',
    wbsedclTagline: 'পশ্চিমবঙ্গ রাজ্য বিদ্যুৎ বণ্টন সংস্থা লিমিটেড (WBSEDCL)',
    mainModules: 'MAIN MODULES (প্রধান মেনু)',
    fiveCategories: '৫টি প্রধান ক্যাটাগরি',
    dataEntry: 'নতুন ডাটা এন্ট্রি',
    mySubmissions: 'আমার এন্ট্রি তালিকা',
    workOrders: 'ওয়ার্ক অর্ডার ও খাতা',
    workOrderKhataBoard: 'ওয়ার্ক অর্ডার ও খাতার নোটিশ বোর্ড',
    workOrderNoticeDesc: 'এডমিন কর্তৃক আপলোড করা ওয়ার্ক অর্ডার, কনজিউমার লিস্ট ও খাতার ছবি দেখুন',
    uploadKhataPhoto: 'ওয়ার্ক অর্ডার / খাতার ছবি আপলোড',
    noWorkOrdersFound: 'কোনো ওয়ার্ক অর্ডার বা খাতার নোটিশ পাওয়া যায়নি',
    adminCenter: 'এডমিন সেন্টার',
    installApp: 'অ্যাপ ইনস্টল করুন (Android/PC)',
    language: 'ভাষা নির্বাচন (Language)',
    logout: 'লগআউট',
    login: 'লগইন',
    signIn: 'লগইন করুন',
    register: 'রেজিস্ট্রেশন',
    createAccount: 'নতুন একাউন্ট তৈরি করুন',
    loginIdNo: 'ইউজার আইডি (User ID)',
    password: 'পাসওয়ার্ড',
    forgotPassword: 'পাসওয়ার্ড ভুলে গেছেন?',
    changePassword: 'পাসওয়ার্ড পরিবর্তন',
    selectCategory: 'ক্যাটাগরি নির্বাচন করুন',
    workCategorySelection: 'কার্য ক্যাটাগরি নির্বাচন (৫টি অপশন)',
    clickToOpenForm: 'যেকোনো অপশনে ক্লিক করে সরাসরি এন্ট্রি ফর্ম খুলুন',

    pending: 'পেন্ডিং (Pending)',
    completed: 'সম্পন্ন (Completed)',
    approved: 'অনুমোদিত (Approved)',
    rejected: 'বাতিল (Rejected)',
    inProgress: 'চলমান (In Progress)',

    submit: 'সাবমিট করুন',
    submitting: 'সংরক্ষণ হচ্ছে...',
    saveChanges: 'পরিবর্তন সংরক্ষণ করুন',
    cancel: 'বাতিল করুন',
    edit: 'এডিট করুন',
    delete: 'ডিলিট করুন',
    printReceipt: 'প্রিন্ট স্লিপ',
    downloadCsv: 'এক্সেল / CSV ডাউনলোড',
    actions: 'একশন',
    status: 'স্ট্যাটাস',
    date: 'তারিখ ও সময়',
    workerName: 'কর্মীর নাম (Lineman/Staff)',
    workerPhone: 'মোবাইল নম্বর',
    workerId: 'কর্মী আইডি',
    category: 'ক্যাটাগরি',
    searchPlaceholder: 'আইডি, গ্রাহকের নাম, মিটার নং বা কর্মী দিয়ে খুঁজুন...',
    filterAll: 'সবগুলো',
    recordsCount: 'সংরক্ষিত এন্ট্রি তালিকা',
    noDataFound: 'কোন ডাটা পাওয়া যায়নি',
    editEntryTitle: 'এন্ট্রি সংশোধন / এডিট করুন',
    deleteConfirm: 'আপনি কি নিশ্চিত এই এন্ট্রিটি মুছে ফেলতে চান?',
    deleteWarning: 'মুছে ফেলার পর এটি আর পুনরুদ্ধার করা যাবে না।',
    entryUpdatedSuccess: 'এন্ট্রি সফলভাবে আপডেট করা হয়েছে!',
    entryDeletedSuccess: 'এন্ট্রি সফলভাবে মুছে ফেলা হয়েছে!',
    entryCreatedSuccess: 'Your Entry data submitted',
    userManagement: 'কর্মী ও ইউজার ম্যানেজমেন্ট',
    wbsedclStandard: 'WBSEDCL ভারতীয় বিদ্যুৎ বণ্টন মানদণ্ড',
    allRightsReserved: 'সর্বস্বত্ব সংরক্ষিত • WBSEDCL ফিল্ড পোর্টাল',
    done: 'সম্পন্ন (Done)',
    close: 'বন্ধ করুন',
    backToCategories: '← ফিরে যান (সবগুলো ক্যাটাগরি)',
    liveStatus: 'লাইভ',
    adminAuthRequired: 'এডমিন অনুমোদন প্রয়োজন',
    adminAuthDesc: 'ওয়ার্কারদের সমস্ত সাবমিশন পরিচালনা করতে আপনার এডমিন ক্রেডেনশিয়াল দিয়ে সাইন ইন করুন।',
    openAdminPanel: 'এডমিন লগইন প্যানেল খুলুন',

    feeder: '১১ কেভি ফিডার (11kV Feeder)',
    substation: '৩৩/১১ কেভি সাবস্টেশন (Substation)',
    cccOffice: 'গ্রাহক সেবা কেন্দ্র (CCC Office)',
    dtrName: 'DTR কোড ও নাম',
    poleNo: 'পোল নম্বর (Pole No / Span)',
    addressLocation: 'ঠিকানা / গ্রাম / পঞ্চায়েত / সাইট',
    notes: 'মন্তব্য / বিশেষ নোট',
    gpsLocation: 'GPS স্থানাঙ্ক (Coordinates)',
    getGps: 'জিপিএস নিন',
    photoEvidence: 'কাজের ছবি / ভিডিও (Photo & Video Evidence max 50 MB)',
    uploadPhoto: 'ছবি বা ভিডিও আপলোড (Max 50 MB)',
    takeSamplePhoto: 'স্যাম্পল ছবি তৈরি করুন',

    // 1. NSC
    nscTitle: 'NSC (New Service Connection)',
    nscSubtitle: 'নতুন বিদ্যুৎ সংযোগ স্থাপন',
    nscShortDesc: 'কনজিউমার লোড, মিটার স্থাপন, সিল নং ও ড্রপ কেবল লাইন এন্ট্রি',
    workOrderNo: 'Work Order No (ওয়ার্ক অর্ডার নং)',
    workOrderDate: 'Work Order Date (ওয়ার্ক অর্ডার তারিখ)',
    consumerName: 'গ্রাহকের নাম (Consumer Name)',
    fatherHusbandName: 'পিতা / স্বামীর নাম',
    consumerId: 'কনজিউমার আইডি (Consumer ID)',
    applicationNo: 'Application No (অ্যাপ্লিকেশন নম্বর)',
    agencyName: 'Agency Name (এজেন্সির নাম)',
    cccName: 'CCC Name (সিসিসি নাম / অফিস)',
    mobileNo: 'গ্রাহকের মোবাইল নং',
    appliedLoad: 'Sanctioned Load (kW)',
    phaseSupply: 'Supply Phase',
    singlePhase: 'সিঙ্গেল ফেজ (1-Phase 230V)',
    threePhase: 'থ্রি ফেজ (3-Phase 400V)',
    tariffCategory: 'Tariff Class',
    domestic: 'গার্হস্থ্য (Domestic A-Dom)',
    commercial: 'বাণিজ্যিক (Commercial B-Com)',
    agriculture: 'কৃষি সেচ (Agriculture)',
    industrial: 'শিল্প (Industrial / LT)',
    meterNo: 'Meter No (মিটার নম্বর)',
    meterMake: 'মিটারের মেক (Brand/Make)',
    initialReading: 'শুরুর মিটার রিডিং (kWh)',
    sealNo: 'Meter Seal No (মিটার সিল নম্বর)',
    meterSealNo: 'Meter Seal No (মিটার সিল নম্বর)',
    serviceCableLength: 'Service Cable Size & Length (Meters)',
    earthResistance: 'আর্থিং রেজিস্ট্যান্স (Earth Resistance Ω)',
    meterInstallDate: 'Meter Install Date (মিটার ইনস্টল তারিখ)',
    inspectionAgencyName: 'Inspection Agency Name (ইন্সপেকশন এজেন্সির নাম)',
    performanceDashboard: 'Performance Dashboard (পারফরম্যান্স ড্যাশবোর্ড)',

    // 2. DISCONNECTION
    disconnectionTitle: 'DISCONNECTION',
    disconnectionSubtitle: 'সংযোগ বিচ্ছিন্নকরণ',
    disconnectionShortDesc: 'বকেয়া বিল খেলাপী, গ্রাহক আবেদন ও অবৈধ সংযোগ বিচ্ছিন্ন এন্ট্রি',
    arrearAmount: 'বকেয়া বিলের পরিমাণ (Arrear Amount ₹)',
    disconnectionReason: 'বিচ্ছিন্নকরণের কারণ',
    disconnectionType: 'বিচ্ছিন্নকরণের ধরন (Disconnection Type)',
    finalReading: 'বিচ্ছিন্নকালীন ফাইনাল রিডিং (kWh)',
    noticeNo: 'সেকশন ৫৬ নোটিশ নম্বর ও তারিখ',
    cutoutSealed: 'কাটআউট সিল করা হয়েছে?',
    cutoutSealNo: 'কাটআউট সিল নম্বর',
    disconnectionActionTaken: 'গৃহীত ব্যবস্থা (Action Taken)',

    // 3. POLE CASE
    poleCaseTitle: 'POLE CASE',
    poleCaseSubtitle: 'খুঁটি ও লাইন মেরামত',
    poleCaseShortDesc: 'ভাঙা/হেলে পড়া পোল, নতুন পোল স্থাপন, তার টানা ও স্টে সেট রিপোর্ট',
    issueType: 'সমস্যার ধরন (Fault / Issue Type)',
    priority: 'অগ্রাধিকার (Priority)',
    poleType: 'পোলের ধরন (PSC / Steel Tubular / Rail)',
    lineVoltage: 'লাইনের ভোল্টেজ (LT / 11kV / 33kV)',
    conductorType: 'কন্ডাক্টর সাইজ (Rabbit / Weasel / Dog / ABC)',
    actionTaken: 'গৃহীত পদক্ষেপ (Action Taken)',
    materialUsed: 'ব্যবহৃত মালামাল (Material Issued)',
    ptwShutdownRef: 'শাটডাউন / PTW রেফারেন্স নং',

    // 4. METER REPLACEMENT
    meterReplacementTitle: 'METER REPLESMENT',
    meterReplacementSubtitle: 'মিটার প্রতিস্থাপন ও পরিবর্তন',
    meterReplacementShortDesc: 'পোড়া/নষ্ট ও ডিজিটাল মিটার প্রতিস্থাপন, পুরাতন ও নতুন রিডিং এন্ট্রি',
    oldMeterNo: 'পুরাতন মিটার নম্বর',
    oldMeterReading: 'পুরাতন মিটারের শেষ রিডিং (kWh)',
    replacementReason: 'পরিবর্তনের কারণ (Burnt / Fault / Upgrade)',
    newMeterNo: 'নতুন মিটার নম্বর',
    newMeterInitialReading: 'নতুন মিটারের প্রারম্ভিক রিডিং (00000.0)',
    newMeterSealNo: 'নতুন মিটারের হলোগ্রাম সিল নং',
    meterType: 'মিটারের ধরন (Static Electronic / Smart)',

    // 5. DTR REPLACEMENT
    dtrReplacementTitle: 'DTR REPLESMENT',
    dtrReplacementSubtitle: 'ডিস্ট্রিবিউশন ট্রান্সফরমার পরিবর্তন',
    dtrReplacementShortDesc: 'ডিস্ট্রিবিউশন ট্রান্সফরমার (kVA), অয়েল টেস্ট, নতুন DTR সিরিয়াল এন্ট্রি',
    existingCapacity: 'বিদ্যমান / পোড়া DTR ক্যাপাসিটি (kVA)',
    newCapacity: 'নতুন স্থাপিত DTR ক্যাপাসিটি (kVA)',
    oldDtrSerial: 'পুরাতন DTR সিরিয়াল নং ও মেক',
    newDtrSerial: 'নতুন DTR সিরিয়াল নং ও মেক',
    dtrFailureReason: 'ট্রান্সফরমার বিকল হওয়ার কারণ',
    oilLevelChecked: 'ট্রান্সফরমার অয়েল লেভেল ও BDV টেস্ট ঠিক আছে?',
    earthPitResistance: 'নিউট্রাল ও বডি আর্থ পিট মান (Ohms)',
    hgFuseRating: 'HG ফিউজ তার রেটিং (SWG)',
    ltMccbAmpere: 'LT ডিস্ট্রিবিউশন বক্স MCCB / ফিউজ (Amps)',
    lightningArrester: 'লাইটনিং আরেস্টার (LA 9kV) স্ট্যাটাস',

    emergencyHelpline: 'জরুরী হেল্পলাইন ও সেফটি',
    emergencyDesc: 'সাবস্টেশন ব্রেকডাউন কন্ট্রোল রুম, ১৯১২৩ কল ও লাইনম্যান নিরাপত্তা নির্দেশিকা',
    call19123: 'টোল ফ্রি হেল্পলাইন ১৯১২৩ কল করুন',
    exportReports: 'ডাটা এক্সপোর্ট ও ডেইলি শিট',
    exportDesc: 'এক্সেল / CSV ডাউনলোড, প্রিন্ট রিপোর্ট ও ডাটা ব্যাকআপ',
    adminPortal: 'এডমিন পোর্টাল ও কন্ট্রোল',
    adminPortalDesc: 'ওয়ার্কারদের সমস্ত ডাটা দেখুন, এডিট, অনুমোদন ও পরিচালনা করুন',
    languageSelectTitle: 'ভাষা নির্বাচন করুন (Language)',
    languageSelectSubtitle: 'আপনার পছন্দের ভাষা নির্বাচন করে Done করুন',
    installAppTitle: 'অ্যান্ড্রয়েড / মোবাইল অ্যাপ ইনস্টল',
    installAppSubtitle: 'ফিল্ডে দ্রুত ব্যবহারের জন্য ফোনে সরাসরি অ্যাপটি ইনস্টল করুন',
    helpSupport: 'হেল্প ও সাপোর্ট (Help & Support)',
    helpSupportDesc: 'ইমেইল সাপোর্ট ও এডমিনের সাথে লাইভ চ্যাট (Email & Live Chat)',
  },

  en: {
    appName: 'POWER',
    appSubtitle: 'WBSEDCL Field Utility Operations & Data Management',
    wbsedclTagline: 'West Bengal State Electricity Distribution Company Limited',
    mainModules: 'MAIN MODULES',
    fiveCategories: '5 Main Categories',
    dataEntry: 'New Data Entry',
    mySubmissions: 'My Submissions',
    workOrders: 'Work Orders & Khata',
    workOrderKhataBoard: 'Daily Work Orders & Khata Photo Board',
    workOrderNoticeDesc: 'View official work orders, consumer lists & khata photos uploaded by Admin',
    uploadKhataPhoto: 'Upload Work Order / Khata Photo',
    noWorkOrdersFound: 'No work orders or khata notices found',
    adminCenter: 'Admin Center',
    installApp: 'Install App (Android/PC)',
    language: 'Language Settings',
    logout: 'Log Out',
    login: 'Login',
    signIn: 'Sign In',
    register: 'Register',
    createAccount: 'Create New Account',
    loginIdNo: 'User ID',
    password: 'Password',
    forgotPassword: 'Forgot Password?',
    changePassword: 'Change Password',
    selectCategory: 'Select Category',
    workCategorySelection: 'Work Category Selection (5 Modules)',
    clickToOpenForm: 'Click any category card to open its entry form directly',

    pending: 'Pending',
    completed: 'Completed',
    approved: 'Approved',
    rejected: 'Rejected',
    inProgress: 'In Progress',

    submit: 'Submit Data',
    submitting: 'Saving...',
    saveChanges: 'Save Changes',
    cancel: 'Cancel',
    edit: 'Edit Entry',
    delete: 'Delete Entry',
    printReceipt: 'Print Slip',
    downloadCsv: 'Export Excel / CSV',
    actions: 'Actions',
    status: 'Status',
    date: 'Date & Time',
    workerName: 'Lineman / Staff Name',
    workerPhone: 'Contact Number',
    workerId: 'Staff ID',
    category: 'Category',
    searchPlaceholder: 'Search by ID, Consumer Name, Meter No, Pole, Feeder...',
    filterAll: 'All Categories',
    recordsCount: 'Recorded Field Submissions',
    noDataFound: 'No records found matching criteria',
    editEntryTitle: 'Edit / Update Field Entry',
    deleteConfirm: 'Are you sure you want to delete this field record?',
    deleteWarning: 'Once deleted, this record cannot be restored.',
    entryUpdatedSuccess: 'Entry updated successfully!',
    entryDeletedSuccess: 'Entry deleted successfully!',
    entryCreatedSuccess: 'Your Entry data submitted',
    userManagement: 'Staff & User Management',
    wbsedclStandard: 'WBSEDCL Indian Electric Utility Standard',
    allRightsReserved: 'All rights reserved • WBSEDCL Field Portal',
    done: 'Done',
    close: 'Close',
    backToCategories: '← Back to All Categories',
    liveStatus: 'Live',
    adminAuthRequired: 'Admin Authentication Required',
    adminAuthDesc: 'Sign in with your Admin credentials to view, edit, approve, and manage all worker submissions.',
    openAdminPanel: 'Open Admin Login Panel',

    feeder: '11 kV Feeder Name',
    substation: '33/11 kV Substation',
    cccOffice: 'Customer Care Center (CCC)',
    dtrName: 'DTR Code & Name',
    poleNo: 'Pole Number / Span',
    addressLocation: 'Premises / Village / GP Address',
    notes: 'Technical Notes / Remarks',
    gpsLocation: 'GPS Coordinates',
    getGps: 'Capture GPS',
    photoEvidence: 'Photo / Video Evidence (Max 50 MB)',
    uploadPhoto: 'Upload Photo or Video (Max 50 MB)',
    takeSamplePhoto: 'Generate Sample Photo',

    // 1. NSC
    nscTitle: 'NSC (New Service Connection)',
    nscSubtitle: 'New Electricity Connection Provision',
    nscShortDesc: 'Consumer load, meter installation, security seal & service cable entry',
    workOrderNo: 'Work Order No',
    workOrderDate: 'Work Order Date',
    consumerName: 'Consumer Name',
    fatherHusbandName: "Father's / Husband's Name",
    consumerId: 'Consumer ID',
    applicationNo: 'Application No',
    agencyName: 'Agency Name',
    cccName: 'CCC Name',
    mobileNo: 'Consumer Mobile Number',
    appliedLoad: 'Sanctioned Load (kW)',
    phaseSupply: 'Supply Phase',
    singlePhase: 'Single Phase (1-Ph 230V)',
    threePhase: 'Three Phase (3-Ph 400V)',
    tariffCategory: 'Tariff Class',
    domestic: 'Domestic (A-Dom)',
    commercial: 'Commercial (B-Com)',
    agriculture: 'Agriculture / Irrigation',
    industrial: 'Industrial (LT-Ind)',
    meterNo: 'Meter No',
    meterMake: 'Meter Make (Genus/Secure/HPL/L&T)',
    initialReading: 'Initial Meter Reading (kWh)',
    sealNo: 'Meter Seal No',
    meterSealNo: 'Meter Seal No',
    serviceCableLength: 'Service Cable Size & Length (Meters)',
    earthResistance: 'Earth Resistance (Ohms Ω)',
    meterInstallDate: 'Meter Install Date',
    inspectionAgencyName: 'Inspection Agency Name',
    performanceDashboard: 'Performance Dashboard',

    // 2. DISCONNECTION
    disconnectionTitle: 'DISCONNECTION',
    disconnectionSubtitle: 'Service Line Disconnection',
    disconnectionShortDesc: 'Outstanding arrear default, consumer request & unauthorized load cutoff',
    arrearAmount: 'Outstanding Arrear Amount (₹)',
    disconnectionReason: 'Reason for Disconnection',
    disconnectionType: 'Disconnection Type',
    finalReading: 'Final Disconnection Reading (kWh)',
    noticeNo: 'Section 56 Notice No & Date',
    cutoutSealed: 'Is Cutout Terminal Sealed?',
    cutoutSealNo: 'Cutout Paper/Plastic Seal No',
    disconnectionActionTaken: 'Execution Method / Action Taken',

    // 3. POLE CASE
    poleCaseTitle: 'POLE CASE',
    poleCaseSubtitle: 'Pole & Overhead Line Maintenance',
    poleCaseShortDesc: 'Broken/tilted poles, new pole erection, conductor re-stringing & stay set',
    issueType: 'Fault / Issue Classification',
    priority: 'Priority Level',
    poleType: 'Pole Type (8m/9m PSC / Steel / Rail)',
    lineVoltage: 'Line Voltage (LT 230V/400V or 11kV / 33kV)',
    conductorType: 'Conductor Size (Rabbit / Weasel / Dog / ABC)',
    actionTaken: 'Remedial Action Taken',
    materialUsed: 'Material Issued / Consumed',
    ptwShutdownRef: 'PTW / Shutdown Reference No',

    // 4. METER REPLACEMENT
    meterReplacementTitle: 'METER REPLESMENT',
    meterReplacementSubtitle: 'Defective / Smart Meter Replacement',
    meterReplacementShortDesc: 'Burnt/defective meter replacement, old & new reading recording',
    oldMeterNo: 'Old Meter Serial Number',
    oldMeterReading: 'Old Meter Final Reading (kWh)',
    replacementReason: 'Replacement Reason (Burnt/Fault/RDSS)',
    newMeterNo: 'New Meter Serial Number',
    newMeterInitialReading: 'New Meter Initial Reading (00000.0)',
    newMeterSealNo: 'New Meter Hologram Seal No',
    meterType: 'Meter Category (Static / Smart Prepaid)',

    // 5. DTR REPLACEMENT
    dtrReplacementTitle: 'DTR REPLESMENT',
    dtrReplacementSubtitle: 'Distribution Transformer Replacement',
    dtrReplacementShortDesc: 'Transformer capacity (kVA), oil breakdown test & new DTR commissioning',
    existingCapacity: 'Existing / Failed DTR Capacity (kVA)',
    newCapacity: 'New Installed DTR Capacity (kVA)',
    oldDtrSerial: 'Old DTR Serial Number & Make',
    newDtrSerial: 'New DTR Serial Number & Make',
    dtrFailureReason: 'Failure Root Cause',
    oilLevelChecked: 'Transformer Oil Level & BDV Test OK?',
    earthPitResistance: 'Neutral & Body Earth Resistance (Ohms)',
    hgFuseRating: 'HT Horn Gap (HG) Fuse Rating (SWG)',
    ltMccbAmpere: 'LT Box MCCB / Fuse Rating (Amps)',
    lightningArrester: 'Lightning Arrester (LA 9kV) Status',

    emergencyHelpline: 'Emergency Helpline & Feeder Safety',
    emergencyDesc: 'Substation Breakdown Control Room, Toll-Free 19123 & Lineman Safety Protocols',
    call19123: 'Call WBSEDCL Toll Free 19123',
    exportReports: 'Data Export & Daily Reports',
    exportDesc: 'Download Excel / CSV, printable work sheets & cloud backup',
    adminPortal: 'Admin Portal & Dashboard',
    adminPortalDesc: 'View, edit, approve, and manage all worker field entries',
    languageSelectTitle: 'Select Application Language',
    languageSelectSubtitle: 'Choose your language and click Done to apply instantly',
    installAppTitle: 'Install Android & PC App',
    installAppSubtitle: 'Install this utility directly on your mobile device for rapid field operations',
    helpSupport: 'Help & Support',
    helpSupportDesc: 'Official email assistance & Live Chat with Admin',
  },

  hi: {
    appName: 'POWER',
    appSubtitle: 'WBSEDCL फील्ड सेवा प्रबंधन एवं डेटा प्रविष्टि',
    wbsedclTagline: 'पश्चिम बंगाल राज्य विद्युत वितरण कंपनी लिमिटेड (WBSEDCL)',
    mainModules: 'MAIN MODULES (मुख्य मेन्यू)',
    fiveCategories: '5 मुख्य श्रेणियां',
    dataEntry: 'नई डेटा प्रविष्टि',
    mySubmissions: 'मेरी प्रविष्टियां (My Submissions)',
    workOrders: 'वर्क ऑर्डर एवं खाता',
    workOrderKhataBoard: 'दैनिक वर्क ऑर्डर एवं खाता फोटो बोर्ड',
    workOrderNoticeDesc: 'एडमिन द्वारा अपलोड किए गए वर्क ऑर्डर, उपभोक्ता सूची और खाता फोटो देखें',
    uploadKhataPhoto: 'वर्क ऑर्डर / खाता फोटो अपलोड',
    noWorkOrdersFound: 'कोई वर्क ऑर्डर या खाता नोटिस नहीं मिला',
    adminCenter: 'एडमिन सेंटर',
    installApp: 'ऐप इंस्टॉल करें (Android/PC)',
    language: 'भाषा चुनें (Language)',
    logout: 'लॉग आउट',
    login: 'लॉगिन',
    signIn: 'साइन इन करें',
    register: 'पंजीकरण',
    createAccount: 'नया खाता बनाएं',
    loginIdNo: 'यूजर आईडी (User ID)',
    password: 'पासवर्ड',
    forgotPassword: 'पासवर्ड भूल गए?',
    changePassword: 'पासवर्ड बदलें',
    selectCategory: 'श्रेणी का चयन करें',
    workCategorySelection: 'कार्य श्रेणी चयन (5 विकल्प)',
    clickToOpenForm: 'फॉर्म खोलने के लिए किसी भी श्रेणी कार्ड पर क्लिक करें',

    pending: 'लंबित (Pending)',
    completed: 'पूर्ण (Completed)',
    approved: 'स्वीकृत (Approved)',
    rejected: 'अस्वीकृत (Rejected)',
    inProgress: 'प्रगति पर (In Progress)',

    submit: 'जमा करें (Submit Data)',
    submitting: 'सहेजा जा रहा है...',
    saveChanges: 'परिवर्तन सहेजें',
    cancel: 'रद्द करें',
    edit: 'संशोधित करें (Edit)',
    delete: 'हटाएं (Delete)',
    printReceipt: 'रसीद प्रिंट करें',
    downloadCsv: 'एक्सेल / CSV डाउनलोड',
    actions: 'कार्रवाई',
    status: 'स्थिति (Status)',
    date: 'दिनांक एवं समय',
    workerName: 'लाइनमैन / कर्मचारी का नाम',
    workerPhone: 'मोबाइल नंबर',
    workerId: 'कर्मचारी आईडी',
    category: 'श्रेणी (Category)',
    searchPlaceholder: 'आईडी, उपभोक्ता का नाम, मीटर नंबर, फीडर द्वारा खोजें...',
    filterAll: 'सभी श्रेणियां',
    recordsCount: 'दर्ज फील्ड प्रविष्टियां',
    noDataFound: 'कोई रिकॉर्ड नहीं मिला',
    editEntryTitle: 'प्रविष्टि संपादित करें',
    deleteConfirm: 'क्या आप वाकई इस प्रविष्टि को हटाना चाहते हैं?',
    deleteWarning: 'हटाने के बाद इसे पुनर्प्राप्त नहीं किया जा सकता है।',
    entryUpdatedSuccess: 'प्रविष्टि सफलतापूर्वक अपडेट की गई!',
    entryDeletedSuccess: 'प्रविष्टि सफलतापूर्वक हटा दी गई!',
    entryCreatedSuccess: 'Your Entry data submitted',
    userManagement: 'कर्मचारी एवं उपयोगकर्ता प्रबंधन',
    wbsedclStandard: 'WBSEDCL भारतीय विद्युत वितरण मानक',
    allRightsReserved: 'सर्वाधिकार सुरक्षित • WBSEDCL फील्ड पोर्टल',
    done: 'संपन्न (Done)',
    close: 'बंद करें',
    backToCategories: '← सभी श्रेणियों पर वापस जाएं',
    liveStatus: 'लाइव',
    adminAuthRequired: 'एडमिन प्रमाणीकरण आवश्यक है',
    adminAuthDesc: 'कर्मचारियों की सभी प्रविष्टियों को प्रबंधित और संपादित करने के लिए एडमिन के रूप में लॉगिन करें।',
    openAdminPanel: 'एडमिन लॉगिन पैनल खोलें',

    feeder: '11 kV फीडर का नाम',
    substation: '33/11 kV सबस्टेशन',
    cccOffice: 'ग्राहक सेवा केंद्र (CCC)',
    dtrName: 'DTR कोड एवं नाम',
    poleNo: 'पोल संख्या / स्पैन (Pole No)',
    addressLocation: 'पता / ग्राम / पंचायत / स्थान',
    notes: 'टिप्पणी / विवरण',
    gpsLocation: 'GPS निर्देशांक (Coordinates)',
    getGps: 'जीपीएस लें',
    photoEvidence: 'कार्य का फोटो / वीडियो साक्ष्य (Max 50 MB)',
    uploadPhoto: 'फोटो या वीडियो अपलोड करें (Max 50 MB)',
    takeSamplePhoto: 'नमूना फोटो बनाएं',

    // 1. NSC
    nscTitle: 'NSC (New Service Connection)',
    nscSubtitle: 'नया विद्युत कनेक्शन प्रविष्टि',
    nscShortDesc: 'उपभोक्ता लोड, मीटर स्थापना, सील नंबर और केबल लाइन डेटा',
    workOrderNo: 'Work Order No (कार्य आदेश संख्या)',
    workOrderDate: 'Work Order Date (कार्य आदेश तिथि)',
    consumerName: 'उपभोक्ता का नाम (Consumer Name)',
    fatherHusbandName: 'पिता / पति का नाम',
    consumerId: 'कंज्यूमर आईडी (Consumer ID)',
    applicationNo: 'Application No (आवेदन संख्या)',
    agencyName: 'Agency Name (एजेंसी का नाम)',
    cccName: 'CCC Name (सीसीसी नाम / कार्यालय)',
    mobileNo: 'उपभोक्ता का मोबाइल नंबर',
    appliedLoad: 'Sanctioned Load (kW)',
    phaseSupply: 'Supply Phase',
    singlePhase: 'सिंगल फेज (1-Phase 230V)',
    threePhase: 'थ्री फेज (3-Phase 400V)',
    tariffCategory: 'Tariff Class',
    domestic: 'घरेलू (Domestic A-Dom)',
    commercial: 'वाणिज्यिक (Commercial B-Com)',
    agriculture: 'कृषि सिंचाई (Agriculture)',
    industrial: 'औद्योगिक (Industrial / LT)',
    meterNo: 'Meter No (मीटर नंबर)',
    meterMake: 'मीटर मेक (Genus/Secure/HPL/L&T)',
    initialReading: 'प्रारंभिक मीटर रीडिंग (kWh)',
    sealNo: 'Meter Seal No (मीटर सील नंबर)',
    meterSealNo: 'Meter Seal No (मीटर सील नंबर)',
    serviceCableLength: 'Service Cable Size & Length (Meters)',
    earthResistance: 'अर्थिंग प्रतिरोध (Earth Resistance Ω)',
    meterInstallDate: 'Meter Install Date (मीटर स्थापना तिथि)',
    inspectionAgencyName: 'Inspection Agency Name (निरीक्षण एजेंसी का नाम)',
    performanceDashboard: 'Performance Dashboard (प्रदर्शन डैशबोर्ड)',

    // 2. DISCONNECTION
    disconnectionTitle: 'DISCONNECTION',
    disconnectionSubtitle: 'विद्युत लाइन विच्छेदन',
    disconnectionShortDesc: 'बकाया बिल डिफाल्टर, उपभोक्ता आवेदन एवं अवैध कनेक्शन विच्छेदन',
    arrearAmount: 'बकाया बिल राशि (Arrear Amount ₹)',
    disconnectionReason: 'विच्छेदन का कारण',
    disconnectionType: 'विच्छेदन का प्रकार (Disconnection Type)',
    finalReading: 'अंतिम मीटर रीडिंग (kWh)',
    noticeNo: 'धारा 56 नोटिस नंबर एवं तारीख',
    cutoutSealed: 'क्या कटआउट सील किया गया है?',
    cutoutSealNo: 'कटआउट सील नंबर',
    disconnectionActionTaken: 'की गई कार्रवाई (Action Taken)',

    // 3. POLE CASE
    poleCaseTitle: 'POLE CASE',
    poleCaseSubtitle: 'खंभा एवं लाइन रखरखाव',
    poleCaseShortDesc: 'टूटे/झुके पोल, नया पोल लगाना, तार खींचना और स्टे सेट रिपोर्ट',
    issueType: 'समस्या का प्रकार (Fault / Issue Type)',
    priority: 'प्राथमिकता (Priority)',
    poleType: 'पोल का प्रकार (PSC / Steel Tubular / Rail)',
    lineVoltage: 'लाइन वोल्टेज (LT 230V/400V or 11kV / 33kV)',
    conductorType: 'कंडक्टर का आकार (Rabbit / Weasel / Dog / ABC)',
    actionTaken: 'की गई कार्रवाई (Action Taken)',
    materialUsed: 'उपयोग की गई सामग्री (Material Issued)',
    ptwShutdownRef: 'शटडाउन / PTW संदर्भ संख्या',

    // 4. METER REPLACEMENT
    meterReplacementTitle: 'METER REPLESMENT',
    meterReplacementSubtitle: 'मीटर प्रतिस्थापन एवं परिवर्तन',
    meterReplacementShortDesc: 'जले/खराब व डिजिटल मीटर का प्रतिस्थापन, पुरानी व नई रीडिंग',
    oldMeterNo: 'पुराना मीटर नंबर',
    oldMeterReading: 'पुराने मीटर की अंतिम रीडिंग (kWh)',
    replacementReason: 'बदलने का कारण (Burnt / Fault / Upgrade)',
    newMeterNo: 'नया मीटर नंबर',
    newMeterInitialReading: 'नए मीटर की प्रारंभिक रीडिंग (00000.0)',
    newMeterSealNo: 'नए मीटर का होलोग्राम सील नंबर',
    meterType: 'मीटर का प्रकार (Static Electronic / Smart)',

    // 5. DTR REPLACEMENT
    dtrReplacementTitle: 'DTR REPLESMENT',
    dtrReplacementSubtitle: 'वितरण ट्रांसफार्मर प्रतिस्थापन',
    dtrReplacementShortDesc: 'ट्रांसफार्मर क्षमता (kVA), ऑयल टेस्ट, नए DTR सीरियल नंबर प्रविष्टि',
    existingCapacity: 'विद्यमान / विफल DTR क्षमता (kVA)',
    newCapacity: 'नई स्थापित DTR क्षमता (kVA)',
    oldDtrSerial: 'पुराना DTR सीरियल नंबर एवं मेक',
    newDtrSerial: 'नया DTR सीरियल नंबर एवं मेक',
    dtrFailureReason: 'ट्रांसफार्मर विफलता का कारण',
    oilLevelChecked: 'ट्रांसफार्मर तेल स्तर एवं BDV परीक्षण ठीक है?',
    earthPitResistance: 'न्यूट्रल एवं बॉडी अर्थ प्रतिरोध (Ohms)',
    hgFuseRating: 'HG फ्यूज वायर रेटिंग (SWG)',
    ltMccbAmpere: 'LT बॉक्स MCCB / फ्यूज रेटिंग (Amps)',
    lightningArrester: 'लाइटनिंग अरेस्टर (LA 9kV) स्थिति',

    emergencyHelpline: 'आपातकालीन हेल्पलाइन एवं सुरक्षा',
    emergencyDesc: 'सबस्टेशन ब्रेकडाउन कंट्रोल रूम, 19123 कॉल एवं लाइनमैन सुरक्षा निर्देश',
    call19123: 'टोल फ्री 19123 पर कॉल करें',
    exportReports: 'डेटा निर्यात एवं दैनिक रिपोर्ट',
    exportDesc: 'एक्सेल / CSV डाउनलोड, प्रिंट रिपोर्ट और डेटा बैकअप',
    adminPortal: 'एडमिन पोर्टल एवं नियंत्रण',
    adminPortalDesc: 'सभी कर्मचारियों का डेटा देखें, संपादित करें और स्वीकृत करें',
    languageSelectTitle: 'भाषा का चयन करें (Select Language)',
    languageSelectSubtitle: 'अपनी भाषा चुनें और तुरंत लागू करने के लिए Done दबाएं',
    installAppTitle: 'मोबाइल ऐप इंस्टॉल करें',
    installAppSubtitle: 'फील्ड में त्वरित उपयोग के लिए सीधे अपने फोन में इंस्टॉल करें',
    helpSupport: 'सहायता एवं समर्थन (Help & Support)',
    helpSupportDesc: 'ईमेल सहायता एवं एडमिन के साथ लाइव चैट',
  },

  ur: {
    appName: 'POWER',
    appSubtitle: 'ڈبلیو بی ایس ای ڈی سی ایل فیلڈ آپریشنز اور ڈیٹا مینجمنٹ',
    wbsedclTagline: 'مغربی بنگال اسٹیٹ الیکٹریسٹی ڈسٹری بیوشن کمپنی لمیٹڈ',
    mainModules: 'MAIN MODULES (اہم ماڈیولز)',
    fiveCategories: '5 اہم زمرے',
    dataEntry: 'نیا ڈیٹا اندراج',
    mySubmissions: 'میری جمع کردہ اندراجات',
    workOrders: 'ورک آرڈرز اور کھاتہ',
    workOrderKhataBoard: 'ورک آرڈرز اور کھاتہ فوٹو بورڈ',
    workOrderNoticeDesc: 'ایڈمن کے اپ لوڈ کردہ ورک آرڈرز، صارفین کی فہرست اور کھاتہ کی تصاویر دیکھیں',
    uploadKhataPhoto: 'ورک آرڈر / کھاتہ فوٹو اپ لوڈ',
    noWorkOrdersFound: 'کوئی ورک آرڈر یا کھاتہ نوٹس نہیں ملا',
    adminCenter: 'ایڈمن سنٹر',
    installApp: 'ایپ انسٹال کریں (Android/PC)',
    language: 'زبان منتخب کریں (Language)',
    logout: 'لاگ آؤٹ',
    login: 'لاگ ان',
    signIn: 'سائن ان کریں',
    register: 'رجسٹریشن',
    createAccount: 'نیا اکاؤنٹ بنائیں',
    loginIdNo: 'یوزر آئی ڈی (User ID)',
    password: 'پاس ورڈ',
    forgotPassword: 'پاس ورڈ بھول گئے؟',
    changePassword: 'پاس ورڈ تبدیل کریں',
    selectCategory: 'زمرہ منتخب کریں',
    workCategorySelection: 'کام کے زمرے کا انتخاب (5 آپشنز)',
    clickToOpenForm: 'فارم کھولنے کے لیے کسی بھی آپشن پر کلک کریں',

    pending: 'زیر التواء (Pending)',
    completed: 'مکمل (Completed)',
    approved: 'منظور شدہ (Approved)',
    rejected: 'مسترد (Rejected)',
    inProgress: 'جاری ہے (In Progress)',

    submit: 'ڈیٹا جمع کریں (Submit)',
    submitting: 'محفوظ ہو رہا ہے...',
    saveChanges: 'تبدیلیاں محفوظ کریں',
    cancel: 'منسوخ کریں',
    edit: 'ترمیم کریں (Edit)',
    delete: 'حذف کریں (Delete)',
    printReceipt: 'سلپ پرنٹ کریں',
    downloadCsv: 'ایکسل / CSV ڈاؤن لوڈ',
    actions: 'کارروائی',
    status: 'حیثیت (Status)',
    date: 'تاریخ اور وقت',
    workerName: 'لائن مین / ورکر کا نام',
    workerPhone: 'موبائل نمبر',
    workerId: 'اسٹاف آئی ڈی',
    category: 'زمرہ (Category)',
    searchPlaceholder: 'آئی ڈی، صارف کا نام، میٹر نمبر، فیڈر سے تلاش کریں...',
    filterAll: 'تمام زمرے',
    recordsCount: 'محفوظ شدہ فیلڈ اندراجات',
    noDataFound: 'کوئی ریکارڈ نہیں ملا',
    editEntryTitle: 'اندراج میں ترمیم کریں',
    deleteConfirm: 'کیا آپ واقعی اس ریکارڈ کو حذف کرنا چاہتے ہیں؟',
    deleteWarning: 'حذف کرنے کے بعد اسے دوبارہ حاصل نہیں کیا جا سکتا۔',
    entryUpdatedSuccess: 'اندراج کامیابی سے اپ ڈیٹ ہو گیا!',
    entryDeletedSuccess: 'اندراج کامیابی سے حذف ہو گیا!',
    entryCreatedSuccess: 'Your Entry data submitted',
    userManagement: 'عملہ اور صارف کا انتظام',
    wbsedclStandard: 'WBSEDCL ہندوستانی بجلی کی تقسیم کے معیارات',
    allRightsReserved: 'جملہ حقوق محفوظ ہیں • ڈبلیو بی ایس ای ڈی سی ایل فیلڈ پورٹل',
    done: 'مکمل (Done)',
    close: 'بند کریں',
    backToCategories: '← تمام زمروں پر واپس جائیں',
    liveStatus: 'لائیو',
    adminAuthRequired: 'ایڈمن تصدیق درکار ہے',
    adminAuthDesc: 'تمام ورکرز کے اندراجات کو منظم اور ترمیم کرنے کے لیے ایڈمن کے طور پر لاگ ان کریں۔',
    openAdminPanel: 'ایڈمن لاگ ان پینل کھولیں',

    feeder: '11 kV فیڈر کا نام',
    substation: '33/11 kV سب اسٹیشن',
    cccOffice: 'کسٹمر کیئر سنٹر (CCC)',
    dtrName: 'DTR کوڈ اور نام',
    poleNo: 'پول نمبر / اسپین (Pole No)',
    addressLocation: 'پتہ / گاؤں / پنچایت / سائٹ',
    notes: 'تکنیکی نوٹس / تبصرے',
    gpsLocation: 'GPS کوآرڈینیٹس',
    getGps: 'جی پی ایس حاصل کریں',
    photoEvidence: 'کام کی تصویر یا ویڈیو ثبوت (Max 50 MB)',
    uploadPhoto: 'تصویر یا ویڈیو اپ لوڈ کریں (Max 50 MB)',
    takeSamplePhoto: 'نمونہ تصویر بنائیں',

    // 1. NSC
    nscTitle: 'NSC (New Service Connection)',
    nscSubtitle: 'نیا بجلی کا کنکشن',
    nscShortDesc: 'صارف کا لوڈ، میٹر کی تنصیب، سیل نمبر اور کیبل لائن کا اندراج',
    workOrderNo: 'Work Order No (ورک آرڈر نمبر)',
    workOrderDate: 'Work Order Date (ورک آرڈر تاریخ)',
    consumerName: 'صارف کا نام (Consumer Name)',
    fatherHusbandName: 'والد / شوہر کا نام',
    consumerId: 'صارف آئی ڈی (Consumer ID)',
    applicationNo: 'Application No (درخواست نمبر)',
    agencyName: 'Agency Name (ایجنسی کا نام)',
    cccName: 'CCC Name (سی سی سی نام)',
    mobileNo: 'صارف کا موبائل نمبر',
    appliedLoad: 'Sanctioned Load (kW)',
    phaseSupply: 'Supply Phase',
    singlePhase: 'سنگل فیز (1-Phase 230V)',
    threePhase: 'تھری فیز (3-Phase 400V)',
    tariffCategory: 'Tariff Class',
    domestic: 'گھریلو (Domestic A-Dom)',
    commercial: 'تجارتی (Commercial B-Com)',
    agriculture: 'زرعی آبپاشی (Agriculture)',
    industrial: 'صنعتی (Industrial / LT)',
    meterNo: 'Meter No (میٹر نمبر)',
    meterMake: 'میٹر میک (Genus/Secure/HPL/L&T)',
    initialReading: 'ابتدائی میٹر ریڈنگ (kWh)',
    sealNo: 'Meter Seal No (میٹر سیل نمبر)',
    meterSealNo: 'Meter Seal No (میٹر سیل نمبر)',
    serviceCableLength: 'Service Cable Size & Length (Meters)',
    earthResistance: 'ارتھنگ مزاحمت (Earth Resistance Ω)',
    meterInstallDate: 'Meter Install Date (میٹر تنصیب تاریخ)',
    inspectionAgencyName: 'Inspection Agency Name (انسپیکشن ایجنسی کا نام)',
    performanceDashboard: 'Performance Dashboard (کارکردگی ڈیش بورڈ)',

    // 2. DISCONNECTION
    disconnectionTitle: 'DISCONNECTION',
    disconnectionSubtitle: 'لائن منقطع کرنا',
    disconnectionShortDesc: 'بقایا بل، صارف کی درخواست اور غیر قانونی کنکشن منقطع کرنے کا اندراج',
    arrearAmount: 'بقایا رقم (Arrear Amount ₹)',
    disconnectionReason: 'منقطع کرنے کی وجہ',
    disconnectionType: 'منقطع کی قسم (Disconnection Type)',
    finalReading: 'آخری میٹر ریڈنگ (kWh)',
    noticeNo: 'سیکشن 56 نوٹس نمبر اور تاریخ',
    cutoutSealed: 'کیا کٹ آؤٹ سیل کیا گیا ہے؟',
    cutoutSealNo: 'کٹ آؤٹ سیل نمبر',
    disconnectionActionTaken: 'کی گئی کارروائی (Action Taken)',

    // 3. POLE CASE
    poleCaseTitle: 'POLE CASE',
    poleCaseSubtitle: 'کھمبے اور لائن کی مرمت',
    poleCaseShortDesc: 'ٹوٹے/جھکے پول، نیا پول لگانا، تار کھینچنا اور اسٹے سیٹ رپورٹ',
    issueType: 'مسئلے کی قسم (Fault / Issue Type)',
    priority: 'ترجیح (Priority)',
    poleType: 'پول کی قسم (PSC / Steel Tubular / Rail)',
    lineVoltage: 'لائن وولٹیج (LT 230V/400V or 11kV / 33kV)',
    conductorType: 'کنڈکٹر سائز (Rabbit / Weasel / Dog / ABC)',
    actionTaken: 'کی گئی کارروائی (Action Taken)',
    materialUsed: 'استعمال شدہ سامان (Material Issued)',
    ptwShutdownRef: 'شٹ ڈاؤن / PTW حوالہ نمبر',

    // 4. METER REPLACEMENT
    meterReplacementTitle: 'METER REPLESMENT',
    meterReplacementSubtitle: 'میٹر کی تبدیلی',
    meterReplacementShortDesc: 'جلے/خراب اور ڈیجیٹل میٹر کی تبدیلی، پرانی اور نئی ریڈنگ',
    oldMeterNo: 'پرانا میٹر نمبر',
    oldMeterReading: 'پرانے میٹر کی آخری ریڈنگ (kWh)',
    replacementReason: 'تبدیلی کی وجہ (Burnt / Fault / Upgrade)',
    newMeterNo: 'نیا میٹر نمبر',
    newMeterInitialReading: 'نئے میٹر کی ابتدائی ریڈنگ (00000.0)',
    newMeterSealNo: 'نئے میٹر کا ہولوگرام سیل نمبر',
    meterType: 'میٹر کی قسم (Static Electronic / Smart)',

    // 5. DTR REPLACEMENT
    dtrReplacementTitle: 'DTR REPLESMENT',
    dtrReplacementSubtitle: 'ٹرانسفارمر کی تبدیلی',
    dtrReplacementShortDesc: 'ٹرانسفارمر کی صلاحیت (kVA)، آئل ٹیسٹ، نئے DTR سیریل نمبر کا اندراج',
    existingCapacity: 'موجودہ / خراب DTR کی صلاحیت (kVA)',
    newCapacity: 'نئی نصب شدہ DTR کی صلاحیت (kVA)',
    oldDtrSerial: 'پرانا DTR سیریل نمبر اور میک',
    newDtrSerial: 'نیا DTR سیریل نمبر اور میک',
    dtrFailureReason: 'ٹرانسفارمر خرابی کی وجہ',
    oilLevelChecked: 'کیا ٹرانسفارمر آئل لیول اور BDV ٹیسٹ ٹھیک ہے؟',
    earthPitResistance: 'نیوٹرل اور باڈی ارتھ مزاحمت (Ohms)',
    hgFuseRating: 'HG فیوز وائر ریٹنگ (SWG)',
    ltMccbAmpere: 'LT باکس MCCB / فیوز ریٹنگ (Amps)',
    lightningArrester: 'لائٹننگ اریسٹر (LA 9kV) کی حیثیت',

    emergencyHelpline: 'ایمرجنسی ہیلپ لائن اور سیفٹی',
    emergencyDesc: 'سب اسٹیشن بریک ڈاؤن کنٹرول روم، 19123 کال اور لائن مین سیفٹی گائیڈ لائنز',
    call19123: 'ٹول فری 19123 پر کال کریں',
    exportReports: 'ڈیٹا ایکسپورٹ اور روزانہ رپورٹس',
    exportDesc: 'ایکسل / CSV ڈاؤن لوڈ، پرنٹ ایبل رپورٹس اور ڈیٹا بیک اپ',
    adminPortal: 'ایڈمن پورٹل اور کنٹرول',
    adminPortalDesc: 'تمام ورکرز کا ڈیٹا دیکھیں، ترمیم کریں اور منظور کریں',
    languageSelectTitle: 'ایپلیکیشن کی زبان منتخب کریں',
    languageSelectSubtitle: 'اپنی پسندیدہ زبان منتخب کریں اور فوری طور پر لاگو کرنے کے لیے Done کریں',
    installAppTitle: 'اینڈرائیڈ موبائل ایپ انسٹال کریں',
    installAppSubtitle: 'فیلڈ میں تیز رفتار استعمال کے لیے براہ راست اپنے فون پر انسٹال کریں',
    helpSupport: 'مدد اور سپورٹ (Help & Support)',
    helpSupportDesc: 'ای میل سپورٹ اور ایڈمن کے ساتھ براہ راست چیٹ',
  }
};
