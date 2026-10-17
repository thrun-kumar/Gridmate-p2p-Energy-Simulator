/**
 * SolarShare - Dedicated Login Page Component (/login)
 * Features standalone authentication layout, Google Sign-In,
 * PBKDF2 credentials login, password reset modal, and 1-Click Judge Demo Accounts.
 */

window.LoginView = {
  _showPassword: false,
  _googleConfig: null,
  _pendingGoogleAccount: null,

  async render() {
    const authRoot = document.getElementById('auth-view-container');
    if (!authRoot) return;

    // Load Google OAuth Config
    try {
      this._googleConfig = await window.API.getGoogleConfig();
    } catch (e) {
      this._googleConfig = { clientId: '', isConfigured: false };
    }

    // Load Demo Accounts
    let accounts = [];
    try {
      const data = await window.API.getDemoAccounts();
      accounts = data.accounts || [];
    } catch (e) {
      accounts = [
        { id: 'admin', name: 'Grid System Operator', role: 'ADMIN', roleLabel: 'Admin / Grid Operator' },
        { id: 'seller_hh01', name: 'Green Meadows Villa', role: 'SELLER', roleLabel: 'Seller / Prosumer', householdId: 'HH-01' },
        { id: 'buyer_hh02', name: 'Apex Tech Park Office', role: 'BUYER', roleLabel: 'Buyer / Consumer', householdId: 'HH-02' }
      ];
    }

    const adminAccounts = accounts.filter(a => a.role === 'ADMIN');
    const sellerAccounts = accounts.filter(a => a.role === 'SELLER');
    const buyerAccounts = accounts.filter(a => a.role === 'BUYER');
    const bothAccounts = accounts.filter(a => a.role === 'BOTH');

    authRoot.innerHTML = `
      <div class="max-w-xl w-full mx-auto space-y-6">

        <!-- BRANDING HERO CARD -->
        <div class="card p-6 sm:p-8 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-6">
          <div class="text-center space-y-2">
            <div class="inline-flex w-12 h-12 rounded-xl bg-emerald-700 text-white items-center justify-center text-lg font-black tracking-wider shadow-sm mb-1 font-mono">
              SS
            </div>
            <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-[#064e3b]">
              Solar<span class="text-emerald-600">Share</span>
            </h1>
            <p class="text-xs font-bold text-emerald-800 tracking-wider uppercase">
              Trade Clean Energy. Save Money. Power Your Community.
            </p>
            <p class="text-xs text-slate-500 max-w-md mx-auto leading-relaxed pt-1">
              Peer-to-peer energy trading simulator. Surplus solar prosumers connect directly with deficit consumers using fair double-auction pricing and cryptographic verification.
            </p>
          </div>

          <!-- THREE STEP VALUE GUIDE -->
          <div class="grid grid-cols-3 gap-2 py-2 px-1 border-y border-slate-100 text-center">
            <div class="p-2 rounded-lg bg-[#fafbf9]">
              <div class="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">1. Solar Peak</div>
              <div class="text-[11px] text-slate-600 font-medium">Export Midday Surplus</div>
            </div>
            <div class="p-2 rounded-lg bg-[#fafbf9]">
              <div class="text-[10px] font-bold text-blue-800 uppercase tracking-wide">2. Fair Clearing</div>
              <div class="text-[11px] text-slate-600 font-medium">Midpoint Pricing</div>
            </div>
            <div class="p-2 rounded-lg bg-[#fafbf9]">
              <div class="text-[10px] font-bold text-amber-800 uppercase tracking-wide">3. SHA-256 Chain</div>
              <div class="text-[11px] text-slate-600 font-medium">Tamper-Proof Ledger</div>
            </div>
          </div>

          <!-- FEEDBACK ALERT -->
          <div id="login-alert" class="hidden"></div>

          <!-- GOOGLE SIGN-IN SECTION -->
          <div class="space-y-3">
            <div id="google-btn-wrapper" class="w-full">
              <button 
                type="button" 
                onclick="window.LoginView.handleGoogleClick()" 
                class="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-3 transition-all shadow-sm"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>
            
            <div id="gis-render-container" class="hidden"></div>
          </div>

          <!-- DIVIDER -->
          <div class="relative flex py-1 items-center">
            <div class="flex-grow border-t border-slate-200"></div>
            <span class="flex-shrink mx-3 text-[11px] text-slate-400 font-semibold uppercase">Or log in with credentials</span>
            <div class="flex-grow border-t border-slate-200"></div>
          </div>

          <!-- CREDENTIALS LOGIN FORM -->
          <form id="credentials-login-form" onsubmit="window.LoginView.handleCredentialsSubmit(event)" class="space-y-4">
            <div>
              <label class="input-label" for="login-username">Username or Email Address</label>
              <input 
                id="login-username" 
                type="text" 
                required 
                placeholder="e.g. seller_hh01 or buyer_hh02" 
                class="input-field text-xs" 
              />
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="input-label" for="login-password">Password</label>
                <button type="button" onclick="window.LoginView.openResetModal()" class="text-[11px] text-emerald-700 hover:underline">
                  Forgot Password?
                </button>
              </div>
              <div class="relative">
                <input 
                  id="login-password" 
                  type="password" 
                  required 
                  placeholder="Enter account password" 
                  class="input-field text-xs pr-14" 
                />
                <button 
                  type="button" 
                  onclick="window.LoginView.togglePassword()"
                  class="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-[11px] font-semibold"
                  title="Toggle password visibility"
                >
                  Show
                </button>
              </div>
            </div>

            <button 
              id="login-submit-btn" 
              type="submit" 
              class="btn btn-primary w-full text-xs py-2.5 font-bold shadow-sm justify-center"
            >
              Log In
            </button>
          </form>

          <!-- REGISTRATION LINK -->
          <div class="text-center pt-2 text-xs text-slate-600">
            Don't have an account yet? 
            <a 
              href="/register" 
              onclick="event.preventDefault(); window.App.navigate('/register')" 
              class="font-bold text-emerald-700 hover:underline ml-1"
            >
              Register New Household
            </a>
          </div>

        </div>

        <!-- 1-CLICK DEMO ACCOUNTS FOR HACKATHON JUDGES -->
        <div class="card p-6 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>Judge Demo Accounts</span>
                <span class="badge badge-emerald text-[9px] py-0 px-1.5 font-bold">1-Click</span>
              </div>
              <p class="text-[11px] text-slate-500 mt-0.5">Instant role evaluation without typing credentials:</p>
            </div>
            <div class="text-[10px] text-slate-400 font-mono">Password: documented in README</div>
          </div>

          <div class="space-y-2.5">
            <!-- Demo 1: Admin / Grid Operator -->
            <div 
              class="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 transition-all cursor-pointer flex items-center justify-between group"
              onclick="window.LoginView.loginDemo('admin')"
            >
              <div>
                <div class="text-xs font-bold text-slate-800 group-hover:text-emerald-700">
                  Grid System Operator <span class="badge badge-emerald text-[9px] ml-1">Admin</span>
                </div>
                <div class="text-[10px] text-slate-500">Full 24h simulation control, ledger audit & system oversight</div>
              </div>
              <button class="btn btn-secondary text-[11px] py-1 px-2.5 font-semibold group-hover:border-emerald-400">
                Login
              </button>
            </div>

            <!-- Demo 2: Seller / Prosumer -->
            <div class="p-3 rounded-xl border border-slate-200 space-y-2">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-xs font-bold text-slate-800">
                    Seller / Solar Prosumer <span class="badge badge-emerald text-[9px] ml-1">Surplus Exporter</span>
                  </div>
                  <div class="text-[10px] text-slate-500">Monetize rooftop solar above ₹2.00/kWh feed-in floor</div>
                </div>
              </div>
              <div class="flex flex-wrap gap-1.5 pt-1">
                ${sellerAccounts.map(a => `
                  <button onclick="window.LoginView.loginDemo('${a.id}')" class="btn btn-secondary text-[11px] py-1 px-2 hover:border-emerald-400 flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>${a.name} (${a.householdId})</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Demo 3: Buyer / Consumer -->
            <div class="p-3 rounded-xl border border-slate-200 space-y-2">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-xs font-bold text-slate-800">
                    Buyer / Energy Consumer <span class="badge badge-blue text-[9px] ml-1">Grid Importer</span>
                  </div>
                  <div class="text-[10px] text-slate-500">Procure clean solar to cut bills below ₹8.00/kWh retail tariff</div>
                </div>
              </div>
              <div class="flex flex-wrap gap-1.5 pt-1">
                ${buyerAccounts.map(a => `
                  <button onclick="window.LoginView.loginDemo('${a.id}')" class="btn btn-secondary text-[11px] py-1 px-2 hover:border-blue-400 flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    <span>${a.name} (${a.householdId})</span>
                  </button>
                `).join('')}
                ${bothAccounts.map(a => `
                  <button onclick="window.LoginView.loginDemo('${a.id}')" class="btn btn-secondary text-[11px] py-1 px-2 hover:border-amber-400 flex items-center gap-1.5" title="Prosumer (Both Buyer & Seller)">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <span>${a.name} (${a.householdId} • Both)</span>
                  </button>
                `).join('')}
              </div>
            </div>

          </div>
        </div>

      </div>

      <!-- PASSWORD RESET MODAL -->
      <div id="reset-password-modal" class="modal-backdrop hidden">
        <div class="modal-dialog p-6 space-y-4 max-w-md">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 class="text-xs font-bold text-slate-800">Reset Account Password</h3>
            <button onclick="window.LoginView.closeResetModal()" class="text-slate-400 hover:text-slate-600 text-sm font-bold">&times;</button>
          </div>
          <form onsubmit="window.LoginView.handlePasswordReset(event)" class="space-y-3">
            <div>
              <label class="input-label" for="reset-username">Username or Email Address</label>
              <input id="reset-username" type="text" required placeholder="Enter registered username or email" class="input-field text-xs" />
            </div>
            <div>
              <label class="input-label" for="reset-new-password">New Password</label>
              <input id="reset-new-password" type="password" minlength="6" required placeholder="At least 6 characters" class="input-field text-xs" />
            </div>
            <div>
              <label class="input-label" for="reset-confirm-password">Confirm New Password</label>
              <input id="reset-confirm-password" type="password" minlength="6" required placeholder="Re-enter new password" class="input-field text-xs" />
            </div>
            <div id="reset-alert" class="hidden"></div>
            <div class="flex items-center justify-end gap-2 pt-2">
              <button type="button" onclick="window.LoginView.closeResetModal()" class="btn btn-secondary text-xs">Cancel</button>
              <button type="submit" class="btn btn-primary text-xs">Reset Password</button>
            </div>
          </form>
        </div>
      </div>

      <!-- FIRST-TIME GOOGLE USER ROLE ONBOARDING MODAL -->
      <div id="google-role-modal" class="modal-backdrop hidden">
        <div class="modal-dialog p-6 space-y-4 max-w-lg">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-sm font-bold text-slate-800">Complete Your SolarShare Profile</h3>
              <p class="text-[11px] text-slate-500 mt-0.5" id="google-onboard-email">Google Account Verified</p>
            </div>
          </div>
          
          <form onsubmit="window.LoginView.submitGoogleRoleOnboarding(event)" class="space-y-4">
            <div>
              <label class="input-label mb-2">Select Your Household Energy Role <span class="text-red-500">*</span></label>
              <div class="grid grid-cols-2 gap-3">
                <label class="p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-blue-400 transition-all flex flex-col justify-between space-y-2 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50/30">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-800">BUYER (Consumer)</span>
                    <input type="radio" name="google-role" value="BUYER" checked onchange="window.LoginView.toggleGoogleCapacity(false)" />
                  </div>
                  <p class="text-[11px] text-slate-500">
                    "I need electricity and want to purchase available energy at a suitable price."
                  </p>
                </label>

                <label class="p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-emerald-400 transition-all flex flex-col justify-between space-y-2 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/30">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-800">SELLER (Prosumer)</span>
                    <input type="radio" name="google-role" value="SELLER" onchange="window.LoginView.toggleGoogleCapacity(true)" />
                  </div>
                  <p class="text-[11px] text-slate-500">
                    "I have surplus solar energy that I want to offer for trading."
                  </p>
                </label>
              </div>
            </div>

            <div>
              <label class="input-label" for="google-household-name">Household or Residence Name</label>
              <input id="google-household-name" type="text" placeholder="e.g. Green Meadows Residence" class="input-field text-xs" />
            </div>

            <div id="google-capacity-group" class="hidden">
              <label class="input-label" for="google-capacity">Rooftop Solar Capacity (kW)</label>
              <input id="google-capacity" type="number" step="0.5" min="1" max="50" value="5.0" class="input-field text-xs" />
            </div>

            <div id="google-onboard-alert" class="hidden"></div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <button type="submit" class="btn btn-primary text-xs w-full justify-center py-2 font-bold">
                Complete Setup & Enter SolarShare
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Initialize GIS if configured
    this.initGISIfAvailable();
  },

  initGISIfAvailable() {
    if (this._googleConfig && this._googleConfig.isConfigured && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: this._googleConfig.clientId,
          callback: (res) => this.handleGoogleCredentialResponse(res)
        });
      } catch (err) {
        console.warn('Google Identity Services initialization warning:', err.message);
      }
    }
  },

  handleGoogleClick() {
    if (!this._googleConfig || !this._googleConfig.isConfigured) {
      this.showAlert(
        `<strong>Google Sign-In Ready for Activation:</strong><br/>` +
        `To authenticate with live Google accounts, configure <code>GOOGLE_CLIENT_ID</code> in your <code>.env</code> file.<br/>` +
        `<span class="text-slate-600 mt-1 block">In the meantime, <strong>1-Click Judge Demo Accounts</strong> and <strong>Email/Password Login</strong> are fully functional below.</span>`,
        false
      );
      return;
    }

    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          this.showAlert('Google One Tap prompt was closed or not displayed. Please try again or use credentials.', true);
        }
      });
    } else {
      this.showAlert('Google Identity Services script is loading. Please try again in a moment.', true);
    }
  },

  async handleGoogleCredentialResponse(response) {
    const idToken = response.credential;
    if (!idToken) {
      this.showAlert('No credential received from Google.', true);
      return;
    }

    try {
      const res = await window.API.loginGoogle({ idToken });
      if (res.needsRoleSelection) {
        this._pendingGoogleAccount = res.googleAccount;
        this._pendingGoogleIdToken = idToken;
        this.openGoogleRoleModal(res.googleAccount);
      } else {
        window.API.setToken(res.token);
        window.App.currentUser = res.user;
        window.Toast.success(`Welcome back, ${res.user.name}!`);
        await window.App.navigate(window.App.getDefaultRoute ? window.App.getDefaultRoute() : '/login');
      }
    } catch (err) {
      this.showAlert(err.message, true);
    }
  },

  openGoogleRoleModal(account) {
    const modal = document.getElementById('google-role-modal');
    const emailEl = document.getElementById('google-onboard-email');
    const nameEl = document.getElementById('google-household-name');
    if (emailEl) emailEl.innerText = `${account.name} (${account.email})`;
    if (nameEl) nameEl.value = `${account.name}'s Solar Home`;
    if (modal) modal.classList.remove('hidden');
  },

  toggleGoogleCapacity(show) {
    const group = document.getElementById('google-capacity-group');
    if (group) {
      if (show) group.classList.remove('hidden');
      else group.classList.add('hidden');
    }
  },

  async submitGoogleRoleOnboarding(e) {
    e.preventDefault();
    const roleEl = document.querySelector('input[name="google-role"]:checked');
    const role = roleEl ? roleEl.value : 'BUYER';
    const householdName = document.getElementById('google-household-name').value;
    const capacity = document.getElementById('google-capacity').value;

    try {
      const res = await window.API.loginGoogle({
        idToken: this._pendingGoogleIdToken,
        role,
        householdName,
        solarCapacityKW: Number(capacity) || 0
      });

      const modal = document.getElementById('google-role-modal');
      if (modal) modal.classList.add('hidden');

      window.API.setToken(res.token);
      window.App.currentUser = res.user;
      window.Toast.success(res.message || 'Google account configured successfully!');
      await window.App.navigate(window.App.getDefaultRoute ? window.App.getDefaultRoute() : '/login');
    } catch (err) {
      const alertEl = document.getElementById('google-onboard-alert');
      if (alertEl) {
        alertEl.className = 'p-2 bg-red-50 text-red-700 text-xs rounded border border-red-200';
        alertEl.innerText = err.message;
        alertEl.classList.remove('hidden');
      }
    }
  },

  togglePassword() {
    const el = document.getElementById('login-password');
    if (el) {
      el.type = el.type === 'password' ? 'text' : 'password';
    }
  },

  showAlert(msg, isError = true) {
    const alertEl = document.getElementById('login-alert');
    if (alertEl) {
      alertEl.className = `p-3.5 rounded-xl text-xs leading-relaxed border ${isError ? 'bg-red-50 text-red-800 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`;
      alertEl.innerHTML = msg;
      alertEl.classList.remove('hidden');
    }
  },

  async handleCredentialsSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-submit-btn');

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="inline-block animate-spin mr-1">⟳</span> Authenticating...`;
    }

    try {
      const res = await window.API.loginCredentials(username, password);
      window.API.setToken(res.token);
      window.App.currentUser = res.user;
      window.Toast.success(`Welcome back, ${res.user.name}!`);
      await window.App.navigate(window.App.getDefaultRoute ? window.App.getDefaultRoute() : '/login');
    } catch (err) {
      this.showAlert(err.message, true);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `Log In to SolarShare &rarr;`;
      }
    }
  },

  async loginDemo(accountId) {
    try {
      const res = await window.API.login(accountId);
      window.API.setToken(res.token);
      window.App.currentUser = res.user;
      window.Toast.success(`Logged in as ${res.user.roleLabel} (${res.user.name})`);
      await window.App.navigate(window.App.getDefaultRoute ? window.App.getDefaultRoute() : '/login');
    } catch (err) {
      this.showAlert(`Demo login failed: ${err.message}`, true);
    }
  },

  openResetModal() {
    const modal = document.getElementById('reset-password-modal');
    if (modal) modal.classList.remove('hidden');
  },

  closeResetModal() {
    const modal = document.getElementById('reset-password-modal');
    if (modal) modal.classList.add('hidden');
  },

  async handlePasswordReset(e) {
    e.preventDefault();
    const username = document.getElementById('reset-username').value;
    const newPassword = document.getElementById('reset-new-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;
    const alertEl = document.getElementById('reset-alert');

    if (newPassword !== confirmPassword) {
      alertEl.className = 'p-2 bg-red-50 text-red-700 text-xs rounded border border-red-200';
      alertEl.innerText = 'Passwords do not match.';
      alertEl.classList.remove('hidden');
      return;
    }

    try {
      const res = await window.API.resetPassword(username, newPassword);
      this.closeResetModal();
      window.Toast.success(res.message);
      this.showAlert(`Password reset successfully. You may now log in with your new password.`, false);
    } catch (err) {
      alertEl.className = 'p-2 bg-red-50 text-red-700 text-xs rounded border border-red-200';
      alertEl.innerText = err.message;
      alertEl.classList.remove('hidden');
    }
  }
};
