const fs = require('fs');

let code = fs.readFileSync('src/App.jsx', 'utf-8');

// 1. Add Firebase imports
code = code.replace(
  "import React, { useState, useEffect, useMemo } from 'react';",
  `import React, { useState, useEffect, useMemo } from 'react';
import { database } from './firebase';
import { ref, onValue, set } from 'firebase/database';`
);

// 2. Update State Initialization
code = code.replace(
  `  const [companies, setCompanies] = useState(() => {
    const saved = localStorage.getItem('paytrack_lkr_companies');
    return saved ? JSON.parse(saved) : [];
  });

  const [shifts, setShifts] = useState(() => {
    const saved = localStorage.getItem('paytrack_lkr_shifts');
    return saved ? JSON.parse(saved) : [];
  });`,
  `  const [companies, setCompanies] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);`
);

// 3. Update useEffect for Firebase onValue instead of localStorage
code = code.replace(
  `  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem('paytrack_lkr_companies', JSON.stringify(companies));
  }, [companies]);

  useEffect(() => {
    localStorage.setItem('paytrack_lkr_shifts', JSON.stringify(shifts));
  }, [shifts]);`,
  `  // Sync state with Firebase Realtime Database
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
  }, []);`
);

// Helper function definition inside patch since it's hard to do complex multi-line replaces blindly
code = code.replace(
  "  const handleSaveShift = (shiftData) => {",
  `  const saveToFirebase = (path, data) => {
    set(ref(database, path), data);
  };
  const handleSaveShift = (shiftData) => {`
);

// 4. Update save operations
code = code.replace(
  `    if (editingShift) {
      setShifts(prev => prev.map(s => s.id === editingShift.id ? shiftToSave : s));
      showToast('Shift updated successfully');
    } else {
      setShifts(prev => [shiftToSave, ...prev]);
      showToast('New shift logged');
    }`,
  `    const updatedShifts = editingShift 
      ? shifts.map(s => s.id === editingShift.id ? shiftToSave : s)
      : [shiftToSave, ...shifts];
    
    saveToFirebase('shifts', updatedShifts.reduce((acc, curr) => ({...acc, [curr.id]: curr}), {}));
    showToast(editingShift ? 'Shift updated successfully' : 'New shift logged');`
);

code = code.replace(
  `    if (deleteConfirm.type === 'shift') {
      setShifts(prev => prev.filter(s => s.id !== deleteConfirm.id));
      showToast('Shift removed');
    } else if (deleteConfirm.type === 'company') {
      const hasShifts = shifts.some(s => s.companyId === deleteConfirm.id);
      if (hasShifts) {
        showToast('Cannot delete company with logged shifts');
        setDeleteConfirm(null);
        return;
      }
      setCompanies(prev => prev.filter(c => c.id !== deleteConfirm.id));
      showToast('Company removed');
    }`,
  `    if (deleteConfirm.type === 'shift') {
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
    }`
);

code = code.replace(
  `    if (editingCompany) {
      setCompanies(prev => prev.map(c => c.id === editingCompany.id ? { ...c, ...companyData } : c));
      showToast('Company details updated');
    } else {
      const newCompany = {
        ...companyData,
        id: \`comp-\${Date.now()}\`,
        dayRates: companyData.dayRates || {},
        rateHistory: companyData.rateHistory || [
          { id: \`rh-\${Date.now()}\`, startDate: new Date().toISOString().slice(0, 10), rate: companyData.defaultRate, note: 'Base Rate' }
        ]
      };
      setCompanies(prev => [...prev, newCompany]);
      showToast('Company added successfully');
    }`,
  `    let updatedCompanies;
    if (editingCompany) {
      updatedCompanies = companies.map(c => c.id === editingCompany.id ? { ...c, ...companyData } : c);
      showToast('Company details updated');
    } else {
      const newCompany = {
        ...companyData,
        id: \`comp-\${Date.now()}\`,
        dayRates: companyData.dayRates || {},
        rateHistory: companyData.rateHistory || [
          { id: \`rh-\${Date.now()}\`, startDate: new Date().toISOString().slice(0, 10), rate: companyData.defaultRate, note: 'Base Rate' }
        ]
      };
      updatedCompanies = [...companies, newCompany];
      showToast('Company added successfully');
    }
    saveToFirebase('companies', updatedCompanies.reduce((acc, curr) => ({...acc, [curr.id]: curr}), {}));`
);

code = code.replace(
  `    setCompanies(prev => prev.map(c => {
      if (c.id === companyId) {
        const updatedHistory = [...(c.rateHistory || []), { ...newRevision, id: \`rh-\${Date.now()}\` }];
        return { ...c, rateHistory: updatedHistory };
      }
      return c;
    }));
    showToast('Promotion rate added');`,
  `    const updatedCompanies = companies.map(c => {
      if (c.id === companyId) {
        const updatedHistory = [...(c.rateHistory || []), { ...newRevision, id: \`rh-\${Date.now()}\` }];
        return { ...c, rateHistory: updatedHistory };
      }
      return c;
    });
    saveToFirebase('companies', updatedCompanies.reduce((acc, curr) => ({...acc, [curr.id]: curr}), {}));
    showToast('Promotion rate added');`
);

code = code.replace(
  `    setCompanies(prev => prev.map(c => {
      if (c.id === companyId) {
        return {
          ...c,
          rateHistory: (c.rateHistory || []).filter(r => r.id !== revisionId)
        };
      }
      return c;
    }));
    showToast('Rate revision removed');`,
  `    const updatedCompanies = companies.map(c => {
      if (c.id === companyId) {
        return {
          ...c,
          rateHistory: (c.rateHistory || []).filter(r => r.id !== revisionId)
        };
      }
      return c;
    });
    saveToFirebase('companies', updatedCompanies.reduce((acc, curr) => ({...acc, [curr.id]: curr}), {}));
    showToast('Rate revision removed');`
);

code = code.replace(
  `    setCompanies(sampleComp);
    setShifts(sampleShifts);
    showToast('Sample LKR data loaded');`,
  `    saveToFirebase('companies', sampleComp.reduce((acc, curr) => ({...acc, [curr.id]: curr}), {}));
    saveToFirebase('shifts', sampleShifts.reduce((acc, curr) => ({...acc, [curr.id]: curr}), {}));
    showToast('Sample LKR data loaded to Firebase');`
);

code = code.replace(
  `                  if (deleteConfirm.type === 'clearAll') {
                    setCompanies([]);
                    setShifts([]);
                    showToast('All storage cleared');
                    setDeleteConfirm(null);
                  }`,
  `                  if (deleteConfirm.type === 'clearAll') {
                    set(ref(database, 'companies'), null);
                    set(ref(database, 'shifts'), null);
                    showToast('All data cleared from Firebase');
                    setDeleteConfirm(null);
                  }`
);

fs.writeFileSync('src/App.jsx', code, 'utf-8');
console.log('App.jsx patched successfully');
