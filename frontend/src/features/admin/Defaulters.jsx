import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../AuthContext';
import { AlertTriangle, Download, Users, FileText } from 'lucide-react';
import { getNumericAttendancePercentage, calculateOverallAttendance } from '../../utils/attendanceHelpers';
import AttendanceReportTable from './components/AttendanceReportTable';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchAdminUploads, fetchConsolidatedReport } from '../../utils/api';

const Defaulters = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [oeSubjects, setOeSubjects] = useState([]);
  const [assignedClass, setAssignedClass] = useState(null);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState('full');
  const [threshold, setThreshold] = useState(75);

  useEffect(() => {
    if (!user?.id) return;
    fetchAdminUploads(user.id)
      .then(data => {
        const ac = data.assignedClass || null;
        setAssignedClass(ac);
        if (!ac?.year || !ac?.division) {
          setLoading(false);
          return;
        }
        return fetchConsolidatedReport(ac.year, ac.division)
          .then(reportData => {
            setStudents(reportData.students || []);
            setSubjects(reportData.subjects || []);
            setOeSubjects(reportData.oeSubjects || []);
            setLoading(false);
          });
      })
      .catch(err => {
        console.error('Defaulters fetch error:', err);
        setLoading(false);
      });
  }, [user]);

  const viewOptions = [
    { value: 'theory', label: 'Theory Only', desc: 'Lecture count + Theory % per subject' },
    { value: 'lab', label: 'Lab Only', desc: 'Lab count + Lab % per subject' },
    { value: 'count', label: 'Lecture Counts Only', desc: 'Attended lectures count without subject percentages' },
    { value: 'full', label: 'Full Report', desc: 'Theory, Lab counts & all percentages' },
  ];


  // ── Derive defaulters ───────────────────────────────────
  const defaulters = useMemo(() => {
    const enriched = students.map(stu => {
      const overall = calculateOverallAttendance(stu, subjects, viewMode);
      const overallCombPct = getNumericAttendancePercentage(overall.att, overall.tot);
      
      return { 
        ...stu, 
        overallCombPct, 
        isDefaulter: overall.tot > 0 && overallCombPct < threshold
      };
    });

    return enriched.filter(s => s.isDefaulter);
  }, [viewMode, threshold, students, subjects]);

  const generateSheetData = (mode) => {
    if (!defaulters.length) return null;

    const activeSubjects = subjects.filter(sub => {
      if (mode === 'theory') return sub.th_tot > 0;
      if (mode === 'lab') return sub.lab_tot > 0;
      return sub.th_tot > 0 || sub.lab_tot > 0;
    });

    const academicYear = `${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(-2)}`;

    const aoa = [
      ["Department of Computer Science and Engineering (Data Science)"],
      [`Class: ${assignedClass?.name || "N/A"} - DEFAULTERS LIST`],
      [`Threshold: ${threshold}% | Mode: ${mode.toUpperCase()} | Academic Year ${academicYear}`],
      [],
      ["Sr.No", "Roll No", "SAP ID", "Name"]
    ];

    const subHeaders = ["", "", "", "Total Conducted"];
    const merges = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
      { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } },
      { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } },
      { s: { r: 4, c: 2 }, e: { r: 5, c: 2 } },
      { s: { r: 4, c: 3 }, e: { r: 5, c: 3 } },
    ];

    let colIndex = 4;
    activeSubjects.forEach(sub => {
      let startCol = colIndex;
      aoa[4][colIndex] = sub.label;
      if (mode === 'theory') {
        subHeaders[colIndex++] = "Lec Att";
        subHeaders[colIndex++] = "Theory %";
      } else if (mode === 'lab') {
        subHeaders[colIndex++] = "Lab Att";
        subHeaders[colIndex++] = "Lab %";
      } else if (mode === 'count') {
        if (sub.th_tot > 0) subHeaders[colIndex++] = "Th Att";
        if (sub.lab_tot > 0) subHeaders[colIndex++] = "Lab Att";
      } else {
        if (sub.th_tot > 0) { subHeaders[colIndex++] = "Th Att"; subHeaders[colIndex++] = "Th %"; }
        if (sub.lab_tot > 0) { subHeaders[colIndex++] = "Lab Att"; subHeaders[colIndex++] = "Lab %"; }
        if (sub.th_tot > 0 && sub.lab_tot > 0) subHeaders[colIndex++] = "Comb %";
      }
      merges.push({ s: { r: 4, c: startCol }, e: { r: 4, c: colIndex - 1 } });
    });

    const overallHeader = mode === 'theory' ? 'Overall Theory' : mode === 'lab' ? 'Overall Lab' : 'Overall Attendance';
    aoa[4][colIndex] = overallHeader;
    subHeaders[colIndex++] = "Att";
    subHeaders[colIndex++] = "%";
    merges.push({ s: { r: 4, c: colIndex - 2 }, e: { r: 4, c: colIndex - 1 } });

    aoa.push(subHeaders);

    // Totals conducted row
    const conductedRow = ["", "", "", "Total Sessions"];
    let cIdx = 4;
    activeSubjects.forEach(sub => {
      if (mode === 'theory') { conductedRow[cIdx++] = sub.th_tot; conductedRow[cIdx++] = ""; }
      else if (mode === 'lab') { conductedRow[cIdx++] = sub.lab_tot; conductedRow[cIdx++] = ""; }
      else if (mode === 'count') {
        if (sub.th_tot > 0) conductedRow[cIdx++] = sub.th_tot;
        if (sub.lab_tot > 0) conductedRow[cIdx++] = sub.lab_tot;
      } else {
        if (sub.th_tot > 0) { conductedRow[cIdx++] = sub.th_tot; conductedRow[cIdx++] = ""; }
        if (sub.lab_tot > 0) { conductedRow[cIdx++] = sub.lab_tot; conductedRow[cIdx++] = ""; }
        if (sub.th_tot > 0 && sub.lab_tot > 0) conductedRow[cIdx++] = "";
      }
    });
    aoa.push(conductedRow);

    // Student Data
    defaulters.forEach((stu, idx) => {
      const row = [idx + 1, stu.rollNo, stu.sapId, stu.name];
      let dIdx = 4;
      let totalAtt = 0, totalTot = 0;

      activeSubjects.forEach(sub => {
        const d = stu[sub.key] || { th_att: 0, th_tot: 0, lab_att: 0, lab_tot: 0 };
        if (mode === 'theory') {
          row[dIdx++] = d.th_att;
          row[dIdx++] = ((d.th_att / sub.th_tot) * 100).toFixed(1) + "%";
          totalAtt += d.th_att; totalTot += sub.th_tot;
        } else if (mode === 'lab') {
          row[dIdx++] = d.lab_att;
          row[dIdx++] = ((d.lab_att / sub.lab_tot) * 100).toFixed(1) + "%";
          totalAtt += d.lab_att; totalTot += sub.lab_tot;
        } else {
          // full/count logic... simplified
          if (sub.th_tot > 0) { row[dIdx++] = d.th_att; if (mode !== 'count') row[dIdx++] = ((d.th_att / sub.th_tot) * 100).toFixed(1) + "%"; totalAtt += d.th_att; totalTot += sub.th_tot; }
          if (sub.lab_tot > 0) { row[dIdx++] = d.lab_att; if (mode !== 'count') row[dIdx++] = ((d.lab_att / sub.lab_tot) * 100).toFixed(1) + "%"; totalAtt += d.lab_att; totalTot += sub.lab_tot; }
          if (mode === 'full' && sub.th_tot > 0 && sub.lab_tot > 0) row[dIdx++] = (((d.th_att + d.lab_att) / (sub.th_tot + sub.lab_tot)) * 100).toFixed(1) + "%";
        }
      });
      row[colIndex - 2] = totalAtt;
      row[colIndex - 1] = totalTot > 0 ? ((totalAtt / totalTot) * 100).toFixed(1) + "%" : "0.0%";
      aoa.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    return ws;
  };

  const handleDownloadExcel = () => {
    if (!defaulters.length) return;
    const wb = XLSX.utils.book_new();
    const modes = [
      { id: 'full', label: 'Full Defaulters Report' },
      { id: 'theory', label: 'Theory Defaulters' },
      { id: 'lab', label: 'Lab Defaulters' }
    ];

    modes.forEach(m => {
      const ws = generateSheetData(m.id);
      if (ws) XLSX.utils.book_append_sheet(wb, ws, m.label);
    });

    XLSX.writeFile(wb, `Defaulters_${threshold}Pct_${assignedClass?.name || "Report"}.xlsx`);
  };

  const handleDownloadPDF = () => {
    if (!defaulters.length) return;
    
    const doc = new jsPDF('landscape');
    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
    
    doc.setFontSize(14);
    doc.text(`Department of Computer Science and Engineering (Data Science)`, 14, 15);
    doc.setFontSize(12);
    doc.text(`Class: ${assignedClass?.name || "N/A"} - DEFAULTERS LIST`, 14, 22);
    doc.setFontSize(10);
    doc.text(`Attendance Category: ${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} | AY ${academicYear} | Threshold: ${threshold}%`, 14, 28);
    
    // Count columns in rendered table to scale font & padding dynamically
    const tableEl = document.querySelector('#attendance-report-table');
    let totalCols = 10;
    if (tableEl) {
      const headerRows = tableEl.querySelectorAll('thead tr');
      if (headerRows.length > 0) {
        let count = 0;
        Array.from(headerRows[0].children).forEach(cell => {
          count += parseInt(cell.getAttribute('colspan') || '1', 10);
        });
        totalCols = count || 10;
      }
    }

    let fontSize = 5.5;
    let padding = 0.5;
    let rollWidth = 12;
    let sapWidth = 20;
    let nameWidth = 32;

    if (totalCols >= 18) {
      fontSize = 4.2;
      padding = 0.3;
      rollWidth = 10;
      sapWidth = 16;
      nameWidth = 24;
    } else if (totalCols >= 14) {
      fontSize = 4.8;
      padding = 0.4;
      rollWidth = 11;
      sapWidth = 18;
      nameWidth = 28;
    }

    autoTable(doc, {
      html: '#attendance-report-table',
      startY: 33,
      margin: { left: 8, right: 8, top: 33, bottom: 10 },
      styles: {
        fontSize,
        cellPadding: { top: 0.6, bottom: 0.6, left: padding, right: padding },
        halign: 'center',
        valign: 'middle',
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [17, 34, 64],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        fontSize
      },
      columnStyles: {
        0: { cellWidth: rollWidth, halign: 'center' },
        1: { cellWidth: sapWidth, halign: 'center' },
        2: { cellWidth: nameWidth, halign: 'left' }
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          data.cell.styles.overflow = 'linebreak';
        }
      },
      theme: 'grid'
    });
    
    doc.save(`Defaulters_${assignedClass?.name || "Class"}_${threshold}Pct_${viewMode}.pdf`);
  };

  if (loading) return (
    <div className="text-center py-5">
      <div className="spinner-border text-primary"></div>
    </div>
  );

  const totalThTot = subjects.reduce((s, sub) => s + (sub.th_tot || 0), 0);
  const totalLbTot = subjects.reduce((s, sub) => s + (sub.lab_tot || 0), 0);

  return (
    <div className="fade-in space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <AlertTriangle size={22} className="text-red-500 flex-shrink-0" />
            Defaulters List
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mt-1 text-sm sm:text-base">
            Students with overall or subject-wise attendance below{' '}
            <span className="font-semibold text-red-500">{threshold}%</span> - Class:{' '}
            <span className="font-semibold text-blue-600">{assignedClass?.name || "Your Class"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 fade-in">
          <button 
            onClick={handleDownloadPDF}
            disabled={defaulters.length === 0}
            className="btn btn-danger flex items-center gap-2 shadow-sm whitespace-nowrap"
            style={{ backgroundColor: '#dc3545', color: 'white', borderColor: '#dc3545' }}
          >
            <FileText size={18} /> Download PDF
          </button>
          <button 
            onClick={handleDownloadExcel}
            disabled={defaulters.length === 0}
            className="btn btn-success flex items-center gap-2 shadow-sm whitespace-nowrap"
          >
            <Download size={18} /> Download Excel
          </button>
        </div>
      </div>

      {/* Controls - Always visible */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/20 p-3 rounded-xl border border-slate-100 dark:border-slate-800 mt-2">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">View Mode:</label>
            <select
              value={viewMode}
              onChange={e => setViewMode(e.target.value)}
              className="form-select form-select-sm rounded-lg border-slate-300 dark:border-slate-600 dark:bg-[#112240] dark:text-slate-200 shadow-sm text-sm font-medium cursor-pointer"
              style={{ minWidth: 180 }}
            >
              {viewOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-4 sm:pl-6">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Threshold:</label>
            <select
              value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="form-select form-select-sm rounded-lg border-slate-300 dark:border-slate-600 dark:bg-[#112240] dark:text-slate-200 shadow-sm text-sm font-medium cursor-pointer"
              style={{ minWidth: 100 }}
            >
              <option value={75}>75%</option>
              <option value={70}>70%</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden lg:inline italic">
            {viewOptions.find(o => o.value === viewMode)?.desc}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-100 dark:border-slate-700 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
            Below {threshold}%
          </span>
        </div>
      </div>

      {defaulters.length === 0 ? (
        <div className="card shadow-sm border-0 rounded-xl">
          <div className="card-body p-8 sm:p-16 text-center">
            <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users size={32} />
            </div>
            <h5 className="font-bold text-slate-700 dark:text-white mb-1">No Defaulters Found</h5>
            <p className="text-slate-600 dark:text-slate-300">All students have attendance above {threshold}%.</p>
          </div>
        </div>
      ) : (
        <div className="fade-in space-y-4">

          <AttendanceReportTable 
            students={defaulters}
            subjects={subjects}
            oeSubjects={oeSubjects}
            viewMode={viewMode}
            totalThTot={totalThTot}
            totalLbTot={totalLbTot}
            threshold={threshold}
          />
        </div>
      )}
    </div>
  );
};

export default Defaulters;
