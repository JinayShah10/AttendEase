import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import { useDarkMode } from '../DarkModeContext';

const Sidebar = ({
  portalName,
  userTitle,
  userSubtitle,
  avatarChar,
  navItems,
  onLogout,
  isMobileMenuOpen,
  setIsMobileMenuOpen
}) => {
  const [dark] = useDarkMode();
  const location = useLocation();

  // Appearance variables (Unified across dashboards)
  const sidebarBg = dark ? '#0a192f' : '#ffffff';
  const sidebarBorder = dark ? '#1e293b' : '#e5e7eb';
  const navActiveBg = dark ? '#1e3a8a' : '#eff6ff';
  const navActiveText = dark ? '#60a5fa' : '#2563eb';
  const navHoverBg = dark ? '#1e293b' : '#f3f4f6';
  const navText = dark ? '#94a3b8' : '#475569';
  const logoutHoverBg = dark ? 'rgba(153,27,27,0.2)' : '#fef2f2';

  return (
    <div
      style={{ backgroundColor: sidebarBg, borderRightColor: sidebarBorder }}
      className={`fixed inset-y-0 left-0 z-50 md:relative flex flex-col justify-between shadow-sm border-r transition-all duration-300 ease-in-out flex-shrink-0 ${
        isMobileMenuOpen
          ? 'translate-x-0 w-64'
          : '-translate-x-full w-64 md:translate-x-0 md:w-20 lg:w-64'
      }`}
    >
      <div>
        {/* Header Section */}
        <div
          style={{ borderBottomColor: sidebarBorder }}
          className="flex items-center justify-center p-4 border-b mb-4 min-h-[73px] relative"
        >
          {/* Logo/Info text - hidden on tablet when collapsed */}
          <div
            className={`flex flex-col items-center justify-center text-center w-full mx-auto transition-opacity duration-200 ${
              isMobileMenuOpen ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <h1
              className="text-sm xl:text-base font-bold tracking-tight leading-tight whitespace-nowrap"
              style={{ color: dark ? '#60a5fa' : '#0d6efd' }}
            >
              {portalName}
            </h1>
            {userTitle && (
              <p
                className="text-sm font-semibold mt-1 whitespace-nowrap"
                style={{ color: dark ? '#e2e8f0' : '#1e293b' }}
              >
                {userTitle}
              </p>
            )}
            {userSubtitle && (
              <p
                className="text-xs font-medium mt-0.5 whitespace-nowrap"
                style={{ color: dark ? '#94a3b8' : '#475569' }}
              >
                {userSubtitle}
              </p>
            )}
          </div>

          {/* Tablet Icon Replacement - visible only on tablet when collapsed */}
          <div
            className={`hidden md:flex lg:hidden justify-center items-center w-full ${
              isMobileMenuOpen ? 'hidden' : 'flex'
            }`}
          >
            <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold text-lg shadow-sm flex items-center justify-center rounded-xl">
              {avatarChar}
            </div>
          </div>

          {/* Close button (Mobile only) */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-1 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors h-fit absolute right-3 top-3"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Section */}
        <nav className="space-y-1 px-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                style={{
                  backgroundColor: isActive ? navActiveBg : 'transparent',
                  color: isActive ? navActiveText : navText,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = navHoverBg;
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
                className={`flex items-center px-4 py-3 rounded-lg transition-all duration-150 overflow-hidden ${
                  isActive ? 'font-semibold' : ''
                } ${
                  isMobileMenuOpen
                    ? 'space-x-3 justify-start'
                    : 'md:justify-center lg:justify-start space-x-3'
                }`}
                title={item.name}
              >
                <Icon size={20} className="shrink-0" />
                <span
                  className={`${
                    isMobileMenuOpen ? 'block' : 'md:hidden lg:block'
                  } whitespace-nowrap`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / Logout Section */}
      <div style={{ borderTopColor: sidebarBorder }} className="p-4 border-t">
        <button
          onClick={onLogout}
          style={{ color: navText }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = logoutHoverBg;
            e.currentTarget.style.color = '#ef4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = navText;
          }}
          className={`flex w-full items-center px-4 py-3 rounded-lg transition-colors overflow-hidden ${
            isMobileMenuOpen
              ? 'space-x-3 justify-start'
              : 'md:justify-center lg:justify-start space-x-3'
          }`}
          title="Logout"
        >
          <LogOut size={20} className="shrink-0" />
          <span
            className={`${
              isMobileMenuOpen ? 'block' : 'md:hidden lg:block'
            } whitespace-nowrap`}
          >
            Logout
          </span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
