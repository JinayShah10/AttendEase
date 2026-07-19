import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DarkModeProvider } from './DarkModeContext';
import { AuthProvider } from './AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import AdminDashboard from './pages/AdminDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import Signup from './pages/Signup';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  // Apply saved dark mode preference on first load
  useEffect(() => {
    if (localStorage.getItem('djsce-dark-mode') === 'true') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-bs-theme', 'dark');
    }
  }, []);

  return (
    <DarkModeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/signup" element={<Signup />} />
            
            {/* Protected Admin Routes */}
            <Route 
              path="/admin/*" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <ErrorBoundary>
                    <AdminDashboard />
                  </ErrorBoundary>
                </ProtectedRoute>
              } 
            />
            
            {/* Protected Faculty Routes */}
            <Route 
              path="/faculty/*" 
              element={
                <ProtectedRoute requiredRole="faculty">
                  <ErrorBoundary>
                    <FacultyDashboard />
                  </ErrorBoundary>
                </ProtectedRoute>
              } 
            />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </DarkModeProvider>
  );
}

export default App;
