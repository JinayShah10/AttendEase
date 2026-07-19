import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthContext';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { fetchAdminUploads, fetchStudentsList, uploadStudentList } from '../../utils/api';

const StudentManager = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignedClass, setAssignedClass] = useState(null);
  
  // Upload section states
  const [file, setFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchAssignedClassAndStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchAssignedClassAndStudents = async () => {
    setLoading(true);
    try {
      if (!user || !user.id) return;
      
      const adminData = await fetchAdminUploads(user.id);
      
      if (adminData.assignedClass) {
        setAssignedClass(adminData.assignedClass);
        const { year, division } = adminData.assignedClass;
        
        const studentsData = await fetchStudentsList(year, division);
        
        if (studentsData.students) {
          setStudents(studentsData.students);
        }
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      setMessage({ text: 'Error fetching student list', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage({ text: 'Please select a file to upload.', type: 'error' });
      return;
    }

    setUploadLoading(true);
    setMessage({ text: '', type: '' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('classYear', assignedClass?.year || 'SY');
    formData.append('division', assignedClass?.division || 'D1');

    try {
      const data = await uploadStudentList(formData);

      if (data.success) {
        setMessage({ text: `Success! Processed ${data.count} student records.`, type: 'success' });
        setFile(null);
        const fileInput = document.getElementById('studentExcel');
        if (fileInput) fileInput.value = '';
        fetchAssignedClassAndStudents();
      } else {
        setMessage({ text: data.message || 'Error uploading file', type: 'error' });
      }
    } catch (error) {
      console.error('Upload error:', error);
      setMessage({ text: 'An error occurred during upload', type: 'error' });
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Upload Master Student List</h2>
        
        {message.text && (
          <div className={`p-3 mb-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
            {message.text}
          </div>
        )}


        <form className="space-y-6">
          <div className="border-2 border-dashed border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 sm:p-8 text-center hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer relative group">
            <input
              id="studentExcel"
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              required
              disabled={uploadLoading}
            />
            <Upload className={`mx-auto mb-2 transition-colors sm:w-[32px] sm:h-[32px] ${uploadLoading ? 'text-gray-400' : 'text-blue-500 dark:text-blue-400 group-hover:text-blue-600'}`} size={28} />
            <p className="text-blue-800 dark:text-blue-300 font-medium text-sm sm:text-base">Click to browse or drag and drop Excel file here</p>
            <p className="text-blue-600/70 dark:text-blue-400/70 text-xs sm:text-sm mt-1">Accepts .xlsx, .xls (Max 5MB)</p>
            {file && (
              <div className="mt-4 p-2 bg-white dark:bg-gray-800 rounded-lg inline-flex items-center text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 border border-blue-100 dark:border-gray-700 max-w-full">
                <FileSpreadsheet size={16} className="mr-2 text-green-600 dark:text-green-500 flex-shrink-0" />
                <span className="truncate">{file.name}</span>
                <span className="ml-2 text-[10px] sm:text-xs text-gray-400 font-normal flex-shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploadLoading}
            className={`w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex justify-center items-center gap-2 transition-colors ${
              uploadLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {uploadLoading ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span className="text-sm sm:text-base">Processing...</span>
              </>
            ) : (
              <>
                <Upload size={18} /> <span className="text-sm sm:text-base">Upload Student List</span>
              </>
            )}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
            Students List {assignedClass && `- ${assignedClass.year} ${assignedClass.division}`}
          </h2>
          <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            {students.length} Students
          </span>
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center items-center p-12">
              <div className="spinner-border text-blue-600" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              No students uploaded yet for this class.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-xs uppercase text-gray-500 dark:text-gray-400">
                  <th className="px-6 py-3 font-medium">Roll No</th>
                  <th className="px-6 py-3 font-medium">SAP ID</th>
                  <th className="px-6 py-3 font-medium">Student Name</th>
                  <th className="px-6 py-3 font-medium">Division</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {students.map((student, idx) => (
                  <tr key={student._id || idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{student.rollNumber || '-'}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{student.sapId}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{student.studentName || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      <span className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 text-xs font-medium px-2 py-0.5 rounded">
                        {student.division}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentManager;
