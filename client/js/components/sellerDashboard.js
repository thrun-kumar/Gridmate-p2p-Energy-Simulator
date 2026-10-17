/**
 * SolarShare - Seller / Prosumer Dedicated Dashboard
 * Redesigned around simplified prosumer actions:
 * 1. Report surplus energy and view real-time solar generation.
 * 2. Accept recommended eligible price with 1-click.
 * 3. View comprehensive price explanation (seasonal, time-of-day, demand pressure).
 * 4. Propose preferred price with strict regulation validation against RULE-TN-SIM-2026-V1.
 * 5. Request formal price review if proposing a custom price.
 * 6. Audit transaction status, gross earnings, transparent fees, and net earnings.
 */

window.SellerDashboardView = {
  currentMarketData: null,
  currentPriceResult: null,

  async render() {
    const root = document.getElementById('view-content');
    if (!root) return;

    const user = window.App.currentUser;
    if (!user || (!user.householdId && user.role !== 'ADMIN')) {
      root.innerHTML = `<div class="p-8 text-center text-slate-500">Please select a Seller / Prosumer account to view this dashboard.</div>`;
      return;
    }

    const householdId = user.householdId || 'HH-01';

    try {
      const [data, marketData, liveMarket] = await Promise.all([
        window.API.getHousehold(householdId),
        window.API.getMarketplace(),
        window.API.getLiveMarket().catch(() => null)
      ]);

      this.currentMarketData = marketData;
      this.currentPriceResult = liveMarket;

      const hh = data.household;
      const m = data.metrics;
      const activeOffers = data.activeOffers || [];
      const trades = data.trades || [];
      const salesTrades = trades.filter(t => t.sellerId === householdId);
      const incomingBids = marketData.activeBids || [];

      // Export compensation floor baseline: ₹2.00/kWh
      const exportFloor = 2.00;
      const recommendedPrice = Number(liveMarket?.recommendedPriceINR || marketData?.recommendedPriceINR || 5.00);

      // Realized metrics with strict safe fallbacks
      const genNum = Number(m?.generationKWh || 0);
      const demNum = Number(m?.demandKWh || 0);
      const surNum = Number(m?.surplusKWh || 0);
      const comSurplusNum = Number(m?.committedSurplusKWh || 0);
      const uncomSurplusNum = Number(m?.uncommittedSurplusKWh !== undefined ? m.uncommittedSurplusKWh : Math.max(0, surNum - comSurplusNum));
      const hasActiveOffer = activeOffers.length > 0;
      const firstActiveOffer = hasActiveOffer ? activeOffers[0] : null;
      const effectiveAvailableKWh = uncomSurplusNum > 0 ? uncomSurplusNum : (hasActiveOffer ? Number(firstActiveOffer.remainingKWh || firstActiveOffer.energyKWh || 0) : surNum);
      const totalSoldNum = Number(m?.totalEnergySoldKWh || 0);
      const totalRevenueNum = Number(m?.totalEarningsINR || 0);
      const avgSellingPriceNum = totalSoldNum > 0 ? Number((totalRevenueNum / totalSoldNum).toFixed(2)) : 0;
      const extraEarningsAboveFloorNum = Number(m?.totalSellerAdditionalEarningsINR || 0);
      const totalSoldKWh = totalSoldNum;
      const totalRevenueINR = totalRevenueNum;
      const extraEarningsAboveFloor = extraEarningsAboveFloorNum;

      root.innerHTML = `
        <div class="space-y-6">
          
          <!-- TOP BANNER: WELCOME & HOUSEHOLD IDENTITY -->
          <div class="card p-5 card-accent-green bg-white flex flex-wrap items-center justify-between gap-4">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-page-title text-slate-900">Welcome, ${hh.name}</h1>
                <span class="badge badge-emerald text-xs uppercase font-bold">Solar Prosumer</span>
                <span class="font-mono text-xs text-slate-500 font-semibold">${hh.id}</span>
                <span class="badge badge-purple text-xs font-mono font-bold">${hh.zone || 'ZONE-A'}</span>
                <span class="badge badge-green text-xs font-semibold">Grid: ${hh.gridConnectionStatus || 'CONNECTED'}</span>
              </div>
              <p class="text-caption text-slate-500 mt-1 max-w-2xl">
                ${hh.description || 'Solar prosumer generating clean solar energy for the shared community grid.'} (Rooftop Solar Array: <span class="font-semibold text-slate-700">${hh.solarCapacityKW} kW</span> | Substation Export Capacity: <span class="font-semibold text-emerald-700 font-mono">${hh.exportCapacityKW || hh.solarCapacityKW || 10} kW</span>)
              </p>
            </div>
            
            <div class="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs">
              <span class="text-slate-600">Simulated Interval:</span>
              <span class="font-bold font-mono text-emerald-800">${data.currentHourLabel}</span>
              <span class="text-slate-300">|</span>
              <span class="text-slate-600">Feed-in Floor:</span>
              <span class="font-bold text-slate-900">₹${exportFloor.toFixed(2)}/kWh</span>
            </div>
          </div>

          <!-- TOP 10 KEY METRIC CARDS -->
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <!-- 1. Solar Generation -->
            <div class="card p-3.5 bg-white">
              <span class="stat-label">Solar Output</span>
              <div class="text-metric-value text-emerald-700 mt-0.5">${genNum.toFixed(2)} <span class="text-xs font-semibold text-slate-500">kWh</span></div>
              <div class="text-caption text-slate-400 mt-0.5">Current interval generation</div>
            </div>

            <!-- 2. Household Consumption -->
            <div class="card p-3.5 bg-white">
              <span class="stat-label">Home Consumption</span>
              <div class="text-metric-value text-blue-700 mt-0.5">${demNum.toFixed(2)} <span class="text-xs font-semibold text-slate-500">kWh</span></div>
              <div class="text-caption text-slate-400 mt-0.5">Self-consumed electricity</div>
            </div>

            <!-- 3. Available Surplus -->
            <div class="card p-3.5 bg-white">
              <span class="stat-label">Net Surplus</span>
              <div class="text-metric-value text-emerald-600 mt-0.5">${surNum.toFixed(2)} <span class="text-xs font-semibold text-slate-500">kWh</span></div>
              <div class="text-caption text-slate-400 mt-0.5">Generation minus demand</div>
            </div>

            <!-- 4. Committed to Open Orders -->
            <div class="card p-3.5 bg-white">
              <span class="stat-label">Committed in Offers</span>
              <div class="text-metric-value text-amber-600 mt-0.5">${comSurplusNum.toFixed(2)} <span class="text-xs font-semibold text-slate-500">kWh</span></div>
              <div class="text-caption text-slate-400 mt-0.5">In active market listings</div>
            </div>

            <!-- 5. Remaining Energy Available to Sell -->
            <div class="card p-3.5 bg-white border-emerald-300">
              <span class="stat-label">Electricity Available to Sell</span>
              <div class="text-metric-value text-emerald-800 font-extrabold mt-0.5">${uncomSurplusNum.toFixed(2)} <span class="text-xs font-semibold text-slate-500">kWh</span></div>
              <div class="text-caption text-slate-400 mt-0.5">${hasActiveOffer && uncomSurplusNum <= 0 ? `${comSurplusNum.toFixed(2)} kWh active in market` : 'Available for new offers'}</div>
            </div>

            <!-- 6. Number of Active Offers -->
            <div class="card p-3.5 bg-white">
              <span class="stat-label">Active Offers</span>
              <div class="text-metric-value text-slate-800 mt-0.5">${activeOffers.length}</div>
              <div class="text-caption text-slate-400 mt-0.5">Open on marketplace</div>
            </div>

            <!-- 7. Total Energy Sold -->
            <div class="card p-3.5 bg-white">
              <span class="stat-label">Total Sold</span>
              <div class="text-metric-value text-slate-900 mt-0.5">${totalSoldNum.toFixed(2)} <span class="text-xs font-semibold text-slate-500">kWh</span></div>
              <div class="text-caption text-slate-400 mt-0.5">Delivered clean energy</div>
            </div>

            <!-- 8. Total Sales Revenue -->
            <div class="card p-3.5 bg-white card-accent-green">
              <span class="stat-label">Total Sales Revenue</span>
              <div class="text-metric-value text-emerald-700 mt-0.5">₹${totalRevenueNum.toFixed(2)}</div>
              <div class="text-caption text-slate-400 mt-0.5">Gross trade settlements</div>
            </div>

            <!-- 9. Average Selling Price Per Unit -->
            <div class="card p-3.5 bg-white">
              <span class="stat-label">Avg Selling Price</span>
              <div class="text-metric-value text-slate-800 mt-0.5">₹${avgSellingPriceNum.toFixed(2)} <span class="text-xs font-semibold text-slate-500">/kWh</span></div>
              <div class="text-caption text-slate-400 mt-0.5">Realized clearing rate</div>
            </div>

            <!-- 10. Extra Revenue Above Feed-in -->
            <div class="card p-3.5 bg-white card-accent-green">
              <span class="stat-label">Extra Profit</span>
              <div class="text-metric-value text-emerald-700 mt-0.5">+₹${extraEarningsAboveFloorNum.toFixed(2)}</div>
              <div class="text-caption text-slate-400 mt-0.5">Above ₹2.00 feed-in floor</div>
            </div>
          </div>

          <!-- REGULATION-AWARE SOLAR SELLER ACTIONS CARD -->
          <div class="card p-6 bg-white border border-emerald-300 shadow-sm space-y-5">
            <div class="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-100 pb-4">
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="text-base font-bold text-slate-900">Surplus Energy & Pricing Actions</h2>
                  <span class="badge badge-emerald text-[11px] font-bold">Rule: RULE-TN-SIM-2026-V1</span>
                </div>
                <p class="text-xs text-slate-500 mt-1 max-w-2xl">
                  Accept the dynamic recommended price with 1 click, inspect transparent price formulation, sell surplus electricity, or request an administrative review.
                </p>
              </div>
              <div class="text-right">
                <div class="text-[11px] text-slate-500 font-medium">Recommended Selling Price</div>
                <div class="text-2xl font-extrabold font-mono text-emerald-700">₹${recommendedPrice.toFixed(2)}<span class="text-xs font-semibold text-slate-500">/kWh</span></div>
                <span class="text-[10px] text-slate-400">Permitted Band: ₹2.00 – ₹8.00/kWh</span>
              </div>
            </div>

            ${surNum <= 0 ? `
              <!-- Zero Surplus Notice: Only shown when generation <= demand -->
              <div class="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <span class="font-bold text-amber-800 whitespace-nowrap">No Solar Surplus:</span>
                <span>Household electricity consumption (${demNum.toFixed(2)} kWh) currently equals or exceeds solar generation (${genNum.toFixed(2)} kWh) for this interval. Selling electricity is enabled when rooftop solar generates surplus power (peak solar window: 06:00 AM – 05:00 PM).</span>
              </div>
            ` : (hasActiveOffer && uncomSurplusNum <= 0) ? `
              <!-- Active Offer Notice: Surplus exists and is currently listed on marketplace -->
              <div class="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div class="font-bold text-emerald-900 flex items-center gap-2 text-sm">
                    <span class="badge badge-emerald text-[11px] font-bold">Offer Active</span>
                    <span>Your Solar Surplus (${comSurplusNum.toFixed(2)} kWh) is Listed on the Marketplace!</span>
                  </div>
                  <p class="text-xs text-emerald-800 mt-1">
                    Your surplus energy is actively listed on the exchange for interval <strong>${data.currentHourLabel}</strong> at <strong>₹${firstActiveOffer.askingPriceINR.toFixed(2)}/kWh</strong>. 
                    Ordinary buyers can match and purchase your clean solar energy.
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <button 
                    onclick="window.SellerDashboardView.openEditOfferModal('${firstActiveOffer.id}', ${firstActiveOffer.remainingKWh}, ${firstActiveOffer.askingPriceINR})"
                    class="btn btn-primary text-xs py-1.5 px-3 font-bold shadow-sm"
                  >
                    Update Asking Price
                  </button>
                  <button 
                    onclick="window.SellerDashboardView.handleCancelOffer('${firstActiveOffer.id}')"
                    class="btn btn-secondary text-xs py-1.5 px-3 border-emerald-300 text-emerald-900 font-bold hover:bg-emerald-100"
                  >
                    Cancel Offer to Re-list
                  </button>
                </div>
              </div>
            ` : ''}

            <!-- 5 WORKING SELLER ACTIONS -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <!-- Action 1: Sell Surplus Electricity (Jump to form) -->
              <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2">
                <div>
                  <div class="text-xs font-bold text-slate-900">1. Sell Surplus Electricity</div>
                  <p class="text-[11px] text-slate-500 mt-0.5">Specify custom eligible quantity and price.</p>
                </div>
                <button 
                  onclick="document.getElementById('seller-sell-form').scrollIntoView({ behavior: 'smooth' }); document.getElementById('seller-pref-qty').focus();"
                  class="btn btn-secondary w-full text-xs py-1.5 font-bold"
                  ${surNum <= 0 ? 'disabled' : ''}
                >
                  ${hasActiveOffer && uncomSurplusNum <= 0 ? 'Modify Active Offer' : 'Sell Surplus Electricity'}
                </button>
              </div>

              <!-- Action 2: Accept Recommended Price -->
              <div class="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col justify-between space-y-2">
                <div>
                  <div class="text-xs font-bold text-emerald-900">2. Accept Recommended Price</div>
                  <p class="text-[11px] text-slate-600 mt-0.5">
                    ${hasActiveOffer && uncomSurplusNum <= 0 
                      ? `Update listing to ₹${recommendedPrice.toFixed(2)}/kWh.`
                      : `Publish ${uncomSurplusNum.toFixed(2)} kWh at ₹${recommendedPrice.toFixed(2)}/kWh.`}
                  </p>
                </div>
                <button 
                  onclick="window.SellerDashboardView.handleAcceptRecommendedPrice('${householdId}', ${effectiveAvailableKWh}, ${recommendedPrice})"
                  class="btn btn-primary w-full text-xs py-1.5 font-bold shadow-sm"
                  ${surNum <= 0 ? 'disabled' : ''}
                >
                  ${hasActiveOffer && uncomSurplusNum <= 0 ? 'Update to Recommended Price' : 'Accept Recommended Price'}
                </button>
              </div>

              <!-- Action 3: View Price Explanation -->
              <div class="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200 flex flex-col justify-between space-y-2">
                <div>
                  <div class="text-xs font-bold text-blue-900">3. View Price Explanation</div>
                  <p class="text-[11px] text-slate-600 mt-0.5">Inspect season, time, and demand drivers.</p>
                </div>
                <button 
                  onclick="window.SellerDashboardView.openPriceExplanationModal()"
                  class="btn btn-secondary w-full text-xs py-1.5 font-bold border-blue-300 text-blue-800 hover:bg-blue-100"
                >
                  View Price Explanation
                </button>
              </div>

              <!-- Action 4: Request Price Review -->
              <div class="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200 flex flex-col justify-between space-y-2">
                <div>
                  <div class="text-xs font-bold text-amber-900">4. Request Price Review</div>
                  <p class="text-[11px] text-slate-600 mt-0.5">Submit tariff exception to grid operator.</p>
                </div>
                <button 
                  onclick="window.SellerDashboardView.openPriceReviewModal('${householdId}', ${effectiveAvailableKWh})"
                  class="btn btn-secondary w-full text-xs py-1.5 font-bold border-amber-300 text-amber-800 hover:bg-amber-100"
                >
                  Request Price Review
                </button>
              </div>
            </div>

            <!-- PROPOSE PREFERRED PRICE WITHIN ACTIVE PERMITTED BAND -->
            <div id="seller-sell-form" class="pt-4 border-t border-slate-100 space-y-3">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  ${hasActiveOffer && uncomSurplusNum <= 0 ? 'Update Active Offer (Permitted Band: ₹2.00 – ₹8.00/kWh)' : 'Sell Surplus Electricity (Permitted Band: ₹2.00 – ₹8.00/kWh)'}
                </span>
                <button onclick="document.getElementById('seller-sales-section')?.scrollIntoView({ behavior: 'smooth' })" class="text-[11px] text-emerald-700 hover:underline font-bold">
                  5. View My Sales &rarr;
                </button>
              </div>
              <form onsubmit="window.SellerDashboardView.handlePreferredPriceSubmit(event, '${householdId}', ${effectiveAvailableKWh})" class="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label class="input-label" for="seller-pref-qty">Surplus Energy (kWh)</label>
                  <input 
                    id="seller-pref-qty" 
                    type="number" 
                    step="0.1" 
                    min="0.1" 
                    max="${Math.max(0.1, surNum).toFixed(2)}" 
                    value="${Math.max(0.1, effectiveAvailableKWh).toFixed(2)}" 
                    oninput="window.SellerDashboardView.updateLiveEarnings()"
                    required 
                    class="input-field text-xs font-mono bg-white" 
                    ${surNum <= 0 ? 'disabled' : ''}
                  />
                </div>
                <div>
                  <label class="input-label" for="seller-pref-price">Asking Price (₹/kWh)</label>
                  <input 
                    id="seller-pref-price" 
                    type="number" 
                    step="0.05" 
                    min="2.00"
                    max="8.00"
                    value="${(hasActiveOffer && uncomSurplusNum <= 0 ? firstActiveOffer.askingPriceINR : recommendedPrice).toFixed(2)}" 
                    oninput="window.SellerDashboardView.updateLiveEarnings()"
                    required 
                    class="input-field text-xs font-mono bg-white" 
                    ${surNum <= 0 ? 'disabled' : ''}
                  />
                </div>
                <div class="text-[11px] text-slate-500 py-2">
                  Allowed Range: <span class="font-bold text-slate-800">₹2.00</span> to <span class="font-bold text-slate-800">₹8.00</span>/kWh.
                </div>
                <div>
                  <button 
                    type="submit" 
                    class="btn btn-primary w-full text-xs py-2 font-bold shadow-sm"
                    ${surNum <= 0 ? 'disabled' : ''}
                  >
                    <span>${hasActiveOffer && uncomSurplusNum <= 0 ? 'Update Asking Price' : 'Sell Surplus Electricity'}</span>
                  </button>
                </div>
              </form>

              <!-- LIVE ESTIMATED EARNINGS BADGE -->
              <div class="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center justify-between">
                <span>Estimated Gross Earnings:</span>
                <strong id="seller-live-earnings-val" class="font-mono text-sm text-emerald-800 font-bold">
                  ₹${(Math.max(0.1, effectiveAvailableKWh) * (hasActiveOffer && uncomSurplusNum <= 0 ? firstActiveOffer.askingPriceINR : recommendedPrice)).toFixed(2)}
                </strong>
              </div>

              <!-- LIVE REJECTION ALERT CONTAINER (IF REJECTED) -->
              <div id="seller-rejection-alert" class="hidden mt-4 p-4 bg-red-50 border border-red-300 rounded-xl text-xs text-red-900 space-y-2">
                <!-- Injected dynamically on validation rejection -->
              </div>
            </div>
          </div>

          <!-- SECTION B: MY ACTIVE OFFERS -->
          <div class="card p-5 bg-white space-y-3">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 class="text-section-heading text-slate-800">My Active Offers (${activeOffers.length})</h2>
              <span class="text-caption text-slate-400">Open listings for interval ${data.currentHourLabel}</span>
            </div>

            ${activeOffers.length === 0 ? `
              <div class="p-6 text-center text-slate-400 text-xs">
                You currently have no open offers listed for this hour. Accept the recommended price above to publish your surplus.
              </div>
            ` : `
              <div class="table-wrapper">
                <table class="grid-table">
                  <thead>
                    <tr>
                      <th>Offer ID</th>
                      <th>Interval</th>
                      <th>Offered Quantity</th>
                      <th>Remaining Surplus</th>
                      <th>Asking Price</th>
                      <th>Rule Applied</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${activeOffers.map(o => `
                      <tr>
                        <td class="font-mono font-bold text-slate-800 text-xs">${o.id}</td>
                        <td class="font-mono text-xs">${String(o.hour !== undefined ? o.hour : data.currentHour).padStart(2, '0')}:00</td>
                        <td class="font-mono font-bold text-slate-900">${(o.quantityKWh || o.energyKWh).toFixed(2)} kWh</td>
                        <td class="font-mono font-bold text-emerald-700">${o.remainingKWh.toFixed(2)} kWh</td>
                        <td class="font-mono font-bold text-slate-800">₹${o.askingPriceINR.toFixed(2)}/kWh</td>
                        <td><span class="badge badge-purple text-[10px] font-mono">${o.ruleId || 'RULE-TN-SIM-2026-V1'}</span></td>
                        <td><span class="badge badge-emerald text-[10px]">${o.status}</span></td>
                        <td>
                          <div class="flex items-center gap-1.5">
                            <button 
                              onclick="window.SellerDashboardView.openEditOfferModal('${o.id}', ${o.remainingKWh}, ${o.askingPriceINR})"
                              class="btn btn-secondary text-[11px] py-1 px-2 border-slate-300 text-slate-700 font-semibold hover:bg-slate-100"
                            >
                              Update Price
                            </button>
                            <button 
                              onclick="window.SellerDashboardView.handleCancelOffer('${o.id}')"
                              class="btn btn-danger text-[11px] py-1 px-2 font-semibold"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

          <!-- SECTION C: INCOMING BUYER DEMAND -->
          <div class="card p-5 bg-white space-y-3">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 class="text-section-heading text-slate-800">Incoming Buyer Demand (${incomingBids.length} Active Demands)</h2>
                <p class="text-caption text-slate-500">Live demand from ordinary grid-connected households and shops</p>
              </div>
            </div>

            ${incomingBids.length === 0 ? `
              <div class="p-6 text-center text-slate-400 text-xs">No active buyer demand orders currently open.</div>
            ` : `
              <div class="table-wrapper">
                <table class="grid-table">
                  <thead>
                    <tr>
                      <th>Buyer Household</th>
                      <th>Zone</th>
                      <th>Requested Energy</th>
                      <th>Max Willingness to Pay</th>
                      <th>Status</th>
                      <th>Expected Midpoint</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${incomingBids.map(b => {
                      const estimatedPrice = Number(((recommendedPrice + b.maxBidINR) / 2).toFixed(2));
                      return `
                        <tr>
                          <td class="font-semibold text-slate-800">
                            ${b.householdName}
                            <div class="text-[10px] font-mono text-slate-400">${b.householdId}</div>
                          </td>
                          <td class="font-mono text-xs font-bold text-purple-700">${b.zone || 'ZONE-A'}</td>
                          <td class="font-mono font-bold text-blue-700">${b.remainingKWh.toFixed(2)} kWh</td>
                          <td class="font-mono font-bold text-slate-800">₹${b.maxBidINR.toFixed(2)}/kWh</td>
                          <td><span class="badge badge-blue text-[10px]">${b.status}</span></td>
                          <td class="font-mono text-emerald-700 font-semibold text-xs">
                            ~₹${estimatedPrice.toFixed(2)}/kWh
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

          <!-- SECTION D: MY COMPLETED SALES & ITEMIZATION -->
          <div class="card p-5 bg-white space-y-3">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 class="text-section-heading text-slate-800">My Completed Sales Trades (${salesTrades.length})</h2>
                <span class="text-caption text-slate-400">Matched transactions and transparent revenue allocations</span>
              </div>
            </div>

            ${salesTrades.length === 0 ? `
              <div class="p-6 text-center text-slate-400 text-xs">
                No trades completed yet for this household. Accept the recommended price or step the simulation.
              </div>
            ` : `
              <div class="table-wrapper">
                <table class="grid-table">
                  <thead>
                    <tr>
                      <th>Tx ID</th>
                      <th>Interval</th>
                      <th>Buyer & Zone</th>
                      <th>Injected Units</th>
                      <th>Clearing Price</th>
                      <th>Gross Revenue</th>
                      <th>Platform Fee</th>
                      <th>Net Proceeds</th>
                      <th>Extra vs Floor</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${salesTrades.map(t => {
                      const gross = Number(t.sellerEnergyRevenueINR || t.totalValueINR || 0);
                      const fee = Number(t.platformFeeINR || 0);
                      const net = Number(t.sellerNetProceedsINR || gross);
                      const extra = Number(t.sellerExtraEarningsINR || t.sellerAdditionalEarningsINR || 0);
                      return `
                        <tr>
                          <td class="font-mono font-bold text-slate-800 text-xs">${t.tradeId}</td>
                          <td class="font-mono text-xs">${String(t.simulationHour).padStart(2, '0')}:00</td>
                          <td class="font-semibold text-slate-800">
                            ${t.buyerName}
                            <span class="badge badge-slate text-[10px] ml-1 font-mono">${t.buyerZone || 'ZONE-A'}</span>
                          </td>
                          <td class="font-mono font-bold text-slate-900">${t.energyKWh.toFixed(2)} kWh</td>
                          <td class="font-mono font-bold text-emerald-700">₹${t.tradePriceINR.toFixed(2)}</td>
                          <td class="font-mono font-bold text-slate-800">₹${gross.toFixed(2)}</td>
                          <td class="font-mono text-slate-500">₹${fee.toFixed(2)}</td>
                          <td class="font-mono font-bold text-emerald-700">₹${net.toFixed(2)}</td>
                          <td class="font-mono font-bold text-emerald-700">+₹${extra.toFixed(2)}</td>
                          <td><span class="badge badge-emerald text-[10px]">${t.settlementStatus || t.status}</span></td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

          <!-- SECTION E: EARNINGS ANALYTICS -->
          <div class="card p-5 bg-white space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 class="text-section-heading text-slate-800">Earnings Analytics & Revenue Distinction</h2>
                <p class="text-caption text-slate-500">Distinction between Gross Revenue and Net Profit above Discom feed-in floor</p>
              </div>
            </div>

            <div class="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
              <div class="font-bold">
                Revenue vs. Profit Distinction
              </div>
              <p>
                Gross Sales Revenue is <span class="font-bold">₹${totalRevenueINR.toFixed(2)}</span>. Under the standard Discom export tariff of ₹2.00/kWh, you would have received only ₹${(totalSoldKWh * exportFloor).toFixed(2)}. By participating in SolarShare, your net additional earnings premium is <span class="font-bold text-emerald-800">+₹${extraEarningsAboveFloor.toFixed(2)}</span>.
              </p>
            </div>
          </div>

          <!-- SECTION F: MY TRANSACTION LEDGER HISTORY -->
          <div class="card p-5 bg-white space-y-3">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 class="text-section-heading text-slate-800">Cryptographic Ledger Audit Chain</h2>
              <span class="text-caption text-slate-400 font-mono">Restricted to Prosumer ${householdId}</span>
            </div>

            <div class="table-wrapper">
              <table class="grid-table text-xs">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>TX ID</th>
                    <th>Buyer & Zone</th>
                    <th>Injected / Delivered</th>
                    <th>Clearing Price</th>
                    <th>Net Proceeds</th>
                    <th>Discom Baseline</th>
                    <th>Net Extra Gain</th>
                    <th>Ledger Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${salesTrades.length === 0 ? `
                    <tr><td colspan="9" class="text-center py-6 text-slate-400 text-xs">No transaction records found for this account.</td></tr>
                  ` : salesTrades.map(t => {
                    const injected = Number(t.energyKWh || 0);
                    const delivered = Number(t.deliveredEnergyKWh !== undefined ? t.deliveredEnergyKWh : injected);
                    const tradePrice = Number(t.tradePriceINR || 0);
                    const revenue = Number(t.sellerEnergyRevenueINR !== undefined ? t.sellerEnergyRevenueINR : (t.totalValueINR || (injected * tradePrice)));
                    const baseline = Number((injected * exportFloor).toFixed(2));
                    const extraGain = Number(t.sellerExtraEarningsINR !== undefined ? t.sellerExtraEarningsINR : (revenue - baseline));
                    const bZone = t.buyerZone || 'ZONE-A';
                    const crossZone = Boolean(t.isCrossZone);

                    return `
                    <tr>
                      <td class="font-mono text-slate-500">${new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td class="font-mono font-bold text-slate-800">${t.tradeId || t.transactionId}</td>
                      <td>
                        <div class="font-semibold text-slate-800">${t.buyerName}</div>
                        <div class="flex items-center gap-1 mt-0.5">
                          <span class="badge text-[10px] font-mono ${crossZone ? 'badge-amber' : 'badge-slate'}">${bZone}</span>
                          ${crossZone ? '<span class="text-[10px] text-amber-700 font-bold">Intertie</span>' : '<span class="text-[10px] text-slate-400">Local</span>'}
                        </div>
                      </td>
                      <td class="font-mono">
                        <div class="font-bold text-emerald-800">${injected.toFixed(2)} kWh</div>
                        <div class="text-[10px] text-slate-400">Delivered: ${delivered.toFixed(2)} kWh</div>
                      </td>
                      <td class="font-mono font-bold text-emerald-700">₹${tradePrice.toFixed(2)}/kWh</td>
                      <td class="font-mono font-bold text-slate-900">₹${revenue.toFixed(2)}</td>
                      <td class="font-mono text-slate-500">₹${baseline.toFixed(2)}</td>
                      <td class="font-mono font-bold text-emerald-700">+₹${extraGain.toFixed(2)}</td>
                      <td><span class="badge badge-verified text-[10px]">Verified</span></td>
                    </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <!-- MODAL CONTAINER (FOR PRICE EXPLANATION AND REVIEW) -->
        <div id="seller-modal-container"></div>
      `;
    } catch (err) {
      root.innerHTML = `<div class="p-8 text-center text-red-600 text-xs">Error loading seller dashboard: ${err.message}</div>`;
    }
  },

  // 1-Click Accept Recommended Price
  async handleAcceptRecommendedPrice(householdId, qty, price) {
    if (qty <= 0) {
      window.Toast.error('You do not have any solar surplus available to offer.');
      return;
    }
    try {
      const res = await window.API.submitOffer(householdId, qty, price);
      window.Toast.success(res.message || `Accepted recommended price ₹${price.toFixed(2)}/kWh! Offer active for ${qty.toFixed(2)} kWh.`);
      this.render();
    } catch (err) {
      window.Toast.error(`Could not publish offer: ${err.message}`);
    }
  },

  // Preferred Price Submit with strict rule validation and rejection logging
  async handlePreferredPriceSubmit(e, householdId, maxSurplus) {
    e.preventDefault();
    const alertBox = document.getElementById('seller-rejection-alert');
    if (alertBox) alertBox.classList.add('hidden');

    const qty = parseFloat(document.getElementById('seller-pref-qty').value);
    const price = parseFloat(document.getElementById('seller-pref-price').value);

    // Client-side pre-validation
    if (isNaN(price) || price < 2.00 || price > 8.00) {
      if (alertBox) {
        alertBox.innerHTML = `
          <div class="font-bold flex items-center gap-1.5 text-red-800">
            <span class="badge badge-rejected">Rejected</span>
            <span>Price Proposal Rejected by Rule RULE-TN-SIM-2026-V1</span>
          </div>
          <p class="mt-1">
            Proposed price ₹${isNaN(price) ? '0.00' : price.toFixed(2)}/kWh is outside the active permitted range of ₹2.00 to ₹8.00/kWh.
            Energy must remain above the ₹2.00 export floor and below the ₹8.00 utility import tariff.
          </p>
          <div class="text-[11px] text-slate-500 italic mt-1">
            "Simulation rules — pending regulatory verification"
          </div>
          <div class="pt-2">
            <button 
              type="button"
              onclick="window.SellerDashboardView.openPriceReviewModal('${householdId}', ${qty}, ${isNaN(price) ? 5.00 : price})"
              class="btn btn-secondary text-xs py-1 px-3 border-red-300 text-red-900 font-bold"
            >
              Request Administrative Price Review
            </button>
          </div>
        `;
        alertBox.classList.remove('hidden');
      }
      window.Toast.error(`Price ₹${price}/kWh violates active trading rule limits.`);
      return;
    }

    try {
      const res = await window.API.submitOffer(householdId, qty, price);
      window.Toast.success(res.message || 'Preferred price approved and offer published!');
      this.render();
    } catch (err) {
      if (alertBox) {
        alertBox.innerHTML = `
          <div class="font-bold flex items-center gap-1.5 text-red-800">
            <span class="badge badge-rejected">Rejected</span>
            <span>Offer Rejected by Pricing Rule</span>
          </div>
          <p class="mt-1">${err.message}</p>
          <div class="pt-2">
            <button 
              type="button"
              onclick="window.SellerDashboardView.openPriceReviewModal('${householdId}', ${qty}, ${price})"
              class="btn btn-secondary text-xs py-1 px-3 border-red-300 text-red-900 font-bold"
            >
              Request Formal Price Review
            </button>
          </div>
        `;
        alertBox.classList.remove('hidden');
      }
      window.Toast.error(`Submission rejected: ${err.message}`);
    }
  },

  // Open Transparent Price Explanation Modal
  openPriceExplanationModal() {
    const modalRoot = document.getElementById('seller-modal-container');
    if (!modalRoot) return;

    const p = this.currentPriceResult || {};
    const base = Number(p.basePriceINR || 5.00).toFixed(2);
    const demandAdj = Number(p.demandAdjustmentINR || 0).toFixed(2);
    const timeAdj = Number(p.timeOfDayAdjustmentINR || 0).toFixed(2);
    const seasonAdj = Number(p.seasonalAdjustmentINR || 0).toFixed(2);
    const finalPrice = Number(p.recommendedPriceINR || 5.00).toFixed(2);

    modalRoot.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-base font-bold text-slate-900">Recommended Price Explanation</h3>
              <span class="text-[10px] text-slate-400">Dynamic Pricing Formulation</span>
            </div>
            <button onclick="document.getElementById('seller-modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
          </div>

          <div class="space-y-3 text-xs text-slate-600">
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono">
              <div class="text-[11px] text-slate-400">Mathematical Formulation:</div>
              <div class="font-bold text-slate-900 mt-1">
                Price = Base (₹${base}) + Demand (₹${demandAdj}) + Time (₹${timeAdj}) + Season (₹${seasonAdj})
              </div>
              <div class="text-emerald-700 font-bold text-sm mt-1">Clearing Rate: ₹${finalPrice}/kWh</div>
            </div>

            <div class="space-y-2">
              <div class="flex items-start gap-2">
                <span class="font-bold text-slate-800 w-28 shrink-0">Current Season:</span>
                <span>${p.seasonName || 'Monsoon'} (${seasonAdj >= 0 ? '+' : ''}₹${seasonAdj}/kWh)</span>
              </div>
              <div class="flex items-start gap-2">
                <span class="font-bold text-slate-800 w-28 shrink-0">Time of Day:</span>
                <span>Interval ${p.currentHourLabel || `${p.currentHour || 12}:00`} (${timeAdj >= 0 ? '+' : ''}₹${timeAdj}/kWh solar adjustment)</span>
              </div>
              <div class="flex items-start gap-2">
                <span class="font-bold text-slate-800 w-28 shrink-0">Demand Pressure:</span>
                <span>${(Number(p.demandPressure || 0.5) * 100).toFixed(0)}% (Surplus: ${p.totalSurplusKWh || 0} kWh, Deficit: ${p.totalDeficitKWh || 0} kWh)</span>
              </div>
              <div class="flex items-start gap-2">
                <span class="font-bold text-slate-800 w-28 shrink-0">Market State:</span>
                <span>${p.statusLabel || 'Balanced Clean Energy Market'}</span>
              </div>
            </div>

            <div class="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-blue-900 text-[11px] leading-relaxed">
              ${p.priceExplanation || 'During peak midday hours, high rooftop generation discounts energy to incentivize local absorption. Rates remain strictly between ₹2.00 floor and ₹8.00 retail tariff.'}
            </div>

            <div class="text-[10px] text-slate-400 italic">
              Governing Rule: RULE-TN-SIM-2026-V1. "Simulation rules — pending regulatory verification."
            </div>
          </div>

          <div class="pt-3 border-t border-slate-100 flex justify-end">
            <button onclick="document.getElementById('seller-modal-container').innerHTML=''" class="btn btn-primary text-xs py-2 px-4 font-bold">
              Got it
            </button>
          </div>
        </div>
      </div>
    `;
  },

  // Open Price Review Request Modal
  openPriceReviewModal(householdId, surplusKWh = 0, initialPrice = 5.00) {
    const modalRoot = document.getElementById('seller-modal-container');
    if (!modalRoot) return;

    modalRoot.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-base font-bold text-slate-900">Request Administrative Price Review</h3>
              <span class="text-[10px] text-slate-400">Formal Review Queue</span>
            </div>
            <button onclick="document.getElementById('seller-modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
          </div>

          <form onsubmit="window.SellerDashboardView.handleSubmitReview(event, '${householdId}')" class="space-y-4">
            <div>
              <label class="input-label" for="review-price">Requested Selling Price (₹/kWh)</label>
              <input 
                id="review-price" 
                type="number" 
                step="0.10" 
                min="0.50" 
                max="15.00" 
                value="${initialPrice || 5.00}" 
                required 
                class="input-field text-xs font-mono bg-white" 
              />
            </div>

            <div>
              <label class="input-label" for="review-surplus">Estimated Available Surplus (kWh)</label>
              <input 
                id="review-surplus" 
                type="number" 
                step="0.1" 
                value="${surplusKWh || 1.0}" 
                required 
                class="input-field text-xs font-mono bg-white" 
              />
            </div>

            <div>
              <label class="input-label" for="review-reason">Justification / Technical Rationale</label>
              <textarea 
                id="review-reason" 
                rows="3" 
                required 
                placeholder="Explain why this special tariff is requested (e.g., battery storage backup, commercial off-peak supply)..."
                class="input-field text-xs bg-white"
              ></textarea>
            </div>

            <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px]">
              Submitting this request alerts the Company Operator. Once approved, you will be authorized to publish offers at this rate under exception rules.
            </div>

            <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button type="button" onclick="document.getElementById('seller-modal-container').innerHTML=''" class="btn btn-secondary text-xs py-2 px-3">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary text-xs py-2 px-4 font-bold">
                Submit Review Request
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  // Submit Price Review Request
  async handleSubmitReview(e, householdId) {
    e.preventDefault();
    const requestedPriceINR = parseFloat(document.getElementById('review-price').value);
    const surplusKWh = parseFloat(document.getElementById('review-surplus').value);
    const reason = document.getElementById('review-reason').value;

    try {
      const res = await window.API.submitPriceReview({
        householdId,
        requestedPriceINR,
        surplusKWh,
        reason
      });
      document.getElementById('seller-modal-container').innerHTML = '';
      window.Toast.success(`Price review request submitted successfully! (ID: ${res.reviewRequest?.id || 'REV'})`);
    } catch (err) {
      window.Toast.error(`Failed to submit review request: ${err.message}`);
    }
  },

  // Cancel Offer
  async handleCancelOffer(orderId) {
    try {
      await window.API.cancelOrder(orderId);
      window.Toast.success('Energy offer cancelled. Surplus uncommitted.');
      this.render();
    } catch (err) {
      window.Toast.error(`Cancel failed: ${err.message}`);
    }
  },

  // Open Modal to update an existing active offer
  openEditOfferModal(offerId, currentQty, currentPrice) {
    const modalRoot = document.getElementById('seller-modal-container');
    if (!modalRoot) return;

    modalRoot.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-base font-bold text-slate-900">Update Asking Price</h3>
              <span class="text-[10px] text-slate-400 font-mono">Offer: ${offerId}</span>
            </div>
            <button onclick="document.getElementById('seller-modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
          </div>

          <form onsubmit="window.SellerDashboardView.handleUpdateOfferSubmit(event, '${offerId}')" class="space-y-4">
            <div>
              <label class="input-label" for="edit-offer-qty">Offered Surplus Energy (kWh)</label>
              <input 
                id="edit-offer-qty" 
                type="number" 
                step="0.1" 
                min="0.1" 
                value="${Number(currentQty || 0.1).toFixed(2)}" 
                required 
                class="input-field text-xs font-mono bg-white" 
              />
            </div>

            <div>
              <label class="input-label" for="edit-offer-price">Asking Price (₹/kWh)</label>
              <input 
                id="edit-offer-price" 
                type="number" 
                step="0.05" 
                min="2.00" 
                max="8.00" 
                value="${Number(currentPrice || 5.00).toFixed(2)}" 
                required 
                class="input-field text-xs font-mono bg-white" 
              />
              <span class="text-[10px] text-slate-400 mt-1 block">Permitted Band: ₹2.00 – ₹8.00/kWh</span>
            </div>

            <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button type="button" onclick="document.getElementById('seller-modal-container').innerHTML=''" class="btn btn-secondary text-xs py-2 px-3">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary text-xs py-2 px-4 font-bold shadow-sm">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async handleUpdateOfferSubmit(e, offerId) {
    e.preventDefault();
    const qty = parseFloat(document.getElementById('edit-offer-qty').value);
    const price = parseFloat(document.getElementById('edit-offer-price').value);

    try {
      const res = await window.API.updateOffer(offerId, qty, price);
      document.getElementById('seller-modal-container').innerHTML = '';
      window.Toast.success(res.message || 'Offer updated successfully!');
      this.render();
    } catch (err) {
      window.Toast.error(`Update failed: ${err.message}`);
    }
  },

  // Live estimated earnings calculator
  updateLiveEarnings() {
    const qty = parseFloat(document.getElementById('seller-pref-qty')?.value) || 0;
    const price = parseFloat(document.getElementById('seller-pref-price')?.value) || 0;
    const el = document.getElementById('seller-live-earnings-val');
    if (el) {
      el.textContent = `₹${(qty * price).toFixed(2)}`;
    }
  }
};
