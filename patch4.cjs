const fs = require('fs');
let app = fs.readFileSync('./src/App.jsx', 'utf8');

// 1. Fix Shift Saving Bug & add Fixed Hours Support
const oldSaveShift = `  const handleSaveShift = (shiftData) => {
    const hoursWorked = calculateHours(shiftData.startTime, shiftData.endTime, shiftData.breakMinutes);
    const company = companies.find(c => c.id === shiftData.companyId);
    
    const autoRate = getEffectiveRate(company, shiftData.date);
    const appliedRate = shiftData.false ? Number(shiftData.hourlyRate) : autoRate;`;

const newSaveShift = `  const handleSaveShift = (shiftData) => {
    const hoursWorked = shiftData.isFixedHours ? Number(shiftData.fixedHours || 0) : calculateHours(shiftData.startTime, shiftData.endTime, shiftData.breakMinutes);
    const company = companies.find(c => c.id === shiftData.companyId);
    
    const autoRate = getEffectiveRate(company, shiftData.date);
    const appliedRate = shiftData.manualRate ? Number(shiftData.hourlyRate) : autoRate;`;
app = app.replace(oldSaveShift, newSaveShift);

// 2. Add fixed hours states to ShiftModal
const oldShiftStates = `  const [breakMinutes, setBreakMinutes] = useState(editingShift?.breakMinutes ?? 30);
  const [bonus, setBonus] = useState(editingShift?.bonus || '');`;

const newShiftStates = `  const [breakMinutes, setBreakMinutes] = useState(editingShift?.breakMinutes ?? 30);
  const [bonus, setBonus] = useState(editingShift?.bonus || '');
  const [isFixedHours, setIsFixedHours] = useState(editingShift?.isFixedHours || false);
  const [fixedHours, setFixedHours] = useState(editingShift?.fixedHours || '1.5');`;
app = app.replace(oldShiftStates, newShiftStates);

// 3. Update hours calculation in ShiftModal
const oldCalc = `const calculatedHours = calculateHours(startTime, endTime, breakMinutes);`;
const newCalc = `const calculatedHours = isFixedHours ? Number(fixedHours || 0) : calculateHours(startTime, endTime, breakMinutes);`;
app = app.replace(oldCalc, newCalc);

// 4. Update onSave payload in ShiftModal
const oldOnSave = `      notes,
      manualRate: false,
      hourlyRate: effectiveRate
    });`;
const newOnSave = `      notes,
      manualRate: false,
      hourlyRate: effectiveRate,
      isFixedHours,
      fixedHours
    });`;
app = app.replace(oldOnSave, newOnSave);

// 5. Update ShiftModal UI to add the Fixed Hours toggle
const oldTimesUI = `          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white"
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
                className="w-full bg-black border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white"
              />
            </div>`;

const newTimesUI = `          {/* Time Tracking Mode */}
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
            <div className="hidden"></div>`;

if(app.includes('          {/* Times */}')) {
  app = app.replace(oldTimesUI, newTimesUI);
}

// 6. Move navigation to sticky footer
const navStart = `        {/* Navigation Tabs */}`;
const navEnd = `        </nav>`;

if (app.includes(navStart) && app.includes(navEnd)) {
  const navBlock = app.substring(app.indexOf(navStart), app.indexOf(navEnd) + navEnd.length);
  app = app.replace(navBlock, ''); // Remove from top
  
  // Format as sticky footer
  const stickyNav = navBlock.replace(
    `<nav className="flex border-b border-white/10 gap-6 overflow-x-auto text-xs font-bold tracking-widest uppercase">`,
    `<nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-around bg-black/90 backdrop-blur-md border-t border-white/10 p-3 text-xs font-bold tracking-widest uppercase">`
  ).replace(/pb-3 border-b-2/g, 'flex flex-col items-center gap-1 p-2 transition').replace(/border-transparent/g, '');
  
  // Add padding to bottom of main container so footer doesn't overlap content
  app = app.replace(
    `className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6"`,
    `className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 pb-24"` // Extra padding for fixed footer
  );

  // Insert before the modals (after the main closing tag)
  const modalsAnchor = `      {/* Modals */}`;
  app = app.replace(
    `      {shiftModalOpen && (`,
    stickyNav + `\n\n      {shiftModalOpen && (`
  );
}

fs.writeFileSync('./src/App.jsx', app);
console.log("Patch 4 completed successfully!");
