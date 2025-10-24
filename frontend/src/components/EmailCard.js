import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { HiMail, HiUser, HiClock, HiRefresh } from 'react-icons/hi';

export default function EmailCard(props) {
  const navigate = useNavigate();
  const [canHover, setCanHover] = useState(true);

  // Disable hover-scale on touch devices to avoid horizontal overflow/cropping
  useEffect(() => {
    try {
      const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
      const update = () => setCanHover(!!mq.matches);
      update();
      if (mq.addEventListener) mq.addEventListener('change', update);
      else if (mq.addListener) mq.addListener(update);
      return () => {
        if (mq.removeEventListener) mq.removeEventListener('change', update);
        else if (mq.removeListener) mq.removeListener(update);
      };
    } catch {
      // If matchMedia isn't available, default to enabling hover on desktop-like envs
      setCanHover(true);
    }
  }, []);
  // Backward compatible: allow either props.email or direct props
  const merged = { ...(props.email || {}), ...props };
  const {
    id,
    subject = '',
    body = '',
    categories = [],
    sender = '',
    date = '',
    hideCategories = false, // New prop to hide categories
  } = merged;

  // Get category icon
  const getCategoryIcon = (cat) => {
    const icons = {
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

  // Get category color
  const getCategoryColor = (cat) => {
    const colors = {
      'Work': 'from-blue-50 to-blue-100 text-blue-700 border-blue-200',
      'Personal': 'from-purple-50 to-purple-100 text-purple-700 border-purple-200',
      'Promotions': 'from-pink-50 to-pink-100 text-pink-700 border-pink-200',
      'Updates': 'from-indigo-50 to-indigo-100 text-indigo-700 border-indigo-200',
      'Social': 'from-green-50 to-green-100 text-green-700 border-green-200',
      'General': 'from-gray-50 to-gray-100 text-gray-700 border-gray-200',
      'Information': 'from-cyan-50 to-cyan-100 text-cyan-700 border-cyan-200',
    };
    return colors[cat] || 'from-gray-50 to-gray-100 text-gray-700 border-gray-200';
  };

  async function handleRetry() {
    try {
      const token = localStorage.getItem('gmailToken');
      if (!token || !id) return;
      const url = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/+$/, '') + `/reclassify/${encodeURIComponent(id)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) return;
      const item = await res.json();
      // Merge into localStorage map if present
      try {
        const map = JSON.parse(localStorage.getItem('classifiedEmailsMap') || '{}') || {};
        map[item.id] = item;
        localStorage.setItem('classifiedEmailsMap', JSON.stringify(map));
        // Also update root cache format if present
        const rootRaw = localStorage.getItem('appCache');
        if (rootRaw) {
          try {
            const root = JSON.parse(rootRaw) || {};
            if (typeof root === 'object') {
              root.classifiedEmailsMap = root.classifiedEmailsMap || {};
              root.classifiedEmailsMap[item.id] = item;
              localStorage.setItem('appCache', JSON.stringify(root));
            }
          } catch {}
        }
      } catch {}
      // Optional: simple UI refresh callback
      if (typeof props.onReclassified === 'function') props.onReclassified(item);
    } catch {}
  }

  function openDetail() {
    if (id) navigate(`/email/${encodeURIComponent(id)}`);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={canHover ? {
        boxShadow: '0 12px 24px -8px rgba(99, 102, 241, 0.25), 0 0 0 1px rgba(99, 102, 241, 0.1)'
      } : {}}
      className="relative w-full max-w-full bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg sm:rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 p-2 sm:p-2.5 md:p-4 group cursor-pointer overflow-hidden mx-0"
      onClick={openDetail}
      
    >
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/0 via-purple-50/0 to-pink-50/0 group-hover:from-indigo-50/30 group-hover:via-purple-50/20 group-hover:to-pink-50/30 transition-all duration-500 pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10">
        {/* Header Section - Responsive */}
        <div className="flex items-start gap-1.5 sm:gap-2 md:gap-3 mb-0">
          {/* Email Icon */}
          <div className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 md:w-9 md:h-9 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <HiMail className="text-indigo-600 text-[10px] sm:text-xs md:text-base" />
          </div>
          
          {/* Subject & Meta */}
          <div className="flex-1 min-w-0">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-900 leading-snug mb-0.5 group-hover:text-indigo-700 transition-colors line-clamp-1">
              {subject || 'No Subject'}
            </h3>
            
            {/* Sender & Date - Responsive */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 text-[10px] sm:text-xs text-gray-500">
              {sender && (
                <div className="flex items-center gap-1 truncate">
                  <HiUser className="text-gray-400 flex-shrink-0 text-[10px] sm:text-xs" />
                  <span className="font-medium truncate">{sender}</span>
                </div>
              )}
              {date && (
                <div className="flex items-center gap-1 truncate">
                  <HiClock className="text-gray-400 flex-shrink-0 text-[10px] sm:text-xs" />
                  <span className="truncate">{date}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Categories or Unclassified - Responsive */}
        {!hideCategories && (
          <div className="pl-7 sm:pl-9 md:pl-12 mt-1.5 sm:mt-2">
            {Array.isArray(categories) && categories.length > 0 ? (
              <div className="flex gap-1 sm:gap-1.5 flex-wrap">
                {categories.map((cat, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: i * 0.05 }}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-md text-xs font-medium bg-gradient-to-r border transition-all duration-300 hover:scale-105 ${getCategoryColor(cat)}`}
                  >
                    <span className="text-xs">{getCategoryIcon(cat)}</span>
                    <span className="text-xs">{cat}</span>
                  </motion.span>
                ))}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2">
                <span className="text-xs text-amber-700 font-medium">⚠️ Unclassified</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleRetry(); }}
                  className="flex items-center justify-center gap-1 text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg transition-all duration-300 font-medium"
                >
                  <HiRefresh className="text-sm" />
                  <span>Retry</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* View Button - appears on hover (hidden on touch devices) */}
      <motion.div 
        className="hidden sm:block absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <button 
          onClick={(e) => { e.stopPropagation(); openDetail(); }} 
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/90 backdrop-blur-md border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-300 shadow-sm hover:shadow-md font-medium text-sm"
        >
          <HiMail className="text-sm" />
          <span>View</span>
        </button>
      </motion.div>
    </motion.div>
  );
}
