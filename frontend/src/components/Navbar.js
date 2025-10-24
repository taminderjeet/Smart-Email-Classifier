import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import './Navbar.css';
import { getAuthStatus, logout, clearUserData } from '../services/api';
import classifierRunner from '../utils/classifierRunner';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen(o => !o);
  const close = () => setOpen(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [classifyBusy, setClassifyBusy] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        setAuthChecking(true);
        const status = await getAuthStatus();
        const ok = !!(status && (status.logged_in || status.loggedIn));
        setLoggedIn(ok);
        if (ok) {
          setUser({
            email: status.email || '',
            name: status.name || '',
            picture: status.picture || '',
          });
        } else {
          // Fallback from localStorage to avoid flicker
          try {
            const token = localStorage.getItem('gmailToken');
            const email = localStorage.getItem('userEmail') || localStorage.getItem('currentUserEmail');
            const name = localStorage.getItem('userName') || '';
            const picture = localStorage.getItem('userPicture') || '';
            if (token && email) {
              setLoggedIn(true);
              setUser({ email, name, picture });
            } else {
              setUser(null);
            }
          } catch {
            setUser(null);
          }
        }
      } catch {
        // On error, also try fallback
        try {
          const token = localStorage.getItem('gmailToken');
          const email = localStorage.getItem('userEmail') || localStorage.getItem('currentUserEmail');
          const name = localStorage.getItem('userName') || '';
          const picture = localStorage.getItem('userPicture') || '';
          if (token && email) {
            setLoggedIn(true);
            setUser({ email, name, picture });
          } else {
            setLoggedIn(false);
            setUser(null);
          }
        } catch {
          setLoggedIn(false);
          setUser(null);
        }
      } finally {
        setAuthChecking(false);
      }
    };
    check();
  }, []);

  // Subscribe to global classifier state to disable logout while busy
  useEffect(() => {
    const unsub = classifierRunner.subscribe((s) => {
      const busy = !!(s.initialBusy || s.bgBusy || s.running);
      setClassifyBusy(busy);
    });
    return unsub;
  }, []);

  const onLogout = async () => {
    try {
      // Best effort: clear backend processed data using current token
      try { await clearUserData(); } catch {}
      await logout();
    } finally {
      try {
        // Clear all local data so the user must login and fetch again
        localStorage.clear();
      } catch {}
      window.location.reload();
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="navbar-brand">
          <Link to="/" onClick={close}>MailClassify</Link>
        </div>
        <button
          className="navbar-toggle"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={toggle}
        >
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
        </button>
        <div className={`navbar-links ${open ? 'open' : ''}`}>
          <NavLink to="/" end onClick={close}>Home</NavLink>
          <NavLink to="/dashboard" onClick={close}>Dashboard</NavLink>
          <NavLink to="/calendar" onClick={close}>Calendar</NavLink>
          <NavLink to="/sender" onClick={close}>Sender</NavLink>
          {/* Right-side profile area */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {!authChecking && loggedIn && user ? (
              <>
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name || 'User'}
                    style={{ width: 28, height: 28, borderRadius: '50%' }}
                  />
                ) : (
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#0b5ed7',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: 13,
                  }}>
                    {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="nav-user" title={user.email} style={{ fontSize: 13 }}>
                  {user.name || user.email}
                </span>
                <button
                  className={`nav-logout ${classifyBusy ? 'nav-logout-disabled' : ''}`}
                  onClick={(e) => { if (!classifyBusy) onLogout(); }}
                  disabled={classifyBusy}
                  title={classifyBusy ? 'Please wait while emails are being classified…' : 'Logout'}
                >
                  Logout
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
