/**
 * SolarShare - Energy Marketplace & Double-Auction Matching Engine View
 * Displays active supply offers, active demand bids, and settled matched trades
 * with plain-language explanations of matching outcomes and benchmark savings.
 */

window.MarketplaceView = {
  render(data, households) {
    const root = document.getElementById('view-content');
    if (!root) return;

    const user = window.App.currentUser || { role: 'ADMIN' };
    const isAdmin = user.role === 'ADMIN';
    const gridBenchmark = 8.00;

    root.innerHTML = `
      <div class="space-y-6">
        
        <!-- Marketplace Header Banner -->
        <div class="card p-5 card-accent-green bg-white space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-page-title text-slate-800">Buy and Sell Electricity</h1>
                <span class="badge badge-emerald text-xs uppercase font-mono font-bold">Hour: ${data.currentHourLabel}</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Auto-Trading Enabled
                </span>
              </div>
              <p class="text-caption text-slate-500 mt-1 max-w-2xl">
                Clean solar surplus from prosumers is matched with grid-connected consumers. SolarShare reads generation and demand, calculates approved eligible prices, and transparently settles community peer power.
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button onclick="window.MarketplaceView.openOrderModal('OFFER')" class="btn btn-primary text-xs font-bold py-2 px-3 shadow-sm">
                Set My Selling Price
              </button>
              <button onclick="window.MarketplaceView.openOrderModal('BID')" class="btn btn-secondary text-xs font-bold py-2 px-3 border-blue-200 text-blue-800 hover:bg-blue-50">
                Choose My Purchase Budget
              </button>
              ${isAdmin ? `
                <button onclick="window.App.matchAvailableOrders()" class="btn btn-secondary text-xs font-bold py-2 px-3 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-300 shadow-xs">
                  Match Orders
                </button>
                <button onclick="window.App.advanceHour()" class="btn btn-secondary text-xs font-bold py-2 px-3 text-slate-700">
                  Advance 1 Hour
                </button>
              ` : `
                <button onclick="window.App.navigate(window.App.getDefaultRoute ? window.App.getDefaultRoute() : '/buyer/dashboard')" class="btn btn-secondary text-xs font-bold py-2 px-3 shadow-xs">
                  Return to Dashboard
                </button>
              `}
            </div>
          </div>

          <!-- Dynamic Pricing & Supply-Demand Banner -->
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
            <div class="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 flex items-center justify-between">
              <div>
                <span class="text-[11px] text-emerald-800 font-medium">Current Electricity Price:</span>
                <div class="text-base font-bold font-mono text-emerald-900 mt-0.5">₹${Number(data.recommendedPriceINR || 5.00).toFixed(2)}/kWh</div>
              </div>
              <span class="text-xs bg-white px-2 py-1 rounded-md text-emerald-700 font-bold border border-emerald-200 font-mono">
                [₹2.00, ₹8.00]
              </span>
            </div>

            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span class="text-[11px] text-slate-600 font-medium">Season & Time Profile:</span>
                <div class="text-sm font-bold text-slate-800 mt-0.5">Summer Clear Profile</div>
              </div>
              <span class="text-[10px] bg-emerald-100 px-2 py-0.5 rounded text-emerald-800 font-bold">
                Midday Peak Solar
              </span>
            </div>

            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span class="text-[11px] text-slate-600 font-medium">Demand Compared with Available Supply:</span>
                <div class="text-base font-bold font-mono text-slate-800 mt-0.5">${data.demandPressurePercent || 50}%</div>
              </div>
              <span class="text-xs bg-white px-2 py-1 rounded-md text-slate-700 font-bold border border-slate-200">
                ${data.statusLabel || 'Balanced Microgrid'}
              </span>
            </div>

            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span class="text-[11px] text-slate-600 font-medium">Transparent Fees:</span>
                <div class="text-sm font-bold font-mono text-emerald-700 mt-0.5">Platform: ₹0.20 | Wheel: ₹0.10</div>
              </div>
              <span class="text-[10px] text-slate-400">Settled Only</span>
            </div>
          </div>

          <!-- Plain-Language Price Explanation Banner -->
          <div class="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span class="text-emerald-700 font-bold">Price Movement Explanation:</span>
              <span class="text-slate-700">
                ${data.pricingDetails?.priceExplanation || 'Midday surplus clean energy encourages discounted local consumption, saving buyers money while prosumers earn well above the ₹2.00 export floor.'}
              </span>
            </div>
            <div class="text-[10px] text-slate-400 italic">
              Rule: RULE-TN-SIM-2026-V1 ("Simulation rules — pending regulatory verification")
            </div>
          </div>
        </div>

        <!-- Automated Matching Mechanics Explanatory Note -->
        <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
          <div>
            <span class="font-bold text-slate-800">Automatic Electricity Matching Mechanics: </span>
            Clean energy supplies are ranked by lowest cost. When consumer demand matches available generation, orders clear automatically at approved rates with transparent transmission wheeling and platform charges.
          </div>
        </div>

        <!-- Grid Network Topology & Route Capacity Status -->
        <div class="card p-4 bg-white border border-slate-200 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-slate-800 uppercase tracking-wide">Grid Network Topology & Interties</span>
              <span class="badge badge-purple text-[10px] font-mono font-bold">3 Active Substations</span>
            </div>
            <div class="text-[11px] text-slate-500">
              Commercial energy matching over shared grid topology (losses: 1.5% - 5.0%, wheeling: ₹0.10 - ₹0.40/kWh)
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <!-- Zone A -->
            <div class="p-2.5 rounded-lg border border-purple-200 bg-purple-50/40">
              <div class="flex items-center justify-between">
                <span class="font-bold font-mono text-purple-900">ZONE-A North Residential</span>
                <span class="badge badge-green text-[10px]">Connected</span>
              </div>
              <div class="text-[11px] text-slate-600 mt-1">Substation Cap: 50 kW | High Solar Rooftop Generation</div>
            </div>

            <!-- Zone B -->
            <div class="p-2.5 rounded-lg border border-blue-200 bg-blue-50/40">
              <div class="flex items-center justify-between">
                <span class="font-bold font-mono text-blue-900">ZONE-B Central Commercial</span>
                <span class="badge badge-blue text-[10px]">No Solar Required</span>
              </div>
              <div class="text-[11px] text-slate-600 mt-1">Substation Cap: 60 kW | Offices & Tech Park Demand</div>
            </div>

            <!-- Zone C -->
            <div class="p-2.5 rounded-lg border border-amber-200 bg-amber-50/40">
              <div class="flex items-center justify-between">
                <span class="font-bold font-mono text-amber-900">ZONE-C South Mixed</span>
                <span class="badge badge-green text-[10px]">Connected</span>
              </div>
              <div class="text-[11px] text-slate-600 mt-1">Substation Cap: 45 kW | Residential & Mixed Clinic Demand</div>
            </div>
          </div>
        </div>

        <!-- Order Books: Offers (Supply) and Bids (Demand) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <!-- Column 1: Seller Offers -->
          <div class="card p-5 bg-white space-y-3">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                <h2 class="text-section-heading text-slate-800">Seller Offers (Supply)</h2>
              </div>
              <span class="badge badge-emerald text-xs">${data.activeOffers.length} Active</span>
            </div>

            <div class="table-wrapper max-h-[360px] overflow-y-auto">
              <table class="grid-table text-xs">
                <thead>
                  <tr>
                    <th>Prosumer & Zone</th>
                    <th>Offered</th>
                    <th>Ask Price</th>
                    <th>Remaining</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.activeOffers.length === 0 ? `
                    <tr>
                      <td colspan="6" class="text-center py-6 text-slate-500 text-xs">
                        <div class="space-y-2">
                          <p class="text-slate-500">No active seller offers listed for this interval.</p>
                          <button onclick="window.MarketplaceView.openOrderModal('OFFER')" class="btn btn-primary text-xs py-1 px-3">
                            Publish Surplus Electricity
                          </button>
                        </div>
                      </td>
                    </tr>
                  ` : data.activeOffers.map(o => {
                    const canCancel = isAdmin || (user.householdId && user.householdId === o.householdId);
                    const zone = o.zone || 'ZONE-A';
                    return `
                      <tr>
                        <td class="font-medium text-slate-800">
                          <div class="flex items-center gap-1.5">
                            <span>${o.householdName}</span>
                            <span class="badge text-[10px] font-mono badge-purple">${zone}</span>
                          </div>
                          <div class="text-[10px] text-slate-400 font-mono">${o.id}</div>
                        </td>
                        <td class="font-mono font-bold text-slate-800">${Number(o.energyKWh || 0).toFixed(2)} kWh</td>
                        <td class="font-mono text-emerald-700 font-bold">₹${Number(o.askingPriceINR || 0).toFixed(2)}</td>
                        <td class="font-mono text-slate-600">${Number(o.remainingKWh || 0).toFixed(2)} kWh</td>
                        <td>
                          <span class="badge ${o.status === 'ACTIVE' ? 'badge-emerald' : 'badge-amber'} text-[10px]">
                            ${o.status}
                          </span>
                        </td>
                        <td>
                          ${canCancel ? `
                            <button onclick="window.MarketplaceView.cancelOrder('${o.id}')" class="btn btn-danger text-[11px] py-0.5 px-2">
                              Cancel
                            </button>
                          ` : `<span class="text-[10px] text-slate-400">—</span>`}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Column 2: Buyer Bids -->
          <div class="card p-5 bg-white space-y-3">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <h2 class="text-section-heading text-slate-800">Buyer Bids (Demand)</h2>
              </div>
              <span class="badge badge-blue text-xs">${data.activeBids.length} Active</span>
            </div>

            <div class="table-wrapper max-h-[360px] overflow-y-auto">
              <table class="grid-table text-xs">
                <thead>
                  <tr>
                    <th>Consumer & Zone</th>
                    <th>Requested</th>
                    <th>Max Bid</th>
                    <th>Remaining</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.activeBids.length === 0 ? `
                    <tr>
                      <td colspan="6" class="text-center py-6 text-slate-500 text-xs">
                        <div class="space-y-2">
                          <p class="text-slate-500">No active buyer bids listed for this interval.</p>
                          <button onclick="window.MarketplaceView.openOrderModal('BID')" class="btn btn-secondary text-xs py-1 px-3 text-blue-700 border-blue-200">
                            Choose My Purchase Budget
                          </button>
                        </div>
                      </td>
                    </tr>
                  ` : data.activeBids.map(b => {
                    const canCancel = isAdmin || (user.householdId && user.householdId === b.householdId);
                    const zone = b.zone || 'ZONE-B';
                    return `
                      <tr>
                        <td class="font-medium text-slate-800">
                          <div class="flex items-center gap-1.5">
                            <span>${b.householdName}</span>
                            <span class="badge text-[10px] font-mono badge-blue">${zone}</span>
                          </div>
                          <div class="text-[10px] text-slate-400 font-mono">${b.id}</div>
                        </td>
                        <td class="font-mono font-bold text-slate-800">${Number(b.energyKWh || 0).toFixed(2)} kWh</td>
                        <td class="font-mono text-blue-700 font-bold">₹${Number(b.maxBidINR || 0).toFixed(2)}</td>
                        <td class="font-mono text-slate-600">${Number(b.remainingKWh || 0).toFixed(2)} kWh</td>
                        <td>
                          <span class="badge ${b.status === 'ACTIVE' ? 'badge-blue' : 'badge-amber'} text-[10px]">
                            ${b.status}
                          </span>
                        </td>
                        <td>
                          ${canCancel ? `
                            <button onclick="window.MarketplaceView.cancelOrder('${b.id}')" class="btn btn-danger text-[11px] py-0.5 px-2">
                              Cancel
                            </button>
                          ` : `<span class="text-[10px] text-slate-400">—</span>`}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- DEDICATED MATCHED TRADES TABLE WITH DETAILED EXPLANATIONS -->
        <div class="card p-5 bg-white space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 class="text-section-heading text-slate-800">Matched Trades in Current Interval (${data.recentTrades.length})</h2>
              <p class="text-caption text-slate-500">Each matched trade shows bilateral counterparties, network zones, transmission metrics, clearing price, and realized savings</p>
            </div>
            <span class="badge badge-emerald text-xs">${data.recentTrades.length} Trades Settled</span>
          </div>

          <div class="table-wrapper">
            <table class="grid-table text-xs">
              <thead>
                <tr>
                  <th>Trade ID</th>
                  <th>Buyer & Zone</th>
                  <th>Seller & Zone</th>
                  <th>Delivered / Injected</th>
                  <th>Loss & Wheeling</th>
                  <th>Seller Ask</th>
                  <th>Buyer Bid</th>
                  <th>Clearing Price</th>
                  <th>Total Billed</th>
                  <th>Buyer Savings</th>
                  <th>Route Status</th>
                </tr>
              </thead>
              <tbody>
                ${data.recentTrades.length === 0 ? `
                  <tr>
                    <td colspan="11" class="text-center py-6 text-slate-400 text-xs">
                      No trades matched yet for hour ${data.currentHourLabel}. Compatible bids and offers clear automatically upon advancing the simulation.
                    </td>
                  </tr>
                ` : data.recentTrades.map(t => {
                  const injected = Number(t.energyKWh || 0);
                  const delivered = Number(t.deliveredEnergyKWh !== undefined ? t.deliveredEnergyKWh : injected);
                  const loss = Number(t.lossKWh || 0);
                  const wheeling = Number(t.wheelingFeeINR || 0);
                  const tradePrice = Number(t.tradePriceINR || 0);
                  const totalCost = Number(t.buyerTotalCostINR !== undefined ? t.buyerTotalCostINR : (t.totalValueINR || (injected * tradePrice)));
                  const baseline = Number(t.utilityComparisonCostINR !== undefined ? t.utilityComparisonCostINR : (delivered * gridBenchmark));
                  const savings = Number(t.buyerSavingsINR !== undefined ? t.buyerSavingsINR : (t.buyerGrossSavingsINR || (baseline - totalCost)));
                  const sZone = t.sellerZone || 'ZONE-A';
                  const bZone = t.buyerZone || 'ZONE-B';
                  const crossZone = Boolean(t.isCrossZone);

                  return `
                    <tr>
                      <td class="font-mono text-xs text-slate-900 font-bold">${t.tradeId || t.transactionId}</td>
                      <td>
                        <div class="text-xs font-semibold text-slate-800">${t.buyerName}</div>
                        <span class="badge text-[10px] font-mono badge-blue">${bZone}</span>
                      </td>
                      <td>
                        <div class="text-xs font-semibold text-slate-800">${t.sellerName}</div>
                        <span class="badge text-[10px] font-mono badge-purple">${sZone}</span>
                      </td>
                      <td class="font-mono">
                        <div class="font-bold text-slate-900">${delivered.toFixed(2)} kWh</div>
                        <div class="text-[10px] text-slate-400">Injected: ${injected.toFixed(2)} kWh</div>
                      </td>
                      <td class="font-mono">
                        <div class="text-slate-600">Loss: ${loss.toFixed(2)} kWh</div>
                        <div class="text-[10px] text-slate-500">Wheeling: ₹${wheeling.toFixed(2)}</div>
                      </td>
                      <td class="font-mono text-xs text-slate-500">₹${Number(t.sellerAskINR || 0).toFixed(2)}</td>
                      <td class="font-mono text-xs text-slate-500">₹${Number(t.buyerBidINR || 0).toFixed(2)}</td>
                      <td class="font-mono text-xs font-bold text-emerald-700">₹${tradePrice.toFixed(2)}</td>
                      <td class="font-mono text-xs font-bold text-slate-900">₹${totalCost.toFixed(2)}</td>
                      <td class="font-mono text-xs font-bold ${savings >= 0 ? 'text-emerald-700' : 'text-red-600'}">
                        ${savings >= 0 ? '+' : ''}₹${savings.toFixed(2)}
                      </td>
                      <td>
                        <span class="badge ${crossZone ? 'badge-amber' : 'badge-emerald'} text-[10px]">
                          ${crossZone ? 'Cross-Zone' : 'Local'}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- Order Submission Modal -->
      <div id="order-modal-container"></div>
    `;

    window.MarketplaceView._households = households || [];
    window.MarketplaceView._currentHour = data.currentHour;
  },

  openOrderModal(type = 'OFFER') {
    const container = document.getElementById('order-modal-container');
    if (!container) return;

    const user = window.App.currentUser || {};
    const isOffer = type === 'OFFER';
    const title = isOffer ? 'Set My Selling Price' : 'Choose My Purchase Budget';

    // Eligible households based on active user role
    let eligibleHouseholds = window.MarketplaceView._households || [];
    if (user.role === 'SELLER' && user.householdId) {
      eligibleHouseholds = eligibleHouseholds.filter(h => h.id === user.householdId);
    } else if (user.role === 'BUYER' && user.householdId) {
      eligibleHouseholds = eligibleHouseholds.filter(h => h.id === user.householdId);
    }

    container.innerHTML = `
      <div class="modal-backdrop" onclick="window.MarketplaceView.closeOrderModal(event)">
        <div class="modal-dialog p-6 space-y-4 max-w-md" onclick="event.stopPropagation()">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 class="text-xs font-bold text-slate-800">${title}</h3>
            <button onclick="window.MarketplaceView.closeOrderModal()" class="text-slate-400 hover:text-slate-600 text-sm font-bold">&times;</button>
          </div>

          <form onsubmit="window.MarketplaceView.handleSubmitOrder(event, '${type}')" class="space-y-3">
            <div>
              <label class="input-label" for="order-household">Participating Household</label>
              <select id="order-household" class="input-field text-xs" required>
                ${eligibleHouseholds.map(h => `
                  <option value="${h.id}">${h.name} (${h.id} • ${h.role})</option>
                `).join('')}
              </select>
            </div>

            <div>
              <label class="input-label" for="order-qty">Energy Quantity (kWh)</label>
              <input id="order-qty" type="number" step="0.1" min="0.1" value="3.0" required class="input-field text-xs font-mono" />
            </div>

            <div>
              <label class="input-label" for="order-price">
                ${isOffer ? 'Selling Price (₹/kWh) [Permitted Band: ₹2.00 – ₹8.00]' : 'Maximum Budget Price (₹/kWh) [Utility Cap: ₹8.00]'}
              </label>
              <input id="order-price" type="number" step="0.10" min="2.00" max="8.00" value="${isOffer ? '4.50' : '6.20'}" required class="input-field text-xs font-mono" />
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onclick="window.MarketplaceView.closeOrderModal()" class="btn btn-secondary text-xs">Cancel</button>
              <button type="submit" class="btn ${isOffer ? 'btn-primary' : 'btn-blue'} text-xs font-bold">
                ${isOffer ? 'Set Selling Price' : 'Confirm Purchase Budget'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  closeOrderModal() {
    const container = document.getElementById('order-modal-container');
    if (container) container.innerHTML = '';
  },

  async handleSubmitOrder(e, type) {
    e.preventDefault();
    const hhId = document.getElementById('order-household')?.value;
    const qty = parseFloat(document.getElementById('order-qty')?.value);
    const price = parseFloat(document.getElementById('order-price')?.value);

    try {
      if (type === 'OFFER') {
        const res = await window.API.submitOffer(hhId, qty, price);
        window.Toast.success(res.message);
      } else {
        const res = await window.API.submitBid(hhId, qty, price);
        window.Toast.success(res.message);
      }
      this.closeOrderModal();
      window.App.navigate('marketplace');
    } catch (err) {
      window.Toast.error(`Order rejected: ${err.message}`);
    }
  },

  async cancelOrder(orderId) {
    try {
      await window.API.cancelOrder(orderId);
      window.Toast.success('Order cancelled successfully.');
      window.App.navigate('marketplace');
    } catch (err) {
      window.Toast.error(`Could not cancel order: ${err.message}`);
    }
  }
};
