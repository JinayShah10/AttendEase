import React, { useState } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { LayoutDashboard, Settings } from 'lucide-react';
import { useDarkMode } from '../DarkModeContext';
import { useAuth } from '../AuthContext';
import TopBar from '../components/TopBar';
import Sidebar from '../components/Sidebar';

// Feature Imports
import FacultyHome from '../features/faculty/FacultyHome';
import FacultySettings from '../features/faculty/FacultySettings';

const FacultyDashboard = () => {
  const [dark] = useDarkMode();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { name: 'Dashboard', path: '/faculty', icon: LayoutDashboard },
    { name: 'Settings', path: '/faculty/settings', icon: Settings },
  ];

  return (
    <div className={`flex h-screen overflow-hidden fade-in transition-colors duration-200 dashboard-bg ${dark ? 'dashboard-bg-dark' : 'dashboard-bg-light'}`}>
      {/* Sidebar */}
      <Sidebar
        portalName="Faculty Portal"
        userSubtitle={user?.name || "Professor"}
        avatarChar={user?.name ? user.name.charAt(0).toUpperCase() : "F"}
        navItems={navItems}
        onLogout={handleLogout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${dark ? 'app-dark dark' : ''}`}>
        <TopBar title="DJSCE Attendance Portal - Faculty" onMenuToggle={() => setIsMobileMenuOpen(true)} />
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-5 md:p-6 xl:p-8 max-w-6xl mx-auto w-full">
            <Routes>
              <Route path="/" element={<FacultyHome />} />
              <Route path="/settings" element={<FacultySettings />} />
            </Routes>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacultyDashboard;
