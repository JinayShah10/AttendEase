import React, { useState, useEffect } from 'react';
import AttendanceUpload from './components/AttendanceUpload';
import { useAuth } from '../../AuthContext';
import { Clock, FileText, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { fetchMasterSubjects, fetchMasterClasses, fetchOESubjects, fetchPESubjects, fetchFacultyProfile, fetchFacultyUploads, deleteFacultyUpload } from '../../utils/api';

const FacultyHome = () => {
  const { user } = useAuth();
  const [filterYear, setFilterYear] = useState('');
  const [lectureType, setLectureType] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterOESubject, setFilterOESubject] = useState('');
  const [filterPESubject, setFilterPESubject] = useState('');
  const [file, setFile] = useState(null);
  const [isUploaded, setIsUploaded] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [oeSubjects, setOeSubjects] = useState([]);
  const [peSubjects, setPeSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [recentFiles, setRecentFiles] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [subjectsData, classesData, oeData, peData] = await Promise.all([
          fetchMasterSubjects(),
          fetchMasterClasses(),
          fetchOESubjects(),
          fetchPESubjects()
        ]);
        
        let combinedSubjects = [...subjectsData];
        
        if (user?.id) {
          try {
            const profileData = await fetchFacultyProfile(user.id);
            if (profileData.subjects && profileData.subjects.length > 0) {
              const facultySubjects = profileData.subjects.map(s => ({
                _id: s._id,
                name: s.subjectName || s.name,
                year: s.classYear || s.year,
                type: s.lectureType || s.type
              }));
              
              const existingNames = new Set(combinedSubjects.map(s => s.name));
              facultySubjects.forEach(fs => {
                if (!existingNames.has(fs.name)) {
                  combinedSubjects.push(fs);
                }
              });
            }
          } catch {
            // Faculty profile fetch failed — continue with master subjects only
          }
        }

        setSubjects(combinedSubjects);
        setClasses(classesData);
        setOeSubjects(oeData);
        setPeSubjects(peData);
      } catch (err) {
        console.error('Error fetching master data:', err);
      }
    };

    fetchMasterData();
  }, [user]);

  const fetchRecentFiles = async () => {
    if (!user?.id) return;
    try {
      const data = await fetchFacultyUploads(user.id);
      setRecentFiles(data);
    } catch (error) {
      console.error('Error fetching recent files:', error);
    }
  };

  const handleDelete = async (fileId) => {
    if (!window.confirm("Are you sure you want to delete this file? This will also remove its attendance data from reports.")) return;

    try {
      await deleteFacultyUpload(fileId);
      // Optimistic UI update: remove file from local state
      setRecentFiles(prev => prev.filter(f => f._id !== fileId));
    } catch (error) {
      console.error('Error deleting file:', error);
      alert("An error occurred while deleting the file.");
    }
  };

  useEffect(() => {
    fetchRecentFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (isUploaded) {
      fetchRecentFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUploaded]);

  const filteredClasses = classes.filter(c => filterYear ? c.name.startsWith(filterYear) : true);

  // All PE subject names (to exclude from regular subject dropdown)
  const allPENames = new Set(peSubjects.map(pe => pe.subjectName));

  const filteredSubjects = subjects.filter(s => {
    // Robust year matching (handles 'year' or 'classYear' and casing)
    const sYear = s.year || s.classYear || '';
    const yearMatch = !filterYear || sYear.toString().toLowerCase() === filterYear.toLowerCase() || sYear === '';
    
    let typeMatch = false;
    const sType = (s.type || s.lectureType || '').toLowerCase();
    const sIsOE = s.isOE === true || s.electiveCategory === 'OE' || s.category === 'Open Elective';
    const sIsDE = s.electiveCategory === 'DEPARTMENT_ELECTIVE' || s.category === 'Department Elective';

    // Never show PE subjects in the regular dropdown — they have their own dropdown
    if (allPENames.has(s.name)) return false;

    if (lectureType === 'Theory') {
      typeMatch = sType === 'theory' && !sIsOE && !sIsDE;
    } else if (lectureType === 'Lab') {
      typeMatch = sType === 'lab' && !sIsOE && !sIsDE;
    } else if (lectureType === 'DE Theory') {
      typeMatch = sType === 'theory' && sIsDE;
    } else if (lectureType === 'DE Lab') {
      typeMatch = sType === 'lab' && sIsDE;
    } else if (lectureType === 'OE Theory') {
      typeMatch = sType === 'theory' && sIsOE;
    } else if (lectureType === 'OE Lab') {
      typeMatch = sType === 'lab' && sIsOE;
    } else {
      typeMatch = true; // no lectureType selected yet
    }
    
    return yearMatch && typeMatch;
  });

  const isSYOE = filterYear === 'SY' && lectureType === 'OE Theory';
  const isPEType = lectureType === 'PE Theory' || lectureType === 'PE Lab';

  // Derive PE subject name from the selected PE option (theory-only to represent selections)
  const peSet1Options = peSubjects.filter(pe => pe.set === 'SET1' && pe.type === 'THEORY');
  const peSet2Options = peSubjects.filter(pe => pe.set === 'SET2' && pe.type === 'THEORY');

  const activePESubjectName = (() => {
    if (!filterPESubject) return '';
    const peOption = peSubjects.find(pe => pe.pairKey === filterPESubject && pe.type === 'THEORY');
    if (!peOption) return filterPESubject;
    if (lectureType === 'PE Lab') {
      const labOption = peSubjects.find(pe => pe.pairKey === filterPESubject && pe.type === 'LAB');
      return labOption ? labOption.subjectName : (filterPESubject + ' Lab');
    }
    return peOption.subjectName;
  })();

  const filteredRecentFiles = recentFiles.filter((file) => {
    if (statusFilter === 'All') return true;
    const status = (file.status || 'pending').toLowerCase();
    const hasProcessedDivs = file.processedDivisions && file.processedDivisions.length > 0;
    const allProcessed = status === 'processed' || (file.processedDivisions && file.processedDivisions.length >= 3);

    if (statusFilter === 'Processed') return allProcessed || hasProcessedDivs;
    if (statusFilter === 'Pending') return !allProcessed;
    if (statusFilter === 'Errors') return status === 'error';
    return true;
  });

  return (
    <div className="fade-in space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Faculty Dashboard</h2>

      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 transition-colors glass-3d-card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b pb-2 dark:border-gray-700">Class & Subject Selection</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Year</label>
            <select
              className="form-select w-full rounded-lg border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer"
              value={filterYear}
              onChange={(e) => {
                const newYear = e.target.value;
                setFilterYear(newYear);
                setFilterClass('');
                setFilterSubject('');
                setFilterOESubject('');
                setIsUploaded(false);
                setFile(null);
                if (newYear === 'SY' && lectureType === 'OE Lab') {
                  setLectureType('');
                }
              }}
            >
              <option value="">-- Select Year --</option>
              <option value="SY">Second Year (SY)</option>
              <option value="TY">Third Year (TY)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Lecture Type</label>
            <select
              className="form-select w-full rounded-lg border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer"
              value={lectureType}
              onChange={(e) => { setLectureType(e.target.value); setFilterSubject(''); setFilterOESubject(''); setIsUploaded(false); setFile(null); }}
            >
              <option value="">-- Select Type --</option>
              <option value="Theory">Theory</option>
              <option value="Lab">Lab</option>
              {filterYear === 'TY' && <option value="DE Theory">DE Theory</option>}
              {filterYear === 'TY' && <option value="DE Lab">DE Lab</option>}
              {filterYear === 'TY' && <option value="PE Theory">PE Theory</option>}
              {filterYear === 'TY' && <option value="PE Lab">PE Lab</option>}
              {filterYear === 'SY' && <option value="OE Theory">OE Theory</option>}
              {filterYear === 'TY' && <option value="OE Lab">OE Lab</option>}
            </select>
          </div>
          {/* Hide class selector for OE and PE uploads */}
          {lectureType !== 'OE Theory' && lectureType !== 'OE Lab' && lectureType !== 'PE Theory' && lectureType !== 'PE Lab' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Class / Batch</label>
              <select
                className="form-select w-full rounded-lg border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer"
                value={filterClass}
                onChange={(e) => { setFilterClass(e.target.value); setIsUploaded(false); setFile(null); }}
                disabled={!filterYear}
              >
                <option value="">-- Select Class --</option>
                {filteredClasses.map(c => <option key={c._id || c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          )}
          {/* SY Open Elective subject picker */}
          {isSYOE ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select OE Subject</label>
              <select
                className="form-select w-full rounded-lg border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer"
                value={filterOESubject}
                onChange={(e) => { setFilterOESubject(e.target.value); setIsUploaded(false); setFile(null); }}
                disabled={!filterYear}
              >
                <option value="">-- Select OE Subject --</option>
                {oeSubjects.map(s => <option key={s._id || s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          ) : isPEType ? (
            /* TY Program Elective subject picker — grouped by SET */
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select PE Subject</label>
              <select
                className="form-select w-full rounded-lg border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer"
                value={filterPESubject}
                onChange={(e) => { setFilterPESubject(e.target.value); setIsUploaded(false); setFile(null); }}
                disabled={!filterYear}
              >
                <option value="">-- Select PE Subject --</option>
                <optgroup label="SET 1">
                  {peSet1Options.map(pe => (
                    <option key={pe._id || pe.pairKey} value={pe.pairKey}>
                      {lectureType === 'PE Lab' ? (peSubjects.find(p => p.pairKey === pe.pairKey && p.type === 'LAB')?.subjectName || (pe.pairKey + ' Lab')) : pe.subjectName}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="SET 2">
                  {peSet2Options.map(pe => (
                    <option key={pe._id || pe.pairKey} value={pe.pairKey}>
                      {lectureType === 'PE Lab' ? (peSubjects.find(p => p.pairKey === pe.pairKey && p.type === 'LAB')?.subjectName || (pe.pairKey + ' Lab')) : pe.subjectName}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Subject</label>
              <select
                className="form-select w-full rounded-lg border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer"
                value={filterSubject}
                onChange={(e) => { setFilterSubject(e.target.value); setIsUploaded(false); setFile(null); }}
                disabled={!filterYear || !lectureType}
              >
                <option value="">-- Select Subject --</option>
                {filteredSubjects.map(s => <option key={s._id || s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Upload Section */}
      <AttendanceUpload 
        filterYear={filterYear}
        lectureType={lectureType}
        filterClass={filterClass}
        filterSubject={filterSubject || filterOESubject || activePESubjectName}
        file={file}
        setFile={setFile}
        isUploaded={isUploaded}
        setIsUploaded={setIsUploaded}
      />

      {/* Recent Files Section */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors glass-3d-card">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Clock size={20} className="text-blue-500" />
            Recent Uploads
          </h3>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">Status Filter:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="All">All</option>
                <option value="Processed">Processed</option>
                <option value="Pending">Pending</option>
                <option value="Errors">Errors</option>
              </select>
            </div>
            <button 
              onClick={fetchRecentFiles}
              className="p-1.5 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all flex items-center gap-1 text-xs font-medium"
              title="Refresh list"
            >
              <Clock size={14} className="hover:rotate-180 transition-transform duration-500" />
              Refresh
            </button>
          </div>
        </div>
        {recentFiles.length === 0 ? (
          <div className="text-center py-8">
            <FileText size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No recent uploads found. Your uploaded files will appear here.</p>
          </div>
        ) : filteredRecentFiles.length === 0 ? (
          <div className="text-center py-8">
            <FileText size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No uploads found matching filter "{statusFilter}".</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto max-h-[350px] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3">File Name</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredRecentFiles.map((file) => (
                    <tr key={file._id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <FileText size={16} className="text-blue-400 flex-shrink-0" />
                        <span className="truncate max-w-[150px] sm:max-w-xs block" title={file.originalFileName}>{file.originalFileName}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{file.classYear}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{file.subjectName}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(file.uploadedAt).toLocaleDateString()} {new Date(file.uploadedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center w-fit gap-1.5 ${
                          (file.status === 'processed' || (file.processedDivisions && file.processedDivisions.length >= 3)) ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          (file.status === 'error') ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          (file.processedDivisions && file.processedDivisions.length > 0) ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {(file.status === 'processed' || (file.processedDivisions && file.processedDivisions.length >= 3)) ? <CheckCircle size={12} /> : (file.status === 'error') ? <XCircle size={12} /> : <Clock size={12} />}
                          {file.division === 'ALL' && file.processedDivisions && file.processedDivisions.length > 0 && file.processedDivisions.length < 3
                            ? `Processed (${file.processedDivisions.join(', ')})`
                            : (file.status === 'processed' || (file.processedDivisions && file.processedDivisions.length >= 3))
                            ? 'Processed'
                            : (file.status === 'error')
                            ? 'Error'
                            : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button 
                          onClick={() => handleDelete(file._id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete Upload"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setRecentFiles([])}
                className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg transition-colors"
              >
                Clear Table
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FacultyHome;
