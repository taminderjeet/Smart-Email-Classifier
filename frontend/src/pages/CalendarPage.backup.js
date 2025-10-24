import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiX, HiMail, HiCalendar } from 'react-icons/hi';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

function toKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CalendarPage(){
  const [emails, setEmails] = useState([]);
  const [value, setValue] = useState(new Date());
  const [openKey, setOpenKey] = useState(null);

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
    } catch (e) {
      console.error('Error loading emails for calendar:', e);
      setEmails([]);
    }
  }, []);

  const byDate = useMemo(() => {
    const map = {};
    for (const e of emails) {
      const key = typeof e.date === 'string' ? e.date : toKey(e.date || new Date());
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return map;
  }, [emails]);

  const selectedList = openKey ? (byDate[openKey] || []) : [];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg"
          >
            <HiCalendar className="text-white text-xl" />
          </motion.div>
          <h1 className="text-4xl font-black">
            <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 bg-clip-text text-transparent">
              Calendar View
            </span>
          </h1>
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-gray-500 ml-1 flex items-center gap-2"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          Click any date to see emails
        </motion.p>
      </motion.div>

      {/* Calendar */}
      <div className="glass-card p-6 inline-block">
        <Calendar
          onChange={setValue}
          value={value}
          onClickDay={(date) => setOpenKey(toKey(date))}
          className="border-0"
          tileContent={({ date, view }) => {
            if (view !== 'month') return null;
            const key = toKey(date);
            const count = (byDate[key] || []).length;
            const isToday = toKey(new Date()) === key;
            return count > 0 ? (
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-white transition-all ${
                  isToday
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-glow-purple'
                    : 'bg-indigo-600'
                }`}>
                  {count}
                </span>
              </div>
            ) : null;
          }}
        />
      </div>

      {/* Modal */}
      <AnimatePresence>
        {openKey && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpenKey(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="fixed inset-x-4 top-20 bottom-20 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-3xl glass-card z-50 overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Emails on {openKey}
                  </h2>
                  <p className="text-gray-500 mt-1">
                    {selectedList.length} {selectedList.length === 1 ? 'email' : 'emails'}
                  </p>
                </div>
                <button
                  onClick={() => setOpenKey(null)}
                  className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                >
                  <HiX className="text-xl text-gray-600" />
                </button>
              </div>

              {/* Email List */}
              <div className="flex-1 overflow-y-auto p-6">
                {selectedList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                      <HiMail className="text-3xl text-gray-400" />
                    </div>
                    <p className="text-gray-600">No emails on this date</p>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-3"
                  >
                    {selectedList.map((e, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                        className="email-card"
                      >
                        <h4 className="font-semibold text-gray-900 mb-2">{e.subject}</h4>
                        <p className="text-gray-600 text-sm mb-3">{e.body}</p>
                        <div className="flex gap-2 flex-wrap">
                          {(e.categories || []).map((c, idx) => (
                            <span key={idx} className="category-pill">
                              {c}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
