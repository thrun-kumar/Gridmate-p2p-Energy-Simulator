/**
 * SolarShare - Master Application Controller & Role-Aware Router
 * Implements clean-URL routing (/login, /register, /buyer/*, /seller/*, /admin/*),
 * authentication state management, route protection, and simulation controls.
 * Supports UN SDG 7: Clean Energy and Green Technology.
 */

window.App = {
  currentRoute: '/login',
  currentUser: null,
  simulationStatus: null,

  async init() {
    console.log('[SolarShare] Initializing Clean Energy Simulator...');

    // Popstate listener for browser forward/back buttons
    window.addEventListener('popstate', () => {
      this.handlePopState();
    });

    // Check current authentication session
    try {
      const auth = await window.API.getMe();
      if (auth.authenticated && auth.user) {
        this.currentUser = auth.user;
      } else {
        this.currentUser = null;
      }
    } catch (e) {
      console.warn('Session verification notice:', e.message);
      this.currentUser = null;
    }

    // Determine initial route from URL pathname (or hash)
    let initialPath = window.location.pathname;
    if (!initialPath || initialPath === '/') {
      const hash = window.location.hash.replace('#', '');
      initialPath = hash ? (hash.startsWith('/') ? hash : `/${hash}`) : '';
    }

    // Resolve initial route based on authentication
    const resolvedRoute = this.resolveInitialRoute(initialPath);
    await this.navigate(resolvedRoute, true);

    // Start background simulation state polling
    this.initLivePolling();
  },

  isAuthRoute(route) {
    const target = (route !== undefined && route !== null) ? route : this.currentRoute;
    if (!target) return !this.currentUser;
    const clean = this.normalizeRoute(target);
    return clean === '/login' || clean === '/register' || clean === '/auth/callback';
  },

  getDefaultRoute() {
    if (!this.currentUser) return '/login';
    if (this.currentUser.role === 'SELLER') return '/seller/dashboard';
    if (this.currentUser.role === 'BUYER') return '/buyer/dashboard';
    if (this.currentUser.role === 'ADMIN') return '/admin/overview';
    return '/seller/dashboard'; // Both
  },

  getDefaultTab() {
    return this.getDefaultRoute();
  },

  normalizeRoute(route) {
    if (!route) return '/login';
    let r = route.trim();
    if (r.startsWith('#')) r = r.substring(1);
    if (!r.startsWith('/')) r = `/${r}`;

    // Map legacy tab identifiers to clean URLs
    const mapping = {
      '/login': '/login',
      '/register': '/register',
      '/overview': '/admin/overview',
      '/admin': '/admin/overview',
      '/admin/overview': '/admin/overview',
      '/seller_dashboard': '/seller/dashboard',
      '/seller': '/seller/dashboard',
      '/seller/dashboard': '/seller/dashboard',
      '/buyer_dashboard': '/buyer/dashboard',
      '/buyer': '/buyer/dashboard',
      '/buyer/dashboard': '/buyer/dashboard',
      '/marketplace': '/marketplace',
      '/households': '/households',
      '/analytics': '/analytics',
      '/ledger': '/ledger',
      '/savings': '/savings'
    };

    return mapping[r] || r;
  },

  resolveInitialRoute(pathname) {
    const clean = this.normalizeRoute(pathname);

    // Unauthenticated user
    if (!this.currentUser) {
      if (clean === '/register') return '/register';
      return '/login';
    }

    // Authenticated user opening auth page -> redirect to their dashboard
    if (this.isAuthRoute(clean) || clean === '/') {
      return this.getDefaultRoute();
    }

    // Role-based route guard
    if (clean.startsWith('/seller') && this.currentUser.role === 'BUYER') {
      return '/buyer/dashboard';
    }
    if (clean.startsWith('/buyer') && this.currentUser.role === 'SELLER') {
      return '/seller/dashboard';
    }
    if (clean.startsWith('/admin') && this.currentUser.role !== 'ADMIN') {
      return this.getDefaultRoute();
    }

    return clean;
  },

  handlePopState() {
    const path = window.location.pathname;
    this.navigate(path, false);
  },

  async navigate(targetRoute, updateHistory = true) {
    const normalized = this.normalizeRoute(targetRoute);

    // Route Protection Guard
    if (!this.currentUser && !this.isAuthRoute(normalized)) {
      console.log(`Protected route ${normalized} accessed while unauthenticated. Redirecting to /login.`);
      window.Toast.info('Please log in to access your SolarShare dashboard.');
      return this.navigate('/login', updateHistory);
    }

    // Logged-in user visiting /login or /register -> redirect to dashboard
    if (this.currentUser && this.isAuthRoute(normalized)) {
      return this.navigate(this.getDefaultRoute(), updateHistory);
    }

    // Role mismatch guards for protected dashboard routes
    if (this.currentUser) {
      if (normalized.startsWith('/seller') && this.currentUser.role === 'BUYER') {
        window.Toast.error('Access Denied: You are logged in as a Buyer.');
        return this.navigate('/buyer/dashboard', updateHistory);
      }
      if (normalized.startsWith('/buyer') && this.currentUser.role === 'SELLER') {
        window.Toast.error('Access Denied: You are logged in as a Seller.');
        return this.navigate('/seller/dashboard', updateHistory);
      }
      if (normalized.startsWith('/admin') && this.currentUser.role !== 'ADMIN') {
        window.Toast.error('Access Denied: Administrator privileges required.');
        return this.navigate(this.getDefaultRoute(), updateHistory);
      }
      if ((normalized === '/ledger' || normalized === '/households') && this.currentUser.role !== 'ADMIN') {
        window.Toast.error('Access Denied: Administrator privileges required.');
        return this.navigate(this.getDefaultRoute(), updateHistory);
      }
    }

    this.currentRoute = normalized;

    // Update browser URL
    if (updateHistory && window.location.pathname !== normalized) {
      try {
        window.history.pushState(null, '', normalized);
      } catch (e) {
        window.location.hash = normalized;
      }
    }

    // Toggle View Containers
    const authContainer = document.getElementById('auth-view-container');
    const mainContainer = document.getElementById('main-layout-container');

    if (this.isAuthRoute(normalized)) {
      if (authContainer) authContainer.classList.remove('hidden');
      if (mainContainer) mainContainer.classList.add('hidden');
    } else {
      if (authContainer) authContainer.classList.add('hidden');
      if (mainContainer) mainContainer.classList.remove('hidden');
    }

    // Sync header & sidebar
    await this.refreshSimulationStatus();
    this.renderSidebar();

    // Render active view
    await this.renderCurrentView();
  },

  async refreshSimulationStatus() {
    try {
      this.simulationStatus = await window.API.getSimulationStatus();
      window.Header.render(this.simulationStatus);
    } catch (err) {
      console.warn('Simulation status sync notice:', err.message);
      window.Header.render(null);
    }
  },

  renderSidebar() {
    const navContainer = document.getElementById('sidebar-nav');
    if (!navContainer) return;

    const user = this.currentUser;

    if (!user) {
      navContainer.innerHTML = `
        <a href="/login" onclick="event.preventDefault(); window.App.navigate('/login')" class="nav-link active">
          <span>Account Login</span>
        </a>
      `;
      return;
    }

    let links = [];

    if (user.role === 'ADMIN') {
      links = [
        { route: '/admin/overview', label: 'Dashboard' },
        { route: '/marketplace', label: 'Marketplace' },
        { route: '/households', label: 'Participants' },
        { route: '/analytics', label: 'Pricing & Rules' },
        { route: '/ledger', label: 'Transaction Ledger' },
        { route: '/savings', label: 'Reports & Impact' }
      ];
    } else if (user.role === 'SELLER') {
      links = [
        { route: '/seller/dashboard', label: 'Dashboard' },
        { route: '/marketplace', label: 'Marketplace' },
        { route: '/savings', label: 'Transactions & Savings' },
        { route: '/analytics', label: 'Price Trends' }
      ];
    } else if (user.role === 'BUYER') {
      links = [
        { route: '/buyer/dashboard', label: 'Dashboard' },
        { route: '/marketplace', label: 'Marketplace' },
        { route: '/savings', label: 'Transactions & Savings' },
        { route: '/analytics', label: 'Price Trends' }
      ];
    } else { // BOTH
      links = [
        { route: '/seller/dashboard', label: 'Seller Dashboard' },
        { route: '/buyer/dashboard', label: 'Buyer Dashboard' },
        { route: '/marketplace', label: 'Marketplace' },
        { route: '/savings', label: 'Transactions & Savings' },
        { route: '/analytics', label: 'Price Trends' }
      ];
    }

    navContainer.innerHTML = links.map(l => {
      const isActive = this.currentRoute === l.route;
      return `
        <a 
          href="${l.route}" 
          onclick="event.preventDefault(); window.App.navigate('${l.route}')" 
          class="nav-link flex items-center px-3 py-2 rounded-lg font-semibold text-xs transition-all ${isActive ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}"
        >
          <span>${l.label}</span>
        </a>
      `;
    }).join('');

    // Sidebar Active Account & Prominent Log Out Section
    const accountContainer = document.getElementById('sidebar-account-container');
    if (accountContainer) {
      accountContainer.innerHTML = `
        <div class="space-y-2">
          <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">Signed In As</div>
          <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
            <div class="font-bold text-slate-800 truncate">${user.name}</div>
            <div class="flex items-center justify-between text-[11px] text-slate-500">
              <span class="text-slate-600 font-medium">${user.roleLabel || user.role}</span>
              ${user.householdId ? `<span class="font-mono text-emerald-700 font-bold">${user.householdId}</span>` : ''}
            </div>
          </div>
          <button 
            id="btn-sidebar-logout"
            onclick="window.App.logout()" 
            class="w-full btn text-xs py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 hover:border-rose-300 font-bold rounded-lg transition-all shadow-sm"
            title="Log out of SolarShare"
          >
            Log Out
          </button>
        </div>
      `;
    }

    const mobileNav = document.getElementById('mobile-nav-items');
    if (mobileNav) {
      mobileNav.innerHTML = links.map(l => `
        <button onclick="window.App.navigate('${l.route}')" class="btn btn-secondary text-xs py-1 px-2.5 whitespace-nowrap ${this.currentRoute === l.route ? 'border-emerald-500 text-emerald-800 bg-emerald-50' : ''}">
          ${l.label}
        </button>
      `).join('') + `
        <button onclick="window.App.logout()" class="btn text-xs py-1 px-2.5 whitespace-nowrap bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold">
          Log Out
        </button>
      `;
    }
  },

  async renderCurrentView() {
    const route = this.currentRoute;

    try {
      if (route === '/login') {
        await window.LoginView.render();
      } else if (route === '/register') {
        await window.RegisterView.render();
      } else if (route === '/seller/dashboard') {
        await window.SellerDashboardView.render();
      } else if (route === '/buyer/dashboard') {
        await window.BuyerDashboardView.render();
      } else if (route === '/admin/overview' || route === '/overview') {
        const data = await window.API.getOverview();
        window.OverviewView.render(data);
      } else if (route === '/marketplace') {
        const [marketData, hhData] = await Promise.all([
          window.API.getMarketplace(),
          window.API.getHouseholds()
        ]);
        window.MarketplaceView.render(marketData, hhData.households);
      } else if (route === '/households') {
        const data = await window.API.getHouseholds();
        window.HouseholdsView.render(data);
      } else if (route === '/analytics') {
        const data = await window.API.getAnalytics();
        window.AnalyticsView.render(data);
      } else if (route === '/ledger') {
        const data = await window.API.getLedger();
        window.LedgerView.render(data);
      } else if (route === '/savings') {
        const data = await window.API.getSavings();
        window.SavingsView.render(data);
      } else {
        // Fallback for unmatched route
        await this.navigate(this.getDefaultRoute());
      }
    } catch (err) {
      console.error('Error rendering route:', route, err);
      window.Toast.error(`Failed to load ${route}: ${err.message}`);
    }
  },

  _lastKnownHour: null,
  _lastKnownMinute: null,
  _lastKnownIsRunning: null,
  _pollIntervalId: null,

  initLivePolling() {
    if (this._pollIntervalId) clearInterval(this._pollIntervalId);
    this._pollIntervalId = setInterval(async () => {
      // Don't poll if not logged in or on auth pages
      if (!this.currentUser || this.isAuthRoute(this.currentRoute)) return;
      try {
        const status = await window.API.getSimulationStatus();
        this.simulationStatus = status;

        const hourChanged = this._lastKnownHour !== null && this._lastKnownHour !== status.currentHour;
        const minuteChanged = this._lastKnownMinute !== null && this._lastKnownMinute !== status.currentMinute;
        const runStateChanged = this._lastKnownIsRunning !== null && this._lastKnownIsRunning !== status.isRunning;

        this._lastKnownHour = status.currentHour;
        this._lastKnownMinute = status.currentMinute;
        this._lastKnownIsRunning = status.isRunning;

        if (hourChanged || minuteChanged || runStateChanged) {
          window.Header.render(status);
          if (hourChanged || minuteChanged) {
            await this.renderCurrentView();
          }
        }
      } catch (e) {
        // silent polling catch
      }
    }, 2500);
  },

  async toggleAutoSimulation() {
    const btn = document.getElementById('btn-toggle-simulation');
    if (btn) btn.disabled = true;

    try {
      const res = await window.API.toggleAutoSimulation();
      this.simulationStatus = res;
      this._lastKnownIsRunning = res.isRunning;
      window.Header.render(res);
      window.Toast.info(res.isRunning ? `Automatic simulation started (advancing 1 hour every ${res.autoSpeedSeconds || 10}s).` : 'Automatic simulation paused.');
    } catch (err) {
      window.Toast.error(`Simulation toggle error: ${err.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async changeSimulationSpeed(speedSeconds) {
    try {
      const res = await window.API.setSimulationSpeed(speedSeconds);
      window.Toast.info(`Simulation speed updated to ${res.autoSpeedSeconds}s per hour.`);
    } catch (err) {
      window.Toast.error(`Speed setting error: ${err.message}`);
    }
  },

  async advanceHour() {
    const btn = document.getElementById('btn-advance-hour');
    if (btn) btn.disabled = true;

    try {
      const res = await window.API.advanceHour();
      const step = res.step;
      this.simulationStatus = await window.API.getSimulationStatus();
      this._lastKnownHour = this.simulationStatus.currentHour;
      this._lastKnownMinute = this.simulationStatus.currentMinute;
      window.Header.render(this.simulationStatus);
      const timeLabel = this.simulationStatus.simulatedTime || `${String(step.nextHour).padStart(2, '0')}:00`;
      window.Toast.success(`Advanced simulation by one hour to ${timeLabel}. Settled ${step.tradesExecuted} trades (${step.energyTradedKWh} kWh).`);
      await this.renderCurrentView();
    } catch (err) {
      window.Toast.error(`Simulation step error: ${err.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async advance15Minutes() {
    const btn = document.getElementById('btn-advance-15');
    if (btn) btn.disabled = true;

    try {
      const res = await window.API.advance15Minutes();
      this.simulationStatus = await window.API.getSimulationStatus();
      this._lastKnownHour = this.simulationStatus.currentHour;
      this._lastKnownMinute = this.simulationStatus.currentMinute;
      window.Header.render(this.simulationStatus);
      window.Toast.success(`Advanced simulation by 15 minutes to ${res.simulatedTime} (${res.hourProgressLabel}).`);
      await this.renderCurrentView();
    } catch (err) {
      window.Toast.error(`Simulation step error: ${err.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async matchAvailableOrders() {
    const btn = document.getElementById('btn-match-orders');
    if (btn) btn.disabled = true;

    try {
      const res = await window.API.matchAvailableOrders();
      this.simulationStatus = await window.API.getSimulationStatus();
      window.Header.render(this.simulationStatus);
      window.Toast.success(`Matched orders: settled ${res.tradesExecuted} trades (${res.energyTradedKWh} kWh traded).`);
      await this.renderCurrentView();
    } catch (err) {
      window.Toast.error(`Matching error: ${err.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async toggleAutoMatching(enabled) {
    try {
      await window.API.setAutoMatching(enabled);
      this.simulationStatus = await window.API.getSimulationStatus();
      window.Toast.info(`Auto-matching is now ${enabled ? 'ENABLED (trades match automatically on time advance)' : 'DISABLED (manual matching required)'}.`);
    } catch (err) {
      window.Toast.error(`Auto-matching setting error: ${err.message}`);
    }
  },

  async runSimulation() {
    const btn = document.getElementById('btn-run-simulation');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="inline-block animate-spin mr-1">⟳</span> Simulating...`;
    }

    try {
      const res = await window.API.runFullSimulation();
      this.simulationStatus = await window.API.getSimulationStatus();
      this._lastKnownHour = this.simulationStatus.currentHour;
      this._lastKnownMinute = this.simulationStatus.currentMinute;
      window.Header.render(this.simulationStatus);
      window.Toast.success(`Full-day 24-hour simulation complete! Executed ${res.result.totalTradesExecuted} trades (${res.result.totalEnergyTradedKWh} kWh).`);
      await this.renderCurrentView();
      if (res.summary) {
        window.Header.showSimulationResultsModal(res.summary);
      }
    } catch (err) {
      window.Toast.error(`Simulation execution failed: ${err.message}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Run Full 24 Hours';
      }
    }
  },

  async resetSimulation() {
    if (!confirm('Are you sure you want to reset the simulation to 10:00 AM daytime initial state? Active daytime marketplace offers will be populated.')) {
      return;
    }
    const btn = document.getElementById('btn-reset-simulation');
    if (btn) btn.disabled = true;

    try {
      await window.API.resetSimulation();
      this.simulationStatus = await window.API.getSimulationStatus();
      this._lastKnownHour = this.simulationStatus.currentHour;
      this._lastKnownMinute = this.simulationStatus.currentMinute;
      window.Header.render(this.simulationStatus);
      window.Toast.info('Simulation reset to 10:00 AM daytime demonstration baseline with active offers.');
      await this.renderCurrentView();
    } catch (err) {
      window.Toast.error(`Reset error: ${err.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async logout() {
    await window.API.logout();
    this.currentUser = null;
    window.Toast.info('Logged out. Please select an account or log in.');
    await this.navigate('/login');
  },

  handleUnauthorized() {
    this.currentUser = null;
    window.Toast.error('Session expired or unauthorized. Please log in.');
    this.navigate('/login');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});
