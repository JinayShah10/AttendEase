import React, { useMemo } from 'react';
import { 
  calculateAttendancePercentageValue, 
  isLowAttendance, 
  calculateOverallAttendance 
} from '../../../utils/attendanceHelpers';

const AttendanceReportTable = ({ 
  students, 
  subjects, 
  viewMode, 
  totalThTot,
  totalLbTot,
  threshold = 75
}) => {
  const activeSubjects = useMemo(() => {
    return subjects.filter(sub => {
      if (viewMode === 'theory') return Number(sub.th_tot || 0) > 0;
      if (viewMode === 'lab') return Number(sub.lab_tot || 0) > 0;
      if (viewMode === 'count') return (
        Number(sub.th_tot || 0) > 0 || Number(sub.lab_tot || 0) > 0
      );
      // full mode
      return Number(sub.th_tot || 0) > 0 || Number(sub.lab_tot || 0) > 0;
    });
  }, [subjects, viewMode]);

  // Derive OE visibility from actual student data
  const showOE = useMemo(() => {
    return students.some(s => s.oeSubject && (Number(s.oe_tot || 0) > 0 || Number(s.oe_lab_tot || 0) > 0));
  }, [students]);

  const maxOEThTot = useMemo(() => {
    if (!showOE) return 0;
    return Math.max(...students.map(s => Number(s.oe_tot || 0)), 0);
  }, [students, showOE]);

  const maxOELabTot = useMemo(() => {
    if (!showOE) return 0;
    return Math.max(...students.map(s => Number(s.oe_lab_tot || 0)), 0);
  }, [students, showOE]);

  const isOEVisible = useMemo(() => {
    if (!showOE) return false;
    if (viewMode === 'theory') return maxOEThTot > 0;
    if (viewMode === 'lab') return maxOELabTot > 0;
    return maxOEThTot > 0 || maxOELabTot > 0;
  }, [showOE, viewMode, maxOEThTot, maxOELabTot]);

  const renderOESubHeaders = () => {
    if (!isOEVisible) return null;
    const hasOEBoth = maxOEThTot > 0 && maxOELabTot > 0;

    if (viewMode === 'theory') return (
      <React.Fragment key="oe-sub-theory">
        <th className="border-l font-semibold text-[11px]">Lec Att<div className="font-normal normal-case opacity-60 mt-0.5">{maxOEThTot} total</div></th>
        <th className="font-semibold text-[11px] border-r">Theory %</th>
      </React.Fragment>
    );
    if (viewMode === 'lab') return (
      <React.Fragment key="oe-sub-lab">
        <th className="border-l font-semibold text-[11px]">Lab Att<div className="font-normal normal-case opacity-60 mt-0.5">{maxOELabTot} total</div></th>
        <th className="font-semibold text-[11px] border-r">Lab %</th>
      </React.Fragment>
    );
    if (viewMode === 'count') return (
      <React.Fragment key="oe-sub-count">
        {maxOEThTot > 0 && <th className="border-l font-medium text-[11px]">Th Att<div className="font-normal normal-case opacity-60 mt-0.5">{maxOEThTot} Lec</div></th>}
        {maxOELabTot > 0 && <th className={`font-medium text-[11px] border-r ${maxOEThTot === 0 ? 'border-l' : ''}`}>Lab Att<div className="font-normal normal-case opacity-60 mt-0.5">{maxOELabTot} Labs</div></th>}
      </React.Fragment>
    );
    // full mode
    return (
      <React.Fragment key="oe-sub-full">
        {maxOEThTot > 0 && (
          <>
            <th className="border-l font-medium text-[11px]">{hasOEBoth ? 'Th Att' : 'Lec Att'}<div className="font-normal normal-case opacity-60 mt-0.5">{maxOEThTot} Lec</div></th>
            <th className="font-semibold text-[11px]">{hasOEBoth ? 'Th %' : 'Theory %'}</th>
          </>
        )}
        {maxOELabTot > 0 && (
          <>
            <th className={`font-medium text-[11px] ${maxOEThTot === 0 ? 'border-l' : ''}`}>{hasOEBoth ? 'Lab Att' : 'Lab Att'}<div className="font-normal normal-case opacity-60 mt-0.5">{maxOELabTot} Labs</div></th>
            <th className="font-semibold text-[11px]">{hasOEBoth ? 'Lab %' : 'Lab %'}</th>
          </>
        )}
        {hasOEBoth && <th className="font-semibold text-[11px] border-r">Comb %</th>}
      </React.Fragment>
    );
  };

  const renderOECells = (stu) => {
    if (!isOEVisible) return null;
    const hasOE = stu.oeSubject && stu.oeSubject !== '';
    const oeAtt = Number(stu.oe_att || 0);
    const oeTot = Number(stu.oe_tot || 0);
    const oeLabAtt = Number(stu.oe_lab_att || 0);
    const oeLabTot = Number(stu.oe_lab_tot || 0);
    const hasOEBoth = maxOEThTot > 0 && maxOELabTot > 0;

    const isTheoryLow = hasOE && oeTot > 0 ? isLowAttendance(oeAtt, oeTot, threshold) : false;
    const isLabLow = hasOE && oeLabTot > 0 ? isLowAttendance(oeLabAtt, oeLabTot, threshold) : false;
    const isCombLow = hasOE && (oeTot + oeLabTot) > 0 ? isLowAttendance(oeAtt + oeLabAtt, oeTot + oeLabTot, threshold) : false;

    const renderBadge = () => (
      <div className="mt-1 inline-block px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-[9px] font-bold border border-indigo-100 dark:border-indigo-800/50 uppercase tracking-tight transition-transform hover:scale-105 cursor-default shadow-sm">
        {stu.oeSubject}
      </div>
    );

    if (viewMode === 'theory') {
      return (
        <React.Fragment key="oe-cells-theory">
          <td className={`border-l ${isTheoryLow ? redCell : ''}`}>
            {hasOE && maxOEThTot > 0 ? (
              <>
                <div className="font-bold text-slate-800 dark:text-slate-200">{oeAtt}</div>
                {renderBadge()}
              </>
            ) : (
              <span className="text-slate-300">—</span>
            )}
          </td>
          <td className={`border-r ${isTheoryLow ? redCell : 'font-bold text-slate-700 dark:text-slate-300'}`}>
            {hasOE && oeTot > 0 ? `${calculateAttendancePercentageValue(oeAtt, oeTot)}%` : '--'}
          </td>
        </React.Fragment>
      );
    }

    if (viewMode === 'lab') {
      return (
        <React.Fragment key="oe-cells-lab">
          <td className={`border-l ${isLabLow ? redCell : ''}`}>
            {hasOE && maxOELabTot > 0 ? (
              <>
                <div className="font-bold text-slate-800 dark:text-slate-200">{oeLabAtt}</div>
                {renderBadge()}
              </>
            ) : (
              <span className="text-slate-300">—</span>
            )}
          </td>
          <td className={`border-r ${isLabLow ? redCell : 'font-bold text-slate-700 dark:text-slate-300'}`}>
            {hasOE && oeLabTot > 0 ? `${calculateAttendancePercentageValue(oeLabAtt, oeLabTot)}%` : '--'}
          </td>
        </React.Fragment>
      );
    }

    if (viewMode === 'count') {
      return (
        <React.Fragment key="oe-cells-count">
          {maxOEThTot > 0 && (
            <td className={`border-l ${maxOELabTot === 0 ? 'border-r' : ''} ${isTheoryLow ? redCell : ''}`}>
              {hasOE ? (
                <>
                  <div className="font-bold text-slate-800 dark:text-slate-200">{oeAtt}</div>
                  {renderBadge()}
                </>
              ) : (
                <span className="text-slate-300">—</span>
              )}
            </td>
          )}
          {maxOELabTot > 0 && (
            <td className={`border-r ${maxOEThTot === 0 ? 'border-l' : ''} ${isLabLow ? redCell : ''}`}>
              {hasOE ? (
                <>
                  <div className="font-bold text-slate-800 dark:text-slate-200">{oeLabAtt}</div>
                  {maxOEThTot === 0 && renderBadge()}
                </>
              ) : (
                <span className="text-slate-300">—</span>
              )}
            </td>
          )}
        </React.Fragment>
      );
    }

    // full mode
    return (
      <React.Fragment key="oe-cells-full">
        {maxOEThTot > 0 && (
          <>
            <td className={`border-l ${isTheoryLow ? redCell : ''}`}>
              {hasOE ? (
                <>
                  <div className="font-bold text-slate-800 dark:text-slate-200">{oeAtt}</div>
                  {renderBadge()}
                </>
              ) : (
                <span className="text-slate-300">—</span>
              )}
            </td>
            <td className={`${isTheoryLow ? redCell : 'font-bold text-slate-700 dark:text-slate-300'}`}>
              {hasOE && oeTot > 0 ? `${calculateAttendancePercentageValue(oeAtt, oeTot)}%` : '--'}
            </td>
          </>
        )}
        {maxOELabTot > 0 && (
          <>
            <td className={`${maxOEThTot === 0 ? 'border-l' : ''} ${isLabLow ? redCell : ''}`}>
              {hasOE ? (
                <>
                  <div className="font-bold text-slate-800 dark:text-slate-200">{oeLabAtt}</div>
                  {maxOEThTot === 0 && renderBadge()}
                </>
              ) : (
                <span className="text-slate-300">—</span>
              )}
            </td>
            <td className={`${isLabLow ? redCell : 'font-bold text-slate-700 dark:text-slate-300'}`}>
              {hasOE && oeLabTot > 0 ? `${calculateAttendancePercentageValue(oeLabAtt, oeLabTot)}%` : '--'}
            </td>
          </>
        )}
        {hasOEBoth && (
          <td className={`border-r ${isCombLow ? redCell : 'font-bold text-slate-700 dark:text-slate-300'}`}>
            {hasOE && (oeTot + oeLabTot) > 0 ? `${calculateAttendancePercentageValue(oeAtt + oeLabAtt, oeTot + oeLabTot)}%` : '--'}
          </td>
        )}
      </React.Fragment>
    );
  };

  // Derive DE visibility from actual student data
  const showDE = useMemo(() => {
    return students.some(s => s.deSubject && (Number(s.de_tot || 0) > 0 || Number(s.de_lab_tot || 0) > 0));
  }, [students]);

  // ── Program Elective (PE) visibility ──
  const showPE = useMemo(() => {
    return students.some(s =>
      (s.pe1Subject && (Number(s.pe1_tot || 0) > 0 || Number(s.pe1_lab_tot || 0) > 0)) ||
      (s.pe2Subject && (Number(s.pe2_tot || 0) > 0 || Number(s.pe2_lab_tot || 0) > 0))
    );
  }, [students]);

  const maxPE1ThTot  = useMemo(() => !showPE ? 0 : Math.max(...students.map(s => Number(s.pe1_tot     || 0)), 0), [students, showPE]);
  const maxPE1LabTot = useMemo(() => !showPE ? 0 : Math.max(...students.map(s => Number(s.pe1_lab_tot || 0)), 0), [students, showPE]);
  const maxPE2ThTot  = useMemo(() => !showPE ? 0 : Math.max(...students.map(s => Number(s.pe2_tot     || 0)), 0), [students, showPE]);
  const maxPE2LabTot = useMemo(() => !showPE ? 0 : Math.max(...students.map(s => Number(s.pe2_lab_tot || 0)), 0), [students, showPE]);

  const isPEVisible = useMemo(() => {
    if (!showPE) return false;
    if (viewMode === 'theory') return maxPE1ThTot > 0 || maxPE2ThTot > 0;
    if (viewMode === 'lab')    return maxPE1LabTot > 0 || maxPE2LabTot > 0;
    return maxPE1ThTot > 0 || maxPE1LabTot > 0 || maxPE2ThTot > 0 || maxPE2LabTot > 0;
  }, [showPE, viewMode, maxPE1ThTot, maxPE1LabTot, maxPE2ThTot, maxPE2LabTot]);

  /** Renders sub-header <th>s for Program Electives (SET1 + SET2) */
  const renderPESubHeaders = () => {
    if (!isPEVisible) return null;
    const renderSetHeaders = (maxThTot, maxLabTot, setLabel) => {
      const hasBoth = maxThTot > 0 && maxLabTot > 0;
      const borderLabel = `${setLabel} `;
      if (viewMode === 'theory' && maxThTot === 0) return null;
      if (viewMode === 'lab'    && maxLabTot === 0) return null;
      return (
        <React.Fragment key={`pe-sub-${setLabel}`}>
          {(viewMode !== 'lab') && maxThTot > 0 && (
            <>
              <th className="border-l font-medium text-[11px]">{hasBoth ? 'Th Att' : 'Lec Att'}<div className="font-normal normal-case opacity-60 mt-0.5">{borderLabel}{maxThTot} Lec</div></th>
              {viewMode !== 'count' && <th className="font-semibold text-[11px]">{hasBoth ? 'Th %' : 'Theory %'}</th>}
            </>
          )}
          {(viewMode !== 'theory') && maxLabTot > 0 && (
            <>
              <th className={`font-medium text-[11px] ${maxThTot === 0 || viewMode === 'lab' ? 'border-l' : ''}`}>{hasBoth ? 'Lab Att' : 'Lab Att'}<div className="font-normal normal-case opacity-60 mt-0.5">{borderLabel}{maxLabTot} Labs</div></th>
              {viewMode !== 'count' && <th className="font-semibold text-[11px] border-r">{hasBoth ? 'Lab %' : 'Lab %'}</th>}
            </>
          )}
          {viewMode === 'full' && hasBoth && <th className="font-semibold text-[11px] border-r">Comb %</th>}
        </React.Fragment>
      );
    };
    return (
      <React.Fragment key="pe-sub-headers">
        {renderSetHeaders(maxPE1ThTot, maxPE1LabTot, 'SET1')}
        {renderSetHeaders(maxPE2ThTot, maxPE2LabTot, 'SET2')}
      </React.Fragment>
    );
  };

  /** Renders data cells for Program Electives (SET1 + SET2) for a given student */
  const renderPECells = (stu) => {
    if (!isPEVisible) return null;

    const renderSetCells = (setKey, thAtt, thTot, labAtt, labTot, subjectName, maxThTot, maxLabTot) => {
      if (viewMode === 'theory' && maxThTot === 0) return null;
      if (viewMode === 'lab'    && maxLabTot === 0) return null;
      const hasData = !!subjectName;
      const hasBoth = maxThTot > 0 && maxLabTot > 0;
      const isThLow  = hasData && thTot  > 0 ? isLowAttendance(thAtt,  thTot,  threshold) : false;
      const isLabLow = hasData && labTot > 0 ? isLowAttendance(labAtt, labTot, threshold) : false;
      const isCombLow = hasData && (thTot + labTot) > 0 ? isLowAttendance(thAtt + labAtt, thTot + labTot, threshold) : false;

      const badge = hasData ? (
        <div className="mt-1 inline-block px-1.5 py-0.5 bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded text-[9px] font-bold border border-violet-100 dark:border-violet-800/50 uppercase tracking-tight transition-transform hover:scale-105 cursor-default shadow-sm">
          {subjectName}
        </div>
      ) : null;

      return (
        <React.Fragment key={`pe-cells-${setKey}`}>
          {(viewMode !== 'lab') && maxThTot > 0 && (
            <td className={`border-l ${isThLow ? redCell : ''}`}>
              {hasData ? (<><div className="font-bold text-slate-800 dark:text-slate-200">{thAtt}</div>{badge}</>) : (<span className="text-slate-300">—</span>)}
            </td>
          )}
          {(viewMode !== 'lab') && maxThTot > 0 && viewMode !== 'count' && (
            <td className={`${isThLow ? redCell : 'font-bold text-slate-700 dark:text-slate-300'}`}>
              {hasData && thTot > 0 ? `${calculateAttendancePercentageValue(thAtt, thTot)}%` : '--'}
            </td>
          )}
          {(viewMode !== 'theory') && maxLabTot > 0 && (
            <td className={`${maxThTot === 0 || viewMode === 'lab' ? 'border-l' : ''} ${isLabLow ? redCell : ''}`}>
              {hasData ? (<><div className="font-bold text-slate-800 dark:text-slate-200">{labAtt}</div>{maxThTot === 0 && badge}</>) : (<span className="text-slate-300">—</span>)}
            </td>
          )}
          {(viewMode !== 'theory') && maxLabTot > 0 && viewMode !== 'count' && (
            <td className={`border-r ${isLabLow ? redCell : 'font-bold text-slate-700 dark:text-slate-300'}`}>
              {hasData && labTot > 0 ? `${calculateAttendancePercentageValue(labAtt, labTot)}%` : '--'}
            </td>
          )}
          {viewMode === 'full' && hasBoth && (
            <td className={`border-r ${isCombLow ? redCell : 'font-bold text-slate-700 dark:text-slate-300'}`}>
              {hasData && (thTot + labTot) > 0 ? `${calculateAttendancePercentageValue(thAtt + labAtt, thTot + labTot)}%` : '--'}
            </td>
          )}
        </React.Fragment>
      );
    };

    return (
      <React.Fragment key="pe-cells">
        {renderSetCells('set1', Number(stu.pe1_att || 0), Number(stu.pe1_tot || 0), Number(stu.pe1_lab_att || 0), Number(stu.pe1_lab_tot || 0), stu.pe1Subject, maxPE1ThTot, maxPE1LabTot)}
        {renderSetCells('set2', Number(stu.pe2_att || 0), Number(stu.pe2_tot || 0), Number(stu.pe2_lab_att || 0), Number(stu.pe2_lab_tot || 0), stu.pe2Subject, maxPE2ThTot, maxPE2LabTot)}
      </React.Fragment>
    );
  };

  const maxDEThTot = useMemo(() => {
    if (!showDE) return 0;
    return Math.max(...students.map(s => Number(s.de_tot || 0)), 0);
  }, [students, showDE]);

  const maxDELabTot = useMemo(() => {
    if (!showDE) return 0;
    return Math.max(...students.map(s => Number(s.de_lab_tot || 0)), 0);
  }, [students, showDE]);

  const isDEVisible = useMemo(() => {
    if (!showDE) return false;
    if (viewMode === 'theory') return maxDEThTot > 0;
    if (viewMode === 'lab') return maxDELabTot > 0;
    return maxDEThTot > 0 || maxDELabTot > 0;
  }, [showDE, viewMode, maxDEThTot, maxDELabTot]);

  const renderDESubHeaders = () => {
    if (!isDEVisible) return null;
    const hasDEBoth = maxDEThTot > 0 && maxDELabTot > 0;

    if (viewMode === 'theory') return (
      <React.Fragment key="de-sub-theory">
        <th className="border-l font-semibold text-[11px]">Lec Att<div className="font-normal normal-case opacity-60 mt-0.5">{maxDEThTot} total</div></th>
        <th className="font-semibold text-[11px] border-r">Theory %</th>
      </React.Fragment>
    );
    if (viewMode === 'lab') return (
      <React.Fragment key="de-sub-lab">
        <th className="border-l font-semibold text-[11px]">Lab Att<div className="font-normal normal-case opacity-60 mt-0.5">{maxDELabTot} total</div></th>
        <th className="font-semibold text-[11px] border-r">Lab %</th>
      </React.Fragment>
    );
    if (viewMode === 'count') return (
      <React.Fragment key="de-sub-count">
        {maxDEThTot > 0 && <th className="border-l font-medium text-[11px]">Th Att<div className="font-normal normal-case opacity-60 mt-0.5">{maxDEThTot} Lec</div></th>}
        {maxDELabTot > 0 && <th className={`font-medium text-[11px] border-r ${maxDEThTot === 0 ? 'border-l' : ''}`}>Lab Att<div className="font-normal normal-case opacity-60 mt-0.5">{maxDELabTot} Labs</div></th>}
      </React.Fragment>
    );
    // full mode
    return (
      <React.Fragment key="de-sub-full">
        {maxDEThTot > 0 && (
          <>
            <th className="border-l font-medium text-[11px]">{hasDEBoth ? 'Th Att' : 'Lec Att'}<div className="font-normal normal-case opacity-60 mt-0.5">{maxDEThTot} Lec</div></th>
            <th className="font-semibold text-[11px]">{hasDEBoth ? 'Th %' : 'Theory %'}</th>
          </>
        )}
        {maxDELabTot > 0 && (
          <>
            <th className={`font-medium text-[11px] ${maxDEThTot === 0 ? 'border-l' : ''}`}>{hasDEBoth ? 'Lab Att' : 'Lab Att'}<div className="font-normal normal-case opacity-60 mt-0.5">{maxDELabTot} Labs</div></th>
            <th className="font-semibold text-[11px]">{hasDEBoth ? 'Lab %' : 'Lab %'}</th>
          </>
        )}
        {hasDEBoth && <th className="font-semibold text-[11px] border-r">Comb %</th>}
      </React.Fragment>
    );
  };

  const renderDECells = (stu) => {
    if (!isDEVisible) return null;
    const hasDE = stu.deSubject && stu.deSubject !== '';
    const deAtt = Number(stu.de_att || 0);
    const deTot = Number(stu.de_tot || 0);
    const deLabAtt = Number(stu.de_lab_att || 0);
    const deLabTot = Number(stu.de_lab_tot || 0);
    const hasDEBoth = maxDEThTot > 0 && maxDELabTot > 0;

    const isTheoryLow = hasDE && deTot > 0 ? isLowAttendance(deAtt, deTot, threshold) : false;
    const isLabLow = hasDE && deLabTot > 0 ? isLowAttendance(deLabAtt, deLabTot, threshold) : false;
    const isCombLow = hasDE && (deTot + deLabTot) > 0 ? isLowAttendance(deAtt + deLabAtt, deTot + deLabTot, threshold) : false;

    const renderBadge = () => (
      <div className="mt-1 inline-block px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-[9px] font-bold border border-blue-100 dark:border-blue-800/50 uppercase tracking-tight transition-transform hover:scale-105 cursor-default shadow-sm">
        {stu.deSubject}
      </div>
    );

    if (viewMode === 'theory') {
      return (
        <React.Fragment key="de-cells-theory">
          <td className={`border-l ${isTheoryLow ? redCell : ''}`}>
            {hasDE && maxDEThTot > 0 ? (
              <>
                <div className="font-bold text-slate-800 dark:text-slate-200">{deAtt}</div>
                {renderBadge()}
              </>
            ) : (
              <span className="text-slate-300">—</span>
            )}
          </td>
          <td className={`border-r ${isTheoryLow ? redCell : 'font-bold text-slate-700 dark:text-slate-300'}`}>
            {hasDE && deTot > 0 ? `${calculateAttendancePercentageValue(deAtt, deTot)}%` : '--'}
          </td>
        </React.Fragment>
      );
    }

    if (viewMode === 'lab') {
      return (
        <React.Fragment key="de-cells-lab">
          <td className={`border-l ${isLabLow ? redCell : ''}`}>
            {hasDE && maxDELabTot > 0 ? (
              <>
                <div className="font-bold text-slate-800 dark:text-slate-200">{deLabAtt}</div>
                {renderBadge()}
              </>
            ) : (
              <span className="text-slate-300">—</span>
            )}
          </td>
          <td className={`border-r ${isLabLow ? redCell : 'font-bold text-slate-700 dark:text-slate-300'}`}>
            {hasDE && deLabTot > 0 ? `${calculateAttendancePercentageValue(deLabAtt, deLabTot)}%` : '--'}
          </td>
        </React.Fragment>
      );
    }

    if (viewMode === 'count') {
      return (
        <React.Fragment key="de-cells-count">
          {maxDEThTot > 0 && (
            <td className={`border-l ${maxDELabTot === 0 ? 'border-r' : ''} ${isTheoryLow ? redCell : ''}`}>
              {hasDE ? (
                <>
                  <div className="font-bold text-slate-800 dark:text-slate-200">{deAtt}</div>
                  {renderBadge()}
                </>
              ) : (
                <span className="text-slate-300">—</span>
              )}
            </td>
          )}
          {maxDELabTot > 0 && (
            <td className={`border-r ${maxDEThTot === 0 ? 'border-l' : ''} ${isLabLow ? redCell : ''}`}>
              {hasDE ? (
                <>
                  <div className="font-bold text-slate-800 dark:text-slate-200">{deLabAtt}</div>
                  {maxDEThTot === 0 && renderBadge()}
                </>
              ) : (
                <span className="text-slate-300">—</span>
              )}
            </td>
          )}
        </React.Fragment>
      );
    }

    // full mode
    return (
      <React.Fragment key="de-cells-full">
        {maxDEThTot > 0 && (
          <>
            <td className={`border-l ${isTheoryLow ? redCell : ''}`}>
              {hasDE ? (
                <>
                  <div className="font-bold text-slate-800 dark:text-slate-200">{deAtt}</div>
                  {renderBadge()}
                </>
              ) : (
                <span className="text-slate-300">—</span>
              )}
            </td>
            <td className={`${isTheoryLow ? redCell : 'font-bold text-slate-700 dark:text-slate-300'}`}>
              {hasDE && deTot > 0 ? `${calculateAttendancePercentageValue(deAtt, deTot)}%` : '--'}
            </td>
          </>
        )}
        {maxDELabTot > 0 && (
          <>
            <td className={`${maxDEThTot === 0 ? 'border-l' : ''} ${isLabLow ? redCell : ''}`}>
              {hasDE ? (
                <>
                  <div className="font-bold text-slate-800 dark:text-slate-200">{deLabAtt}</div>
                  {maxDEThTot === 0 && renderBadge()}
                </>
              ) : (
                <span className="text-slate-300">—</span>
              )}
            </td>
            <td className={`${isLabLow ? redCell : 'font-bold text-slate-700 dark:text-slate-300'}`}>
              {hasDE && deLabTot > 0 ? `${calculateAttendancePercentageValue(deLabAtt, deLabTot)}%` : '--'}
            </td>
          </>
        )}
        {hasDEBoth && (
          <td className={`border-r ${isCombLow ? redCell : 'font-bold text-slate-700 dark:text-slate-300'}`}>
            {hasDE && (deTot + deLabTot) > 0 ? `${calculateAttendancePercentageValue(deAtt + deLabAtt, deTot + deLabTot)}%` : '--'}
          </td>
        )}
      </React.Fragment>
    );
  };

  const renderSubHeaders = () => activeSubjects.map(sub => {
    const ct = sub.th_tot, cl = sub.lab_tot;
    const hasBoth = ct > 0 && cl > 0;

    if (viewMode === 'theory') return (
      <React.Fragment key={sub.key}>
        <th className="border-l font-semibold text-[11px]">Lec Att<div className="font-normal normal-case opacity-60 mt-0.5">{ct} total</div></th>
        <th className="font-semibold text-[11px] border-r">Theory %</th>
      </React.Fragment>
    );
    if (viewMode === 'lab') return (
      <React.Fragment key={sub.key}>
        <th className="border-l font-semibold text-[11px]">Lab Att<div className="font-normal normal-case opacity-60 mt-0.5">{cl} total</div></th>
        <th className="font-semibold text-[11px] border-r">Lab %</th>
      </React.Fragment>
    );
    if (viewMode === 'count') return (
      <React.Fragment key={sub.key}>
        {ct > 0 && <th className="border-l font-medium text-[11px]">Th Att<div className="font-normal normal-case opacity-60 mt-0.5">{ct} Lec</div></th>}
        {cl > 0 && <th className={`font-medium text-[11px] border-r ${ct === 0 ? 'border-l' : ''}`}>Lab Att<div className="font-normal normal-case opacity-60 mt-0.5">{cl} Labs</div></th>}
      </React.Fragment>
    );
    if (sub.isOE) return (
      <React.Fragment key={sub.key}>
        <th className="border-l font-semibold text-[11px]">OE Att<div className="font-normal normal-case opacity-60 mt-0.5">(mixed)</div></th>
        <th className="font-semibold text-[11px] border-r">OE %</th>
      </React.Fragment>
    );

    return (
      <React.Fragment key={sub.key}>
        {ct > 0 && (
          <>
            <th className="border-l font-medium text-[11px]">{hasBoth ? 'Th Att' : 'Lec Att'}<div className="font-normal normal-case opacity-60 mt-0.5">{ct} Lec</div></th>
            <th className="font-semibold text-[11px]">{hasBoth ? 'Th %' : 'Theory %'}</th>
          </>
        )}
        {cl > 0 && (
          <>
            <th className={`font-medium text-[11px] ${ct === 0 ? 'border-l' : ''}`}>{hasBoth ? 'Lab Att' : 'Lab Att'}<div className="font-normal normal-case opacity-60 mt-0.5">{cl} Labs</div></th>
            <th className="font-semibold text-[11px]">{hasBoth ? 'Lab %' : 'Lab %'}</th>
          </>
        )}
        {hasBoth && <th className="font-semibold text-[11px] border-r">Comb %</th>}
      </React.Fragment>
    );
  });

  const redCell = 'bg-red-100 dark:bg-red-900/40 !text-red-600 dark:!text-red-400 !font-bold';

  const renderCells = (d, sub) => {
    const ct = Number(sub.th_tot || 0);
    const cl = Number(sub.lab_tot || 0);
    const hasBoth = ct > 0 && cl > 0;

    // Guard: if subject has no data for this viewMode, render nothing
    if (viewMode === 'theory' && ct === 0) return null;
    if (viewMode === 'lab' && cl === 0) return null;

    if (d && d.notOpted) {
      const showTheory = viewMode !== 'lab' && ct > 0;
      const showLab = viewMode !== 'theory' && cl > 0;
      const showComb = viewMode === 'full' && hasBoth;
      return (
        <>
          {showTheory && (
            <>
              <td className="border-l text-slate-300 font-bold">—</td>
              {viewMode !== 'count' && <td className="text-slate-300 font-bold">—</td>}
            </>
          )}
          {showLab && (
            <>
              <td className={`${!showTheory ? 'border-l' : ''} text-slate-300 font-bold`}>—</td>
              {viewMode !== 'count' && <td className="text-slate-300 font-bold">—</td>}
            </>
          )}
          {showComb && <td className="border-r text-slate-300 font-bold">—</td>}
        </>
      );
    }

    if (!d) {
      const showTheory = viewMode !== 'lab' && ct > 0;
      const showLab = viewMode !== 'theory' && cl > 0;
      const showComb = viewMode === 'full' && hasBoth;
      return (
        <>
          {showTheory && (
            <>
              <td className="border-l text-slate-400 font-normal italic">--</td>
              {viewMode !== 'count' && (
                <td className="text-slate-400 font-normal italic">0.0%</td>
              )}
            </>
          )}
          {showLab && (
            <>
              <td className={`${!showTheory ? 'border-l' : ''} text-slate-400 font-normal italic`}>--</td>
              {viewMode !== 'count' && (
                <td className="text-slate-400 font-normal italic">0.0%</td>
              )}
            </>
          )}
          {showComb && (
            <td className="border-r text-slate-400 font-normal italic">0.0%</td>
          )}
        </>
      );
    }

    if (sub.isOE) {
      const isOELow = isLowAttendance(d?.th_att, d?.th_tot, threshold);
      const hasOE = d?.oeName && d?.oeName !== '—';
      
      return (
        <>
          <td className={`border-l ${isOELow ? redCell : ''}`}>
            {hasOE ? (
              <>
                <div className="font-bold">{d.th_att}/{d.th_tot}</div>
                <div className="mt-1 px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-[9px] font-bold border border-indigo-100 dark:border-indigo-800/50 uppercase tracking-tight">
                  {d.oeName}
                </div>
              </>
            ) : (
              <span className="text-slate-300">—</span>
            )}
          </td>
          <td className={`border-r ${isOELow ? redCell : 'font-bold'}`}>
            {hasOE ? `${calculateAttendancePercentageValue(d.th_att, d.th_tot)}%` : '—'}
          </td>
        </>
      );
    }

    const isThLow = isLowAttendance(d.th_att, d.th_tot, threshold);
    const isLbLow = isLowAttendance(d.lab_att, d.lab_tot, threshold);

    if (viewMode === 'theory') return (
      <>
        <td className={`border-l ${isThLow ? redCell : ''}`}>{d.th_att}</td>
        <td className={`border-r ${isThLow ? redCell : 'font-bold'}`}>
          {calculateAttendancePercentageValue(d.th_att, d.th_tot)}%
        </td>
      </>
    );

    if (viewMode === 'lab') return (
      <>
        <td className={`border-l ${isLbLow ? redCell : ''}`}>{d.lab_att}</td>
        <td className={`border-r ${isLbLow ? redCell : 'font-bold'}`}>
          {calculateAttendancePercentageValue(d.lab_att, d.lab_tot)}%
        </td>
      </>
    );

    if (viewMode === 'count') return (
      <>
        {ct > 0 && (
          <td className={`border-l ${isThLow ? redCell : ''}`}>{d.th_att}</td>
        )}
        {cl > 0 && (
          <td className={`${ct === 0 ? 'border-l' : ''} border-r ${isLbLow ? redCell : ''}`}>
            {d.lab_att}
          </td>
        )}
      </>
    );

    // full mode
    const ca = Number(d.th_att || 0) + Number(d.lab_att || 0);
    const cTot = Number(d.th_tot || 0) + Number(d.lab_tot || 0);
    const isCombLow = isLowAttendance(ca, cTot, threshold);
    return (
      <>
        {ct > 0 && (
          <>
            <td className={`border-l ${isThLow ? redCell : ''}`}>{d.th_att}</td>
            <td className={isThLow ? redCell : 'font-bold'}>
              {calculateAttendancePercentageValue(d.th_att, d.th_tot)}%
            </td>
          </>
        )}
        {cl > 0 && (
          <>
            <td className={`${ct === 0 ? 'border-l' : ''} ${isLbLow ? redCell : ''}`}>
              {d.lab_att}
            </td>
            <td className={isLbLow ? redCell : 'font-bold'}>
              {calculateAttendancePercentageValue(d.lab_att, d.lab_tot)}%
            </td>
          </>
        )}
        {hasBoth && (
          <td className={`border-r ${isCombLow ? redCell : 'font-bold'}`}>
            {calculateAttendancePercentageValue(ca, cTot)}%
          </td>
        )}
      </>
    );
  };

  return (
    <div className="card shadow-sm border-0 rounded-xl overflow-hidden">
      <div className="table-responsive report-table-container max-h-[70vh] overflow-auto">
        <table id="attendance-report-table" className="table table-bordered align-middle mb-0 text-center whitespace-nowrap min-w-full" style={{ fontSize: '0.82rem' }}>
          <thead className="bg-slate-100 dark:bg-[#112240] border-b-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 sticky top-0 z-20">
            <tr>
              <th rowSpan="2" className="align-middle bg-slate-100 dark:bg-[#112240] dark:text-slate-200">Roll No</th>
              <th rowSpan="2" className="align-middle bg-slate-100 dark:bg-[#112240] dark:text-slate-200">SAP ID</th>
              <th rowSpan="2" className="align-middle bg-slate-100 dark:bg-[#112240] dark:text-slate-200 text-left" style={{ minWidth: 150 }}>Student Name</th>
              {activeSubjects.map(sub => {
                const ct = Number(sub.th_tot || 0), cl = Number(sub.lab_tot || 0);
                let colSpan = 0;
                if (viewMode === 'theory') colSpan = ct > 0 ? 2 : 0;
                else if (viewMode === 'lab') colSpan = cl > 0 ? 2 : 0;
                else if (viewMode === 'count') {
                  if (ct > 0) colSpan++;
                  if (cl > 0) colSpan++;
                } else {
                  // full mode
                  if (ct > 0) colSpan += 2;
                  if (cl > 0) colSpan += 2;
                  if (ct > 0 && cl > 0) colSpan += 1;
                }

                if (colSpan === 0) return null;
                return (
                  <th key={sub.key} colSpan={colSpan} className="border-x">
                    {sub.label}
                    {sub.isOE && <span className="block text-[10px] font-normal lowercase opacity-60">(mixed)</span>}
                  </th>
                );
              })}
              {isOEVisible && (
                <th 
                  colSpan={(() => {
                    if (viewMode === 'theory') return 2;
                    if (viewMode === 'lab') return 2;
                    if (viewMode === 'count') return (maxOEThTot > 0 ? 1 : 0) + (maxOELabTot > 0 ? 1 : 0);
                    const hasBoth = maxOEThTot > 0 && maxOELabTot > 0;
                    return (maxOEThTot > 0 ? 2 : 0) + (maxOELabTot > 0 ? 2 : 0) + (hasBoth ? 1 : 0);
                  })()}
                  className="border-x align-middle"
                >
                  Open Elective
                </th>
              )}
              {isDEVisible && (
                <th 
                  colSpan={(() => {
                    if (viewMode === 'theory') return 2;
                    if (viewMode === 'lab') return 2;
                    if (viewMode === 'count') return (maxDEThTot > 0 ? 1 : 0) + (maxDELabTot > 0 ? 1 : 0);
                    const hasBoth = maxDEThTot > 0 && maxDELabTot > 0;
                    return (maxDEThTot > 0 ? 2 : 0) + (maxDELabTot > 0 ? 2 : 0) + (hasBoth ? 1 : 0);
                  })()}
                  className="border-x align-middle"
                >
                  Department Electives
                </th>
              )}
              {isPEVisible && (
                <th
                  colSpan={(() => {
                    const colsForSet = (maxTh, maxLab) => {
                      if (viewMode === 'theory') return maxTh > 0 ? 2 : 0;
                      if (viewMode === 'lab')    return maxLab > 0 ? 2 : 0;
                      if (viewMode === 'count')  return (maxTh > 0 ? 1 : 0) + (maxLab > 0 ? 1 : 0);
                      const hasBoth = maxTh > 0 && maxLab > 0;
                      return (maxTh > 0 ? 2 : 0) + (maxLab > 0 ? 2 : 0) + (hasBoth ? 1 : 0);
                    };
                    return colsForSet(maxPE1ThTot, maxPE1LabTot) + colsForSet(maxPE2ThTot, maxPE2LabTot);
                  })()}
                  className="border-x align-middle"
                >
                  Program Electives
                </th>
              )}
              <th colSpan="2" className="align-middle border-l">
                {(() => {
                  if (viewMode === 'theory') return 'Overall Theory';
                  if (viewMode === 'lab') return 'Overall Lab';
                  if (viewMode === 'count') return 'Total Sessions';
                  return 'Overall Attendance';
                })()}
                <div className="text-[10px] font-normal opacity-70 mt-0.5">
                  {(() => {
                    const oeThTot = isOEVisible ? maxOEThTot : 0;
                    const oeLabTot = isOEVisible ? maxOELabTot : 0;
                    const deThTot = isDEVisible ? maxDEThTot : 0;
                    const deLabTot = isDEVisible ? maxDELabTot : 0;
                    const pe1ThTot = isPEVisible ? maxPE1ThTot : 0;
                    const pe1LabTot = isPEVisible ? maxPE1LabTot : 0;
                    const pe2ThTot = isPEVisible ? maxPE2ThTot : 0;
                    const pe2LabTot = isPEVisible ? maxPE2LabTot : 0;
                    if (viewMode === 'theory') return `out of ${totalThTot + oeThTot + deThTot + pe1ThTot + pe2ThTot}`;
                    if (viewMode === 'lab') return `out of ${totalLbTot + oeLabTot + deLabTot + pe1LabTot + pe2LabTot}`;
                    return `out of ${totalThTot + totalLbTot + oeThTot + oeLabTot + deThTot + deLabTot + pe1ThTot + pe1LabTot + pe2ThTot + pe2LabTot}`;
                  })()}
                </div>
              </th>
            </tr>
            <tr className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 uppercase tracking-wider">
              {renderSubHeaders()}
              {renderOESubHeaders()}
              {renderDESubHeaders()}
              {renderPESubHeaders()}
              <th className="border-l font-semibold text-[11px]">Att</th>
              <th className="font-semibold text-[11px] border-r">%</th>
            </tr>
          </thead>
          <tbody>
            {students.map(stu => {
              const overall = calculateOverallAttendance(stu, activeSubjects, viewMode);
              const isOverallLow = isLowAttendance(overall.att, overall.tot, threshold);
              return (
                <tr key={stu.sapId} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                  <td className="font-medium text-slate-500 dark:text-slate-300">{stu.rollNo}</td>
                  <td className="font-medium text-slate-500 dark:text-slate-300">{stu.sapId}</td>
                  <td className="text-left font-semibold text-slate-800 dark:text-slate-100">{stu.name}</td>
                  {activeSubjects.map(sub => (
                    <React.Fragment key={sub.key}>{renderCells(stu[sub.key], sub)}</React.Fragment>
                  ))}
                  {renderOECells(stu)}
                  {renderDECells(stu)}
                  {renderPECells(stu)}
                  <td className={`border-l bg-blue-50/30 dark:bg-blue-900/10 ${isOverallLow ? redCell : 'font-bold'}`} title={`${overall.att} / ${overall.tot}`}>
                    {overall.att} / {overall.tot}
                  </td>
                  <td className={`bg-blue-50/30 dark:bg-blue-900/10 ${isOverallLow ? redCell : 'font-bold'}`}>{calculateAttendancePercentageValue(overall.att, overall.tot)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceReportTable;
