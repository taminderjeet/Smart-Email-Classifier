import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiMail, HiSearch, HiUserGroup, HiChevronDown, HiX } from 'react-icons/hi';
import EmailCard from '../components/EmailCard';

export default function SenderPage(){
  const [emails, setEmails] = useState([]);
  const [selected, setSelected] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [senderModalOpen, setSenderModalOpen] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

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
      
      // Ensure a sender field exists; default to 'Unknown'
      const withSender = allEmails.map(e => ({
        sender: e.sender || 'Unknown',
        ...e,
      }));
      setEmails(withSender);
    } catch (e) {
      console.error('Error loading emails for sender page:', e);
      setEmails([]);
    }
  }, []);

  const senders = useMemo(() => {
    const set = new Set(['All']);
    emails.forEach(e => set.add(e.sender || 'Unknown'));
    return Array.from(set).sort((a, b) => (a === 'All' ? -1 : a.localeCompare(b)));
  }, [emails]);

  const filteredSenders = useMemo(() => {
    if (!searchTerm) return senders;
    return senders.filter(s => 
      s.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [senders, searchTerm]);

  const filtered = useMemo(() => {
    if (selected === 'All') return emails;
    return emails.filter(e => (e.sender || 'Unknown') === selected);
  }, [emails, selected]);

  // Get sender stats
  const senderStats = useMemo(() => {
    const stats = {};
    emails.forEach(e => {
      const sender = e.sender || 'Unknown';
      stats[sender] = (stats[sender] || 0) + 1;
    });
    return stats;
  }, [emails]);

  return (
    <div className="space-y-6 px-2 sm:px-4 md:px-6 lg:px-8 py-6 min-w-0 overflow-x-hidden">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="min-w-0"
      >
        <div className="flex items-center gap-3 mb-2 min-w-0">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-600 flex items-center justify-center shadow-lg flex-shrink-0"
          >
            <HiUserGroup className="text-white text-lg sm:text-xl" />
          </motion.div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black truncate min-w-0 flex-1">
            <span className="bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent">
              Other Senders
            </span>
          </h1>
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-sm sm:text-base text-gray-500 ml-1 flex items-center gap-2 min-w-0"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
          <span className="truncate min-w-0 flex-1">Emails grouped by sender</span>
        </motion.p>
      </motion.div>

      {/* Search */}
      <div className="glass-card p-3 sm:p-4 w-full max-w-full relative z-30">
        <div className="relative w-full">
          <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg flex-shrink-0 pointer-events-none z-10" />
          <input
            type="text"
            placeholder="Search senders..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setShowSearchDropdown(true);
            }}
            onFocus={() => setShowSearchDropdown(true)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm sm:text-base"
          />
          
          {/* Clear button */}
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setShowSearchDropdown(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <HiX className="text-lg" />
            </button>
          )}

          {/* Search Results Dropdown */}
          <AnimatePresence>
            {showSearchDropdown && searchTerm && filteredSenders.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto z-50"
              >
                <div className="py-2">
                  {filteredSenders.map((sender, idx) => (
                    <button
                      key={sender}
                      onClick={() => {
                        setSelected(sender);
                        setSearchTerm('');
                        setShowSearchDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors flex items-center gap-3 ${
                        selected === sender ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-600 to-cyan-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-semibold">
                          {sender.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{sender}</div>
                        <div className="text-xs text-gray-500">
                          {sender === 'All' ? emails.length : (senderStats[sender] || 0)} emails
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4 sm:gap-6 min-w-0 overflow-x-hidden w-full max-w-full">
        {/* Mobile Sender Button */}
        <div className="lg:hidden w-full max-w-full min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Select Sender</h3>
          <motion.button
            onClick={() => setSenderModalOpen(true)}
            whileTap={{ scale: 0.98 }}
            className="w-full max-w-full glass-card p-3 sm:p-4 text-left transition-all hover:shadow-md flex items-center justify-between min-w-0 overflow-hidden"
          >
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 overflow-hidden">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-teal-600 to-cyan-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs sm:text-sm font-semibold">
                  {selected.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className="text-xs sm:text-sm text-gray-500 mb-0.5">Selected Sender</p>
                <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">{selected}</p>
                <p className="text-xs text-gray-500">
                  {selected === 'All' ? emails.length : (senderStats[selected] || 0)} emails
                </p>
              </div>
            </div>
            <HiChevronDown className="text-gray-400 text-lg sm:text-xl flex-shrink-0 ml-1 sm:ml-2" />
          </motion.button>
        </div>

        {/* Desktop Senders Sidebar */}
        <div className="hidden lg:block lg:col-span-1 space-y-2 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Senders ({filteredSenders.length})</h3>
          <div className="space-y-2 px-1">{/* Add horizontal breathing room so highlight rings aren't cropped */}
            {filteredSenders.map((s, index) => (
              <motion.button
                key={s}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.02 }}
                onClick={() => setSelected(s)}
                className={`w-full glass-card p-3.5 text-left transition-all flex items-center gap-3 min-w-0 ${
                  selected === s
                    ? 'ring-2 ring-indigo-600 ring-offset-2 ring-offset-white bg-gradient-to-r from-indigo-50 to-purple-50'
                    : 'hover:shadow-soft'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-semibold">
                    {s.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{s}</div>
                  <div className="text-xs text-gray-500">
                    {s === 'All' ? emails.length : (senderStats[s] || 0)} emails
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Emails List */}
        <div className="lg:col-span-3 space-y-4 min-w-0 overflow-x-hidden w-full max-w-full">
          <div className="min-w-0 overflow-hidden">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
              {selected === 'All' ? 'All Senders' : selected}
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
                className="glass-card p-8 sm:p-12 text-center"
              >
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <HiMail className="text-2xl sm:text-3xl text-gray-400" />
                </div>
                <p className="text-sm sm:text-base text-gray-600">No emails from this sender</p>
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
                {filtered.map((e, i) => (
                  <EmailCard key={i} email={e} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Sender Selection Modal - Mobile Only */}
      <AnimatePresence>
        {senderModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSenderModalOpen(false)}
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
                  <div className="bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 p-5 shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                          <HiUserGroup className="text-white text-xl" />
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-lg">Select Sender</h3>
                          <p className="text-white/80 text-xs">Choose a sender to view emails</p>
                        </div>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setSenderModalOpen(false)}
                        className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-white/30 transition-colors"
                      >
                        <HiX className="text-white text-xl" />
                      </motion.button>
                    </div>
                  </div>

                  {/* Sender List (rows, no boxes) */}
                  <div className="p-2 overflow-y-auto flex-1 min-w-0">
                    <div className="divide-y divide-gray-200">
                      {filteredSenders.map((sender, index) => {
                        const isSelected = selected === sender;
                        return (
                          <motion.button
                            key={sender}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setSelected(sender);
                              setSenderModalOpen(false);
                            }}
                            className={`w-full max-w-full text-left flex items-center gap-3 p-3 sm:p-4 focus:outline-none transition-colors min-w-0 overflow-hidden ${
                              isSelected ? 'bg-gradient-to-r from-teal-50 to-cyan-50' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-600 to-cyan-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-sm font-semibold">
                                {sender.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className={`font-semibold text-sm truncate ${isSelected ? 'text-teal-700' : 'text-gray-900'}`}>
                                {sender}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {sender === 'All' ? emails.length : (senderStats[sender] || 0)} {sender === 'All' ? emails.length === 1 ? 'email' : 'emails' : (senderStats[sender] || 0) === 1 ? 'email' : 'emails'}
                              </div>
                            </div>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-teal-600 flex-shrink-0" />}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-4 bg-gray-50 border-t border-gray-200 shrink-0">
                    <button
                      onClick={() => setSenderModalOpen(false)}
                      className="w-full py-3 px-4 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
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
