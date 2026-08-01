const fs = require('fs');

let app = fs.readFileSync('./src/App.jsx', 'utf8');

// 1. Add state variable
if (!app.includes('selectedCompanyId')) {
  app = app.replace(
    `const [activeTab, setActiveTab] = useState('dashboard');`,
    `const [activeTab, setActiveTab] = useState('dashboard');\n  const [selectedCompanyId, setSelectedCompanyId] = useState(null);`
  );
}

// 2. Make Company title clickable
app = app.replace(
  `<h3 className="font-bold text-white text-sm tracking-widest uppercase">{company.name}</h3>`,
  `<button onClick={() => { setSelectedCompanyId(company.id); setActiveTab('companyDetails'); }} className="font-bold text-white text-sm tracking-widest uppercase hover:underline text-left">{company.name} <ArrowUpRight className="inline w-3 h-3 ml-1" /></button>`
);

// 3. Insert the Company Details View after the companies tab ends
const companyDetailsView = `
        {activeTab === 'companyDetails' && selectedCompanyId && (() => {
          const company = companies.find(c => c.id === selectedCompanyId);
          if (!company) return <div>Company not found</div>;
          const companyShifts = filteredShifts.filter(s => s.companyId === selectedCompanyId);
          return (
            <div className="space-y-6 animate-fade-in">
              <button onClick={() => setActiveTab('companies')} className="text-xs uppercase text-neutral-400 hover:text-white flex items-center gap-1 mb-4">
                ← Back to Companies
              </button>
              <div className="flex justify-between items-end border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-xl font-extrabold tracking-widest text-white uppercase">{company.name}</h2>
                  <p className="text-[10px] text-neutral-400 tracking-wider uppercase mt-1">Dedicated Company View</p>
                </div>
                <button
                  onClick={() => {
                    setEditingShift(null);
                    setShiftModalOpen(true);
                  }}
                  className="border border-white bg-white text-black hover:bg-neutral-200 px-4 py-2 text-xs font-bold uppercase tracking-widest transition flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" /> Log Shift Here
                </button>
              </div>
              
              {companyShifts.length === 0 ? (
                <div className="glass-panel p-12 text-center text-neutral-500 text-xs uppercase tracking-widest">
                  No shifts recorded for {company.name}
                </div>
              ) : (
                <div className="space-y-3">
                  {companyShifts.map(shift => (
                    <div key={shift.id} className="glass-panel p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div className="space-y-1 text-xs">
                        <span className="font-bold text-white tracking-widest">{shift.date}</span>
                        <p className="text-[10px] text-neutral-400 uppercase tracking-wider">{shift.startTime} - {shift.endTime} ({shift.hoursWorked} HRS)</p>
                      </div>
                      <div className="text-right text-sm font-extrabold text-white tracking-widest">
                        {formatLKR(shift.earnings)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
`;
if (!app.includes(`activeTab === 'companyDetails'`)) {
  app = app.replace(
    `{activeTab === 'settings' && (`,
    companyDetailsView + `\n        {activeTab === 'settings' && (`
  );
}

// 4. Update ShiftModal invocation
app = app.replace(
  `editingShift={editingShift}`,
  `editingShift={editingShift}\n          preSelectedCompanyId={activeTab === 'companyDetails' ? selectedCompanyId : null}`
);

// 5. Update ShiftModal signature and logic
app = app.replace(
  `function ShiftModal({ isOpen, onClose, onSave, companies, editingShift, getEffectiveRate }) {`,
  `function ShiftModal({ isOpen, onClose, onSave, companies, editingShift, getEffectiveRate, preSelectedCompanyId }) {`
);

app = app.replace(
  `const [companyId, setCompanyId] = useState(editingShift?.companyId || companies[0]?.id || '');`,
  `const [companyId, setCompanyId] = useState(editingShift?.companyId || preSelectedCompanyId || companies[0]?.id || '');`
);

// 6. Hide Company dropdown if preSelected
app = app.replace(
  `{/* Select Employer */}`,
  `{/* Select Employer */}\n          {!preSelectedCompanyId && (`
);
app = app.replace(
  `</select>\n          </div>`,
  `</select>\n          </div>\n          )}`
);

// 7. Remove Manual Rate Override Box entirely from ShiftModal
// We will replace the whole block starting from Rate Preview to its end.
const rateBoxStart = `{/* Rate Preview & Manual Override */}`;
const rateBoxEnd = `{/* Shift Notes */}`;
if (app.includes(rateBoxStart) && app.includes(rateBoxEnd)) {
  const before = app.substring(0, app.indexOf(rateBoxStart));
  const after = app.substring(app.indexOf(rateBoxEnd));
  app = before + `
          {/* Rate automatically calculated silently in background */}
          ` + after;
}

// 8. Fix manualRate variable reference which was deleted
app = app.replace(/manualRate/g, 'false');
app = app.replace(/customHourlyRate/g, '""');

fs.writeFileSync('./src/App.jsx', app);
console.log('Patch 3 successful!');
