/**
 * SolarShare - Top Header & Simulation Controls Component
 * Displays role badge, simulation clock, demo account switcher, admin simulation controls,
 * and the 9-point Results Summary modal after simulation runs.
 */

window.Header = {
  render(statusData) {
    const headerEl = document.getElementById('app-header');
    if (!headerEl) return;

    const user = window.App.currentUser;
    const currentRoute = window.App.currentRoute || window.location.pathname;
    const isAuthPage = user ? (window.App.isAuthRoute ? window.App.isAuthRoute(currentRoute) : false) : true;

    // Minimal clean branding header when on login/register or unauthenticated
    if (!user || isAuthPage) {
      headerEl.innerHTML = `
        <div class="bg-emerald-50/90 border-b border-emerald-100 px-4 py-1.5 text-center text-[11px] text-emerald-800 font-medium tracking-wide flex items-center justify-center gap-2">
          <span class="inline-block w-2 h-2 rounded-full bg-emerald-600"></span>
          <span>Educational simulation for UN SDG 7: Affordable and Clean Energy.</span>
        </div>
        <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-3 cursor-pointer" onclick="window.App.navigate(window.App.currentUser ? (window.App.getDefaultRoute ? window.App.getDefaultRoute() : '/login') : '/login')">
            <div class="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-white shadow-sm font-black text-xs font-mono">
              SS
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-base font-extrabold tracking-tight text-slate-900">Solar<span class="text-emerald-600">Share</span></span>
                <span class="badge badge-emerald text-[10px] uppercase font-bold py-0 px-2">SDG 7 Clean Energy</span>
              </div>
              <p class="text-[10px] text-slate-500 font-medium">Trade Clean Energy. Save Money. Power Your Community.</p>
            </div>
          </div>
          <div class="flex items-center gap-2 text-xs">
            ${user ? `
              <span class="text-slate-600 font-medium mr-1 hidden sm:inline">Signed in as <strong>${user.name}</strong></span>
              <button onclick="window.App.navigate(window.App.getDefaultRoute ? window.App.getDefaultRoute() : '/seller/dashboard')" class="btn btn-secondary text-xs py-1.5 px-3 font-semibold">Dashboard</button>
              <button onclick="window.App.logout()" class="btn text-xs py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold">
                Log Out
              </button>
            ` : `
              <a href="/login" onclick="event.preventDefault(); window.App.navigate('/login')" class="font-bold text-slate-600 hover:text-emerald-700 px-3 py-1.5">Log In</a>
              <a href="/register" onclick="event.preventDefault(); window.App.navigate('/register')" class="btn btn-primary text-xs py-1.5 px-3.5 font-bold">Register Household</a>
            `}
          </div>
        </div>
      `;
      return;
    }

    const isAdmin = user.role === 'ADMIN';

    const hourNum = statusData ? statusData.currentHour : 10;
    const minuteNum = statusData ? (statusData.currentMinute || 0) : 0;
    const timeStr = statusData?.simulatedTime || `${String(hourNum % 12 === 0 ? 12 : hourNum % 12)}:${String(minuteNum).padStart(2, '0')} ${hourNum >= 12 ? 'PM' : 'AM'}`;
    const dateLabel = statusData?.simulatedDateLabel || '15 October 2026';
    const hourProgressLabel = statusData?.hourProgressLabel || `Hour ${hourNum} of 24`;
    const isRunning = Boolean(statusData?.isRunning);
    const autoMatchingEnabled = statusData ? statusData.autoMatchingEnabled !== false : true;
    const speedSec = statusData?.autoSpeedSeconds || 10;
    const activeScenario = statusData?.activeScenario || 'SUNNY_DAY';
    const scenarioShortName = activeScenario === 'SUNNY_DAY' ? 'Sunny Day' : (activeScenario === 'MONSOON_OVERCAST' ? 'Monsoon' : (activeScenario === 'HEATWAVE_PEAK' ? 'Heatwave' : 'Route Down'));

    let roleBadgeClass = 'badge-emerald';
    if (user.role === 'BUYER') roleBadgeClass = 'badge-blue';
    if (user.role === 'BOTH') roleBadgeClass = 'badge-amber';

    headerEl.innerHTML = `
      <!-- Top Navigation & Control Bar -->
      <div class="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <!-- Logo & Branding -->
        <div class="flex items-center gap-3 cursor-pointer" onclick="window.App.navigate(window.App.getDefaultRoute ? window.App.getDefaultRoute() : '/login')">
          <div class="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-white shadow-sm font-black text-xs font-mono">
            SS
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-base font-extrabold tracking-tight text-slate-900">Solar<span class="text-emerald-600">Share</span></span>
              <span class="badge ${roleBadgeClass} text-[10px] uppercase font-bold py-0 px-2">
                ${user.roleLabel || user.role}
              </span>
            </div>
            <p class="text-[10px] text-slate-500 font-medium">Trade Clean Energy. Save Money. Power Your Community.</p>
          </div>
        </div>

        <!-- Simulated Clock & Market Interval Badge -->
        <div class="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
          <div class="flex items-center gap-1.5">
            <span class="text-slate-500 font-medium">Simulation date:</span>
            <span class="font-bold text-slate-800">${dateLabel}</span>
          </div>
          <span class="text-slate-300">|</span>
          <div class="flex items-center gap-1.5">
            <span class="text-slate-500 font-medium">Simulated time:</span>
            <span class="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">${timeStr}</span>
          </div>
          <span class="text-slate-300">|</span>
          <div class="flex items-center gap-1.5">
            <span class="text-slate-500 font-medium">Simulation hour:</span>
            <span class="font-bold text-slate-800">${hourProgressLabel}</span>
          </div>
          <span class="text-slate-300">|</span>
          <div class="flex items-center gap-1.5">
            <span class="text-slate-500 font-medium">Status:</span>
            ${isRunning ? `
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span> Running
              </span>
            ` : `
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Paused
              </span>
            `}
          </div>
          <span class="text-slate-300">|</span>
          <div class="flex items-center gap-1.5" title="${statusData?.scenarioDetails?.description || 'Active Simulation Scenario'}">
            <span class="text-slate-500 font-medium">Scenario:</span>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${activeScenario === 'SUNNY_DAY' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-900 border border-amber-300'}">
              ${scenarioShortName}
            </span>
          </div>
        </div>

        <!-- Master Simulation Controls (Admin Only) & Account Controls -->
        <div class="flex flex-wrap items-center gap-2">
          ${isAdmin ? `
            <!-- Speed Selector -->
            <div class="flex items-center gap-1 text-[11px] text-slate-600">
              <span class="hidden xl:inline text-slate-400">Speed:</span>
              <select id="sim-speed-select" onchange="window.App.changeSimulationSpeed(this.value)" class="text-xs bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-700 font-medium" title="Demonstration speed">
                <option value="5" ${speedSec === 5 ? 'selected' : ''}>5s / hr</option>
                <option value="10" ${speedSec === 10 ? 'selected' : ''}>10s / hr</option>
                <option value="15" ${speedSec === 15 ? 'selected' : ''}>15s / hr</option>
              </select>
            </div>

            <!-- Automatic Mode: Play / Pause -->
            <button 
              id="btn-toggle-simulation" 
              onclick="window.App.toggleAutoSimulation()" 
              class="btn text-xs py-1.5 px-3 font-bold transition-all shadow-sm ${isRunning ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300' : 'btn-primary'}" 
              title="${isRunning ? 'Pause automatic simulation' : 'Start automatic simulation timer'}"
            >
              ${isRunning ? 'Pause' : 'Play'}
            </button>

            <!-- Advance 1 Hour -->
            <button 
              id="btn-advance-hour" 
              onclick="window.App.advanceHour()" 
              class="btn btn-secondary text-xs py-1.5 px-2.5 font-semibold text-slate-700" 
              title="Advance simulation by exactly one hour"
            >
              Advance 1 Hour
            </button>

            <!-- Advance 15 Minutes -->
            <button 
              id="btn-advance-15" 
              onclick="window.App.advance15Minutes()" 
              class="btn btn-secondary text-xs py-1.5 px-2.5 font-semibold text-slate-700" 
              title="Advance simulation by 15 minutes"
            >
              Advance 15 Min
            </button>

            <!-- Auto-Matching Toggle -->
            <label class="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-1 cursor-pointer" title="When ON, matching runs automatically as time advances">
              <input 
                type="checkbox" 
                id="toggle-auto-matching" 
                ${autoMatchingEnabled ? 'checked' : ''} 
                onchange="window.App.toggleAutoMatching(this.checked)"
                class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Auto-Match</span>
            </label>

            <!-- Match Available Orders (Dedicated Button) -->
            <button 
              id="btn-match-orders" 
              onclick="window.App.matchAvailableOrders()" 
              class="btn btn-secondary text-xs py-1.5 px-2.5 font-bold text-emerald-800 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 shadow-xs" 
              title="Match open offers and bids immediately"
            >
              Match Orders
            </button>

            <!-- Full-Day Mode: Run Full 24 Hours -->
            <button 
              id="btn-run-simulation" 
              onclick="window.App.runSimulation()" 
              class="btn btn-secondary text-xs py-1.5 px-2.5 font-semibold text-slate-700 hover:text-slate-900" 
              title="Run complete 24-hour simulation demonstration"
            >
              Run Full 24 Hours
            </button>

            <!-- Scenario Selector & Apply Action -->
            <div class="flex items-center gap-1 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
              <span class="hidden xl:inline text-slate-400 font-medium">Scenario:</span>
              <select id="sim-scenario-select" class="text-xs bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-700 font-semibold" title="Select weather or grid contingency scenario">
                <option value="SUNNY_DAY" ${activeScenario === 'SUNNY_DAY' ? 'selected' : ''}>Sunny Day (95% Solar)</option>
                <option value="MONSOON_OVERCAST" ${activeScenario === 'MONSOON_OVERCAST' ? 'selected' : ''}>Monsoon Overcast (30% Solar)</option>
                <option value="HEATWAVE_PEAK" ${activeScenario === 'HEATWAVE_PEAK' ? 'selected' : ''}>Heatwave Peak (+40% Demand)</option>
                <option value="ROUTE_FAILURE" ${activeScenario === 'ROUTE_FAILURE' ? 'selected' : ''}>Route Failure (Zone A-B Cut)</option>
              </select>
              <button 
                id="btn-apply-scenario" 
                onclick="window.App.applyScenarioFromSelect()" 
                class="btn btn-secondary text-xs py-1 px-2 font-bold text-slate-800 border-slate-300 hover:bg-slate-100" 
                title="Apply selected scenario"
              >
                Apply
              </button>
            </div>

            <!-- Reset Demo to Initial State -->
            <button 
              id="btn-reset-simulation" 
              onclick="window.App.resetSimulation()" 
              class="btn btn-secondary text-xs py-1.5 px-2 text-slate-500 hover:text-slate-800" 
              title="Reset simulation to 10:00 AM initial daytime demonstration state"
            >
              Reset Demo
            </button>
          ` : ''}

          <!-- Active User Badge -->
          <div class="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
            <span class="w-2 h-2 rounded-full ${user.role === 'ADMIN' ? 'bg-purple-500' : (user.role === 'SELLER' ? 'bg-emerald-500' : 'bg-blue-500')}"></span>
            <span class="font-bold text-slate-800 truncate max-w-[120px]">${user.name}</span>
            <span class="text-slate-400">(${user.householdId || user.role})</span>
          </div>

          <!-- Switch Account Button -->
          <button onclick="window.Header.openAccountSwitcherModal()" class="btn btn-secondary text-xs py-1.5 px-2.5 border-slate-200 text-slate-700 hover:border-slate-300" title="Switch Demo Account">
            Switch Role
          </button>

          <!-- PROMINENT LOGOUT BUTTON -->
          <button 
            id="btn-header-logout"
            onclick="window.App.logout()" 
            class="btn text-xs py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 hover:border-rose-300 font-bold transition-all shadow-sm" 
            title="Log out of SolarShare"
          >
            Log Out
          </button>
        </div>
      </div>

      <!-- Account Switcher Modal Placeholder -->
      <div id="account-switcher-container"></div>
      <!-- 9-Point Simulation Results Summary Modal Placeholder -->
      <div id="simulation-summary-modal-container"></div>
      <!-- Scenario Impact Summary Modal Placeholder -->
      <div id="scenario-modal-container"></div>
    `;
  },

  async openAccountSwitcherModal() {
    const container = document.getElementById('account-switcher-container');
    if (!container) return;

    let accounts = [];
    try {
      const data = await window.API.getDemoAccounts();
      accounts = data.accounts || [];
    } catch (e) {
      accounts = [];
    }

    const adminList = accounts.filter(a => a.role === 'ADMIN');
    const sellerList = accounts.filter(a => a.role === 'SELLER');
    const buyerList = accounts.filter(a => a.role === 'BUYER' && a.id !== 'prosumer_hh04');

    const renderAccCard = acc => `
      <div 
        onclick="window.Header.switchToAccount('${acc.id}')"
        class="p-2.5 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 cursor-pointer flex items-center justify-between transition-all"
      >
        <div>
          <div class="text-xs font-bold text-slate-800">${acc.name}</div>
          <div class="text-[10px] text-slate-500">${acc.roleLabel} ${acc.householdId ? `• <span class="font-mono text-emerald-800 font-semibold">${acc.householdId}</span>` : ''}</div>
        </div>
        <button class="btn btn-secondary text-[11px] py-1 px-2.5 font-medium">Select</button>
      </div>
    `;

    container.innerHTML = `
      <div class="modal-backdrop" onclick="window.Header.closeAccountSwitcherModal(event)">
        <div class="modal-dialog p-6 space-y-4 max-w-lg" onclick="event.stopPropagation()">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wide">1-Click Account & Role Switcher</h3>
              <p class="text-[11px] text-slate-500">Switch between the 12 demonstration participants and grid operator</p>
            </div>
            <button onclick="window.Header.closeAccountSwitcherModal()" class="text-slate-400 hover:text-slate-600 text-sm font-bold">&times;</button>
          </div>

          <div class="space-y-3.5 max-h-96 overflow-y-auto pr-1">
            <!-- Operator -->
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-purple-700 block mb-1.5">Marketplace Operator</span>
              <div class="space-y-1.5">
                ${adminList.map(renderAccCard).join('')}
              </div>
            </div>

            <!-- Solar Sellers -->
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1.5">Solar Prosumers (${sellerList.length} Sellers with Rooftop Solar)</span>
              <div class="space-y-1.5">
                ${sellerList.map(renderAccCard).join('')}
              </div>
            </div>

            <!-- Grid Buyers -->
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-blue-700 block mb-1.5">Grid Consumers (${buyerList.length} Buyers — Solar Not Required)</span>
              <div class="space-y-1.5">
                ${buyerList.map(renderAccCard).join('')}
              </div>
            </div>
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button 
              type="button"
              onclick="window.Header.closeAccountSwitcherModal(); window.App.logout();" 
              class="btn text-xs py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 hover:border-rose-300 font-bold"
            >
              Log Out
            </button>
            <button onclick="window.Header.closeAccountSwitcherModal()" class="btn btn-secondary text-xs">Cancel</button>
          </div>
        </div>
      </div>
    `;
  },

  closeAccountSwitcherModal() {
    const container = document.getElementById('account-switcher-container');
    if (container) container.innerHTML = '';
  },

  async switchToAccount(accountId) {
    try {
      const res = await window.API.login(accountId);
      window.API.setToken(res.token);
      window.App.currentUser = res.user;
      this.closeAccountSwitcherModal();
      window.Toast.success(`Switched role to ${res.user.roleLabel} (${res.user.name})`);
      await window.App.navigate(window.App.getDefaultRoute());
    } catch (err) {
      window.Toast.error(`Could not switch account: ${err.message}`);
    }
  },

  /**
   * Displays the comprehensive 9-point Results Summary after simulation execution.
   */
  showSimulationResultsModal(summary) {
    const container = document.getElementById('simulation-summary-modal-container');
    if (!container || !summary) return;

    container.innerHTML = `
      <div class="modal-backdrop" onclick="window.Header.closeSimulationResultsModal(event)">
        <div class="modal-dialog p-6 space-y-4 max-w-2xl" onclick="event.stopPropagation()">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-xs font-bold text-slate-800">Simulation Run Results Summary</h3>
              <span class="text-[10px] font-mono text-slate-400">Run Ref: ${summary.runId} • ${new Date(summary.timestamp).toLocaleTimeString()}</span>
            </div>
            <button onclick="window.Header.closeSimulationResultsModal()" class="text-slate-400 hover:text-slate-600 text-sm font-bold">&times;</button>
          </div>

          <!-- 9-Point Mandatory Hackathon KPI Grid -->
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <!-- 1. Total Generated -->
            <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span class="text-[10px] uppercase font-bold text-slate-400">1. Total Generated</span>
              <div class="font-bold text-slate-800 text-sm mt-0.5">${summary.totalEnergyGeneratedKWh.toFixed(1)} kWh</div>
            </div>

            <!-- 2. Total Consumed -->
            <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span class="text-[10px] uppercase font-bold text-slate-400">2. Total Consumed</span>
              <div class="font-bold text-slate-800 text-sm mt-0.5">${summary.totalEnergyConsumedKWh.toFixed(1)} kWh</div>
            </div>

            <!-- 3. Available Surplus -->
            <div class="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
              <span class="text-[10px] uppercase font-bold text-emerald-700">3. Available Surplus</span>
              <div class="font-bold text-emerald-800 text-sm mt-0.5">${summary.totalSurplusAvailableKWh.toFixed(1)} kWh</div>
            </div>

            <!-- 4. Total Traded -->
            <div class="p-2.5 rounded-lg bg-blue-50 border border-blue-200">
              <span class="text-[10px] uppercase font-bold text-blue-700">4. Energy Traded</span>
              <div class="font-bold text-blue-800 text-sm mt-0.5">${summary.totalEnergyTradedKWh.toFixed(1)} kWh</div>
            </div>

            <!-- 5. Number of Matched Trades -->
            <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span class="text-[10px] uppercase font-bold text-slate-400">5. Matched Trades</span>
              <div class="font-bold text-slate-800 text-sm mt-0.5">${summary.matchedTradesCount} settled</div>
            </div>

            <!-- 6. Average Agreed Trading Price -->
            <div class="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
              <span class="text-[10px] uppercase font-bold text-emerald-700">6. Avg Trade Price</span>
              <div class="font-bold text-emerald-800 text-sm mt-0.5">₹${summary.averageAgreedTradingPriceINR.toFixed(2)}/kWh</div>
            </div>

            <!-- 7. Total Buyer Savings -->
            <div class="p-2.5 rounded-lg bg-emerald-100/60 border border-emerald-300 col-span-2 sm:col-span-1">
              <span class="text-[10px] uppercase font-bold text-emerald-800">7. Buyer Savings</span>
              <div class="font-bold text-emerald-900 text-sm mt-0.5">₹${summary.totalBuyerSavingsINR.toFixed(2)}</div>
            </div>

            <!-- 9. Ledger Verification Status -->
            <div class="p-2.5 rounded-lg ${summary.ledgerVerification.isValid ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'} col-span-2">
              <span class="text-[10px] uppercase font-bold ${summary.ledgerVerification.isValid ? 'text-emerald-700' : 'text-red-700'}">9. Ledger Integrity Status</span>
              <div class="font-bold text-xs mt-0.5 flex items-center gap-1.5 ${summary.ledgerVerification.isValid ? 'text-emerald-800' : 'text-red-800'}">
                <span class="badge ${summary.ledgerVerification.isValid ? 'badge-verified' : 'badge-rejected'}">${summary.ledgerVerification.isValid ? 'Verified' : 'Tamper Detected'}</span>
                <span class="text-[10px] font-normal">(${summary.ledgerVerification.verifiedCount} blocks verified)</span>
              </div>
            </div>
          </div>

          <!-- 8. Household-wise Savings Table Preview -->
          <div class="space-y-1.5 pt-1">
            <div class="text-[11px] font-bold text-slate-700 uppercase tracking-wider">8. Household-wise Savings Breakdown</div>
            <div class="table-wrapper max-h-48 overflow-y-auto">
              <table class="grid-table text-[11px]">
                <thead>
                  <tr>
                    <th>Household</th>
                    <th>Role</th>
                    <th>Bought</th>
                    <th>Sold</th>
                    <th>Buyer Savings</th>
                    <th>Seller Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  ${(summary.householdWiseSavings || []).slice(0, 8).map(h => `
                    <tr>
                      <td class="font-semibold text-slate-800">${h.name} (${h.id})</td>
                      <td><span class="badge ${h.role === 'Buyer' ? 'badge-blue' : 'badge-emerald'} text-[9px]">${h.role}</span></td>
                      <td class="font-mono">${h.energyBoughtKWh.toFixed(1)} kWh</td>
                      <td class="font-mono">${h.energySoldKWh.toFixed(1)} kWh</td>
                      <td class="font-mono text-emerald-700 font-bold">₹${h.buyerSavingsINR.toFixed(2)}</td>
                      <td class="font-mono text-slate-800 font-bold">₹${h.sellerRevenueINR.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="flex items-center justify-between pt-3 border-t border-slate-100">
            <button onclick="window.API.downloadLedgerCSV()" class="btn btn-secondary text-xs">
              Export Ledger CSV
            </button>
            <button onclick="window.Header.closeSimulationResultsModal()" class="btn btn-primary text-xs">
              Close Summary
            </button>
          </div>
        </div>
      </div>
    `;
  },

  closeSimulationResultsModal() {
    const container = document.getElementById('simulation-summary-modal-container');
    if (container) container.innerHTML = '';
  },

  showScenarioImpactModal(result) {
    const container = document.getElementById('scenario-modal-container');
    if (!container) return;

    const b = result.before || {};
    const a = result.after || {};
    const imp = result.impactSummary || {};

    const formatDelta = (val, unit = '') => {
      if (val === undefined || val === null || isNaN(val)) return '—';
      const sign = val > 0 ? '+' : '';
      const color = val > 0 ? 'text-amber-700 font-bold' : (val < 0 ? 'text-blue-700 font-bold' : 'text-slate-500');
      return `<span class="${color}">(${sign}${val} ${unit})</span>`;
    };

    container.innerHTML = `
      <div class="modal-backdrop flex items-center justify-center p-4">
        <div class="card bg-white max-w-xl w-full p-6 shadow-2xl space-y-4 border border-slate-300">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-extrabold text-slate-900">Scenario Applied: ${result.scenarioName}</h3>
                <span class="badge ${result.isContingency ? 'badge-amber' : 'badge-emerald'} text-[10px] font-bold uppercase">
                  ${result.scenarioBadge}
                </span>
              </div>
              <p class="text-xs text-slate-500 mt-1">${result.description}</p>
            </div>
            <button onclick="window.Header.closeScenarioImpactModal()" class="text-slate-400 hover:text-slate-600 font-bold text-lg px-2">✕</button>
          </div>

          <!-- Impact Metrics Grid -->
          <div class="space-y-2 text-xs">
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Before vs. After Simulation Impact (Hour ${result.currentHourLabel})</div>
            
            <div class="grid grid-cols-2 gap-2.5">
              <!-- Solar Generation -->
              <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div class="text-slate-500 font-medium text-[11px]">Solar Generation</div>
                <div class="text-sm font-bold font-mono text-slate-800 mt-0.5">
                  ${b.totalSolarGenKWh} → <span class="text-emerald-700">${a.totalSolarGenKWh} kWh</span>
                </div>
                <div class="text-[10px] mt-0.5">${formatDelta(imp.solarGenDeltaKWh, 'kWh')}</div>
              </div>

              <!-- Household Demand -->
              <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div class="text-slate-500 font-medium text-[11px]">Household Demand</div>
                <div class="text-sm font-bold font-mono text-slate-800 mt-0.5">
                  ${b.totalDemandKWh} → <span class="text-slate-900">${a.totalDemandKWh} kWh</span>
                </div>
                <div class="text-[10px] mt-0.5">${formatDelta(imp.demandDeltaKWh, 'kWh')}</div>
              </div>

              <!-- Available Surplus -->
              <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div class="text-slate-500 font-medium text-[11px]">Available Surplus</div>
                <div class="text-sm font-bold font-mono text-slate-800 mt-0.5">
                  ${b.availableSurplusKWh} → <span class="text-emerald-600">${a.availableSurplusKWh} kWh</span>
                </div>
                <div class="text-[10px] mt-0.5">${formatDelta(imp.surplusDeltaKWh, 'kWh')}</div>
              </div>

              <!-- Unmet Local Deficit -->
              <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div class="text-slate-500 font-medium text-[11px]">Unmet Local Deficit</div>
                <div class="text-sm font-bold font-mono text-slate-800 mt-0.5">
                  ${b.unmetDemandKWh} → <span class="text-amber-700">${a.unmetDemandKWh} kWh</span>
                </div>
                <div class="text-[10px] mt-0.5">${formatDelta(imp.deficitDeltaKWh, 'kWh')}</div>
              </div>

              <!-- Recommended Price -->
              <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div class="text-slate-500 font-medium text-[11px]">Recommended Price</div>
                <div class="text-sm font-bold font-mono text-slate-800 mt-0.5">
                  ₹${Number(b.recommendedPriceINR).toFixed(2)} → <span class="text-sky-700">₹${Number(a.recommendedPriceINR).toFixed(2)}/kWh</span>
                </div>
                <div class="text-[10px] mt-0.5">${formatDelta(imp.priceDeltaINR, '₹')}</div>
              </div>

              <!-- Route A-B Status -->
              <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div class="text-slate-500 font-medium text-[11px]">Grid Route A-B (Intertie)</div>
                <div class="text-sm font-bold font-mono mt-0.5">
                  <span class="${a.routeStatusAB === 'CONNECTED' ? 'text-emerald-700' : 'text-rose-700 font-bold'}">${a.routeStatusAB}</span>
                </div>
                <div class="text-[10px] text-slate-400 mt-0.5">${a.routeStatusAB === 'CONNECTED' ? 'Inter-zone trading enabled' : 'Cross-zone trades rejected'}</div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between pt-3 border-t border-slate-100">
            <span class="text-[11px] text-slate-400">Preserving regulatory limits (₹2.00–₹8.00)</span>
            <button onclick="window.Header.closeScenarioImpactModal()" class="btn btn-primary text-xs py-1.5 px-4 font-bold">
              Got It
            </button>
          </div>
        </div>
      </div>
    `;
  },

  closeScenarioImpactModal() {
    const container = document.getElementById('scenario-modal-container');
    if (container) container.innerHTML = '';
  }
};
