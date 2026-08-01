const fs = require('fs');

let app = fs.readFileSync('./src/App.jsx', 'utf8');

// 1. Add imports for Recharts and jsPDF
if (!app.includes('import { BarChart')) {
  app = app.replace(
    `import { ref, onValue, set } from 'firebase/database';`,
    `import { ref, onValue, set } from 'firebase/database';\nimport { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';\nimport jsPDF from 'jspdf';\nimport 'jspdf-autotable';`
  );
}

// 2. Add PDF Generation logic inside App component
const pdfLogic = `
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

    doc.save(\`payslip_\${selectedMonth}.pdf\`);
  };
`;

if (!app.includes('handleGeneratePayslip')) {
  app = app.replace(
    `  // Data Export / Import`,
    pdfLogic + `\n  // Data Export / Import`
  );
}

// 3. Update Dashboard with Recharts
const chartComponent = `
            {/* Chart Section */}
            <div className="glass-panel p-6 space-y-6">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Earnings Overview
                </h2>
                <button onClick={handleGeneratePayslip} className="border border-white/20 hover:bg-white hover:text-black px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition">
                  Download PDF Payslip
                </button>
              </div>
              <div className="h-64 w-full text-[10px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Object.entries(stats.companyBreakdown).map(([id, data]) => ({ name: companies.find(c=>c.id===id)?.name || 'Unknown', earnings: data.earnings }))}>
                    <XAxis dataKey="name" stroke="#888888" />
                    <YAxis stroke="#888888" />
                    <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} />
                    <Bar dataKey="earnings" fill="#ffffff" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
`;

if (!app.includes('ResponsiveContainer')) {
  app = app.replace(
    `            {/* Earnings Breakdown Section */}`,
    chartComponent + `\n            {/* Earnings Breakdown Section */}`
  );
}

// 4. Update CSS classes for Glassmorphism
app = app.replace(/bg-neutral-950/g, 'glass-panel animate-fade-in');
app = app.replace(/border-neutral-800/g, 'border-white/10');
app = app.replace(/bg-black text-white font-mono/g, 'bg-black text-white font-mono min-h-screen');

fs.writeFileSync('./src/App.jsx', app);
console.log('App.jsx patched successfully!');
