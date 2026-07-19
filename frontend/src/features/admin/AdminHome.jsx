import React, { useState, useEffect } from 'react';
import { Users, BookOpen, BarChart } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import AnimateNumber from './components/AnimateNumber';
import { fetchAdminProfile, fetchAdminUploads, fetchFacultyCount, fetchConsolidatedReport } from '../../utils/api';

const AdminHome = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [assignedClass, setAssignedClass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ studentCount: 0, avgAttendance: '0', facultyCount: 0 });
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    if (!user?.id) return;

    Promise.all([
      fetchAdminProfile(user.id),
      fetchAdminUploads(user.id),
      fetchFacultyCount(user.id)
    ])
    .then(async ([profileData, uploadsData, facultyData]) => {
      setProfile(profileData);
      setUploads(uploadsData.uploads || []);
      const aClass = uploadsData.assignedClass || null;
      setAssignedClass(aClass);
      
      const fCount = facultyData.count || 0;
      const sCount = uploadsData.studentCount || 0;
      setStats(prev => ({ ...prev, facultyCount: fCount, studentCount: sCount }));

      if (aClass) {
        try {
          const reportData = await fetchConsolidatedReport(aClass.year, aClass.division);
          
          if (reportData.students && reportData.students.length > 0) {
            // Calculate class-wide average
            let totalAttended = 0;
            let totalSessions = 0;
            
            reportData.students.forEach(student => {
              // 1. Sum non-OE subjects
              reportData.subjects.forEach(subject => {
                const subData = student[subject.key];
                if (subData && !subData.notOpted) {
                  totalAttended += Number(subData.th_att || 0) + Number(subData.lab_att || 0);
                  totalSessions += Number(subData.th_tot || 0) + Number(subData.lab_tot || 0);
                }
              });

              // 2. Sum OE attendance
              if (student.oeSubject) {
                totalAttended += Number(student.oe_att || 0) + Number(student.oe_lab_att || 0);
                totalSessions += Number(student.oe_tot || 0) + Number(student.oe_lab_tot || 0);
              }

              // 3. Sum DE attendance
              if (student.deSubject) {
                totalAttended += Number(student.de_att || 0) + Number(student.de_lab_att || 0);
                totalSessions += Number(student.de_tot || 0) + Number(student.de_lab_tot || 0);
              }
            });

            const avg = totalSessions > 0 ? ((totalAttended / totalSessions) * 100).toFixed(2) + '%' : '0.00%';
            setStats(prev => ({
              ...prev,
              avgAttendance: avg
            }));
          } else {
            setStats(prev => ({ ...prev, avgAttendance: '0.00%' }));
          }
        } catch (err) {
          console.error("Error fetching stats:", err);
        }
      }
      setLoading(false);
    })
    .catch(err => {
      console.error("Error fetching data:", err);
      setLoading(false);
    });
  }, [user]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary"></div>
      </div>
    );
  }

  const filteredUploads = uploads.filter((upload) => {
    if (statusFilter === 'All') return true;
    const status = (upload.status || 'pending').toLowerCase();
    if (statusFilter === 'Processed') return status === 'processed';
    if (statusFilter === 'Pending') return status === 'pending' || status === 'uploaded';
    if (statusFilter === 'Errors') return status === 'error';
    return true;
  });

  return (
    <div className="fade-in space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">Dashboard Overview</h2>
        <p className="text-slate-600 dark:text-slate-300 mt-1 text-sm sm:text-base flex flex-wrap gap-x-2">
          <span>Class Teacher: <span className="font-semibold text-slate-700 dark:text-slate-100">{profile?.name || "Loading..."}</span></span>
          <span className="hidden sm:inline">|</span>
          <span>Class: <span className="font-semibold text-blue-600">{assignedClass?.name || "No class assigned"}</span></span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Stats Cards */}
        <div className="card shadow-sm border-0 rounded-xl glass-3d-card">
          <div className="card-body p-6 flex items-center justify-between">
            <div>
              <h6 className="text-slate-600 dark:text-slate-400 mb-1">Total Students</h6>
              <h3 className="mb-0 font-bold text-slate-800 dark:text-white">
                <AnimateNumber value={stats.studentCount} />
              </h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users size={24} />
            </div>
          </div>
        </div>
        <div className="card shadow-sm border-0 rounded-xl glass-3d-card delay-1">
          <div className="card-body p-6 flex items-center justify-between">
            <div>
              <h6 className="text-slate-600 dark:text-slate-400 mb-1">Total Faculty</h6>
              <h3 className="mb-0 font-bold text-slate-800 dark:text-white">
                <AnimateNumber value={stats.facultyCount} />
              </h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center justify-center">
              <BookOpen size={24} />
            </div>
          </div>
        </div>
        <div className="card shadow-sm border-0 rounded-xl glass-3d-card delay-2">
          <div className="card-body p-6 flex items-center justify-between">
            <div>
              <h6 className="text-slate-600 dark:text-slate-400 mb-1">Avg Attendance</h6>
              <h3 className="mb-0 font-bold text-slate-800 dark:text-white">
                <AnimateNumber 
                  value={parseFloat(stats.avgAttendance)} 
                  suffix="%" 
                  decimals={2}
                />
              </h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <BarChart size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0 rounded-xl mt-6 glass-3d-card delay-3">
        <div className="card-body p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h5 className="font-semibold text-slate-800 dark:text-white mb-0">
              Recent Attendance Uploads {assignedClass?.name ? `(${assignedClass.name})` : ""}
            </h5>
            <div className="flex items-center gap-2">
              <label htmlFor="adminStatusFilter" className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">Status Filter:</label>
              <select
                id="adminStatusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="All">All</option>
                <option value="Processed">Processed</option>
                <option value="Pending">Pending</option>
                <option value="Errors">Errors</option>
              </select>
            </div>
          </div>
          
          {uploads.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-300">No uploads yet for your class</p>
          ) : filteredUploads.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-300">No uploads found matching filter "{statusFilter}"</p>
          ) : (
            <>
              <div className="table-responsive max-h-[350px] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light sticky top-0 z-10">
                    <tr>
                      <th>Date</th>
                      <th>Uploaded Sheet</th>
                      <th>Subject Faculty</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUploads.map((upload) => (
                      <tr key={upload._id}>
                        <td>{new Date(upload.uploadedAt).toLocaleString()}</td>
                        <td><span className="text-blue-600 font-medium">{upload.originalFileName}</span></td>
                        <td>{upload.facultyName}</td>
                        <td>
                          {upload.status === 'processed' ? (
                            <span className="badge bg-green-500 text-white border-0 px-2 py-1 rounded shadow-sm">Processed</span>
                          ) : upload.status === 'error' ? (
                            <span className="badge bg-red-500 text-white border-0 px-2 py-1 rounded shadow-sm">Error</span>
                          ) : (
                            <span className="badge bg-yellow-500 text-white border-0 px-2 py-1 rounded shadow-sm">Pending</span>
                          )}
                        </td>
                        <td>
                          <button 
                            className="btn btn-sm btn-outline-primary whitespace-nowrap"
                            onClick={() => {
                              const link = document.createElement('a');
                              const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://attendease-backend-81j7.onrender.com';
                              link.href = `${API_BASE}/api/upload/download/${upload._id}`;
                              link.download = upload.originalFileName;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                          >Download</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setUploads([])}
                  className="btn btn-sm btn-outline-danger"
                >
                  Clear Table
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminHome;
