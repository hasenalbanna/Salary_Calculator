import React, { useState, useEffect, useMemo } from 'react';
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
  CheckCircle2
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

const calculateHours = (startTime, endTime, breakMinutes = 0) => {
  if (!startTime || !endTime) return 0;
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;
  
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60; // Overnight shift calculation
  }
  
  const totalMinutes = endMinutes - startMinutes - Number(breakMinutes);
  return Math.max(0, parseFloat((totalMinutes / 60).toFixed(2)));
};

export default function App() {
  // Initialize state with localStorage, default to EMPTY arrays so real data can be added
  const [companies, setCompanies] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCompanyId, setSelectedCompanyId] = useState(null); // 'dashboard', 'shifts', 'companies', 'settings'
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [companyFilter, setCompanyFilter] = useState('all');

  // Modal States
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [rateModalCompany, setRateModalCompany] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'shift'|'company', id, title }

  const [editingShift, setEditingShift] = useState(null);
  const [editingCompany, setEditingCompany] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

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

  // Toast notification helper
  const showToast = (msg) => {
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

  const filteredShifts = useMemo(() => {
    return shifts.filter(s => {
      const matchesMonth = selectedMonth === 'all' || s.date.startsWith(selectedMonth);
      const matchesCompany = companyFilter === 'all' || s.companyId === companyFilter;
      return matchesMonth && matchesCompany;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [shifts, selectedMonth, companyFilter]);

  const stats = useMemo(() => {
    let totalEarnings = 0;
    let totalHours = 0;
    let totalBonuses = 0;

    const companyBreakdown = {};

    filteredShifts.forEach(shift => {
      const earnings = Number(shift.earnings || 0);
      const hours = Number(shift.hoursWorked || 0);
      const bonus = Number(shift.bonus || 0);

      totalEarnings += earnings;
      totalHours += hours;
      totalBonuses += bonus;

      if (!companyBreakdown[shift.companyId]) {
        companyBreakdown[shift.companyId] = { hours: 0, earnings: 0, count: 0 };
      }
      companyBreakdown[shift.companyId].hours += hours;
      companyBreakdown[shift.companyId].earnings += earnings;
      companyBreakdown[shift.companyId].count += 1;
    });

    const avgHourlyRate = totalHours > 0 ? (totalEarnings - totalBonuses) / totalHours : 0;

    return {
      totalEarnings,
      totalHours,
      totalBonuses,
      avgHourlyRate,
      companyBreakdown,
      shiftCount: filteredShifts.length
    };
  }, [filteredShifts]);

  const saveToFirebase = (path, data) => {
    set(ref(database, path), data);
  };
  const handleSaveShift = (shiftData) => {
    const hoursWorked = shiftData.isFixedHours ? Number(shiftData.fixedHours || 0) : calculateHours(shiftData.startTime, shiftData.endTime, shiftData.breakMinutes);
    const company = companies.find(c => c.id === shiftData.companyId);
    
    const autoRate = getEffectiveRate(company, shiftData.date);
    const appliedRate = shiftData.manualRate ? Number(shiftData.hourlyRate) : autoRate;
    
    const baseEarnings = hoursWorked * appliedRate;
    const totalShiftEarnings = baseEarnings + Number(shiftData.bonus || 0);

    const shiftToSave = {
      ...shiftData,
      id: shiftData.id || `sh-${Date.now()}`,
      hoursWorked,
      hourlyRate: appliedRate,
      earnings: parseFloat(totalShiftEarnings.toFixed(2))
    };

    const updatedShifts = editingShift 
      ? shifts.map(s => s.id === editingShift.id ? shiftToSave : s)
      : [shiftToSave, ...shifts];
    
    saveToFirebase('shifts', updatedShifts.reduce((acc, curr) => ({...acc, [curr.id]: curr}), {}));
    showToast(editingShift ? 'Shift updated successfully' : 'New shift logged');

    setShiftModalOpen(false);
    setEditingShift(null);
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
    }
    setDeleteConfirm(null);
  };

  const handleSaveCompany = (companyData) => {
    let updatedCompanies;
    if (editingCompany) {
      updatedCompanies = companies.map(c => c.id === editingCompany.id ? { ...c, ...companyData } : c);
      showToast('Company details updated');
    } else {
      const newCompany = {
        ...companyData,
        id: `comp-${Date.now()}`,
        dayRates: companyData.dayRates || {},
        rateHistory: companyData.rateHistory || [
          { id: `rh-${Date.now()}`, startDate: new Date().toISOString().slice(0, 10), rate: companyData.defaultRate, note: 'Base Rate' }
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

  const handleDeleteRateRevision = (companyId, revisionId) => {
    const updatedCompanies = companies.map(c => {
      if (c.id === companyId) {
        return {
          ...c,
          rateHistory: (c.rateHistory || []).filter(r => r.id !== revisionId)
        };
      }
      return c;
    });
    saveToFirebase('companies', updatedCompanies.reduce((acc, curr) => ({...acc, [curr.id]: curr}), {}));
    showToast('Rate revision removed');
  };


  const handleGeneratePayslip = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("PAYTRACK LK - PAYSLIP", 14, 22);
    
    doc.setFontSize(11);
    doc.text("Month: " + (selectedMonth === 'all' ? 'All Time' : selectedMonth), 14, 30);
    doc.text("Total Earnings: " + formatLKR(stats.totalEarnings), 14, 36);
    doc.text("Total Hours: " + stats.totalHours + " hrs", 14, 42);

    const tableData = filteredShifts.map(s => [
      s.date,
      companies.find(c => c.id === s.companyId)?.name || 'Unknown',
      s.startTime + " - " + s.endTime,
      s.hoursWorked + " hrs",
      formatLKR(s.earnings)
    ]);

    doc.autoTable({
      startY: 50,
      head: [['Date', 'Company', 'Time', 'Hours', 'Earnings']],
      body: tableData,
    });

    doc.save(`payslip_${selectedMonth}.pdf`);
  };

  // Data Export / Import
  const handleExportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ companies, shifts }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `paytrack_lkr_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Backup JSON downloaded');
  };

  const handleImportData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.companies && parsed.shifts) {
          setCompanies(parsed.companies);
          setShifts(parsed.shifts);
          showToast('Data imported successfully');
        } else {
          showToast('Invalid JSON file format');
        }
      } catch (err) {
        showToast('Error reading JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleLoadSampleData = () => {
    const sampleComp = [
      {
        id: 'sample-1',
        name: 'Colombo Tech Corp',
        defaultRate: 1500.00, // LKR 1,500/hr
        dayRates: { 0: 2250.00, 6: 1800.00 }, // Sun/Sat overrides
        rateHistory: [
          { id: 'rh-1', startDate: '2026-01-01', rate: 1200.00, note: 'Starting Rate' },
          { id: 'rh-2', startDate: '2026-06-01', rate: 1500.00, note: 'Mid-year Raise' }
        ],
        notes: 'Main Software Contracting'
      }
    ];
    const sampleShifts = [
      {
        id: 's-1',
        companyId: 'sample-1',
        date: new Date().toISOString().slice(0, 10),
        startTime: '09:00',
        endTime: '17:00',
        breakMinutes: 30,
        hoursWorked: 7.5,
        hourlyRate: 1500.00,
        bonus: 1000,
        notes: 'Standard weekday shift + bonus',
        earnings: 12250.00
      }
    ];
    saveToFirebase('companies', sampleComp.reduce((acc, curr) => ({...acc, [curr.id]: curr}), {}));
    saveToFirebase('shifts', sampleShifts.reduce((acc, curr) => ({...acc, [curr.id]: curr}), {}));
    showToast('Sample LKR data loaded to Firebase');
  };

  // New Drill-Down UI
  const isHome = activeTab !== 'companyDetails';
  const selectedComp = companies.find(c => c.id === selectedCompanyId);
  const compShifts = filteredShifts.filter(s => s.companyId === selectedCompanyId);
  const compEarn = compShifts.reduce((sum, s) => sum + Number(s.earnings || 0), 0);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-mono select-none relative pb-12">
      
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black box-glow-cyan text-white px-4 py-2 text-xs font-bold uppercase tracking-widest animate-fade-in flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 glow-cyan" /> {toastMessage}
        </div>
      )}

      {isHome ? (
        <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-8 animate-fade-in">
          {/* Top Header: Date Filter */}
          <div className="flex justify-between items-center border-b border-white/20 pb-4">
            <h1 className="font-extrabold text-lg tracking-[0.2em] uppercase glow-cyan">PayTrack</h1>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-neutral-400" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-black border border-white/20 text-white text-xs px-3 py-1.5 focus:outline-none focus:border-[var(--neon-cyan)] uppercase tracking-widest box-glow-cyan"
              >
                <option value="all">ALL TIME</option>
                <option value={new Date().toISOString().slice(0, 7)}>{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</option>
                <option value={new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7)}>
                  {new Date(new Date().setMonth(new Date().getMonth() - 1)).toLocaleString('default', { month: 'long', year: 'numeric' })}
                </option>
              </select>
            </div>
          </div>

          {/* Top Header: Total Money Earned */}
          <div className="text-center py-8">
            <p className="text-xs text-neutral-400 uppercase tracking-widest mb-2">Total Earnings</p>
            <h2 className="text-5xl font-extrabold tracking-tighter glow-purple">
              {formatLKR(stats.totalEarnings)}
            </h2>
          </div>

          {/* Company List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Your Workplaces</h3>
              <button onClick={() => { setEditingCompany(null); setCompanyModalOpen(true); }} className="text-[10px] uppercase font-bold text-[var(--neon-cyan)] hover:glow-cyan transition">+ Add Company</button>
            </div>

            {companies.length === 0 ? (
              <p className="text-xs text-neutral-600 italic text-center py-8">No companies created yet.</p>
            ) : (
              companies.map(c => {
                const ce = filteredShifts.filter(s => s.companyId === c.id).reduce((sum, s) => sum + Number(s.earnings || 0), 0);
                return (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCompanyId(c.id); setActiveTab('companyDetails'); }}
                    className="w-full bg-black border border-white/10 p-5 flex justify-between items-center transition hover:box-glow-purple group text-left"
                  >
                    <span className="font-bold uppercase tracking-widest text-sm group-hover:glow-purple transition">{c.name}</span>
                    <div className="flex items-center gap-3">
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
          {/* Back & Title */}
          <div className="flex items-center gap-4 border-b border-white/20 pb-4">
            <button onClick={() => setActiveTab('home')} className="btn-cyan p-2">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-extrabold tracking-widest uppercase glow-cyan flex-1 truncate">{selectedComp?.name}</h2>
            <button onClick={() => { setEditingCompany(selectedComp); setCompanyModalOpen(true); }} className="btn-purple px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest">
              Settings
            </button>
          </div>

          {/* Company Totals */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-[var(--neon-purple)] bg-black p-6 text-center box-glow-purple flex flex-col justify-center">
              <p className="text-[10px] text-[var(--neon-purple)] uppercase tracking-widest mb-1">Total Earnings</p>
              <p className="text-2xl font-extrabold glow-purple">{formatLKR(compEarn)}</p>
            </div>
            <button onClick={() => { setEditingShift(null); setShiftModalOpen(true); }} className="btn-cyan font-extrabold text-sm uppercase tracking-widest flex flex-col items-center justify-center p-6">
              <Plus className="w-6 h-6 mb-1" /> Log Shift
            </button>
          </div>

          {/* Shifts List */}
          <div className="pt-4 space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 border-b border-white/10 pb-2">Shift History</h3>
            {compShifts.length === 0 ? (
              <p className="text-xs text-neutral-600 italic text-center py-8">No shifts found for this date range.</p>
            ) : (
              compShifts.map(shift => (
                <div key={shift.id} className="border border-white/10 bg-black p-4 flex justify-between items-center hover:border-white/40 transition">
                  <div className="space-y-1">
                    <span className="font-bold text-white tracking-widest">{shift.date}</span>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wider">
                      {shift.startTime} - {shift.endTime} <span className="glow-cyan">({shift.hoursWorked} HRS)</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right text-sm font-extrabold text-white tracking-widest glow-cyan">
                      {formatLKR(shift.earnings)}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingShift(shift); setShiftModalOpen(true); }} className="text-[9px] uppercase tracking-widest text-neutral-400 hover:glow-cyan border border-white/20 px-2 py-0.5 transition">Edit</button>
                      <button onClick={() => setDeleteConfirm({ type: 'shift', id: shift.id })} className="text-[9px] uppercase tracking-widest text-neutral-400 hover:glow-purple border border-white/20 px-2 py-0.5 transition">Del</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

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

      {}
      {companyModalOpen && (
        <CompanyModal
          isOpen={companyModalOpen}
          onClose={() => setCompanyModalOpen(false)}
          onSave={handleSaveCompany}
          editingCompany={editingCompany}
        />
      )}

      {}
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

      {}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
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
                onClick={() => {
                  if (deleteConfirm.type === 'clearAll') {
                    set(ref(database, 'companies'), null);
                    set(ref(database, 'shifts'), null);
                    showToast('All data cleared from Firebase');
                    setDeleteConfirm(null);
                  } else {
                    confirmDelete();
                  }
                }}
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


function ShiftModal({ isOpen, onClose, onSave, companies, editingShift, getEffectiveRate, preSelectedCompanyId }) {
  const [companyId, setCompanyId] = useState(editingShift?.companyId || preSelectedCompanyId || companies[0]?.id || '');
  const [date, setDate] = useState(editingShift?.date || new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(editingShift?.startTime || '09:00');
  const [endTime, setEndTime] = useState(editingShift?.endTime || '17:00');
  const [breakMinutes, setBreakMinutes] = useState(editingShift?.breakMinutes ?? 30);
  const [bonus, setBonus] = useState(editingShift?.bonus || '');
  const [isFixedHours, setIsFixedHours] = useState(editingShift?.isFixedHours || false);
  const [fixedHours, setFixedHours] = useState(editingShift?.fixedHours || '1.5');
  const [notes, setNotes] = useState(editingShift?.notes || '');
  
  const [isManualRate, setManualRate] = useState(false);
  const [customRateVal, setCustomHourlyRate] = useState(editingShift?.hourlyRate || '');

  const selectedCompany = companies.find(c => c.id === companyId);
  
  const autoCalculatedRate = useMemo(() => {
    return getEffectiveRate(selectedCompany, date);
  }, [selectedCompany, date, getEffectiveRate]);

  const effectiveRate = autoCalculatedRate;
  const calculatedHours = isFixedHours ? Number(fixedHours || 0) : calculateHours(startTime, endTime, breakMinutes);
  const estimatedEarnings = (calculatedHours * effectiveRate) + Number(bonus || 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!companyId) return;
    onSave({
      companyId,
      date,
      startTime,
      endTime,
      breakMinutes,
      bonus: Number(bonus || 0),
      notes,
      manualRate: false,
      hourlyRate: effectiveRate,
      isFixedHours,
      fixedHours
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="border border-white bg-black max-w-md w-full p-6 space-y-5 shadow-2xl">
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {editingShift ? 'Edit Shift Log' : 'Log New Work Shift'}
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
                <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
              ))}
            </select>
          </div>
          )}

          {/* Date Picker */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Shift Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white tracking-widest"
              required
            />
          </div>

          {/* Time Tracking Mode */}
          <div className="border border-white/10 p-3 glass-panel space-y-3">
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-2 text-[10px] text-white uppercase tracking-wider cursor-pointer">
                <input type="radio" checked={!isFixedHours} onChange={() => setIsFixedHours(false)} className="accent-white" />
                Clock Time
              </label>
              <label className="flex items-center gap-2 text-[10px] text-white uppercase tracking-wider cursor-pointer">
                <input type="radio" checked={isFixedHours} onChange={() => setIsFixedHours(true)} className="accent-white" />
                Fixed Hours
              </label>
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
                  <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1 mt-2">Break (Minutes)</label>
                  <input type="number" min="0" value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white" />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Total Paid Hours</label>
                <input type="number" step="any" min="0" placeholder="e.g. 1.5" value={fixedHours} onChange={(e) => setFixedHours(e.target.value)} className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white" required={isFixedHours} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="hidden"></div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Extra Bonus (LKR)</label>
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
          </div>

          
          {/* Rate automatically calculated silently in background */}
          {/* Shift Notes */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Notes / Remarks</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Overtime session, Sunday task"
              className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white"
            />
          </div>

          {/* Live Preview Box */}
          <div className="border border-white p-3 flex justify-between items-center bg-black">
            <div>
              <p className="text-[10px] text-neutral-400 uppercase tracking-widest">{calculatedHours} HRS WORKED</p>
              <p className="text-[9px] text-neutral-500 uppercase">RATE: {formatLKR(effectiveRate)}/HR</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-neutral-400 uppercase">ESTIMATED EARNINGS</p>
              <p className="text-base font-extrabold text-white tracking-widest">{formatLKR(estimatedEarnings)}</p>
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
              Save Shift
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CompanyModal({ isOpen, onClose, onSave, editingCompany }) {
  const [name, setName] = useState(editingCompany?.name || '');
  const [defaultRate, setDefaultRate] = useState(editingCompany?.defaultRate || 1000.00);
  const [notes, setNotes] = useState(editingCompany?.notes || '');
  
  const [sunRate, setSunRate] = useState(editingCompany?.dayRates?.[0] || '');
  const [satRate, setSatRate] = useState(editingCompany?.dayRates?.[6] || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name) return;

    const dayRates = {};
    if (sunRate !== '') dayRates[0] = Number(sunRate);
    if (satRate !== '') dayRates[6] = Number(satRate);

    onSave({
      name,
      defaultRate: Number(defaultRate),
      dayRates,
      notes
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="border border-white bg-black max-w-md w-full p-6 space-y-5 shadow-2xl">
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            {editingCompany ? 'Edit Employer' : 'Add Employer / Company'}
          </h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Company Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Lanka Ltd"
              className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white uppercase tracking-widest"
              required
            />
          </div>

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

          {/* Day specific rates */}
          <div className="border border-white/10 p-3 glass-panel animate-fade-in space-y-3">
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

          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Notes / Role Title</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Senior Consultant / Part-time Designer"
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
            <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">New Hourly Rate (LKR / hr)</label>
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