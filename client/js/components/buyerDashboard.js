/**
 * SolarShare - Buyer / Consumer Dedicated Dashboard
 * Redesigned around simplified ordinary consumer experience:
 * 1. Prominent "Solar panels are not required" banner.
 * 2. Compares available seller clean energy offers ranked by lowest delivered cost.
 * 3. Two simple direct purchase actions: "Choose Offer" -> "Confirm Purchase".
 * 4. No manual bidding or auction spreads required.
 * 5. Explains full vs partial allocation and reports unmet demand.
 * 6. Itemizes delivered cost, transparent platform & wheeling fees, and bill savings vs grid benchmark.
 */

window.BuyerDashboardView = {
  selectedOffer: null,

  async render() {
    const root = document.getElementById('view-content');
    if (!root) return;

    const user = window.App.currentUser;
    if (!user || (!user.householdId && user.role !== 'ADMIN')) {
      root.innerHTML = `<div class="p-8 text-center text-slate-500">Please select a Buyer / Consumer account to view this dashboard.</div>`;
      return;
    }

    const householdId = user.householdId || 'HH-02';

    try {
      const [data, rankedOffersData] = await Promise.all([
        window.API.getHousehold(householdId),
        window.API.getRankedOffers(user.zone || 'ZONE-B').catch(() => ({ offers: [] }))
      ]);

      const hh = data.household;
      const m = data.metrics;
      const trades = data.trades || [];
      const purchaseTrades = trades.filter(t => t.buyerId === householdId);
      const rankedOffers = rankedOffersData.offers || [];

      // Grid Import Tariff baseline: ₹8.00/kWh
      const gridTariff = 8.00;

      // Realized metrics with strict safe numerical fallbacks
      const demNum = Number(m?.demandKWh || 0);
      const defNum = Number(m?.deficitKWh || 0);
      const comDeficitNum = Number(m?.committedDeficitKWh || 0);
      const remDeficitNum = Number(m?.remainingDeficitKWh !== undefined ? m.remainingDeficitKWh : Math.max(0, defNum - comDeficitNum));
      const totalPurchasedKWh = Number(m?.totalEnergyBoughtKWh || 0);
      const totalExpenditureINR = Number(m?.totalExpenditureINR || 0);
      const avgP2pPrice = totalPurchasedKWh > 0 ? Number((totalExpenditureINR / totalPurchasedKWh).toFixed(2)) : 0;
      const savingsPerUnit = totalPurchasedKWh > 0 ? Number((gridTariff - avgP2pPrice).toFixed(2)) : 0;
      const totalRealizedSavingsINR = Number(m?.totalBuyerSavingsINR || 0);
      const completedPurchasesCount = purchaseTrades.length;

      this.currentData = data;
      this.currentHousehold = hh;
      this.currentMetrics = m;
      this.remDeficitNum = remDeficitNum;
      this.avgP2pPrice = avgP2pPrice;
      this.savingsPerUnit = savingsPerUnit;
      this.totalRealizedSavingsINR = totalRealizedSavingsINR;
      this.totalPurchasedKWh = totalPurchasedKWh;

      root.innerHTML = `
        <div class="space-y-6">
          
          <!-- TOP BANNER: WELCOME, IDENTITY & SOLAR NOT REQUIRED BADGE -->
          <div class="card p-5 card-accent-blue bg-white flex flex-wrap items-center justify-between gap-4">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-page-title text-slate-900">Welcome, ${hh.name}</h1>
                <span class="badge badge-blue text-xs uppercase font-bold">Electricity Consumer</span>
                <span class="font-mono text-xs text-slate-500 font-semibold">${hh.id}</span>
                <span class="badge badge-purple text-xs font-mono font-bold">${hh.zone || 'ZONE-B'}</span>
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Solar panels are not required
                </span>
              </div>
              <p class="text-caption text-slate-600 mt-1.5 max-w-2xl">
                Ordinary households, apartments, offices, and shops participate using their existing grid electricity connection (<span class="font-semibold text-emerald-700">${hh.gridConnectionStatus || 'CONNECTED'}</span> | Sanctioned Load: <span class="font-mono font-semibold text-slate-700">${hh.importCapacityKW || 10} kW</span>).
              </p>
            </div>
            
            <div class="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3.5 py-2 rounded-xl text-xs">
              <span class="text-slate-600">Simulated Interval:</span>
              <span class="font-bold font-mono text-blue-800">${data.currentHourLabel}</span>
              <span class="text-slate-300">|</span>
              <span class="text-slate-600">Utility Discom Cap:</span>
              <span class="font-bold text-slate-900">₹${gridTariff.toFixed(2)}/kWh</span>
            </div>
          </div>

          <!-- BUYER WORKING ACTIONS TOOLBAR -->
          <div class="card p-3.5 bg-white border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-bold text-slate-700 mr-1">Working Actions:</span>
              <button 
                onclick="document.getElementById('buyer-offers-section')?.scrollIntoView({ behavior: 'smooth' })" 
                class="btn btn-secondary text-xs py-1.5 px-3 font-semibold"
              >
                Browse Solar Offers
              </button>
              <button 
                onclick="document.getElementById('buyer-smart-buy-section')?.scrollIntoView({ behavior: 'smooth' })" 
                class="btn btn-primary text-xs py-1.5 px-3 font-bold"
              >
                Buy Electricity
              </button>
              <button 
                onclick="document.getElementById('buyer-purchases-section')?.scrollIntoView({ behavior: 'smooth' })" 
                class="btn btn-secondary text-xs py-1.5 px-3 font-semibold"
              >
                View My Purchases
              </button>
              <button 
                onclick="window.BuyerDashboardView.openSavingsModal()" 
                class="btn btn-secondary text-xs py-1.5 px-3 font-bold text-emerald-700 border-emerald-200 bg-emerald-50/50"
              >
                View My Savings
              </button>
            </div>
            <button 
              onclick="window.BuyerDashboardView.openPriceExplanationModal()" 
              class="btn btn-secondary text-xs py-1.5 px-3 font-medium text-slate-600"
            >
              Price Explanation
            </button>
          </div>

          <!-- TOP 10 KEY METRIC CARDS -->
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <!-- 1. Current Electricity Demand -->
            <div class="card p-3.5 bg-white">
              <span class="stat-label">Current Demand</span>
              <div class="text-metric-value text-blue-700 mt-0.5">${demNum.toFixed(2)} <span class="text-xs font-semibold text-slate-500">kWh</span></div>
              <div class="text-caption text-slate-400 mt-0.5">Electricity required this interval</div>
            </div>

            <!-- 2. Energy Deficit -->
            <div class="card p-3.5 bg-white">
              <span class="stat-label">Energy Deficit</span>
              <div class="text-metric-value text-amber-600 mt-0.5">${defNum.toFixed(2)} <span class="text-xs font-semibold text-slate-500">kWh</span></div>
              <div class="text-caption text-slate-400 mt-0.5">Total electricity to procure</div>
            </div>

            <!-- 3. Available Eligible Offers -->
            <div class="card p-3.5 bg-white">
              <span class="stat-label">Available Solar Offers</span>
              <div class="text-metric-value text-emerald-700 mt-0.5">${rankedOffers.length} <span class="text-xs font-semibold text-slate-500">offers</span></div>
              <div class="text-caption text-slate-400 mt-0.5">Ready for direct purchase</div>
            </div>

            <!-- 4. Average P2P Purchase Price -->
            <div class="card p-3.5 bg-white">
              <span class="stat-label">Avg Procured Price</span>
              <div class="text-metric-value text-slate-800 mt-0.5">₹${avgP2pPrice.toFixed(2)} <span class="text-xs font-semibold text-slate-500">/kWh</span></div>
              <div class="text-caption text-slate-400 mt-0.5">Realized clearing rate</div>
            </div>

            <!-- 5. Applicable Grid Tariff -->
            <div class="card p-3.5 bg-white">
              <span class="stat-label">Discom Benchmark</span>
              <div class="text-metric-value text-slate-800 mt-0.5">₹${gridTariff.toFixed(2)} <span class="text-xs font-semibold text-slate-500">/kWh</span></div>
              <div class="text-caption text-slate-400 mt-0.5">Standard retail tariff ceiling</div>
            </div>

            <!-- 6. Savings Per Unit -->
            <div class="card p-3.5 bg-white card-accent-green">
              <span class="stat-label">Savings Per Unit</span>
              <div class="text-metric-value text-emerald-700 mt-0.5">₹${savingsPerUnit.toFixed(2)} <span class="text-xs font-semibold text-slate-500">/kWh</span></div>
              <div class="text-caption text-slate-400 mt-0.5">Discom Cap − P2P Price</div>
            </div>

            <!-- 7. Total Realized Savings -->
            <div class="card p-3.5 bg-white card-accent-green">
              <span class="stat-label">Total Realized Savings</span>
              <div class="text-metric-value text-emerald-700 mt-0.5">₹${totalRealizedSavingsINR.toFixed(2)}</div>
              <div class="text-caption text-slate-400 mt-0.5">Cumulative bill reduction</div>
            </div>

            <!-- 8. Total Purchased Energy -->
            <div class="card p-3.5 bg-white">
              <span class="stat-label">Purchased Energy</span>
              <div class="text-metric-value text-blue-800 mt-0.5">${totalPurchasedKWh.toFixed(2)} <span class="text-xs font-semibold text-slate-500">kWh</span></div>
              <div class="text-caption text-slate-400 mt-0.5">Delivered clean solar electricity</div>
            </div>

            <!-- 9. Completed Purchases -->
            <div class="card p-3.5 bg-white">
              <span class="stat-label">Completed Purchases</span>
              <div class="text-metric-value text-slate-800 mt-0.5">${completedPurchasesCount}</div>
              <div class="text-caption text-slate-400 mt-0.5">Settled peer transactions</div>
            </div>

            <!-- 10. Remaining Eligible Deficit -->
            <div class="card p-3.5 bg-white border-blue-300">
              <span class="stat-label">Unmet Deficit</span>
              <div class="text-metric-value text-blue-700 mt-0.5">${remDeficitNum.toFixed(2)} <span class="text-xs font-semibold text-slate-500">kWh</span></div>
              <div class="text-caption text-slate-400 mt-0.5">Eligible for direct purchase</div>
            </div>
          </div>

          <!-- BUY ELECTRICITY: SMART MULTI-SELLER ALLOCATION -->
          <div id="buyer-smart-buy-section" class="card p-5 bg-white border border-emerald-300 shadow-sm space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="text-base font-bold text-slate-900">Buy Electricity</h2>
                  <span class="badge badge-emerald text-[10px] font-bold uppercase">Smart Allocation</span>
                </div>
                <p class="text-xs text-slate-500 mt-1 max-w-2xl">
                  Enter your required clean energy quantity. SolarShare automatically allocates energy from the lowest-cost available solar prosumers and calculates your exact bill savings before you confirm.
                </p>
              </div>
              <div class="text-xs bg-blue-50 text-blue-900 border border-blue-200 px-3 py-1.5 rounded-xl font-medium">
                Unmet Deficit: <span class="font-bold font-mono text-blue-800">${remDeficitNum.toFixed(2)} kWh</span>
              </div>
            </div>

            <form onsubmit="window.BuyerDashboardView.handleSmartQuote(event)" class="flex flex-wrap items-end gap-3 text-xs">
              <div class="w-48">
                <label class="block text-[11px] font-semibold text-slate-700 mb-1" for="smart-purchase-qty">Requested Energy (kWh):</label>
                <input 
                  id="smart-purchase-qty" 
                  type="number" 
                  step="0.1" 
                  min="0.1" 
                  value="${remDeficitNum > 0 ? remDeficitNum.toFixed(1) : '6.0'}" 
                  required 
                  class="w-full text-xs py-2 px-3 border border-slate-300 rounded-lg bg-white font-mono font-bold" 
                  placeholder="e.g. 6.0"
                />
              </div>

              <button 
                type="submit" 
                class="btn btn-primary text-xs py-2 px-4 font-bold shadow-sm"
              >
                Review Allocation & Quote
              </button>
            </form>
          </div>

          <!-- DIRECT PURCHASE MARKETPLACE COMPARISON LIST (NO MANUAL BIDDING) -->
          <div id="buyer-offers-section" class="card p-5 bg-white border border-blue-200 shadow-sm space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 class="text-base font-bold text-slate-900">Compare Available Solar Energy Offers & Purchase Directly</h2>
                <p class="text-xs text-slate-500 mt-1 max-w-2xl">
                  Choose a published seller offer from the comparison list below. No complex bidding, asks, or auctions required.
                  Ranked by lowest delivered unit cost per kWh.
                </p>
              </div>
              <div class="text-xs bg-emerald-50 text-emerald-900 border border-emerald-200 px-3 py-1.5 rounded-xl font-medium">
                Unmet Energy Deficit: <span class="font-bold font-mono text-emerald-700">${remDeficitNum.toFixed(2)} kWh</span>
              </div>
            </div>

            <!-- OFFER FILTER CONTROLS -->
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div class="flex flex-wrap items-center gap-3">
                <div class="flex items-center gap-1.5">
                  <label class="text-[11px] font-semibold text-slate-600" for="buyer-filter-zone">Zone:</label>
                  <select id="buyer-filter-zone" onchange="window.BuyerDashboardView.filterOffers()" class="text-xs py-1 px-2 border border-slate-200 rounded-lg bg-white">
                    <option value="">All Zones</option>
                    <option value="ZONE-A">Zone A</option>
                    <option value="ZONE-B">Zone B</option>
                    <option value="ZONE-C">Zone C</option>
                  </select>
                </div>
                <div class="flex items-center gap-1.5">
                  <label class="text-[11px] font-semibold text-slate-600" for="buyer-filter-max-price">Max Delivered Cost:</label>
                  <input id="buyer-filter-max-price" type="number" step="0.5" placeholder="₹8.00" oninput="window.BuyerDashboardView.filterOffers()" class="w-20 text-xs py-1 px-2 border border-slate-200 rounded-lg bg-white font-mono" />
                </div>
              </div>
              <span id="buyer-offers-count" class="text-[11px] text-slate-500 font-medium">Showing ${rankedOffers.length} available offers</span>
            </div>

            ${rankedOffers.length === 0 ? `
              <div class="p-8 text-center text-slate-400 text-xs">
                No active seller offers available at this interval. Prosumers are generating clean energy — step simulation or refresh shortly.
              </div>
            ` : `
              <div class="table-wrapper">
                <table class="grid-table text-xs">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Seller Prosumer</th>
                      <th>Zone & Route</th>
                      <th>Available Supply</th>
                      <th>Seller Base Rate</th>
                      <th>Wheeling & Fees</th>
                      <th>Loss Est.</th>
                      <th>Delivered Cost</th>
                      <th>Discom Savings</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody id="buyer-offers-tbody">
                    ${rankedOffers.map((o, idx) => {
                      const isSelf = o.sellerId === householdId;
                      const savingsPerKWh = Number((gridTariff - o.deliveredUnitCostINRPerKWh).toFixed(2));
                      const savingsPercent = Number(((savingsPerKWh / gridTariff) * 100).toFixed(1));
                      return `
                        <tr class="buyer-offer-row ${idx === 0 ? 'bg-emerald-50/30' : ''}" data-zone="${o.sellerZone}" data-delivered-price="${o.deliveredUnitCostINRPerKWh}">
                          <td class="font-bold text-slate-500 text-center">${idx + 1}</td>
                          <td>
                            <div class="font-bold text-slate-900">${o.sellerName}</div>
                            <div class="text-[10px] font-mono text-slate-400">${o.sellerId} • ${o.offerId}</div>
                          </td>
                          <td>
                            <div class="flex items-center gap-1">
                              <span class="badge badge-purple text-[10px] font-mono">${o.sellerZone}</span>
                              <span class="text-slate-400">&rarr;</span>
                              <span class="badge badge-blue text-[10px] font-mono">${o.buyerZone}</span>
                            </div>
                            <div class="text-[10px] ${o.isCrossZone ? 'text-amber-700 font-semibold' : 'text-slate-400'}">
                              ${o.isCrossZone ? 'Cross-Zone Intertie' : 'Local Feeder'}
                            </div>
                          </td>
                          <td class="font-mono font-bold text-slate-900">
                            ${o.availableKWh.toFixed(2)} kWh
                          </td>
                          <td class="font-mono font-semibold text-slate-700">
                            ₹${o.askingPriceINR.toFixed(2)}/kWh
                          </td>
                          <td class="font-mono text-slate-600">
                            +₹${(o.platformFeeINRPerKWh + o.wheelingFeeINRPerKWh).toFixed(2)}
                            <div class="text-[9px] text-slate-400">Fee: ₹${o.platformFeeINRPerKWh.toFixed(2)} | Wheel: ₹${o.wheelingFeeINRPerKWh.toFixed(2)}</div>
                          </td>
                          <td class="font-mono text-slate-500">
                            ${o.lossPercentage}%
                          </td>
                          <td class="font-mono font-extrabold text-emerald-800 text-sm">
                            ₹${o.deliveredUnitCostINRPerKWh.toFixed(2)}<span class="text-[10px] font-normal text-slate-500">/kWh</span>
                          </td>
                          <td class="font-mono font-bold text-emerald-700">
                            ${savingsPerKWh > 0 ? `+₹${savingsPerKWh.toFixed(2)} (${savingsPercent}%)` : '₹0.00'}
                          </td>
                          <td>
                            ${isSelf ? `
                              <span class="badge badge-slate text-[10px]">Your Own Offer</span>
                            ` : `
                              <div class="flex items-center gap-1.5">
                                <button 
                                  onclick='window.BuyerDashboardView.openOfferDetailsModal(${JSON.stringify(o).replace(/'/g, "&apos;")}, ${remDeficitNum})'
                                  class="btn btn-secondary text-xs py-1 px-2 font-medium"
                                  title="View Seller Type, Capacity & Cost Breakdown"
                                >
                                  View Offer
                                </button>
                                <button 
                                  onclick='window.BuyerDashboardView.openPurchaseModal(${JSON.stringify(o).replace(/'/g, "&apos;")}, ${remDeficitNum})'
                                  class="btn btn-primary text-xs py-1 px-2.5 font-bold shadow-xs"
                                  ${remDeficitNum <= 0 ? 'title="No unmet deficit"' : ''}
                                >
                                  Choose Offer
                                </button>
                              </div>
                            `}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

          <!-- COMPLETED PURCHASES & SETTLED TRANSACTIONS -->
          <div id="buyer-purchases-section" class="card p-5 bg-white space-y-3">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 class="text-section-heading text-slate-800">My Completed Clean Energy Purchases (${purchaseTrades.length})</h2>
                <span class="text-caption text-slate-400">Settled peer transactions and itemized financial breakdown</span>
              </div>
            </div>

            ${purchaseTrades.length === 0 ? `
              <div class="p-6 text-center text-slate-400 text-xs">
                No clean energy purchases settled yet. Select an available offer above to buy solar surplus directly.
              </div>
            ` : `
              <div class="table-wrapper">
                <table class="grid-table text-xs">
                  <thead>
                    <tr>
                      <th>Tx ID</th>
                      <th>Interval</th>
                      <th>Seller Prosumer</th>
                      <th>Injected / Delivered</th>
                      <th>Energy Rate</th>
                      <th>Wheeling Fee</th>
                      <th>Platform Fee</th>
                      <th>Total Paid</th>
                      <th>Discom Savings</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${purchaseTrades.map(t => {
                      const injected = Number(t.energyKWh || 0);
                      const delivered = Number(t.deliveredEnergyKWh !== undefined ? t.deliveredEnergyKWh : injected);
                      const energyCost = Number(t.buyerEnergyCostINR || (injected * t.tradePriceINR));
                      const wheeling = Number(t.wheelingFeeINR || 0);
                      const platform = Number(t.platformFeeINR || 0);
                      const totalPaid = Number(t.buyerTotalCostINR || (energyCost + wheeling + platform));
                      const savings = Number(t.buyerSavingsINR || 0);

                      return `
                        <tr>
                          <td class="font-mono font-bold text-slate-800 text-xs">${t.tradeId}</td>
                          <td class="font-mono text-xs">${String(t.simulationHour).padStart(2, '0')}:00</td>
                          <td class="font-semibold text-slate-800">
                            ${t.sellerName}
                            <span class="badge badge-purple text-[10px] ml-1 font-mono">${t.sellerZone || 'ZONE-A'}</span>
                          </td>
                          <td class="font-mono">
                            <div class="font-bold text-slate-900">${delivered.toFixed(2)} kWh</div>
                            <div class="text-[9px] text-slate-400">Injected: ${injected.toFixed(2)} kWh (${t.lossPercentage || 0}% loss)</div>
                          </td>
                          <td class="font-mono text-slate-700">₹${t.tradePriceINR.toFixed(2)}/kWh</td>
                          <td class="font-mono text-slate-500">₹${wheeling.toFixed(2)}</td>
                          <td class="font-mono text-slate-500">₹${platform.toFixed(2)}</td>
                          <td class="font-mono font-bold text-slate-900">₹${totalPaid.toFixed(2)}</td>
                          <td class="font-mono font-bold text-emerald-700">+₹${savings.toFixed(2)}</td>
                          <td>
                            <span class="badge badge-emerald text-[10px]">
                              ${t.settlementType === 'DIRECT_OFFER_PURCHASE' ? 'DIRECT PURCHASE' : 'SETTLED'}
                            </span>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

          <!-- TRANSACTION LEDGER AUDIT -->
          <div class="card p-5 bg-white space-y-3">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 class="text-section-heading text-slate-800">Consumer Ledger Audit History</h2>
              <span class="text-caption text-slate-400 font-mono">Restricted to Consumer ${householdId}</span>
            </div>

            <div class="table-wrapper">
              <table class="grid-table text-xs">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>TX ID</th>
                    <th>Seller & Zone</th>
                    <th>Delivered Energy</th>
                    <th>Total Cost Paid</th>
                    <th>Discom Retail Cost</th>
                    <th>Net Bill Savings</th>
                    <th>Ledger Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${purchaseTrades.length === 0 ? `
                    <tr><td colspan="8" class="text-center py-6 text-slate-400 text-xs">No transaction records found for this account.</td></tr>
                  ` : purchaseTrades.map(t => {
                    const delivered = Number(t.deliveredEnergyKWh !== undefined ? t.deliveredEnergyKWh : t.energyKWh);
                    const totalPaid = Number(t.buyerTotalCostINR || 0);
                    const discomCost = Number(t.utilityBaselineCostINR || (delivered * gridTariff));
                    const savings = Number(t.buyerSavingsINR || (discomCost - totalPaid));

                    return `
                    <tr>
                      <td class="font-mono text-slate-500">${new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td class="font-mono font-bold text-slate-800">${t.tradeId}</td>
                      <td>
                        <div class="font-semibold text-slate-800">${t.sellerName}</div>
                        <div class="text-[10px] text-slate-400 font-mono">${t.sellerZone || 'ZONE-A'}</div>
                      </td>
                      <td class="font-mono font-bold text-blue-800">${delivered.toFixed(2)} kWh</td>
                      <td class="font-mono font-bold text-slate-900">₹${totalPaid.toFixed(2)}</td>
                      <td class="font-mono text-slate-500">₹${discomCost.toFixed(2)}</td>
                      <td class="font-mono font-bold text-emerald-700">+₹${savings.toFixed(2)}</td>
                      <td><span class="badge badge-verified text-[10px]">Verified</span></td>
                    </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <!-- PURCHASE MODAL CONTAINER -->
        <div id="buyer-modal-container"></div>
      `;
    } catch (err) {
      root.innerHTML = `<div class="p-8 text-center text-red-600 text-xs">Error loading buyer dashboard: ${err.message}</div>`;
    }
  },

  // Dynamic Offer Filtering
  filterOffers() {
    const zoneVal = (document.getElementById('buyer-filter-zone')?.value || '').trim();
    const maxPriceVal = parseFloat(document.getElementById('buyer-filter-max-price')?.value);
    const rows = document.querySelectorAll('.buyer-offer-row');
    let visibleCount = 0;

    rows.forEach(row => {
      const rowZone = row.getAttribute('data-zone') || '';
      const rowPrice = parseFloat(row.getAttribute('data-delivered-price') || '0');

      let matches = true;
      if (zoneVal && rowZone !== zoneVal) matches = false;
      if (!isNaN(maxPriceVal) && rowPrice > maxPriceVal) matches = false;

      if (matches) {
        row.style.display = '';
        visibleCount++;
      } else {
        row.style.display = 'none';
      }
    });

    const countEl = document.getElementById('buyer-offers-count');
    if (countEl) {
      countEl.innerText = `Showing ${visibleCount} available offers`;
    }
  },

  // Open Direct Purchase Confirmation Modal
  openPurchaseModal(offer, remainingDeficit) {
    const modalRoot = document.getElementById('buyer-modal-container');
    if (!modalRoot) return;

    this.selectedOffer = offer;
    const defaultQty = Math.max(0.1, Math.min(offer.availableKWh, remainingDeficit > 0 ? remainingDeficit : offer.availableKWh));
    const gridBenchmark = 8.00;

    modalRoot.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-base font-bold text-slate-900">Confirm Clean Energy Purchase</h3>
              <span class="text-[10px] text-slate-400">Direct Purchase Settlement</span>
            </div>
            <button onclick="document.getElementById('buyer-modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
          </div>

          <!-- Chosen Offer Details -->
          <div class="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2 text-xs">
            <div class="flex justify-between items-center">
              <span class="font-bold text-slate-800 text-sm">${offer.sellerName}</span>
              <span class="badge badge-purple font-mono font-bold">${offer.sellerZone} &rarr; ${offer.buyerZone}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-slate-600 pt-1 border-t border-blue-100">
              <div>Available Offer: <span class="font-bold text-slate-900 font-mono">${offer.availableKWh.toFixed(2)} kWh</span></div>
              <div>Seller Ask Rate: <span class="font-bold text-slate-900 font-mono">₹${offer.askingPriceINR.toFixed(2)}/kWh</span></div>
              <div>Wheeling Fee: <span class="font-bold text-slate-900 font-mono">₹${offer.wheelingFeeINRPerKWh.toFixed(2)}/kWh</span></div>
              <div>Platform Fee: <span class="font-bold text-slate-900 font-mono">₹${offer.platformFeeINRPerKWh.toFixed(2)}/kWh</span></div>
            </div>
          </div>

          <form onsubmit="window.BuyerDashboardView.handleConfirmPurchase(event)" class="space-y-4">
            <div>
              <div class="flex justify-between items-center mb-1">
                <label class="input-label" for="purchase-qty">Purchase Quantity (kWh)</label>
                <span class="text-[11px] text-slate-400">Available: ${offer.availableKWh.toFixed(2)} kWh</span>
              </div>
              <input 
                id="purchase-qty" 
                type="number" 
                step="0.1" 
                min="0.1" 
                max="${offer.availableKWh.toFixed(2)}" 
                value="${defaultQty.toFixed(1)}" 
                required 
                oninput="window.BuyerDashboardView.updatePurchaseCalculations()"
                class="input-field text-xs font-mono bg-white" 
              />
              <span class="text-[10px] text-slate-400 mt-1 block">
                Purchasing up to your eligible demand deficit. Partial allocations supported automatically.
              </span>
            </div>

            <!-- Live Itemized Calculation -->
            <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
              <div class="font-bold text-slate-700 text-[11px] uppercase tracking-wide">Itemized Delivered Cost Breakdown</div>
              <div class="flex justify-between text-slate-600">
                <span>Clean Energy Cost:</span>
                <span id="calc-energy-cost" class="font-mono font-semibold">₹0.00</span>
              </div>
              <div class="flex justify-between text-slate-600">
                <span>Wheeling Charge (${offer.isCrossZone ? 'Intertie' : 'Local'}):</span>
                <span id="calc-wheeling-fee" class="font-mono font-semibold">₹0.00</span>
              </div>
              <div class="flex justify-between text-slate-600">
                <span>Platform Transaction Fee (₹0.20/kWh):</span>
                <span id="calc-platform-fee" class="font-mono font-semibold">₹0.00</span>
              </div>
              <div class="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1.5 text-sm">
                <span>Total Estimated Cost:</span>
                <span id="calc-total-cost" class="font-mono text-emerald-800">₹0.00</span>
              </div>
              <div class="flex justify-between text-emerald-700 font-bold pt-1">
                <span>Savings vs Discom (₹8.00/kWh):</span>
                <span id="calc-savings" class="font-mono">+₹0.00 (0%)</span>
              </div>
            </div>

            <div class="text-[10px] text-slate-400 italic">
              Commercial energy matching over shared grid topology. "Simulation rules — pending regulatory verification."
            </div>

            <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button type="button" onclick="document.getElementById('buyer-modal-container').innerHTML=''" class="btn btn-secondary text-xs py-2 px-3">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary text-xs py-2 px-4 font-bold">
                Confirm Purchase
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.updatePurchaseCalculations();
  },

  updatePurchaseCalculations() {
    const qtyInput = document.getElementById('purchase-qty');
    if (!qtyInput || !this.selectedOffer) return;

    const qty = parseFloat(qtyInput.value) || 0;
    const o = this.selectedOffer;
    const gridTariff = 8.00;

    const energyCost = Number((qty * o.askingPriceINR).toFixed(2));
    const wheelingFee = Number((qty * o.wheelingFeeINRPerKWh).toFixed(2));
    const platformFee = Number((qty * o.platformFeeINRPerKWh).toFixed(2));
    const totalCost = Number((energyCost + wheelingFee + platformFee).toFixed(2));

    const deliveredQty = Number((qty * (1 - (o.lossPercentage / 100))).toFixed(2));
    const discomCost = Number((deliveredQty * gridTariff).toFixed(2));
    const savings = Number(Math.max(0, discomCost - totalCost).toFixed(2));
    const savingsPercent = discomCost > 0 ? Number(((savings / discomCost) * 100).toFixed(1)) : 0;

    const elEnergy = document.getElementById('calc-energy-cost');
    const elWheeling = document.getElementById('calc-wheeling-fee');
    const elPlatform = document.getElementById('calc-platform-fee');
    const elTotal = document.getElementById('calc-total-cost');
    const elSavings = document.getElementById('calc-savings');

    if (elEnergy) elEnergy.innerText = `₹${energyCost.toFixed(2)}`;
    if (elWheeling) elWheeling.innerText = `₹${wheelingFee.toFixed(2)}`;
    if (elPlatform) elPlatform.innerText = `₹${platformFee.toFixed(2)}`;
    if (elTotal) elTotal.innerText = `₹${totalCost.toFixed(2)}`;
    if (elSavings) elSavings.innerText = `+₹${savings.toFixed(2)} (${savingsPercent}%)`;
  },

  // Confirm Purchase Execution
  async handleConfirmPurchase(e) {
    e.preventDefault();
    if (!this.selectedOffer) return;

    const qty = parseFloat(document.getElementById('purchase-qty').value);
    const offer = this.selectedOffer;

    try {
      const res = await window.API.purchaseOffer({
        offerId: offer.offerId,
        requestedKWh: qty,
        buyerZone: offer.buyerZone
      });

      document.getElementById('buyer-modal-container').innerHTML = '';

      if (res.success) {
        const trade = res.trade;
        const modalRoot = document.getElementById('buyer-modal-container');
        if (modalRoot) {
          modalRoot.innerHTML = `
            <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-emerald-300">
                <div class="flex items-center gap-2 text-emerald-800">
                  <span class="badge badge-verified">Settled</span>
                  <div>
                    <h3 class="text-base font-bold text-slate-900">Clean Energy Purchase Settled</h3>
                    <div class="text-[11px] font-mono text-slate-500">${trade.tradeId}</div>
                  </div>
                </div>

                <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
                  <div class="font-bold">${res.explanation || 'Purchase completed successfully.'}</div>
                  <div class="grid grid-cols-2 gap-1 text-[11px] pt-1 border-t border-emerald-100">
                    <div>Delivered: <span class="font-bold font-mono">${trade.deliveredEnergyKWh.toFixed(2)} kWh</span></div>
                    <div>Rate: <span class="font-bold font-mono">₹${trade.tradePriceINR.toFixed(2)}/kWh</span></div>
                    <div>Total Cost: <span class="font-bold font-mono">₹${trade.buyerTotalCostINR.toFixed(2)}</span></div>
                    <div>Bill Savings: <span class="font-bold font-mono text-emerald-700">+₹${trade.buyerSavingsINR.toFixed(2)}</span></div>
                  </div>
                </div>

                ${res.partialFill ? `
                  <div class="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-[11px]">
                    <strong>Partial Allocation Notice:</strong> ${res.unmetKWh.toFixed(2)} kWh could not be filled from this seller offer and remains in your unmet deficit.
                  </div>
                ` : ''}

                <div class="text-[10px] text-slate-400">
                  Cryptographic block appended to transaction ledger with SHA-256 hash chaining.
                </div>

                <div class="pt-2 flex justify-end">
                  <button 
                    onclick="document.getElementById('buyer-modal-container').innerHTML=''; window.BuyerDashboardView.render();"
                    class="btn btn-primary text-xs py-2 px-4 font-bold"
                  >
                    Close & View Updated Balance
                  </button>
                </div>
              </div>
            </div>
          `;
        }
        window.Toast.success(`Purchase settled! ${trade.energyKWh.toFixed(2)} kWh clean solar energy delivered.`);
      }
    } catch (err) {
      window.Toast.error(`Purchase could not be executed: ${err.message}`);
    }
  },

  async handleSmartQuote(e) {
    if (e) e.preventDefault();
    const qtyInput = document.getElementById('smart-purchase-qty');
    const requestedKWh = qtyInput ? parseFloat(qtyInput.value) : 6.0;

    if (isNaN(requestedKWh) || requestedKWh <= 0) {
      window.Toast.error('Please enter a valid energy quantity greater than 0 kWh.');
      return;
    }

    try {
      const quote = await window.API.getPurchaseQuote({
        requestedKWh
      });

      if (!quote.success) {
        window.Toast.error(quote.error || 'Failed to get purchase quote.');
        return;
      }

      this.openSmartQuoteModal(quote);
    } catch (err) {
      window.Toast.error(`Quote error: ${err.message}`);
    }
  },

  openSmartQuoteModal(quote) {
    const modalRoot = document.getElementById('buyer-modal-container');
    if (!modalRoot) return;

    const allocations = quote.allocations || [];
    const energyCost = quote.totalEnergyCostINR || 0;
    const platformFee = quote.totalPlatformFeeINR || 0;
    const wheelingFee = quote.totalWheelingFeeINR || 0;
    const totalCost = quote.totalBuyerCostINR || 0;
    const deliveredKWh = quote.totalDeliveredEnergyKWh || quote.allocatedKWh || 0;
    const baselineCost = quote.totalDiscomBaselineINR || (deliveredKWh * 8.00);
    const savings = quote.totalBuyerSavingsINR || (baselineCost - totalCost);
    const savingsPercent = baselineCost > 0 ? Number(((savings / baselineCost) * 100).toFixed(1)) : 0;

    modalRoot.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-base font-bold text-slate-900">Review Energy Allocation & Cost Quote</h3>
              <span class="text-[10px] text-slate-400">Lowest-Cost Direct Allocation Breakdown</span>
            </div>
            <button onclick="document.getElementById('buyer-modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
          </div>

          <!-- Summary banner -->
          <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900">
            <span class="font-bold">Allocated Quantity: </span>
            <span class="font-mono font-bold">${quote.allocatedKWh.toFixed(2)} kWh</span>
            ${quote.partialFill ? `
              <span class="text-amber-800 text-[11px] block mt-1">
                <strong>Partial allocation notice:</strong> Requested ${quote.requestedKWh} kWh, unmet demand: ${quote.unmetKWh} kWh.
              </span>
            ` : ''}
          </div>

          <!-- Multi-Seller Allocation Table -->
          <div class="space-y-1.5">
            <div class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Allocation Across Available Prosumers</div>
            <div class="table-wrapper border border-slate-200 rounded-lg">
              <table class="grid-table text-xs">
                <thead>
                  <tr>
                    <th>Seller Prosumer</th>
                    <th>Zone</th>
                    <th>Allocated</th>
                    <th>Rate</th>
                    <th>Energy Cost</th>
                  </tr>
                </thead>
                <tbody>
                  ${allocations.map(a => `
                    <tr>
                      <td class="font-bold text-slate-800">${a.sellerName}</td>
                      <td><span class="badge badge-purple text-[10px] font-mono">${a.sellerZone}</span></td>
                      <td class="font-mono font-bold">${a.allocatedKWh.toFixed(2)} kWh</td>
                      <td class="font-mono">₹${a.askingPriceINR.toFixed(2)}/kWh</td>
                      <td class="font-mono font-bold text-slate-900">₹${a.energyCostINR.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Transparent Fee & Cost Itemization -->
          <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
            <div class="flex justify-between text-slate-700 font-bold border-b border-slate-200 pb-1">
              <span>Energy Cost (before charges):</span>
              <span class="font-mono text-slate-900">₹${energyCost.toFixed(2)}</span>
            </div>
            <div class="flex justify-between text-slate-600">
              <span>Grid Wheeling Transit Charge:</span>
              <span class="font-mono font-semibold">₹${wheelingFee.toFixed(2)}</span>
            </div>
            <div class="flex justify-between text-slate-600">
              <span>Platform Transaction Fee (₹0.20/kWh):</span>
              <span class="font-mono font-semibold">₹${platformFee.toFixed(2)}</span>
            </div>
            <div class="flex justify-between text-slate-900 font-extrabold border-t border-slate-200 pt-1.5 text-sm">
              <span>Total Payable Amount:</span>
              <span class="font-mono text-emerald-800">₹${totalCost.toFixed(2)}</span>
            </div>
            <div class="flex justify-between text-emerald-700 font-bold pt-1">
              <span>Savings vs Discom Retail (₹8.00/kWh):</span>
              <span class="font-mono">+₹${savings.toFixed(2)} (${savingsPercent}%)</span>
            </div>
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button type="button" onclick="document.getElementById('buyer-modal-container').innerHTML=''" class="btn btn-secondary text-xs py-2 px-3">
              Cancel
            </button>
            <button 
              type="button" 
              onclick="window.BuyerDashboardView.executeConfirmedSmartPurchase(${quote.requestedKWh})" 
              class="btn btn-primary text-xs py-2 px-4 font-bold"
            >
              Confirm Purchase
            </button>
          </div>
        </div>
      </div>
    `;
  },

  async executeConfirmedSmartPurchase(requestedKWh) {
    try {
      const res = await window.API.purchaseOffer({
        requestedKWh
      });

      document.getElementById('buyer-modal-container').innerHTML = '';

      if (res.success) {
        const trades = res.trades || (res.trade ? [res.trade] : []);
        const totalDelivered = Number(trades.reduce((s, t) => s + (t.deliveredEnergyKWh !== undefined ? t.deliveredEnergyKWh : t.energyKWh), 0).toFixed(2));
        const totalPaid = Number(trades.reduce((s, t) => s + (t.buyerTotalCostINR || 0), 0).toFixed(2));
        const totalSavings = Number(trades.reduce((s, t) => s + (t.buyerSavingsINR || 0), 0).toFixed(2));

        const modalRoot = document.getElementById('buyer-modal-container');
        if (modalRoot) {
          modalRoot.innerHTML = `
            <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-emerald-300">
                <div class="flex items-center gap-2 text-emerald-800">
                  <span class="badge badge-verified">Settled</span>
                  <div>
                    <h3 class="text-base font-bold text-slate-900">Clean Energy Purchase Settled</h3>
                    <div class="text-[11px] font-mono text-slate-500">${trades.length} transaction${trades.length > 1 ? 's' : ''} recorded</div>
                  </div>
                </div>

                <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
                  <div class="font-bold">${res.explanation || 'Purchase completed successfully.'}</div>
                  <div class="grid grid-cols-2 gap-1 text-[11px] pt-1 border-t border-emerald-100">
                    <div>Delivered: <span class="font-bold font-mono">${totalDelivered.toFixed(2)} kWh</span></div>
                    <div>Total Cost: <span class="font-bold font-mono">₹${totalPaid.toFixed(2)}</span></div>
                    <div>Bill Savings: <span class="font-bold font-mono text-emerald-700">+₹${totalSavings.toFixed(2)}</span></div>
                    <div>Ledger Blocks: <span class="font-bold font-mono text-slate-700">${trades.length} verified</span></div>
                  </div>
                </div>

                ${res.partialFill ? `
                  <div class="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-[11px]">
                    <strong>Partial Allocation Notice:</strong> ${res.unmetKWh.toFixed(2)} kWh could not be filled and remains in your unmet deficit.
                  </div>
                ` : ''}

                <div class="text-[10px] text-slate-400">
                  Cryptographic blocks appended to transaction ledger with SHA-256 hash chaining.
                </div>

                <div class="pt-2 flex justify-end">
                  <button 
                    onclick="document.getElementById('buyer-modal-container').innerHTML=''; window.BuyerDashboardView.render();"
                    class="btn btn-primary text-xs py-2 px-4 font-bold"
                  >
                    Close & View Updated Balance
                  </button>
                </div>
              </div>
            </div>
          `;
        }
        window.Toast.success(`Purchase settled! ${totalDelivered.toFixed(2)} kWh clean solar energy delivered.`);
      }
    } catch (err) {
      window.Toast.error(`Purchase execution failed: ${err.message}`);
    }
  },

  // Working Action 1: View Offer Details Modal
  openOfferDetailsModal(offer, remainingDeficit) {
    const modalRoot = document.getElementById('buyer-modal-container');
    if (!modalRoot) return;

    const gridTariff = 8.00;
    const deliveredCost = offer.deliveredUnitCostINRPerKWh || 5.00;
    const unitSavings = Number((gridTariff - deliveredCost).toFixed(2));
    const savingsPercent = Number(((unitSavings / gridTariff) * 100).toFixed(1));
    const capacityText = offer.solarCapacityKW ? `${offer.solarCapacityKW} kW Rooftop PV` : 'Solar Prosumer PV';
    const sellerType = offer.sellerType || (offer.role === 'prosumer' ? 'Residential Solar Prosumer' : 'Solar Prosumer');

    modalRoot.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-base font-bold text-slate-900">Solar Energy Offer Details</h3>
              <span class="text-[10px] text-slate-400 font-mono">${offer.offerId}</span>
            </div>
            <button onclick="document.getElementById('buyer-modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
          </div>

          <!-- Seller Identification & Capacity -->
          <div class="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2 text-xs">
            <div class="flex justify-between items-center">
              <div>
                <span class="font-bold text-slate-900 text-sm">${offer.sellerName}</span>
                <span class="text-[10px] font-mono text-slate-500 block">${offer.sellerId} • ${sellerType}</span>
              </div>
              <span class="badge badge-emerald text-xs font-bold font-mono">${capacityText}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-slate-600 pt-2 border-t border-blue-100 text-[11px]">
              <div>Zone & Route: <span class="font-mono font-bold text-slate-800">${offer.sellerZone} &rarr; ${offer.buyerZone}</span></div>
              <div>Available Clean Energy: <span class="font-mono font-bold text-slate-900">${offer.availableKWh.toFixed(2)} kWh</span></div>
              <div>Route Topology: <span class="font-semibold ${offer.isCrossZone ? 'text-amber-700' : 'text-slate-700'}">${offer.isCrossZone ? 'Cross-Zone Intertie' : 'Local Feeder'}</span></div>
              <div>Grid Status: <span class="font-semibold text-emerald-700">Online & Verified</span></div>
            </div>
          </div>

          <!-- Itemized Cost & Transparency Breakdown -->
          <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
            <div class="font-bold text-slate-700 text-[11px] uppercase tracking-wide">Delivered Electricity Cost Breakdown</div>
            <div class="flex justify-between text-slate-600">
              <span>Seller Base Asking Rate:</span>
              <span class="font-mono font-semibold text-slate-900">₹${offer.askingPriceINR.toFixed(2)} / kWh</span>
            </div>
            <div class="flex justify-between text-slate-600">
              <span>Wheeling Transit Fee:</span>
              <span class="font-mono font-semibold text-slate-900">+₹${offer.wheelingFeeINRPerKWh.toFixed(2)} / kWh</span>
            </div>
            <div class="flex justify-between text-slate-600">
              <span>Platform Service Fee:</span>
              <span class="font-mono font-semibold text-slate-900">+₹${offer.platformFeeINRPerKWh.toFixed(2)} / kWh</span>
            </div>
            <div class="flex justify-between text-slate-600">
              <span>Estimated Transmission Losses:</span>
              <span class="font-mono font-semibold text-slate-900">${offer.lossPercentage}%</span>
            </div>
            <div class="flex justify-between text-slate-900 font-extrabold border-t border-slate-200 pt-1.5 text-sm">
              <span>Final Delivered Cost:</span>
              <span class="font-mono text-emerald-800">₹${deliveredCost.toFixed(2)} / kWh</span>
            </div>
            <div class="flex justify-between text-emerald-700 font-bold pt-1">
              <span>Net Bill Savings vs Utility Retail (₹8.00):</span>
              <span class="font-mono">+₹${unitSavings.toFixed(2)} / kWh (${savingsPercent}%)</span>
            </div>
          </div>

          <div class="text-[10px] text-slate-400 italic">
            "Simulation rules — pending regulatory verification." Solar panels are not required to purchase clean electricity.
          </div>

          <!-- Action buttons -->
          <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button 
              type="button" 
              onclick="document.getElementById('buyer-modal-container').innerHTML=''" 
              class="btn btn-secondary text-xs py-2 px-3"
            >
              Close
            </button>
            <button 
              type="button" 
              onclick='window.BuyerDashboardView.openPurchaseModal(${JSON.stringify(offer).replace(/'/g, "&apos;")}, ${remainingDeficit})' 
              class="btn btn-primary text-xs py-2 px-4 font-bold"
            >
              Choose Quantity & Buy
            </button>
          </div>
        </div>
      </div>
    `;
  },

  // Working Action 6: View My Savings Modal
  openSavingsModal() {
    const modalRoot = document.getElementById('buyer-modal-container');
    if (!modalRoot) return;

    const gridTariff = 8.00;
    const bought = this.totalPurchasedKWh || 0;
    const realizedSavings = this.totalRealizedSavingsINR || 0;
    const avgPrice = this.avgP2pPrice || 0;
    const unitSavings = this.savingsPerUnit || 0;
    const savingsPercent = gridTariff > 0 && unitSavings > 0 ? Number(((unitSavings / gridTariff) * 100).toFixed(1)) : 0;
    const co2Avoided = Number((bought * 0.82).toFixed(1));

    modalRoot.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-base font-bold text-slate-900">My Clean Energy Savings Breakdown</h3>
              <span class="text-[10px] text-slate-400">Account ${this.currentHousehold?.id || 'HH-02'} · Economic & Environmental Impact</span>
            </div>
            <button onclick="document.getElementById('buyer-modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
          </div>

          <!-- Highlight Metric Cards -->
          <div class="grid grid-cols-2 gap-3">
            <div class="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
              <span class="text-[11px] font-semibold text-emerald-800">Total Bill Savings</span>
              <div class="text-xl font-extrabold text-emerald-700 font-mono mt-0.5">₹${realizedSavings.toFixed(2)}</div>
              <span class="text-[10px] text-emerald-600">vs ₹8.00/kWh retail tariff</span>
            </div>
            <div class="p-3.5 bg-blue-50 rounded-xl border border-blue-200 text-center">
              <span class="text-[11px] font-semibold text-blue-800">Clean Energy Procured</span>
              <div class="text-xl font-extrabold text-blue-700 font-mono mt-0.5">${bought.toFixed(2)} kWh</div>
              <span class="text-[10px] text-blue-600">Rooftop solar electricity</span>
            </div>
          </div>

          <!-- Comparison Table -->
          <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div class="font-bold text-slate-700 text-[11px] uppercase tracking-wide">Tariff Comparison vs State Discom</div>
            <div class="flex justify-between text-slate-600">
              <span>Standard Retail Utility Benchmark:</span>
              <span class="font-mono font-bold text-slate-900">₹${gridTariff.toFixed(2)} / kWh</span>
            </div>
            <div class="flex justify-between text-slate-600">
              <span>Average SolarShare P2P Rate Paid:</span>
              <span class="font-mono font-bold text-emerald-700">₹${avgPrice.toFixed(2)} / kWh</span>
            </div>
            <div class="flex justify-between text-slate-600">
              <span>Effective Savings Rate:</span>
              <span class="font-mono font-bold text-emerald-700">₹${unitSavings.toFixed(2)} / kWh (${savingsPercent}%)</span>
            </div>
            <div class="flex justify-between text-slate-600 border-t border-slate-200 pt-1.5">
              <span>Avoided Carbon Emissions (UN SDG 7):</span>
              <span class="font-mono font-bold text-emerald-800">${co2Avoided} kg CO2e</span>
            </div>
          </div>

          <div class="text-[10px] text-slate-400 italic">
            "Simulation rules — pending regulatory verification." Savings reflect simulated wholesale peer market clearing.
          </div>

          <div class="pt-2 flex justify-end">
            <button 
              type="button" 
              onclick="document.getElementById('buyer-modal-container').innerHTML=''" 
              class="btn btn-primary text-xs py-2 px-4 font-bold"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    `;
  },

  // Price Explanation Modal
  openPriceExplanationModal() {
    const modalRoot = document.getElementById('buyer-modal-container');
    if (!modalRoot) return;

    modalRoot.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-base font-bold text-slate-900">Delivered Electricity Price Explanation</h3>
              <span class="text-[10px] text-slate-400">Transparent Cost Formation Mechanics</span>
            </div>
            <button onclick="document.getElementById('buyer-modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
          </div>

          <div class="space-y-3 text-xs text-slate-600 leading-relaxed">
            <p>
              In SolarShare, clean electricity prices are fully transparent with zero hidden margins.
              The price you pay per delivered kilowatt-hour is calculated using standard open-access utility formulas:
            </p>

            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 text-center font-bold">
              Delivered Cost = (Asking Price + Wheeling Fee + Platform Fee) / (1 - Loss%)
            </div>

            <div class="space-y-1.5 text-[11px]">
              <div><strong>1. Seller Asking Price:</strong> Prosumers offer clean surplus electricity at fair rates (typically ₹3.50 - ₹5.50/kWh), well above the ₹2.00 feed-in floor.</div>
              <div><strong>2. Grid Wheeling Charge:</strong> Compensates the distribution utility for wire transit (₹0.40/kWh local, ₹0.60/kWh cross-zone).</div>
              <div><strong>3. Platform Fee:</strong> Transparent ₹0.20/kWh administrative fee for cryptographic ledger settlement and matching.</div>
              <div><strong>4. Technical Losses:</strong> Accounts for physical line resistance (3.0% local, 5.0% intertie).</div>
            </div>

            <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-[11px]">
              <strong>Why Buyers Always Save:</strong> Even after wheeling fees and technical line losses, total delivered cost remains substantially lower than the standard utility retail tariff (₹8.00/kWh), providing immediate bill reduction.
            </div>
          </div>

          <div class="pt-2 flex justify-end">
            <button 
              type="button" 
              onclick="document.getElementById('buyer-modal-container').innerHTML=''" 
              class="btn btn-primary text-xs py-2 px-4 font-bold"
            >
              Understood
            </button>
          </div>
        </div>
      </div>
    `;
  }
};

