import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiMail, HiFolder, HiUserCircle, HiViewGrid, HiChevronDown, HiX } from 'react-icons/hi';
import EmailCard from '../components/EmailCard';
import GoogleLoginButton from '../components/GoogleLoginButton';
import { fetchAndClassify } from '../services/api';
import classifierRunner from '../utils/classifierRunner';

export default function Dashboard(){
  const [emails, setEmails] = useState([]);
  const [selected, setSelected] = useState('All');
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, etaMs: 0 });
  const [error, setError] = useState(null);
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  // Background staged loading
  const [bgBusy, setBgBusy] = useState(false);
  const [sessionAdded, setSessionAdded] = useState(0); // emails added in this run
  const BG_TARGET = 100; // target number of emails to load in total for this session
  const [runnerTarget, setRunnerTarget] = useState(100);

  // Cache helpers: use a root object with a map to avoid duplicates
  function readCacheRoot() {
    try {
      const raw = localStorage.getItem('appCache');
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') return obj;
    } catch {}
    return null;
  }

  function writeCacheRoot(root) {
    try {
      const safe = root && typeof root === 'object' ? root : { classifiedEmailsMap: {} };
      localStorage.setItem('appCache', JSON.stringify(safe));
    } catch {}
  }

  useEffect(() => {
    // Capture token from URL, auto-run on login=success, and load cached emails from map
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userEmail = params.get('email');
    const loginSuccess = params.get('login') === 'success';
    let shouldAutoFetch = false;
    
    if (token) {
      // Check if user account changed
      const previousEmail = localStorage.getItem('currentUserEmail');
      const isNewUser = previousEmail && previousEmail !== userEmail;
      
      if (isNewUser && userEmail) {
        // New user detected - clear all data EXCEPT the new token and email
        console.log('New user detected, clearing previous user data...');
        
        // Save the new credentials BEFORE clearing
        const newToken = token;
        const newEmail = userEmail;
        
        // Clear everything
        localStorage.clear();
        
        // Restore the new user's credentials
        localStorage.setItem('gmailToken', newToken);
        localStorage.setItem('currentUserEmail', newEmail);
        
        // Call backend to clear server-side data
        fetch('http://localhost:8000/clear-user-data', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'Content-Type': 'application/json',
          }
        }).catch(err => console.warn('Failed to clear backend data:', err));
      } else {
        // Same user or first login - just save normally
        if (userEmail) {
          localStorage.setItem('currentUserEmail', userEmail);
        }
        localStorage.setItem('gmailToken', token);
      }
      
      setHasToken(true);
      shouldAutoFetch = true; // Auto-fetch when token is present in URL
      
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      const stored = localStorage.getItem('gmailToken');
      setHasToken(!!stored);
    }

    // Load cached map or fallback array (only if not a new user)
    try {
      const root = readCacheRoot();
      let list = [];
      if (root && root.classifiedEmailsMap && typeof root.classifiedEmailsMap === 'object') {
        list = Object.values(root.classifiedEmailsMap);
      } else {
        // Legacy keys migration
        const legacyMapRaw = localStorage.getItem('classifiedEmailsMap');
        const legacyArrRaw = localStorage.getItem('classifiedEmails');
        if (legacyMapRaw) {
          const mapObj = JSON.parse(legacyMapRaw) || {};
          writeCacheRoot({ classifiedEmailsMap: mapObj });
          list = Object.values(mapObj);
        } else if (legacyArrRaw) {
          const arr = JSON.parse(legacyArrRaw) || [];
          const mapped = {};
          (Array.isArray(arr) ? arr : []).forEach(it => { if (it && it.id) mapped[it.id] = it; });
          writeCacheRoot({ classifiedEmailsMap: mapped });
          list = Object.values(mapped);
        }
      }
      setEmails(Array.isArray(list) ? list : []);
    } catch {}

    // Auto-run a fetch+classify on login (when token present in URL or loginSuccess flag)
    if (loginSuccess || shouldAutoFetch) {
      console.log('🚀 Auto-fetching emails on login (global runner)...');
      // Kick off global runner so it persists across routes
      setTimeout(() => classifierRunner.startIfNeeded(), 500);
    }
  }, []);

  // Subscribe to global classifier runner to reflect progress and update emails from cache
  useEffect(() => {
    const unsubscribe = classifierRunner.subscribe((s) => {
      setShowLoadingModal(!!s.initialBusy);
      setProgress(s.initialProgress || { done: 0, total: 0, etaMs: 0 });
      setBgBusy(!!s.bgBusy);
      setSessionAdded(Number(s.sessionAdded || 0));
      setRunnerTarget(Number(s.target || 100));
      // refresh emails from cache to reflect newly classified items
      try {
        const root = readCacheRoot();
        if (root && root.classifiedEmailsMap && typeof root.classifiedEmailsMap === 'object') {
          setEmails(Object.values(root.classifiedEmailsMap));
        }
      } catch {}
    });
    return unsubscribe;
  }, []);

  // Apply a list of processed emails to local cache and UI, incrementally
  async function applyProcessed(processed, perItemDelay = 40, updateModalProgress = null) {
    if (!Array.isArray(processed) || processed.length === 0) return 0;
    let root = readCacheRoot() || { classifiedEmailsMap: {} };
    let mapObj = (root && root.classifiedEmailsMap) || {};
    if (!mapObj || typeof mapObj !== 'object') mapObj = {};

    let added = 0;
    let done = 0;
    const total = processed.length;
    let avgMs = 70;
    for (const item of processed) {
      const st = Date.now();
      if (item && item.id) {
        const prev = mapObj[item.id] || {};
        const receivedAt = prev.receivedAt
          || item.receivedAt
          || item.timestamp
          || item.internalDate
          || item.date
          || Date.now();
        const existed = !!mapObj[item.id];
        mapObj[item.id] = { ...prev, ...item, receivedAt };
        if (!existed) added += 1;
      }
      root = { classifiedEmailsMap: mapObj };
      writeCacheRoot(root);
      localStorage.setItem('classifiedEmailsMap', JSON.stringify(mapObj));
      setEmails(Object.values(mapObj));

      done += 1;
      if (typeof updateModalProgress === 'function') {
        const stepMs = Date.now() - st;
        avgMs = Math.round((avgMs * (done - 1) + stepMs) / done);
        const remaining = total - done;
        updateModalProgress(done, total, remaining * Math.max(avgMs, 50));
      }
      // eslint-disable-next-line no-await-in-loop
      if (perItemDelay > 0) await new Promise((r) => setTimeout(r, perItemDelay));
    }
    return added;
  }

  async function processBatch(maxResults, perItemDelay, showModalDuring) {
    const resp = await fetchAndClassify({ max_results: maxResults });
    const processed = Array.isArray(resp?.processed) ? resp.processed : [];
    const total = processed.length || (resp?.new_count ?? 0);

    if (showModalDuring) {
      setProgress({ done: 0, total, etaMs: total * 100 });
    }

    const added = await applyProcessed(
      processed,
      perItemDelay,
      showModalDuring
        ? (done, totalNow, eta) => setProgress({ done, total: totalNow, etaMs: eta })
        : null
    );
    setSessionAdded(prev => prev + added);
    if (showModalDuring) {
      setProgress({ done: total, total, etaMs: 0 });
    }
    return added;
  }

  async function handleFetchAndClassify() {
    setError(null);
    setSessionAdded(0);
    // Check for token in localStorage (more reliable than state)
    const token = localStorage.getItem('gmailToken');
    if (!token) {
      setError('Connect Gmail to fetch emails.');
      return;
    }
    try {
      // Phase 1: initial 15 with modal (blocking) so user sees immediate results
      setBusy(true);
      setShowLoadingModal(true);
      await processBatch(15, 40, true);
      setShowLoadingModal(false);
    } catch (e) {
      setError(e?.message || 'Failed to fetch and classify');
      setShowLoadingModal(false);
      setBusy(false);
      return;
    }

    // Phase 2: background loading up to BG_TARGET
    setBusy(false); // allow UI interactions
    setBgBusy(true);
    try {
      // Keep fetching in chunks until we reach BG_TARGET or no more new emails
      // Use slightly larger chunks for efficiency
      while (sessionAdded < BG_TARGET) {
        // Fetch in small, user-friendly chunks of 10 for smoother UI updates
        const remaining = Math.max(1, BG_TARGET - sessionAdded);
        const batchSize = Math.min(remaining, 10);
        const added = await processBatch(batchSize, 25, false);
        if (!added) break; // no more new emails
        // small yield to keep UI responsive
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 150));
      }
    } catch (e) {
      // Swallow background errors into a soft message
      console.warn('Background classification error:', e);
    } finally {
      setBgBusy(false);
    }
  }

  const categories = useMemo(() => {
    const set = new Set(['All']);
    emails.forEach(e => (e.categories || []).forEach(c => set.add(c)));
    return Array.from(set).sort((a, b) => (a === 'All' ? -1 : a.localeCompare(b)));
  }, [emails]);

  const filtered = useMemo(() => {
    if (selected === 'All') return emails;
    return emails.filter(e => (e.categories || []).includes(selected));
  }, [emails, selected]);

  // Get category counts
  const categoryStats = useMemo(() => {
    const stats = {};
    categories.forEach(cat => {
      if (cat === 'All') {
        stats[cat] = emails.length;
      } else {
        stats[cat] = emails.filter(e => (e.categories || []).includes(cat)).length;
      }
    });
    return stats;
  }, [categories, emails]);

  // Get top senders
  const topSenders = useMemo(() => {
    const senderMap = {};
    emails.forEach(e => {
      const sender = e.sender || 'Unknown';
      senderMap[sender] = (senderMap[sender] || 0) + 1;
    });
    return Object.entries(senderMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [emails]);

  // Category icons mapping
  const categoryIcon = (cat) => {
    const icons = {
      'All': '📬',
      'Work': '💼',
      'Personal': '👤',
      'Promotions': '🎯',
      'Updates': '🔔',
      'Social': '👥',
      'General': '📧',
      'Information': 'ℹ️',
    };
    return icons[cat] || '📁';
  };

  return (
    <div className="space-y-6 px-2 sm:px-4 md:px-6 lg:px-8 py-6">
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 min-w-0"
        >
          <div className="flex items-center gap-3 mb-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0"
            >
              <HiViewGrid className="text-white text-lg sm:text-xl" />
            </motion.div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black">
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Dashboard
              </span>
            </h1>
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-sm sm:text-base text-gray-500 ml-1 flex items-center gap-2"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Manage and classify your emails
          </motion.p>
        </motion.div>
        
        <div className="flex items-center gap-3 flex-shrink-0">
          {!hasToken && <GoogleLoginButton />}
          {hasToken && (
            (() => {
              const fetchDisabled = !!showLoadingModal || !!bgBusy;
              const label = fetchDisabled
                ? (bgBusy
                    ? `Classifying… ${Math.min(sessionAdded, runnerTarget)} / ${runnerTarget}`
                    : 'Classifying…')
                : 'Fetch & Classify Gmail';
              return (
                <motion.button
                  onClick={() => classifierRunner.startIfNeeded()}
                  disabled={fetchDisabled}
                  initial={false}
                  animate={{
                    opacity: fetchDisabled ? 0.6 : 1,
                    filter: fetchDisabled ? 'grayscale(15%)' : 'none'
                  }}
                  whileHover={!fetchDisabled ? { scale: 1.02 } : {}}
                  whileTap={!fetchDisabled ? { scale: 0.98 } : {}}
                  transition={{ duration: 0.25 }}
                  className={`btn-primary text-sm sm:text-base whitespace-nowrap ${fetchDisabled ? 'cursor-not-allowed' : ''}`}
                >
                  {label}
                </motion.button>
              );
            })()
          )}
        </div>
      </div>

      {/* Dashboard-only notification badge */}
      <AnimatePresence>
        {sessionAdded < runnerTarget && (bgBusy || showLoadingModal) && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium"
          >
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            Classifying… {Math.min(sessionAdded, runnerTarget)} / {runnerTarget}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Bar */}
      {busy && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Classifying {progress.done}/{progress.total}
            </span>
            {progress.total > 0 && (
              <span className="text-xs text-gray-500">
                ~{Math.ceil(progress.etaMs/1000)}s remaining
              </span>
            )}
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-indigo-600 to-purple-600"
              initial={{ width: '0%' }}
              animate={{ 
                width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` 
              }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-4 border-l-4 border-red-500 bg-red-50"
        >
          <p className="text-red-700">{String(error)}</p>
        </motion.div>
      )}

      {/* Category Selection - Responsive */}
      <div>
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Categories</h2>
        
        {/* Mobile Category Button */}
        <div className="lg:hidden">
          <motion.button
            onClick={() => setCategoryModalOpen(true)}
            whileTap={{ scale: 0.98 }}
            className="w-full glass-card p-4 text-left transition-all hover:shadow-md flex items-center justify-between"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-xl flex-shrink-0">
                {categoryIcon(selected)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-500 mb-0.5">Selected Category</p>
                <p className="text-base font-semibold text-gray-900 truncate">{selected}</p>
                <p className="text-xs text-gray-500">{categoryStats[selected] || 0} emails</p>
              </div>
            </div>
            <HiChevronDown className="text-gray-400 text-xl flex-shrink-0 ml-2" />
          </motion.button>
        </div>

        {/* Desktop Grid */}
        <div className="hidden lg:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-1 sm:p-2">
          {categories.map((cat, index) => (
            <motion.button
              key={cat}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelected(cat)}
              className={`glass-card p-4 text-left transition-all ${
                selected === cat
                  ? 'ring-2 ring-indigo-600 bg-gradient-to-br from-indigo-50 to-purple-50'
                  : 'hover:shadow-soft-lg'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-xl">
                  {categoryIcon(cat)}
                </div>
                {selected === cat && (
                  <div className="w-2 h-2 rounded-full bg-indigo-600" />
                )}
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">{cat}</h3>
              <p className="text-2xl font-bold text-gray-900">
                {categoryStats[cat] || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {categoryStats[cat] === 1 ? 'email' : 'emails'}
              </p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Main Content Grid: Emails + Sidebar - Responsive */}
      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 min-w-0 overflow-x-hidden w-full max-w-full">
        {/* Emails List */}
        <div className="lg:col-span-2 space-y-4 min-w-0 overflow-x-hidden w-full max-w-full">
          <div className="flex items-center justify-between min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
              {selected === 'All' ? 'All Emails' : selected}
              <span className="text-gray-500 text-sm sm:text-base ml-2">({filtered.length})</span>
            </h2>
          </div>

          <AnimatePresence mode="wait">
            {filtered.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="glass-card p-12 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <HiMail className="text-3xl text-gray-400" />
                </div>
                <p className="text-gray-600">No emails in this category</p>
              </motion.div>
            ) : (
              <motion.div
                key={selected}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4 w-full max-w-full min-w-0 overflow-x-hidden"
              >
                <AnimatePresence initial={false}>
                  {filtered.map((e, i) => (
                    <motion.div
                      key={e.id || i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
                      transition={{ duration: 0.2 }}
                      className="w-full max-w-full min-w-0"
                    >
                      <EmailCard email={e} hideCategories={true} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Sidebar - Responsive */}
        <div className="space-y-4">
          {/* Top Senders */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="glass-card p-4 sm:p-5"
          >
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
              <HiUserCircle className="text-lg sm:text-xl text-indigo-600" />
              Top Senders
            </h3>
            <div className="space-y-2 sm:space-y-3">
              {topSenders.map(([sender, count], idx) => (
                <div key={sender} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-semibold">
                        {sender.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs sm:text-sm text-gray-700 truncate">{sender}</span>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-gray-900 ml-2">{count}</span>
                </div>
              ))}
              {topSenders.length === 0 && (
                <p className="text-xs sm:text-sm text-gray-500 text-center py-4">No senders yet</p>
              )}
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="glass-card p-4 sm:p-5"
          >
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
              <HiFolder className="text-lg sm:text-xl text-purple-600" />
              Recent Activity
            </h3>
            <div className="space-y-2 text-xs sm:text-sm text-gray-600">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span>Emails classified</span>
                <span className="font-semibold text-gray-900">{emails.length}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span>Categories</span>
                <span className="font-semibold text-gray-900">{categories.length - 1}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span>Active category</span>
                <span className="font-semibold text-indigo-600 truncate ml-2">{selected}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Floating background progress panel (non-blocking) - Responsive */}
      <AnimatePresence>
        {bgBusy && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] sm:w-[320px] max-w-[320px] glass-card shadow-2xl border border-indigo-100"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                    <HiMail className="text-white text-lg" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">Classifying emails…</span>
                </div>
                <motion.span
                  key={sessionAdded}
                  initial={{ scale: 0.9, opacity: 0.8 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm font-semibold text-indigo-700"
                >
                  {sessionAdded}/{BG_TARGET}
                </motion.span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600"
                  initial={{ width: '0%' }}
                  animate={{ width: `${Math.min(100, Math.round((sessionAdded / BG_TARGET) * 100))}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">Newly classified emails will appear in real time.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Modal Popup */}
      <AnimatePresence>
        {showLoadingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <HiMail className="text-3xl text-indigo-600" />
                  </motion.div>
                </div>
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold text-center text-gray-900 mb-2">
                {progress.done === progress.total && progress.total > 0
                  ? '✓ Classification Complete!'
                  : 'Classifying Your Emails'}
              </h3>
              
              {/* Description */}
              <p className="text-center text-gray-500 mb-6">
                {progress.done === progress.total && progress.total > 0
                  ? `Successfully classified ${progress.total} email${progress.total !== 1 ? 's' : ''}`
                  : 'Please wait while we fetch and classify your emails...'}
              </p>

              {/* Progress */}
              <div className="space-y-3">
                {/* Progress text */}
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">
                    {progress.done} / {progress.total} emails
                  </span>
                  {progress.total > 0 && progress.done < progress.total && (
                    <span className="text-gray-500">
                      ~{Math.ceil(progress.etaMs/1000)}s remaining
                    </span>
                  )}
                  {progress.done === progress.total && progress.total > 0 && (
                    <span className="text-green-600 font-semibold">Done!</span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600"
                    initial={{ width: '0%' }}
                    animate={{ 
                      width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` 
                    }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                </div>

                {/* Percentage */}
                <div className="text-center">
                  <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    {progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%
                  </span>
                </div>
              </div>

              {/* Decorative dots */}
              {progress.done < progress.total && (
                <div className="flex justify-center gap-2 mt-6">
                  <motion.div
                    className="w-2 h-2 rounded-full bg-indigo-600"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                  />
                  <motion.div
                    className="w-2 h-2 rounded-full bg-purple-600"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                  />
                  <motion.div
                    className="w-2 h-2 rounded-full bg-pink-600"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                  />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Selection Modal - Mobile Only */}
      <AnimatePresence>
        {categoryModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCategoryModalOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 lg:hidden"
            />

            {/* Modal - Mobile bottom sheet */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="fixed inset-x-0 bottom-0 z-50 lg:hidden px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
            >
              <div className="bg-white rounded-t-2xl shadow-2xl overflow-hidden">
                <div className="flex flex-col max-h-[90vh]">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-5 shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                          <HiFolder className="text-white text-xl" />
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-lg">Select Category</h3>
                          <p className="text-white/80 text-xs">Choose a category to view emails</p>
                        </div>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setCategoryModalOpen(false)}
                        className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-white/30 transition-colors"
                      >
                        <HiX className="text-white text-xl" />
                      </motion.button>
                    </div>
                  </div>

                  {/* Category List (rows, no boxes) */}
                  <div className="p-2 overflow-y-auto flex-1">
                    <div className="divide-y divide-gray-200">
                    {categories.map((cat, index) => {
                      const isSelected = selected === cat;
                      return (
                        <motion.button
                          key={cat}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setSelected(cat);
                            setCategoryModalOpen(false);
                          }}
                          className={`w-full text-left flex items-center gap-3 p-3 sm:p-4 focus:outline-none transition-colors ${
                            isSelected ? 'bg-gradient-to-r from-indigo-50 to-purple-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-lg flex-shrink-0">
                            {categoryIcon(cat)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`font-semibold text-sm truncate ${isSelected ? 'text-indigo-700' : 'text-gray-900'}`}>{cat}</div>
                            <div className="text-xs text-gray-500">{categoryStats[cat] || 0} {categoryStats[cat] === 1 ? 'email' : 'emails'}</div>
                          </div>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-indigo-600 flex-shrink-0" />}
                        </motion.button>
                      );
                    })}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-4 bg-gray-50 border-t border-gray-200 shrink-0">
                    <button
                      onClick={() => setCategoryModalOpen(false)}
                      className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
