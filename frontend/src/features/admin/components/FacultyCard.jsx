import React from 'react';
import { Download } from 'lucide-react';

const FacultyCard = ({ faculty }) => {
  return (
    <div className="card shadow-sm border-0 rounded-xl glass-3d-card p-4 transition-all hover:shadow-md">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex justify-center items-center font-bold text-lg shadow-sm">
          {faculty.name.split(' ')[1]?.[0] || faculty.name[0]}
        </div>
        <div>
          <h5 className="font-bold text-slate-900 dark:text-slate-100 mb-0">{faculty.name}</h5>
          <span className="badge bg-blue-600/10 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border-0 font-medium px-2 py-0.5 rounded text-xs">
            {faculty.subject}
          </span>
        </div>
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="text-xs text-slate-600 dark:text-slate-300">
          <p className="mb-1 truncate"><strong>Email:</strong> {faculty.email}</p>
          <p className="mb-0"><strong>Phone:</strong> {faculty.phone}</p>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold mb-1">Status</span>
            {faculty.uploads.length > 0 ? (
              <span className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Uploaded
              </span>
            ) : (
              <span className="text-xs font-bold text-red-500 dark:text-red-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Pending
              </span>
            )}
          </div>
          
          {faculty.uploads.length > 0 && (
            <button 
              className="btn btn-sm btn-light border-0 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg p-2"
              title="Download Recent"
            >
              <Download size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FacultyCard;
