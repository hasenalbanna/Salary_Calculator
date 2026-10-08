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

// Subtle Web Audio Chime for Futuristic Sound Feedback
const playChime = (enabled = true) => {
  if (!enabled || typeof window === 'undefined' || !window.AudioContext) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08); // A5
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {
    // Ignore audio permission or context restrictions
  }
};

export default function App() {
  const [companies, setCompanies] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

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

  // Goal & Tax Modals
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [calendarViewOpen, setCalendarViewOpen] = useState(false);

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

    // Initialize company breakdowns including fixed monthly salaries for active period
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
      // Hourly payment model
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

  // Feature: 1-Click Duplicate Shift
  const handleDuplicateShift = (shift) => {
    const duplicated = {
      ...shift,
      id: `sh-${Date.now()}`,
      notes: shift.notes ? `${shift.notes} (Copy)` : 'Copy'
    };
    const updatedShifts = [duplicated, ...shifts];
    saveToFirebase('shifts', updatedShifts.reduce((acc, curr) => ({...acc, [curr.id]: curr}), {}));
    showToast('Shift duplicated successfully');
  };

  // Feature: Batch Multi-Day Logger
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
    showToast(`${newShifts.length} shifts logged in batch!`);
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
      updatedCompanies = companies.map(c => c.id === editingCompany.id ? { ...c, ...companyData } : c);
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

  // Feature: CSV Spreadsheet Export
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

  // Generate Professional PDF Payslip
  const handleGeneratePayslip = (targetCompanyId = null) => {
    const doc = new jsPDF();
    const isSpecificCompany = !!targetCompanyId;
    const comp = isSpecificCompany ? companies.find(c => c.id === targetCompanyId) : null;
    
    // Header Dark Banner
    doc.setFillColor(15, 15, 20);
    doc.rect(0, 0, 210, 36, 'F');
    
    doc.setTextColor(0, 243, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text("PAYTRACK LK - PAYSLIP", 14, 18);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 190);
    doc.text("SRI LANKAN WORK & SALARY SUMMARY STATEMENT", 14, 26);
    
    const cycleRange = comp 
      ? getCompanyDateRange(comp, selectedMonth) 
      : { label: selectedMonth === 'all' ? 'All Time' : selectedMonth };
    
    let y = 46;
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    doc.text(`Generated Date: ${new Date().toLocaleDateString('en-GB')}`, 14, y);
    doc.text(`Billing Cycle / Period: ${cycleRange.label} (${selectedMonth === 'all' ? 'All Time' : selectedMonth})`, 14, y + 6);
    
    if (comp) {
      doc.text(`Employer / Client: ${comp.name}`, 14, y + 12);
      const modelLabel = comp.paymentModel === 'monthly' ? 'Fixed Monthly' : comp.paymentModel === 'product' ? 'Per Product / Task' : 'Hourly';
      doc.text(`Payment Structure: ${modelLabel}`, 14, y + 18);
      y += 18;
    }
    
    // Highlight Summary Box
    const periodEarnings = comp 
      ? (stats.companyBreakdown[comp.id]?.earnings || 0)
      : stats.totalEarnings;
      
    doc.setDrawColor(188, 19, 254);
    doc.setLineWidth(0.4);
    doc.setFillColor(250, 245, 255);
    doc.rect(14, y + 6, 182, 16, 'FD');
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    doc.text("TOTAL NET EARNINGS:", 20, y + 17);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(188, 19, 254);
    doc.text(formatLKR(periodEarnings), 130, y + 17);
    
    // Build Shift Table
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
      headStyles: { fillColor: [15, 15, 20], textColor: [0, 243, 255] },
      alternateRowStyles: { fillColor: [248, 248, 250] },
      styles: { fontSize: 8.5 }
    });

    const filePrefix = comp ? `payslip_${comp.name.replace(/\s+/g, '_')}` : 'paytrack_statement';
    doc.save(`${filePrefix}_${selectedMonth}.pdf`);
    showToast('PDF Payslip downloaded successfully');
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
          showToast('Data restored and synced to Firebase');
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

  // Feature: Comprehensive Month History Discovery
  const monthOptions = useMemo(() => {
    const set = new Set();
    
    // 1. Gather all distinct months from recorded shifts
    shifts.forEach(s => {
      if (s.date && s.date.length >= 7) {
        set.add(s.date.slice(0, 7));
      }
    });

    // 2. Also ensure current and past 12 months are in the set
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    // 3. Sort months descending
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

  // Feature: Prev / Next Month Step Navigation
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
      const shortDate = s.date.slice(5); // e.g. "10-04"
      if (!dayMap[shortDate]) dayMap[shortDate] = 0;
      dayMap[shortDate] += Number(s.earnings || 0);
    });
    return Object.keys(dayMap).sort().map(date => ({
      date,
      earnings: dayMap[date]
    }));
  }, [filteredShifts]);

  // Feature: Target Progress Calculation
  const goalProgress = useMemo(() => {
    if (!monthlyGoal || monthlyGoal <= 0) return 0;
    return Math.min(100, Math.round((stats.totalEarnings / monthlyGoal) * 100));
  }, [stats.totalEarnings, monthlyGoal]);

  const isHome = activeTab !== 'companyDetails';
  const selectedComp = companies.find(c => c.id === selectedCompanyId);
  const compShifts = filteredShifts.filter(s => s.companyId === selectedCompanyId);
  const compBreakdown = selectedCompanyId ? stats.companyBreakdown[selectedCompanyId] : null;
  const compEarn = compBreakdown?.earnings || 0;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-mono select-none relative pb-16">
      
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black box-glow-cyan text-white px-4 py-2 text-xs font-bold uppercase tracking-widest animate-fade-in flex items-center gap-2 shadow-2xl">
          <CheckCircle2 className="w-3.5 h-3.5 glow-cyan" /> {toastMessage}
        </div>
      )}

      {isHome ? (
        <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6 animate-fade-in">
          
          {/* FEATURE 4: Black Cyber Header Hero Artwork */}
          <div className="relative overflow-hidden border border-white/20 bg-black box-glow-cyan">
            <img 
              src="/header_black_banner.jpg" 
              alt="PayTrack Black Header" 
              className="w-full h-32 sm:h-44 object-cover opacity-90 hover:opacity-100 transition duration-500" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent flex items-end p-4">
              <div className="w-full flex justify-between items-end">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--neon-cyan)] glow-cyan flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Sri Lanka Salary & Shift System
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black tracking-widest uppercase text-white glow-purple">
                    PAYTRACK LK
                  </h2>
                </div>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-1.5 border border-white/20 text-neutral-400 hover:text-white text-[10px] bg-black/60"
                  title={soundEnabled ? 'Sound FX On' : 'Sound FX Muted'}
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5 glow-cyan" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Top Period Navigation & Stepper */}
          <div className="flex flex-wrap justify-between items-center border-b border-white/20 pb-4 gap-3 bg-black/40 p-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => stepMonth(-1)}
                className="p-1.5 border border-white/20 hover:border-white text-neutral-300 hover:text-white"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-neutral-400" />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-black border border-white/20 text-white text-xs px-2.5 py-1.5 focus:outline-none focus:border-[var(--neon-cyan)] uppercase tracking-wider box-glow-cyan"
                >
                  {monthOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => stepMonth(1)}
                className="p-1.5 border border-white/20 hover:border-white text-neutral-300 hover:text-white"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Direct HTML5 Month Picker */}
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-neutral-500 uppercase tracking-widest">Jump to:</span>
              <input
                type="month"
                value={selectedMonth !== 'all' ? selectedMonth : ''}
                onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                className="bg-black border border-white/20 text-white text-xs px-2 py-1 focus:outline-none focus:border-[var(--neon-cyan)]"
              />
            </div>
          </div>

          {/* Search Bar & Filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search shifts by company, date (YYYY-MM-DD), or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black border border-white/10 pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--neon-cyan)]"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-black/60 border border-white/10 p-2.5 text-[10px]">
            <span className="font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 glow-cyan" /> Tools & Export
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleGeneratePayslip()}
                className="btn-cyan px-2.5 py-1 font-bold uppercase tracking-wider flex items-center gap-1 hover:box-glow-cyan transition"
                title="Generate PDF Payslip"
              >
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
              <button
                onClick={handleExportCSV}
                className="border border-white/20 text-neutral-300 hover:text-white px-2.5 py-1 font-bold uppercase tracking-wider flex items-center gap-1 transition"
                title="Export CSV Spreadsheet"
              >
                <FileText className="w-3.5 h-3.5" /> CSV
              </button>
              <button
                onClick={() => window.print()}
                className="border border-white/20 text-neutral-300 hover:text-white px-2 py-1 font-bold uppercase tracking-wider flex items-center gap-1 transition"
                title="Print Clean Statement"
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTaxModalOpen(true)}
                className="border border-white/20 text-[var(--neon-purple)] hover:text-white px-2.5 py-1 font-bold uppercase tracking-wider flex items-center gap-1 transition"
                title="EPF / ETF / Tax Estimator"
              >
                <Calculator className="w-3.5 h-3.5" /> EPF/Tax
              </button>
              <button
                onClick={() => setBatchModalOpen(true)}
                className="border border-white/20 text-[var(--neon-cyan)] hover:text-white px-2.5 py-1 font-bold uppercase tracking-wider flex items-center gap-1 transition"
                title="Batch Multi-Day Shift Logger"
              >
                <CalendarDays className="w-3.5 h-3.5" /> Batch Log
              </button>
              <button
                onClick={handleExportData}
                className="border border-white/20 text-neutral-300 hover:text-white px-2.5 py-1 font-bold uppercase tracking-wider flex items-center gap-1 transition"
                title="Export JSON Backup"
              >
                <Download className="w-3.5 h-3.5" /> Backup
              </button>
              <label
                className="border border-white/20 text-neutral-300 hover:text-white px-2.5 py-1 font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition"
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

          {/* Hero Period Earnings Card */}
          <div className="text-center py-6 border border-white/10 bg-black/40 box-glow-purple space-y-3">
            <p className="text-xs text-neutral-400 uppercase tracking-widest">Total Period Earnings</p>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tighter glow-purple">
              {formatLKR(stats.totalEarnings)}
            </h2>
            <div className="flex flex-wrap justify-center gap-3 text-[10px] text-neutral-400 uppercase tracking-wider">
              <span>{stats.shiftCount} SHIFTS</span>
              {stats.totalHours > 0 && <span>• {stats.totalHours} TOTAL HOURS</span>}
              {stats.totalProducts > 0 && <span>• {stats.totalProducts} PRODUCTS</span>}
              {stats.avgHourlyRate > 0 && <span>• AVG RATE {formatLKR(stats.avgHourlyRate)}/HR</span>}
              {stats.avgDailyEarnings > 0 && <span>• {formatLKR(stats.avgDailyEarnings)}/DAY</span>}
            </div>

            {/* Target Monthly Goal Progress Bar */}
            <div className="pt-2 px-6 max-w-md mx-auto">
              <div className="flex justify-between items-center text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                <span className="flex items-center gap-1 cursor-pointer hover:text-white" onClick={() => setGoalModalOpen(true)}>
                  <Target className="w-3 h-3 text-[var(--neon-cyan)]" /> Goal: {formatLKR(monthlyGoal)} ({goalProgress}%)
                </span>
                <button onClick={() => setGoalModalOpen(true)} className="text-[9px] text-[var(--neon-cyan)] underline">Set Goal</button>
              </div>
              <div className="w-full bg-neutral-900 h-2 border border-white/20 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] transition-all duration-500" 
                  style={{ width: `${goalProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Recharts Analytics Card */}
          <EarningsChart 
            chartDataWorkplaces={chartDataWorkplaces} 
            chartDataDaily={chartDataDaily} 
          />

          {/* Company List */}
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Your Workplaces ({companies.length})</h3>
              <button 
                onClick={() => { setEditingCompany(null); setCompanyModalOpen(true); }} 
                className="text-[10px] uppercase font-bold text-[var(--neon-cyan)] hover:glow-cyan transition flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Company
              </button>
            </div>

            {companies.length === 0 ? (
              <p className="text-xs text-neutral-600 italic text-center py-8">No companies created yet. Click "+ Add Company" above.</p>
            ) : (
              companies.map(c => {
                const ce = stats.companyBreakdown[c.id]?.earnings || 0;
                const cycle = getCompanyDateRange(c, selectedMonth);
                const modelBadge = c.paymentModel === 'monthly' ? 'Monthly' : c.paymentModel === 'product' ? 'Product' : 'Hourly';
                
                return (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCompanyId(c.id); setActiveTab('companyDetails'); }}
                    className="w-full bg-black border border-white/10 p-4 sm:p-5 flex justify-between items-center transition hover:box-glow-purple group text-left"
                  >
                    <div className="space-y-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold uppercase tracking-widest text-sm group-hover:glow-purple transition truncate">{c.name}</span>
                        <span className="text-[9px] border border-white/20 px-1 py-0.2 text-[var(--neon-cyan)] uppercase">{modelBadge}</span>
                      </div>
                      <p className="text-[10px] text-neutral-500 tracking-wider">
                        Cycle: {cycle.label}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-extrabold text-sm">{formatLKR(ce)}</span>
                      <ArrowUpRight className="w-4 h-4 text-neutral-600 group-hover:glow-purple transition" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* Company Details View (Drill Down) */
        <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6 animate-slide-up">
          
          {/* Back & Title Header */}
          <div className="flex items-center gap-3 border-b border-white/20 pb-4">
            <button onClick={() => setActiveTab('home')} className="btn-cyan p-2" title="Return to Overview">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-extrabold tracking-widest uppercase glow-cyan truncate">{selectedComp?.name}</h2>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-400">
                <span className="border border-white/20 px-1.5 py-0.2 uppercase text-[9px] text-[var(--neon-cyan)]">
                  {selectedComp?.paymentModel === 'monthly' ? 'Fixed Monthly' : selectedComp?.paymentModel === 'product' ? 'Per Product' : 'Hourly'}
                </span>
                <span>• Cycle: {getCompanyDateRange(selectedComp, selectedMonth).label}</span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => handleGeneratePayslip(selectedComp?.id)} 
                className="btn-cyan px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"
                title="Download Company PDF Payslip"
              >
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
              <button 
                onClick={() => { setEditingCompany(selectedComp); setCompanyModalOpen(true); }} 
                className="btn-purple px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"
                title="Edit Company Rates & Cycle"
              >
                <Settings className="w-3.5 h-3.5" /> Settings
              </button>
            </div>
          </div>

          {/* Company Totals & Log Shift CTA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-[var(--neon-purple)] bg-black p-5 text-center box-glow-purple flex flex-col justify-center">
              <p className="text-[10px] text-[var(--neon-purple)] uppercase tracking-widest mb-1">Total Period Earnings</p>
              <p className="text-2xl font-extrabold glow-purple">{formatLKR(compEarn)}</p>
              {selectedComp?.paymentModel === 'monthly' && selectedMonth !== 'all' && (
                <p className="text-[9px] text-neutral-400 mt-1 uppercase">
                  (Base: {formatLKR(selectedComp.monthlySalary)} + Extra: {formatLKR(compEarn - (selectedComp.monthlySalary || 0))})
                </p>
              )}
            </div>
            
            <button 
              onClick={() => { setEditingShift(null); setShiftModalOpen(true); }} 
              className="btn-cyan font-extrabold text-sm uppercase tracking-widest flex flex-col items-center justify-center p-5 transition hover:box-glow-cyan"
            >
              <Plus className="w-6 h-6 mb-1" />
              <span>{selectedComp?.paymentModel === 'product' ? 'Log Product Work' : selectedComp?.paymentModel === 'monthly' ? 'Log OT / Entry' : 'Log Shift'}</span>
            </button>
          </div>

          {/* Shifts / Work History List */}
          <div className="pt-2 space-y-3">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                Work History ({compShifts.length} Entries)
              </h3>
              <span className="text-[9px] text-neutral-500 uppercase">
                {getCompanyDateRange(selectedComp, selectedMonth).label}
              </span>
            </div>

            {compShifts.length === 0 ? (
              <p className="text-xs text-neutral-600 italic text-center py-8">No entries recorded in this billing cycle.</p>
            ) : (
              compShifts.map(shift => {
                const isOvernight = isOvernightShift(shift.startTime, shift.endTime);

                return (
                  <div key={shift.id} className="border border-white/10 bg-black p-4 flex justify-between items-center hover:border-white/40 transition">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white tracking-widest text-xs">{shift.date}</span>
                        {isOvernight && (
                          <span className="text-[9px] border border-white/20 px-1 py-0.2 text-amber-400 flex items-center gap-0.5" title="Overnight Shift">
                            <Moon className="w-2.5 h-2.5" /> Overnight
                          </span>
                        )}
                      </div>
                      
                      {shift.paymentModel === 'product' || selectedComp?.paymentModel === 'product' ? (
                        <p className="text-[10px] text-neutral-400 uppercase tracking-wider">
                          {shift.unitsCompleted || 0} Units <span className="glow-cyan">(@ {formatLKR(shift.unitRate || selectedComp?.productRate || 0)})</span>
                          {shift.bonus > 0 && <span className="text-neutral-400"> + Bonus {formatLKR(shift.bonus)}</span>}
                        </p>
                      ) : shift.paymentModel === 'monthly' || selectedComp?.paymentModel === 'monthly' ? (
                        <p className="text-[10px] text-neutral-400 uppercase tracking-wider">
                          {shift.hoursWorked > 0 ? `${shift.hoursWorked} OT Hrs (@ ${formatLKR(shift.hourlyRate || selectedComp?.overtimeHourlyRate || 0)})` : 'Attendance / Shift'}
                          {shift.bonus > 0 && <span className="text-neutral-400"> + Bonus {formatLKR(shift.bonus)}</span>}
                        </p>
                      ) : (
                        <p className="text-[10px] text-neutral-400 uppercase tracking-wider">
                          {shift.startTime || '--'} - {shift.endTime || '--'} <span className="glow-cyan">({shift.hoursWorked} HRS)</span>
                          {shift.bonus > 0 && <span className="text-neutral-400"> + Bonus {formatLKR(shift.bonus)}</span>}
                        </p>
                      )}
                      {shift.notes && <p className="text-[9px] text-neutral-500 italic">{shift.notes}</p>}
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-right text-sm font-extrabold text-white tracking-widest glow-cyan">
                        {formatLKR(shift.earnings)}
                      </div>
                      <div className="flex gap-1.5">
                        <button 
                          onClick={() => handleDuplicateShift(shift)}
                          className="text-[9px] uppercase tracking-widest text-neutral-400 hover:text-white border border-white/20 px-1.5 py-0.5 transition"
                          title="Clone Shift"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={() => { setEditingShift(shift); setShiftModalOpen(true); }} 
                          className="text-[9px] uppercase tracking-widest text-neutral-400 hover:glow-cyan border border-white/20 px-2 py-0.5 transition"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => setDeleteConfirm({ type: 'shift', id: shift.id, title: `shift on ${shift.date}` })} 
                          className="text-[9px] uppercase tracking-widest text-neutral-400 hover:glow-purple border border-white/20 px-2 py-0.5 transition"
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
        />
      )}

      {/* Company Configuration Modal */}
      {companyModalOpen && (
        <CompanyModal
          isOpen={companyModalOpen}
          onClose={() => setCompanyModalOpen(false)}
          onSave={handleSaveCompany}
          editingCompany={editingCompany}
        />
      )}

      {/* Batch Shift Modal */}
      {batchModalOpen && (
        <BatchModal
          isOpen={batchModalOpen}
          onClose={() => setBatchModalOpen(false)}
          companies={companies}
          onSaveBatch={handleBatchLogShifts}
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
        />
      )}

      {/* EPF / ETF / Tax Estimator Modal */}
      {taxModalOpen && (
        <TaxEstimatorModal
          isOpen={taxModalOpen}
          onClose={() => setTaxModalOpen(false)}
          totalGrossEarnings={stats.totalEarnings}
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
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="border border-white bg-black max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-white" /> Confirm Deletion
            </h3>
            <p className="text-xs text-neutral-400">
              Are you sure you want to delete <strong className="text-white">{deleteConfirm.title}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="border border-white/10 text-neutral-400 hover:text-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="border border-white bg-white text-black hover:bg-neutral-200 px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
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

// Recharts Visual Analytics Component
function EarningsChart({ chartDataWorkplaces, chartDataDaily }) {
  const [chartMode, setChartMode] = useState('workplaces');
  const currentData = chartMode === 'workplaces' ? chartDataWorkplaces : chartDataDaily;
  const hasData = currentData && currentData.length > 0 && currentData.some(d => d.earnings > 0);

  return (
    <div className="bg-black border border-white/10 p-4 sm:p-5 space-y-3">
      <div className="flex justify-between items-center border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[var(--neon-cyan)] glow-cyan" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-white">Visual Breakdown</h3>
        </div>
        <div className="flex gap-1 bg-neutral-950 p-1 border border-white/10 text-[10px]">
          <button
            onClick={() => setChartMode('workplaces')}
            className={`px-2.5 py-1 uppercase font-bold tracking-wider transition ${chartMode === 'workplaces' ? 'bg-[var(--neon-cyan)] text-black' : 'text-neutral-400 hover:text-white'}`}
          >
            Workplaces
          </button>
          <button
            onClick={() => setChartMode('daily')}
            className={`px-2.5 py-1 uppercase font-bold tracking-wider transition ${chartMode === 'daily' ? 'bg-[var(--neon-purple)] text-white' : 'text-neutral-400 hover:text-white'}`}
          >
            Daily Trend
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="h-40 flex items-center justify-center text-xs text-neutral-600 italic">
          No earnings recorded for this period yet.
        </div>
      ) : (
        <div className="h-48 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <XAxis 
                dataKey={chartMode === 'workplaces' ? 'name' : 'date'} 
                stroke="#666" 
                fontSize={10} 
                tickLine={false}
                tickFormatter={(val) => chartMode === 'workplaces' && val && val.length > 10 ? val.slice(0, 9) + '…' : val}
              />
              <YAxis 
                stroke="#666" 
                fontSize={10} 
                tickLine={false}
                tickFormatter={(val) => `Rs.${val >= 1000 ? Math.round(val / 1000) + 'k' : val}`}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-black border border-white/30 p-2 text-xs shadow-2xl space-y-1">
                        <p className="font-bold text-white uppercase tracking-wider">{label}</p>
                        <p className="glow-cyan font-extrabold">{formatLKR(payload[0].value)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="earnings" 
                fill={chartMode === 'workplaces' ? 'var(--neon-cyan)' : 'var(--neon-purple)'} 
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// Modal for logging shifts / product work / overtime
function ShiftModal({ isOpen, onClose, onSave, companies, editingShift, getEffectiveRate, preSelectedCompanyId }) {
  const [companyId, setCompanyId] = useState(editingShift?.companyId || preSelectedCompanyId || companies[0]?.id || '');
  const [date, setDate] = useState(editingShift?.date || new Date().toISOString().slice(0, 10));
  
  // Time Tracking (Hourly)
  const [startTime, setStartTime] = useState(editingShift?.startTime || '09:00');
  const [endTime, setEndTime] = useState(editingShift?.endTime || '17:00');
  // REMOVED 30-minute break default! Defaults to 0 / empty
  const [breakMinutes, setBreakMinutes] = useState(editingShift?.breakMinutes !== undefined && editingShift?.breakMinutes !== null ? editingShift.breakMinutes : '');
  const [isFixedHours, setIsFixedHours] = useState(editingShift?.isFixedHours || false);
  const [fixedHours, setFixedHours] = useState(editingShift?.fixedHours || '8');
  
  // Overtime multiplier (1.0x, 1.5x, 2.0x)
  const [otMultiplier, setOtMultiplier] = useState(1.0);

  // Product Tracking
  const [unitsCompleted, setUnitsCompleted] = useState(editingShift?.unitsCompleted || '');
  const [unitRate, setUnitRate] = useState(editingShift?.unitRate || '');

  // Overtime / Bonus / Notes
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

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="border border-white bg-black max-w-md w-full p-6 space-y-5 shadow-2xl">
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {editingShift ? 'Edit Work Log' : 'Log Work Entry'}
          </h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Select Employer */}
          {!preSelectedCompanyId && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Company / Employer</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white uppercase tracking-widest"
                required
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name.toUpperCase()} ({c.paymentModel || 'Hourly'})</option>
                ))}
              </select>
            </div>
          )}

          {/* Date Picker */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white tracking-widest"
              required
            />
          </div>

          {/* DYNAMIC FORM BASED ON PAYMENT MODEL */}
          {paymentModel === 'product' ? (
            /* Per Product / Task Form */
            <div className="border border-white/10 p-3 glass-panel space-y-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-[var(--neon-cyan)] tracking-wider mb-1">
                <Package className="w-3.5 h-3.5" /> Piece-Rate / Product Output
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Units / Items Made</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 25"
                    value={unitsCompleted}
                    onChange={(e) => setUnitsCompleted(e.target.value)}
                    className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Rate / Unit (LKR)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder={selectedCompany?.productRate || '0.00'}
                    value={unitRate}
                    onChange={(e) => setUnitRate(e.target.value)}
                    className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white"
                  />
                </div>
              </div>
            </div>
          ) : paymentModel === 'monthly' ? (
            /* Fixed Monthly Form */
            <div className="border border-white/10 p-3 glass-panel space-y-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-[var(--neon-purple)] tracking-wider mb-1">
                <CalendarDays className="w-3.5 h-3.5" /> Monthly Salary Additions / OT
              </div>
              <p className="text-[10px] text-neutral-400">
                Base salary ({formatLKR(selectedCompany?.monthlySalary)}) is automatically included. Log optional overtime hours or bonuses below:
              </p>
              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Overtime Hours (Optional)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 2.5"
                  value={otHours}
                  onChange={(e) => setOtHours(e.target.value)}
                  className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white"
                />
              </div>
            </div>
          ) : (
            /* Standard Hourly Time Tracking Mode */
            <div className="border border-white/10 p-3 glass-panel space-y-3">
              <div className="flex justify-between items-center mb-1">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-[10px] text-white uppercase tracking-wider cursor-pointer">
                    <input type="radio" checked={!isFixedHours} onChange={() => setIsFixedHours(false)} className="accent-white" />
                    Clock Time
                  </label>
                  <label className="flex items-center gap-2 text-[10px] text-white uppercase tracking-wider cursor-pointer">
                    <input type="radio" checked={isFixedHours} onChange={() => setIsFixedHours(true)} className="accent-white" />
                    Fixed Hours
                  </label>
                </div>
                {isOvernight && (
                  <span className="text-[9px] text-amber-400 flex items-center gap-1 font-bold">
                    <Moon className="w-3 h-3" /> Overnight Shift (+24h)
                  </span>
                )}
              </div>

              {!isFixedHours ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Start Time</label>
                      <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white" required={!isFixedHours} />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">End Time</label>
                      <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white" required={!isFixedHours} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1 mt-1">Unpaid Break (Minutes - Default: 0)</label>
                    <input 
                      type="number" 
                      min="0" 
                      placeholder="0" 
                      value={breakMinutes} 
                      onChange={(e) => setBreakMinutes(e.target.value)} 
                      className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white" 
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Total Paid Hours</label>
                  <input type="number" step="any" min="0" placeholder="e.g. 8" value={fixedHours} onChange={(e) => setFixedHours(e.target.value)} className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white" required={isFixedHours} />
                </div>
              )}

              {/* Overtime Multiplier Selector */}
              <div className="pt-1 flex items-center justify-between border-t border-white/10">
                <span className="text-[10px] uppercase text-neutral-400">Rate Multiplier:</span>
                <div className="flex gap-1 text-[9px]">
                  {[1.0, 1.5, 2.0].map(mult => (
                    <button
                      key={mult}
                      type="button"
                      onClick={() => setOtMultiplier(mult)}
                      className={`px-2 py-0.5 border ${otMultiplier === mult ? 'border-[var(--neon-cyan)] text-[var(--neon-cyan)] bg-black' : 'border-white/10 text-neutral-400'}`}
                    >
                      {mult}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {exceedsDailySafety && (
            <div className="border border-amber-500/40 bg-amber-500/10 p-2 text-[10px] text-amber-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Shift duration is high ({calculatedHours} hrs). Check start/end time.</span>
            </div>
          )}

          {/* Bonus / Extra Cash */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Extra Bonus / Incentive (LKR)</label>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="0.00"
              value={bonus}
              onChange={(e) => setBonus(e.target.value)}
              className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white"
            />
          </div>

          {/* Shift Notes */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Notes / Remarks</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Extra task, Sunday duty, Client delivery"
              className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white"
            />
          </div>

          {/* Live Preview Box */}
          <div className="border border-white p-3 flex justify-between items-center bg-black">
            <div>
              {paymentModel === 'product' ? (
                <>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-widest">{unitsCompleted || 0} UNITS</p>
                  <p className="text-[9px] text-neutral-500 uppercase">RATE: {formatLKR(unitRate || selectedCompany?.productRate || 0)}/UNIT</p>
                </>
              ) : paymentModel === 'monthly' ? (
                <>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-widest">{otHours || 0} OT HOURS</p>
                  <p className="text-[9px] text-neutral-500 uppercase">OT RATE: {formatLKR(selectedCompany?.overtimeHourlyRate || 0)}/HR</p>
                </>
              ) : (
                <>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-widest">{calculatedHours} HRS WORKED</p>
                  <p className="text-[9px] text-neutral-500 uppercase">RATE: {formatLKR(effectiveHourlyRate)}/HR</p>
                </>
              )}
            </div>
            <div className="text-right">
              <p className="text-[9px] text-neutral-400 uppercase">ESTIMATED LOG TOTAL</p>
              <p className="text-base font-extrabold text-white tracking-widest glow-cyan">{formatLKR(estimatedEarnings)}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border border-white/10 text-neutral-400 hover:text-white px-4 py-2 font-bold uppercase text-[10px] tracking-widest"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="border border-white bg-white text-black hover:bg-neutral-200 px-5 py-2 font-bold uppercase text-[10px] tracking-widest transition"
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
function CompanyModal({ isOpen, onClose, onSave, editingCompany }) {
  const [name, setName] = useState(editingCompany?.name || '');
  const [paymentModel, setPaymentModel] = useState(editingCompany?.paymentModel || 'hourly');
  
  // Hourly Rates
  const [defaultRate, setDefaultRate] = useState(editingCompany?.defaultRate ?? 1000.00);
  const [sunRate, setSunRate] = useState(editingCompany?.dayRates?.[0] ?? '');
  const [satRate, setSatRate] = useState(editingCompany?.dayRates?.[6] ?? '');

  // Monthly Rates
  const [monthlySalary, setMonthlySalary] = useState(editingCompany?.monthlySalary ?? 50000.00);
  const [overtimeHourlyRate, setOvertimeHourlyRate] = useState(editingCompany?.overtimeHourlyRate ?? '');

  // Product Rates
  const [productRate, setProductRate] = useState(editingCompany?.productRate ?? 250.00);

  // Pay Cycle Start Day (1 to 31)
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

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="border border-white bg-black max-w-md w-full p-6 space-y-5 shadow-2xl">
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            {editingCompany ? 'Edit Employer / Client' : 'Add Employer / Client'}
          </h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Company Name */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Company / Workplace Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Tech Lanka"
              className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white uppercase tracking-widest"
              required
            />
          </div>

          {/* Payment Model Selector */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1.5">Payment Model</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentModel('hourly')}
                className={`py-2 px-2 border text-[10px] uppercase font-bold tracking-wider transition ${paymentModel === 'hourly' ? 'border-[var(--neon-cyan)] text-[var(--neon-cyan)] box-glow-cyan bg-black' : 'border-white/10 text-neutral-400 hover:text-white'}`}
              >
                Hourly
              </button>
              <button
                type="button"
                onClick={() => setPaymentModel('monthly')}
                className={`py-2 px-2 border text-[10px] uppercase font-bold tracking-wider transition ${paymentModel === 'monthly' ? 'border-[var(--neon-purple)] text-[var(--neon-purple)] box-glow-purple bg-black' : 'border-white/10 text-neutral-400 hover:text-white'}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setPaymentModel('product')}
                className={`py-2 px-2 border text-[10px] uppercase font-bold tracking-wider transition ${paymentModel === 'product' ? 'border-white text-white bg-neutral-900' : 'border-white/10 text-neutral-400 hover:text-white'}`}
              >
                Per Product
              </button>
            </div>
          </div>

          {/* Context-Specific Rate Inputs */}
          {paymentModel === 'hourly' && (
            <div className="space-y-3 border border-white/10 p-3 glass-panel animate-fade-in">
              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Standard Hourly Rate (LKR / hr)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={defaultRate}
                  onChange={(e) => setDefaultRate(e.target.value)}
                  className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white"
                  required
                />
              </div>

              <div className="border-t border-white/10 pt-2 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" /> Weekend / Specific Day Rates (Optional)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] uppercase text-neutral-400 mb-1">Saturday Rate (LKR)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder={`Default (${defaultRate})`}
                      value={satRate}
                      onChange={(e) => setSatRate(e.target.value)}
                      className="w-full bg-black border border-white/10 px-3 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-neutral-400 mb-1">Sunday Rate (LKR)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder={`Default (${defaultRate})`}
                      value={sunRate}
                      onChange={(e) => setSunRate(e.target.value)}
                      className="w-full bg-black border border-white/10 px-3 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {paymentModel === 'monthly' && (
            <div className="space-y-3 border border-white/10 p-3 glass-panel animate-fade-in">
              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Fixed Monthly Salary (LKR / month)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={monthlySalary}
                  onChange={(e) => setMonthlySalary(e.target.value)}
                  className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Overtime Rate (LKR / hr - Optional)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 350.00"
                  value={overtimeHourlyRate}
                  onChange={(e) => setOvertimeHourlyRate(e.target.value)}
                  className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white"
                />
              </div>
            </div>
          )}

          {paymentModel === 'product' && (
            <div className="space-y-3 border border-white/10 p-3 glass-panel animate-fade-in">
              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Standard Rate Per Product / Unit (LKR)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={productRate}
                  onChange={(e) => setProductRate(e.target.value)}
                  placeholder="e.g. 250.00"
                  className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white"
                  required
                />
              </div>
            </div>
          )}

          {/* Custom Pay Cycle Date Configuration */}
          <div className="border border-white/10 p-3 glass-panel space-y-2">
            <label className="block text-[10px] uppercase font-bold text-white tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[var(--neon-cyan)]" /> Pay Cycle Start Day of Month
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="31"
                value={payCycleStartDay}
                onChange={(e) => setPayCycleStartDay(e.target.value)}
                className="w-24 bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white font-bold"
                required
              />
              <span className="text-[10px] text-neutral-400 uppercase">
                {payCycleStartDay == 1 ? 'Standard (1st to Month End)' : `Starts on day ${payCycleStartDay} to ${payCycleStartDay - 1}`}
              </span>
            </div>
            <p className="text-[9px] text-neutral-500 leading-relaxed">
              If this company calculates salary from the 21st to the 20th, enter <strong>21</strong>. Enter <strong>1</strong> for standard calendar months.
            </p>
          </div>

          {/* Notes / Remarks */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Notes / Role Title</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Senior Developer / Freelance Consultant"
              className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border border-white/10 text-neutral-400 hover:text-white px-4 py-2 font-bold uppercase text-[10px] tracking-widest"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="border border-white bg-white text-black hover:bg-neutral-200 px-5 py-2 font-bold uppercase text-[10px] tracking-widest transition"
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
function BatchModal({ isOpen, onClose, companies, onSaveBatch }) {
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

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="border border-white bg-black max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-[var(--neon-cyan)]" /> Batch Log Shifts (Multi-Day)
          </h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Company</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full bg-black border border-white/10 px-3 py-1.5 text-white uppercase tracking-wider"
              required
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-black border border-white/10 px-3 py-1.5 text-white" required />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-black border border-white/10 px-3 py-1.5 text-white" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Start Time</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-black border border-white/10 px-3 py-1.5 text-white" required />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">End Time</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-black border border-white/10 px-3 py-1.5 text-white" required />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-black border border-white/10 px-3 py-1.5 text-white" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="border border-white/10 text-neutral-400 px-3 py-1.5 uppercase font-bold text-[10px]">Cancel</button>
            <button type="submit" className="border border-white bg-white text-black px-4 py-1.5 uppercase font-bold text-[10px]">Log All Days</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal for setting Monthly Target Goal
function GoalModal({ isOpen, onClose, currentGoal, onSaveGoal }) {
  const [val, setVal] = useState(currentGoal);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="border border-white bg-black max-w-sm w-full p-5 space-y-4 shadow-2xl">
        <h3 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
          <Target className="w-4 h-4 text-[var(--neon-cyan)]" /> Set Monthly Earnings Target
        </h3>
        <p className="text-[10px] text-neutral-400">
          Enter your income goal in LKR for tracking your earnings progress across all workplaces:
        </p>
        <input
          type="number"
          min="1000"
          step="5000"
          value={val}
          onChange={(e) => setVal(Number(e.target.value))}
          className="w-full bg-black border border-white/20 p-2.5 text-white text-base font-extrabold focus:outline-none focus:border-[var(--neon-cyan)] glow-cyan"
        />
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="border border-white/10 text-neutral-400 px-3 py-1.5 uppercase font-bold text-[10px]">Cancel</button>
          <button onClick={() => onSaveGoal(val)} className="border border-white bg-white text-black px-4 py-1.5 uppercase font-bold text-[10px]">Set Goal</button>
        </div>
      </div>
    </div>
  );
}

// Modal for EPF / ETF & Sri Lankan APIT Estimations
function TaxEstimatorModal({ isOpen, onClose, totalGrossEarnings }) {
  const epfEmployee = totalGrossEarnings * 0.08;
  const epfEmployer = totalGrossEarnings * 0.12;
  const etfEmployer = totalGrossEarnings * 0.03;
  const netAfterEpf = totalGrossEarnings - epfEmployee;

  // Approximate Sri Lanka APIT monthly tax estimate (exempt up to 100k/mo, progressive brackets)
  let apitEstimate = 0;
  if (totalGrossEarnings > 100000) {
    const taxable = totalGrossEarnings - 100000;
    if (taxable <= 41666) apitEstimate = taxable * 0.06;
    else if (taxable <= 83333) apitEstimate = 41666 * 0.06 + (taxable - 41666) * 0.12;
    else apitEstimate = 41666 * 0.06 + 41667 * 0.12 + (taxable - 83333) * 0.18;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="border border-white bg-black max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
            <Calculator className="w-4 h-4 text-[var(--neon-purple)]" /> Sri Lanka EPF / ETF & APIT Estimator
          </h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="text-neutral-400 uppercase">Gross Period Earnings:</span>
            <span className="font-bold text-white">{formatLKR(totalGrossEarnings)}</span>
          </div>

          <div className="border border-white/10 p-3 space-y-2 bg-neutral-950">
            <p className="text-[10px] font-bold uppercase text-[var(--neon-cyan)] tracking-wider">Statutory Contributions (Estimates)</p>
            <div className="flex justify-between text-[11px]">
              <span className="text-neutral-400">Employee EPF (8%):</span>
              <span className="font-mono text-red-400">-{formatLKR(epfEmployee)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-neutral-400">Employer EPF (12%):</span>
              <span className="font-mono text-neutral-300">+{formatLKR(epfEmployer)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-neutral-400">Employer ETF (3%):</span>
              <span className="font-mono text-neutral-300">+{formatLKR(etfEmployer)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-neutral-400">Est. APIT Income Tax:</span>
              <span className="font-mono text-amber-400">-{formatLKR(apitEstimate)}</span>
            </div>
          </div>

          <div className="border border-white p-3 flex justify-between items-center bg-black">
            <div>
              <p className="text-[10px] text-neutral-400 uppercase">Estimated Take-Home (Net)</p>
              <p className="text-[9px] text-neutral-500 uppercase">After 8% EPF & APIT withholding</p>
            </div>
            <p className="text-base font-extrabold text-white glow-cyan">{formatLKR(netAfterEpf - apitEstimate)}</p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="border border-white bg-white text-black px-4 py-1.5 uppercase font-bold text-[10px]">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal for adding salary promotion / raises over time
function PromotionModal({ company, onClose, onAdd }) {
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

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="border border-white bg-black max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Add Promotion / Pay Revision ({company.name})
          </h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">New Rate (LKR)</label>
            <input
              type="number"
              step="any"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 1800.00"
              className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Effective Starting Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white tracking-widest"
              required
            />
            <p className="text-[9px] text-neutral-500 mt-1 uppercase">Shifts logged on or after this date automatically apply this revised rate.</p>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Reason / Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Mid-year raise / Promotion to Lead"
              className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border border-white/10 text-neutral-400 hover:text-white px-4 py-2 font-bold uppercase text-[10px] tracking-widest"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="border border-white bg-white text-black hover:bg-neutral-200 px-5 py-2 font-bold uppercase text-[10px] tracking-widest transition"
            >
              Add Effective Rate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}