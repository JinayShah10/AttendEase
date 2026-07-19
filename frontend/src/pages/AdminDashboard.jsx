import React, { useState } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import {
  Users,
  BarChart,
  LayoutDashboard,
  Settings,
  AlertTriangle
} from 'lucide-react';
import { useDarkMode } from '../DarkModeContext';
import { useAuth } from '../AuthContext';
import TopBar from '../components/TopBar';
import Sidebar from '../components/Sidebar';

// Feature Imports
import AdminHome from '../features/admin/AdminHome';
import FacultyManagement from '../features/admin/FacultyManagement';
import AttendanceReports from '../features/admin/AttendanceReports';
import Defaulters from '../features/admin/Defaulters';
import SettingsManager from '../features/admin/SettingsManager';
import StudentManager from '../features/admin/StudentManager';

const AdminDashboard = () => {
  const [dark] = useDarkMode();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { name: 'Overview', path: '/admin', icon: LayoutDashboard },
    { name: 'Faculty Management', path: '/admin/faculty', icon: Users },
    { name: 'Students', path: '/admin/students', icon: Users },
    { name: 'Reports', path: '/admin/reports', icon: BarChart },
    { name: 'Defaulters', path: '/admin/defaulters', icon: AlertTriangle },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className={`flex h-screen overflow-hidden fade-in transition-colors duration-200 dashboard-bg ${dark ? 'dashboard-bg-dark' : 'dashboard-bg-light'}`}>
      {/* Sidebar */}
      <Sidebar
        portalName="Admin Portal"
        userTitle={user?.name || "Administrator"}
        userSubtitle={user?.assignedClass ? `Class Teacher - ${user.assignedClass.year} ${user.assignedClass.division}` : "No class assigned"}
        avatarChar={user?.name ? user.name.charAt(0).toUpperCase() : "A"}
        navItems={navItems}
        onLogout={handleLogout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${dark ? 'app-dark dark' : ''}`}>
        <TopBar title="DJSCE Attendance Portal - Admin" onMenuToggle={() => setIsMobileMenuOpen(true)} />
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-5 md:p-6 xl:p-8 max-w-7xl mx-auto w-full">
            <Routes>
              <Route path="/" element={<AdminHome />} />
              <Route path="/faculty" element={<FacultyManagement />} />
              <Route path="/students" element={<StudentManager />} />
              <Route path="/reports" element={<AttendanceReports />} />
              <Route path="/defaulters" element={<Defaulters />} />
              <Route path="/settings" element={<SettingsManager />} />
            </Routes>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
