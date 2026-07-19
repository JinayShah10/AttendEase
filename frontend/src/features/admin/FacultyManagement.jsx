import React, { useState, useEffect } from 'react';
import { Download, Mail } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { fetchAdminUploads, fetchAllFaculty } from '../../utils/api';

const FacultyManagement = () => {
  const { user } = useAuth();
  const [allFaculties, setAllFaculties] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [assignedClass, setAssignedClass] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    Promise.all([
      fetchAdminUploads(user.id),
      fetchAllFaculty(user.id)
    ])
    .then(([uploadsData, allFacultyData]) => {
      setUploads(uploadsData.uploads || []);
      setAssignedClass(uploadsData.assignedClass || null);
      setAllFaculties(allFacultyData.faculties || []);
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

  // ── Transform data for display ──────────────────────────
  // Each record represents either an upload or a faculty with no uploads
  const displayList = [];
  
  // Track which faculty IDs have at least one upload
  const facultyWithUploads = new Set();
  
  // Add an entry for every upload
  uploads.forEach(upload => {
    const fId = upload.facultyId?._id || upload.facultyId;
    facultyWithUploads.add(fId);
    
    displayList.push({
      id: upload._id,
      name: upload.facultyName,
      email: upload.facultyId?.email || 'N/A',
      subject: upload.subjectName || 'Unknown',
      status: 'uploaded',
      uploadDate: upload.uploadedAt,
      fileName: upload.originalFileName,
      isPlaceholder: false
    });
  });

  // Add an entry for every faculty who hasn't uploaded anything
  allFaculties.forEach(faculty => {
    if (!facultyWithUploads.has(faculty._id)) {
      displayList.push({
        id: `missing-${faculty._id}`,
        name: faculty.name,
        email: faculty.email,
        subject: 'No Subject Assigned',
        status: 'pending',
        uploadDate: null,
        fileName: null,
        isPlaceholder: true
      });
    }
  });

  // Sort: Uploaded first, then alphabetical by name
  displayList.sort((a, b) => {
    if (a.status === b.status) return a.name.localeCompare(b.name);
    return a.status === 'uploaded' ? -1 : 1;
  });

  if (displayList.length === 0) {
    return (
      <div className="fade-in p-6 text-center text-slate-600 dark:text-slate-300">
        No faculty or uploads found.
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">
            Faculty Management
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mt-1 text-sm sm:text-base">
            Teaching faculty assigned to{' '}
            <span className="font-semibold text-blue-600">{assignedClass?.name || "Your Class"}</span>
          </p>
        </div>
      </div>

      {/* ── DESKTOP TABLE (hidden below 768 px) ── */}
      <div className="d-none d-md-block card shadow border-slate-200 dark:border-slate-600 dark:bg-[#112240] rounded-xl overflow-hidden fade-in glass-3d-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 text-slate-800 dark:text-slate-200">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-sm">
              <tr>
                <th className="font-semibold px-6 py-4 text-slate-800 dark:text-slate-300">Faculty Name</th>
                <th className="font-semibold px-6 py-4 text-slate-800 dark:text-slate-300">Subject</th>
                <th className="font-semibold px-6 py-4 text-slate-800 dark:text-slate-300">Contact Info</th>
                <th className="font-semibold px-6 py-4 text-slate-800 dark:text-slate-300">Upload Status</th>
                <th className="font-semibold px-6 py-4 text-slate-800 dark:text-slate-300">File Details</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {displayList.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex justify-center items-center font-bold text-sm shadow-sm flex-shrink-0">
                        {item.name.split(' ')[1]?.[0] || item.name[0]}
                      </div>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-base">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="badge bg-blue-600 dark:bg-blue-900 text-white shadow-sm font-medium px-2 py-1 border-0">
                      {item.subject}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300 font-medium">
                      <span>{item.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {item.status === 'uploaded' ? (
                      <span className="badge bg-green-600 dark:bg-green-500/30 text-white dark:text-green-300 border border-transparent dark:border-green-400/50 flex items-center justify-center font-bold px-3 py-1.5 rounded-lg shadow-sm backdrop-blur-sm w-fit">
                        Uploaded
                      </span>
                    ) : (
                      <span className="badge bg-yellow-500 dark:bg-yellow-500/30 text-white dark:text-yellow-300 border border-transparent dark:border-yellow-400/50 flex items-center justify-center font-bold px-3 py-1.5 rounded-lg shadow-sm backdrop-blur-sm w-fit">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {item.fileName ? (
                      <div className="flex items-center justify-between gap-2 max-w-[220px]">
                        <div className="flex flex-col">
                          <span
                            className="text-xs font-medium text-blue-600 dark:text-blue-400 truncate max-w-[150px]"
                            title={item.fileName}
                          >
                            {item.fileName}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {new Date(item.uploadDate).toLocaleDateString()}
                          </span>
                        </div>
                        <button
                          className="text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 transition-colors p-1.5 rounded-md shadow-sm border-0"
                          title="Download File"
                          onClick={() => {
                            const link = document.createElement('a');
                            const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://attendease-backend-81j7.onrender.com';
                            link.href = `${API_BASE}/api/upload/download/${item.id}`;
                            link.download = item.fileName;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                        >
                          <Download size={14} className="stroke-[2.5]" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400 italic">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MOBILE CARDS (hidden at 768 px and above) ── */}
      <div className="d-md-none" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
        {displayList.map((item) => (
          <div
            key={item.id}
            className="glass-3d-card"
            style={{
              borderRadius: '0.875rem',
              padding: '1rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid rgba(148,163,184,0.2)',
            }}
          >
            {/* Card header: avatar + name + subject badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem' }}>
              <div
                style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: '#2563eb', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '1rem', flexShrink: 0,
                }}
              >
                {item.name.split(' ')[1]?.[0] || item.name[0]}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span
                    className="badge bg-blue-600 dark:bg-blue-900 text-white border-0"
                    style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', display: 'inline-block' }}
                  >
                    {item.subject}
                  </span>
                </div>
              </div>

              {/* Status badge pushed to the right */}
              <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                {item.status === 'uploaded' ? (
                  <span
                    className="badge bg-green-600 dark:bg-green-500/30 text-white dark:text-green-300"
                    style={{ fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: '0.5rem' }}
                  >
                    Uploaded
                  </span>
                ) : (
                  <span
                    className="badge bg-yellow-500 dark:bg-yellow-500/30 text-white dark:text-yellow-300"
                    style={{ fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: '0.5rem' }}
                  >
                    Pending
                  </span>
                )}
              </div>
            </div>

            {/* Contact row */}
            <div
              style={{
                display: 'grid', gridTemplateColumns: '1fr',
                gap: '0.4rem 0.75rem',
                fontSize: '0.75rem',
                color: 'inherit',
                opacity: 0.8,
                marginBottom: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 }}>
                <Mail size={11} style={{ flexShrink: 0, color: '#2563eb' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.email}</span>
              </div>
            </div>

            {/* Upload details row */}
            {item.fileName && (
              <div
                style={{
                  borderTop: '1px solid rgba(148,163,184,0.2)',
                  paddingTop: '0.625rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5, marginBottom: 2 }}>
                    Uploaded File
                  </div>
                  <span
                    title={item.fileName}
                    style={{
                      fontSize: '0.75rem', fontWeight: 600, color: '#2563eb',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      display: 'block', maxWidth: '100%',
                    }}
                  >
                    {item.fileName}
                  </span>
                  <span style={{ fontSize: '0.65rem', opacity: 0.55 }}>{new Date(item.uploadDate).toLocaleDateString()}</span>
                </div>
                <button
                  title="Download"
                  className="text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 transition-colors border-0"
                  style={{ padding: '6px', borderRadius: '0.5rem', cursor: 'pointer', flexShrink: 0 }}
                  onClick={() => {
                    const link = document.createElement('a');
                    const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://attendease-backend-81j7.onrender.com';
                    link.href = `${API_BASE}/api/upload/download/${item.id}`;
                    link.download = item.fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                >
                  <Download size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FacultyManagement;
