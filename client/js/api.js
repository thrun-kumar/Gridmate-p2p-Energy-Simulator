/**
 * SolarShare - Client API Service
 * Connects frontend views to backend RESTful Express endpoints.
 * Automatically injects Bearer session tokens for role authorization.
 * Supports UN SDG 7: Clean Energy and Green Technology.
 */

const API_BASE = window.location.origin;

window.API = {
  getToken() {
    return localStorage.getItem('solarshare_token') || '';
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('solarshare_token', token);
    } else {
      localStorage.removeItem('solarshare_token');
    }
  },

  async get(endpoint) {
    const token = this.getToken();
    const headers = { 'Accept': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, { headers });
    if (!res.ok) {
      if (res.status === 401) {
        this.setToken('');
        if (window.App && typeof window.App.handleUnauthorized === 'function') {
          window.App.handleUnauthorized();
        }
      }
      const err = await res.json().catch(() => ({ error: 'Network request failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async post(endpoint, data = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      if (res.status === 401) {
        this.setToken('');
        if (window.App && typeof window.App.handleUnauthorized === 'function') {
          window.App.handleUnauthorized();
        }
      }
      const err = await res.json().catch(() => ({ error: 'Network request failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  // Auth Methods
  getDemoAccounts() { return this.get('/api/auth/accounts'); },
  login(accountId) { return this.post('/api/auth/login', { accountId }); },
  loginCredentials(usernameOrEmail, password) {
    return this.post('/api/auth/login-credentials', { usernameOrEmail, password });
  },
  register(userData) {
    return this.post('/api/auth/register', userData);
  },
  resetPassword(usernameOrEmail, newPassword) {
    return this.post('/api/auth/reset-password', { usernameOrEmail, newPassword });
  },
  logout() {
    return this.post('/api/auth/logout').catch(() => ({})).finally(() => {
      this.setToken('');
    });
  },
  getGoogleConfig() {
    return this.get('/api/auth/google/config');
  },
  loginGoogle(data) {
    return this.post('/api/auth/google', data);
  },
  getMe() { return this.get('/api/auth/me'); },

  // API Methods
  getDashboard() { return this.get('/api/dashboard'); },
  getReadings() { return this.get('/api/readings'); },
  getMarketPrice() { return this.get('/api/market/price'); },
  getCompanyFinance() { return this.get('/api/company/finance'); },
  updateHouseholdPreferences(householdId, preferences) {
    return this.post(`/api/households/${householdId}/preferences`, preferences);
  },
  runSimulationInterval() { return this.post('/api/simulation/run'); },
  getOverview() { return this.get('/api/overview'); },
  getHouseholds() { return this.get('/api/households'); },
  getHousehold(id) { return this.get(`/api/households/${id}`); },
  getMarketplace() { return this.get('/api/marketplace'); },
  getTrades() { return this.get('/api/trades'); },
  getLedger() { return this.get('/api/ledger'); },
  verifyLedger() { return this.get('/api/ledger/verify'); },
  simulateTamperTest(targetIndex, fieldToAlter, alteredValue) {
    return this.post('/api/ledger/simulate-tamper', { targetIndex, fieldToAlter, alteredValue });
  },
  getAnalytics() { return this.get('/api/analytics/prices'); },
  getSavings() { return this.get('/api/savings'); },
  getSimulationStatus() { return this.get('/api/simulation/status'); },
  getSimulationSummary() { return this.get('/api/simulation/summary'); },
  advanceHour() { return this.post('/api/simulation/run'); },
  advance15Minutes() { return this.post('/api/simulation/advance-15'); },
  matchAvailableOrders() { return this.post('/api/simulation/match-orders'); },
  setAutoMatching(enabled) { return this.post('/api/simulation/auto-matching', { enabled }); },
  runFullSimulation() { return this.post('/api/simulation/start'); },
  runFullDay() { return this.post('/api/simulation/run-day'); },
  startAutoSimulation(speedSeconds = 10) { return this.post('/api/simulation/auto/start', { speedSeconds }); },
  pauseAutoSimulation() { return this.post('/api/simulation/auto/pause'); },
  toggleAutoSimulation(speedSeconds = 10) { return this.post('/api/simulation/auto/toggle', { speedSeconds }); },
  setSimulationSpeed(speedSeconds) { return this.post('/api/simulation/speed', { speedSeconds }); },
  resetSimulation() { return this.post('/api/simulation/reset'); },
  getSimulationScenarios() { return this.get('/api/simulation/scenarios'); },
  applyScenario(scenario, options = {}) { return this.post('/api/simulation/scenario', { scenario, options }); },
  submitOffer(householdId, energyKWh, askingPriceINR) {
    return this.post('/api/marketplace/offers', { householdId, energyKWh, askingPriceINR });
  },
  updateOffer(offerId, energyKWh, askingPriceINR) {
    return this.post(`/api/marketplace/offers/${offerId}/update`, { energyKWh, askingPriceINR });
  },
  submitBid(householdId, energyKWh, maxBidINR) {
    return this.post('/api/marketplace/bids', { householdId, energyKWh, maxBidINR });
  },
  cancelOrder(orderId) {
    return this.post(`/api/marketplace/orders/${orderId}/cancel`);
  },

  // Grid Network Methods
  getGridNetwork() { return this.get('/api/grid/network'); },
  getGridRoutes() { return this.get('/api/grid/routes'); },
  setRouteStatus(routeId, status) { return this.post(`/api/grid/routes/${routeId}/status`, { status }); },
  setRouteCapacity(routeId, capacityKWh) { return this.post(`/api/grid/routes/${routeId}/capacity`, { capacityKWh }); },
  getMeters() { return this.get('/api/meters'); },

  // Regulation-Aware Pricing & Reviews
  getActivePricingRule() { return this.get('/api/pricing-rules/active'); },
  getAllPricingRules() { return this.get('/api/pricing-rules'); },
  validatePrice(priceINR, ruleId = null) { return this.post('/api/pricing-rules/validate-price', { priceINR, ruleId }); },
  submitPriceReview(data) { return this.post('/api/pricing-rules/reviews', data); },
  getPriceReviewRequests(status = null) { return this.get(`/api/pricing-rules/reviews${status ? `?status=${status}` : ''}`); },
  resolvePriceReview(id, decision, operatorNotes = '') { return this.post(`/api/pricing-rules/reviews/${id}/resolve`, { decision, operatorNotes }); },
  getRejectedPricesLog(limit = 50) { return this.get(`/api/pricing-rules/rejected-log?limit=${limit}`); },

  // Ordinary Buyer Marketplace & Direct Purchases
  getRankedOffers(buyerZone = 'ZONE-A') { return this.get(`/api/marketplace/ranked-offers?buyerZone=${encodeURIComponent(buyerZone)}`); },
  getPurchaseQuote(purchaseData) { return this.post('/api/marketplace/purchase/quote', purchaseData); },
  purchaseOffer(purchaseData) { return this.post('/api/marketplace/purchase', purchaseData); },

  // Live Market State & Dynamic Pricing
  getLiveMarket() { return this.get('/api/market/live'); },
  setClockMode(mode) { return this.post('/api/market/clock-mode', { mode }); },

  // CSV Export
  async downloadLedgerCSV() {
    const token = this.getToken();
    const res = await fetch(`${API_BASE}/api/ledger/export/csv`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to generate CSV export');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solarshare_transaction_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
};
