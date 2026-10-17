import React, { useState, useEffect } from 'react';

/**
 * SolarShare - Main React Application Component
 * "Trade Clean Energy. Save Money. Power Your Community."
 * Supports role-based access, authentication state, and clean view rendering.
 */
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [status, setStatus] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  // Login form state
  const [loginInput, setLoginInput] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const token = localStorage.getItem('solarshare_token') || '';

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.authenticated && data.user) {
        setCurrentUser(data.user);
        setActiveTab(data.user.role === 'SELLER' ? 'seller_dashboard' : (data.user.role === 'BUYER' ? 'buyer_dashboard' : 'overview'));
      } else {
        setCurrentUser(null);
        setActiveTab('login');
      }
    } catch (err) {
      console.warn('Session check notice:', err);
      setCurrentUser(null);
      setActiveTab('login');
    } finally {
      fetchData();
    }
  };

  const fetchData = async () => {
    try {
      const [statusRes, overviewRes] = await Promise.all([
        fetch('/api/simulation/status').then(r => r.json()),
        fetch('/api/overview').then(r => r.json())
      ]);
      setStatus(statusRes);
      setOverview(overviewRes);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (accountId) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem('solarshare_token', data.token);
      setCurrentUser(data.user);
      setActiveTab(data.user.role === 'SELLER' ? 'seller_dashboard' : (data.user.role === 'BUYER' ? 'buyer_dashboard' : 'overview'));
    } catch (err) {
      setLoginError(err.message);
    }
  };

  const handleCredentialsLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: loginInput, password: loginPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem('solarshare_token', data.token);
      setCurrentUser(data.user);
      setActiveTab(data.user.role === 'SELLER' ? 'seller_dashboard' : (data.user.role === 'BUYER' ? 'buyer_dashboard' : 'overview'));
    } catch (err) {
      setLoginError(err.message);
    }
  };

  const handleLogout = async () => {
    const curToken = localStorage.getItem('solarshare_token');
    if (curToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${curToken}` }
      }).catch(() => {});
    }
    localStorage.removeItem('solarshare_token');
    setCurrentUser(null);
    setActiveTab('login');
  };

  const advanceHour = async () => {
    try {
      const curToken = localStorage.getItem('solarshare_token');
      await fetch('/api/simulation/advance', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${curToken}` }
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const runFullSimulation = async () => {
    try {
      const curToken = localStorage.getItem('solarshare_token');
      await fetch('/api/simulation/start', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${curToken}` }
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const resetSimulation = async () => {
    try {
      const curToken = localStorage.getItem('solarshare_token');
      await fetch('/api/simulation/reset', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${curToken}` }
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Unauthenticated / Login View
  if (!currentUser || activeTab === 'login') {
    return (
      <div className="min-h-screen bg-[#fafbf9] text-slate-800 flex flex-col font-sans">
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center font-black text-white shadow-sm">
              ☀️
            </div>
            <div>
              <span className="text-lg font-extrabold text-slate-900">Solar<span className="text-emerald-600">Share</span></span>
              <p className="text-[10px] text-slate-500 font-medium">Trade Clean Energy. Save Money. Power Your Community.</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            SDG 7 Clean Energy
          </span>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full p-6 sm:p-8 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-5">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-black text-slate-900">Sign in to SolarShare</h2>
              <p className="text-xs text-slate-500">Peer-to-peer energy marketplace simulator</p>
            </div>

            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {loginError}
              </div>
            )}

            <form onSubmit={handleCredentialsLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Username or Email</label>
                <input 
                  type="text" 
                  required 
                  value={loginInput} 
                  onChange={e => setLoginInput(e.target.value)} 
                  placeholder="e.g. seller_hh01 or buyer_hh02"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input 
                  type="password" 
                  required 
                  value={loginPassword} 
                  onChange={e => setLoginPassword(e.target.value)} 
                  placeholder="Enter password"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <button type="submit" className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm">
                Log In &rarr;
              </button>
            </form>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="text-xs font-bold text-slate-700">Judge 1-Click Demo Accounts:</div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => handleDemoLogin('admin')} className="p-2 border border-slate-200 rounded-lg hover:border-emerald-500 text-left">
                  <div className="text-[10px] font-bold text-slate-800">Admin</div>
                  <div className="text-[9px] text-slate-500">Grid Operator</div>
                </button>
                <button onClick={() => handleDemoLogin('seller_hh01')} className="p-2 border border-slate-200 rounded-lg hover:border-emerald-500 text-left">
                  <div className="text-[10px] font-bold text-slate-800">Seller</div>
                  <div className="text-[9px] text-slate-500">HH-01 (10 kW)</div>
                </button>
                <button onClick={() => handleDemoLogin('buyer_hh02')} className="p-2 border border-slate-200 rounded-lg hover:border-blue-500 text-left">
                  <div className="text-[10px] font-bold text-slate-800">Buyer</div>
                  <div className="text-[9px] text-slate-500">HH-02 (Deficit)</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const navTabs = currentUser.role === 'ADMIN'
    ? ['overview', 'marketplace', 'households', 'analytics', 'ledger', 'savings']
    : currentUser.role === 'SELLER'
    ? ['seller_dashboard', 'marketplace', 'analytics', 'savings']
    : ['buyer_dashboard', 'marketplace', 'analytics', 'savings'];

  return (
    <div className="min-h-screen bg-[#fafbf9] text-slate-800 flex flex-col font-sans">
      {/* Educational Banner */}
      <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-1.5 text-center text-xs text-emerald-800 font-medium">
        Educational simulation. Transactions and financial settlements are simulated and do not represent actual electricity transfers.
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center font-black text-white shadow-sm">
            ☀️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold text-slate-900">Solar<span className="text-emerald-600">Share</span></span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                {currentUser.roleLabel || currentUser.role}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">Trade Clean Energy. Save Money. Power Your Community.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentUser.role === 'ADMIN' && (
            <>
              <button onClick={advanceHour} className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 border border-slate-200 shadow-sm">
                Advance 1h
              </button>
              <button onClick={runFullSimulation} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white shadow-sm">
                Run Full 24h
              </button>
              <button onClick={resetSimulation} className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs font-semibold text-slate-500 border border-slate-200">
                Reset
              </button>
            </>
          )}

          <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
            Active: <span className="font-bold text-slate-800">{currentUser.name}</span>
          </div>

          <button 
            onClick={handleLogout} 
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 text-xs font-semibold text-slate-700 border border-slate-200"
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-5 flex gap-5">
        <nav className="w-52 space-y-1">
          {navTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                activeTab === tab 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
          <button 
            onClick={handleLogout} 
            className="w-full mt-4 text-left px-3 py-2 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all flex items-center gap-2"
          >
            <span>🚪</span>
            <span>Log Out</span>
          </button>
        </nav>

        <main className="flex-1">
          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading SolarShare...</div>
          ) : (
            <div className="space-y-5">
              <h1 className="text-xl font-bold text-slate-800 capitalize">{activeTab.replace('_', ' ')} Dashboard</h1>
              {overview && (
                <div className="grid grid-cols-4 gap-3.5">
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <div className="text-[11px] text-slate-500 uppercase font-bold">Solar Generation</div>
                    <div className="text-xl font-extrabold text-emerald-700 mt-1">{overview.metrics.totalSolarGenKWh} kWh</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <div className="text-[11px] text-slate-500 uppercase font-bold">Total Demand</div>
                    <div className="text-xl font-extrabold text-blue-700 mt-1">{overview.metrics.totalHouseholdDemandKWh} kWh</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <div className="text-[11px] text-slate-500 uppercase font-bold">Traded Energy</div>
                    <div className="text-xl font-extrabold text-emerald-700 mt-1">{overview.metrics.totalEnergyTradedKWh} kWh</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <div className="text-[11px] text-slate-500 uppercase font-bold">Buyer Savings</div>
                    <div className="text-xl font-extrabold text-emerald-700 mt-1">₹{overview.metrics.aggregateBuyerSavingsINR}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
