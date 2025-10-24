import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiMail, HiArrowLeft, HiShieldCheck, HiLockClosed } from 'react-icons/hi';
import GoogleLoginButton from '../components/GoogleLoginButton';
import { getAuthStatus } from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const status = await getAuthStatus();
        const ok = !!(status && (status.logged_in || status.loggedIn));
        if (ok) {
          navigate('/dashboard?login=success', { replace: true });
          return;
        }
      } catch (_) {
        // ignore
      } finally {
        if (mounted) setChecking(false);
      }
    };
    check();
    return () => { mounted = false; };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, -100, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 left-10 w-96 h-96 bg-gradient-to-br from-indigo-200/30 to-purple-200/30 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, -100, 0],
            y: [0, 100, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-br from-purple-200/30 to-pink-200/30 rounded-full blur-3xl"
        />
      </div>

      {/* Back to Landing Link (icon-only) */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="absolute top-6 left-6 z-10"
      >
        <Link
          to="/"
          aria-label="Back to Home"
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-700 hover:bg-white hover:shadow-lg transition-all duration-300 group"
        >
          <HiArrowLeft className="text-lg group-hover:-translate-x-1 transition-transform" />
        </Link>
      </motion.div>

      {/* Main Login Container */}
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-md relative z-10"
        >
          {/* Logo Section */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-2xl mb-4"
            >
              <HiMail className="text-4xl text-white" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-3xl font-bold text-gray-900 mb-2"
            >
              Welcome Back
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="text-gray-600"
            >
              Sign in to access your smart email dashboard
            </motion.p>
          </div>

          {/* Login Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-3xl shadow-2xl p-8"
          >
            {checking ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 mb-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <HiMail className="text-2xl text-indigo-600" />
                  </motion.div>
                </div>
                <p className="text-gray-600">Checking your session...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Security Features */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                      <HiShieldCheck className="text-green-600" />
                    </div>
                    <span>Secure OAuth2 authentication</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <HiLockClosed className="text-blue-600" />
                    </div>
                    <span>Your data stays private and encrypted</span>
                  </div>
                </div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500">Continue with</span>
                  </div>
                </div>

                {/* Google Login Button */}
                <div>
                  <GoogleLoginButton />
                </div>

                {/* Terms */}
                <p className="text-xs text-center text-gray-500 leading-relaxed">
                  By continuing, you agree to our Terms of Service and Privacy Policy.
                  We'll never share your email data with third parties.
                </p>
              </div>
            )}
          </motion.div>

          {/* Additional Info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="mt-6 text-center"
          >
            <p className="text-sm text-gray-600">
              New to MailXpert?{' '}
              <Link to="/" className="text-indigo-600 hover:text-indigo-700 font-medium hover:underline">
                Learn more
              </Link>
            </p>
            <p className="text-xs text-gray-500 mt-4">
              Developed by <a href="https://www.linkedin.com/in/taminderjeet123" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-medium hover:text-indigo-700 transition-colors underline decoration-transparent hover:decoration-indigo-600">Taminderjeet Singh</a>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
