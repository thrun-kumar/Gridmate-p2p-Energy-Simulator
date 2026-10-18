/**
 * SolarShare - System-Wide Overview Dashboard View
 * Features:
 * - 12 calculated KPI summary cards
 * - Company financial performance statement
 * - 6 interactive SVG charts (diurnal curve, supply/demand balance, price trend, volume, CO2, company finance)
 * - Settled peer trades audit table
 * - Transparent SDG 7 clean energy compliance and regulatory disclaimer
 */

window.OverviewView = {
  render(data) {
    const root = document.getElementById('view-content');
    if (!root) return;

    const cards = data.cards || data.metrics || {};
    const cf = data.companyFinance || {
      totalCompanyRevenueINR: 0,
      dailyOperatingCostINR: 100,
      variableOperatingCostsINR: 0,
      totalOperatingCostINR: 100,
      estimatedProfitLossINR: -100,
      isProfitable: false
    };

    const pricing = data.pricingDetails || {
      recommendedPriceINR: 5.00,
      demandPressurePercent: 50,
      statusLabel: 'Balanced',
      reasonText: 'Moderate balanced supply and demand.'
    };

    const marketStatus = pricing.statusLabel || data.marketStatus || 'Balanced';
    let statusBadgeClass = 'badge-blue';
    if (marketStatus === 'Surplus' || marketStatus === 'High Solar Surplus') statusBadgeClass = 'badge-emerald';
    if (marketStatus === 'Deficit' || marketStatus === 'High Demand Deficit' || marketStatus === 'Shortage') statusBadgeClass = 'badge-amber';

    const tariffs = data.tariffs || { gridImportTariffINR: 8.00, exportCompensationINR: 2.00 };
    const disclaimer = data.dataDisclaimer || "Simulation assumptions, not official electricity tariffs or approved commercial fees. Actual prices, subsidies, tariffs, and fees depend on the applicable utility and regulatory arrangement.";

    // 12 KPI metric values
    const solarGen = Number(cards.totalSolarGenKWh || 0).toFixed(2);
    const demand = Number(cards.totalHouseholdDemandKWh || 0).toFixed(2);
    const surplus = Number(cards.availableSurplusKWh || 0).toFixed(2);
    const unmetDemand = Number(cards.localEnergyDemandKWh || cards.unmetDemandKWh || 0).toFixed(2);
    const traded = Number(cards.totalEnergyTradedKWh || 0).toFixed(2);
    const recPrice = Number(cards.recommendedMarketPriceINR || pricing.recommendedPriceINR || 5.00).toFixed(2);
    const avgTradePrice = Number(cards.averageExecutedTradePriceINR || cards.averageTradingPriceINR || 0).toFixed(2);
    const avoidedCO2 = Number(cards.avoidedCO2Kg || cards.avoidedEmissionsKg || 0).toFixed(2);
    const sellerEarnings = Number(cards.sellerEarningsINR || 0).toFixed(2);
    const buyerSavings = Number(cards.buyerSavingsINR || cards.aggregateBuyerSavingsINR || 0).toFixed(2);
    const platformRev = Number(cards.platformRevenueINR || cf.totalCompanyRevenueINR || 0).toFixed(2);
    const profitLoss = Number(cards.companyEstimatedProfitLossINR || cf.estimatedProfitLossINR || 0).toFixed(2);
    const isProfitable = (cards.companyEstimatedProfitLossINR !== undefined ? cards.companyEstimatedProfitLossINR >= 0 : cf.isProfitable);

    root.innerHTML = `
      <div class="space-y-6">
        
        <!-- Top Status Banner & Market Signal -->
        <div class="card p-5 card-accent-green bg-white flex flex-wrap items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="text-page-title text-slate-800">System-Wide Energy Market Overview</h1>
              <span class="badge ${statusBadgeClass} text-xs uppercase font-bold">${marketStatus}</span>
              <span class="badge ${data.activeScenario && data.activeScenario !== 'SUNNY_DAY' ? 'badge-amber' : 'badge-emerald'} text-xs font-bold uppercase" title="${data.scenarioDetails?.description || 'Active Simulation Scenario'}">
                ${data.scenarioDetails?.name || 'Sunny Day'}
              </span>
              <span class="font-mono text-xs text-slate-500 font-semibold">${data.runId || 'SIM-RUN-01'}</span>
            </div>
            <p class="text-caption text-slate-500 mt-0.5">
              Current Simulation Hour: <span class="text-emerald-700 font-bold font-mono">${data.currentHourLabel || '12:00'}</span> • Demand compared with available supply: <span class="font-bold font-mono text-slate-700">${pricing.demandPressurePercent || 50}%</span>
              ${data.scenarioDetails ? ` • <span class="text-slate-600 font-medium">${data.scenarioDetails.badge}</span>` : ''}
            </p>
          </div>
          <div class="flex items-center gap-3 text-xs bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl">
            <span class="text-slate-600">Discom Retail Cap: <span class="font-bold text-slate-900">₹${tariffs.gridImportTariffINR.toFixed(2)}/kWh</span></span>
            <span class="text-slate-300">|</span>
            <span class="text-slate-600">Feed-In Floor: <span class="font-bold text-slate-900">₹${tariffs.exportCompensationINR.toFixed(2)}/kWh</span></span>
            <span class="text-slate-300">|</span>
            <span class="text-slate-600">Platform Fee: <span class="font-bold text-emerald-700">₹0.20/kWh</span></span>
          </div>
        </div>

        <!-- 12 Required Calculated KPI Metric Cards -->
        <div>
          <div class="flex items-center justify-between mb-2.5">
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500">12 Market Performance Indicators</h2>
            <span class="text-[11px] text-slate-400">Automatic Electricity Matching • Midpoint Pricing</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            
            <!-- Card 1: Total Solar Energy Generated -->
            <div class="card p-4 bg-white border border-slate-200 shadow-sm">
              <span class="stat-label">1. Solar Generated</span>
              <div class="text-metric-value text-emerald-700 font-mono mt-1">${solarGen} <span class="text-xs font-semibold text-slate-500">kWh</span></div>
              <div class="text-caption text-slate-400 mt-1">Aggregated community solar output</div>
            </div>

            <!-- Card 2: Total Household Energy Demanded -->
            <div class="card p-4 bg-white border border-slate-200 shadow-sm">
              <span class="stat-label">2. Household Demand</span>
              <div class="text-metric-value text-slate-800 font-mono mt-1">${demand} <span class="text-xs font-semibold text-slate-500">kWh</span></div>
              <div class="text-caption text-slate-400 mt-1">Aggregated residential load profile</div>
            </div>

            <!-- Card 3: Total Surplus Solar Energy -->
            <div class="card p-4 bg-white border border-slate-200 shadow-sm">
              <span class="stat-label">3. Solar Surplus</span>
              <div class="text-metric-value text-emerald-600 font-mono mt-1">${surplus} <span class="text-xs font-semibold text-slate-500">kWh</span></div>
              <div class="text-caption text-slate-400 mt-1">Exportable prosumer energy</div>
            </div>

            <!-- Card 4: Total Deficit / Unmet Energy Demand -->
            <div class="card p-4 bg-white border border-slate-200 shadow-sm">
              <span class="stat-label">4. Unmet Local Deficit</span>
              <div class="text-metric-value text-amber-700 font-mono mt-1">${unmetDemand} <span class="text-xs font-semibold text-slate-500">kWh</span></div>
              <div class="text-caption text-slate-400 mt-1">Remaining deficit (from grid)</div>
            </div>

            <!-- Card 5: Total Energy Traded Peer-to-Peer -->
            <div class="card p-4 bg-white border border-emerald-300 shadow-sm card-accent-green">
              <span class="stat-label">5. P2P Energy Traded</span>
              <div class="text-metric-value text-emerald-700 font-mono mt-1">${traded} <span class="text-xs font-semibold text-slate-500">kWh</span></div>
              <div class="text-caption text-slate-400 mt-1">Direct peer matched clean power</div>
            </div>

            <!-- Card 6: Current Recommended Trading Price -->
            <div class="card p-4 bg-white border border-slate-200 shadow-sm">
              <span class="stat-label">6. Current Electricity Price</span>
              <div class="text-metric-value text-sky-700 font-mono mt-1">₹${recPrice} <span class="text-xs font-semibold text-slate-500">/kWh</span></div>
              <div class="text-caption text-slate-400 mt-1">Supply vs demand market reference</div>
            </div>

            <!-- Card 7: Average Trading Price Across Settled Trades -->
            <div class="card p-4 bg-white border border-slate-200 shadow-sm">
              <span class="stat-label">7. Weighted Avg Price</span>
              <div class="text-metric-value text-slate-800 font-mono mt-1">₹${avgTradePrice} <span class="text-xs font-semibold text-slate-500">/kWh</span></div>
              <div class="text-caption text-slate-400 mt-1">Equitable midpoint settlement rate</div>
            </div>

            <!-- Card 8: Total Avoided Grid Carbon Emissions -->
            <div class="card p-4 bg-white border border-slate-200 shadow-sm">
              <span class="stat-label">8. Avoided CO2 Emissions</span>
              <div class="text-metric-value text-emerald-700 font-mono mt-1">${avoidedCO2} <span class="text-xs font-semibold text-slate-500">kg</span></div>
              <div class="text-caption text-slate-400 mt-1">Displaced thermal power (0.82 kg/kWh)</div>
            </div>

            <!-- Card 9: Total Seller Earnings -->
            <div class="card p-4 bg-white border border-slate-200 shadow-sm">
              <span class="stat-label">9. Total Seller Earnings</span>
              <div class="text-metric-value text-emerald-700 font-mono mt-1">₹${sellerEarnings}</div>
              <div class="text-caption text-slate-400 mt-1">Paid to solar prosumers</div>
            </div>

            <!-- Card 10: Total Buyer Savings vs Grid Benchmark -->
            <div class="card p-4 bg-white border border-slate-200 shadow-sm">
              <span class="stat-label">10. Total Buyer Savings</span>
              <div class="text-metric-value text-emerald-700 font-mono mt-1">₹${buyerSavings}</div>
              <div class="text-caption text-slate-400 mt-1">Discount vs ₹8.00 retail grid tariff</div>
            </div>

            <!-- Card 11: Platform Service Revenue Collected -->
            <div class="card p-4 bg-white border border-slate-200 shadow-sm">
              <span class="stat-label">11. Platform Service Revenue</span>
              <div class="text-metric-value text-slate-800 font-mono mt-1">₹${platformRev}</div>
              <div class="text-caption text-slate-400 mt-1">Transparent ₹0.20/kWh service fees</div>
            </div>

            <!-- Card 12: Company Operating Profit / Loss -->
            <div class="card p-4 bg-white border ${isProfitable ? 'border-emerald-300' : 'border-rose-300'} shadow-sm">
              <div class="flex items-center justify-between">
                <span class="stat-label">12. Company Operating P&L</span>
                <span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${isProfitable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                  ${isProfitable ? 'Profitable' : 'Loss'}
                </span>
              </div>
              <div class="text-metric-value font-mono mt-1 ${isProfitable ? 'text-emerald-700' : 'text-rose-700'}">
                ${profitLoss >= 0 ? '+' : ''}₹${profitLoss}
              </div>
              <div class="text-caption text-slate-400 mt-1">Revenue minus operating expenses</div>
            </div>

          </div>
        </div>

        <!-- COMPANY FINANCIAL STATUS SUMMARY BOX -->
        <div class="card p-5 bg-white border border-slate-200 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-xs font-bold text-slate-800">SolarShare Enterprise Financial Statement</h3>
              <p class="text-[11px] text-slate-500">Transparent company revenue model: ₹0.20/kWh fee, ₹100.00 daily overhead, variable processing costs.</p>
            </div>
            <span class="badge ${isProfitable ? 'badge-emerald' : 'badge-amber'} text-xs font-bold uppercase">
              Financial Status: ${isProfitable ? 'Profitable' : 'Incurring Operating Loss'}
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div class="text-slate-500 text-[11px]">Total Platform Revenue</div>
              <div class="text-sm font-bold font-mono text-emerald-700 mt-0.5">₹${platformRev}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">From ₹0.20/kWh fee on traded energy</div>
            </div>
            <div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div class="text-slate-500 text-[11px]">Daily Base Operating Cost</div>
              <div class="text-sm font-bold font-mono text-slate-700 mt-0.5">₹${Number(cf.dailyOperatingCostINR || 100).toFixed(2)}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">Cloud compute & verification engine</div>
            </div>
            <div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div class="text-slate-500 text-[11px]">Variable Operating Costs</div>
              <div class="text-sm font-bold font-mono text-slate-700 mt-0.5">₹${Number(cf.variableOperatingCostsINR || 0).toFixed(2)}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">Payment gateway & ledger audit costs</div>
            </div>
            <div class="p-3 ${isProfitable ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'} rounded-lg border">
              <div class="text-[11px] font-medium opacity-80">Net Operating Profit / Loss</div>
              <div class="text-sm font-extrabold font-mono mt-0.5">${profitLoss >= 0 ? '+' : ''}₹${profitLoss}</div>
              <div class="text-[10px] opacity-75 mt-0.5">Revenue minus total operating costs</div>
            </div>
          </div>
        </div>

        <!-- 6 INTERACTIVE VISUAL CHARTS -->
        <div>
          <div class="flex items-center justify-between mb-2.5">
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500">6 Interactive Market & Environmental Visualizations</h2>
            <span class="text-[11px] text-slate-400">24-Hour Horizon Analysis</span>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            <!-- Chart 1: 24-Hour Solar Generation vs Consumption Curve -->
            <div class="card p-5 bg-white space-y-3">
              <div>
                <h3 class="text-section-heading text-slate-800">1. Solar Generation vs Consumption Curve</h3>
                <p class="text-caption text-slate-500">Diurnal solar bell curve peaking midday vs double-peak residential load</p>
              </div>
              <div id="overview-gen-demand-chart" class="mt-2 min-h-[220px]"></div>
            </div>

            <!-- Chart 2: Hourly Supply vs Demand Balance -->
            <div class="card p-5 bg-white space-y-3">
              <div>
                <h3 class="text-section-heading text-slate-800">2. Hourly Supply vs Demand Balance</h3>
                <p class="text-caption text-slate-500">Surplus solar generation (green) vs household deficit (amber)</p>
              </div>
              <div id="overview-supply-demand-chart" class="mt-2 min-h-[220px]"></div>
            </div>

            <!-- Chart 3: Hourly Market Price Trend -->
            <div class="card p-5 bg-white space-y-3">
              <div>
                <h3 class="text-section-heading text-slate-800">3. 24-Hour Market Price Trend (₹/kWh)</h3>
                <p class="text-caption text-slate-500">Dynamic recommended price vs actual executed price within [₹2, ₹8] bounds</p>
              </div>
              <div id="overview-price-trend-chart" class="mt-2 min-h-[220px]"></div>
            </div>

            <!-- Chart 4: Hourly Clean Energy Traded Volume -->
            <div class="card p-5 bg-white space-y-3">
              <div>
                <h3 class="text-section-heading text-slate-800">4. Traded Clean Energy Volume (kWh)</h3>
                <p class="text-caption text-slate-500">Continuous Double Auction hourly bilateral trade matches</p>
              </div>
              <div id="overview-volume-chart" class="mt-2 min-h-[200px]"></div>
            </div>

            <!-- Chart 5: Carbon Emissions Avoided Accumulator -->
            <div class="card p-5 bg-white space-y-3">
              <div>
                <h3 class="text-section-heading text-slate-800">5. Carbon Emissions Avoided Accumulator</h3>
                <p class="text-caption text-slate-500">Cumulative avoided grid emissions (kg CO2e based on CEA 0.82 kg/kWh)</p>
              </div>
              <div id="overview-carbon-chart" class="mt-2 min-h-[200px]"></div>
            </div>

            <!-- Chart 6: Company Revenue vs Operating Costs -->
            <div class="card p-5 bg-white space-y-3">
              <div>
                <h3 class="text-section-heading text-slate-800">6. Company Revenue vs Operating Costs</h3>
                <p class="text-caption text-slate-500">Platform transaction fees vs daily and variable operating costs</p>
              </div>
              <div id="overview-company-finance-chart" class="mt-2 min-h-[200px]"></div>
            </div>

          </div>
        </div>

        <!-- GRID NETWORK SUBSTATION TOPOLOGY & WHEELING MODEL -->
        <div class="card p-5 bg-white space-y-4 border border-slate-200">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                <h2 class="text-section-heading text-slate-800">Grid Network Topology & Substation Status</h2>
                <span class="badge badge-purple text-[10px] font-mono font-bold">Multi-Zone Architecture</span>
              </div>
              <p class="text-caption text-slate-500 mt-0.5">Commercial bilateral allocation over 11kV distribution grid (intra-zone losses: 1.5%, inter-zone losses: 3.5%-5.0%, wheeling: ₹0.10-₹0.40/kWh)</p>
            </div>
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
              <span>Commercial Energy Allocation</span>
              <span class="text-blue-300">|</span>
              <span class="text-[11px] font-normal text-slate-500">Shared Physical Grid</span>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Zone A Substation -->
            <div class="p-4 rounded-xl border border-purple-200 bg-purple-50/30 space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-bold text-xs font-mono text-purple-900">ZONE-A North Residential</span>
                <span class="badge badge-green text-[10px]">Connected</span>
              </div>
              <div class="text-xs text-slate-600">Substation Capacity: <span class="font-bold font-mono">50.0 kW</span></div>
              <div class="text-[11px] text-slate-500">Participants: HH-01 (10 kW), HH-03 (8 kW) Solar Prosumers</div>
              <div class="text-[10px] text-purple-700 font-semibold bg-white px-2 py-1 rounded border border-purple-200">Net Surplus Exporter</div>
            </div>

            <!-- Zone B Substation -->
            <div class="p-4 rounded-xl border border-blue-200 bg-blue-50/30 space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-bold text-xs font-mono text-blue-900">ZONE-B Central Commercial</span>
                <span class="badge badge-blue text-[10px]">No Solar Required</span>
              </div>
              <div class="text-xs text-slate-600">Substation Capacity: <span class="font-bold font-mono">60.0 kW</span></div>
              <div class="text-[11px] text-slate-500">Participants: HH-02, HH-07, HH-10 (0 kW Solar Consumers)</div>
              <div class="text-[10px] text-blue-700 font-semibold bg-white px-2 py-1 rounded border border-blue-200">High Clean Energy Demand</div>
            </div>

            <!-- Zone C Substation -->
            <div class="p-4 rounded-xl border border-amber-200 bg-amber-50/30 space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-bold text-xs font-mono text-amber-900">ZONE-C South Mixed</span>
                <span class="badge badge-green text-[10px]">Connected</span>
              </div>
              <div class="text-xs text-slate-600">Substation Capacity: <span class="font-bold font-mono">45.0 kW</span></div>
              <div class="text-[11px] text-slate-500">Participants: HH-06, HH-08 (Prosumers); HH-04, HH-05, HH-09 (Consumers)</div>
              <div class="text-[10px] text-amber-700 font-semibold bg-white px-2 py-1 rounded border border-purple-200">Hybrid Mixed Grid Cluster</div>
            </div>
          </div>
        </div>

        <!-- RECENT SETTLED PEER ENERGY TRADES TABLE -->
        <div class="card p-5 bg-white space-y-3">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 class="text-section-heading text-slate-800">Recent Settled Peer Energy Trades</h2>
              <p class="text-caption text-slate-500">Bilateral transactions settled via continuous midpoint matching with SHA-256 ledger proof</p>
            </div>
            <button onclick="window.App.navigate('/marketplace')" class="btn btn-secondary text-xs">
              View Live Marketplace
            </button>
          </div>

          <div class="table-wrapper">
            <table class="table text-xs">
              <thead>
                <tr>
                  <th>Trade ID</th>
                  <th>Hour</th>
                  <th>Seller & Zone</th>
                  <th>Buyer & Zone</th>
                  <th>Injected / Delivered</th>
                  <th>Trade Price</th>
                  <th>Total Billed</th>
                  <th>Buyer Savings</th>
                  <th>Route</th>
                </tr>
              </thead>
              <tbody>
                ${(data.recentTrades || []).length === 0 ? `
                  <tr>
                    <td colspan="9" class="text-center py-6 text-slate-400 text-xs">
                      No trades completed yet. Advance or start the simulation to execute continuous double-auction trades.
                    </td>
                  </tr>
                ` : data.recentTrades.map(t => {
                  const injected = Number(t.energyKWh || 0);
                  const delivered = Number(t.deliveredEnergyKWh !== undefined ? t.deliveredEnergyKWh : injected);
                  const tradePrice = Number(t.tradePriceINR || 0);
                  const totalCost = Number(t.buyerTotalCostINR !== undefined ? t.buyerTotalCostINR : (t.totalValueINR || (injected * tradePrice)));
                  const savings = Number(t.buyerSavingsINR !== undefined ? t.buyerSavingsINR : (t.buyerGrossSavingsINR || 0));
                  const sZone = t.sellerZone || 'ZONE-A';
                  const bZone = t.buyerZone || 'ZONE-B';
                  const crossZone = Boolean(t.isCrossZone);

                  return `
                  <tr>
                    <td class="font-mono text-xs font-bold text-slate-800">${t.tradeId || t.transactionId}</td>
                    <td class="font-mono text-xs text-slate-500">${String(t.simulationHour || 0).padStart(2, '0')}:00</td>
                    <td>
                      <div class="font-semibold text-slate-800">${t.sellerName}</div>
                      <span class="badge text-[10px] font-mono badge-purple">${sZone}</span>
                    </td>
                    <td>
                      <div class="font-semibold text-slate-800">${t.buyerName}</div>
                      <span class="badge text-[10px] font-mono badge-blue">${bZone}</span>
                    </td>
                    <td class="font-mono">
                      <div class="font-bold text-slate-900">${delivered.toFixed(2)} kWh</div>
                      <div class="text-[10px] text-slate-400">Injected: ${injected.toFixed(2)} kWh</div>
                    </td>
                    <td class="font-mono text-emerald-700 font-bold">₹${tradePrice.toFixed(2)}/kWh</td>
                    <td class="font-mono font-bold text-slate-800">₹${totalCost.toFixed(2)}</td>
                    <td class="font-mono font-bold text-emerald-700">${savings >= 0 ? '+' : ''}₹${savings.toFixed(2)}</td>
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

        <!-- COMPANY OPERATOR: REGULATORY PRICING RULES & REVIEW MANAGEMENT -->
        <div class="card p-5 bg-white space-y-4 border border-purple-200">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-section-heading text-slate-800">Company Operator & Regulatory Administration</h2>
                <span class="badge badge-purple text-[10px] font-mono font-bold">Active: RULE-TN-SIM-2026-V1</span>
              </div>
              <p class="text-caption text-slate-500 mt-0.5">
                Manage configured pricing rules, validate offers, monitor trading constraints, and resolve seller price reviews.
              </p>
            </div>
            <div class="text-[11px] bg-purple-50 text-purple-900 border border-purple-200 px-3 py-1 rounded-xl">
              "Simulation rules — pending regulatory verification"
            </div>
          </div>

          <!-- Active Rule Metadata Grid -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span class="text-[11px] text-slate-500">Permitted Price Band</span>
              <div class="text-sm font-bold font-mono text-slate-900 mt-0.5">₹2.00 – ₹8.00 /kWh</div>
              <div class="text-[10px] text-slate-400">Export Floor to Retail Cap</div>
            </div>
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span class="text-[11px] text-slate-500">Platform Transaction Fee</span>
              <div class="text-sm font-bold font-mono text-emerald-700 mt-0.5">₹0.20 /kWh</div>
              <div class="text-[10px] text-slate-400">Transparent buyer fee</div>
            </div>
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span class="text-[11px] text-slate-500">Wheeling Rates</span>
              <div class="text-sm font-bold font-mono text-purple-700 mt-0.5">₹0.10 (Local) / ₹0.25 (Inter)</div>
              <div class="text-[10px] text-slate-400">Grid transit charge</div>
            </div>
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span class="text-[11px] text-slate-500">Regulatory Framework</span>
              <div class="text-sm font-bold text-slate-800 mt-0.5">TNERC Benchmark</div>
              <div class="text-[10px] text-slate-400">Low & Medium Voltage Open Access</div>
            </div>
          </div>

          <!-- Operator Section: Price Review Requests & Rejected Log -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
            <!-- Review Requests Queue -->
            <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-800 uppercase tracking-wide">Seller Price Review Queue</span>
                <span id="overview-pending-reviews-count" class="badge badge-amber text-[10px]">Loading...</span>
              </div>
              <div id="overview-reviews-container" class="space-y-2 min-h-[100px] text-xs">
                <!-- Dynamically populated -->
              </div>
            </div>

            <!-- Rejected Prices Audit Log -->
            <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-800 uppercase tracking-wide">Rejected Prices Audit Log</span>
                <span id="overview-rejected-log-count" class="badge badge-slate text-[10px]">Audit Log</span>
              </div>
              <div id="overview-rejected-container" class="space-y-1.5 max-h-[150px] overflow-y-auto text-xs font-mono">
                <!-- Dynamically populated -->
              </div>
            </div>
          </div>
        </div>

        <!-- REGULATORY & SIMULATION ASSUMPTIONS DISCLAIMER -->
        <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-start gap-3">
          <div>
            <div class="font-bold text-slate-700">Simulation Assumptions & Regulatory Notice</div>
            <p class="text-[11px] text-slate-500 mt-0.5">${disclaimer}</p>
          </div>
        </div>

      </div>
    `;

    // Render 6 SVG Charts asynchronously after DOM insertion
    setTimeout(async () => {
      try {
        const analyticsData = await window.API.getAnalytics();
        const hourlyData = analyticsData.hourlyData || [];

        // 1. Generation vs Demand curve
        window.Charts.renderGenDemandChart(hourlyData, 'overview-gen-demand-chart');

        // 2. Supply vs Demand balance
        window.Charts.renderSupplyDemandBalanceChart(hourlyData, 'overview-supply-demand-chart');

        // 3. Hourly price trend
        window.Charts.renderPriceTrendChart(hourlyData, 'overview-price-trend-chart');

        // 4. Traded volume
        window.Charts.renderVolumeBarChart(hourlyData, 'overview-volume-chart');

        // 5. Cumulative carbon emissions avoided
        window.Charts.renderCarbonAvoidedChart(hourlyData, 'overview-carbon-chart');

        // 6. Company Finance Comparison
        window.Charts.renderCompanyFinanceChart(cf, 'overview-company-finance-chart');

        // 7. Load Operator Review Queue & Rejected Log
        window.OverviewView.loadOperatorData();
      } catch (e) {
        console.warn('Could not initialize overview charts:', e);
      }
    }, 50);
  },

  async loadOperatorData() {
    try {
      const [reviewsData, rejectedLogData] = await Promise.all([
        window.API.getPriceReviewRequests().catch(() => ({ reviewRequests: [] })),
        window.API.getRejectedPricesLog(10).catch(() => ({ rejectedPricesLog: [] }))
      ]);

      const reviews = reviewsData.reviewRequests || [];
      const pendingReviews = reviews.filter(r => r.status === 'PENDING');
      const rejectedLog = rejectedLogData.rejectedPricesLog || [];

      const countBadge = document.getElementById('overview-pending-reviews-count');
      if (countBadge) {
        countBadge.innerText = `${pendingReviews.length} Pending`;
        countBadge.className = `badge text-[10px] ${pendingReviews.length > 0 ? 'badge-amber font-bold' : 'badge-slate'}`;
      }

      const reviewsContainer = document.getElementById('overview-reviews-container');
      if (reviewsContainer) {
        if (reviews.length === 0) {
          reviewsContainer.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs">No price review requests submitted.</div>`;
        } else {
          reviewsContainer.innerHTML = reviews.slice(0, 5).map(r => `
            <div class="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
              <div class="flex justify-between items-center">
                <span class="font-bold text-slate-900">${r.sellerName} (${r.sellerId})</span>
                <span class="badge ${r.status === 'PENDING' ? 'badge-amber' : (r.status === 'APPROVED' ? 'badge-emerald' : 'badge-danger')} text-[10px]">
                  ${r.status}
                </span>
              </div>
              <div class="text-[11px] text-slate-600">
                Requested: <span class="font-mono font-bold text-slate-900">₹${r.requestedPriceINR.toFixed(2)}/kWh</span> | Surplus: ${r.surplusKWh} kWh
              </div>
              <div class="text-[11px] text-slate-500 italic">"${r.reason}"</div>
              ${r.status === 'PENDING' ? `
                <div class="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <button 
                    onclick="window.OverviewView.handleResolveReview('${r.id}', 'APPROVED')"
                    class="btn btn-primary text-[10px] py-1 px-2 font-bold"
                  >
                    Approve Exception
                  </button>
                  <button 
                    onclick="window.OverviewView.handleResolveReview('${r.id}', 'REJECTED')"
                    class="btn btn-danger text-[10px] py-1 px-2 font-bold"
                  >
                    Reject
                  </button>
                </div>
              ` : `
                <div class="text-[10px] text-slate-400">Resolved: ${r.operatorNotes || r.status}</div>
              `}
            </div>
          `).join('');
        }
      }

      const rejectedContainer = document.getElementById('overview-rejected-container');
      if (rejectedContainer) {
        if (rejectedLog.length === 0) {
          rejectedContainer.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs">No rejected price submissions logged.</div>`;
        } else {
          rejectedContainer.innerHTML = rejectedLog.slice(0, 8).map(rej => `
            <div class="p-1.5 bg-white rounded border border-red-100 text-[11px] text-slate-700 flex justify-between items-start gap-1">
              <div>
                <span class="font-bold text-red-700 font-mono">₹${rej.attemptedPriceINR.toFixed(2)}</span>
                <span class="text-slate-500">by ${rej.sellerName || rej.sellerId}</span>
                <div class="text-[10px] text-slate-400 truncate max-w-[280px]">${rej.reason}</div>
              </div>
              <span class="text-[9px] text-slate-400 shrink-0 font-sans">${new Date(rej.attemptedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          `).join('');
        }
      }
    } catch (err) {
      console.warn('Could not load operator review data:', err);
    }
  },

  async handleResolveReview(id, decision) {
    const operatorNotes = prompt(`Enter operator notes for ${decision} decision:`, `Administrative ${decision.toLowerCase()} under simulation review framework`);
    if (operatorNotes === null) return;

    try {
      await window.API.resolvePriceReview(id, decision, operatorNotes);
      window.Toast.success(`Review request ${id} ${decision.toLowerCase()}!`);
      this.loadOperatorData();
    } catch (err) {
      window.Toast.error(`Could not resolve review: ${err.message}`);
    }
  }
};
