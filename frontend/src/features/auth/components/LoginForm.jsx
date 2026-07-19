import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Users, Lock, Mail, AlertCircle, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useAuth } from '../../../AuthContext';
import { forgotPassword } from '../../../utils/api';

const LoginForm = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState('faculty'); // 'faculty' or 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmNewPassword, setForgotConfirmNewPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    const result = await login(email, password, activeTab);
    
    setIsLoading(false);
    if (result.success) {
      if (activeTab === 'faculty') {
        navigate('/faculty');
      } else {
        navigate('/admin');
      }
    } else {
      setError(result.message);
    }
  };

  const openForgotModal = (e) => {
    e.preventDefault();
    setForgotEmail(email); // autofill with whatever is in the login email field
    setForgotNewPassword('');
    setForgotConfirmNewPassword('');
    setForgotError('');
    setForgotSuccess(false);
    setShowForgotModal(true);
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (forgotNewPassword !== forgotConfirmNewPassword) {
      setForgotError('New passwords do not match');
      return;
    }
    if (forgotNewPassword.length < 8) {
      setForgotError('Password must be at least 8 characters long');
      return;
    }

    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess(false);

    try {
      await forgotPassword({
        email: forgotEmail,
        role: activeTab,
        newPassword: forgotNewPassword
      });
      setForgotSuccess(true);
      setForgotEmail('');
      setForgotNewPassword('');
      setForgotConfirmNewPassword('');
      setTimeout(() => {
        setShowForgotModal(false);
        setForgotSuccess(false);
      }, 1500);
    } catch (err) {
      setForgotError(err.message || 'Failed to reset password. Please check the email address.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <>
      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-700">
        <button
          onClick={() => { setActiveTab('faculty'); setError(''); }}
          className={`flex-1 py-4 text-center font-semibold transition-colors flex justify-center items-center gap-2 ${
            activeTab === 'faculty' 
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-400' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
          }`}
        >
          <Users size={18} /> Faculty
        </button>
        <button
          onClick={() => { setActiveTab('admin'); setError(''); }}
          className={`flex-1 py-4 text-center font-semibold transition-colors flex justify-center items-center gap-2 ${
            activeTab === 'admin' 
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-400' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
          }`}
        >
          <Lock size={18} /> Admin
        </button>
      </div>

      {/* Form */}
      <div className="p-6 sm:p-7">
        <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
          
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 p-3 rounded-lg flex items-center gap-2 text-sm fade-in animate-fade-in">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                autoComplete="off"
                placeholder="Enter your email address"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">Password</label>
              <a 
                href="#" 
                onClick={openForgotModal} 
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-10 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                autoComplete="new-password"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm">
          <span className="text-gray-500 dark:text-gray-400">Don't have an account? </span>
          <Link to="/signup" className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors">
            Sign up
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#0b192f] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 transition-colors duration-200">
            <div className="bg-slate-50 dark:bg-[#13151f] border-b border-slate-100 dark:border-[#1e2130] p-4 font-bold text-slate-800 dark:text-[#93c5fd] flex justify-between items-center">
              <span className="flex items-center gap-2"><KeyRound size={18} /> Forgot Password ({activeTab === 'faculty' ? 'Faculty' : 'Admin'})</span>
              <button onClick={() => setShowForgotModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xl">&times;</button>
            </div>
            <form onSubmit={handleForgotSubmit} className="p-6 space-y-4">
              {forgotError && <div className="text-xs text-red-600 bg-red-100 dark:bg-red-900/30 p-2 rounded border border-red-200 dark:border-red-900/50">{forgotError}</div>}
              {forgotSuccess && <div className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 p-2 rounded border border-green-200 dark:border-green-900/50">Password has been reset successfully!</div>}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">EMAIL ADDRESS</label>
                <input
                  type="email"
                  className="form-control text-sm py-2 bg-white dark:bg-slate-800 dark:text-white dark:border-slate-600"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@djsce.edu.in"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">NEW PASSWORD</label>
                <input
                  type="password"
                  className="form-control text-sm py-2 bg-white dark:bg-slate-800 dark:text-white dark:border-slate-600"
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">CONFIRM NEW PASSWORD</label>
                <input
                  type="password"
                  className="form-control text-sm py-2 bg-white dark:bg-slate-800 dark:text-white dark:border-slate-600"
                  value={forgotConfirmNewPassword}
                  onChange={(e) => setForgotConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowForgotModal(false)} className="btn btn-light btn-sm px-4">Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm px-4" disabled={forgotLoading}>
                  {forgotLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default LoginForm;
