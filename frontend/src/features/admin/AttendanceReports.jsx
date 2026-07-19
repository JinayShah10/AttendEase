import React, { useState, useEffect } from 'react';
import { Download, BarChart, FileText } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import AttendanceReportTable from './components/AttendanceReportTable';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchAdminUploads, generateUploadReport, fetchConsolidatedReport } from '../../utils/api';

const AttendanceReports = () => {
  const { user } = useAuth();
  const [isGenerated, setIsGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState('full');
  const [threshold, setThreshold] = useState(75);
  
  const [assignedClass, setAssignedClass] = useState(null);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [reportStudents, setReportStudents] = useState([]);
  const [reportSubjects, setReportSubjects] = useState([]);
  const [oeSubjects, setOeSubjects] = useState([]);
  const [peSubjects, setPeSubjects] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    fetchAdminUploads(user.id)
      .then(data => {
        setAssignedClass(data.assignedClass || null);
        const pending = (data.uploads || []).filter(u => u.status === 'pending');
        setPendingUploads(pending);
      })
      .catch(err => console.error("Error fetching uploads:", err));
  }, [user]);

  const generateSheetData = (mode) => {
    if (!reportStudents.length) return null;

    // Filter subjects that have at least one lecture/lab conducted for this mode
    const activeSubjects = reportSubjects.filter(sub => {
      if (mode === 'theory') return sub.th_tot > 0;
      if (mode === 'lab') return sub.lab_tot > 0;
      return sub.th_tot > 0 || sub.lab_tot > 0;
    });

    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

    // Prepare headers (Row 1-3 are title/meta)
    const aoa = [
      ["Department of Computer Science and Engineering (Data Science)"],
      [`Class: ${assignedClass?.name || "N/A"}`],
      [`Attendance Report (${mode.charAt(0).toUpperCase() + mode.slice(1)}) - AY ${academicYear}. Threshold: ${threshold}%`],
      [], // Spacing
      ["Sr.No", "Roll No", "SAP ID", "Name"] // Primary Headers start at Row 5 (index 4)
    ];

    const subHeaders = ["", "", "", "Total lecture/Prac conducted"];
    const merges = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, // Dept Title
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } }, // Class
      { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } }, // Meta text
      { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } }, // Sr.No
      { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } }, // Roll No
      { s: { r: 4, c: 2 }, e: { r: 5, c: 2 } }, // SAP ID
      { s: { r: 4, c: 3 }, e: { r: 5, c: 3 } }, // Name
    ];

    let colIndex = 4;
    activeSubjects.forEach(sub => {
      const ct = sub.th_tot, cl = sub.lab_tot;
      const hasBoth = ct > 0 && cl > 0;
      let startCol = colIndex;

      if (mode === 'theory') {
        aoa[4][colIndex] = sub.label;
        subHeaders[colIndex++] = "Lec Att";
        subHeaders[colIndex++] = "Theory %";
      } else if (mode === 'lab') {
        aoa[4][colIndex] = sub.label;
        subHeaders[colIndex++] = "Lab Att";
        subHeaders[colIndex++] = "Lab %";
      } else if (mode === 'count') {
        aoa[4][colIndex] = sub.label;
        if (ct > 0) subHeaders[colIndex++] = "Th Att";
        if (cl > 0) subHeaders[colIndex++] = "Lab Att";
      } else {
        // full mode
        aoa[4][colIndex] = sub.label;
        if (ct > 0) {
          subHeaders[colIndex++] = hasBoth ? "Th Att" : "Lec Att";
          subHeaders[colIndex++] = hasBoth ? "Th %" : "Theory %";
        }
        if (cl > 0) {
          subHeaders[colIndex++] = hasBoth ? "Lab Att" : "Lab Att";
          subHeaders[colIndex++] = hasBoth ? "Lab %" : "Lab %";
        }
        if (hasBoth) subHeaders[colIndex++] = "Comb %";
      }
      if (colIndex > startCol + 1) {
        merges.push({ s: { r: 4, c: startCol }, e: { r: 4, c: colIndex - 1 } });
      }
    });

    const showOE = reportStudents.some(s => s.oeSubject && (Number(s.oe_tot || 0) > 0 || Number(s.oe_lab_tot || 0) > 0));
    const maxOEThTot = showOE ? Math.max(...reportStudents.map(s => Number(s.oe_tot || 0)), 0) : 0;
    const maxOELabTot = showOE ? Math.max(...reportStudents.map(s => Number(s.oe_lab_tot || 0)), 0) : 0;

    const isOEVisible = showOE && (
      mode === 'theory' ? maxOEThTot > 0 :
      mode === 'lab' ? maxOELabTot > 0 :
      maxOEThTot > 0 || maxOELabTot > 0
    );

    const showDE = reportStudents.some(s => s.deSubject && (Number(s.de_tot || 0) > 0 || Number(s.de_lab_tot || 0) > 0));
    const maxDEThTot = showDE ? Math.max(...reportStudents.map(s => Number(s.de_tot || 0)), 0) : 0;
    const maxDELabTot = showDE ? Math.max(...reportStudents.map(s => Number(s.de_lab_tot || 0)), 0) : 0;

    const isDEVisible = showDE && (
      mode === 'theory' ? maxDEThTot > 0 :
      mode === 'lab' ? maxDELabTot > 0 :
      maxDEThTot > 0 || maxDELabTot > 0
    );

    if (isOEVisible) {
      let oeStartCol = colIndex;
      aoa[4][colIndex] = "Open Elective";
      if (mode === 'theory') {
        subHeaders[colIndex++] = "Lec Att";
        subHeaders[colIndex++] = "Theory %";
      } else if (mode === 'lab') {
        subHeaders[colIndex++] = "Lab Att";
        subHeaders[colIndex++] = "Lab %";
      } else if (mode === 'count') {
        if (maxOEThTot > 0) subHeaders[colIndex++] = "Th Att";
        if (maxOELabTot > 0) subHeaders[colIndex++] = "Lab Att";
      } else {
        // full
        const hasOEBoth = maxOEThTot > 0 && maxOELabTot > 0;
        if (maxOEThTot > 0) {
          subHeaders[colIndex++] = hasOEBoth ? "Th Att" : "Lec Att";
          subHeaders[colIndex++] = hasOEBoth ? "Th %" : "Theory %";
        }
        if (maxOELabTot > 0) {
          subHeaders[colIndex++] = "Lab Att";
          subHeaders[colIndex++] = "Lab %";
        }
        if (hasOEBoth) {
          subHeaders[colIndex++] = "Comb %";
        }
      }
      if (colIndex > oeStartCol + 1) {
        merges.push({ s: { r: 4, c: oeStartCol }, e: { r: 4, c: colIndex - 1 } });
      }
    }

    if (isDEVisible) {
      let deStartCol = colIndex;
      aoa[4][colIndex] = "Department Electives";
      if (mode === 'theory') {
        subHeaders[colIndex++] = "Lec Att";
        subHeaders[colIndex++] = "Theory %";
      } else if (mode === 'lab') {
        subHeaders[colIndex++] = "Lab Att";
        subHeaders[colIndex++] = "Lab %";
      } else if (mode === 'count') {
        if (maxDEThTot > 0) subHeaders[colIndex++] = "Th Att";
        if (maxDELabTot > 0) subHeaders[colIndex++] = "Lab Att";
      } else {
        // full
        const hasDEBoth = maxDEThTot > 0 && maxDELabTot > 0;
        if (maxDEThTot > 0) {
          subHeaders[colIndex++] = hasDEBoth ? "Th Att" : "Lec Att";
          subHeaders[colIndex++] = hasDEBoth ? "Th %" : "Theory %";
        }
        if (maxDELabTot > 0) {
          subHeaders[colIndex++] = "Lab Att";
          subHeaders[colIndex++] = "Lab %";
        }
        if (hasDEBoth) {
          subHeaders[colIndex++] = "Comb %";
        }
      }
      if (colIndex > deStartCol + 1) {
        merges.push({ s: { r: 4, c: deStartCol }, e: { r: 4, c: colIndex - 1 } });
      }
    }

    const overallHeader = mode === 'theory' ? 'Overall Theory' : mode === 'lab' ? 'Overall Lab' : mode === 'count' ? 'Total Sessions' : 'Overall Attendance';
    aoa[4][colIndex] = overallHeader;
    subHeaders[colIndex++] = "Att";
    aoa[4][colIndex] = ""; // for merge
    subHeaders[colIndex++] = "%";
    merges.push({ s: { r: 4, c: colIndex - 2 }, e: { r: 4, c: colIndex - 1 } });

    aoa.push(subHeaders);

    // Total Conducted Row
    const conductedRow = ["", "", "", "Total Conducted"];
    let cIdx = 4;
    activeSubjects.forEach(sub => {
      if (mode === 'theory') {
        conductedRow[cIdx++] = sub.th_tot;
        conductedRow[cIdx++] = "";
      } else if (mode === 'lab') {
        conductedRow[cIdx++] = sub.lab_tot;
        conductedRow[cIdx++] = "";
      } else if (mode === 'count') {
        if (sub.th_tot > 0) conductedRow[cIdx++] = sub.th_tot;
        if (sub.lab_tot > 0) conductedRow[cIdx++] = sub.lab_tot;
      } else {
        if (sub.th_tot > 0) { conductedRow[cIdx++] = sub.th_tot; conductedRow[cIdx++] = ""; }
        if (sub.lab_tot > 0) { conductedRow[cIdx++] = sub.lab_tot; conductedRow[cIdx++] = ""; }
        if (sub.th_tot > 0 && sub.lab_tot > 0) conductedRow[cIdx++] = "";
      }
    });
    
    // OE conducted total
    if (isOEVisible) {
      if (mode === 'theory') {
        conductedRow[cIdx++] = maxOEThTot;
        conductedRow[cIdx++] = "";
      } else if (mode === 'lab') {
        conductedRow[cIdx++] = maxOELabTot;
        conductedRow[cIdx++] = "";
      } else if (mode === 'count') {
        if (maxOEThTot > 0) conductedRow[cIdx++] = maxOEThTot;
        if (maxOELabTot > 0) conductedRow[cIdx++] = maxOELabTot;
      } else {
        // full
        const hasOEBoth = maxOEThTot > 0 && maxOELabTot > 0;
        if (maxOEThTot > 0) {
          conductedRow[cIdx++] = maxOEThTot;
          conductedRow[cIdx++] = "";
        }
        if (maxOELabTot > 0) {
          conductedRow[cIdx++] = maxOELabTot;
          conductedRow[cIdx++] = "";
        }
        if (hasOEBoth) {
          conductedRow[cIdx++] = "";
        }
      }
    }

    // DE conducted total
    if (isDEVisible) {
      if (mode === 'theory') {
        conductedRow[cIdx++] = maxDEThTot;
        conductedRow[cIdx++] = "";
      } else if (mode === 'lab') {
        conductedRow[cIdx++] = maxDELabTot;
        conductedRow[cIdx++] = "";
      } else if (mode === 'count') {
        if (maxDEThTot > 0) conductedRow[cIdx++] = maxDEThTot;
        if (maxDELabTot > 0) conductedRow[cIdx++] = maxDELabTot;
      } else {
        // full
        const hasDEBoth = maxDEThTot > 0 && maxDELabTot > 0;
        if (maxDEThTot > 0) {
          conductedRow[cIdx++] = maxDEThTot;
          conductedRow[cIdx++] = "";
        }
        if (maxDELabTot > 0) {
          conductedRow[cIdx++] = maxDELabTot;
          conductedRow[cIdx++] = "";
        }
        if (hasDEBoth) {
          conductedRow[cIdx++] = "";
        }
      }
    }

    // PE conducted totals (SET1 + SET2)
    const showPE = reportStudents.some(s =>
      (s.pe1Subject && (Number(s.pe1_tot || 0) > 0 || Number(s.pe1_lab_tot || 0) > 0)) ||
      (s.pe2Subject && (Number(s.pe2_tot || 0) > 0 || Number(s.pe2_lab_tot || 0) > 0))
    );
    const maxPE1ThTot  = showPE ? Math.max(...reportStudents.map(s => Number(s.pe1_tot     || 0)), 0) : 0;
    const maxPE1LabTot = showPE ? Math.max(...reportStudents.map(s => Number(s.pe1_lab_tot || 0)), 0) : 0;
    const maxPE2ThTot  = showPE ? Math.max(...reportStudents.map(s => Number(s.pe2_tot     || 0)), 0) : 0;
    const maxPE2LabTot = showPE ? Math.max(...reportStudents.map(s => Number(s.pe2_lab_tot || 0)), 0) : 0;
    const isPEVisible = showPE && (
      mode === 'theory' ? (maxPE1ThTot > 0 || maxPE2ThTot > 0) :
      mode === 'lab'    ? (maxPE1LabTot > 0 || maxPE2LabTot > 0) :
      true
    );

    if (isPEVisible) {
      aoa[4][colIndex] = "Program Electives";
      let peStartCol = colIndex;
      // SET1 headers
      if (mode === 'theory' && maxPE1ThTot > 0) {
        subHeaders[colIndex++] = "SET1 Lec Att"; subHeaders[colIndex++] = "SET1 Th %";
      } else if (mode === 'lab' && maxPE1LabTot > 0) {
        subHeaders[colIndex++] = "SET1 Lab Att"; subHeaders[colIndex++] = "SET1 Lab %";
      } else if (mode === 'count') {
        if (maxPE1ThTot > 0)  subHeaders[colIndex++] = "SET1 Th";
        if (maxPE1LabTot > 0) subHeaders[colIndex++] = "SET1 Lab";
        if (maxPE2ThTot > 0)  subHeaders[colIndex++] = "SET2 Th";
        if (maxPE2LabTot > 0) subHeaders[colIndex++] = "SET2 Lab";
      } else {
        if (maxPE1ThTot > 0)  { subHeaders[colIndex++] = "SET1 Th Att"; subHeaders[colIndex++] = "SET1 Th %"; }
        if (maxPE1LabTot > 0) { subHeaders[colIndex++] = "SET1 Lab Att"; subHeaders[colIndex++] = "SET1 Lab %"; }
        if (maxPE1ThTot > 0 && maxPE1LabTot > 0) subHeaders[colIndex++] = "SET1 Comb %";
        if (maxPE2ThTot > 0)  { subHeaders[colIndex++] = "SET2 Th Att"; subHeaders[colIndex++] = "SET2 Th %"; }
        if (maxPE2LabTot > 0) { subHeaders[colIndex++] = "SET2 Lab Att"; subHeaders[colIndex++] = "SET2 Lab %"; }
        if (maxPE2ThTot > 0 && maxPE2LabTot > 0) subHeaders[colIndex++] = "SET2 Comb %";
      }
      if (colIndex > peStartCol + 1) {
        merges.push({ s: { r: 4, c: peStartCol }, e: { r: 4, c: colIndex - 1 } });
      }
    }
    
    // Overall total conducted for the last column
    const totalTh = activeSubjects.reduce((acc, s) => acc + (s.th_tot || 0), 0);
    const totalLb = activeSubjects.reduce((acc, s) => acc + (s.lab_tot || 0), 0);
    const oeThTot = isOEVisible ? maxOEThTot : 0;
    const oeLabTot = isOEVisible ? maxOELabTot : 0;
    const deThTot = isDEVisible ? maxDEThTot : 0;
    const deLabTot = isDEVisible ? maxDELabTot : 0;
    const pe1ThTotC  = isPEVisible ? maxPE1ThTot  : 0;
    const pe1LabTotC = isPEVisible ? maxPE1LabTot : 0;
    const pe2ThTotC  = isPEVisible ? maxPE2ThTot  : 0;
    const pe2LabTotC = isPEVisible ? maxPE2LabTot : 0;
    
    if (mode === 'theory') conductedRow[cIdx++] = totalTh + oeThTot + deThTot + pe1ThTotC + pe2ThTotC;
    else if (mode === 'lab') conductedRow[cIdx++] = totalLb + oeLabTot + deLabTot + pe1LabTotC + pe2LabTotC;
    else conductedRow[cIdx++] = totalTh + totalLb + oeThTot + oeLabTot + deThTot + deLabTot + pe1ThTotC + pe1LabTotC + pe2ThTotC + pe2LabTotC;
    
    aoa.push(conductedRow);

    // Student Data Rows
    reportStudents.forEach((stu, idx) => {
      const row = [idx + 1, stu.rollNo, stu.sapId, stu.name];
      let dIdx = 4;
      let totalAtt = 0;
      let totalSessions = 0;

      activeSubjects.forEach(sub => {
        const d = stu[sub.key] || { th_att: 0, th_tot: 0, lab_att: 0, lab_tot: 0 };
        if (mode === 'theory') {
          if (d.notOpted) {
            row[dIdx++] = "—";
            row[dIdx++] = "—";
          } else {
            row[dIdx++] = d.th_att;
            row[dIdx++] = ((Number(d.th_att) / Number(sub.th_tot)) * 100).toFixed(2);
            totalAtt += Number(d.th_att);
            totalSessions += Number(sub.th_tot);
          }
        } else if (mode === 'lab') {
          if (d.notOpted) {
            row[dIdx++] = "—";
            row[dIdx++] = "—";
          } else {
            row[dIdx++] = d.lab_att;
            row[dIdx++] = sub.lab_tot > 0 ? ((Number(d.lab_att) / Number(sub.lab_tot)) * 100).toFixed(2) : "0.00";
            totalAtt += Number(d.lab_att);
            totalSessions += Number(sub.lab_tot);
          }
        } else if (mode === 'count') {
          if (sub.th_tot > 0) {
            row[dIdx++] = d.notOpted ? "—" : d.th_att;
            if (!d.notOpted) {
              totalAtt += Number(d.th_att);
              totalSessions += Number(sub.th_tot);
            }
          }
          if (sub.lab_tot > 0) {
            row[dIdx++] = d.notOpted ? "—" : d.lab_att;
            if (!d.notOpted) {
              totalAtt += Number(d.lab_att);
              totalSessions += Number(sub.lab_tot);
            }
          }
        } else {
          // full
          if (sub.th_tot > 0) {
            if (d.notOpted) {
              row[dIdx++] = "—";
              if (mode !== 'count') row[dIdx++] = "—";
            } else {
              row[dIdx++] = d.th_att;
              row[dIdx++] = ((Number(d.th_att) / Number(sub.th_tot)) * 100).toFixed(2);
              totalAtt += Number(d.th_att); totalSessions += Number(sub.th_tot);
            }
          }
          if (sub.lab_tot > 0) {
            if (d.notOpted) {
              row[dIdx++] = "—";
              if (mode !== 'count') row[dIdx++] = "—";
            } else {
              row[dIdx++] = d.lab_att;
              row[dIdx++] = ((Number(d.lab_att) / Number(sub.lab_tot)) * 100).toFixed(2);
              totalAtt += Number(d.lab_att); totalSessions += Number(sub.lab_tot);
            }
          }
          if (sub.th_tot > 0 && sub.lab_tot > 0) {
            row[dIdx++] = d.notOpted ? "—" : (((Number(d.th_att) + Number(d.lab_att)) / (Number(sub.th_tot) + Number(sub.lab_tot))) * 100).toFixed(2);
          }
        }
      });

      // Student OE data
      if (isOEVisible) {
        const hasOE = stu.oeSubject && stu.oeSubject !== '';
        const oeAtt = Number(stu.oe_att || 0);
        const oeT = Number(stu.oe_tot || 0);
        const oeLabAtt = Number(stu.oe_lab_att || 0);
        const oeLabTot = Number(stu.oe_lab_tot || 0);

        if (mode === 'theory') {
          row[dIdx++] = hasOE && maxOEThTot > 0 ? `${oeAtt} (${stu.oeSubject})` : 0;
          row[dIdx++] = (hasOE && oeT > 0) ? ((oeAtt / oeT) * 100).toFixed(2) : "0.00";
          if (hasOE) {
            totalAtt += oeAtt;
            totalSessions += oeT;
          }
        } else if (mode === 'lab') {
          row[dIdx++] = hasOE && maxOELabTot > 0 ? `${oeLabAtt} (${stu.oeSubject})` : 0;
          row[dIdx++] = (hasOE && oeLabTot > 0) ? ((oeLabAtt / oeLabTot) * 100).toFixed(2) : "0.00";
          if (hasOE) {
            totalAtt += oeLabAtt;
            totalSessions += oeLabTot;
          }
        } else if (mode === 'count') {
          if (maxOEThTot > 0) {
            row[dIdx++] = hasOE ? `${oeAtt} (${stu.oeSubject})` : 0;
            if (hasOE) {
              totalAtt += oeAtt;
              totalSessions += oeT;
            }
          }
          if (maxOELabTot > 0) {
            row[dIdx++] = hasOE ? `${oeLabAtt} (${stu.oeSubject})` : 0;
            if (hasOE) {
              totalAtt += oeLabAtt;
              totalSessions += oeLabTot;
            }
          }
        } else {
          // full
          const hasOEBoth = maxOEThTot > 0 && maxOELabTot > 0;
          if (maxOEThTot > 0) {
            row[dIdx++] = hasOE ? `${oeAtt} (${stu.oeSubject})` : 0;
            row[dIdx++] = (hasOE && oeT > 0) ? ((oeAtt / oeT) * 100).toFixed(2) : (hasOE ? "0.00" : "—");
            if (hasOE) {
              totalAtt += oeAtt;
              totalSessions += oeT;
            }
          }
          if (maxOELabTot > 0) {
            row[dIdx++] = hasOE ? `${oeLabAtt} (${stu.oeSubject})` : 0;
            row[dIdx++] = (hasOE && oeLabTot > 0) ? ((oeLabAtt / oeLabTot) * 100).toFixed(2) : (hasOE ? "0.00" : "—");
            if (hasOE) {
              totalAtt += oeLabAtt;
              totalSessions += oeLabTot;
            }
          }
          if (hasOEBoth) {
            row[dIdx++] = (hasOE && (oeT + oeLabTot) > 0) ? (((oeAtt + oeLabAtt) / (oeT + oeLabTot)) * 100).toFixed(2) : (hasOE ? "0.00" : "—");
          }
        }
      }

      // Student DE data
      if (isDEVisible) {
        const hasDE = stu.deSubject && stu.deSubject !== '';
        const deAtt = Number(stu.de_att || 0);
        const deT = Number(stu.de_tot || 0);
        const deLabAtt = Number(stu.de_lab_att || 0);
        const deLabTot = Number(stu.de_lab_tot || 0);

        if (mode === 'theory') {
          row[dIdx++] = hasDE && maxDEThTot > 0 ? `${deAtt} (${stu.deSubject})` : 0;
          row[dIdx++] = (hasDE && deT > 0) ? ((deAtt / deT) * 100).toFixed(2) : "0.00";
          if (hasDE) {
            totalAtt += deAtt;
            totalSessions += deT;
          }
        } else if (mode === 'lab') {
          row[dIdx++] = hasDE && maxDELabTot > 0 ? `${deLabAtt} (${stu.deSubject})` : 0;
          row[dIdx++] = (hasDE && deLabTot > 0) ? ((deLabAtt / deLabTot) * 100).toFixed(2) : "0.00";
          if (hasDE) {
            totalAtt += deLabAtt;
            totalSessions += deLabTot;
          }
        } else if (mode === 'count') {
          if (maxDEThTot > 0) {
            row[dIdx++] = hasDE ? `${deAtt} (${stu.deSubject})` : 0;
            if (hasDE) {
              totalAtt += deAtt;
              totalSessions += deT;
            }
          }
          if (maxDELabTot > 0) {
            row[dIdx++] = hasDE ? `${deLabAtt} (${stu.deSubject})` : 0;
            if (hasDE) {
              totalAtt += deLabAtt;
              totalSessions += deLabTot;
            }
          }
        } else {
          // full
          const hasDEBoth = maxDEThTot > 0 && maxDELabTot > 0;
          if (maxDEThTot > 0) {
            row[dIdx++] = hasDE ? `${deAtt} (${stu.deSubject})` : 0;
            row[dIdx++] = (hasDE && deT > 0) ? ((deAtt / deT) * 100).toFixed(2) : (hasDE ? "0.00" : "—");
            if (hasDE) {
              totalAtt += deAtt;
              totalSessions += deT;
            }
          }
          if (maxDELabTot > 0) {
            row[dIdx++] = hasDE ? `${deLabAtt} (${stu.deSubject})` : 0;
            row[dIdx++] = (hasDE && deLabTot > 0) ? ((deLabAtt / deLabTot) * 100).toFixed(2) : (hasDE ? "0.00" : "—");
            if (hasDE) {
              totalAtt += deLabAtt;
              totalSessions += deLabTot;
            }
          }
          if (hasDEBoth) {
            row[dIdx++] = (hasDE && (deT + deLabTot) > 0) ? (((deAtt + deLabAtt) / (deT + deLabTot)) * 100).toFixed(2) : (hasDE ? "0.00" : "—");
          }
        }
      }

      // Student PE data
      if (isPEVisible) {
        const addPESet = (thAtt, thTot, labAtt, labTot, subjectName, maxThTot, maxLabTot) => {
          if (mode === 'theory' && maxThTot === 0) return;
          if (mode === 'lab'    && maxLabTot === 0) return;
          const has = !!subjectName;
          const hasBoth = maxThTot > 0 && maxLabTot > 0;
          if (mode === 'theory') {
            row[dIdx++] = has && maxThTot > 0 ? `${thAtt} (${subjectName})` : 0;
            row[dIdx++] = has && thTot > 0 ? ((thAtt / thTot) * 100).toFixed(2) : "0.00";
            if (has) { totalAtt += thAtt; totalSessions += thTot; }
          } else if (mode === 'lab') {
            row[dIdx++] = has && maxLabTot > 0 ? `${labAtt} (${subjectName})` : 0;
            row[dIdx++] = has && labTot > 0 ? ((labAtt / labTot) * 100).toFixed(2) : "0.00";
            if (has) { totalAtt += labAtt; totalSessions += labTot; }
          } else if (mode === 'count') {
            if (maxThTot > 0)  { row[dIdx++] = has ? `${thAtt} (${subjectName})` : 0; if (has) { totalAtt += thAtt; totalSessions += thTot; } }
            if (maxLabTot > 0) { row[dIdx++] = has ? `${labAtt} (${subjectName})` : 0; if (has) { totalAtt += labAtt; totalSessions += labTot; } }
          } else {
            if (maxThTot > 0)  { row[dIdx++] = has ? `${thAtt} (${subjectName})` : 0; row[dIdx++] = has && thTot > 0 ? ((thAtt / thTot) * 100).toFixed(2) : "—"; if (has) { totalAtt += thAtt; totalSessions += thTot; } }
            if (maxLabTot > 0) { row[dIdx++] = has ? `${labAtt} (${subjectName})` : 0; row[dIdx++] = has && labTot > 0 ? ((labAtt / labTot) * 100).toFixed(2) : "—"; if (has) { totalAtt += labAtt; totalSessions += labTot; } }
            if (hasBoth) { row[dIdx++] = has && (thTot + labTot) > 0 ? (((thAtt + labAtt) / (thTot + labTot)) * 100).toFixed(2) : "—"; }
          }
        };
        addPESet(Number(stu.pe1_att || 0), Number(stu.pe1_tot || 0), Number(stu.pe1_lab_att || 0), Number(stu.pe1_lab_tot || 0), stu.pe1Subject, maxPE1ThTot, maxPE1LabTot);
        addPESet(Number(stu.pe2_att || 0), Number(stu.pe2_tot || 0), Number(stu.pe2_lab_att || 0), Number(stu.pe2_lab_tot || 0), stu.pe2Subject, maxPE2ThTot, maxPE2LabTot);
      }

      row[dIdx++] = totalAtt;
      row[dIdx++] = totalSessions > 0 ? ((totalAtt / totalSessions) * 100).toFixed(2) : "0.00";
      aoa.push(row);
    });

    aoa.push([]);
    aoa.push([`Prof. ${user?.name || "Class Teacher"}`, "", "", "Dr. Kriti Srivatava"]);
    aoa.push(["Class Teacher", "", "", "Head of the Department"]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    return ws;
  };

  const handleDownloadExcel = () => {
    if (!reportStudents.length) return;
    const wb = XLSX.utils.book_new();

    const modes = [
      { id: 'full', label: 'Full Report' },
      { id: 'theory', label: 'Theory Only' },
      { id: 'lab', label: 'Lab Only' },
      { id: 'count', label: 'Lecture Counts' }
    ];

    modes.forEach(m => {
      const ws = generateSheetData(m.id);
      if (ws) XLSX.utils.book_append_sheet(wb, ws, m.label);
    });

    XLSX.writeFile(wb, `Consolidated_Attendance_${assignedClass?.name || "Report"}.xlsx`);
  };

  const handleDownloadPDF = () => {
    if (!reportStudents.length) return;
    
    const doc = new jsPDF('landscape');
    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
    
    doc.setFontSize(14);
    doc.text(`Department of Computer Science and Engineering (Data Science)`, 14, 15);
    doc.setFontSize(11);
    doc.text(`Class: ${assignedClass?.name || "N/A"}`, 14, 22);
    doc.text(`Attendance Report (${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}) - AY ${academicYear}. Threshold: ${threshold}%`, 14, 28);
    
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
    
    doc.save(`Attendance_Report_${assignedClass?.name || "Class"}_${viewMode}.pdf`);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      // Process pending uploads
      for (const upload of pendingUploads) {
        await generateUploadReport(upload._id);
      }

      // Fetch consolidated report
      const data = await fetchConsolidatedReport(assignedClass.year, assignedClass.division);
      
      // Also re-fetch uploads to clear pending status
      const uploadsData = await fetchAdminUploads(user.id);
      const pending = (uploadsData.uploads || []).filter(u => u.status === 'pending');
      setPendingUploads(pending);
      
      if (data.students && data.students.length > 0) {
        setReportSubjects(data.subjects || []);
        setReportStudents(data.students || []);
        setOeSubjects(data.oeSubjects || []);
        setPeSubjects(data.peSubjects || []);
        setIsGenerated(true);
      } else {
        setError("report not generated since no student data found");
      }

      setIsGenerating(false);
    } catch (err) {
      console.error(err);
      setError("Failed to generate report. Please try again.");
      setIsGenerating(false);
    }
  };

  const viewOptions = [
    { value: 'theory', label: 'Theory Only', desc: 'Lecture count + Theory % per subject' },
    { value: 'lab', label: 'Lab Only', desc: 'Lab count + Lab % per subject' },
    { value: 'count', label: 'Lecture Counts Only', desc: 'Attended lectures count without subject percentages' },
    { value: 'full', label: 'Full Report', desc: 'Theory, Lab counts & all percentages' },
  ];

  const totalThTot = reportSubjects.reduce((s, sub) => s + (sub.th_tot || 0), 0);
  const totalLbTot = reportSubjects.reduce((s, sub) => s + (sub.lab_tot || 0), 0);

  return (
    <div className="fade-in space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">Consolidated Attendance Report</h2>
          <p className="text-slate-600 dark:text-slate-300 mt-1 text-sm sm:text-base">
            Class: <span className="font-semibold text-blue-600">{assignedClass?.name || "Your Class"}</span>
          </p>
        </div>
        {isGenerated && (
          <div className="flex items-center gap-2 fade-in">
            <button 
              onClick={handleDownloadPDF}
              className="btn btn-danger flex items-center gap-2 shadow-sm whitespace-nowrap"
              style={{ backgroundColor: '#dc3545', color: 'white', borderColor: '#dc3545' }}
            >
              <FileText size={18} /> Download PDF
            </button>
            <button 
              onClick={handleDownloadExcel}
              className="btn btn-success flex items-center gap-2 shadow-sm whitespace-nowrap"
            >
              <Download size={18} /> Download Excel
            </button>
          </div>
        )}
      </div>

      {!isGenerated ? (
        /* ── Generate prompt ── */
        <div className="bg-white dark:bg-[#112240] border border-slate-100 dark:border-slate-700 shadow-sm rounded-xl p-6 sm:p-16 text-center mt-4 sm:mt-6 fade-in transition-colors glass-3d-card">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-50 dark:bg-blue-900/30 text-slate-800 dark:text-slate-200 font-bold rounded-full flex items-center justify-center mx-auto mb-6">
            <BarChart size={32} className="sm:w-[40px] sm:h-[40px]" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white mb-2">Generate Final Report</h3>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mb-8 max-w-md mx-auto">
            This will merge all recent attendance sheets uploaded by the faculty for {assignedClass?.name} and calculate theory, lab, and combined metrics.
          </p>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !assignedClass}
            className="btn btn-primary w-full sm:w-auto px-6 sm:px-8 py-3 font-semibold shadow-sm transition-all flex items-center justify-center mx-auto min-w-0 sm:min-w-[200px]"
          >
            {isGenerating ? (
              <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Processing...</>
            ) : 'Generate Report'}
          </button>
          {error && <p className="text-danger mt-2">{error}</p>}
        </div>
      ) : (
        /* ── Report section ── */
        <div className="fade-in space-y-4 mt-2">
          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/20 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
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

          {(() => {
            const hasOEThData = reportStudents.some(s => s.oeSubject && Number(s.oe_tot || 0) > 0);
            const hasDEThData = reportStudents.some(s => s.deSubject && Number(s.de_tot || 0) > 0);
            const hasPEThData = reportStudents.some(s => (s.pe1Subject && Number(s.pe1_tot || 0) > 0) || (s.pe2Subject && Number(s.pe2_tot || 0) > 0));
            const hasTheoryData = totalThTot > 0 || hasOEThData || hasDEThData || hasPEThData;

            const hasOELabData = reportStudents.some(s => s.oeSubject && Number(s.oe_lab_tot || 0) > 0);
            const hasDELabData = reportStudents.some(s => s.deSubject && Number(s.de_lab_tot || 0) > 0);
            const hasPELabData = reportStudents.some(s => (s.pe1Subject && Number(s.pe1_lab_tot || 0) > 0) || (s.pe2Subject && Number(s.pe2_lab_tot || 0) > 0));
            const hasLabData = totalLbTot > 0 || hasOELabData || hasDELabData || hasPELabData;

            if (viewMode === 'theory' && !hasTheoryData) {
              return (
                <div className="bg-white dark:bg-[#112240] border border-slate-100 dark:border-slate-700 shadow-sm rounded-xl p-12 text-center mt-4 fade-in glass-3d-card">
                  <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-slate-400 dark:text-slate-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BarChart size={32} />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white mb-2">No Theory Data</h3>
                  <p className="text-slate-600 dark:text-slate-300">No theory attendance data has been uploaded for this class yet.</p>
                </div>
              );
            }
            if (viewMode === 'lab' && !hasLabData) {
              return (
                <div className="bg-white dark:bg-[#112240] border border-slate-100 dark:border-slate-700 shadow-sm rounded-xl p-12 text-center mt-4 fade-in glass-3d-card">
                  <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-slate-400 dark:text-slate-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BarChart size={32} />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white mb-2">No Lab Data</h3>
                  <p className="text-slate-600 dark:text-slate-300">No lab attendance data has been uploaded for this class yet.</p>
                </div>
              );
            }
            return (
              <AttendanceReportTable 
                students={reportStudents}
                subjects={reportSubjects}
                oeSubjects={oeSubjects}
                peSubjects={peSubjects}
                viewMode={viewMode}
                totalThTot={totalThTot}
                totalLbTot={totalLbTot}
                threshold={threshold}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default AttendanceReports;
