import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import classifierRunner from '../utils/classifierRunner';
import { API_BASE as apiUrl, getAuthStatus, startAuthLogin, logout, clearUserData } from '../services/api';

// GoogleLoginButton
// - No props
// - On login click: navigate to `${apiUrl}/auth/login`
// - After redirect back, it checks login state via getAuthStatus()
// - Renders Login when not logged in; Logout when logged in
export default function GoogleLoginButton() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [classifyBusy, setClassifyBusy] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      setLoading(true);
      const status = await getAuthStatus();
      if (status && status.logged_in) {
        setLoggedIn(true);
        setUserEmail(status.email || '');
      } else {
        setLoggedIn(false);
        setUserEmail('');
      }
    } catch (e) {
      // If status fails, consider user not logged in
      setLoggedIn(false);
      setUserEmail('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check status on mount and after redirect back to the app
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const unsub = classifierRunner.subscribe((s) => {
      const busy = !!(s.initialBusy || s.bgBusy || s.running);
      setClassifyBusy(busy);
    });
    return unsub;
  }, []);

  const handleLogin = () => {
    // Use API_BASE for explicit requirement, but rely on helper for correctness
    const url = startAuthLogin() || `${apiUrl}/auth/login`;
    window.location.href = url;
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      // Clear backend user data first (best-effort)
      try { await clearUserData(); } catch {}
      await logout();
      // Clear all locally stored data
      try { localStorage.clear(); } catch {}
      setLoggedIn(false);
      setUserEmail('');
      // Force a reload to reset app state/routes if needed
      window.location.reload();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        type="button"
        className="w-full px-6 py-4 rounded-xl bg-gray-100 text-gray-400 cursor-not-allowed flex items-center justify-center gap-3 font-medium shadow-sm"
        disabled
        aria-busy="true"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full"
        />
        Checking login…
      </motion.button>
    );
  }

  if (!loggedIn) {
    return (
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02, boxShadow: "0 20px 40px rgba(79, 70, 229, 0.2)" }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2 }}
        type="button"
        onClick={handleLogin}
        className="w-full px-6 py-4 rounded-xl bg-white hover:bg-gray-50 text-gray-800 font-semibold shadow-lg hover:shadow-xl border-2 border-gray-200 hover:border-indigo-300 flex items-center justify-center gap-3 transition-all duration-300 group relative overflow-hidden"
        aria-label="Login with Google"
      >
        {/* Subtle gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/0 via-purple-50/50 to-indigo-50/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Google Logo SVG */}
        <svg className="w-6 h-6 relative z-10" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        
        <span className="relative z-10">Continue with Google</span>
      </motion.button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {userEmail ? (
        <span className="text-sm text-gray-600" title={userEmail}>
          Signed in as {userEmail}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => { if (!classifyBusy) handleLogout(); }}
        disabled={classifyBusy}
        className={`px-3 py-2 rounded ${classifyBusy ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'} transition-colors`}
        aria-label="Logout"
        title={classifyBusy ? 'Please wait while emails are being classified…' : 'Logout'}
      >
        Logout
      </button>
    </div>
  );
}
