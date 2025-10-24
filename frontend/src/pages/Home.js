import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiMail, HiInboxIn, HiTrendingUp, HiChevronDown, HiChevronUp } from 'react-icons/hi';
import GoogleLoginButton from '../components/GoogleLoginButton';
import { getAuthStatus, fetchAndClassify, getAllProcessedEmails as getAllGmailProcessed } from '../services/api';
import EmailCard from '../components/EmailCard';

// Helper: get today's local date as YYYY-MM-DD
const getTodayString = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

// Check if email is from today - backend returns date as YYYY-MM-DD
const isTodayEmail = (email) => {
  if (!email) return false;
  
  const today = getTodayString();
  
  // Check email.date field (backend returns YYYY-MM-DD format)
  if (email.date) {
    // If it's already YYYY-MM-DD, compare directly
    if (typeof email.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(email.date)) {
      return email.date === today;
    }
    // If it's ISO timestamp, extract date part
    if (typeof email.date === 'string' && email.date.includes('T')) {
      return email.date.split('T')[0] === today;
    }
  }
  
  // Fallback: check receivedAt (set by Dashboard/Home refresh)
  if (email.receivedAt) {
    try {
      const d = new Date(email.receivedAt);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const emailDate = `${y}-${m}-${dd}`;
      return emailDate === today;
    } catch {}
  }
  
  return false;
};

// Read profile from localStorage synchronously to avoid greeting flicker
function readInitialUserInfo() {
  try {
    const email = localStorage.getItem('userEmail') || localStorage.getItem('currentUserEmail') || '';
    const name = localStorage.getItem('userName') || '';
    const picture = localStorage.getItem('userPicture') || '';
    if (name || email) return { email, name, picture };
  } catch {}
  return null;
}

export default function Home(){
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authChecking, setAuthChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(readInitialUserInfo()); // Initialize from cache to prevent re-processing flicker
  const [gmailBusy, setGmailBusy] = useState(false);
  const [urlProcessed, setUrlProcessed] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});

  // Helper: read query param for login flow
  const loginSuccess = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('login') === 'success';
  }, []);

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Group emails by category
  const emailsByCategory = useMemo(() => {
    const grouped = {};
    items.forEach(email => {
      const cats = email.categories || ['Uncategorized'];
      cats.forEach(cat => {
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(email);
      });
    });
    return grouped;
  }, [items]);

  // Get top category
  const topCategory = useMemo(() => {
    const entries = Object.entries(emailsByCategory);
    if (entries.length === 0) return 'None';
    entries.sort((a, b) => b[1].length - a[1].length);
    return entries[0][0];
  }, [emailsByCategory]);

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  useEffect(() => {
    // 1) Process OAuth callback params if present on Home (defensive; backend usually redirects to /dashboard)
    try {
      const url = new URL(window.location.href);
      const p = url.searchParams;
      const token = p.get('token');
      const email = p.get('email');
      const name = p.get('name');
      const picture = p.get('picture');
      const login = p.get('login');
      if (token && email) {
        // Account switch handling: if different email, clear cached app data
        const prev = localStorage.getItem('userEmail') || localStorage.getItem('currentUserEmail');
        if (prev && prev !== email) {
          try { localStorage.removeItem('appCache'); } catch {}
        }
        try {
          localStorage.setItem('gmailToken', token);
          localStorage.setItem('userEmail', email);
          if (name) localStorage.setItem('userName', name);
          if (picture) localStorage.setItem('userPicture', picture);
          // Keep backward-compat key
          localStorage.setItem('currentUserEmail', email);
        } catch {}
        // Clean URL after processing
        url.search = '';
        window.history.replaceState({}, document.title, url.toString());
        setUrlProcessed(true);
        // If login=success, we could redirect to dashboard, but keep user on Home as requested
      }
    } catch {}

    // Load cached emails from Dashboard's appCache and filter for today only
    const loadTodayEmails = () => {
      try {
        // Preferred cache root
        const raw = localStorage.getItem('appCache');
        let allEmails = [];
        if (raw) {
          const cache = JSON.parse(raw);
          if (cache && cache.classifiedEmailsMap && typeof cache.classifiedEmailsMap === 'object') {
            allEmails = Object.values(cache.classifiedEmailsMap);
          }
        }
        // Fallback: legacy map key
        if (allEmails.length === 0) {
          const legacyMapRaw = localStorage.getItem('classifiedEmailsMap');
          if (legacyMapRaw) {
            const mapObj = JSON.parse(legacyMapRaw) || {};
            allEmails = Object.values(mapObj);
          }
        }
        // Fallback: legacy array key
        if (allEmails.length === 0) {
          const legacyArrRaw = localStorage.getItem('classifiedEmails');
          if (legacyArrRaw) {
            const arr = JSON.parse(legacyArrRaw) || [];
            allEmails = Array.isArray(arr) ? arr : [];
          }
        }

        console.log('[Home] Total emails loaded:', allEmails.length);
        console.log('[Home] Today string:', getTodayString());
        if (allEmails.length > 0) {
          console.log('[Home] Sample email date:', allEmails[0]?.date);
          console.log('[Home] Sample email:', allEmails[0]);
        }

        // Filter to only show emails from today
        const todayEmails = allEmails.filter((email) => isTodayEmail(email));
        console.log('[Home] Today emails filtered:', todayEmails.length);
        
        // Store total count for helpful message
        if (allEmails.length > 0 && todayEmails.length === 0) {
          setError(`No emails from today, but ${allEmails.length} email${allEmails.length !== 1 ? 's' : ''} found in Dashboard`);
        }
        
        setItems(todayEmails);
      } catch (e) {
        console.error('Error loading today emails:', e);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    // Check auth status
    const checkAuth = async () => {
      try {
        setAuthChecking(true);
        const status = await getAuthStatus();
        // Support both logged_in and loggedIn flags
        const isLogged = !!(status && (status.logged_in || status.loggedIn));
        setLoggedIn(isLogged);
        
        // Store user info if logged in
        if (isLogged && status) {
          const next = {
            email: status.email || '',
            name: status.name || '',
            picture: status.picture || ''
          };
          setUserInfo((prev) => {
            // Only update if changed to avoid unnecessary re-renders/flicker
            if (!prev || prev.email !== next.email || prev.name !== next.name || prev.picture !== next.picture) {
              try {
                if (next.email) localStorage.setItem('userEmail', next.email);
                if (next.name) localStorage.setItem('userName', next.name);
                if (next.picture) localStorage.setItem('userPicture', next.picture);
                localStorage.setItem('currentUserEmail', next.email || '');
              } catch {}
              return next;
            }
            return prev;
          });
        } else {
          // Fallback: if backend session not yet visible but we have local token/email, show profile to avoid showing Connect button
          try {
            const token = localStorage.getItem('gmailToken');
            const email = localStorage.getItem('userEmail') || localStorage.getItem('currentUserEmail');
            const name = localStorage.getItem('userName') || '';
            const picture = localStorage.getItem('userPicture') || '';
            if (token && email) {
              setLoggedIn(true);
              // Keep cached values to avoid flicker; only fill missing fields
              setUserInfo((prev) => ({
                email: prev?.email || email,
                name: prev?.name || name,
                picture: prev?.picture || picture,
              }));
            } else {
              setUserInfo(null);
            }
          } catch {
            setUserInfo(null);
          }
        }

        // If we just returned from OAuth and are logged in, redirect to dashboard
        if (loginSuccess && isLogged) {
          window.location.href = '/dashboard?login=success';
          return;
        }
      } catch {
        // On error, also try the localStorage fallback
        try {
          const token = localStorage.getItem('gmailToken');
          const email = localStorage.getItem('userEmail') || localStorage.getItem('currentUserEmail');
          const name = localStorage.getItem('userName') || '';
          const picture = localStorage.getItem('userPicture') || '';
          if (token && email) {
            setLoggedIn(true);
            setUserInfo((prev) => ({
              email: prev?.email || email,
              name: prev?.name || name,
              picture: prev?.picture || picture,
            }));
          } else {
            setLoggedIn(false);
            setUserInfo(null);
          }
        } catch {
          setLoggedIn(false);
          setUserInfo(null);
        }
      } finally {
        setAuthChecking(false);
      }
    };

    loadTodayEmails();
    checkAuth();
  }, [loginSuccess]);

  // Fetch new Gmail emails and refresh today's list
  async function handleFetchGmail() {
    try {
      setGmailBusy(true);
      setError('');
      
      const token = localStorage.getItem('gmailToken');
      if (!token) {
        setError('Please connect Gmail first. Redirecting to Dashboard...');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1500);
        return;
      }
      
      // Use fetchAndClassify instead of fetchEmails (better endpoint)
      const response = await fetchAndClassify({ max_results: 20 });
      
      // Load existing root/map
      let root;
      try {
        root = JSON.parse(localStorage.getItem('appCache') || 'null') || { classifiedEmailsMap: {} };
      } catch { root = { classifiedEmailsMap: {} }; }
      let mapObj = (root && root.classifiedEmailsMap) || {};
      if (!mapObj || typeof mapObj !== 'object') mapObj = {};

      // Merge newly processed emails
      const newlyProcessed = Array.isArray(response?.processed) ? response.processed : [];
      console.log('[Home Refresh] Newly fetched emails:', newlyProcessed.length);
      
      if (newlyProcessed.length > 0) {
        for (const item of newlyProcessed) {
          if (item && item.id) {
            const prev = mapObj[item.id] || {};
            const receivedAt = prev.receivedAt
              || item.receivedAt
              || item.timestamp
              || item.internalDate
              || item.date
              || Date.now();
            mapObj[item.id] = { ...prev, ...item, receivedAt };
          }
        }
        // Persist
        root = { classifiedEmailsMap: mapObj };
        try {
          localStorage.setItem('appCache', JSON.stringify(root));
          localStorage.setItem('classifiedEmailsMap', JSON.stringify(mapObj));
        } catch {}
      }

      // Recompute today list
      const allEmails = Object.values(mapObj);
      console.log('[Home Refresh] Total emails after fetch:', allEmails.length);
      const todayEmails = allEmails.filter((email) => isTodayEmail(email));
      console.log('[Home Refresh] Today emails after filter:', todayEmails.length);
      setItems(todayEmails);
      
      if (newlyProcessed.length > 0) {
        setError(`✓ Successfully fetched ${newlyProcessed.length} new email${newlyProcessed.length !== 1 ? 's' : ''}`);
        setTimeout(() => setError(''), 3000);
      } else {
        setError('No new emails found');
        setTimeout(() => setError(''), 2000);
      }
    } catch (e) {
      const errMsg = e?.message || 'Failed to fetch Gmail emails';
      setError(errMsg);
      console.error('Fetch Gmail error:', e);
    } finally {
      setGmailBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <h2 className="text-lg text-gray-700">Loading today's emails...</h2>
        </div>
      </div>
    );
  }

  const todayDate = getTodayString();
  // Extract first name from full name, or use email username as fallback
  const userName = userInfo?.name 
    ? userInfo.name.split(' ')[0] 
    : (userInfo?.email ? userInfo.email.split('@')[0] : 'User');

  return (
    <div className="space-y-6 animate-fade-in px-4 sm:px-6 lg:px-8 py-6">
      {/* Greeting Section - Responsive */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex-1 min-w-0">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-2xl sm:text-3xl lg:text-4xl font-black mb-2"
          >
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradient break-words">
              {getGreeting()}, {userName}
            </span>
            <motion.span
              animate={{ rotate: [0, 14, -8, 14, 0] }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="inline-block ml-2"
            >
              👋
            </motion.span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-sm sm:text-base text-gray-500 mt-1 flex items-center gap-2 flex-wrap"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="truncate">{todayDate}</span>
            <span>•</span>
            <span>{items.length} email{items.length !== 1 ? 's' : ''} today</span>
          </motion.p>
        </div>
        
        <div className="flex items-center gap-3 flex-shrink-0">
          {!authChecking && !loggedIn && <GoogleLoginButton />}
          {!authChecking && loggedIn && (
            <button
              onClick={handleFetchGmail}
              disabled={gmailBusy}
              className={`btn-primary whitespace-nowrap text-sm sm:text-base ${gmailBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {gmailBusy ? 'Fetching…' : 'Refresh Emails'}
            </button>
          )}
        </div>
      </motion.div>

      {/* Stats Cards - Responsive Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 p-1 sm:p-2"
      >
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Emails Today</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{items.length}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center flex-shrink-0">
              <HiMail className="text-xl sm:text-2xl text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Unread Emails</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{items.length}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center flex-shrink-0">
              <HiInboxIn className="text-xl sm:text-2xl text-purple-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 sm:mt-3 text-xs text-gray-500">
            <span>All from today</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Top Category</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 truncate">{topCategory}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center flex-shrink-0">
              <span className="text-xl sm:text-2xl">📊</span>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 sm:mt-3 text-xs text-gray-500">
            <span>{emailsByCategory[topCategory]?.length || 0} emails</span>
          </div>
        </div>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`glass-card p-4 border-l-4 ${
            error.startsWith('✓') 
              ? 'border-green-500 bg-green-50' 
              : 'border-red-500 bg-red-50'
          }`}
        >
          <p className={error.startsWith('✓') ? 'text-green-700' : 'text-red-700'}>
            {error}
          </p>
        </motion.div>
      )}

      {items.length === 0 && !error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12 text-center border-2 border-dashed border-gray-200"
        >
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <HiMail className="text-3xl text-gray-400" />
          </div>
          <p className="text-gray-600 text-lg font-medium">No emails from today yet</p>
          {loggedIn && (
            <p className="text-gray-400 mt-2 text-sm">Click "Refresh Emails" to fetch from Gmail</p>
          )}
          {!loggedIn && (
            <p className="text-gray-400 mt-2 text-sm">Connect your Gmail account to see your emails</p>
          )}
        </motion.div>
      )}

      {/* Categories & Emails - Responsive */}
      {items.length > 0 && (
        <div className="space-y-4 p-1">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Today's Emails by Category</h2>
          
          {Object.entries(emailsByCategory).map(([category, emails], index) => (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="glass-card overflow-hidden"
            >
              {/* Category Header - Responsive */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <span className="text-xl sm:text-2xl flex-shrink-0">
                    {category === 'Work' ? '💼' : category === 'Personal' ? '👤' : category === 'Promotions' ? '🎯' : '📧'}
                  </span>
                  <div className="text-left min-w-0 flex-1">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{category}</h3>
                    <p className="text-xs sm:text-sm text-gray-500">{emails.length} email{emails.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <motion.div
                  animate={{ rotate: expandedCategories[category] ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-shrink-0"
                >
                  <HiChevronDown className="text-xl text-gray-400" />
                </motion.div>
              </button>

              {/* Category Emails */}
              <AnimatePresence>
                {expandedCategories[category] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="border-t border-gray-100"
                  >
                    <div className="p-3 sm:p-4 space-y-4 bg-gray-50/30">
                      {emails.map((email, idx) => (
                        <EmailCard key={email.id || idx} email={email} hideCategories={true} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
