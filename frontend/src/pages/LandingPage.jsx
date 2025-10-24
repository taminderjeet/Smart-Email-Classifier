import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiLogIn, 
  FiCpu, 
  FiInbox, 
  FiClock, 
  FiCalendar, 
  FiBarChart2, 
  FiShield,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiMail
} from 'react-icons/fi';
import { HiMail } from 'react-icons/hi';
import { api, API_BASE } from '../services/api';

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  // Simple preview gallery state
  const [previewImages, setPreviewImages] = useState([]);
  const [currentPreview, setCurrentPreview] = useState(0);
  // Backend status banner state
  const [serverStatus, setServerStatus] = useState({
    state: 'checking', // 'checking' | 'warming' | 'ready' | 'error'
    startedAt: Date.now(),
    lastOkAt: null,
    error: null,
    tries: 0,
  });
  const [elapsed, setElapsed] = useState(0);

  // Proactively ping the backend /health so users see real-time status
  useEffect(() => {
    let mounted = true;
    const startedAt = Date.now();
    setServerStatus((s) => ({ ...s, startedAt }));

    const check = async () => {
      try {
        const res = await api.get('/health', { timeout: 15000 });
        if (!mounted) return;
        if (res?.data?.status === 'ok') {
          setServerStatus((s) => ({ ...s, state: 'ready', lastOkAt: Date.now(), error: null, tries: (s.tries || 0) + 1 }));
        } else {
          setServerStatus((s) => ({ ...s, state: 'warming', tries: (s.tries || 0) + 1 }));
        }
      } catch (e) {
        if (!mounted) return;
        setServerStatus((s) => ({ ...s, state: 'warming', error: e?.message || 'Network error', tries: (s.tries || 0) + 1 }));
      }
    };

    // First check immediately, then poll every 5s until ready
    check();
    const pollId = setInterval(() => {
      setServerStatus((s) => s.state === 'ready' ? s : s); // trigger capture
      check();
    }, 5000);

    // Elapsed seconds ticker
    const tickId = setInterval(() => {
      if (!mounted) return;
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(pollId);
      clearInterval(tickId);
    };
  }, []);

  const manualCheck = async () => {
    setServerStatus((s) => ({ ...s, state: 'checking' }));
    try {
      const res = await api.get('/health', { timeout: 15000 });
      if (res?.data?.status === 'ok') {
        setServerStatus((s) => ({ ...s, state: 'ready', lastOkAt: Date.now(), error: null, tries: (s.tries || 0) + 1 }));
      } else {
        setServerStatus((s) => ({ ...s, state: 'warming', tries: (s.tries || 0) + 1 }));
      }
    } catch (e) {
      setServerStatus((s) => ({ ...s, state: 'warming', error: e?.message || 'Network error', tries: (s.tries || 0) + 1 }));
    }
  };

  // Load preview images from /public/previews.
  // 1) Try /previews/manifest.json (an array of file paths)
  // 2) Fallback: probe common PNG names (preview1..10, screenshot1..10, 1..10)
  useEffect(() => {
    let mounted = true;

    const tryLoadImg = (src) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(src);
      img.onerror = () => resolve(null);
      img.src = src + (src.includes('?') ? '' : '');
    });

    const loadFromManifest = async () => {
      try {
        const res = await fetch('/previews/manifest.json', { cache: 'no-store' });
        if (!res.ok) return null;
        const list = await res.json();
        if (Array.isArray(list) && list.length) {
          // Normalize to absolute public paths
          const normalized = list.map((p) => p.startsWith('/') ? p : `/previews/${p}`);
          return normalized;
        }
      } catch {}
      return null;
    };

    const probeCommonNamesPng = async () => {
      const prefixes = ['preview', 'screenshot', ''];
      const candidates = [];
      for (const prefix of prefixes) {
        for (let i = 1; i <= 10; i += 1) {
          const name = prefix ? `${prefix}${i}.png` : `${i}.png`;
          candidates.push(`/previews/${name}`);
        }
      }
      // Probe sequentially to avoid burst
      const found = [];
      // Limit to first 12 successes to avoid huge galleries
      for (const url of candidates) {
        // eslint-disable-next-line no-await-in-loop
        const ok = await tryLoadImg(url);
        if (ok) found.push(ok);
        if (found.length >= 12) break;
      }
      return found;
    };

    (async () => {
      // Try manifest first
      let imgs = await loadFromManifest();
      if (!imgs || imgs.length === 0) {
        imgs = await probeCommonNamesPng();
      }
      if (mounted) {
        setPreviewImages(imgs || []);
        setCurrentPreview(0);
      }
    })();

    return () => { mounted = false; };
  }, []);

  // Handle scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // If already authenticated, skip landing and go to dashboard
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        // Lightweight check using localStorage token to avoid extra network
        const token = localStorage.getItem('gmailToken');
        const email = localStorage.getItem('userEmail') || localStorage.getItem('currentUserEmail');
        if (token && email) {
          navigate('/dashboard', { replace: true });
          return;
        }
      } finally {
        if (mounted) setCheckingAuth(false);
      }
    };
    check();
    return () => { mounted = false; };
  }, [navigate]);

  // Smooth scroll to section
  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const faqs = [
    {
      question: "How does this website classify my emails?",
      answer: "We use advanced AI and machine learning algorithms to automatically categorize your emails into meaningful groups like Work, Personal, Promotions, Updates, and more. The classification happens in real-time as emails are fetched."
    },
    {
      question: "Is my email data stored or shared?",
      answer: "Your privacy is our top priority. We only fetch and process emails temporarily for classification. No email content is permanently stored on our servers, and we never share your data with third parties."
    },
    {
      question: "How long does the classification process take?",
      answer: "The first batch of 15 emails is classified instantly (usually within seconds). Additional emails are processed in the background, with the full 100-email classification completing within 1-2 minutes."
    },
    {
      question: "Can I view emails from specific dates?",
      answer: "Yes! Our Calendar view lets you browse emails by date. You can see which emails arrived on specific days and filter your inbox chronologically."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Navigation Bar */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled 
            ? 'bg-white/80 backdrop-blur-lg shadow-lg border-b border-gray-200' 
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Name */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
                <HiMail className="text-white text-xl" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                MailXpert
              </span>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-8">
              <button
                onClick={() => scrollToSection('hero')}
                className="text-gray-700 hover:text-indigo-600 font-medium transition-colors"
              >
                Home
              </button>
              <button
                onClick={() => scrollToSection('features')}
                className="text-gray-700 hover:text-indigo-600 font-medium transition-colors"
              >
                About
              </button>
              <button
                onClick={() => scrollToSection('faqs')}
                className="text-gray-700 hover:text-indigo-600 font-medium transition-colors"
              >
                FAQs
              </button>
              <Link
                to="/login"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:shadow-lg hover:scale-105 transition-all duration-300"
              >
                Login
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <Link
                to="/login"
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium"
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section id="hero" className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Backend status banner */}
        {serverStatus.state !== 'ready' && (
          <div className="max-w-3xl mx-auto mb-4">
            <div className={`flex items-start gap-3 rounded-xl border p-3 sm:p-4 text-sm shadow-sm ${serverStatus.state === 'warming' || serverStatus.state === 'checking' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <div className="mt-0.5">
                <span className={`inline-flex h-2.5 w-2.5 rounded-full ${serverStatus.state === 'checking' ? 'bg-amber-400 animate-pulse' : serverStatus.state === 'warming' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`} />
              </div>
              <div className="min-w-0">
                <p className="font-medium">
                  {serverStatus.state === 'checking' && 'Checking backend status…'}
                  {serverStatus.state === 'warming' && 'Server is starting — warming up…'}
                  {serverStatus.state === 'error' && 'Backend is unreachable right now.'}
                </p>
                <p className="text-xs sm:text-[13px] text-gray-600 mt-0.5">
                  Elapsed: {elapsed}s • API: <span className="font-mono">{API_BASE}</span>
                  {serverStatus.error ? ` • ${serverStatus.error}` : ''}
                </p>
              </div>
              <div className="ml-auto shrink-0">
                <button onClick={manualCheck} className="px-2.5 py-1.5 rounded-lg bg-white/70 hover:bg-white border text-gray-700 text-xs font-medium">
                  Retry now
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Animated Background Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{
              x: [0, 100, 0],
              y: [0, -100, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-20 left-10 w-96 h-96 bg-gradient-to-br from-indigo-200/40 to-purple-200/40 rounded-full blur-3xl"
          />
          <motion.div
            animate={{
              x: [0, -100, 0],
              y: [0, 100, 0],
              scale: [1, 1.3, 1],
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-br from-purple-200/40 to-pink-200/40 rounded-full blur-3xl"
          />
        </div>

        {/* Hero Content */}
        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 leading-tight mb-6">
              MailXpert
              <br />
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Organize Your Inbox Instantly
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
              Fetch, classify, and explore your emails in real time with AI-powered intelligence.
              Experience seamless inbox management like never before.
            </p>

            <Link
              to="/login"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-lg font-semibold hover:shadow-2xl hover:scale-105 transition-all duration-300 group"
            >
              <FiLogIn className="text-xl group-hover:rotate-12 transition-transform" />
              Login with Google
            </Link>
          </motion.div>

          {/* Decorative Elements */}
          <div className="absolute -top-10 left-1/4 w-20 h-20 bg-indigo-200 rounded-full blur-2xl opacity-50 animate-pulse" />
          <div className="absolute top-40 right-1/4 w-32 h-32 bg-purple-200 rounded-full blur-3xl opacity-40 animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600">Three simple steps to transform your inbox</p>
          </motion.div>

          {/* Steps */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {[
              {
                icon: FiLogIn,
                title: "Login Securely",
                description: "Connect your Google account with industry-standard OAuth2 authentication.",
                color: "from-blue-500 to-indigo-600"
              },
              {
                icon: FiCpu,
                title: "AI Classification",
                description: "Our advanced AI fetches and automatically classifies your emails into categories.",
                color: "from-purple-500 to-pink-600"
              },
              {
                icon: FiInbox,
                title: "Explore Insights",
                description: "View categorized emails, calendar insights, and sender analytics in your dashboard.",
                color: "from-indigo-500 to-purple-600"
              }
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="relative"
              >
                <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-gray-100">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-6 shadow-lg`}>
                    <step.icon className="text-3xl text-white" />
                  </div>
                  <div className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                    {index + 1}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Screenshot / App Preview Gallery */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="max-w-5xl mx-auto"
          >
            <div className="bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 rounded-3xl shadow-2xl p-8 border-4 border-white">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 sm:p-6 md:p-8">
                {/* Main Preview */}
                <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-white">
                  {previewImages.length > 0 ? (
                    <motion.img
                      key={currentPreview}
                      src={previewImages[currentPreview]}
                      alt={`Preview ${currentPreview + 1}`}
                      initial={{ opacity: 0.6, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4 }}
                      className="w-full h-[260px] sm:h-[360px] md:h-[420px] object-cover"
                      onError={(e) => { e.currentTarget.style.opacity = 0.4; e.currentTarget.alt = 'Image not found. Place .png images in /public/previews'; }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-[260px] sm:h-[360px] md:h-[420px]">
                      <div className="text-center text-gray-500">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                          <FiMail className="text-3xl text-white" />
                        </div>
                        <p>Add .png screenshots to <code className="px-1 py-0.5 bg-gray-100 rounded">public/previews</code></p>
                      </div>
                    </div>
                  )}

                  {/* Nav Arrows */}
                  {previewImages.length > 1 && (
                    <div className="absolute inset-0 flex items-center justify-between px-2 sm:px-3">
                      <button
                        aria-label="Previous preview"
                        onClick={() => setCurrentPreview((p) => (p - 1 + previewImages.length) % previewImages.length)}
                        className="p-2 sm:p-3 rounded-full bg-white/80 hover:bg-white shadow transition-all"
                      >
                        <FiChevronLeft className="text-xl" />
                      </button>
                      <button
                        aria-label="Next preview"
                        onClick={() => setCurrentPreview((p) => (p + 1) % previewImages.length)}
                        className="p-2 sm:p-3 rounded-full bg-white/80 hover:bg-white shadow transition-all"
                      >
                        <FiChevronRight className="text-xl" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Thumbnails */}
                {previewImages.length > 1 && (
                  <div className="mt-4 grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {previewImages.map((src, idx) => (
                      <button
                        key={src + idx}
                        onClick={() => setCurrentPreview(idx)}
                        className={`relative rounded-lg overflow-hidden border ${currentPreview === idx ? 'border-indigo-500 ring-2 ring-indigo-300' : 'border-gray-200 hover:border-gray-300'}`}
                        aria-label={`Select preview ${idx + 1}`}
                      >
                        <img
                          src={src}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-16 sm:h-20 object-cover"
                          onError={(e) => { e.currentTarget.style.opacity = 0.3; }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Key Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Key Features
            </h2>
            <p className="text-lg text-gray-600">Everything you need for intelligent email management</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: FiClock,
                title: "Real-time Classification",
                description: "Instantly sorts emails into categories as they arrive.",
                gradient: "from-blue-500 to-indigo-600"
              },
              {
                icon: FiCalendar,
                title: "Calendar Integration",
                description: "View and explore your emails organized by date.",
                gradient: "from-purple-500 to-pink-600"
              },
              {
                icon: FiBarChart2,
                title: "AI-Powered Insights",
                description: "Smarter analysis with top senders and category stats.",
                gradient: "from-indigo-500 to-purple-600"
              },
              {
                icon: FiShield,
                title: "Secure Authentication",
                description: "Your data stays private and safe with OAuth2.",
                gradient: "from-pink-500 to-rose-600"
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 group"
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="text-2xl text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs Section */}
      <section id="faqs" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              FAQs
            </h2>
            <p className="text-lg text-gray-600">Everything you need to know</p>
          </motion.div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-lg font-semibold text-gray-900 pr-4">
                    {faq.question}
                  </span>
                  <motion.div
                    animate={{ rotate: openFaq === index ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <FiChevronDown className="text-2xl text-indigo-600 flex-shrink-0" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {openFaq === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 text-gray-600 leading-relaxed">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo and Name */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
                <HiMail className="text-white text-xl" />
              </div>
              <span className="text-lg font-bold">MailXpert</span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-6 text-sm">
              <button
                onClick={() => scrollToSection('hero')}
                className="hover:text-indigo-400 transition-colors"
              >
                Home
              </button>
              <button
                onClick={() => scrollToSection('features')}
                className="hover:text-indigo-400 transition-colors"
              >
                About
              </button>
              <button
                onClick={() => scrollToSection('faqs')}
                className="hover:text-indigo-400 transition-colors"
              >
                FAQs
              </button>
              <button className="hover:text-indigo-400 transition-colors">
                Contact
              </button>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-8 pt-8 border-t border-gray-700 text-center text-sm text-gray-400">
            <p>© 2025 MailXpert. All rights reserved.</p>
            <p className="mt-2">Developed by <a href="https://www.linkedin.com/in/taminderjeet123" target="_blank" rel="noopener noreferrer" className="text-indigo-400 font-medium hover:text-indigo-300 transition-colors underline decoration-transparent hover:decoration-indigo-400">Taminderjeet Singh</a></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
