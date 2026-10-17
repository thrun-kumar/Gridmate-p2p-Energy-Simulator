/**
 * SolarShare - Dedicated Registration Page Component (/register)
 * Features standalone registration layout, role selection with required explanations,
 * client & server validation, PBKDF2 password hashing, and auto-login redirection.
 */

window.RegisterView = {
  async render() {
    const authRoot = document.getElementById('auth-view-container');
    if (!authRoot) return;

    authRoot.innerHTML = `
      <div class="max-w-xl w-full mx-auto space-y-6">

        <!-- REGISTRATION CARD -->
        <div class="card p-6 sm:p-8 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-6">
          
          <!-- BRAND HEADER -->
          <div class="text-center space-y-2">
            <div class="inline-flex w-12 h-12 rounded-xl bg-emerald-700 text-white items-center justify-center text-lg font-black tracking-wider shadow-sm mb-1 font-mono">
              SS
            </div>
            <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-[#064e3b]">
              Join Solar<span class="text-emerald-600">Share</span>
            </h1>
            <p class="text-xs font-bold text-emerald-800 tracking-wider uppercase">
              Trade Clean Energy. Save Money. Power Your Community.
            </p>
            <p class="text-xs text-slate-500 max-w-md mx-auto leading-relaxed pt-1">
              Register your household or prosumer residence to begin peer-to-peer energy trading with your local clean energy community.
            </p>
          </div>

          <!-- FEEDBACK ALERT -->
          <div id="register-alert" class="hidden"></div>

          <!-- REGISTRATION FORM -->
          <form id="register-form" onsubmit="window.RegisterView.handleSubmit(event)" class="space-y-4">
            
            <!-- ROLE SELECTION WITH REQUIRED EXPLANATIONS -->
            <div>
              <label class="input-label mb-2">Account Type / Household Role <span class="text-red-500">*</span></label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <!-- Buyer Option -->
                <label class="p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:border-blue-400 transition-all flex flex-col justify-between space-y-2 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50/30">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-800">1. BUYER (Consumer)</span>
                    <input 
                      type="radio" 
                      name="register-role" 
                      value="BUYER" 
                      checked 
                      onchange="window.RegisterView.handleRoleChange(this.value)" 
                      class="text-blue-600" 
                    />
                  </div>
                  <p class="text-[11px] text-slate-600 leading-normal">
                    "I need electricity and want to purchase available energy at a suitable price."
                  </p>
                  <div class="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full w-fit">
                    No solar panels required
                  </div>
                </label>

                <!-- Seller Option -->
                <label class="p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:border-emerald-400 transition-all flex flex-col justify-between space-y-2 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/30">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-800">2. SELLER (Prosumer)</span>
                    <input 
                      type="radio" 
                      name="register-role" 
                      value="SELLER" 
                      onchange="window.RegisterView.handleRoleChange(this.value)" 
                      class="text-emerald-600" 
                    />
                  </div>
                  <p class="text-[11px] text-slate-600 leading-normal">
                    "I have surplus solar energy that I want to offer for trading."
                  </p>
                </label>
              </div>

              <!-- Optional Prosumer Both Choice -->
              <div class="pt-2">
                <label class="p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:border-amber-400 transition-all flex items-center justify-between has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50/30">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-slate-800">3. PROSUMER (Both Buy & Sell)</span>
                    <span class="text-[10px] text-slate-500">— Solar exporter midday, grid buyer evening</span>
                  </div>
                  <input 
                    type="radio" 
                    name="register-role" 
                    value="BOTH" 
                    onchange="window.RegisterView.handleRoleChange(this.value)" 
                    class="text-amber-600" 
                  />
                </label>
              </div>
            </div>

            <!-- NAME & EMAIL -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label class="input-label" for="reg-fullname">Full Name or Household Name <span class="text-red-500">*</span></label>
                <input 
                  id="reg-fullname" 
                  type="text" 
                  required 
                  placeholder="e.g. Lotus Green Residency" 
                  class="input-field text-xs" 
                />
              </div>

              <div>
                <label class="input-label" for="reg-email">Email Address <span class="text-red-500">*</span></label>
                <input 
                  id="reg-email" 
                  type="email" 
                  required 
                  placeholder="e.g. user@solarshare.energy" 
                  class="input-field text-xs" 
                />
              </div>
            </div>

            <!-- USERNAME & SOLAR CAPACITY (Conditional) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label class="input-label" for="reg-username">Username <span class="text-red-500">*</span></label>
                <input 
                  id="reg-username" 
                  type="text" 
                  required 
                  minlength="3" 
                  placeholder="e.g. lotus_user" 
                  class="input-field text-xs" 
                />
              </div>

              <div id="reg-solar-capacity-group" class="hidden">
                <label class="input-label" for="reg-solar-capacity">Rooftop Solar Capacity (kW)</label>
                <input 
                  id="reg-solar-capacity" 
                  type="number" 
                  step="0.5" 
                  min="1" 
                  max="50" 
                  value="6.0" 
                  placeholder="e.g. 6.0 kW" 
                  class="input-field text-xs" 
                />
              </div>
            </div>

            <!-- GRID NETWORK SUBSTATION / ZONE -->
            <div>
              <label class="input-label" for="reg-zone">Grid Network Zone / Intertie Substation <span class="text-red-500">*</span></label>
              <select id="reg-zone" class="input-field text-xs bg-white cursor-pointer font-medium text-slate-700">
                <option value="ZONE-A" selected>ZONE-A — North Substation (Residential Prosumers, 50 kW Capacity)</option>
                <option value="ZONE-B">ZONE-B — Central Substation (Commercial Consumers, 60 kW Capacity)</option>
                <option value="ZONE-C">ZONE-C — South Substation (Mixed Load Community, 45 kW Capacity)</option>
              </select>
              <p class="text-[10px] text-slate-500 mt-1">
                Connected via simulated distribution lines. Power wheeling and delivery losses calculated automatically.
              </p>
            </div>

            <!-- PASSWORD & CONFIRM PASSWORD -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label class="input-label" for="reg-password">Password (min 6 characters) <span class="text-red-500">*</span></label>
                <div class="relative">
                  <input 
                    id="reg-password" 
                    type="password" 
                    required 
                    minlength="6" 
                    placeholder="Create secure password" 
                    class="input-field text-xs pr-14" 
                  />
                  <button 
                    type="button" 
                    onclick="window.RegisterView.toggleVisibility('reg-password')"
                    class="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-[11px] font-semibold"
                  >
                    Show
                  </button>
                </div>
              </div>

              <div>
                <label class="input-label" for="reg-confirm-password">Confirm Password <span class="text-red-500">*</span></label>
                <div class="relative">
                  <input 
                    id="reg-confirm-password" 
                    type="password" 
                    required 
                    minlength="6" 
                    placeholder="Re-enter password" 
                    class="input-field text-xs pr-14" 
                  />
                  <button 
                    type="button" 
                    onclick="window.RegisterView.toggleVisibility('reg-confirm-password')"
                    class="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-[11px] font-semibold"
                  >
                    Show
                  </button>
                </div>
              </div>
            </div>

            <!-- SUBMIT BUTTON -->
            <button 
              id="register-submit-btn" 
              type="submit" 
              class="btn btn-primary w-full text-xs py-2.5 font-bold shadow-sm justify-center mt-2"
            >
              Create Account
            </button>
          </form>

          <!-- LOGIN LINK -->
          <div class="text-center pt-2 text-xs text-slate-600">
            Already have an account? 
            <a 
              href="/login" 
              onclick="event.preventDefault(); window.App.navigate('/login')" 
              class="font-bold text-emerald-700 hover:underline ml-1"
            >
              Log In
            </a>
          </div>

        </div>

      </div>
    `;
  },

  handleRoleChange(role) {
    const group = document.getElementById('reg-solar-capacity-group');
    if (group) {
      if (role === 'SELLER' || role === 'BOTH') {
        group.classList.remove('hidden');
      } else {
        group.classList.add('hidden');
      }
    }
  },

  toggleVisibility(fieldId) {
    const el = document.getElementById(fieldId);
    if (el) {
      el.type = el.type === 'password' ? 'text' : 'password';
    }
  },

  showAlert(msg, isError = true) {
    const alertEl = document.getElementById('register-alert');
    if (alertEl) {
      alertEl.className = `p-3.5 rounded-xl text-xs leading-relaxed border ${isError ? 'bg-red-50 text-red-800 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`;
      alertEl.innerHTML = msg;
      alertEl.classList.remove('hidden');
    }
  },

  async handleSubmit(e) {
    e.preventDefault();
    const roleEl = document.querySelector('input[name="register-role"]:checked');
    const role = roleEl ? roleEl.value : 'BUYER';
    const fullName = document.getElementById('reg-fullname').value;
    const email = document.getElementById('reg-email').value;
    const username = document.getElementById('reg-username').value;
    const capacityEl = document.getElementById('reg-solar-capacity');
    const solarCapacityKW = capacityEl ? capacityEl.value : 0;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    const btn = document.getElementById('register-submit-btn');

    const zoneEl = document.getElementById('reg-zone');
    const zone = zoneEl ? zoneEl.value : 'ZONE-A';

    // Password Match Validation
    if (password !== confirmPassword) {
      this.showAlert('Passwords do not match. Please verify and re-enter.', true);
      return;
    }

    if (password.length < 6) {
      this.showAlert('Password must be at least 6 characters long.', true);
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="inline-block animate-spin mr-1">⟳</span> Creating account...`;
    }

    try {
      const res = await window.API.register({
        username,
        email,
        password,
        role,
        householdName: fullName,
        solarCapacityKW: Number(solarCapacityKW) || 0,
        zone
      });

      window.API.setToken(res.token);
      window.App.currentUser = res.user;
      window.Toast.success(res.message);

      // Redirect to the appropriate role dashboard
      await window.App.navigate(window.App.getDefaultRoute ? window.App.getDefaultRoute() : '/login');
    } catch (err) {
      this.showAlert(err.message, true);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `Create Account & Enter SolarShare &rarr;`;
      }
    }
  }
};
