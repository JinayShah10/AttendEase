import React, { useState } from 'react';
import { Moon, Bell, Shield, User } from 'lucide-react';
import { useDarkMode } from '../../DarkModeContext';
import { useAuth } from '../../AuthContext';
import { updateProfile, changePassword, deleteAccount } from '../../utils/api';

const FacultySettings = () => {
  const { user, updateUser, logout } = useAuth();
  const [dark, toggleDarkMode] = useDarkMode();
  const [emailAlerts, setEmailAlerts] = useState(true);

  // Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Delete Account State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  const handleDeleteAccount = async (e) => {
    if (e) e.preventDefault();
    if (!deletePassword) {
      setDeleteError('Password is required');
      return;
    }
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await deleteAccount(deletePassword);
      setShowDeleteModal(false);
      await logout();
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete account');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDeleteModal = () => {
    setDeletePassword('');
    setDeleteError('');
    setShowDeleteModal(true);
  };

  const openProfileModal = () => {
    setProfileName(user?.name || '');
    setProfileEmail(user?.email || '');
    setProfilePhone(user?.phone || '');
    setProfileError('');
    setProfileSuccess(false);
    setShowProfileModal(true);
  };

  const openPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordError('');
    setPasswordSuccess(false);
    setShowPasswordModal(true);
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess(false);

    try {
      const updatedUser = await updateProfile({
        name: profileName,
        email: profileEmail,
        phone: profilePhone
      });
      updateUser(updatedUser);
      setProfileSuccess(true);
      setTimeout(() => {
        setShowProfileModal(false);
        setProfileSuccess(false);
      }, 1500);
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile details');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSuccess(false);

    try {
      await changePassword({ currentPassword, newPassword });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess(false);
      }, 1500);
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="fade-in space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">System Settings</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage portal preferences and configurations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Appearance & Preferences */}
        <div className="card shadow-sm border-0 rounded-xl overflow-hidden glass-3d-card transition-colors duration-200">
          <div className="bg-gray-50 dark:bg-[#13151f] border-b border-gray-100 dark:border-[#1e2130] p-4 font-semibold text-gray-700 dark:text-[#93c5fd] flex items-center gap-2 transition-colors">
            <Moon size={18} /> Appearance & Preferences
          </div>
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h6 className="font-medium text-gray-800 dark:text-gray-200 mb-1">Dark Mode</h6>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-0">Also available via the top-right toggle button.</p>
              </div>
              <div className="form-check form-switch cursor-pointer">
                <input
                  className="form-check-input cursor-pointer"
                  type="checkbox"
                  role="switch"
                  checked={dark}
                  onChange={toggleDarkMode}
                  style={{ width: '3em', height: '1.5em' }}
                />
              </div>
            </div>

            <div className="flex justify-between items-center border-t pt-6">
              <div>
                <h6 className="font-medium text-gray-800 mb-1 flex items-center gap-2 dark:text-gray-200"><Bell size={16} /> Email Notifications</h6>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-0">Receive weekly attendance summary reports.</p>
              </div>
              <div className="form-check form-switch cursor-pointer">
                <input
                  className="form-check-input cursor-pointer"
                  type="checkbox"
                  role="switch"
                  checked={emailAlerts}
                  onChange={() => setEmailAlerts(!emailAlerts)}
                  style={{ width: '3em', height: '1.5em' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Security & Account */}
        <div className="card shadow-sm border-0 rounded-xl overflow-hidden glass-3d-card transition-colors duration-200">
          <div className="bg-gray-50 dark:bg-[#13151f] border-b border-gray-100 dark:border-[#1e2130] p-4 font-semibold text-gray-700 dark:text-[#93c5fd] flex items-center gap-2 transition-colors">
            <Shield size={18} /> Security & Account
          </div>
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h6 className="font-medium text-gray-800 mb-1 flex items-center gap-2 dark:text-gray-200"><User size={16} /> Profile Details</h6>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-0">Update your teacher profile parameters.</p>
              </div>
              <button onClick={openProfileModal} className="btn btn-outline-primary btn-sm px-4">Edit</button>
            </div>

            <div className="flex justify-between items-center border-t pt-6">
              <div>
                <h6 className="font-medium text-gray-800 mb-1 flex items-center gap-2 dark:text-gray-200"><Shield size={16} /> Password Reset</h6>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-0">Change your portal login credentials.</p>
              </div>
              <button onClick={openPasswordModal} className="btn btn-outline-secondary border-gray-300 btn-sm px-3">Change</button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#0b192f] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 transition-colors duration-200">
            <div className="bg-slate-50 dark:bg-[#13151f] border-b border-slate-100 dark:border-[#1e2130] p-4 font-bold text-slate-800 dark:text-[#93c5fd] flex justify-between items-center">
              <span>Edit Profile Details</span>
              <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xl">&times;</button>
            </div>
            <form onSubmit={handleProfileUpdate} className="p-6 space-y-4">
              {profileError && <div className="text-xs text-red-600 bg-red-100 dark:bg-red-900/30 p-2 rounded border border-red-200 dark:border-red-900/50">{profileError}</div>}
              {profileSuccess && <div className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 p-2 rounded border border-green-200 dark:border-green-900/50">Profile updated successfully!</div>}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">NAME</label>
                <input
                  type="text"
                  className="form-control text-sm py-2 bg-white dark:bg-slate-800 dark:text-white dark:border-slate-600"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">EMAIL</label>
                <input
                  type="email"
                  className="form-control text-sm py-2 bg-white dark:bg-slate-800 dark:text-white dark:border-slate-600"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">PHONE</label>
                <input
                  type="text"
                  className="form-control text-sm py-2 bg-white dark:bg-slate-800 dark:text-white dark:border-slate-600"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowProfileModal(false)} className="btn btn-light btn-sm px-4">Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm px-4" disabled={profileLoading}>
                  {profileLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#0b192f] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 transition-colors duration-200">
            <div className="bg-slate-50 dark:bg-[#13151f] border-b border-slate-100 dark:border-[#1e2130] p-4 font-bold text-slate-800 dark:text-[#93c5fd] flex justify-between items-center">
              <span>Change Password</span>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xl">&times;</button>
            </div>
            <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
              {passwordError && <div className="text-xs text-red-600 bg-red-100 dark:bg-red-900/30 p-2 rounded border border-red-200 dark:border-red-900/50">{passwordError}</div>}
              {passwordSuccess && <div className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 p-2 rounded border border-green-200 dark:border-green-900/50">Password changed successfully!</div>}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">CURRENT PASSWORD</label>
                <input
                  type="password"
                  className="form-control text-sm py-2 bg-white dark:bg-slate-800 dark:text-white dark:border-slate-600"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">NEW PASSWORD</label>
                <input
                  type="password"
                  className="form-control text-sm py-2 bg-white dark:bg-slate-800 dark:text-white dark:border-slate-600"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">CONFIRM NEW PASSWORD</label>
                <input
                  type="password"
                  className="form-control text-sm py-2 bg-white dark:bg-slate-800 dark:text-white dark:border-slate-600"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="btn btn-light btn-sm px-4">Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm px-4" disabled={passwordLoading}>
                  {passwordLoading ? 'Updating...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="card border border-red-200 dark:border-red-900 shadow-sm rounded-xl overflow-hidden mt-8 transition-colors duration-200">
        <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-[#1e2130] p-4 font-semibold text-red-800 dark:text-red-400 flex items-center gap-2 transition-colors">
          Danger Zone
        </div>
        <div className="p-6">
          <div className="flex justify-between items-center flex-wrap gap-4 fade-in">
            <div>
              <h6 className="font-medium text-slate-800 dark:text-slate-100 mb-1">Delete Account</h6>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-0">Permanently delete your faculty account and profile information.</p>
            </div>
            <button
              onClick={openDeleteModal}
              className="btn btn-danger btn-sm px-4 font-medium"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#0b192f] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 transition-colors duration-200">
            <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-[#1e2130] p-4 font-bold text-red-800 dark:text-red-400 flex justify-between items-center">
              <span>Delete Account Confirmation</span>
              <button onClick={() => setShowDeleteModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xl">&times;</button>
            </div>
            <form onSubmit={handleDeleteAccount} className="p-6 space-y-4">
              {deleteError && <div className="text-xs text-red-600 bg-red-100 dark:bg-red-900/30 p-2 rounded border border-red-200 dark:border-red-900/50">{deleteError}</div>}
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Are you absolutely sure you want to delete your account? This action is <strong>permanent</strong> and cannot be undone. All your profile information will be deleted.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">ENTER YOUR PASSWORD TO CONFIRM</label>
                <input
                  type="password"
                  className="form-control text-sm py-2 bg-white dark:bg-slate-800 dark:text-white dark:border-slate-600"
                  placeholder="Current Password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowDeleteModal(false)} className="btn btn-light btn-sm px-4" disabled={deleteLoading}>Cancel</button>
                <button type="submit" className="btn btn-danger btn-sm px-4" disabled={deleteLoading}>
                  {deleteLoading ? 'Deleting...' : 'Yes, Delete My Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultySettings;
