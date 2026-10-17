/**
 * SolarShare - Savings Analytics & SDG 7 Impact View
 * Implements participant-by-participant financial savings, comparison charts,
 * benchmark differential analysis (₹8.00/kWh retail tariff), and carbon displacement metrics.
 */

window.SavingsView = {
  _participants: [],
  _filtered: [],

  render(data) {
    const root = document.getElementById('view-content');
    if (!root) return;

    const k = data.kpis;
    const gridBenchmark = data.gridBenchmarkTariffINR || 8.00;
    this._participants = data.participants || [];
    this._filtered = [...this._participants];

    root.innerHTML = `
      <div class="space-y-6">
        
        <!-- BANNER & SDG 7 CONTEXT -->
        <div class="card p-5 card-accent-green bg-white flex flex-wrap items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-page-title text-slate-800">Participant Savings & SDG 7 Clean Impact</h1>
              <span class="badge badge-emerald text-xs uppercase font-bold">UN SDG 7 Target</span>
            </div>
            <p class="text-caption text-slate-500 mt-0.5">
              Transparent economic accounting based on utility benchmarks: <span class="font-bold text-slate-700">₹${gridBenchmark.toFixed(2)}/kWh</span> retail import tariff and <span class="font-bold text-slate-700">₹2.00/kWh</span> feed-in export floor.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
              0.82 kg CO₂e / kWh Displaced Thermal Grid Factor
            </span>
          </div>
        </div>

        <!-- MATHEMATICAL FORMULATION CALLOUT -->
        <div class="p-4 bg-[#fafbf9] border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1">
          <div class="font-bold text-slate-900 flex items-center gap-1.5">
            <span>Realized Savings Mathematical Model:</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11px] font-mono">
            <div class="p-2 bg-white rounded border border-slate-200">
              <span class="text-slate-400">Savings / Unit:</span>
              <div class="text-emerald-700 font-bold">Grid Tariff (₹8.00) − P2P Price</div>
            </div>
            <div class="p-2 bg-white rounded border border-slate-200">
              <span class="text-slate-400">Transaction Savings:</span>
              <div class="text-emerald-700 font-bold">Traded kWh × Unit Savings</div>
            </div>
            <div class="p-2 bg-white rounded border border-slate-200">
              <span class="text-slate-400">Savings %:</span>
              <div class="text-emerald-700 font-bold">(Unit Savings ÷ ₹8.00) × 100</div>
            </div>
          </div>
        </div>

        <!-- 5 TOP KPI CARDS REQUIRED BY SPECIFICATION -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <!-- 1. Total Platform Savings -->
          <div class="card p-3.5 bg-white card-accent-green">
            <span class="stat-label">Total Buyer Savings</span>
            <div class="text-metric-value text-emerald-700 mt-0.5">₹${k.totalBuyerSavingsINR.toFixed(2)}</div>
            <div class="text-caption text-slate-400 mt-0.5">Cumulative bill reduction</div>
          </div>

          <!-- 2. Average Savings Per Unit -->
          <div class="card p-3.5 bg-white card-accent-green">
            <span class="stat-label">Avg Unit Savings</span>
            <div class="text-metric-value text-emerald-700 mt-0.5">₹${k.averageSavingsPerUnitINR.toFixed(2)} <span class="text-xs font-semibold text-slate-500">/kWh</span></div>
            <div class="text-caption text-slate-400 mt-0.5">Across all settled trades</div>
          </div>

          <!-- 3. Total Purchased Energy -->
          <div class="card p-3.5 bg-white">
            <span class="stat-label">Total Traded Energy</span>
            <div class="text-metric-value text-slate-800 mt-0.5">${k.totalEnergyTradedKWh.toFixed(1)} <span class="text-xs font-semibold text-slate-500">kWh</span></div>
            <div class="text-caption text-slate-400 mt-0.5">${k.completedTradesCount} settled trades</div>
          </div>

          <!-- 4. Total Seller Revenue -->
          <div class="card p-3.5 bg-white">
            <span class="stat-label">Seller Revenue</span>
            <div class="text-metric-value text-slate-800 mt-0.5">₹${(k.totalSellerRevenueINR || k.totalTransactionValueINR).toFixed(2)}</div>
            <div class="text-caption text-slate-400 mt-0.5">+₹${k.totalSellerAdditionalEarningsINR.toFixed(0)} above feed-in</div>
          </div>

          <!-- 5. Estimated CO2 Avoided -->
          <div class="card p-3.5 bg-white">
            <span class="stat-label">CO₂ Displaced</span>
            <div class="text-metric-value text-emerald-700 mt-0.5">${k.totalAvoidedCO2Kg.toFixed(1)} <span class="text-xs font-semibold text-slate-500">kg</span></div>
            <div class="text-caption text-slate-400 mt-0.5">Thermal grid baseline</div>
          </div>
        </div>

        <!-- PARTICIPANT-BY-PARTICIPANT BREAKDOWN TABLE -->
        <div class="card p-5 bg-white space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 class="text-section-heading text-slate-800">Savings & Earnings per Household (<span id="participant-count">${this._participants.length}</span>)</h2>
              <p class="text-caption text-slate-500">Individual ledger totals for every participating household</p>
            </div>

            <!-- Filters -->
            <div class="flex flex-wrap items-center gap-2">
              <div class="relative">
                <input 
                  id="savings-search" 
                  type="text" 
                  placeholder="Search household..." 
                  oninput="window.SavingsView.filterTable()"
                  class="input-field text-xs pl-8 pr-3 py-1.5 w-44" 
                />
                <span class="absolute left-2.5 top-2 text-slate-400">${window.Icons.search('w-3.5 h-3.5')}</span>
              </div>

              <select id="savings-role-filter" onchange="window.SavingsView.filterTable()" class="input-field text-xs py-1.5 w-32">
                <option value="ALL">All Roles</option>
                <option value="Seller">Sellers</option>
                <option value="Buyer">Buyers</option>
                <option value="Both">Both (Prosumer)</option>
              </select>

              <select id="savings-sort" onchange="window.SavingsView.sortTable()" class="input-field text-xs py-1.5 w-44">
                <option value="savings_desc">Buyer Savings (High &rarr; Low)</option>
                <option value="earnings_desc">Seller Revenue (High &rarr; Low)</option>
                <option value="energy_desc">Energy Traded (High &rarr; Low)</option>
                <option value="name_asc">Name (A &rarr; Z)</option>
              </select>
            </div>
          </div>

          <div class="table-wrapper">
            <table class="grid-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Role</th>
                  <th>Purchased (kWh)</th>
                  <th>Sold (kWh)</th>
                  <th>Grid Benchmark</th>
                  <th>Avg P2P Price</th>
                  <th>Savings / Unit</th>
                  <th>Total Buyer Savings</th>
                  <th>Seller Revenue</th>
                  <th>Trades</th>
                </tr>
              </thead>
              <tbody id="savings-table-body">
                <!-- Rendered dynamically -->
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    this.renderRows();
  },

  renderRows() {
    const tbody = document.getElementById('savings-table-body');
    const countEl = document.getElementById('participant-count');
    if (!tbody) return;

    if (countEl) countEl.innerText = this._filtered.length;

    if (this._filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center py-6 text-slate-400 text-xs">No matching participants found.</td></tr>`;
      return;
    }

    tbody.innerHTML = this._filtered.map(p => {
      const hasNegativeSavings = p.savingsPerUnitINR < 0;
      return `
        <tr>
          <td>
            <div class="font-semibold text-slate-800">${p.name}</div>
            <div class="text-[10px] text-slate-400 font-mono">${p.id}</div>
          </td>
          <td>
            <span class="badge ${p.role === 'Buyer' ? 'badge-blue' : (p.role === 'Seller' ? 'badge-emerald' : 'badge-amber')} text-[10px]">
              ${p.role}
            </span>
          </td>
          <td class="font-mono text-slate-900 font-bold">${p.energyBoughtKWh.toFixed(2)}</td>
          <td class="font-mono text-slate-900 font-bold">${p.energySoldKWh.toFixed(2)}</td>
          <td class="font-mono text-slate-600">₹${p.gridBenchmarkTariffINR.toFixed(2)}</td>
          <td class="font-mono text-slate-800 font-bold">
            ${p.energyBoughtKWh > 0 ? `₹${p.avgPurchasePriceINR.toFixed(2)}` : '—'}
          </td>
          <td class="font-mono font-bold ${hasNegativeSavings ? 'text-red-600' : 'text-emerald-700'}">
            ${p.energyBoughtKWh > 0 ? `${hasNegativeSavings ? '-' : '+'}₹${Math.abs(p.savingsPerUnitINR).toFixed(2)} (${p.savingsPercent}%)` : '—'}
          </td>
          <td class="font-mono font-bold ${hasNegativeSavings ? 'text-red-600' : 'text-emerald-700'}">
            ${p.energyBoughtKWh > 0 ? `${hasNegativeSavings ? '-' : '+'}₹${Math.abs(p.buyerGrossSavingsINR).toFixed(2)}` : '—'}
          </td>
          <td class="font-mono font-bold text-slate-900">
            ${p.energySoldKWh > 0 ? `₹${p.sellerRevenueINR.toFixed(2)}` : '—'}
          </td>
          <td class="font-mono text-slate-700">${p.tradesCount}</td>
        </tr>
      `;
    }).join('');
  },

  filterTable() {
    const q = (document.getElementById('savings-search')?.value || '').toLowerCase().trim();
    const roleVal = document.getElementById('savings-role-filter')?.value || 'ALL';

    this._filtered = this._participants.filter(p => {
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
      const matchRole = roleVal === 'ALL' || p.role.toLowerCase() === roleVal.toLowerCase();
      return matchQ && matchRole;
    });

    this.sortTable(false);
  },

  sortTable(triggerRender = true) {
    const sortVal = document.getElementById('savings-sort')?.value || 'savings_desc';

    if (sortVal === 'savings_desc') {
      this._filtered.sort((a, b) => b.buyerGrossSavingsINR - a.buyerGrossSavingsINR);
    } else if (sortVal === 'earnings_desc') {
      this._filtered.sort((a, b) => b.sellerRevenueINR - a.sellerRevenueINR);
    } else if (sortVal === 'energy_desc') {
      this._filtered.sort((a, b) => (b.energyBoughtKWh + b.energySoldKWh) - (a.energyBoughtKWh + a.energySoldKWh));
    } else if (sortVal === 'name_asc') {
      this._filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    if (triggerRender) this.renderRows();
  }
};
