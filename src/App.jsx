import React, { useState, useEffect, useMemo } from 'react';
import { database } from './firebase';
import { ref, onValue, set } from 'firebase/database';
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
  RotateCcw
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

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'shifts', 'companies', 'settings'
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
    const hoursWorked = calculateHours(shiftData.startTime, shiftData.endTime, shiftData.breakMinutes);
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

  return (
    <div className="min-h-screen bg-black text-white font-mono antialiased relative selection:bg-white selection:text-black pb-24 md:pb-12">
      
      {/* SVG Grain Overlay Texture */}
      <svg className="pointer-events-none fixed inset-0 z-50 h-full w-full opacity-[0.04] mix-blend-overlay">
        <filter id="noiseFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noiseFilter)" />
      </svg>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-white text-black text-xs font-bold px-4 py-2 border border-black shadow-2xl flex items-center gap-2 tracking-wide uppercase">
          <Check className="w-3.5 h-3.5" />
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-neutral-800 bg-black/90 backdrop-blur-sm sticky top-0 z-30 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-white flex items-center justify-center font-bold text-sm bg-white text-black">
              LKR
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-widest uppercase text-white">
                PAYTRACK.LK
              </h1>
              <p className="text-[10px] text-neutral-400 tracking-wider uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white inline-block"></span> Offline Operating Mode
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (companies.length === 0) {
                showToast('Please add a company first');
                setCompanyModalOpen(true);
                return;
              }
              setEditingShift(null);
              setShiftModalOpen(true);
            }}
            className="border border-white bg-white text-black hover:bg-neutral-200 active:translate-y-0.5 px-4 py-2 text-xs font-bold tracking-widest uppercase transition flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            Log Shift
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Global Controls & Filter Bar */}
        <section className="border border-neutral-800 bg-neutral-950 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-400">
              <Calendar className="w-3.5 h-3.5 text-white" />
              Month:
            </div>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-black border border-neutral-800 text-white text-xs px-3 py-1.5 focus:outline-none focus:border-white tracking-widest"
            />
            {selectedMonth !== 'all' && (
              <button
                onClick={() => setSelectedMonth('all')}
                className="text-[10px] uppercase text-neutral-500 hover:text-white underline tracking-wider"
              >
                All Time
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-400">
              <Filter className="w-3.5 h-3.5 text-white" />
              Company:
            </div>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="bg-black border border-neutral-800 text-white text-xs px-3 py-1.5 focus:outline-none focus:border-white w-full sm:w-auto tracking-widest uppercase"
            >
              <option value="all">ALL COMPANIES</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Navigation Tabs */}
        <nav className="flex border-b border-neutral-800 gap-6 overflow-x-auto text-xs font-bold tracking-widest uppercase">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'border-white text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('shifts')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'shifts'
                ? 'border-white text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Shifts ({stats.shiftCount})
          </button>
          <button
            onClick={() => setActiveTab('companies')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'companies'
                ? 'border-white text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Companies ({companies.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-white text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </button>
        </nav>

        {}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Stat Box Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="border border-neutral-800 bg-neutral-950 p-5 space-y-2">
                <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Total Earnings (LKR)</p>
                <h3 className="text-xl font-extrabold tracking-tight text-white">{formatLKR(stats.totalEarnings)}</h3>
                <p className="text-[10px] text-neutral-400">
                  {stats.totalBonuses > 0 ? `Includes ${formatLKR(stats.totalBonuses)} bonuses` : 'Base salary totals'}
                </p>
              </div>

              <div className="border border-neutral-800 bg-neutral-950 p-5 space-y-2">
                <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Hours Worked</p>
                <h3 className="text-xl font-extrabold tracking-tight text-white">{stats.totalHours} <span className="text-xs font-normal text-neutral-500">HRS</span></h3>
                <p className="text-[10px] text-neutral-400">{stats.shiftCount} shift entries logged</p>
              </div>

              <div className="border border-neutral-800 bg-neutral-950 p-5 space-y-2">
                <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Avg Hourly Rate</p>
                <h3 className="text-xl font-extrabold tracking-tight text-white">{formatLKR(stats.avgHourlyRate)}<span className="text-xs font-normal text-neutral-500">/hr</span></h3>
                <p className="text-[10px] text-neutral-400">Effective average rate</p>
              </div>

              <div className="border border-neutral-800 bg-neutral-950 p-5 space-y-2">
                <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Active Employers</p>
                <h3 className="text-xl font-extrabold tracking-tight text-white">{companies.length}</h3>
                <p className="text-[10px] text-neutral-400">Configured in system</p>
              </div>
            </div>

            {/* Earnings Breakdown Section */}
            <div className="border border-neutral-800 bg-neutral-950 p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
                  <Briefcase className="w-4 h-4" /> Earnings Breakdown By Company
                </h2>
              </div>

              {Object.keys(stats.companyBreakdown).length === 0 ? (
                <div className="py-12 text-center text-neutral-500 space-y-3">
                  <p className="text-xs uppercase tracking-wider">No shifts recorded for this period</p>
                  <button
                    onClick={() => {
                      if (companies.length === 0) setCompanyModalOpen(true);
                      else setShiftModalOpen(true);
                    }}
                    className="border border-neutral-700 hover:border-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition"
                  >
                    + Add First Entry
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(stats.companyBreakdown).map(([compId, data]) => {
                    const company = companies.find(c => c.id === compId) || { name: 'Unknown Company' };
                    const percentage = stats.totalEarnings > 0 ? ((data.earnings / stats.totalEarnings) * 100).toFixed(1) : 0;

                    return (
                      <div key={compId} className="border border-neutral-800 bg-black p-4 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-white tracking-widest uppercase">{company.name}</span>
                          <div className="text-right">
                            <span className="font-bold text-white">{formatLKR(data.earnings)}</span>
                            <span className="text-neutral-500 ml-2">({percentage}%)</span>
                          </div>
                        </div>

                        {/* Monochrome Progress Bar */}
                        <div className="w-full bg-neutral-900 h-1.5 overflow-hidden">
                          <div className="bg-white h-full" style={{ width: `${percentage}%` }}></div>
                        </div>

                        <div className="flex justify-between text-[10px] text-neutral-400 tracking-wider uppercase">
                          <span>{data.hours} HRS WORKED ({data.count} SHIFTS)</span>
                          <span>AVG: {formatLKR(data.hours > 0 ? data.earnings / data.hours : 0)}/HR</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Shifts Table */}
            <div className="border border-neutral-800 bg-neutral-950 p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Recent Shift Logs
                </h2>
                <button
                  onClick={() => setActiveTab('shifts')}
                  className="text-[10px] text-neutral-400 hover:text-white uppercase tracking-wider flex items-center gap-1 underline"
                >
                  View All <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {filteredShifts.slice(0, 5).length === 0 ? (
                <div className="py-8 text-center text-neutral-500 text-xs uppercase tracking-wider">
                  No shifts found
                </div>
              ) : (
                <div className="divide-y divide-neutral-800">
                  {filteredShifts.slice(0, 5).map(shift => {
                    const company = companies.find(c => c.id === shift.companyId);
                    return (
                      <div key={shift.id} className="py-3 flex justify-between items-center text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-white tracking-widest">{shift.date}</span>
                            <span className="text-[10px] border border-neutral-800 px-1.5 py-0.5 text-neutral-400 uppercase">
                              {getDayName(shift.date)}
                            </span>
                            <span className="text-[10px] text-neutral-300 uppercase font-bold">
                              {company?.name || 'EMPLOYER'}
                            </span>
                          </div>
                          <p className="text-[10px] text-neutral-500 tracking-wider">
                            {shift.startTime} - {shift.endTime} ({shift.hoursWorked} HRS @ {formatLKR(shift.hourlyRate)}/HR)
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white">{formatLKR(shift.earnings)}</p>
                          {shift.bonus > 0 && <span className="text-[9px] text-neutral-400 block">+ {formatLKR(shift.bonus)} BONUS</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {}
        {activeTab === 'shifts' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-white">Work Shift Entries</h2>
                <p className="text-[10px] text-neutral-500 tracking-wider uppercase">Log your daily hours and calculated rates</p>
              </div>
              <button
                onClick={() => {
                  if (companies.length === 0) {
                    showToast('Please add a company first');
                    setCompanyModalOpen(true);
                    return;
                  }
                  setEditingShift(null);
                  setShiftModalOpen(true);
                }}
                className="border border-white bg-white text-black hover:bg-neutral-200 px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Log Shift
              </button>
            </div>

            {filteredShifts.length === 0 ? (
              <div className="border border-neutral-800 bg-neutral-950 p-12 text-center space-y-4">
                <p className="text-xs text-neutral-500 uppercase tracking-widest">No work shifts recorded for this view</p>
                <button
                  onClick={() => {
                    if (companies.length === 0) setCompanyModalOpen(true);
                    else setShiftModalOpen(true);
                  }}
                  className="border border-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-white hover:text-black transition"
                >
                  Log Your First Shift
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredShifts.map(shift => {
                  const company = companies.find(c => c.id === shift.companyId);

                  return (
                    <div
                      key={shift.id}
                      className="border border-neutral-800 bg-neutral-950 p-4 transition flex flex-col sm:flex-row justify-between sm:items-center gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-bold text-white text-xs tracking-widest">{shift.date}</span>
                          <span className="text-[10px] border border-neutral-800 px-2 py-0.5 text-neutral-400 uppercase">
                            {getDayName(shift.date)}
                          </span>
                          <span className="text-[10px] bg-white text-black font-bold px-2 py-0.5 uppercase tracking-wider">
                            {company?.name || 'DELETED COMPANY'}
                          </span>
                        </div>

                        <div className="text-[11px] text-neutral-400 flex flex-wrap items-center gap-x-4 gap-y-1 tracking-wider uppercase">
                          <span>TIME: {shift.startTime} - {shift.endTime}</span>
                          <span>HOURS: {shift.hoursWorked} HRS (BREAK: {shift.breakMinutes || 0}M)</span>
                          <span>RATE: {formatLKR(shift.hourlyRate)}/HR</span>
                        </div>

                        {shift.notes && (
                          <p className="text-[11px] text-neutral-300 italic border-l border-neutral-700 pl-2">"{shift.notes}"</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-neutral-800">
                        <div className="text-left sm:text-right">
                          <div className="text-sm font-extrabold text-white tracking-widest">
                            {formatLKR(shift.earnings)}
                          </div>
                          {shift.bonus > 0 && (
                            <div className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                              + {formatLKR(shift.bonus)} BONUS
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingShift(shift);
                              setShiftModalOpen(true);
                            }}
                            className="p-1.5 border border-neutral-800 hover:border-white text-neutral-400 hover:text-white transition"
                            title="Edit Shift"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ type: 'shift', id: shift.id, title: `Shift on ${shift.date}` })}
                            className="p-1.5 border border-neutral-800 hover:border-red-500 text-neutral-400 hover:text-red-400 transition"
                            title="Delete Shift"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {}
        {activeTab === 'companies' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-white">Employers & Rate Rules</h2>
                <p className="text-[10px] text-neutral-500 tracking-wider uppercase">Set up standard hourly rates, weekend rules, and promotion history</p>
              </div>
              <button
                onClick={() => {
                  setEditingCompany(null);
                  setCompanyModalOpen(true);
                }}
                className="border border-white bg-white text-black hover:bg-neutral-200 px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Company
              </button>
            </div>

            {companies.length === 0 ? (
              <div className="border border-neutral-800 bg-neutral-950 p-12 text-center space-y-4">
                <p className="text-xs text-neutral-500 uppercase tracking-widest">No companies configured yet</p>
                <button
                  onClick={() => setCompanyModalOpen(true)}
                  className="border border-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-white hover:text-black transition"
                >
                  + Add Your First Company
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {companies.map(company => {
                  return (
                    <div
                      key={company.id}
                      className="border border-neutral-800 bg-neutral-950 p-6 space-y-6 flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-start border-b border-neutral-800 pb-3">
                          <div className="space-y-1">
                            <h3 className="font-bold text-white text-sm tracking-widest uppercase">{company.name}</h3>
                            <p className="text-[10px] text-neutral-400">{company.notes || 'No notes provided'}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingCompany(company);
                                setCompanyModalOpen(true);
                              }}
                              className="p-1.5 border border-neutral-800 hover:border-white text-neutral-400 hover:text-white"
                              title="Edit Company"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({ type: 'company', id: company.id, title: company.name })}
                              className="p-1.5 border border-neutral-800 hover:border-red-500 text-neutral-400 hover:text-red-400"
                              title="Delete Company"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Standard Hourly Rate */}
                        <div className="bg-black border border-neutral-800 p-3 space-y-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-400 uppercase text-[10px] tracking-wider">Default Hourly Rate:</span>
                            <span className="text-white font-extrabold">{formatLKR(company.defaultRate)}/hr</span>
                          </div>

                          {/* Day specific overrides */}
                          {company.dayRates && Object.keys(company.dayRates).length > 0 && (
                            <div className="border-t border-neutral-800 pt-2 space-y-1">
                              <span className="text-[9px] text-neutral-500 uppercase font-bold tracking-wider block">Custom Day Overrides:</span>
                              <div className="flex flex-wrap gap-2 text-[10px]">
                                {company.dayRates[0] !== undefined && (
                                  <span className="border border-neutral-700 px-2 py-0.5 text-neutral-300">SUN: {formatLKR(company.dayRates[0])}/HR</span>
                                )}
                                {company.dayRates[6] !== undefined && (
                                  <span className="border border-neutral-700 px-2 py-0.5 text-neutral-300">SAT: {formatLKR(company.dayRates[6])}/HR</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Promotion & Rate Revisions */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-white" /> Salary Changes & Promotions
                            </span>
                            <button
                              onClick={() => setRateModalCompany(company)}
                              className="text-[10px] uppercase underline text-white hover:text-neutral-300 flex items-center gap-0.5 tracking-wider"
                            >
                              + Add Promotion
                            </button>
                          </div>

                          {(!company.rateHistory || company.rateHistory.length === 0) ? (
                            <p className="text-[10px] text-neutral-600 italic">No salary changes added yet.</p>
                          ) : (
                            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                              {company.rateHistory.map(history => (
                                <div key={history.id} className="text-[11px] bg-black border border-neutral-800 p-2.5 flex justify-between items-center">
                                  <div className="space-y-0.5">
                                    <div className="font-bold text-white">
                                      {formatLKR(history.rate)}/HR <span className="text-neutral-500 font-normal text-[10px]">FROM {history.startDate}</span>
                                    </div>
                                    {history.note && <p className="text-[9px] text-neutral-400 uppercase tracking-wider">{history.note}</p>}
                                  </div>
                                  <button
                                    onClick={() => handleDeleteRateRevision(company.id, history.id)}
                                    className="text-neutral-600 hover:text-red-400 p-1"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="border border-neutral-800 bg-neutral-950 p-6 space-y-6">
              <div className="border-b border-neutral-800 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Offline Data & Backup
                </h2>
                <p className="text-[10px] text-neutral-500 tracking-wider uppercase mt-1">
                  All calculation entries are saved locally in your browser storage in Sri Lankan Rupees.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={handleExportData}
                  className="flex items-center justify-center gap-2 border border-white bg-black hover:bg-white hover:text-black text-white p-3 font-bold text-xs uppercase tracking-widest transition"
                >
                  <Download className="w-4 h-4" /> Export Backup (JSON)
                </button>

                <label className="flex items-center justify-center gap-2 border border-neutral-700 bg-neutral-900 hover:border-white text-white p-3 font-bold text-xs uppercase tracking-widest transition cursor-pointer">
                  <Upload className="w-4 h-4" /> Import Backup File
                  <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
                </label>
              </div>

              <div className="border-t border-neutral-800 pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">Load Demo Sample Data</h4>
                    <p className="text-[10px] text-neutral-500">Need sample LKR data to test the dashboard features?</p>
                  </div>
                  <button
                    onClick={handleLoadSampleData}
                    className="border border-neutral-700 hover:border-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-neutral-300 hover:text-white transition"
                  >
                    Load Sample
                  </button>
                </div>

                <div className="flex items-center justify-between border-t border-neutral-800 pt-4">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-red-400">Clear All Storage</h4>
                    <p className="text-[10px] text-neutral-500">Remove all logged companies and shift entries.</p>
                  </div>
                  <button
                    onClick={() => setDeleteConfirm({ type: 'clearAll', id: null, title: 'ALL DATA (Shifts & Companies)' })}
                    className="border border-red-900 bg-red-950/30 hover:bg-red-900 hover:text-white text-red-400 px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition"
                  >
                    Clear All Data
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Mobile Bottom Bar Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/95 border-t border-neutral-800 px-4 py-3 flex justify-around items-center">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-widest ${
            activeTab === 'dashboard' ? 'text-white' : 'text-neutral-600'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Dash
        </button>
        <button
          onClick={() => setActiveTab('shifts')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-widest ${
            activeTab === 'shifts' ? 'text-white' : 'text-neutral-600'
          }`}
        >
          <Clock className="w-4 h-4" />
          Shifts
        </button>
        <button
          onClick={() => setActiveTab('companies')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-widest ${
            activeTab === 'companies' ? 'text-white' : 'text-neutral-600'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Companies
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-widest ${
            activeTab === 'settings' ? 'text-white' : 'text-neutral-600'
          }`}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </nav>

      {}
      {shiftModalOpen && (
        <ShiftModal
          isOpen={shiftModalOpen}
          onClose={() => setShiftModalOpen(false)}
          onSave={handleSaveShift}
          companies={companies}
          editingShift={editingShift}
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
                className="border border-neutral-800 text-neutral-400 hover:text-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
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


function ShiftModal({ isOpen, onClose, onSave, companies, editingShift, getEffectiveRate }) {
  const [companyId, setCompanyId] = useState(editingShift?.companyId || companies[0]?.id || '');
  const [date, setDate] = useState(editingShift?.date || new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(editingShift?.startTime || '09:00');
  const [endTime, setEndTime] = useState(editingShift?.endTime || '17:00');
  const [breakMinutes, setBreakMinutes] = useState(editingShift?.breakMinutes ?? 30);
  const [bonus, setBonus] = useState(editingShift?.bonus || '');
  const [notes, setNotes] = useState(editingShift?.notes || '');
  
  const [manualRate, setManualRate] = useState(false);
  const [customHourlyRate, setCustomHourlyRate] = useState(editingShift?.hourlyRate || '');

  const selectedCompany = companies.find(c => c.id === companyId);
  
  const autoCalculatedRate = useMemo(() => {
    return getEffectiveRate(selectedCompany, date);
  }, [selectedCompany, date, getEffectiveRate]);

  const effectiveRate = manualRate ? Number(customHourlyRate || 0) : autoCalculatedRate;
  const calculatedHours = calculateHours(startTime, endTime, breakMinutes);
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
      manualRate,
      hourlyRate: effectiveRate
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="border border-white bg-black max-w-md w-full p-6 space-y-5 shadow-2xl">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
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
          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Company / Employer</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full bg-black border border-neutral-800 px-3 py-2 text-white focus:outline-none focus:border-white uppercase tracking-widest"
              required
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Shift Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-black border border-neutral-800 px-3 py-2 text-white focus:outline-none focus:border-white tracking-widest"
              required
            />
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-black border border-neutral-800 px-3 py-2 text-white focus:outline-none focus:border-white"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-black border border-neutral-800 px-3 py-2 text-white focus:outline-none focus:border-white"
                required
              />
            </div>
          </div>

          {/* Break & Bonus */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Break (Minutes)</label>
              <input
                type="number"
                min="0"
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
                className="w-full bg-black border border-neutral-800 px-3 py-2 text-white focus:outline-none focus:border-white"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Extra Bonus (LKR)</label>
              <input
                type="number"
                min="0"
                step="50"
                placeholder="0.00"
                value={bonus}
                onChange={(e) => setBonus(e.target.value)}
                className="w-full bg-black border border-neutral-800 px-3 py-2 text-white focus:outline-none focus:border-white"
              />
            </div>
          </div>

          {/* Rate Preview & Manual Override */}
          <div className="border border-neutral-800 p-3 space-y-2 bg-neutral-950">
            <div className="flex justify-between items-center text-[10px] uppercase tracking-wider">
              <span className="text-neutral-400">Effective Rate ({date}):</span>
              <span className="text-white font-bold">{formatLKR(autoCalculatedRate)}/hr</span>
            </div>

            <label className="flex items-center gap-2 text-[10px] text-neutral-400 cursor-pointer pt-1 uppercase tracking-wider">
              <input
                type="checkbox"
                checked={manualRate}
                onChange={(e) => {
                  setManualRate(e.target.checked);
                  if (!e.target.checked) setCustomHourlyRate('');
                  else setCustomHourlyRate(autoCalculatedRate);
                }}
                className="accent-white"
              />
              Override hourly rate for this shift
            </label>

            {manualRate && (
              <div className="pt-2">
                <input
                  type="number"
                  step="10"
                  value={customHourlyRate}
                  onChange={(e) => setCustomHourlyRate(e.target.value)}
                  className="w-full bg-black border border-neutral-700 px-3 py-1.5 text-white text-xs focus:outline-none"
                  placeholder="Custom rate in LKR"
                />
              </div>
            )}
          </div>

          {/* Shift Notes */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Notes / Remarks</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Overtime session, Sunday task"
              className="w-full bg-black border border-neutral-800 px-3 py-2 text-white focus:outline-none focus:border-white"
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
              className="border border-neutral-800 text-neutral-400 hover:text-white px-4 py-2 font-bold uppercase text-[10px] tracking-widest"
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
        <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
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
              className="w-full bg-black border border-neutral-800 px-3 py-2 text-white focus:outline-none focus:border-white uppercase tracking-widest"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Standard Hourly Rate (LKR / hr)</label>
            <input
              type="number"
              step="50"
              min="0"
              value={defaultRate}
              onChange={(e) => setDefaultRate(e.target.value)}
              className="w-full bg-black border border-neutral-800 px-3 py-2 text-white focus:outline-none focus:border-white"
              required
            />
          </div>

          {/* Day specific rates */}
          <div className="border border-neutral-800 p-3 bg-neutral-950 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" /> Weekend / Specific Day Rates (Optional)
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] uppercase text-neutral-400 mb-1">Saturday Rate (LKR)</label>
                <input
                  type="number"
                  step="50"
                  placeholder={`Default (${defaultRate})`}
                  value={satRate}
                  onChange={(e) => setSatRate(e.target.value)}
                  className="w-full bg-black border border-neutral-800 px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase text-neutral-400 mb-1">Sunday Rate (LKR)</label>
                <input
                  type="number"
                  step="50"
                  placeholder={`Default (${defaultRate})`}
                  value={sunRate}
                  onChange={(e) => setSunRate(e.target.value)}
                  className="w-full bg-black border border-neutral-800 px-3 py-1.5 text-xs text-white focus:outline-none"
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
              className="w-full bg-black border border-neutral-800 px-3 py-2 text-white focus:outline-none focus:border-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border border-neutral-800 text-neutral-400 hover:text-white px-4 py-2 font-bold uppercase text-[10px] tracking-widest"
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
        <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
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
              step="50"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 1800.00"
              className="w-full bg-black border border-neutral-800 px-3 py-2 text-white focus:outline-none focus:border-white"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Effective Starting Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-black border border-neutral-800 px-3 py-2 text-white focus:outline-none focus:border-white tracking-widest"
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
              className="w-full bg-black border border-neutral-800 px-3 py-2 text-white focus:outline-none focus:border-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border border-neutral-800 text-neutral-400 hover:text-white px-4 py-2 font-bold uppercase text-[10px] tracking-widest"
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