import React, { useState, useEffect, useMemo, useRef } from 'react';
import { database } from './firebase';
import { ref, onValue, set } from 'firebase/database';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { 
  Building2, 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  Edit3, 
  TrendingUp, 
  Briefcase, 
  Settings, 
  Download, 
  Upload, 
  ChevronRight, 
  Filter, 
  BarChart3, 
  X, 
  Sparkles,
  CalendarDays,
  Check,
  AlertCircle,
  HelpCircle,
  ArrowUpRight,
  ShieldCheck,
  RotateCcw,
  ChevronLeft,
  CheckCircle2,
  FileText,
  Package,
  Layers,
  DollarSign,
  Copy,
  Moon,
  Sun,
  Search,
  Printer,
  Volume2,
  VolumeX,
  Target,
  Calculator,
  Grid,
  List
} from 'lucide-react';

// Format money in Sri Lankan Rupees (LKR / Rs.)
const formatLKR = (amount) => {
  const formatted = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
  return `Rs. ${formatted}`;
};

const getDayName = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short' });
};

const getDayOfWeek = (dateStr) => {
  if (!dateStr) return 1;
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
};

// Calculate shift duration in hours
const calculateHours = (startTime, endTime, breakMinutes = 0) => {
  if (!startTime || !endTime) return 0;
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;
  
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60; // Overnight shift calculation
  }
  
  const totalMinutes = endMinutes - startMinutes - Number(breakMinutes || 0);
  return Math.max(0, parseFloat((totalMinutes / 60).toFixed(2)));
};

// Check if shift crosses midnight
const isOvernightShift = (startTime, endTime) => {
  if (!startTime || !endTime) return false;
  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  return (eH * 60 + eM) < (sH * 60 + sM);
};

// Calculate company-specific pay cycle date range for a given month YYYY-MM
export const getCompanyDateRange = (company, monthStr) => {
  if (!monthStr || monthStr === 'all') {
    return { startDate: null, endDate: null, label: 'All Time' };
  }
  const startDay = Math.max(1, Math.min(31, Number(company?.payCycleStartDay || 1)));
  const [yearStr, mStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(mStr, 10); // 1-12

  if (startDay <= 1) {
    // Standard calendar month (1st to end of month)
    const lastDay = new Date(year, month, 0).getDate();
    const startDate = `${yearStr}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${yearStr}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'short' });
    return { 
      startDate, 
      endDate, 
      label: `01 ${monthName} - ${lastDay} ${monthName}` 
    };
  } else {
    // Custom pay cycle (e.g. 21st of prev month to 20th of selected month)
    const prevMonthDate = new Date(year, month - 2, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth() + 1;
    const daysInPrev = new Date(prevYear, prevMonth, 0).getDate();
    const actualStartDay = Math.min(startDay, daysInPrev);
    const startDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(actualStartDay).padStart(2, '0')}`;

    const endDayNum = startDay - 1;
    const daysInCur = new Date(year, month, 0).getDate();
    const actualEndDay = Math.min(endDayNum, daysInCur);
    const endDate = `${yearStr}-${String(month).padStart(2, '0')}-${String(actualEndDay).padStart(2, '0')}`;

    const startMonthName = prevMonthDate.toLocaleString('default', { month: 'short' });
    const curMonthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'short' });

    return {
      startDate,
      endDate,
      label: `${String(actualStartDay).padStart(2, '0')} ${startMonthName} - ${String(actualEndDay).padStart(2, '0')} ${curMonthName}`
    };
  }
};

// Check if a shift falls within the company's pay period
export const isShiftInCompanyPeriod = (shift, company, monthStr) => {
  if (!monthStr || monthStr === 'all') return true;
  const { startDate, endDate } = getCompanyDateRange(company, monthStr);
  if (!startDate || !endDate) return true;
  return shift.date >= startDate && shift.date <= endDate;
};

// Subtle Web Audio Chime
const playChime = (enabled = true) => {
  if (!enabled || typeof window === 'undefined' || !window.AudioContext) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {
    // Ignore audio permission restrictions
  }
};

export default function App() {
  const [companies, setCompanies] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Pure Monochrome Theme: 'dark' (black bg, white text) or 'light' (white bg, black text)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('paytrack_theme') || 'dark';
  });

  const [activeTab, setActiveTab] = useState('home');
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [companyFilter, setCompanyFilter] = useState('all');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Goal & Modals
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [companyGoalModalOpen, setCompanyGoalModalOpen] = useState(false);
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);

  // Monthly Target Goal (saved in localStorage)
  const [monthlyGoal, setMonthlyGoal] = useState(() => {
    return Number(localStorage.getItem('paytrack_monthly_goal') || 100000);
  });

  // Modal States
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [rateModalCompany, setRateModalCompany] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [editingShift, setEditingShift] = useState(null);
  const [editingCompany, setEditingCompany] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const fileInputRef = useRef(null);

  // Apply theme to document
  useEffect(() => {
    localStorage.setItem('paytrack_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.body.style.backgroundColor = '#000000';
      document.body.style.color = '#ffffff';
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#ffffff';
      document.body.style.color = '#000000';
    }
  }, [theme]);

  // Sync state with Firebase Realtime Database
  useEffect(() => {
    const companiesRef = ref(database, 'companies');
    const shiftsRef = ref(database, 'shifts');

    const unsubCompanies = onValue(companiesRef, (snapshot) => {
      const data = snapshot.val();
      setCompanies(data ? Object.values(data) : []);
      setIsDataLoaded(true);
    });

    const unsubShifts = onValue(shiftsRef, (snapshot) => {
      const data = snapshot.val();
      setShifts(data ? Object.values(data) : []);
    });

    return () => {
      unsubCompanies();
      unsubShifts();
    };
  }, []);

  // Save monthly goal
  useEffect(() => {
    localStorage.setItem('paytrack_monthly_goal', monthlyGoal);
  }, [monthlyGoal]);

  // Toast notification helper
  const showToast = (msg) => {
    playChime(soundEnabled);
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const getEffectiveRate = (company, dateStr) => {
    if (!company) return 0;
    
    // 1. Check salary revision / promotion history on or before this date
    let baseRate = company.defaultRate || 0;
    if (company.rateHistory && company.rateHistory.length > 0) {
      const sortedHistory = [...company.rateHistory].sort((a, b) => 
        new Date(b.startDate) - new Date(a.startDate)
      );
      const match = sortedHistory.find(item => item.startDate <= dateStr);
      if (match) {
        baseRate = match.rate;
      }
    }

    // 2. Check Day-of-Week overrides (0=Sun, 6=Sat, etc.)
    const dayOfWeek = getDayOfWeek(dateStr);
    if (company.dayRates && company.dayRates[dayOfWeek] !== undefined && company.dayRates[dayOfWeek] !== null) {
      return Number(company.dayRates[dayOfWeek]);
    }

    return Number(baseRate);
  };

  // Filter shifts considering each company's individual pay cycle date range and search query
  const filteredShifts = useMemo(() => {
    return shifts.filter(s => {
      const comp = companies.find(c => c.id === s.companyId);
      const inPeriod = isShiftInCompanyPeriod(s, comp, selectedMonth);
      const matchesCompany = companyFilter === 'all' || s.companyId === companyFilter;
      
      let matchesSearch = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const compName = (comp?.name || '').toLowerCase();
        const dateMatch = s.date.includes(q);
        const noteMatch = (s.notes || '').toLowerCase().includes(q);
        matchesSearch = compName.includes(q) || dateMatch || noteMatch;
      }

      return inPeriod && matchesCompany && matchesSearch;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [shifts, companies, selectedMonth, companyFilter, searchQuery]);

  // Aggregate statistics across employers
  const stats = useMemo(() => {
    let totalEarnings = 0;
    let totalHours = 0;
    let totalProducts = 0;
    let totalBonuses = 0;

    const companyBreakdown = {};

    companies.forEach(comp => {
      if (companyFilter === 'all' || comp.id === companyFilter) {
        const isMonthly = comp.paymentModel === 'monthly';
        const baseMonthly = (isMonthly && selectedMonth !== 'all') ? Number(comp.monthlySalary || 0) : 0;
        companyBreakdown[comp.id] = {
          hours: 0,
          products: 0,
          earnings: baseMonthly,
          bonus: 0,
          count: 0,
          baseMonthly
        };
        totalEarnings += baseMonthly;
      }
    });

    filteredShifts.forEach(shift => {
      const earnings = Number(shift.earnings || 0);
      const hours = Number(shift.hoursWorked || 0);
      const products = Number(shift.unitsCompleted || 0);
      const bonus = Number(shift.bonus || 0);

      totalEarnings += earnings;
      totalHours += hours;
      totalProducts += products;
      totalBonuses += bonus;

      if (!companyBreakdown[shift.companyId]) {
        companyBreakdown[shift.companyId] = { hours: 0, products: 0, earnings: 0, bonus: 0, count: 0, baseMonthly: 0 };
      }
      companyBreakdown[shift.companyId].hours += hours;
      companyBreakdown[shift.companyId].products += products;
      companyBreakdown[shift.companyId].earnings += earnings;
      companyBreakdown[shift.companyId].bonus += bonus;
      companyBreakdown[shift.companyId].count += 1;
    });

    const avgHourlyRate = totalHours > 0 ? (totalEarnings - totalBonuses) / totalHours : 0;
    const distinctDays = new Set(filteredShifts.map(s => s.date)).size;
    const avgDailyEarnings = distinctDays > 0 ? totalEarnings / distinctDays : 0;

    return {
      totalEarnings,
      totalHours,
      totalProducts,
      totalBonuses,
      avgHourlyRate,
      distinctDays,
      avgDailyEarnings,
      companyBreakdown,
      shiftCount: filteredShifts.length
    };
  }, [filteredShifts, companies, selectedMonth, companyFilter]);

  const saveToFirebase = (path, data) => {
    set(ref(database, path), data);
  };

  const handleSaveShift = (shiftData) => {
    const company = companies.find(c => c.id === shiftData.companyId);
    const paymentModel = shiftData.paymentModel || company?.paymentModel || 'hourly';

    let shiftToSave = {
      ...shiftData,
      paymentModel,
      id: shiftData.id || `sh-${Date.now()}`
    };

    if (paymentModel === 'product') {
      const units = Number(shiftData.unitsCompleted || 0);
      const unitRate = Number(shiftData.unitRate || company?.productRate || 0);
      const bonus = Number(shiftData.bonus || 0);
      const earnings = (units * unitRate) + bonus;

      shiftToSave = {
        ...shiftToSave,
        unitsCompleted: units,
        unitRate,
        bonus,
        earnings: parseFloat(earnings.toFixed(2)),
        hoursWorked: 0
      };
    } else if (paymentModel === 'monthly') {
      const hours = Number(shiftData.hoursWorked || 0);
      const otRate = Number(shiftData.hourlyRate || company?.overtimeHourlyRate || 0);
      const bonus = Number(shiftData.bonus || 0);
      const earnings = (hours * otRate) + bonus;

      shiftToSave = {
        ...shiftToSave,
        hoursWorked: hours,
        hourlyRate: otRate,
        bonus,
        earnings: parseFloat(earnings.toFixed(2))
      };
    } else {
      const hoursWorked = shiftData.isFixedHours 
        ? Number(shiftData.fixedHours || 0) 
        : calculateHours(shiftData.startTime, shiftData.endTime, shiftData.breakMinutes);
      const autoRate = getEffectiveRate(company, shiftData.date);
      const appliedRate = shiftData.manualRate ? Number(shiftData.hourlyRate) : autoRate;
      
      const baseEarnings = hoursWorked * appliedRate;
      const totalShiftEarnings = baseEarnings + Number(shiftData.bonus || 0);

      shiftToSave = {
        ...shiftToSave,
        hoursWorked,
        hourlyRate: appliedRate,
        breakMinutes: Number(shiftData.breakMinutes || 0),
        earnings: parseFloat(totalShiftEarnings.toFixed(2))
      };
    }

    const updatedShifts = editingShift 
      ? shifts.map(s => s.id === editingShift.id ? shiftToSave : s)
      : [shiftToSave, ...shifts];
    
    saveToFirebase('shifts', updatedShifts.reduce((acc, curr) => ({...acc, [curr.id]: curr}), {}));
    showToast(editingShift ? 'Entry updated successfully' : 'New shift logged');

    setShiftModalOpen(false);
    setEditingShift(null);
  };

  const handleDuplicateShift = (shift) => {
    const duplicated = {
      ...shift,
      id: `sh-${Date.now()}`,
      notes: shift.notes ? `${shift.notes} (Copy)` : 'Copy'
    };
    const updatedShifts = [duplicated, ...shifts];
    saveToFirebase('shifts', updatedShifts.reduce((acc, curr) => ({...acc, [curr.id]: curr}), {}));
    showToast('Shift duplicated');
  };

  const handleBatchLogShifts = (batchConfig) => {
    const { companyId, startDate, endDate, startTime, endTime, breakMinutes, bonus, notes } = batchConfig;
    const company = companies.find(c => c.id === companyId);
    if (!company || !startDate || !endDate) return;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const newShifts = [];

    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      const dateStr = dt.toISOString().slice(0, 10);
      const hoursWorked = calculateHours(startTime, endTime, breakMinutes);
      const rate = getEffectiveRate(company, dateStr);
      const earnings = (hoursWorked * rate) + Number(bonus || 0);

      newShifts.push({
        id: `sh-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        companyId,
        date: dateStr,
        startTime,
        endTime,
        breakMinutes: Number(breakMinutes || 0),
        bonus: Number(bonus || 0),
        notes: notes || 'Batch logged',
        hoursWorked,
        hourlyRate: rate,
        earnings: parseFloat(earnings.toFixed(2)),
        paymentModel: 'hourly'
      });
    }

    const merged = [...newShifts, ...shifts];
    saveToFirebase('shifts', merged.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {}));
    showToast(`${newShifts.length} shifts logged in batch`);
    setBatchModalOpen(false);
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'shift') {
      const updatedShifts = shifts.filter(s => s.id !== deleteConfirm.id);
      saveToFirebase('shifts', updatedShifts.reduce((acc, curr) => ({...acc, [curr.id]: curr}), {}));
      showToast('Shift removed');
    } else if (deleteConfirm.type === 'company') {
      const hasShifts = shifts.some(s => s.companyId === deleteConfirm.id);
      if (hasShifts) {
        showToast('Cannot delete company with logged shifts');
        setDeleteConfirm(null);
        return;
      }
      const updatedCompanies = companies.filter(c => c.id !== deleteConfirm.id);
      saveToFirebase('companies', updatedCompanies.reduce((acc, curr) => ({...acc, [curr.id]: curr}), {}));
      showToast('Company removed');
      if (selectedCompanyId === deleteConfirm.id) {
        setActiveTab('home');
        setSelectedCompanyId(null);
      }
    }
    setDeleteConfirm(null);
  };

  const handleSaveCompany = (companyData) => {
    let updatedCompanies;
    if (editingCompany) {
      updatedCompanies = companies.map(c => c.id === editingCompany.id ? { ...c, ...companyData, monthlyGoal: editingCompany.monthlyGoal || companyData.monthlyGoal } : c);
      showToast('Company details updated');
    } else {
      const baseRateVal = companyData.defaultRate || companyData.monthlySalary || companyData.productRate || 0;
      const newCompany = {
        ...companyData,
        id: `comp-${Date.now()}`,
        dayRates: companyData.dayRates || {},
        rateHistory: companyData.rateHistory || [
          { id: `rh-${Date.now()}`, startDate: new Date().toISOString().slice(0, 10), rate: baseRateVal, note: 'Base Rate' }
        ]
      };
      updatedCompanies = [...companies, newCompany];
      showToast('Company added successfully');
    }
    saveToFirebase('companies', updatedCompanies.reduce((acc, curr) => ({...acc, [curr.id]: curr}), {}));
    setCompanyModalOpen(false);
    setEditingCompany(null);
  };

  const handleAddRateRevision = (companyId, newRevision) => {
    const updatedCompanies = companies.map(c => {
      if (c.id === companyId) {
        const updatedHistory = [...(c.rateHistory || []), { ...newRevision, id: `rh-${Date.now()}` }];
        return { ...c, rateHistory: updatedHistory };
      }
      return c;
    });
    saveToFirebase('companies', updatedCompanies.reduce((acc, curr) => ({...acc, [curr.id]: curr}), {}));
    showToast('Promotion rate added');
  };

  const handleSaveCompanyGoal = (companyId, newGoal) => {
    const updatedCompanies = companies.map(c => {
      if (c.id === companyId) {
        return { ...c, monthlyGoal: Number(newGoal || 0) };
      }
      return c;
    });
    saveToFirebase('companies', updatedCompanies.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {}));
    showToast('Company target goal updated');
  };

  // CSV Spreadsheet Export
  const handleExportCSV = () => {
    const headers = ['Date', 'Company', 'Payment Model', 'Start Time', 'End Time', 'Hours / Units', 'Hourly / Unit Rate', 'Bonus (LKR)', 'Earnings (LKR)', 'Notes'];
    const rows = filteredShifts.map(s => {
      const comp = companies.find(c => c.id === s.companyId);
      return [
        s.date,
        `"${comp?.name || 'Unknown'}"`,
        s.paymentModel || 'hourly',
        s.startTime || '',
        s.endTime || '',
        s.paymentModel === 'product' ? s.unitsCompleted : s.hoursWorked,
        s.paymentModel === 'product' ? s.unitRate : s.hourlyRate,
        s.bonus || 0,
        s.earnings || 0,
        `"${(s.notes || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `paytrack_shifts_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('CSV Timesheet downloaded');
  };

  // PDF Payslip Generator
  const handleGeneratePayslip = (targetCompanyId = null) => {
    const doc = new jsPDF();
    const isSpecificCompany = !!targetCompanyId;
    const comp = isSpecificCompany ? companies.find(c => c.id === targetCompanyId) : null;
    
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, 210, 32, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text("PAYTRACK LK - STATEMENT", 14, 16);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text("SALARY & WORK SUMMARY", 14, 24);
    
    const cycleRange = comp 
      ? getCompanyDateRange(comp, selectedMonth) 
      : { label: selectedMonth === 'all' ? 'All Time' : selectedMonth };
    
    let y = 42;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 14, y);
    doc.text(`Period / Cycle: ${cycleRange.label} (${selectedMonth === 'all' ? 'All Time' : selectedMonth})`, 14, y + 6);
    
    if (comp) {
      doc.text(`Employer: ${comp.name}`, 14, y + 12);
      const modelLabel = comp.paymentModel === 'monthly' ? 'Fixed Monthly' : comp.paymentModel === 'product' ? 'Per Product' : 'Hourly';
      doc.text(`Structure: ${modelLabel}`, 14, y + 18);
      y += 18;
    }
    
    const periodEarnings = comp 
      ? (stats.companyBreakdown[comp.id]?.earnings || 0)
      : stats.totalEarnings;
      
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(14, y + 6, 182, 16);
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text("TOTAL NET EARNINGS:", 20, y + 17);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(formatLKR(periodEarnings), 130, y + 17);
    
    const relevantShifts = comp 
      ? filteredShifts.filter(s => s.companyId === comp.id)
      : filteredShifts;

    const tableData = relevantShifts.map(s => {
      const shiftComp = companies.find(c => c.id === s.companyId);
      let workDetails = '';
      if (s.paymentModel === 'product' || shiftComp?.paymentModel === 'product') {
        workDetails = `${s.unitsCompleted || 0} Units @ ${formatLKR(s.unitRate || shiftComp?.productRate || 0)}`;
      } else if (s.paymentModel === 'monthly' || shiftComp?.paymentModel === 'monthly') {
        workDetails = s.hoursWorked > 0 ? `${s.hoursWorked} OT Hrs @ ${formatLKR(s.hourlyRate || shiftComp?.overtimeHourlyRate || 0)}` : 'Attendance / Shift';
      } else {
        workDetails = `${s.startTime || '--'} - ${s.endTime || '--'} (${s.hoursWorked || 0} hrs)`;
      }

      return [
        s.date,
        shiftComp?.name || 'Unknown',
        workDetails,
        s.bonus ? formatLKR(s.bonus) : 'Rs. 0.00',
        formatLKR(s.earnings)
      ];
    });

    doc.autoTable({
      startY: y + 28,
      head: [['Date', 'Company', 'Work / Hours / Units', 'Bonus', 'Earnings']],
      body: tableData,
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      styles: { fontSize: 8.5 }
    });

    const filePrefix = comp ? `statement_${comp.name.replace(/\s+/g, '_')}` : 'paytrack_statement';
    doc.save(`${filePrefix}_${selectedMonth}.pdf`);
    showToast('PDF Payslip downloaded');
  };

  // Data Export (JSON Backup)
  const handleExportData = () => {
    const backupObj = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      companies,
      shifts
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `paytrack_lk_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Backup JSON downloaded');
  };

  // Data Import (Restore from JSON)
  const handleImportData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.companies || parsed.shifts) {
          const companiesArray = Array.isArray(parsed.companies) 
            ? parsed.companies 
            : parsed.companies ? Object.values(parsed.companies) : [];
          const shiftsArray = Array.isArray(parsed.shifts) 
            ? parsed.shifts 
            : parsed.shifts ? Object.values(parsed.shifts) : [];

          setCompanies(companiesArray);
          setShifts(shiftsArray);

          saveToFirebase('companies', companiesArray.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {}));
          saveToFirebase('shifts', shiftsArray.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {}));
          showToast('Data restored and synced');
        } else {
          showToast('Invalid JSON file format');
        }
      } catch (err) {
        showToast('Error reading JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Comprehensive Month History Discovery
  const monthOptions = useMemo(() => {
    const set = new Set();
    shifts.forEach(s => {
      if (s.date && s.date.length >= 7) {
        set.add(s.date.slice(0, 7));
      }
    });

    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const sorted = Array.from(set).sort().reverse();
    const opts = [{ value: 'all', label: 'ALL TIME' }];
    sorted.forEach(val => {
      const [y, m] = val.split('-').map(Number);
      const d = new Date(y, m - 1, 1);
      const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      opts.push({ value: val, label });
    });
    return opts;
  }, [shifts]);

  // Prev / Next Month Step Navigation
  const stepMonth = (direction) => {
    if (selectedMonth === 'all') {
      const today = new Date();
      setSelectedMonth(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
      return;
    }
    const [yStr, mStr] = selectedMonth.split('-');
    const curDate = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
    curDate.setMonth(curDate.getMonth() + direction);
    setSelectedMonth(`${curDate.getFullYear()}-${String(curDate.getMonth() + 1).padStart(2, '0')}`);
  };

  // Chart datasets
  const chartDataWorkplaces = useMemo(() => {
    return companies.map(c => {
      const breakdown = stats.companyBreakdown[c.id];
      const earn = breakdown?.earnings || 0;
      return {
        name: c.name,
        earnings: earn
      };
    }).filter(d => d.earnings > 0);
  }, [companies, stats]);

  const chartDataDaily = useMemo(() => {
    const dayMap = {};
    filteredShifts.forEach(s => {
      const shortDate = s.date.slice(5);
      if (!dayMap[shortDate]) dayMap[shortDate] = 0;
      dayMap[shortDate] += Number(s.earnings || 0);
    });
    return Object.keys(dayMap).sort().map(date => ({
      date,
      earnings: dayMap[date]
    }));
  }, [filteredShifts]);

  // Target Progress Calculation
  const goalProgress = useMemo(() => {
    if (!monthlyGoal || monthlyGoal <= 0) return 0;
    return Math.min(100, Math.round((stats.totalEarnings / monthlyGoal) * 100));
  }, [stats.totalEarnings, monthlyGoal]);

  const isHome = activeTab !== 'companyDetails';
  const selectedComp = companies.find(c => c.id === selectedCompanyId);
  const compShifts = filteredShifts.filter(s => s.companyId === selectedCompanyId);
  const compBreakdown = selectedCompanyId ? stats.companyBreakdown[selectedCompanyId] : null;
  const compEarn = compBreakdown?.earnings || 0;

  // Company-specific Target Goal Progress
  const compGoalProgress = useMemo(() => {
    if (!selectedComp?.monthlyGoal || selectedComp?.monthlyGoal <= 0) return 0;
    return Math.min(100, Math.round((compEarn / selectedComp.monthlyGoal) * 100));
  }, [compEarn, selectedComp]);

  // Strict Monochrome theme helper styles: pure black bg and white text in dark mode; pure white bg and black text in light mode
  const isDark = theme === 'dark';
  const containerClass = isDark ? 'bg-black text-white' : 'bg-white text-black';
  const borderClass = isDark ? 'border-white/30' : 'border-black/30';
  const subtextClass = isDark ? 'text-white/70' : 'text-black/70';
  const inputClass = isDark ? 'bg-black text-white border-white/30 focus:border-white placeholder:text-white/40' : 'bg-white text-black border-black/30 focus:border-black placeholder:text-black/40';
  const primaryBtnClass = isDark ? 'bg-white text-black hover:bg-white/90 active:scale-[0.99]' : 'bg-black text-white hover:bg-black/90 active:scale-[0.99]';
  const outlineBtnClass = isDark ? 'border border-white/40 text-white hover:bg-white hover:text-black' : 'border border-black/40 text-black hover:bg-black hover:text-white';
  const cardClass = isDark ? 'bg-black text-white border border-white/30' : 'bg-white text-black border border-black/30';

  return (
    <div className={`min-h-screen ${containerClass} font-mono select-none relative pb-16 transition-colors duration-200`}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 ${isDark ? 'bg-white text-black' : 'bg-black text-white'} px-4 py-2 text-xs font-bold uppercase tracking-widest animate-fade-in flex items-center gap-2 shadow-2xl border ${borderClass}`}>
          <CheckCircle2 className="w-3.5 h-3.5" /> {toastMessage}
        </div>
      )}

      {isHome ? (
        <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5 animate-fade-in">
          
          {/* Header Banner */}
          <div className={`relative overflow-hidden border ${borderClass} ${isDark ? 'bg-black' : 'bg-white'}`}>
            <img 
              src="/header_black_banner.jpg" 
              alt="PayTrack Header" 
              className={`w-full h-32 sm:h-40 object-cover ${isDark ? 'opacity-85' : 'opacity-20 filter contrast-150 grayscale'}`} 
            />
            <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-t from-black via-black/50 to-transparent' : 'bg-gradient-to-t from-white via-white/80 to-transparent'} flex items-end p-4`}>
              <div className="w-full flex justify-between items-end">
                <div>
                  <span className={`text-[10px] font-bold uppercase tracking-[0.25em] ${isDark ? 'text-white' : 'text-black'}`}>
                    Salary & Shift Calculator
                  </span>
                  <h1 className={`text-xl sm:text-2xl font-black tracking-widest uppercase ${isDark ? 'text-white' : 'text-black'}`}>
                    PAYTRACK LK
                  </h1>
                </div>
                
                {/* Theme & Sound Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleTheme}
                    className={`px-2 py-1 border ${isDark ? 'border-white/40 text-white hover:bg-white hover:text-black' : 'border-black/40 text-black hover:bg-black hover:text-white'} text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition`}
                    title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  >
                    {isDark ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                    <span>{isDark ? 'LIGHT' : 'DARK'}</span>
                  </button>
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`p-1 border ${isDark ? 'border-white/40 text-white hover:bg-white hover:text-black' : 'border-black/40 text-black hover:bg-black hover:text-white'} text-[10px] transition`}
                    title={soundEnabled ? 'Mute Sound FX' : 'Enable Sound FX'}
                  >
                    {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Period Navigation */}
          <div className={`flex flex-wrap justify-between items-center border ${borderClass} p-3 gap-3 ${cardClass}`}>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => stepMonth(-1)}
                className={`p-1.5 border ${borderClass} hover:border-current text-xs`}
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <Calendar className={`w-4 h-4 ${subtextClass}`} />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className={`text-xs px-2.5 py-1.5 focus:outline-none uppercase tracking-wider border ${borderClass} ${inputClass}`}
                >
                  {monthOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => stepMonth(1)}
                className={`p-1.5 border ${borderClass} hover:border-current text-xs`}
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-[10px]">
              <span className={`${subtextClass} uppercase tracking-widest`}>Jump:</span>
              <input
                type="month"
                value={selectedMonth !== 'all' ? selectedMonth : ''}
                onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                className={`text-xs px-2 py-1 focus:outline-none border ${borderClass} ${inputClass}`}
              />
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${subtextClass}`} />
            <input
              type="text"
              placeholder="Search shifts by company, date, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border ${borderClass} pl-9 pr-8 py-2 text-xs focus:outline-none ${inputClass}`}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${subtextClass} hover:text-current text-xs`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Actions Bar */}
          <div className={`flex flex-wrap items-center justify-between gap-2 border ${borderClass} p-2.5 text-[10px] ${cardClass}`}>
            <span className={`font-bold uppercase tracking-widest ${subtextClass} flex items-center gap-1.5`}>
              <Layers className="w-3.5 h-3.5" /> Tools
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleGeneratePayslip()}
                className={`px-2.5 py-1 font-bold uppercase tracking-wider flex items-center gap-1 border ${borderClass} ${primaryBtnClass} transition`}
                title="Generate PDF Statement"
              >
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
              <button
                onClick={handleExportCSV}
                className={`px-2.5 py-1 font-bold uppercase tracking-wider flex items-center gap-1 border ${borderClass} ${outlineBtnClass} transition`}
                title="Export CSV Spreadsheet"
              >
                <FileText className="w-3.5 h-3.5" /> CSV
              </button>
              <button
                onClick={() => window.print()}
                className={`px-2 py-1 font-bold uppercase tracking-wider flex items-center gap-1 border ${borderClass} ${outlineBtnClass} transition`}
                title="Print Statement"
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTaxModalOpen(true)}
                className={`px-2.5 py-1 font-bold uppercase tracking-wider flex items-center gap-1 border ${borderClass} ${outlineBtnClass} transition`}
                title="EPF / ETF / Tax Estimator"
              >
                <Calculator className="w-3.5 h-3.5" /> EPF/Tax
              </button>
              <button
                onClick={() => setBatchModalOpen(true)}
                className={`px-2.5 py-1 font-bold uppercase tracking-wider flex items-center gap-1 border ${borderClass} ${outlineBtnClass} transition`}
                title="Batch Multi-Day Logger"
              >
                <CalendarDays className="w-3.5 h-3.5" /> Batch
              </button>
              <button
                onClick={handleExportData}
                className={`px-2.5 py-1 font-bold uppercase tracking-wider flex items-center gap-1 border ${borderClass} ${outlineBtnClass} transition`}
                title="Export JSON Backup"
              >
                <Download className="w-3.5 h-3.5" /> Backup
              </button>
              <label
                className={`px-2.5 py-1 font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer border ${borderClass} ${outlineBtnClass} transition`}
                title="Import JSON Backup"
              >
                <Upload className="w-3.5 h-3.5" /> Restore
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept=".json" 
                  onChange={handleImportData} 
                  className="hidden" 
                />
              </label>
            </div>
          </div>

          {/* Period Earnings Hero Card */}
          <div className={`text-center py-6 border ${borderClass} ${cardClass} space-y-3`}>
            <p className={`text-xs ${subtextClass} uppercase tracking-widest`}>Total Period Earnings</p>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
              {formatLKR(stats.totalEarnings)}
            </h2>
            <div className={`flex flex-wrap justify-center gap-3 text-[10px] ${subtextClass} uppercase tracking-wider`}>
              <span>{stats.shiftCount} SHIFTS</span>
              {stats.totalHours > 0 && <span>• {stats.totalHours} TOTAL HOURS</span>}
              {stats.totalProducts > 0 && <span>• {stats.totalProducts} PRODUCTS</span>}
              {stats.avgHourlyRate > 0 && <span>• AVG RATE {formatLKR(stats.avgHourlyRate)}/HR</span>}
              {stats.avgDailyEarnings > 0 && <span>• {formatLKR(stats.avgDailyEarnings)}/DAY</span>}
            </div>

            {/* Target Monthly Goal Progress Bar */}
            <div className="pt-2 px-6 max-w-md mx-auto">
              <div className="flex justify-between items-center text-[10px] uppercase tracking-wider mb-1">
                <span className={`flex items-center gap-1 cursor-pointer ${subtextClass} hover:text-current`} onClick={() => setGoalModalOpen(true)}>
                  <Target className="w-3 h-3" /> Goal: <strong className={isDark ? 'text-white' : 'text-black'}>{formatLKR(monthlyGoal)}</strong> ({goalProgress}%)
                </span>
                <button onClick={() => setGoalModalOpen(true)} className="text-[9px] underline font-bold">Set Goal</button>
              </div>
              <div className={`w-full h-1.5 border ${borderClass} overflow-hidden ${isDark ? 'bg-white/10' : 'bg-black/10'}`}>
                <div 
                  className={`h-full ${isDark ? 'bg-white' : 'bg-black'} transition-all duration-300`} 
                  style={{ width: `${goalProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Visual Analytics Chart */}
          <EarningsChart 
            chartDataWorkplaces={chartDataWorkplaces} 
            chartDataDaily={chartDataDaily} 
            theme={theme}
          />

          {/* Company List */}
          <div className="space-y-3">
            <div className={`flex justify-between items-center border-b ${borderClass} pb-2`}>
              <h3 className={`text-[10px] font-bold uppercase tracking-widest ${subtextClass}`}>Your Workplaces ({companies.length})</h3>
              <button 
                onClick={() => { setEditingCompany(null); setCompanyModalOpen(true); }} 
                className="text-[10px] uppercase font-bold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Company
              </button>
            </div>

            {companies.length === 0 ? (
              <p className={`text-xs ${subtextClass} italic text-center py-8`}>No workplaces registered yet. Click "+ Add Company" above.</p>
            ) : (
              companies.map(c => {
                const ce = stats.companyBreakdown[c.id]?.earnings || 0;
                const cycle = getCompanyDateRange(c, selectedMonth);
                const modelBadge = c.paymentModel === 'monthly' ? 'Monthly' : c.paymentModel === 'product' ? 'Product' : 'Hourly';
                
                return (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCompanyId(c.id); setActiveTab('companyDetails'); }}
                    className={`w-full border ${borderClass} p-4 sm:p-5 flex justify-between items-center transition hover:border-current group text-left ${cardClass}`}
                  >
                    <div className="space-y-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold uppercase tracking-widest text-sm truncate">{c.name}</span>
                        <span className={`text-[9px] border ${borderClass} px-1 py-0.2 uppercase ${subtextClass}`}>{modelBadge}</span>
                      </div>
                      <p className={`text-[10px] ${subtextClass} tracking-wider`}>
                        Cycle: {cycle.label}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-extrabold text-sm">{formatLKR(ce)}</span>
                      <ArrowUpRight className={`w-4 h-4 ${subtextClass} group-hover:text-current transition`} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* Company Details View (Drill Down) */
        <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4 animate-slide-up">
          
          {/* Header Row: Back, Title, Actions */}
          <div className={`flex items-center justify-between border-b ${borderClass} pb-3 gap-3`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <button onClick={() => setActiveTab('home')} className={`p-1.5 border ${borderClass} ${outlineBtnClass}`} title="Return to Overview">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <h2 className="text-lg font-bold tracking-widest uppercase truncate">{selectedComp?.name}</h2>
                <span className={`text-[9px] border ${borderClass} px-1 py-0.2 uppercase ${subtextClass}`}>
                  {selectedComp?.paymentModel === 'monthly' ? 'Fixed Monthly' : selectedComp?.paymentModel === 'product' ? 'Per Product' : 'Hourly Rate'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0">
              <button 
                onClick={() => handleGeneratePayslip(selectedComp?.id)} 
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border ${borderClass} ${primaryBtnClass}`}
                title="Download Statement"
              >
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
              <button 
                onClick={() => { setEditingCompany(selectedComp); setCompanyModalOpen(true); }} 
                className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border ${borderClass} ${outlineBtnClass}`}
                title="Edit Rates & Pay Cycle"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* In-Company Month Filter & Pay Cycle Bar */}
          <div className={`flex flex-wrap items-center justify-between gap-2 border ${borderClass} p-2 text-xs ${cardClass}`}>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => stepMonth(-1)}
                className={`p-1 border ${borderClass} hover:border-current text-xs`}
                title="Previous Month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center gap-1.5">
                <Calendar className={`w-3.5 h-3.5 ${subtextClass}`} />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className={`text-[11px] px-2 py-1 focus:outline-none uppercase tracking-wider border ${borderClass} ${inputClass}`}
                >
                  {monthOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => stepMonth(1)}
                className={`p-1 border ${borderClass} hover:border-current text-xs`}
                title="Next Month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className={`text-[10px] ${subtextClass} tracking-wider`}>
              <span>Cycle:</span> {getCompanyDateRange(selectedComp, selectedMonth).label}
            </div>
          </div>

          {/* Earnings & Log Shift Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={`border ${borderClass} p-4 text-center flex flex-col justify-center ${cardClass}`}>
              <p className={`text-[10px] ${subtextClass} uppercase tracking-widest mb-0.5`}>Period Earnings</p>
              <p className="text-2xl font-black">{formatLKR(compEarn)}</p>
              {selectedComp?.paymentModel === 'monthly' && selectedMonth !== 'all' && (
                <p className={`text-[9px] ${subtextClass} mt-1 uppercase`}>
                  (Base: {formatLKR(selectedComp.monthlySalary)} + Extra: {formatLKR(compEarn - (selectedComp.monthlySalary || 0))})
                </p>
              )}
            </div>
            
            <button 
              onClick={() => { setEditingShift(null); setShiftModalOpen(true); }} 
              className={`font-bold text-xs uppercase tracking-widest flex flex-col items-center justify-center p-4 border ${borderClass} ${primaryBtnClass} transition`}
            >
              <Plus className="w-5 h-5 mb-1" />
              <span>{selectedComp?.paymentModel === 'product' ? 'Log Product Work' : selectedComp?.paymentModel === 'monthly' ? 'Log OT / Entry' : 'Log Shift'}</span>
            </button>
          </div>

          {/* Minimalist Company Target Goal Bar */}
          <div className={`border ${borderClass} p-3 space-y-1.5 ${cardClass}`}>
            <div className="flex justify-between items-center text-[10px] uppercase tracking-wider">
              <span className={`flex items-center gap-1.5 ${subtextClass}`}>
                <Target className="w-3 h-3" />
                {selectedComp?.monthlyGoal ? (
                  <span>Target: <strong className={isDark ? 'text-white' : 'text-black'}>{formatLKR(selectedComp.monthlyGoal)}</strong> ({compGoalProgress}%)</span>
                ) : (
                  <span>No monthly target goal set</span>
                )}
              </span>
              <button
                onClick={() => setCompanyGoalModalOpen(true)}
                className="text-[9px] uppercase font-bold underline"
              >
                {selectedComp?.monthlyGoal ? 'Edit Goal' : '+ Set Goal'}
              </button>
            </div>
            {selectedComp?.monthlyGoal > 0 && (
              <div className={`w-full h-1.5 border ${borderClass} overflow-hidden ${isDark ? 'bg-white/10' : 'bg-black/10'}`}>
                <div 
                  className={`h-full ${isDark ? 'bg-white' : 'bg-black'} transition-all duration-300`} 
                  style={{ width: `${compGoalProgress}%` }}
                />
              </div>
            )}
          </div>

          {/* Shifts / Work History List */}
          <div className="pt-1 space-y-2.5">
            <div className={`flex justify-between items-center border-b ${borderClass} pb-2`}>
              <h3 className={`text-[10px] font-bold uppercase tracking-widest ${subtextClass}`}>
                Work History ({compShifts.length} Entries)
              </h3>
              <span className={`text-[9px] ${subtextClass} uppercase`}>
                {getCompanyDateRange(selectedComp, selectedMonth).label}
              </span>
            </div>

            {compShifts.length === 0 ? (
              <p className={`text-xs ${subtextClass} italic text-center py-6`}>No entries recorded in this billing cycle.</p>
            ) : (
              compShifts.map(shift => {
                const isOvernight = isOvernightShift(shift.startTime, shift.endTime);

                return (
                  <div key={shift.id} className={`border ${borderClass} p-3.5 flex justify-between items-center hover:border-current transition ${cardClass}`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold tracking-widest text-xs">{shift.date}</span>
                        {isOvernight && (
                          <span className={`text-[9px] border ${borderClass} px-1 py-0.2 flex items-center gap-0.5`} title="Overnight Shift">
                            <Moon className="w-2.5 h-2.5" /> Overnight
                          </span>
                        )}
                      </div>
                      
                      {shift.paymentModel === 'product' || selectedComp?.paymentModel === 'product' ? (
                        <p className={`text-[10px] ${subtextClass} uppercase tracking-wider`}>
                          {shift.unitsCompleted || 0} Units <span>(@ {formatLKR(shift.unitRate || selectedComp?.productRate || 0)})</span>
                          {shift.bonus > 0 && <span> + Bonus {formatLKR(shift.bonus)}</span>}
                        </p>
                      ) : shift.paymentModel === 'monthly' || selectedComp?.paymentModel === 'monthly' ? (
                        <p className={`text-[10px] ${subtextClass} uppercase tracking-wider`}>
                          {shift.hoursWorked > 0 ? `${shift.hoursWorked} OT Hrs (@ ${formatLKR(shift.hourlyRate || selectedComp?.overtimeHourlyRate || 0)})` : 'Attendance / Shift'}
                          {shift.bonus > 0 && <span> + Bonus {formatLKR(shift.bonus)}</span>}
                        </p>
                      ) : (
                        <p className={`text-[10px] ${subtextClass} uppercase tracking-wider`}>
                          {shift.startTime || '--'} - {shift.endTime || '--'} <span>({shift.hoursWorked} HRS)</span>
                          {shift.bonus > 0 && <span> + Bonus {formatLKR(shift.bonus)}</span>}
                        </p>
                      )}
                      {shift.notes && <p className={`text-[9px] ${subtextClass} italic`}>{shift.notes}</p>}
                    </div>
                    
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="text-right text-sm font-black tracking-widest">
                        {formatLKR(shift.earnings)}
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => handleDuplicateShift(shift)}
                          className={`text-[9px] uppercase tracking-widest border ${borderClass} px-1.5 py-0.5 ${outlineBtnClass} transition`}
                          title="Clone Shift"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={() => { setEditingShift(shift); setShiftModalOpen(true); }} 
                          className={`text-[9px] uppercase tracking-widest border ${borderClass} px-2 py-0.5 ${outlineBtnClass} transition`}
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => setDeleteConfirm({ type: 'shift', id: shift.id, title: `shift on ${shift.date}` })} 
                          className={`text-[9px] uppercase tracking-widest border ${borderClass} px-2 py-0.5 ${outlineBtnClass} transition`}
                        >
                          Del
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Shift Logging Modal */}
      {shiftModalOpen && (
        <ShiftModal
          isOpen={shiftModalOpen}
          onClose={() => setShiftModalOpen(false)}
          onSave={handleSaveShift}
          companies={companies}
          editingShift={editingShift}
          preSelectedCompanyId={activeTab === 'companyDetails' ? selectedCompanyId : null}
          getEffectiveRate={getEffectiveRate}
          theme={theme}
        />
      )}

      {/* Company Configuration Modal */}
      {companyModalOpen && (
        <CompanyModal
          isOpen={companyModalOpen}
          onClose={() => setCompanyModalOpen(false)}
          onSave={handleSaveCompany}
          editingCompany={editingCompany}
          theme={theme}
        />
      )}

      {/* Batch Shift Modal */}
      {batchModalOpen && (
        <BatchModal
          isOpen={batchModalOpen}
          onClose={() => setBatchModalOpen(false)}
          companies={companies}
          onSaveBatch={handleBatchLogShifts}
          theme={theme}
        />
      )}

      {/* Monthly Goal Modal */}
      {goalModalOpen && (
        <GoalModal
          isOpen={goalModalOpen}
          onClose={() => setGoalModalOpen(false)}
          currentGoal={monthlyGoal}
          onSaveGoal={(val) => {
            setMonthlyGoal(val);
            setGoalModalOpen(false);
            showToast('Monthly target goal updated');
          }}
          theme={theme}
        />
      )}

      {/* Company Monthly Goal Modal */}
      {companyGoalModalOpen && (
        <GoalModal
          isOpen={companyGoalModalOpen}
          onClose={() => setCompanyGoalModalOpen(false)}
          title={`Target Goal: ${selectedComp?.name}`}
          subtitle={`Set monthly target earnings for ${selectedComp?.name}:`}
          currentGoal={selectedComp?.monthlyGoal || 50000}
          onSaveGoal={(val) => {
            handleSaveCompanyGoal(selectedComp?.id, val);
            setCompanyGoalModalOpen(false);
          }}
          theme={theme}
        />
      )}

      {/* EPF / ETF / Tax Estimator Modal */}
      {taxModalOpen && (
        <TaxEstimatorModal
          isOpen={taxModalOpen}
          onClose={() => setTaxModalOpen(false)}
          totalGrossEarnings={stats.totalEarnings}
          theme={theme}
        />
      )}

      {/* Promotion / Rate History Modal */}
      {rateModalCompany && (
        <PromotionModal
          company={rateModalCompany}
          onClose={() => setRateModalCompany(null)}
          onAdd={(rev) => {
            handleAddRateRevision(rateModalCompany.id, rev);
            setRateModalCompany(null);
          }}
          theme={theme}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className={`fixed inset-0 z-50 ${isDark ? 'bg-black/90' : 'bg-black/40'} backdrop-blur-sm flex items-center justify-center p-4`}>
          <div className={`border ${borderClass} ${cardClass} max-w-sm w-full p-5 space-y-4 shadow-2xl`}>
            <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Confirm Deletion
            </h3>
            <p className={`text-xs ${subtextClass}`}>
              Are you sure you want to delete <strong>{deleteConfirm.title}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setDeleteConfirm(null)}
                className={`border ${borderClass} ${outlineBtnClass} px-3 py-1.5 text-xs font-bold uppercase tracking-widest`}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className={`border ${borderClass} ${primaryBtnClass} px-3 py-1.5 text-xs font-bold uppercase tracking-widest`}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Recharts Visual Analytics Component in Pure Monochrome
function EarningsChart({ chartDataWorkplaces, chartDataDaily, theme }) {
  const [chartMode, setChartMode] = useState('workplaces');
  const currentData = chartMode === 'workplaces' ? chartDataWorkplaces : chartDataDaily;
  const hasData = currentData && currentData.length > 0 && currentData.some(d => d.earnings > 0);
  const isDark = theme === 'dark';
  const borderClass = isDark ? 'border-white/30' : 'border-black/30';
  const subtextClass = isDark ? 'text-white/70' : 'text-black/70';

  return (
    <div className={`border ${borderClass} p-4 sm:p-5 space-y-3 ${isDark ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <div className={`flex justify-between items-center border-b ${borderClass} pb-2`}>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          <h3 className="text-xs font-bold uppercase tracking-widest">Visual Breakdown</h3>
        </div>
        <div className={`flex gap-1 border ${borderClass} p-0.5 text-[10px]`}>
          <button
            onClick={() => setChartMode('workplaces')}
            className={`px-2 py-0.5 uppercase font-bold tracking-wider transition ${chartMode === 'workplaces' ? (isDark ? 'bg-white text-black' : 'bg-black text-white') : subtextClass}`}
          >
            Workplaces
          </button>
          <button
            onClick={() => setChartMode('daily')}
            className={`px-2 py-0.5 uppercase font-bold tracking-wider transition ${chartMode === 'daily' ? (isDark ? 'bg-white text-black' : 'bg-black text-white') : subtextClass}`}
          >
            Daily
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className={`h-40 flex items-center justify-center text-xs ${subtextClass} italic`}>
          No earnings recorded for this period yet.
        </div>
      ) : (
        <div className="h-44 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <XAxis 
                dataKey={chartMode === 'workplaces' ? 'name' : 'date'} 
                stroke={isDark ? '#ffffff' : '#000000'} 
                fontSize={10} 
                tickLine={false}
                tickFormatter={(val) => chartMode === 'workplaces' && val && val.length > 10 ? val.slice(0, 9) + '…' : val}
              />
              <YAxis 
                stroke={isDark ? '#ffffff' : '#000000'} 
                fontSize={10} 
                tickLine={false}
                tickFormatter={(val) => `Rs.${val >= 1000 ? Math.round(val / 1000) + 'k' : val}`}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className={`border ${isDark ? 'border-white bg-black text-white' : 'border-black bg-white text-black'} p-2 text-xs shadow-2xl space-y-0.5`}>
                        <p className="font-bold uppercase tracking-wider">{label}</p>
                        <p className="font-black text-sm">{formatLKR(payload[0].value)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="earnings" 
                fill={isDark ? '#ffffff' : '#000000'} 
                radius={[1, 1, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// Modal for logging shifts / product work / overtime
function ShiftModal({ isOpen, onClose, onSave, companies, editingShift, getEffectiveRate, preSelectedCompanyId, theme }) {
  const [companyId, setCompanyId] = useState(editingShift?.companyId || preSelectedCompanyId || companies[0]?.id || '');
  const [date, setDate] = useState(editingShift?.date || new Date().toISOString().slice(0, 10));
  
  const [startTime, setStartTime] = useState(editingShift?.startTime || '09:00');
  const [endTime, setEndTime] = useState(editingShift?.endTime || '17:00');
  const [breakMinutes, setBreakMinutes] = useState(editingShift?.breakMinutes !== undefined && editingShift?.breakMinutes !== null ? editingShift.breakMinutes : '');
  const [isFixedHours, setIsFixedHours] = useState(editingShift?.isFixedHours || false);
  const [fixedHours, setFixedHours] = useState(editingShift?.fixedHours || '8');
  
  const [otMultiplier, setOtMultiplier] = useState(1.0);

  const [unitsCompleted, setUnitsCompleted] = useState(editingShift?.unitsCompleted || '');
  const [unitRate, setUnitRate] = useState(editingShift?.unitRate || '');

  const [otHours, setOtHours] = useState(editingShift?.hoursWorked || '');
  const [bonus, setBonus] = useState(editingShift?.bonus || '');
  const [notes, setNotes] = useState(editingShift?.notes || '');

  const selectedCompany = companies.find(c => c.id === companyId);
  const paymentModel = selectedCompany?.paymentModel || 'hourly';

  useEffect(() => {
    if (paymentModel === 'product' && !unitRate && selectedCompany?.productRate) {
      setUnitRate(selectedCompany.productRate);
    }
  }, [paymentModel, selectedCompany, unitRate]);

  const autoHourlyRate = useMemo(() => {
    return getEffectiveRate(selectedCompany, date);
  }, [selectedCompany, date, getEffectiveRate]);

  const effectiveHourlyRate = autoHourlyRate * otMultiplier;

  const calculatedHours = isFixedHours 
    ? Number(fixedHours || 0) 
    : calculateHours(startTime, endTime, breakMinutes);

  let estimatedEarnings = 0;
  if (paymentModel === 'product') {
    const rateToUse = Number(unitRate || selectedCompany?.productRate || 0);
    estimatedEarnings = (Number(unitsCompleted || 0) * rateToUse) + Number(bonus || 0);
  } else if (paymentModel === 'monthly') {
    const otRateToUse = Number(selectedCompany?.overtimeHourlyRate || 0);
    estimatedEarnings = (Number(otHours || 0) * otRateToUse) + Number(bonus || 0);
  } else {
    estimatedEarnings = (calculatedHours * effectiveHourlyRate) + Number(bonus || 0);
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!companyId) return;

    if (paymentModel === 'product') {
      onSave({
        companyId,
        date,
        paymentModel: 'product',
        unitsCompleted: Number(unitsCompleted || 0),
        unitRate: Number(unitRate || selectedCompany?.productRate || 0),
        bonus: Number(bonus || 0),
        notes
      });
    } else if (paymentModel === 'monthly') {
      onSave({
        companyId,
        date,
        paymentModel: 'monthly',
        hoursWorked: Number(otHours || 0),
        hourlyRate: Number(selectedCompany?.overtimeHourlyRate || 0),
        bonus: Number(bonus || 0),
        notes
      });
    } else {
      onSave({
        companyId,
        date,
        paymentModel: 'hourly',
        startTime,
        endTime,
        breakMinutes: Number(breakMinutes || 0),
        bonus: Number(bonus || 0),
        notes,
        manualRate: otMultiplier !== 1.0,
        hourlyRate: effectiveHourlyRate,
        isFixedHours,
        fixedHours
      });
    }
  };

  const isOvernight = isOvernightShift(startTime, endTime);
  const exceedsDailySafety = calculatedHours > 14;

  const isDark = theme === 'dark';
  const borderClass = isDark ? 'border-white/30' : 'border-black/30';
  const subtextClass = isDark ? 'text-white/70' : 'text-black/70';
  const inputClass = isDark ? 'bg-black text-white border-white/30 focus:border-white placeholder:text-white/40' : 'bg-white text-black border-black/30 focus:border-black placeholder:text-black/40';
  const primaryBtnClass = isDark ? 'bg-white text-black hover:bg-white/90 active:scale-[0.99]' : 'bg-black text-white hover:bg-black/90 active:scale-[0.99]';
  const outlineBtnClass = isDark ? 'border border-white/40 text-white hover:bg-white hover:text-black' : 'border border-black/40 text-black hover:bg-black hover:text-white';
  const cardClass = isDark ? 'bg-black text-white border border-white/30' : 'bg-white text-black border border-black/30';

  return (
    <div className={`fixed inset-0 z-50 ${isDark ? 'bg-black/90' : 'bg-black/40'} backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto`}>
      <div className={`border ${borderClass} ${cardClass} max-w-md w-full p-6 space-y-4 shadow-2xl`}>
        <div className={`flex justify-between items-center border-b ${borderClass} pb-3`}>
          <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {editingShift ? 'Edit Work Log' : 'Log Work Entry'}
          </h3>
          <button onClick={onClose} className={`${subtextClass} hover:text-current`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          
          {!preSelectedCompanyId && (
            <div>
              <label className={`block text-[10px] uppercase font-bold ${subtextClass} tracking-wider mb-1`}>Company / Employer</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className={`w-full border px-3 py-2 uppercase tracking-widest ${inputClass}`}
                required
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name.toUpperCase()} ({c.paymentModel || 'Hourly'})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={`block text-[10px] uppercase font-bold ${subtextClass} tracking-wider mb-1`}>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`w-full border px-3 py-2 tracking-widest ${inputClass}`}
              required
            />
          </div>

          {paymentModel === 'product' ? (
            <div className={`border ${borderClass} p-3 space-y-2.5`}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                <Package className="w-3.5 h-3.5" /> Output Units
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-[10px] uppercase font-bold ${subtextClass} mb-1`}>Units Completed</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 25"
                    value={unitsCompleted}
                    onChange={(e) => setUnitsCompleted(e.target.value)}
                    className={`w-full border px-3 py-2 ${inputClass}`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-[10px] uppercase font-bold ${subtextClass} mb-1`}>Rate / Unit (LKR)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder={selectedCompany?.productRate || '0.00'}
                    value={unitRate}
                    onChange={(e) => setUnitRate(e.target.value)}
                    className={`w-full border px-3 py-2 ${inputClass}`}
                  />
                </div>
              </div>
            </div>
          ) : paymentModel === 'monthly' ? (
            <div className={`border ${borderClass} p-3 space-y-2.5`}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                <CalendarDays className="w-3.5 h-3.5" /> Monthly Salary Overtime
              </div>
              <p className={`text-[10px] ${subtextClass}`}>
                Base salary ({formatLKR(selectedCompany?.monthlySalary)}) is automatically included. Log optional overtime hours or bonuses below:
              </p>
              <div>
                <label className={`block text-[10px] uppercase font-bold ${subtextClass} mb-1`}>Overtime Hours (Optional)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 2.5"
                  value={otHours}
                  onChange={(e) => setOtHours(e.target.value)}
                  className={`w-full border px-3 py-2 ${inputClass}`}
                />
              </div>
            </div>
          ) : (
            <div className={`border ${borderClass} p-3 space-y-2.5`}>
              <div className="flex justify-between items-center mb-1">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider cursor-pointer">
                    <input type="radio" checked={!isFixedHours} onChange={() => setIsFixedHours(false)} />
                    Clock Time
                  </label>
                  <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider cursor-pointer">
                    <input type="radio" checked={isFixedHours} onChange={() => setIsFixedHours(true)} />
                    Fixed Hours
                  </label>
                </div>
                {isOvernight && (
                  <span className="text-[9px] flex items-center gap-1 font-bold">
                    <Moon className="w-3 h-3" /> Overnight (+24h)
                  </span>
                )}
              </div>

              {!isFixedHours ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-[10px] uppercase font-bold ${subtextClass} mb-1`}>Start Time</label>
                      <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={`w-full border px-3 py-2 ${inputClass}`} required={!isFixedHours} />
                    </div>
                    <div>
                      <label className={`block text-[10px] uppercase font-bold ${subtextClass} mb-1`}>End Time</label>
                      <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={`w-full border px-3 py-2 ${inputClass}`} required={!isFixedHours} />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-[10px] uppercase font-bold ${subtextClass} mb-1`}>Unpaid Break (Minutes - Default: 0)</label>
                    <input 
                      type="number" 
                      min="0" 
                      placeholder="0" 
                      value={breakMinutes} 
                      onChange={(e) => setBreakMinutes(e.target.value)} 
                      className={`w-full border px-3 py-2 ${inputClass}`} 
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className={`block text-[10px] uppercase font-bold ${subtextClass} mb-1`}>Total Paid Hours</label>
                  <input type="number" step="any" min="0" placeholder="e.g. 8" value={fixedHours} onChange={(e) => setFixedHours(e.target.value)} className={`w-full border px-3 py-2 ${inputClass}`} required={isFixedHours} />
                </div>
              )}

              <div className={`pt-1 flex items-center justify-between border-t ${borderClass}`}>
                <span className={`text-[10px] uppercase ${subtextClass}`}>Multiplier:</span>
                <div className="flex gap-1 text-[9px]">
                  {[1.0, 1.5, 2.0].map(mult => (
                    <button
                      key={mult}
                      type="button"
                      onClick={() => setOtMultiplier(mult)}
                      className={`px-2 py-0.5 border ${otMultiplier === mult ? (isDark ? 'bg-white text-black font-bold' : 'bg-black text-white font-bold') : borderClass}`}
                    >
                      {mult}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {exceedsDailySafety && (
            <div className={`border ${borderClass} p-2 text-[10px] flex items-center gap-1.5`}>
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Shift duration is high ({calculatedHours} hrs). Check start/end time.</span>
            </div>
          )}

          <div>
            <label className={`block text-[10px] uppercase font-bold ${subtextClass} tracking-wider mb-1`}>Extra Bonus (LKR)</label>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="0.00"
              value={bonus}
              onChange={(e) => setBonus(e.target.value)}
              className={`w-full border px-3 py-2 ${inputClass}`}
            />
          </div>

          <div>
            <label className={`block text-[10px] uppercase font-bold ${subtextClass} tracking-wider mb-1`}>Notes / Remarks</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Extra task, Sunday duty, Client delivery"
              className={`w-full border px-3 py-2 ${inputClass}`}
            />
          </div>

          {/* Live Preview Box */}
          <div className={`border ${borderClass} p-3 flex justify-between items-center ${cardClass}`}>
            <div>
              {paymentModel === 'product' ? (
                <>
                  <p className={`text-[10px] ${subtextClass} uppercase tracking-widest`}>{unitsCompleted || 0} UNITS</p>
                  <p className={`text-[9px] ${subtextClass} uppercase`}>RATE: {formatLKR(unitRate || selectedCompany?.productRate || 0)}/UNIT</p>
                </>
              ) : paymentModel === 'monthly' ? (
                <>
                  <p className={`text-[10px] ${subtextClass} uppercase tracking-widest`}>{otHours || 0} OT HOURS</p>
                  <p className={`text-[9px] ${subtextClass} uppercase`}>OT RATE: {formatLKR(selectedCompany?.overtimeHourlyRate || 0)}/HR</p>
                </>
              ) : (
                <>
                  <p className={`text-[10px] ${subtextClass} uppercase tracking-widest`}>{calculatedHours} HRS WORKED</p>
                  <p className={`text-[9px] ${subtextClass} uppercase`}>RATE: {formatLKR(effectiveHourlyRate)}/HR</p>
                </>
              )}
            </div>
            <div className="text-right">
              <p className={`text-[9px] ${subtextClass} uppercase`}>ESTIMATED LOG TOTAL</p>
              <p className="text-base font-black tracking-widest">{formatLKR(estimatedEarnings)}</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className={`border ${borderClass} ${outlineBtnClass} px-3.5 py-1.5 font-bold uppercase text-[10px] tracking-widest`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`border ${borderClass} ${primaryBtnClass} px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest transition`}
            >
              Save Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal for configuring Company, Payment Model, Rates, and Custom Pay Cycle
function CompanyModal({ isOpen, onClose, onSave, editingCompany, theme }) {
  const [name, setName] = useState(editingCompany?.name || '');
  const [paymentModel, setPaymentModel] = useState(editingCompany?.paymentModel || 'hourly');
  
  const [defaultRate, setDefaultRate] = useState(editingCompany?.defaultRate ?? 1000.00);
  const [sunRate, setSunRate] = useState(editingCompany?.dayRates?.[0] ?? '');
  const [satRate, setSatRate] = useState(editingCompany?.dayRates?.[6] ?? '');

  const [monthlySalary, setMonthlySalary] = useState(editingCompany?.monthlySalary ?? 50000.00);
  const [overtimeHourlyRate, setOvertimeHourlyRate] = useState(editingCompany?.overtimeHourlyRate ?? '');

  const [productRate, setProductRate] = useState(editingCompany?.productRate ?? 250.00);
  const [payCycleStartDay, setPayCycleStartDay] = useState(editingCompany?.payCycleStartDay ?? 1);

  const [notes, setNotes] = useState(editingCompany?.notes || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name) return;

    const dayRates = {};
    if (sunRate !== '') dayRates[0] = Number(sunRate);
    if (satRate !== '') dayRates[6] = Number(satRate);

    onSave({
      name,
      paymentModel,
      defaultRate: Number(defaultRate || 0),
      dayRates,
      monthlySalary: Number(monthlySalary || 0),
      overtimeHourlyRate: Number(overtimeHourlyRate || 0),
      productRate: Number(productRate || 0),
      payCycleStartDay: Math.max(1, Math.min(31, Number(payCycleStartDay || 1))),
      notes
    });
  };

  const isDark = theme === 'dark';
  const borderClass = isDark ? 'border-white/30' : 'border-black/30';
  const subtextClass = isDark ? 'text-white/70' : 'text-black/70';
  const inputClass = isDark ? 'bg-black text-white border-white/30 focus:border-white placeholder:text-white/40' : 'bg-white text-black border-black/30 focus:border-black placeholder:text-black/40';
  const primaryBtnClass = isDark ? 'bg-white text-black hover:bg-white/90 active:scale-[0.99]' : 'bg-black text-white hover:bg-black/90 active:scale-[0.99]';
  const outlineBtnClass = isDark ? 'border border-white/40 text-white hover:bg-white hover:text-black' : 'border border-black/40 text-black hover:bg-black hover:text-white';
  const cardClass = isDark ? 'bg-black text-white border border-white/30' : 'bg-white text-black border border-black/30';

  return (
    <div className={`fixed inset-0 z-50 ${isDark ? 'bg-black/90' : 'bg-black/40'} backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto`}>
      <div className={`border ${borderClass} ${cardClass} max-w-md w-full p-6 space-y-4 shadow-2xl`}>
        <div className={`flex justify-between items-center border-b ${borderClass} pb-3`}>
          <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            {editingCompany ? 'Edit Employer / Client' : 'Add Employer / Client'}
          </h3>
          <button onClick={onClose} className={`${subtextClass} hover:text-current`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className={`block text-[10px] uppercase font-bold ${subtextClass} tracking-wider mb-1`}>Company Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Tech Lanka"
              className={`w-full border px-3 py-2 uppercase tracking-widest ${inputClass}`}
              required
            />
          </div>

          <div>
            <label className={`block text-[10px] uppercase font-bold ${subtextClass} tracking-wider mb-1`}>Payment Model</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentModel('hourly')}
                className={`py-1.5 px-2 border text-[10px] uppercase font-bold tracking-wider transition ${paymentModel === 'hourly' ? (isDark ? 'bg-white text-black' : 'bg-black text-white') : borderClass}`}
              >
                Hourly
              </button>
              <button
                type="button"
                onClick={() => setPaymentModel('monthly')}
                className={`py-1.5 px-2 border text-[10px] uppercase font-bold tracking-wider transition ${paymentModel === 'monthly' ? (isDark ? 'bg-white text-black' : 'bg-black text-white') : borderClass}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setPaymentModel('product')}
                className={`py-1.5 px-2 border text-[10px] uppercase font-bold tracking-wider transition ${paymentModel === 'product' ? (isDark ? 'bg-white text-black' : 'bg-black text-white') : borderClass}`}
              >
                Product
              </button>
            </div>
          </div>

          {paymentModel === 'hourly' && (
            <div className={`space-y-3 border ${borderClass} p-3`}>
              <div>
                <label className={`block text-[10px] uppercase font-bold ${subtextClass} tracking-wider mb-1`}>Standard Hourly Rate (LKR / hr)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={defaultRate}
                  onChange={(e) => setDefaultRate(e.target.value)}
                  className={`w-full border px-3 py-2 ${inputClass}`}
                  required
                />
              </div>

              <div className={`border-t ${borderClass} pt-2 space-y-2`}>
                <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" /> Weekend Overrides (Optional)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[9px] uppercase ${subtextClass} mb-1`}>Saturday Rate (LKR)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder={`Default (${defaultRate})`}
                      value={satRate}
                      onChange={(e) => setSatRate(e.target.value)}
                      className={`w-full border px-3 py-1.5 text-xs ${inputClass}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[9px] uppercase ${subtextClass} mb-1`}>Sunday Rate (LKR)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder={`Default (${defaultRate})`}
                      value={sunRate}
                      onChange={(e) => setSunRate(e.target.value)}
                      className={`w-full border px-3 py-1.5 text-xs ${inputClass}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {paymentModel === 'monthly' && (
            <div className={`space-y-3 border ${borderClass} p-3`}>
              <div>
                <label className={`block text-[10px] uppercase font-bold ${subtextClass} tracking-wider mb-1`}>Fixed Monthly Salary (LKR / month)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={monthlySalary}
                  onChange={(e) => setMonthlySalary(e.target.value)}
                  className={`w-full border px-3 py-2 ${inputClass}`}
                  required
                />
              </div>
              <div>
                <label className={`block text-[10px] uppercase font-bold ${subtextClass} tracking-wider mb-1`}>Overtime Rate (LKR / hr - Optional)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 350.00"
                  value={overtimeHourlyRate}
                  onChange={(e) => setOvertimeHourlyRate(e.target.value)}
                  className={`w-full border px-3 py-2 ${inputClass}`}
                />
              </div>
            </div>
          )}

          {paymentModel === 'product' && (
            <div className={`space-y-3 border ${borderClass} p-3`}>
              <div>
                <label className={`block text-[10px] uppercase font-bold ${subtextClass} tracking-wider mb-1`}>Standard Rate Per Product (LKR)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={productRate}
                  onChange={(e) => setProductRate(e.target.value)}
                  placeholder="e.g. 250.00"
                  className={`w-full border px-3 py-2 ${inputClass}`}
                  required
                />
              </div>
            </div>
          )}

          <div className={`border ${borderClass} p-3 space-y-1.5`}>
            <label className="block text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Pay Cycle Start Day of Month
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="31"
                value={payCycleStartDay}
                onChange={(e) => setPayCycleStartDay(e.target.value)}
                className={`w-20 border px-3 py-1.5 font-bold ${inputClass}`}
                required
              />
              <span className={`text-[10px] ${subtextClass} uppercase`}>
                {payCycleStartDay == 1 ? 'Standard (1st to Month End)' : `Starts day ${payCycleStartDay} to ${payCycleStartDay - 1}`}
              </span>
            </div>
          </div>

          <div>
            <label className={`block text-[10px] uppercase font-bold ${subtextClass} tracking-wider mb-1`}>Notes / Role Title</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Senior Developer / Freelance Consultant"
              className={`w-full border px-3 py-2 ${inputClass}`}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className={`border ${borderClass} ${outlineBtnClass} px-3.5 py-1.5 font-bold uppercase text-[10px] tracking-widest`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`border ${borderClass} ${primaryBtnClass} px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest transition`}
            >
              Save Company
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal for Batch Multi-Day Shift Logging
function BatchModal({ isOpen, onClose, companies, onSaveBatch, theme }) {
  const [companyId, setCompanyId] = useState(companies[0]?.id || '');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [breakMinutes, setBreakMinutes] = useState('');
  const [bonus, setBonus] = useState('');
  const [notes, setNotes] = useState('Batch shift');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!companyId || !startDate || !endDate) return;
    onSaveBatch({
      companyId,
      startDate,
      endDate,
      startTime,
      endTime,
      breakMinutes,
      bonus,
      notes
    });
  };

  const isDark = theme === 'dark';
  const borderClass = isDark ? 'border-white/30' : 'border-black/30';
  const subtextClass = isDark ? 'text-white/70' : 'text-black/70';
  const inputClass = isDark ? 'bg-black text-white border-white/30 focus:border-white placeholder:text-white/40' : 'bg-white text-black border-black/30 focus:border-black placeholder:text-black/40';
  const primaryBtnClass = isDark ? 'bg-white text-black hover:bg-white/90 active:scale-[0.99]' : 'bg-black text-white hover:bg-black/90 active:scale-[0.99]';
  const outlineBtnClass = isDark ? 'border border-white/40 text-white hover:bg-white hover:text-black' : 'border border-black/40 text-black hover:bg-black hover:text-white';
  const cardClass = isDark ? 'bg-black text-white border border-white/30' : 'bg-white text-black border border-black/30';

  return (
    <div className={`fixed inset-0 z-50 ${isDark ? 'bg-black/90' : 'bg-black/40'} backdrop-blur-sm flex items-center justify-center p-4`}>
      <div className={`border ${borderClass} ${cardClass} max-w-md w-full p-5 space-y-3.5 shadow-2xl`}>
        <div className={`flex justify-between items-center border-b ${borderClass} pb-2.5`}>
          <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Batch Log Shifts
          </h3>
          <button onClick={onClose} className={`${subtextClass} hover:text-current`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className={`block text-[10px] uppercase font-bold ${subtextClass} mb-1`}>Company</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className={`w-full border px-3 py-1.5 uppercase tracking-wider ${inputClass}`}
              required
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-[10px] uppercase font-bold ${subtextClass} mb-1`}>Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`w-full border px-3 py-1.5 ${inputClass}`} required />
            </div>
            <div>
              <label className={`block text-[10px] uppercase font-bold ${subtextClass} mb-1`}>End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`w-full border px-3 py-1.5 ${inputClass}`} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-[10px] uppercase font-bold ${subtextClass} mb-1`}>Start Time</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={`w-full border px-3 py-1.5 ${inputClass}`} required />
            </div>
            <div>
              <label className={`block text-[10px] uppercase font-bold ${subtextClass} mb-1`}>End Time</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={`w-full border px-3 py-1.5 ${inputClass}`} required />
            </div>
          </div>

          <div>
            <label className={`block text-[10px] uppercase font-bold ${subtextClass} mb-1`}>Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={`w-full border px-3 py-1.5 ${inputClass}`} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={`border ${borderClass} ${outlineBtnClass} px-3 py-1.5 uppercase font-bold text-[10px]`}>Cancel</button>
            <button type="submit" className={`border ${borderClass} ${primaryBtnClass} px-4 py-1.5 uppercase font-bold text-[10px]`}>Log All Days</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal for setting Monthly Target Goal
function GoalModal({ isOpen, onClose, currentGoal, onSaveGoal, title = 'Set Monthly Target Goal', subtitle = 'Enter your income goal in LKR for tracking progress:', theme }) {
  const [val, setVal] = useState(currentGoal);
  const isDark = theme === 'dark';
  const borderClass = isDark ? 'border-white/30' : 'border-black/30';
  const subtextClass = isDark ? 'text-white/70' : 'text-black/70';
  const inputClass = isDark ? 'bg-black text-white border-white/30 focus:border-white placeholder:text-white/40' : 'bg-white text-black border-black/30 focus:border-black placeholder:text-black/40';
  const primaryBtnClass = isDark ? 'bg-white text-black hover:bg-white/90 active:scale-[0.99]' : 'bg-black text-white hover:bg-black/90 active:scale-[0.99]';
  const outlineBtnClass = isDark ? 'border border-white/40 text-white hover:bg-white hover:text-black' : 'border border-black/40 text-black hover:bg-black hover:text-white';
  const cardClass = isDark ? 'bg-black text-white border border-white/30' : 'bg-white text-black border border-black/30';

  return (
    <div className={`fixed inset-0 z-50 ${isDark ? 'bg-black/90' : 'bg-black/40'} backdrop-blur-sm flex items-center justify-center p-4`}>
      <div className={`border ${borderClass} ${cardClass} max-w-sm w-full p-5 space-y-3.5 shadow-2xl`}>
        <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
          <Target className="w-4 h-4" /> {title}
        </h3>
        <p className={`text-[10px] ${subtextClass}`}>
          {subtitle}
        </p>
        <input
          type="number"
          min="1000"
          step="5000"
          value={val}
          onChange={(e) => setVal(Number(e.target.value))}
          className={`w-full border p-2.5 text-base font-black focus:outline-none ${inputClass}`}
        />
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className={`border ${borderClass} ${outlineBtnClass} px-3 py-1.5 uppercase font-bold text-[10px]`}>Cancel</button>
          <button onClick={() => onSaveGoal(val)} className={`border ${borderClass} ${primaryBtnClass} px-4 py-1.5 uppercase font-bold text-[10px]`}>Set Goal</button>
        </div>
      </div>
    </div>
  );
}

// Modal for EPF / ETF & Sri Lankan APIT Estimations
function TaxEstimatorModal({ isOpen, onClose, totalGrossEarnings, theme }) {
  const epfEmployee = totalGrossEarnings * 0.08;
  const epfEmployer = totalGrossEarnings * 0.12;
  const etfEmployer = totalGrossEarnings * 0.03;
  const netAfterEpf = totalGrossEarnings - epfEmployee;

  let apitEstimate = 0;
  if (totalGrossEarnings > 100000) {
    const taxable = totalGrossEarnings - 100000;
    if (taxable <= 41666) apitEstimate = taxable * 0.06;
    else if (taxable <= 83333) apitEstimate = 41666 * 0.06 + (taxable - 41666) * 0.12;
    else apitEstimate = 41666 * 0.06 + 41667 * 0.12 + (taxable - 83333) * 0.18;
  }

  const isDark = theme === 'dark';
  const borderClass = isDark ? 'border-white/30' : 'border-black/30';
  const subtextClass = isDark ? 'text-white/70' : 'text-black/70';
  const primaryBtnClass = isDark ? 'bg-white text-black hover:bg-white/90 active:scale-[0.99]' : 'bg-black text-white hover:bg-black/90 active:scale-[0.99]';
  const cardClass = isDark ? 'bg-black text-white border border-white/30' : 'bg-white text-black border border-black/30';

  return (
    <div className={`fixed inset-0 z-50 ${isDark ? 'bg-black/90' : 'bg-black/40'} backdrop-blur-sm flex items-center justify-center p-4`}>
      <div className={`border ${borderClass} ${cardClass} max-w-md w-full p-5 space-y-3.5 shadow-2xl`}>
        <div className={`flex justify-between items-center border-b ${borderClass} pb-2.5`}>
          <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <Calculator className="w-4 h-4" /> Sri Lanka EPF / ETF & Tax Estimator
          </h3>
          <button onClick={onClose} className={`${subtextClass} hover:text-current`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className={`flex justify-between border-b ${borderClass} pb-2`}>
            <span className={`${subtextClass} uppercase`}>Gross Period Earnings:</span>
            <span className="font-bold">{formatLKR(totalGrossEarnings)}</span>
          </div>

          <div className={`border ${borderClass} p-3 space-y-2`}>
            <p className="text-[10px] font-bold uppercase tracking-wider">Statutory Deductions (Estimates)</p>
            <div className="flex justify-between text-[11px]">
              <span className={subtextClass}>Employee EPF (8%):</span>
              <span className="font-mono">-{formatLKR(epfEmployee)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className={subtextClass}>Employer EPF (12%):</span>
              <span className="font-mono">+{formatLKR(epfEmployer)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className={subtextClass}>Employer ETF (3%):</span>
              <span className="font-mono">+{formatLKR(etfEmployer)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className={subtextClass}>Est. APIT Tax:</span>
              <span className="font-mono">-{formatLKR(apitEstimate)}</span>
            </div>
          </div>

          <div className={`border ${borderClass} p-3 flex justify-between items-center ${cardClass}`}>
            <div>
              <p className={`text-[10px] ${subtextClass} uppercase`}>Estimated Take-Home (Net)</p>
              <p className={`text-[9px] ${subtextClass} uppercase`}>After 8% EPF & APIT</p>
            </div>
            <p className="text-base font-black">{formatLKR(netAfterEpf - apitEstimate)}</p>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button onClick={onClose} className={`border ${borderClass} ${primaryBtnClass} px-4 py-1.5 uppercase font-bold text-[10px]`}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal for adding salary promotion / raises over time
function PromotionModal({ company, onClose, onAdd, theme }) {
  const [rate, setRate] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!rate || !startDate) return;
    onAdd({
      rate: Number(rate),
      startDate,
      note
    });
  };

  const isDark = theme === 'dark';
  const borderClass = isDark ? 'border-white/30' : 'border-black/30';
  const subtextClass = isDark ? 'text-white/70' : 'text-black/70';
  const inputClass = isDark ? 'bg-black text-white border-white/30 focus:border-white placeholder:text-white/40' : 'bg-white text-black border-black/30 focus:border-black placeholder:text-black/40';
  const primaryBtnClass = isDark ? 'bg-white text-black hover:bg-white/90 active:scale-[0.99]' : 'bg-black text-white hover:bg-black/90 active:scale-[0.99]';
  const outlineBtnClass = isDark ? 'border border-white/40 text-white hover:bg-white hover:text-black' : 'border border-black/40 text-black hover:bg-black hover:text-white';
  const cardClass = isDark ? 'bg-black text-white border border-white/30' : 'bg-white text-black border border-black/30';

  return (
    <div className={`fixed inset-0 z-50 ${isDark ? 'bg-black/90' : 'bg-black/40'} backdrop-blur-sm flex items-center justify-center p-4`}>
      <div className={`border ${borderClass} ${cardClass} max-w-md w-full p-5 space-y-3.5 shadow-2xl`}>
        <div className={`flex justify-between items-center border-b ${borderClass} pb-2.5`}>
          <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Add Pay Revision ({company.name})
          </h3>
          <button onClick={onClose} className={`${subtextClass} hover:text-current`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className={`block text-[10px] uppercase font-bold ${subtextClass} tracking-wider mb-1`}>New Rate (LKR)</label>
            <input
              type="number"
              step="any"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 1800.00"
              className={`w-full border px-3 py-2 ${inputClass}`}
              required
            />
          </div>

          <div>
            <label className={`block text-[10px] uppercase font-bold ${subtextClass} tracking-wider mb-1`}>Effective Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`w-full border px-3 py-2 tracking-widest ${inputClass}`}
              required
            />
            <p className={`text-[9px] ${subtextClass} mt-1 uppercase`}>Shifts logged on or after this date automatically apply this revised rate.</p>
          </div>

          <div>
            <label className={`block text-[10px] uppercase font-bold ${subtextClass} tracking-wider mb-1`}>Reason / Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Mid-year raise / Promotion"
              className={`w-full border px-3 py-2 ${inputClass}`}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className={`border ${borderClass} ${outlineBtnClass} px-3.5 py-1.5 font-bold uppercase text-[10px] tracking-widest`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`border ${borderClass} ${primaryBtnClass} px-4 py-1.5 font-bold uppercase text-[10px] tracking-widest transition`}
            >
              Save Rate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}