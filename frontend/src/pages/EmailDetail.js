import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HiArrowLeft, HiMail, HiUser, HiCalendar, HiTag, HiExclamationCircle } from 'react-icons/hi';

// Read from localStorage caches
function readFromCacheById(id) {
  if (!id) return null;
  try {
    // Primary cache: appCache.classifiedEmailsMap
    const rootRaw = localStorage.getItem('appCache');
    if (rootRaw) {
      const root = JSON.parse(rootRaw) || {};
      if (root && root.classifiedEmailsMap && root.classifiedEmailsMap[id]) {
        return root.classifiedEmailsMap[id];
      }
    }
  } catch {}
  try {
    // Legacy map
    const legacyMapRaw = localStorage.getItem('classifiedEmailsMap');
    if (legacyMapRaw) {
      const map = JSON.parse(legacyMapRaw) || {};
      if (map && map[id]) return map[id];
    }
  } catch {}
  try {
    // Legacy array
    const legacyArrRaw = localStorage.getItem('classifiedEmails');
    if (legacyArrRaw) {
      const arr = JSON.parse(legacyArrRaw) || [];
      const it = (Array.isArray(arr) ? arr : []).find(e => e && (e.id === id));
      if (it) return it;
    }
  } catch {}
  return null;
}

// Format date for better readability
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

// Get category icon
function getCategoryIcon(cat) {
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
}

export default function EmailDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(true);

  // Convert HTML to plain text (remove tags + decode entities)
  function htmlToPlainText(html) {
    if (!html || typeof html !== 'string') return '';
    try {
      const div = document.createElement('div');
      div.innerHTML = html;
      let text = div.textContent || div.innerText || '';
      // Normalize non-breaking spaces and excessive whitespace/newlines
      text = text.replace(/\u00A0/g, ' ');
      text = text.replace(/[\t\x0B\f\r]+/g, ' ');
      // Collapse 3+ newlines to 2
      text = text.replace(/\n{3,}/g, '\n\n');
      // Trim lines
      text = text
        .split('\n')
        .map((l) => l.replace(/\s+$/g, ''))
        .join('\n')
        .trim();
      return text;
    } catch {
      return String(html);
    }
  }

  useEffect(() => {
    setLoading(true);
    const emailData = readFromCacheById(id);
    setEmail(emailData);
    // Small delay for smooth loading animation
    setTimeout(() => setLoading(false), 200);
  }, [id]);

  const header = useMemo(() => {
    if (!email) return { subject: '', sender: '', date: '' };
    return {
      subject: email.subject || 'No Subject',
      sender: email.sender || email.from || 'Unknown Sender',
      date: formatDate(email.date || email.dateHeader || ''),
    };
  }, [email]);

  // Prepare a plain text body by stripping HTML tags and decoding entities
  const plainBody = useMemo(() => {
    if (!email) return '';
    const raw = email.body || email.html || email.bodyHtml || email.snippet || '';
    return htmlToPlainText(raw);
  }, [email]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading email...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in px-4 sm:px-6 lg:px-8 py-6">
      {/* Header with Back Button */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-all hover:shadow-soft group"
        >
          <HiArrowLeft className="text-lg group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back</span>
        </button>
        
        {email && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700">
            <HiMail className="text-lg" />
            <span className="text-sm font-medium">Email Details</span>
          </div>
        )}
      </motion.div>

      <AnimatePresence mode="wait">
        {!email ? (
          <motion.div
            key="not-found"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="glass-card p-12 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center mx-auto mb-4">
              <HiExclamationCircle className="text-3xl text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Not Found</h2>
            <p className="text-gray-600 mb-6">We couldn't find this email in your local cache.</p>
            <button
              onClick={() => navigate(-1)}
              className="btn-primary"
            >
              Go Back
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="email-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Email Header Card */}
            <div className="glass-card p-6 space-y-4">
              {/* Subject */}
              <div>
                <h1 className="text-3xl font-bold text-gray-900 leading-tight break-words">
                  {header.subject}
                </h1>
              </div>

              {/* Meta Information */}
              <div className="space-y-3">
                {/* Sender */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                    <HiUser className="text-lg text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">From</p>
                    <p className="text-sm font-medium text-gray-900 break-words">{header.sender}</p>
                  </div>
                </div>

                {/* Date */}
                {header.date && (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center flex-shrink-0">
                      <HiCalendar className="text-lg text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Date</p>
                      <p className="text-sm font-medium text-gray-900">{header.date}</p>
                    </div>
                  </div>
                )}

                {/* Categories */}
                {Array.isArray(email.categories) && email.categories.length > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center flex-shrink-0">
                      <HiTag className="text-lg text-pink-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Categories</p>
                      <div className="flex gap-2 flex-wrap">
                        {email.categories.map((cat, i) => (
                          <motion.span
                            key={i}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2, delay: i * 0.05 }}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-100"
                          >
                            <span>{getCategoryIcon(cat)}</span>
                            <span>{cat}</span>
                          </motion.span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Email Body Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="glass-card p-6"
            >
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                  <HiMail className="text-white text-lg" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Email Content</h2>
              </div>
              
              <div className="prose prose-sm max-w-none text-gray-800">
                <div className="whitespace-pre-wrap break-words leading-relaxed text-base">
                  {plainBody ? (
                    plainBody
                  ) : (
                    <p className="text-gray-500 italic">No content available</p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="flex gap-3 justify-end"
            >
              <button
                onClick={() => navigate(-1)}
                className="px-6 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium transition-all hover:shadow-soft"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
