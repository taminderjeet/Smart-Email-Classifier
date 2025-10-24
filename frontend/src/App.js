import './App.css';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { HiHome, HiViewGrid, HiCalendar, HiUserGroup, HiLogout, HiChevronDown, HiMenu, HiX } from 'react-icons/hi';
import { getAuthStatus, logout, clearUserData } from './services/api';
import classifierRunner from './utils/classifierRunner';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import CalendarPage from './pages/CalendarPage';
import SenderPage from './pages/SenderPage';
import EmailDetail from './pages/EmailDetail';

export default function App() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [classifyBusy, setClassifyBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile sidebar state
  const dropdownRef = useRef(null);

  // Check auth status on mount
  useEffect(() => {
    const check = async () => {
      try {
        setAuthChecking(true);
        const status = await getAuthStatus();
        const ok = !!(status && (status.logged_in || status.loggedIn));
        setLoggedIn(ok);
        if (ok) {
          setUser({
            email: status.email || '',
            name: status.name || '',
            picture: status.picture || '',
          });
        } else {
          // Fallback from localStorage
          const token = localStorage.getItem('gmailToken');
          const email = localStorage.getItem('userEmail') || localStorage.getItem('currentUserEmail');
          const name = localStorage.getItem('userName') || '';
          const picture = localStorage.getItem('userPicture') || '';
          if (token && email) {
            setLoggedIn(true);
            setUser({ email, name, picture });
          } else {
            setUser(null);
          }
        }
      } catch {
        // Fallback on error
        const token = localStorage.getItem('gmailToken');
        const email = localStorage.getItem('userEmail') || localStorage.getItem('currentUserEmail');
        const name = localStorage.getItem('userName') || '';
        const picture = localStorage.getItem('userPicture') || '';
        if (token && email) {
          setLoggedIn(true);
          setUser({ email, name, picture });
        } else {
          setLoggedIn(false);
          setUser(null);
        }
      } finally {
        setAuthChecking(false);
      }
    };
    check();
  }, []);

  // Subscribe to global classifier state to disable Logout while running
  useEffect(() => {
    const unsub = classifierRunner.subscribe((s) => {
      const busy = !!(s.initialBusy || s.bgBusy || s.running);
      setClassifyBusy(busy);
    });
    return unsub;
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await clearUserData();
      await logout();
    } finally {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page Route - No Sidebar */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        
        {/* App Routes with Sidebar */}
        <Route path="/*" element={
          <div className="flex min-h-screen bg-bg-primary overflow-x-hidden">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
              <div 
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Sidebar - Desktop (fixed) & Mobile (slide-in) */}
            <aside className={`
              fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 shadow-soft
              transform transition-transform duration-300 ease-in-out
              lg:translate-x-0 flex flex-col
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
              {/* Logo & Close Button */}
              <div className="flex items-center justify-between px-6 py-6 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">M</span>
                  </div>
                  <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    MailXpert
                  </span>
                </div>
                {/* Close button - only visible on mobile */}
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                >
                  <HiX className="text-xl" />
                </button>
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-3 py-6 space-y-1">
                <NavLink
                  to="/home"
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <HiHome className="text-xl flex-shrink-0" />
                  <span className="font-medium">Home</span>
                </NavLink>

                <NavLink
                  to="/dashboard"
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <HiViewGrid className="text-xl flex-shrink-0" />
                  <span className="font-medium">Dashboard</span>
                </NavLink>

                <NavLink
                  to="/sender"
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <HiUserGroup className="text-xl flex-shrink-0" />
                  <span className="font-medium">Other Senders</span>
                </NavLink>

                <NavLink
                  to="/calendar"
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <HiCalendar className="text-xl flex-shrink-0" />
                  <span className="font-medium">Calendar</span>
                </NavLink>
              </nav>

              {/* Logout Button */}
              <div className="px-3 pb-3">
                <button
                  onClick={handleLogout}
                  disabled={classifyBusy}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    classifyBusy
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60'
                      : 'text-gray-600 hover:bg-red-50 hover:text-red-600 active:bg-red-100'
                  }`}
                  title={classifyBusy ? 'Please wait while emails are being classified…' : 'Logout'}
                >
                  <HiLogout className="text-xl flex-shrink-0" />
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 lg:ml-64 min-w-0 overflow-x-hidden">
              {/* Mobile Header with Hamburger and Profile */}
              <div className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-200">
                <div className="flex items-center justify-between px-4 py-3">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                  >
                    <HiMenu className="text-2xl" />
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">M</span>
                    </div>
                    <span className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      MailXpert
                    </span>
                  </div>
                  
                  {/* Mobile Profile Icon */}
                  {!authChecking && loggedIn && user && (
                    <div className="relative" ref={dropdownRef}>
                      <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        {user.picture ? (
                          <img
                            src={user.picture}
                            alt={user.name || 'User'}
                            className="w-9 h-9 rounded-full ring-2 ring-indigo-100 shadow"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow">
                            <span className="text-white font-semibold text-sm">
                              {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </button>

                      {/* Mobile Dropdown Menu */}
                      {dropdownOpen && (
                        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 animate-fade-in">
                          <div className="px-4 py-3 border-b border-gray-100">
                            <p className="text-sm font-medium text-gray-900">{user.name || (user.email ? user.email.split('@')[0] : 'User')}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          </div>
                          <motion.button
                            onClick={() => { if (!classifyBusy) handleLogout(); }}
                            disabled={classifyBusy}
                            className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${
                              classifyBusy 
                                ? 'text-gray-400 cursor-not-allowed opacity-60' 
                                : 'text-red-600 hover:bg-red-50'
                            }`}
                            animate={{
                              opacity: classifyBusy ? 0.5 : 1,
                              filter: classifyBusy ? 'grayscale(100%)' : 'grayscale(0%)',
                            }}
                            transition={{ duration: 0.25 }}
                            title={classifyBusy ? 'Please wait while emails are being classified…' : 'Logout'}
                          >
                            <HiLogout className="text-lg" />
                            <span>Logout</span>
                          </motion.button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* User Profile Dropdown - Top Right (Desktop only) */}
              {!authChecking && loggedIn && user && (
                <div className="hidden lg:block sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-gray-200">
              <div className="px-4 sm:px-6 lg:px-8 py-3 max-w-7xl mx-auto">
                <div className="flex justify-end">
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      {user.picture ? (
                        <img
                          src={user.picture}
                          alt={user.name || 'User'}
                          className="w-8 h-8 rounded-full ring-2 ring-white shadow"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      {/* Show MailXpert on small screens, user info on larger screens */}
                      <div className="block sm:hidden text-left">
                        <div className="text-sm font-medium text-gray-900">
                          MailXpert
                        </div>
                      </div>
                      <div className="hidden sm:block text-left">
                        <div className="text-sm font-medium text-gray-900">
                          {user.name ? user.name.split(' ')[0] : (user.email ? user.email.split('@')[0] : 'User')}
                        </div>
                        <div className="text-xs text-gray-500 truncate max-w-[150px]">
                          {user.email}
                        </div>
                      </div>
                      <HiChevronDown className={`text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {dropdownOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 animate-fade-in">
                        <div className="px-4 py-3 border-b border-gray-100">
                          <p className="text-sm font-medium text-gray-900">{user.name || (user.email ? user.email.split('@')[0] : 'User')}</p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                        <motion.button
                          onClick={() => { if (!classifyBusy) handleLogout(); }}
                          disabled={classifyBusy}
                          initial={false}
                          animate={{ opacity: classifyBusy ? 0.5 : 1, filter: classifyBusy ? 'grayscale(20%)' : 'none' }}
                          transition={{ duration: 0.25 }}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-sm ${classifyBusy ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'} transition-colors`}
                          title={classifyBusy ? 'Please wait while emails are being classified…' : 'Logout'}
                        >
                          <HiLogout className="text-lg" />
                          <span>Logout</span>
                        </motion.button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <main className="w-full max-w-full overflow-x-hidden">
            <Routes>
              <Route path="/home" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/sender" element={<SenderPage />} />
              <Route path="/email/:id" element={<EmailDetail />} />
            </Routes>
          </main>
        </div>
      </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}
