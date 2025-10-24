import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiX, HiMail, HiCalendar, HiChevronLeft, HiChevronRight, HiArrowLeft } from 'react-icons/hi';
import EmailCard from '../components/EmailCard';

function toKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateDisplay(dateKey) {
  const [year, month, day] = dateKey.split('-');
  const date = new Date(year, parseInt(month) - 1, day);
  const monthName = date.toLocaleDateString('en-US', { month: 'short' });
  return `${monthName} ${parseInt(day)}, ${year}`;
}

export default function CalendarPage(){
  const [emails, setEmails] = useState([]);
  const [selectedDateKey, setSelectedDateKey] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [currentPage, setCurrentPage] = useState(0); // Track which page of dates we're viewing
  const [datesPerPage, setDatesPerPage] = useState(10); // Dynamic based on screen width
  const [pageTransition, setPageTransition] = useState(false); // For smooth page transitions

  // Update dates per page based on screen width
  useEffect(() => {
    const updateDatesPerPage = () => {
      const width = window.innerWidth;
      if (width >= 1536) {
        setDatesPerPage(12); // 2xl screens
      } else if (width >= 1280) {
        setDatesPerPage(10); // xl screens
      } else if (width >= 1024) {
        setDatesPerPage(8); // lg screens
      } else if (width >= 768) {
        setDatesPerPage(6); // md screens (tablets)
      } else if (width >= 640) {
        setDatesPerPage(5); // sm screens
      } else {
        setDatesPerPage(4); // mobile
      }
    };

    updateDatesPerPage();
    window.addEventListener('resize', updateDatesPerPage);
    return () => window.removeEventListener('resize', updateDatesPerPage);
  }, []);

  useEffect(() => {
    try {
      // Read from appCache (used by Dashboard) first, then fallback to legacy keys
      let allEmails = [];
      
      const cacheRaw = localStorage.getItem('appCache');
      if (cacheRaw) {
        const cache = JSON.parse(cacheRaw);
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
      
      // Ensure each email has a date; default to today
      const todayKey = toKey(new Date());
      const withDates = allEmails.map(e => ({
        ...e,
        date: e.date || todayKey,
      }));
      setEmails(withDates);

      // Auto-select today's date if emails exist for today, otherwise select the most recent date
      if (withDates.length > 0) {
        const todayKey = toKey(new Date());
        const sortedDates = Object.keys(withDates.reduce((acc, e) => {
          const key = toKey(e.date);
          acc[key] = true;
          return acc;
        }, {})).sort((a, b) => new Date(a) - new Date(b)); // Ascending order
        
        const todayEmails = withDates.filter(e => toKey(e.date) === todayKey);
        const initialDate = todayEmails.length > 0 ? todayKey : sortedDates[sortedDates.length - 1]; // Last date (most recent)
        
        setSelectedDateKey(initialDate);
        sessionStorage.setItem('calendarSelectedDate', initialDate);
      }
    } catch (e) {
      console.error('Error loading emails for calendar:', e);
      setEmails([]);
    }
  }, []);

  // Group emails by date
  const byDate = useMemo(() => {
    const map = {};
    for (const e of emails) {
      const key = toKey(e.date);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return map;
  }, [emails]);

  // Get sorted list of available dates (ascending order - oldest to newest)
  const availableDates = useMemo(() => {
    return Object.keys(byDate).sort((a, b) => new Date(a) - new Date(b));
  }, [byDate]);

  // Calculate visible dates based on current page
  const visibleDates = useMemo(() => {
    const start = currentPage * datesPerPage;
    const end = start + datesPerPage;
    return availableDates.slice(start, end);
  }, [availableDates, currentPage]);

  // Calculate if we can navigate forward/backward
  const canGoBackward = currentPage > 0; // Can go to earlier pages (older dates)
  const canGoForward = (currentPage + 1) * datesPerPage < availableDates.length; // Can go to later pages (newer dates)

  // Get categories for selected date
  const categoriesForDate = useMemo(() => {
    if (!selectedDateKey || !byDate[selectedDateKey]) return [];
    const emailsForDate = byDate[selectedDateKey];
    const catSet = new Set();
    emailsForDate.forEach(e => {
      (e.categories || ['Uncategorized']).forEach(c => catSet.add(c));
    });
    return Array.from(catSet).sort();
  }, [selectedDateKey, byDate]);

  // Get emails for selected date and category
  const filteredEmails = useMemo(() => {
    if (!selectedDateKey || !selectedCategory) return [];
    const emailsForDate = byDate[selectedDateKey] || [];
    return emailsForDate.filter(e => 
      (e.categories || ['Uncategorized']).includes(selectedCategory)
    );
  }, [selectedDateKey, selectedCategory, byDate]);

  // Navigation handlers - scroll through date pages with smooth transitions
  const goToNextPage = () => {
    if (canGoForward) {
      setPageTransition(true);
      setTimeout(() => {
        setCurrentPage(prev => prev + 1); // Move forward to newer dates
        setPageTransition(false);
      }, 150);
    }
  };

  const goToPrevPage = () => {
    if (canGoBackward) {
      setPageTransition(true);
      setTimeout(() => {
        setCurrentPage(prev => prev - 1); // Move backward to older dates
        setPageTransition(false);
      }, 150);
    }
  };

  const selectDate = (dateKey) => {
    setSelectedDateKey(dateKey);
    setSelectedCategory(null);
    sessionStorage.setItem('calendarSelectedDate', dateKey);
  };

  // Auto-scroll to page containing selected date
  useEffect(() => {
    if (selectedDateKey && availableDates.length > 0) {
      const selectedIndex = availableDates.indexOf(selectedDateKey);
      if (selectedIndex !== -1) {
        const targetPage = Math.floor(selectedIndex / datesPerPage);
        setCurrentPage(targetPage);
      }
    }
  }, [selectedDateKey, availableDates, datesPerPage]);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'ArrowLeft') {
        goToPrevPage();
      } else if (e.key === 'ArrowRight') {
        goToNextPage();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [canGoForward, canGoBackward]); // eslint-disable-line react-hooks/exhaustive-deps

  const categoryIcons = {
    'Work': '💼',
    'Personal': '👤',
    'Promotions': '🎯',
    'Updates': '🔔',
    'Social': '👥',
    'General': '📧',
    'Information': 'ℹ️',
    'Uncategorized': '📁'
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 min-w-0 overflow-x-hidden">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg flex-shrink-0"
          >
            <HiCalendar className="text-white text-lg sm:text-xl" />
          </motion.div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black truncate">
            <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 bg-clip-text text-transparent">
              Calendar View
            </span>
          </h1>
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-sm sm:text-base text-gray-500 ml-1 flex items-center gap-2"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
          <span className="truncate">Browse emails by date</span>
        </motion.p>
      </motion.div>

      {availableDates.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-8 sm:p-12 text-center"
        >
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <HiCalendar className="text-2xl sm:text-3xl text-gray-400" />
          </div>
          <p className="text-gray-600 text-base sm:text-lg font-medium">No emails found</p>
          <p className="text-gray-400 mt-2 text-xs sm:text-sm">Fetch emails from the Dashboard to see them here</p>
        </motion.div>
      ) : (
        <>
          {/* Horizontal Date Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-3 sm:p-4 lg:p-6 w-full max-w-full"
          >
            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 min-w-0">
              {/* Left Arrow - Go to Previous (Older) Dates */}
              <motion.button
                onClick={goToPrevPage}
                disabled={!canGoBackward}
                whileHover={canGoBackward ? { scale: 1.1 } : {}}
                whileTap={canGoBackward ? { scale: 0.95 } : {}}
                className={`w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-lg flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                  !canGoBackward
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : 'bg-gradient-to-br from-purple-100 to-pink-100 text-purple-600 hover:shadow-lg hover:from-purple-200 hover:to-pink-200'
                }`}
                title="Previous dates (←)"
              >
                <HiChevronLeft className="text-lg sm:text-xl lg:text-2xl" />
              </motion.button>

              {/* Date Numbers - Responsive Grid */}
              <div className="flex-1 overflow-visible px-1 min-w-0">
                <motion.div 
                  key={currentPage}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: pageTransition ? 0.5 : 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-2 sm:gap-3 lg:gap-4 py-1 sm:py-2"
                >
                  {visibleDates.map((dateKey, index) => {
                    const [year, month, day] = dateKey.split('-');
                    const isSelected = dateKey === selectedDateKey;
                    const emailCount = (byDate[dateKey] || []).length;
                    const hasEmails = emailCount > 0;
                    
                    return (
                      <motion.button
                        key={dateKey}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.03 }}
                        onClick={() => hasEmails && selectDate(dateKey)}
                        disabled={!hasEmails}
                        whileHover={hasEmails ? { scale: 1.08, y: -2 } : {}}
                        whileTap={hasEmails ? { scale: 0.95 } : {}}
                        className={`relative flex flex-col items-center justify-center w-full aspect-square rounded-xl transition-all duration-300 ${
                          !hasEmails
                            ? 'bg-gray-50 text-gray-300 cursor-not-allowed opacity-40 border-2 border-gray-100'
                            : isSelected
                            ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-xl scale-105 ring-2 sm:ring-4 ring-purple-200'
                            : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-purple-400 hover:shadow-lg cursor-pointer'
                        }`}
                      >
                        <span className={`text-base sm:text-xl lg:text-2xl font-bold ${
                          !hasEmails ? 'text-gray-300' : isSelected ? 'text-white' : 'text-gray-900'
                        }`}>
                          {parseInt(day)}
                        </span>
                        <span className={`text-[10px] sm:text-xs mt-0.5 ${
                          !hasEmails ? 'text-gray-300' : isSelected ? 'text-purple-100' : 'text-gray-500'
                        }`}>
                          {new Date(year, parseInt(month) - 1, day).toLocaleDateString('en-US', { month: 'short' })}
                        </span>
                        {/* Email count badge - only show if has emails */}
                        {hasEmails && (
                          <div className={`absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[9px] sm:text-xs font-bold shadow-sm ${
                            isSelected ? 'bg-white text-purple-600' : 'bg-purple-600 text-white'
                          }`}>
                            {emailCount}
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </motion.div>
              </div>

              {/* Right Arrow - Go to Next (Newer) Dates */}
              <motion.button
                onClick={goToNextPage}
                disabled={!canGoForward}
                whileHover={canGoForward ? { scale: 1.1 } : {}}
                whileTap={canGoForward ? { scale: 0.95 } : {}}
                className={`w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-lg flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                  !canGoForward
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : 'bg-gradient-to-br from-purple-100 to-pink-100 text-purple-600 hover:shadow-lg hover:from-purple-200 hover:to-pink-200'
                }`}
                title="Next dates (→)"
              >
                <HiChevronRight className="text-lg sm:text-xl lg:text-2xl" />
              </motion.button>
            </div>

            {/* Date Range Indicator */}
            {visibleDates.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200 text-center"
              >
                <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Showing Dates</p>
                <p className="text-xs sm:text-sm font-semibold text-gray-600 mt-1">
                  {formatDateDisplay(visibleDates[0])} - {formatDateDisplay(visibleDates[visibleDates.length - 1])}
                </p>
              </motion.div>
            )}

            {/* Selected Date Display */}
            {selectedDateKey && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 pt-2 sm:pt-3 border-t border-gray-200 text-center"
              >
                <p className="text-xs sm:text-sm text-gray-500">Selected Date</p>
                <p className="text-base sm:text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {formatDateDisplay(selectedDateKey)}
                </p>
              </motion.div>
            )}
          </motion.div>

          {/* Categories Box */}
          {selectedDateKey && categoriesForDate.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-3 sm:p-4 lg:p-6 w-full max-w-full"
            >
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-600 flex-shrink-0" />
                <span className="truncate">Categories ({categoriesForDate.length})</span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 p-1 min-w-0">
                {categoriesForDate.map((category, index) => {
                  const isSelected = category === selectedCategory;
                  const emailCount = (byDate[selectedDateKey] || []).filter(e =>
                    (e.categories || ['Uncategorized']).includes(category)
                  ).length;

                  return (
                    <motion.button
                      key={category}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedCategory(category)}
                      className={`p-3 sm:p-4 rounded-xl transition-all duration-300 text-left min-w-0 ${
                        isSelected
                          ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-lg ring-2 ring-purple-300'
                          : 'bg-white hover:bg-purple-50 border-2 border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1 sm:mb-2">
                        <span className="text-xl sm:text-2xl flex-shrink-0">{categoryIcons[category] || '📧'}</span>
                        <span className={`text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {emailCount}
                        </span>
                      </div>
                      <p className={`font-semibold text-xs sm:text-sm truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                        {category}
                      </p>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Email List */}
          <AnimatePresence mode="wait">
            {selectedCategory && filteredEmails.length > 0 && (
              <motion.div
                key={selectedCategory}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="glass-card p-3 sm:p-4 lg:p-6 w-full max-w-full"
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2 min-w-0">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2 min-w-0 truncate">
                    <span className="text-xl sm:text-2xl flex-shrink-0">{categoryIcons[selectedCategory] || '📧'}</span>
                    <span className="truncate">{selectedCategory} Emails ({filteredEmails.length})</span>
                  </h2>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="text-xs sm:text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 flex-shrink-0"
                  >
                    <HiArrowLeft className="text-xs sm:text-sm" />
                    <span className="hidden sm:inline">Back to Categories</span>
                    <span className="sm:hidden">Back</span>
                  </button>
                </div>
                
                <div className="space-y-3 sm:space-y-4 max-h-[500px] sm:max-h-[600px] overflow-y-auto pr-1 sm:pr-2 pl-1 sm:pl-2 py-1 sm:py-2 w-full max-w-full overflow-x-hidden">
                  {filteredEmails.map((email, index) => (
                    <motion.div
                      key={email.id || index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <EmailCard email={email} hideCategories={true} />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* CSS for hiding scrollbar */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
