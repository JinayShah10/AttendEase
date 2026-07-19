import { Moon, Sun, Menu } from 'lucide-react';
import { useDarkMode } from '../DarkModeContext';

const TopBar = ({ title, onMenuToggle }) => {
  const [dark, toggleDark] = useDarkMode();
  return (
    <div style={{
      backgroundColor: dark ? '#13151f' : '#ffffff',
      borderBottomColor: dark ? '#1e2130' : '#f3f4f6',
      color: dark ? '#cbd5e1' : '#4b5563',
    }} className="sticky top-0 z-20 flex items-center justify-between gap-2 px-4 md:px-6 py-3 border-b shadow-sm transition-colors duration-200">
      {/* Title side - truncates on tiny screens, never grows into the button */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
        {onMenuToggle && (
          <button onClick={onMenuToggle} className="md:hidden p-1.5 -ml-2 rounded-md hover:opacity-80 transition-opacity flex-shrink-0">
            <Menu size={20} />
          </button>
        )}
        <span className="text-[10px] sm:text-xs md:text-sm font-semibold tracking-wide whitespace-nowrap">{title}</span>
      </div>

      {/* Dark/Light toggle - icon-only on xs, full pill on sm+ */}
      <button
        onClick={toggleDark}
        title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        style={{
          backgroundColor: dark ? '#1e2140' : '#f9fafb',
          borderColor: dark ? '#2d3154' : '#e5e7eb',
          color: dark ? '#fbbf24' : '#6b7280',
        }}
        className="flex-shrink-0 flex items-center justify-center gap-1.5 w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-full border transition-all duration-200 text-sm font-medium shadow-sm hover:opacity-80"
      >
        {dark ? <Sun size={15} /> : <Moon size={15} />}
        <span className="text-xs hidden sm:inline">{dark ? 'Light' : 'Dark'}</span>
      </button>
    </div>
  );
};

export default TopBar;
