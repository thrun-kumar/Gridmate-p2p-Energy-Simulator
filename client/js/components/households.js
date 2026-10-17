/**
 * GRIDMATE - Households Management & Detail View (Light Theme)
 */

window.HouseholdsView = {
  render(data) {
    const root = document.getElementById('view-content');
    if (!root) return;

    const households = data.households || [];

    root.innerHTML = `
      <div class="space-y-6">
        <!-- Households Header Banner -->
        <div class="card p-5 card-accent-green bg-white flex flex-wrap items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-page-title text-slate-800">Community Prosumers & Consumers</h1>
              <span class="badge badge-emerald text-xs font-bold">${households.length} Households</span>
            </div>
            <p class="text-caption text-slate-500 mt-0.5">
              Deterministic profiles modeling rooftop solar capacity (kW) and 24-hour demand (kWh). Click any household to view its 24-hour load and solar curves.
            </p>
          </div>
          <div class="flex items-center gap-2 text-xs">
            <span class="badge badge-emerald text-[11px]">● Prosumer Sellers</span>
            <span class="badge badge-blue text-[11px]">● Energy Consumers</span>
            <span class="badge badge-amber text-[11px]">● Prosumer (Both)</span>
          </div>
        </div>

        <!-- Household Grid Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          ${households.map(hh => {
            let roleBadge = 'badge-emerald';
            let roleLabel = hh.role || 'Prosumer';
            if (hh.role === 'Buyer' || hh.role === 'consumer') {
              roleBadge = 'badge-blue';
              roleLabel = 'Consumer';
            } else if (hh.role === 'mixed' || hh.participantType === 'COMMERCIAL_MIXED') {
              roleBadge = 'badge-purple';
              roleLabel = 'Mixed Commercial';
            } else if (hh.role === 'Both') {
              roleBadge = 'badge-amber';
              roleLabel = 'Both';
            } else {
              roleBadge = 'badge-emerald';
              roleLabel = 'Prosumer';
            }

            return `
              <div onclick="window.HouseholdsView.inspectHousehold('${hh.id}')" class="card p-4 bg-white hover:border-emerald-400 cursor-pointer space-y-2.5">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-[10px] font-mono font-bold text-slate-400 uppercase">${hh.id}</span>
                      <span class="text-[9px] px-1.5 py-0.2 rounded font-semibold ${hh.autoTradeEnabled !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}">
                        ${hh.autoTradeEnabled !== false ? 'Auto-Trade' : 'Manual'}
                      </span>
                    </div>
                    <h3 class="text-card-title font-bold text-slate-800 hover:text-emerald-700 transition-colors">${hh.name}</h3>
                  </div>
                  <span class="badge ${roleBadge} text-[10px] uppercase font-bold">${roleLabel}</span>
                </div>

                <p class="text-[11px] text-slate-500 line-clamp-2 h-8 leading-relaxed">${hh.description}</p>

                <!-- Current Interval Metrics -->
                <div class="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs font-mono">
                  <div>
                    <span class="text-[9px] text-slate-400 block uppercase font-sans">Solar</span>
                    <span class="font-bold text-emerald-700">${hh.currentHourGenerationKWh.toFixed(2)} kWh</span>
                  </div>
                  <div>
                    <span class="text-[9px] text-slate-400 block uppercase font-sans">Load</span>
                    <span class="font-bold text-blue-700">${hh.currentHourDemandKWh.toFixed(2)} kWh</span>
                  </div>
                  <div class="pt-1 border-t border-slate-200">
                    <span class="text-[9px] text-slate-400 block uppercase font-sans">Surplus</span>
                    <span class="font-bold text-emerald-600">${hh.currentHourSurplusKWh.toFixed(2)} kWh</span>
                  </div>
                  <div class="pt-1 border-t border-slate-200">
                    <span class="text-[9px] text-slate-400 block uppercase font-sans">Deficit</span>
                    <span class="font-bold text-amber-700">${hh.currentHourDeficitKWh.toFixed(2)} kWh</span>
                  </div>
                </div>

                <!-- Wallet & Price Preferences -->
                <div class="flex items-center justify-between text-[11px] text-slate-600 font-mono">
                  <span>Wallet: <strong class="text-slate-800">₹${Number(hh.walletBalance || 0).toFixed(2)}</strong></span>
                  <span class="text-[10px] text-slate-400">
                    ${hh.minimumAcceptedPrice ? `Min ₹${hh.minimumAcceptedPrice}` : (hh.maximumAcceptedPrice ? `Max ₹${hh.maximumAcceptedPrice}` : 'Auto-Price')}
                  </span>
                </div>

                <!-- Cumulative Financial Performance -->
                <div class="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 text-slate-500">
                  <span>Traded: <span class="font-mono font-bold text-slate-800">${(hh.totalEnergySoldKWh + hh.totalEnergyBoughtKWh).toFixed(1)} kWh</span></span>
                  <span class="text-emerald-700 font-bold">${hh.role === 'Buyer' ? `Saved ₹${hh.totalBuyerSavingsINR.toFixed(0)}` : `Earned ₹${hh.totalEarningsINR.toFixed(0)}`}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Household Profile Modal Placeholder -->
      <div id="household-modal-container"></div>
    `;
  },

  async inspectHousehold(id) {
    try {
      const data = await window.API.getHousehold(id);
      const hh = data.household;
      const trades = data.trades || [];
      const container = document.getElementById('household-modal-container');
      if (!container) return;

      container.innerHTML = `
        <div class="modal-overlay" onclick="if(event.target === this) window.HouseholdsView.closeModal()">
          <div class="modal-content p-6 space-y-4 max-w-3xl">
            <div class="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div class="flex items-center gap-2">
                  <span class="badge badge-emerald text-xs uppercase">${hh.role}</span>
                  <span class="font-mono text-xs text-slate-400 font-bold">${hh.id}</span>
                </div>
                <h3 class="text-section-heading text-slate-800 mt-1">${hh.name}</h3>
                <p class="text-caption text-slate-500">${hh.description} (Solar Capacity: ${hh.solarCapacityKW} kW)</p>
              </div>
              <button onclick="window.HouseholdsView.closeModal()" class="text-slate-400 hover:text-slate-700 text-lg">&times;</button>
            </div>

            <!-- 24-Hour Profile Summary SVG Chart -->
            <div class="card p-4 bg-white space-y-2">
              <div class="text-card-title flex items-center justify-between">
                <span>24-Hour Solar Generation vs Load Curve</span>
                <span class="text-caption">Hourly values in kWh</span>
              </div>
              <div id="modal-hh-chart" class="min-h-[180px]"></div>
            </div>

            <!-- Financial Ledger for this Participant -->
            <div class="space-y-2">
              <div class="text-card-title">Settled Trades for this Participant (${trades.length})</div>
              <div class="table-wrapper max-h-[160px] overflow-y-auto">
                <table class="grid-table">
                  <thead>
                    <tr>
                      <th>Tx ID</th>
                      <th>Hour</th>
                      <th>Counterparty</th>
                      <th>Role</th>
                      <th>Energy</th>
                      <th>Price</th>
                      <th>Total Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${trades.length === 0 ? `
                      <tr>
                        <td colspan="7" class="text-center py-4 text-xs text-slate-400">No trades completed for this participant yet.</td>
                      </tr>
                    ` : trades.map(t => {
                      const isSeller = t.sellerId === hh.id;
                      return `
                        <tr>
                          <td class="font-mono text-xs text-emerald-700 font-bold">${t.tradeId}</td>
                          <td class="font-mono text-xs text-slate-500">${String(t.simulationHour).padStart(2, '0')}:00</td>
                          <td class="text-xs font-semibold text-slate-800">${isSeller ? t.buyerName : t.sellerName}</td>
                          <td><span class="badge ${isSeller ? 'badge-emerald' : 'badge-blue'} text-[10px]">${isSeller ? 'SELLER' : 'BUYER'}</span></td>
                          <td class="font-mono text-xs text-slate-900 font-bold">${t.energyKWh.toFixed(2)} kWh</td>
                          <td class="font-mono text-xs text-emerald-700 font-bold">₹${t.tradePriceINR.toFixed(2)}</td>
                          <td class="font-mono text-xs text-slate-800 font-semibold">₹${t.totalValueINR.toFixed(2)}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="flex justify-end pt-2 border-t border-slate-100">
              <button onclick="window.HouseholdsView.closeModal()" class="btn btn-secondary text-xs">Close Details</button>
            </div>
          </div>
        </div>
      `;

      // Render mini 24h chart for this household
      const profileData = Array.from({ length: 24 }, (_, i) => ({
        generationKWh: hh.hourlyGeneration[i],
        demandKWh: hh.hourlyDemand[i]
      }));
      window.Charts.renderGenDemandChart(profileData, 'modal-hh-chart');
    } catch (err) {
      window.Toast.error(err.message);
    }
  },

  closeModal() {
    const container = document.getElementById('household-modal-container');
    if (container) container.innerHTML = '';
  }
};
