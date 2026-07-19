/**
 * Calculates current attendance percentage as a formatted string.
 * @param {number} attended - Number of sessions attended.
 * @param {number} total - Total number of sessions.
 * @returns {string} Formatted percentage with one decimal place (e.g., "85.5").
 */
export const calculateAttendancePercentageValue = (attended, total) => 
  total > 0 ? ((Number(attended) / Number(total)) * 100).toFixed(1) : '0.0';

/**
 * Calculates raw numeric attendance percentage.
 * @param {number} attended - Number of sessions attended.
 * @param {number} total - Total number of sessions.
 * @returns {number} Numeric percentage value.
 */
export const getNumericAttendancePercentage = (attended, total) => {
  const att = Number(attended || 0);
  const tot = Number(total || 0);
  return tot > 0 ? (att / tot) * 100 : 0;
};

/**
 * Checks if attendance is below a certain threshold.
 * @param {number} attended - Number of sessions attended.
 * @param {number} total - Total number of sessions.
 * @param {number} [threshold=75] - The percentage threshold to check against.
 * @returns {boolean} True if attendance is below the threshold.
 */
export const isLowAttendance = (attended, total, threshold = 75) => {
  const att = Number(attended || 0);
  const tot = Number(total || 0);
  const thr = Number(threshold || 75);
  return tot > 0 && (att / tot) * 100 < thr;
};

/**
 * Returns CSS classes based on attendance status for count values.
 * @param {number} attended - Number of sessions attended.
 * @param {number} total - Total number of sessions.
 * @returns {string} Tailwind CSS class string.
 */
export const getAttendanceStatusClasses = (attended, total, threshold = 75) => 
  isLowAttendance(attended, total, threshold) 
    ? '!text-red-600 dark:!text-red-400 !font-bold' 
    : 'text-slate-800 dark:text-slate-200 font-medium';

/**
 * Returns CSS classes based on attendance status for percentage values.
 * @param {number} attended - Number of sessions attended.
 * @param {number} total - Total number of sessions.
 * @returns {string} Tailwind CSS class string.
 */
export const getPercentageStatusClasses = (attended, total, threshold = 75) => 
  isLowAttendance(attended, total, threshold) 
    ? '!text-red-600 dark:!text-red-400 !font-bold' 
    : 'text-slate-800 dark:text-slate-200 font-bold';

/**
 * Calculates overall attendance totals (theory + lab) for a student across multiple subjects.
 * @param {Object} student - The student data object.
 * @param {Array} subjects - List of project subjects.
 * @param {string} viewMode - The current view mode ('theory', 'lab', or 'full').
 * @returns {Object} An object containing total attended and total sessions { att, tot }.
 */
export const calculateOverallAttendance = (student, subjects, viewMode) => {
  let attended = 0, total = 0;
  subjects.forEach(subject => {
    const data = student[subject.key];
    if (!data || data.notOpted) return;
    
    if (viewMode !== 'lab') { 
      attended += Number(data.th_att || 0); 
      total += Number(data.th_tot || 0); 
    }
    if (viewMode !== 'theory') { 
      attended += Number(data.lab_att || 0); 
      total += Number(data.lab_tot || 0); 
    }
  });

  // Include OE Theory (skip in lab-only mode)
  if (viewMode !== 'lab' && student.oe_tot > 0) {
    attended += Number(student.oe_att || 0);
    total += Number(student.oe_tot || 0);
  }
  // Include OE Lab (skip in theory-only mode)
  if (viewMode !== 'theory' && student.oe_lab_tot > 0) {
    attended += Number(student.oe_lab_att || 0);
    total += Number(student.oe_lab_tot || 0);
  }

  // Include DE Theory (skip in lab-only mode)
  if (viewMode !== 'lab' && student.de_tot > 0) {
    attended += Number(student.de_att || 0);
    total += Number(student.de_tot || 0);
  }
  // Include DE Lab (skip in theory-only mode)
  if (viewMode !== 'theory' && student.de_lab_tot > 0) {
    attended += Number(student.de_lab_att || 0);
    total += Number(student.de_lab_tot || 0);
  }

  // Include PE1 Theory (SET1, skip in lab-only mode)
  if (viewMode !== 'lab' && student.pe1_tot > 0) {
    attended += Number(student.pe1_att || 0);
    total += Number(student.pe1_tot || 0);
  }
  // Include PE1 Lab (SET1, skip in theory-only mode)
  if (viewMode !== 'theory' && student.pe1_lab_tot > 0) {
    attended += Number(student.pe1_lab_att || 0);
    total += Number(student.pe1_lab_tot || 0);
  }

  // Include PE2 Theory (SET2, skip in lab-only mode)
  if (viewMode !== 'lab' && student.pe2_tot > 0) {
    attended += Number(student.pe2_att || 0);
    total += Number(student.pe2_tot || 0);
  }
  // Include PE2 Lab (SET2, skip in theory-only mode)
  if (viewMode !== 'theory' && student.pe2_lab_tot > 0) {
    attended += Number(student.pe2_lab_att || 0);
    total += Number(student.pe2_lab_tot || 0);
  }

  return { att: attended, tot: total };
};
