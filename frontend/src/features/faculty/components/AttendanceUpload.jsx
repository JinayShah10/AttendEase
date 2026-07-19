import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Check, Info } from 'lucide-react';
import { useAuth } from '../../../AuthContext';
import { uploadAttendanceFile } from '../../../utils/api';

const AttendanceUpload = ({ 
  filterYear,
  lectureType,
  filterClass, 
  filterSubject, 
  file, 
  setFile, 
  isUploaded, 
  setIsUploaded 
}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [oeSummary, setOeSummary] = useState(null);

  const isOE = lectureType === 'OE Theory' || lectureType === 'OE Lab' || lectureType === 'oe';

  const handleFileUpload = async (e) => {
    e.preventDefault();
    
    // Clear previous error messages
    setError(null);
    setOeSummary(null);
    
    // VALIDATION 1: Check if file is selected
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    // VALIDATION 2: Check file size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > MAX_SIZE) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
      setError(`File exceeds 5MB limit. Your file is ${fileSizeMB}MB.`);
      return;
    }

    // VALIDATION 3: Check file type (Excel or CSV only)
    const ALLOWED_TYPES = /\.(xlsx?|csv)$/i;
    if (!file.name.match(ALLOWED_TYPES)) {
      setError('Only Excel files (.xlsx, .xls) or CSV files are accepted.');
      return;
    }

    // VALIDATION 4: Check if selections are complete
    if (isOE) {
      if (!filterYear || !filterSubject) {
        setError('Please select Year and OE Subject before uploading.');
        return;
      }
    } else {
      if (!filterYear || !lectureType || !filterClass || !filterSubject) {
        setError('Please complete all selections (Year, Type, Class, Subject) before uploading.');
        return;
      }
    }

    try {
      // Set loading state
      setIsLoading(true);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('subjectName', filterSubject);
      
      if (isOE) {
        formData.append('classYear', filterYear);
        formData.append('division', 'ALL');
      } else {
        formData.append('classYear', filterClass);
        const parsedDivision = filterClass.includes(' ') ? filterClass.split(' ').slice(1).join(' ') : '';
        formData.append('division', parsedDivision);
      }
      
      formData.append('lectureType', lectureType); 
      formData.append('facultyId', user?.id || '');

      await uploadAttendanceFile(formData);
      
      /* 
        REMOVED: Immediate OE processing.
        OE files should now stay 'pending' until an admin generates the report,
        matching the behavior of standard theory/lab files.
      */

      
      // Success state
      setIsUploaded(true);
      setFile(null);
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    setError(null);
    setOeSummary(null);
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setIsUploaded(false);
    }
  };

  const isSelectionComplete = isOE 
    ? (filterYear !== '' && filterSubject !== '')
    : (filterYear !== '' && lectureType !== '' && filterClass !== '' && filterSubject !== '');

  if (!isSelectionComplete) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 sm:p-12 text-center fade-in transition-colors glass-3d-card delay-1">
        <FileSpreadsheet size={40} className="sm:w-[48px] sm:h-[48px] mx-auto text-gray-400 dark:text-gray-500 mb-4" />
        <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg">
          {isOE 
            ? "Please select year and OE subject to upload attendance data." 
            : "Please select year, lecture type, class and subject to upload attendance data."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-5 sm:p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 fade-in transition-colors glass-3d-card delay-1">
      <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Upload Attendance Sheet</h4>
      <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
        Uploading for: <strong className="dark:text-gray-300">{isOE ? filterYear : filterClass}</strong> ({filterSubject})
      </p>

      {isOE && !isUploaded && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg flex items-start gap-3">
          <Info size={20} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <strong>OE Notice:</strong> This OE sheet should contain students from all divisions. Only students matching your class year ({filterYear}) will be processed.
          </p>
        </div>
      )}

      {error && (
        <div className="alert alert-danger mt-3 mb-6" role="alert">
          <strong className="text-xs sm:text-sm">Upload Error:</strong> <span className="text-xs sm:text-sm">{error}</span>
        </div>
      )}

      {!isUploaded ? (
        <form onSubmit={handleFileUpload} className="space-y-6">
          <div className="border-2 border-dashed border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 sm:p-8 text-center hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer relative group">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              required
              disabled={isLoading}
            />
            <Upload className={`mx-auto mb-2 transition-colors sm:w-[32px] sm:h-[32px] ${isLoading ? 'text-gray-400' : 'text-blue-500 dark:text-blue-400 group-hover:text-blue-600'}`} size={28} />
            <p className="text-blue-800 dark:text-blue-300 font-medium text-sm sm:text-base">Click to browse or drag and drop Excel file here</p>
            <p className="text-blue-600/70 dark:text-blue-400/70 text-xs sm:text-sm mt-1">Accepts .xlsx, .xls, .csv (Max 5MB)</p>
            {file && (
              <div className="mt-4 p-2 bg-white dark:bg-gray-800 rounded-lg inline-flex items-center text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 border border-blue-100 dark:border-gray-700 max-w-full">
                <FileSpreadsheet size={16} className="mr-2 text-green-600 dark:text-green-500 flex-shrink-0" />
                <span className="truncate">{file.name}</span>
                <span className="ml-2 text-[10px] sm:text-xs text-gray-400 font-normal flex-shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={!file || isLoading}
            className={`btn btn-primary w-full py-3 font-medium flex justify-center items-center gap-2 ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span className="text-sm sm:text-base">Processing...</span>
              </>
            ) : (
              <>
                <Upload size={18} /> <span className="text-sm sm:text-base">Process Attendance</span>
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="text-center p-6 sm:p-8 border border-green-100 dark:border-green-900/50 bg-green-50 dark:bg-green-900/20 rounded-xl fade-in shadow-sm transition-colors">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} />
          </div>
          <h4 className="text-lg sm:text-xl font-bold text-green-800 dark:text-green-400 mb-2">Upload Successful!</h4>
          <p className="text-sm sm:text-base text-green-700 dark:text-green-500 mb-4">
            Attendance records for <strong className="dark:text-green-400">{isOE ? filterYear : filterClass}</strong> in <strong className="dark:text-green-400">{filterSubject}</strong> have been successfully uploaded.
          </p>

          {isOE && oeSummary && oeSummary.bySubject && oeSummary.bySubject[filterSubject] && (
            <div className="mt-6 mb-2 p-4 bg-white dark:bg-gray-800 rounded-xl border border-green-200 dark:border-gray-700 text-left">
              <h5 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                <Info size={16} className="text-blue-500" />
                Division Breakdown ({filterSubject})
              </h5>
              <div className="grid grid-cols-3 gap-3">
                {['D1', 'D2', 'D3'].map(div => {
                  const count = oeSummary.bySubject[filterSubject].filter(s => s.division === div).length;
                  return (
                    <div key={div} className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg text-center border border-gray-100 dark:border-gray-600">
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">{div}</div>
                      <div className="text-lg font-bold text-slate-700 dark:text-slate-200">{count}</div>
                    </div>
                  );
                })}
                <div className="col-span-3 bg-blue-50/50 dark:bg-blue-900/20 p-3 rounded-lg flex justify-between items-center border border-blue-100 dark:border-blue-800/30 mt-1">
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-bold uppercase tracking-wider">Total Students Processed</span>
                  <span className="text-xl font-black text-blue-600 dark:text-blue-400">{oeSummary.bySubject[filterSubject].length}</span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => { setFile(null); setIsUploaded(false); setError(null); setOeSummary(null); }}
            className="mt-6 text-green-800 border bg-white border-green-200 px-4 py-2 rounded-lg hover:bg-green-50 transition-colors text-xs sm:text-sm font-medium shadow-sm"
          >
            Upload Another File
          </button>
        </div>
      )}
    </div>
  );
};

export default AttendanceUpload;
