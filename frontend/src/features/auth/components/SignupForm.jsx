import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Users, Lock, Mail, Phone, User as UserIcon, Eye, EyeOff } from 'lucide-react';
import { fetchMasterClasses, registerUser } from '../../../utils/api';

const SignupForm = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('faculty'); // 'faculty' or 'admin'

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Admin class selection
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');

  useEffect(() => {
    if (activeTab === 'admin') {
      fetchMasterClasses()
        .then(data => setClasses(data))
        .catch(err => console.error('Error fetching classes:', err));
    }
  }, [activeTab]);

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(formData.phone)) {
      newErrors.phone = 'Phone number must be 10 digits';
    }
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    else if (!/\d/.test(formData.password)) newErrors.password = 'Password must contain at least one number';
    else if (!/[A-Z]/.test(formData.password)) newErrors.password = 'Password must contain at least one uppercase letter';

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (activeTab === 'admin' && !selectedClassId) {
      newErrors.classId = 'Please select a class';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    if (validate()) {
      setIsLoading(true);
      try {
        await registerUser({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          role: activeTab,
          ...(activeTab === 'admin' && { classId: selectedClassId }),
        });

        setShowSuccess(true);
        setFormData({ name: '', phone: '', email: '', password: '', confirmPassword: '' });
        setSelectedClassId('');
        setErrors({});
        
        // Smooth scroll to top to see message
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } catch (err) {
        setErrors(prev => ({ ...prev, server: err.message || 'Failed to connect to the server' }));
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <>
      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-700">
        <button
          type="button"
          onClick={() => { setActiveTab('faculty'); setErrors({}); }}
          className={`flex-1 py-3 text-center font-semibold transition-colors flex justify-center items-center gap-2 ${activeTab === 'faculty'
            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-400'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
        >
          <Users size={18} /> Faculty
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('admin'); setErrors({}); setSelectedClassId(''); }}
          className={`flex-1 py-3 text-center font-semibold transition-colors flex justify-center items-center gap-2 ${activeTab === 'admin'
            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-400'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
        >
          <Lock size={18} /> Admin
        </button>
      </div>

      {/* Form */}
      <div className="p-4 sm:p-5">
        {showSuccess && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg dark:bg-green-900/30 dark:border-green-800 dark:text-green-400 flex flex-col items-center text-center gap-2 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mb-1">
              <svg className="w-6 h-6 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <div className="font-bold text-base">Account Created Successfully!</div>
            <div>Your {activeTab} account has been registered. Redirecting to sign in...</div>
          </div>
        )}
        <form onSubmit={handleSignup} className="space-y-2.5" autoComplete="off">

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">Full Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`block w-full pl-10 pr-3 py-2 border ${errors.name ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500`}
                autoComplete="off"
                placeholder="John Doe"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">Phone Number</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className={`block w-full pl-10 pr-3 py-2 border ${errors.phone ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500`}
                autoComplete="off"
                placeholder="9876543210"
              />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`block w-full pl-10 pr-3 py-2 border ${errors.email ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500`}
                autoComplete="off"
                placeholder="professor@djsce.edu.in"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
          </div>

          {/* Class Selection (Admin only) */}
          {activeTab === 'admin' && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">Assigned Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className={`block w-full py-2 px-3 border ${errors.classId ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
              >
                <option value="">-- Select Your Class --</option>
                {classes.map(cls => (
                  <option key={cls._id} value={cls._id}>
                    {cls.name} ({cls.year} {cls.division})
                  </option>
                ))}
              </select>
              {errors.classId && <p className="text-red-500 text-xs mt-1">{errors.classId}</p>}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`block w-full pl-10 pr-10 py-2 border ${errors.password ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500`}
                autoComplete="new-password"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                )}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">Confirm Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={`block w-full pl-10 pr-10 py-2 border ${errors.confirmPassword ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500`}
                autoComplete="new-password"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                )}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
          </div>

          {errors.server && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg dark:bg-red-900/30 dark:border-red-800 dark:text-red-400 whitespace-pre-line">
              {errors.server}
            </div>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          <span className="text-gray-500 dark:text-gray-400">Already have an account? </span>
          <Link to="/" className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors">
            Sign in
          </Link>
        </div>
      </div>
    </>
  );
};

export default SignupForm;
