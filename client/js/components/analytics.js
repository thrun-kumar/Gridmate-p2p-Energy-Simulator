/**
 * SolarShare - Market Price & Grid Analytics View (Light Theme)
 * Presents 8 complete interactive demonstration charts covering price formation,
 * solar surplus vs demand, traded volumes, participant distribution, consumer savings,
 * and seller revenues across the 24-hour simulation cycle.
 */

window.AnalyticsView = {
  render(data) {
    const root = document.getElementById('view-content');
    if (!root) return;

    const hourly = data.hourlyData || [];
    const participants = data.participants || [];

    // Calculate aggregated summary statistics across 24 hours
    const totalGen = Number(hourly.reduce((sum, h) => sum + (h.generationKWh || 0), 0).toFixed(2));
    const totalDemand = Number(hourly.reduce((sum, h) => sum + (h.demandKWh || 0), 0).toFixed(2));
    const totalTraded = Number(hourly.reduce((sum, h) => sum + (h.tradedKWh || 0), 0).toFixed(2));
    const totalTradesCount = hourly.reduce((sum, h) => sum + (h.tradesCount || 0), 0);
    const totalSavings = Number(hourly.reduce((sum, h) => sum + (h.totalBuyerSavingsINR || 0), 0).toFixed(2));

    root.innerHTML = `
      <div class="space-y-6">
        <!-- TOP BANNER -->
        <div class="card p-5 card-accent-green bg-white">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-page-title text-slate-800">Dynamic Market Analytics & 24-Hour Grid Intelligence</h1>
                <span class="badge badge-emerald text-xs uppercase font-mono font-bold">24H Timeline (00:00 - 23:00)</span>
              </div>
              <p class="text-caption text-slate-500 mt-1 max-w-3xl">
                Real-time price-formation curves, peer matching volumes, bilateral trade settlement, and participant savings governed by cooperative dynamic pricing.
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-3 text-xs">
              <div class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                <span class="text-slate-500">Total Solar Gen:</span>
                <span class="font-bold font-mono text-emerald-700 ml-1">${totalGen} kWh</span>
              </div>
              <div class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                <span class="text-slate-500">Gross Demand:</span>
                <span class="font-bold font-mono text-blue-700 ml-1">${totalDemand} kWh</span>
              </div>
              <div class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                <span class="text-slate-500">Settled Trades:</span>
                <span class="font-bold font-mono text-slate-900 ml-1">${totalTradesCount} (${totalTraded} kWh)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ROW 1: CHARTS 1 & 2 (PRICE FORMATION & GENERATION VS DEMAND) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Chart 1: Market Clearing Price & Recommended Price Trend -->
          <div class="card p-5 bg-white space-y-3 shadow-xs">
            <div class="flex items-start justify-between">
              <div>
                <h2 class="text-section-heading text-slate-800">1. Electricity Price Formation (₹/kWh)</h2>
                <p class="text-caption text-slate-500">Dynamic recommended baseline vs actual executed clearing price</p>
              </div>
              <span class="badge badge-blue text-[10px] font-mono">Formula Clamped ₹2.00 - ₹8.00</span>
            </div>
            <div id="analytics-price-chart" class="mt-2 min-h-[220px]"></div>
          </div>

          <!-- Chart 2: Aggregated Generation vs Load -->
          <div class="card p-5 bg-white space-y-3 shadow-xs">
            <div class="flex items-start justify-between">
              <div>
                <h2 class="text-section-heading text-slate-800">2. Solar Generation vs Community Load</h2>
                <p class="text-caption text-slate-500">Community solar generation (green) vs aggregated consumption demand (blue)</p>
              </div>
              <span class="badge badge-emerald text-[10px] font-mono">12 Households</span>
            </div>
            <div id="analytics-gen-demand-chart" class="mt-2 min-h-[240px]"></div>
          </div>
        </div>

        <!-- ROW 2: CHARTS 3 & 4 (TRADED VOLUME & SURPLUS VS DEFICIT) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Chart 3: Traded Clean Energy Volume per Hour -->
          <div class="card p-5 bg-white space-y-3 shadow-xs">
            <div class="flex items-start justify-between">
              <div>
                <h2 class="text-section-heading text-slate-800">3. Clean Energy Traded per Hourly Interval (kWh)</h2>
                <p class="text-caption text-slate-500">Trading volume concentrated around midday solar window (10:00 - 14:00)</p>
              </div>
              <span class="badge badge-teal text-[10px] font-mono">P2P Volume</span>
            </div>
            <div id="analytics-volume-chart" class="mt-2 min-h-[210px]"></div>
          </div>

          <!-- Chart 4: Hourly Surplus vs Deficit Balance -->
          <div class="card p-5 bg-white space-y-3 shadow-xs">
            <div class="flex items-start justify-between">
              <div>
                <h2 class="text-section-heading text-slate-800">4. Solar Surplus vs Consumer Energy Deficit (kWh)</h2>
                <p class="text-caption text-slate-500">Green bars denote solar surplus; amber bars denote unmet consumption demand</p>
              </div>
              <span class="badge badge-purple text-[10px] font-mono">Balance</span>
            </div>
            <div id="analytics-balance-chart" class="mt-2 min-h-[210px]"></div>
          </div>
        </div>

        <!-- ROW 3: CHARTS 5 & 6 (CONSUMER SAVINGS & PROSUMER REVENUE) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Chart 5: Consumer Cost Savings over Time -->
          <div class="card p-5 bg-white space-y-3 shadow-xs">
            <div class="flex items-start justify-between">
              <div>
                <h2 class="text-section-heading text-slate-800">5. Consumer Electricity Bill Savings (₹)</h2>
                <p class="text-caption text-slate-500">Savings achieved by procuring solar surplus below ₹8.00/kWh utility retail tariff</p>
              </div>
              <span class="badge badge-emerald text-[10px] font-mono">Buyer Benefit</span>
            </div>
            <div id="analytics-savings-chart" class="mt-2 min-h-[210px]"></div>
          </div>

          <!-- Chart 6: Solar Prosumer Revenue over Time -->
          <div class="card p-5 bg-white space-y-3 shadow-xs">
            <div class="flex items-start justify-between">
              <div>
                <h2 class="text-section-heading text-slate-800">6. Solar Prosumer Revenue Generated (₹)</h2>
                <p class="text-caption text-slate-500">Revenue earned by solar sellers above ₹2.00/kWh utility feed-in floor</p>
              </div>
              <span class="badge badge-amber text-[10px] font-mono">Seller Revenue</span>
            </div>
            <div id="analytics-revenue-chart" class="mt-2 min-h-[210px]"></div>
          </div>
        </div>

        <!-- ROW 4: CHARTS 7 & 8 (PARTICIPANT DISTRIBUTION & COMPLETED VS UNMATCHED) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Chart 7: 12-Participant Clean Energy Distribution -->
          <div class="card p-5 bg-white space-y-3 shadow-xs">
            <div class="flex items-start justify-between">
              <div>
                <h2 class="text-section-heading text-slate-800">7. 12-Participant Clean Energy Distribution</h2>
                <p class="text-caption text-slate-500">6 Solar Prosumers (green) & 6 Grid Consumers (blue, no solar panels required)</p>
              </div>
              <span class="badge badge-slate text-[10px] font-mono">All 12 Households</span>
            </div>
            <div id="analytics-participant-chart" class="mt-2 min-h-[240px]"></div>
          </div>

          <!-- Chart 8: Clean P2P Traded vs Unmatched Grid Demand -->
          <div class="card p-5 bg-white space-y-3 shadow-xs">
            <div class="flex items-start justify-between">
              <div>
                <h2 class="text-section-heading text-slate-800">8. Clean P2P Energy vs Utility Grid Import Demand</h2>
                <p class="text-caption text-slate-500">Demonstrates grid relief and clean energy offset during peak solar intervals</p>
              </div>
              <span class="badge badge-blue text-[10px] font-mono">Grid Offset</span>
            </div>
            <div id="analytics-completed-unmatched-chart" class="mt-2 min-h-[210px]"></div>
          </div>
        </div>

        <!-- EXPLANATORY & REGULATORY TRANSPARENCY PANEL -->
        <div class="card p-6 bg-white space-y-4 border border-slate-200">
          <div class="flex items-center justify-between border-b border-slate-100 pb-2">
            <span class="text-emerald-700 font-bold text-sm">Market Dynamics & Pricing Rules Rationale</span>
            <span class="text-[11px] text-slate-500 italic">"Simulation rules — pending regulatory verification"</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <span class="font-bold text-slate-900 block text-xs text-emerald-700">1. Midday Solar Surplus (10:00 - 14:00)</span>
              <p class="text-slate-600 leading-relaxed text-[11px]">
                When rooftop solar insolation peaks, prosumers hold abundant surplus. To ensure dispatch before energy is curtailed, sellers offer at competitive lower asks (₹3.50 - ₹4.50/kWh). Market clearing prices soften, providing maximum consumer savings.
              </p>
            </div>

            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <span class="font-bold text-slate-900 block text-xs text-amber-700">2. Solar Ramp & Decline (07:00, 16:00)</span>
              <p class="text-slate-600 leading-relaxed text-[11px]">
                As sunlight begins or fades, solar surplus is scarce while household demand remains high. Buyers bid more aggressively for limited units (₹6.50 - ₹7.20/kWh), remaining safely below the ₹8.00 grid tariff.
              </p>
            </div>

            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <span class="font-bold text-slate-900 block text-xs text-blue-700">3. Night Interval (19:00 - 05:00)</span>
              <p class="text-slate-600 leading-relaxed text-[11px]">
                Solar generation is zero. With no peer solar surplus available, the market enters a Shortage phase. Rather than fabricating artificial prices, the engine reports "No trades", and participants draw power from the utility grid.
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    // Render all 8 charts asynchronously into their respective containers
    setTimeout(() => {
      window.Charts.renderPriceChart(hourly, 'analytics-price-chart');
      window.Charts.renderGenDemandChart(hourly, 'analytics-gen-demand-chart');
      window.Charts.renderVolumeBarChart(hourly, 'analytics-volume-chart');
      window.Charts.renderSupplyDemandBalanceChart(hourly, 'analytics-balance-chart');
      window.Charts.renderSavingsChart(hourly, 'analytics-savings-chart');
      window.Charts.renderSellerRevenueChart(hourly, 'analytics-revenue-chart');
      window.Charts.renderParticipantEnergyChart(participants, 'analytics-participant-chart');
      window.Charts.renderCompletedUnmatchedChart(hourly, 'analytics-completed-unmatched-chart');
    }, 15);
  }
};
