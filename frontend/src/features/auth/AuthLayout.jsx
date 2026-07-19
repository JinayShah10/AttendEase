import React from 'react';
import ThreeBackground from '../../components/ThreeBackground';
import svkmLogo from '../../assets/svkm.png';

const AuthLayout = ({ children, title, subtitle, dark }) => {
  return (
    <div className={`min-h-screen flex items-center justify-center p-4 sm:p-6 fade-in relative overflow-x-hidden auth-page-wrapper ${dark ? 'app-dark dark' : ''}`}>
      <ThreeBackground dark={dark} />

      <div className="max-w-md w-full relative z-10 py-8 sm:py-10">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-3 p-2 overflow-hidden border border-gray-100 dark:border-gray-700">
            <img src={svkmLogo} alt="SVKM Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white tracking-tight">
            {title}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm sm:text-base">{subtitle}</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl floating-form overflow-hidden border border-gray-100 dark:border-gray-700">
          {children}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 sm:mt-8 text-xs sm:text-sm text-gray-400 space-y-1">
          <p className="font-medium text-gray-500 dark:text-gray-300">Created by Jinay Shah, Bhavik Shah and Mahee Patkar</p>
          <p>&copy; {new Date().getFullYear()} Dwarkadas J. Sanghvi College of Engineering.</p>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
