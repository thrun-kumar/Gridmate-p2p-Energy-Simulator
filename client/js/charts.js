/**
 * SolarShare - Light-Theme SVG Chart Engine
 * Produces crisp, accessible, light-theme charts with responsive viewBox and clean tooltips.
 * Implements 8 complete demonstration charts with real-time updates and forecast baseline previews.
 */

window.Charts = {
  /**
   * Chart 1: Market Clearing Price & Recommended Price Trend across 24 hours.
   */
  renderPriceChart(hourlyData, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const data = hourlyData || [];
    const hasAnyTrades = data.some(d => d.weightedAveragePriceINR !== null && d.weightedAveragePriceINR > 0);

    const width = 800;
    const height = 220;
    const pad = { top: 20, right: 25, bottom: 35, left: 50 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;

    const maxPrice = 9.0;
    const minPrice = 1.0;

    const getX = i => pad.left + (i / 23) * chartW;
    const getY = val => pad.top + chartH - ((Math.max(minPrice, Math.min(maxPrice, val)) - minPrice) / (maxPrice - minPrice)) * chartH;

    // Grid lines for reference thresholds
    let gridLines = '';
    [2.0, 4.0, 6.0, 8.0].forEach(p => {
      const y = getY(p);
      const isBaseline = p === 8.0 || p === 2.0;
      gridLines += `
        <line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="${isBaseline ? '#fca5a5' : '#e2e8f0'}" stroke-dasharray="${isBaseline ? 'none' : '3,3'}" />
        <text x="${pad.left - 6}" y="${y + 3.5}" fill="${isBaseline ? '#dc2626' : '#64748b'}" font-size="10" text-anchor="end" font-family="Inter, sans-serif">₹${p.toFixed(2)}</text>
      `;
    });

    // X-axis time marks
    let xLabels = '';
    for (let h = 0; h < 24; h += 3) {
      const x = getX(h);
      xLabels += `
        <line x1="${x}" y1="${pad.top + chartH}" x2="${x}" y2="${pad.top + chartH + 4}" stroke="#cbd5e1" />
        <text x="${x}" y="${pad.top + chartH + 18}" fill="#64748b" font-size="10" text-anchor="middle" font-family="Inter, sans-serif">${String(h).padStart(2, '0')}:00</text>
      `;
    }

    // Baseline Recommended Price Curve (Dashed Blue Line)
    let recPath = '';
    data.forEach((d, i) => {
      const p = d.recommendedPriceINR !== undefined ? d.recommendedPriceINR : 5.00;
      const x = getX(i);
      const y = getY(p);
      recPath += (i === 0 ? `M ${x} ${y} ` : `L ${x} ${y} `);
    });

    // Solid Executed Clearing Prices (if any trades have occurred)
    let execPath = '';
    let execPoints = '';
    let started = false;

    data.forEach((d, i) => {
      if (d.weightedAveragePriceINR !== null && d.weightedAveragePriceINR > 0) {
        const x = getX(i);
        const y = getY(d.weightedAveragePriceINR);
        if (!started) {
          execPath += `M ${x} ${y} `;
          started = true;
        } else {
          execPath += `L ${x} ${y} `;
        }
        execPoints += `
          <circle cx="${x}" cy="${y}" r="3.5" fill="#16a34a" stroke="#ffffff" stroke-width="1.5">
            <title>${d.hourLabel || String(i).padStart(2, '0') + ':00'}: Executed Clearing Price ₹${d.weightedAveragePriceINR}/kWh (${d.tradesCount || 0} trades)</title>
          </circle>
        `;
      }
    });

    const previewBadge = !hasAnyTrades ? `
      <div class="mb-2 flex items-center justify-between">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-50 border border-sky-200 text-sky-800 text-[11px] font-medium">
          <span class="w-1.5 h-1.5 rounded-full bg-sky-600"></span>
          Simulated baseline preview (No live trades executed yet)
        </span>
        <span class="text-[11px] text-slate-500">Step hour or run simulation to see live clearing prices</span>
      </div>
    ` : '';

    el.innerHTML = `
      ${previewBadge}
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto overflow-visible select-none">
        ${gridLines}
        ${xLabels}
        <!-- Dynamic Recommended baseline curve -->
        <path d="${recPath}" fill="none" stroke="#0284c7" stroke-width="2" stroke-dasharray="4,4" />
        <!-- Actual Executed Trade Price curve -->
        ${execPath ? `<path d="${execPath}" fill="none" stroke="#16a34a" stroke-width="2.5" />` : ''}
        ${execPoints}
      </svg>
      <div class="flex flex-wrap items-center justify-center gap-5 mt-2 text-[11px] font-medium text-slate-600">
        <span class="flex items-center gap-1.5"><span class="w-3 h-0.5 bg-sky-600"></span> Dynamic Recommended Baseline (₹/kWh)</span>
        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-emerald-600"></span> Actual Executed Clearing Rate (₹/kWh)</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-0.5 bg-red-400"></span> Retail Grid Tariff Cap (₹8.00)</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-0.5 bg-red-300"></span> Feed-In Floor (₹2.00)</span>
      </div>
    `;
  },

  /**
   * Chart 2: Solar Generation vs Household Demand across 24 hours.
   */
  renderGenDemandChart(hourlyData, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const data = hourlyData || [];
    if (data.length === 0) {
      el.innerHTML = '<div class="p-8 text-center text-slate-500 text-xs">No generation/demand profile data available.</div>';
      return;
    }

    const width = 800;
    const height = 240;
    const pad = { top: 15, right: 25, bottom: 35, left: 45 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;

    const maxVal = Math.max(
      ...data.map(d => Math.max(d.generationKWh || 0, d.demandKWh || 0)),
      10
    ) * 1.15;

    const getX = i => pad.left + (i / 23) * chartW;
    const getY = val => pad.top + chartH - (val / maxVal) * chartH;

    // Solar Generation path & gradient area
    let genPath = '';
    let genArea = `M ${getX(0)} ${pad.top + chartH} `;
    data.forEach((d, i) => {
      const x = getX(i);
      const y = getY(d.generationKWh || 0);
      genPath += (i === 0 ? `M ${x} ${y} ` : `L ${x} ${y} `);
      genArea += `L ${x} ${y} `;
    });
    genArea += `L ${getX(23)} ${pad.top + chartH} Z`;

    // Demand path
    let demandPath = '';
    data.forEach((d, i) => {
      const x = getX(i);
      const y = getY(d.demandKWh || 0);
      demandPath += (i === 0 ? `M ${x} ${y} ` : `L ${x} ${y} `);
    });

    // Light grid lines & Y-ticks
    let gridLines = '';
    const ticks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];
    ticks.forEach(t => {
      const y = getY(t);
      gridLines += `
        <line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#e2e8f0" stroke-dasharray="3,3" />
        <text x="${pad.left - 6}" y="${y + 3.5}" fill="#64748b" font-size="10" text-anchor="end" font-family="Inter, sans-serif">${t.toFixed(0)}</text>
      `;
    });

    // X-axis labels
    let xLabels = '';
    for (let h = 0; h < 24; h += 3) {
      const x = getX(h);
      xLabels += `
        <line x1="${x}" y1="${pad.top + chartH}" x2="${x}" y2="${pad.top + chartH + 4}" stroke="#cbd5e1" />
        <text x="${x}" y="${pad.top + chartH + 18}" fill="#64748b" font-size="10" text-anchor="middle" font-family="Inter, sans-serif">${String(h).padStart(2, '0')}:00</text>
      `;
    }

    // Points on generation curve
    let genPoints = '';
    data.forEach((d, i) => {
      if (i % 2 === 0) {
        const x = getX(i);
        const y = getY(d.generationKWh || 0);
        genPoints += `<circle cx="${x}" cy="${y}" r="3" fill="#16a34a" stroke="#ffffff" stroke-width="1.5"><title>${String(i).padStart(2, '0')}:00 - Generation: ${d.generationKWh} kWh</title></circle>`;
      }
    });

    el.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto overflow-visible select-none">
        <defs>
          <linearGradient id="lightGenGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#16a34a" stop-opacity="0.22" />
            <stop offset="100%" stop-color="#16a34a" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        ${gridLines}
        ${xLabels}
        <path d="${genArea}" fill="url(#lightGenGrad)" />
        <path d="${genPath}" fill="none" stroke="#16a34a" stroke-width="2.5" />
        <path d="${demandPath}" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4,3" />
        ${genPoints}
      </svg>
      <div class="flex items-center justify-center gap-6 mt-2 text-[11px] font-medium text-slate-600">
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-emerald-600"></span> Solar Generation (kWh)</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-0.5 bg-blue-600"></span> Household Demand (kWh)</span>
      </div>
    `;
  },

  /**
   * Chart 3: Clean Energy Traded per Hourly Interval (kWh).
   */
  renderVolumeBarChart(hourlyData, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const data = hourlyData || [];
    const hasAnyTrades = data.some(d => (d.tradedKWh || 0) > 0);

    const width = 800;
    const height = 210;
    const pad = { top: 20, right: 25, bottom: 35, left: 45 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;

    // Use actual traded volume or potential volume if no trades yet
    const maxVal = Math.max(
      ...data.map(d => hasAnyTrades ? (d.tradedKWh || 0) : Math.min(d.surplusKWh || 0, d.deficitKWh || 0)),
      10
    ) * 1.25;

    const barWidth = (chartW / 24) * 0.65;
    let bars = '';
    let xLabels = '';

    data.forEach((d, h) => {
      const x = pad.left + (h / 24) * chartW + ((chartW / 24) - barWidth) / 2;
      const actualVal = d.tradedKWh || 0;
      const potentialVal = Math.min(d.surplusKWh || 0, d.deficitKWh || 0);
      const val = hasAnyTrades ? actualVal : potentialVal;
      const bH = (val / maxVal) * chartH;
      const y = pad.top + chartH - bH;

      const fill = hasAnyTrades 
        ? (actualVal > 0 ? '#16a34a' : '#f1f5f9')
        : (potentialVal > 0 ? '#99f6e4' : '#f1f5f9');
      const stroke = !hasAnyTrades && potentialVal > 0 ? '#0d9488' : 'none';

      bars += `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(2, bH)}" rx="2" fill="${fill}" stroke="${stroke}" stroke-dasharray="${stroke !== 'none' ? '2,2' : 'none'}" class="transition-all hover:opacity-80">
          <title>${d.hourLabel || String(h).padStart(2, '0') + ':00'}: ${hasAnyTrades ? actualVal.toFixed(2) + ' kWh traded (' + (d.tradesCount || 0) + ' trades)' : 'Potential: ' + potentialVal.toFixed(2) + ' kWh'}</title>
        </rect>
      `;

      if (h % 3 === 0) {
        xLabels += `<text x="${x + barWidth / 2}" y="${pad.top + chartH + 18}" fill="#64748b" font-size="10" text-anchor="middle" font-family="Inter, sans-serif">${String(h).padStart(2, '0')}:00</text>`;
      }
    });

    const previewBadge = !hasAnyTrades ? `
      <div class="mb-2 flex items-center justify-between">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-medium">
          <span class="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
          Simulated potential volume preview (No live trades executed yet)
        </span>
        <span class="text-[11px] text-slate-500">Peak tradable volume concentrated at midday</span>
      </div>
    ` : '';

    el.innerHTML = `
      ${previewBadge}
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto overflow-visible select-none">
        <line x1="${pad.left}" y1="${pad.top + chartH}" x2="${width - pad.right}" y2="${pad.top + chartH}" stroke="#cbd5e1" />
        ${bars}
        ${xLabels}
      </svg>
      <div class="flex items-center justify-center gap-6 mt-2 text-[11px] font-medium text-slate-600">
        ${hasAnyTrades ? `
          <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-emerald-600"></span> Settled Clean Energy Traded (kWh)</span>
        ` : `
          <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-teal-200 border border-dashed border-teal-600"></span> Potential Tradable Capacity (Simulated Baseline kWh)</span>
        `}
      </div>
    `;
  },

  /**
   * Chart 4: Solar Surplus vs Demand Deficit Hourly Balance (kWh).
   */
  renderSupplyDemandBalanceChart(hourlyData, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const data = hourlyData || [];
    if (data.length === 0) {
      el.innerHTML = '<div class="p-8 text-center text-slate-500 text-xs">No supply/demand balance data available.</div>';
      return;
    }

    const width = 800;
    const height = 210;
    const pad = { top: 15, right: 25, bottom: 35, left: 45 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;

    const maxVal = Math.max(
      ...data.map(d => Math.max(d.surplusKWh || 0, d.deficitKWh || 0)),
      10
    ) * 1.15;

    const barWidth = (chartW / 24) * 0.38;
    let bars = '';
    let xLabels = '';

    data.forEach((d, h) => {
      const xBase = pad.left + (h / 24) * chartW + ((chartW / 24) - (barWidth * 2 + 2)) / 2;
      const surplusH = ((d.surplusKWh || 0) / maxVal) * chartH;
      const deficitH = ((d.deficitKWh || 0) / maxVal) * chartH;

      const ySurplus = pad.top + chartH - surplusH;
      const yDeficit = pad.top + chartH - deficitH;

      bars += `
        <rect x="${xBase}" y="${ySurplus}" width="${barWidth}" height="${Math.max(1, surplusH)}" rx="1.5" fill="#10b981">
          <title>${d.hourLabel || String(h).padStart(2, '0') + ':00'}: Surplus ${Number(d.surplusKWh || 0).toFixed(1)} kWh</title>
        </rect>
        <rect x="${xBase + barWidth + 2}" y="${yDeficit}" width="${barWidth}" height="${Math.max(1, deficitH)}" rx="1.5" fill="#f59e0b">
          <title>${d.hourLabel || String(h).padStart(2, '0') + ':00'}: Deficit ${Number(d.deficitKWh || 0).toFixed(1)} kWh</title>
        </rect>
      `;

      if (h % 3 === 0) {
        xLabels += `<text x="${xBase + barWidth}" y="${pad.top + chartH + 18}" fill="#64748b" font-size="10" text-anchor="middle" font-family="Inter, sans-serif">${String(h).padStart(2, '0')}:00</text>`;
      }
    });

    el.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto overflow-visible select-none">
        <line x1="${pad.left}" y1="${pad.top + chartH}" x2="${width - pad.right}" y2="${pad.top + chartH}" stroke="#cbd5e1" />
        ${bars}
        ${xLabels}
      </svg>
      <div class="flex items-center justify-center gap-6 mt-2 text-[11px] font-medium text-slate-600">
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-emerald-500"></span> Solar Surplus (kWh)</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-amber-500"></span> Consumer Energy Deficit (kWh)</span>
      </div>
    `;
  },

  /**
   * Chart 5: Consumer Cost Savings over 24 Hours (₹).
   * Compares P2P procurement vs ₹8.00/kWh utility benchmark.
   */
  renderSavingsChart(hourlyData, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const data = hourlyData || [];
    const hasAnyTrades = data.some(d => (d.totalBuyerSavingsINR || 0) > 0 || (d.tradedKWh || 0) > 0);

    const width = 800;
    const height = 210;
    const pad = { top: 20, right: 25, bottom: 35, left: 55 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;

    // Calculate actual and forecast potential savings per hour
    const savingsPoints = data.map(d => {
      const actual = Number(d.totalBuyerSavingsINR || ((8.00 - (d.weightedAveragePriceINR || 5.00)) * (d.tradedKWh || 0)));
      const potentialQty = Math.min(d.surplusKWh || 0, d.deficitKWh || 0);
      const forecast = Number(Math.max(0, (8.00 - (d.recommendedPriceINR || 5.00)) * potentialQty).toFixed(2));
      return { actual: Math.max(0, actual), forecast };
    });

    const maxVal = Math.max(
      ...savingsPoints.map(p => hasAnyTrades ? Math.max(p.actual, p.forecast) : p.forecast),
      15
    ) * 1.2;

    const getX = i => pad.left + (i / 23) * chartW;
    const getY = val => pad.top + chartH - (val / maxVal) * chartH;

    // Forecast Savings Path & Area (Teal)
    let forecastPath = '';
    let forecastArea = `M ${getX(0)} ${pad.top + chartH} `;
    savingsPoints.forEach((p, i) => {
      const x = getX(i);
      const y = getY(p.forecast);
      forecastPath += (i === 0 ? `M ${x} ${y} ` : `L ${x} ${y} `);
      forecastArea += `L ${x} ${y} `;
    });
    forecastArea += `L ${getX(23)} ${pad.top + chartH} Z`;

    // Actual Realized Savings Path (Solid Emerald)
    let actualPath = '';
    let actualPoints = '';
    let started = false;
    savingsPoints.forEach((p, i) => {
      if (p.actual > 0) {
        const x = getX(i);
        const y = getY(p.actual);
        if (!started) {
          actualPath += `M ${x} ${y} `;
          started = true;
        } else {
          actualPath += `L ${x} ${y} `;
        }
        actualPoints += `<circle cx="${x}" cy="${y}" r="3" fill="#059669" stroke="#ffffff" stroke-width="1.5"><title>Hour ${i}: ₹${p.actual.toFixed(2)} Realized Savings</title></circle>`;
      }
    });

    let xLabels = '';
    for (let h = 0; h < 24; h += 3) {
      const x = getX(h);
      xLabels += `<text x="${x}" y="${pad.top + chartH + 18}" fill="#64748b" font-size="10" text-anchor="middle" font-family="Inter, sans-serif">${String(h).padStart(2, '0')}:00</text>`;
    }

    const previewBadge = !hasAnyTrades ? `
      <div class="mb-2 flex items-center justify-between">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-medium">
          <span class="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
          Simulated savings potential preview (No live trades executed yet)
        </span>
        <span class="text-[11px] text-slate-500">Savings calculated vs ₹8.00/kWh utility benchmark</span>
      </div>
    ` : '';

    el.innerHTML = `
      ${previewBadge}
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto overflow-visible select-none">
        <defs>
          <linearGradient id="savGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0d9488" stop-opacity="0.2" />
            <stop offset="100%" stop-color="#0d9488" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        <line x1="${pad.left}" y1="${pad.top + chartH}" x2="${width - pad.right}" y2="${pad.top + chartH}" stroke="#cbd5e1" />
        <path d="${forecastArea}" fill="url(#savGrad)" />
        <path d="${forecastPath}" fill="none" stroke="#0d9488" stroke-width="1.8" stroke-dasharray="3,3" />
        ${actualPath ? `<path d="${actualPath}" fill="none" stroke="#059669" stroke-width="2.5" />` : ''}
        ${actualPoints}
        ${xLabels}
      </svg>
      <div class="flex items-center justify-center gap-6 mt-2 text-[11px] font-medium text-slate-600">
        <span class="flex items-center gap-1.5"><span class="w-3 h-0.5 bg-teal-600 border border-dashed"></span> Forecast Potential Savings (₹)</span>
        ${hasAnyTrades ? `<span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-emerald-600"></span> Actual Realized Savings (₹)</span>` : ''}
      </div>
    `;
  },

  /**
   * Chart 6: Solar Prosumer Revenue Curve over 24 Hours (₹).
   * Compares P2P revenue against standard ₹2.00/kWh feed-in tariff.
   */
  renderSellerRevenueChart(hourlyData, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const data = hourlyData || [];
    const hasAnyTrades = data.some(d => (d.tradeValueINR || 0) > 0);

    const width = 800;
    const height = 210;
    const pad = { top: 20, right: 25, bottom: 35, left: 55 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;

    const revPoints = data.map(d => {
      const actual = Number(d.tradeValueINR || ((d.weightedAveragePriceINR || 0) * (d.tradedKWh || 0)));
      const potentialQty = Math.min(d.surplusKWh || 0, d.deficitKWh || 0);
      const forecast = Number(((d.recommendedPriceINR || 5.00) * potentialQty).toFixed(2));
      return { actual, forecast };
    });

    const maxVal = Math.max(
      ...revPoints.map(p => hasAnyTrades ? Math.max(p.actual, p.forecast) : p.forecast),
      20
    ) * 1.2;

    const getX = i => pad.left + (i / 23) * chartW;
    const getY = val => pad.top + chartH - (val / maxVal) * chartH;

    // Forecast Revenue Path & Area (Amber/Orange)
    let forecastPath = '';
    let forecastArea = `M ${getX(0)} ${pad.top + chartH} `;
    revPoints.forEach((p, i) => {
      const x = getX(i);
      const y = getY(p.forecast);
      forecastPath += (i === 0 ? `M ${x} ${y} ` : `L ${x} ${y} `);
      forecastArea += `L ${x} ${y} `;
    });
    forecastArea += `L ${getX(23)} ${pad.top + chartH} Z`;

    // Actual Realized Revenue Path (Solid Amber)
    let actualPath = '';
    let actualPoints = '';
    let started = false;
    revPoints.forEach((p, i) => {
      if (p.actual > 0) {
        const x = getX(i);
        const y = getY(p.actual);
        if (!started) {
          actualPath += `M ${x} ${y} `;
          started = true;
        } else {
          actualPath += `L ${x} ${y} `;
        }
        actualPoints += `<circle cx="${x}" cy="${y}" r="3" fill="#d97706" stroke="#ffffff" stroke-width="1.5"><title>Hour ${i}: ₹${p.actual.toFixed(2)} Revenue</title></circle>`;
      }
    });

    let xLabels = '';
    for (let h = 0; h < 24; h += 3) {
      const x = getX(h);
      xLabels += `<text x="${x}" y="${pad.top + chartH + 18}" fill="#64748b" font-size="10" text-anchor="middle" font-family="Inter, sans-serif">${String(h).padStart(2, '0')}:00</text>`;
    }

    const previewBadge = !hasAnyTrades ? `
      <div class="mb-2 flex items-center justify-between">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
          Simulated revenue potential preview (No live trades executed yet)
        </span>
        <span class="text-[11px] text-slate-500">Prosumer revenue peaks between 10:00 - 14:00</span>
      </div>
    ` : '';

    el.innerHTML = `
      ${previewBadge}
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto overflow-visible select-none">
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.22" />
            <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        <line x1="${pad.left}" y1="${pad.top + chartH}" x2="${width - pad.right}" y2="${pad.top + chartH}" stroke="#cbd5e1" />
        <path d="${forecastArea}" fill="url(#revGrad)" />
        <path d="${forecastPath}" fill="none" stroke="#d97706" stroke-width="1.8" stroke-dasharray="3,3" />
        ${actualPath ? `<path d="${actualPath}" fill="none" stroke="#b45309" stroke-width="2.5" />` : ''}
        ${actualPoints}
        ${xLabels}
      </svg>
      <div class="flex items-center justify-center gap-6 mt-2 text-[11px] font-medium text-slate-600">
        <span class="flex items-center gap-1.5"><span class="w-3 h-0.5 bg-amber-600 border border-dashed"></span> Forecast Potential Revenue (₹)</span>
        ${hasAnyTrades ? `<span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-amber-700"></span> Actual Realized Revenue (₹)</span>` : ''}
      </div>
    `;
  },

  /**
   * Chart 7: 12-Participant Clean Energy Distribution.
   * Displays all 12 households (6 Solar Prosumers & 6 Grid Consumers).
   */
  renderParticipantEnergyChart(participants, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const list = participants || [];
    if (list.length === 0) {
      el.innerHTML = '<div class="p-8 text-center text-slate-500 text-xs">No participant data available.</div>';
      return;
    }

    const width = 800;
    const rowHeight = 28;
    const height = list.length * rowHeight + 45;
    const pad = { top: 15, right: 30, bottom: 25, left: 160 };
    const chartW = width - pad.left - pad.right;

    const maxEnergy = Math.max(
      ...list.map(p => Math.max(p.solarCapacityKW || 0, p.totalEnergySoldKWh || 0, p.totalEnergyBoughtKWh || 0, p.generationKWh || 0, p.demandKWh || 0)),
      12
    ) * 1.15;

    let rowsHtml = '';
    list.forEach((p, i) => {
      const y = pad.top + i * rowHeight;
      const isSeller = (p.solarCapacityKW || 0) > 0 || p.role === 'prosumer';
      const sold = p.totalEnergySoldKWh || 0;
      const bought = p.totalEnergyBoughtKWh || 0;
      const capacity = p.solarCapacityKW || 0;

      // Bar width representation
      const barVal = isSeller ? (sold > 0 ? sold : capacity) : (bought > 0 ? bought : (p.demandKWh || 5));
      const bW = Math.max(4, (barVal / maxEnergy) * chartW);
      const color = isSeller ? '#10b981' : '#3b82f6';

      rowsHtml += `
        <g class="hover:opacity-80">
          <text x="${pad.left - 10}" y="${y + 16}" fill="#334155" font-size="11" font-weight="600" text-anchor="end" font-family="Inter, sans-serif">
            ${p.id} · ${p.name.length > 16 ? p.name.substring(0, 15) + '…' : p.name}
          </text>
          <rect x="${pad.left}" y="${y + 4}" width="${bW}" height="16" rx="3" fill="${color}">
            <title>${p.name} (${p.id}): ${isSeller ? 'Solar Prosumer (' + capacity + ' kW PV) · Sold: ' + sold.toFixed(2) + ' kWh' : 'Grid Consumer (0 kW PV) · Bought: ' + bought.toFixed(2) + ' kWh'}</title>
          </rect>
          <text x="${pad.left + bW + 8}" y="${y + 16}" fill="#64748b" font-size="10" font-family="JetBrains Mono, monospace">
            ${isSeller ? (sold > 0 ? sold.toFixed(1) + ' kWh sold' : capacity + ' kW PV') : (bought > 0 ? bought.toFixed(1) + ' kWh bought' : 'No solar (Grid consumer)')}
          </text>
        </g>
      `;
    });

    el.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto overflow-visible select-none">
        <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}" stroke="#cbd5e1" />
        ${rowsHtml}
      </svg>
      <div class="flex items-center justify-center gap-6 mt-3 text-[11px] font-medium text-slate-600">
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-emerald-500"></span> Solar Prosumers (6 Sellers · Rooftop PV)</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-blue-500"></span> Grid Consumers (6 Buyers · Solar panels not required)</span>
      </div>
    `;
  },

  /**
   * Chart 8: Completed P2P Traded Demand vs Unmatched Grid Demand (kWh).
   */
  renderCompletedUnmatchedChart(hourlyData, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const data = hourlyData || [];
    const width = 800;
    const height = 210;
    const pad = { top: 20, right: 25, bottom: 35, left: 45 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;

    const maxVal = Math.max(
      ...data.map(d => Math.max(d.demandKWh || 0, (d.tradedKWh || 0) + (d.deficitKWh || 0))),
      15
    ) * 1.15;

    const barWidth = (chartW / 24) * 0.65;
    let bars = '';
    let xLabels = '';

    data.forEach((d, h) => {
      const x = pad.left + (h / 24) * chartW + ((chartW / 24) - barWidth) / 2;
      const traded = d.tradedKWh || 0;
      const totalDemand = d.demandKWh || 0;
      const unmatched = Math.max(0, totalDemand - traded);

      const tradedH = (traded / maxVal) * chartH;
      const unmatchedH = (unmatched / maxVal) * chartH;

      const yTraded = pad.top + chartH - tradedH;
      const yUnmatched = pad.top + chartH - tradedH - unmatchedH;

      bars += `
        <!-- Traded P2P Solar Energy (Bottom Green) -->
        <rect x="${x}" y="${yTraded}" width="${barWidth}" height="${Math.max(0, tradedH)}" fill="#10b981" rx="1">
          <title>${d.hourLabel || String(h).padStart(2, '0') + ':00'}: ${traded.toFixed(2)} kWh Clean P2P Traded</title>
        </rect>
        <!-- Unmatched Grid Import Demand (Top Slate) -->
        <rect x="${x}" y="${yUnmatched}" width="${barWidth}" height="${Math.max(0, unmatchedH)}" fill="#94a3b8" rx="1">
          <title>${d.hourLabel || String(h).padStart(2, '0') + ':00'}: ${unmatched.toFixed(2)} kWh Utility Grid Import</title>
        </rect>
      `;

      if (h % 3 === 0) {
        xLabels += `<text x="${x + barWidth / 2}" y="${pad.top + chartH + 18}" fill="#64748b" font-size="10" text-anchor="middle" font-family="Inter, sans-serif">${String(h).padStart(2, '0')}:00</text>`;
      }
    });

    el.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto overflow-visible select-none">
        <line x1="${pad.left}" y1="${pad.top + chartH}" x2="${width - pad.right}" y2="${pad.top + chartH}" stroke="#cbd5e1" />
        ${bars}
        ${xLabels}
      </svg>
      <div class="flex items-center justify-center gap-6 mt-2 text-[11px] font-medium text-slate-600">
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-emerald-500"></span> P2P Clean Solar Energy (Direct Peer Traded)</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-slate-400"></span> Unmatched Energy (Imported from Utility Grid)</span>
      </div>
    `;
  },

  /**
   * Cumulative Carbon Emissions Avoided Accumulator Chart (kg CO2).
   */
  renderCarbonAvoidedChart(hourlyData, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const data = hourlyData || [];
    const width = 800;
    const height = 200;
    const pad = { top: 15, right: 25, bottom: 35, left: 45 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;

    let cumulative = 0;
    const cumData = data.map(d => {
      cumulative += (d.tradedKWh || 0) * 0.82;
      return Number(cumulative.toFixed(2));
    });

    const maxVal = Math.max(...cumData, 10) * 1.15;
    const getX = i => pad.left + (i / 23) * chartW;
    const getY = val => pad.top + chartH - (val / maxVal) * chartH;

    let path = '';
    let area = `M ${getX(0)} ${pad.top + chartH} `;
    cumData.forEach((val, i) => {
      const x = getX(i);
      const y = getY(val);
      path += (i === 0 ? `M ${x} ${y} ` : `L ${x} ${y} `);
      area += `L ${x} ${y} `;
    });
    area += `L ${getX(23)} ${pad.top + chartH} Z`;

    let xLabels = '';
    for (let h = 0; h < 24; h += 3) {
      const x = getX(h);
      xLabels += `<text x="${x}" y="${pad.top + chartH + 18}" fill="#64748b" font-size="10" text-anchor="middle" font-family="Inter, sans-serif">${String(h).padStart(2, '0')}:00</text>`;
    }

    el.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto overflow-visible select-none">
        <defs>
          <linearGradient id="co2Grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#059669" stop-opacity="0.25" />
            <stop offset="100%" stop-color="#059669" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        <line x1="${pad.left}" y1="${pad.top + chartH}" x2="${width - pad.right}" y2="${pad.top + chartH}" stroke="#cbd5e1" />
        <path d="${area}" fill="url(#co2Grad)" />
        <path d="${path}" fill="none" stroke="#059669" stroke-width="2.5" />
        ${xLabels}
      </svg>
      <div class="text-center mt-1 text-[11px] text-slate-500 font-medium">Cumulative Avoided Grid Emissions (kg CO2e @ 0.82 kg/kWh)</div>
    `;
  },

  /**
   * Company Revenue vs Operating Costs Comparison Chart.
   */
  renderCompanyFinanceChart(companyFinance, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const cf = companyFinance || {
      totalCompanyRevenueINR: 0,
      dailyOperatingCostINR: 100,
      variableOperatingCostsINR: 0,
      totalOperatingCostINR: 100,
      estimatedProfitLossINR: -100,
      isProfitable: false
    };

    const rev = cf.totalCompanyRevenueINR || 0;
    const dailyCost = cf.dailyOperatingCostINR || 100;
    const varCost = cf.variableOperatingCostsINR || 0;
    const totalCost = cf.totalOperatingCostINR || (dailyCost + varCost);
    const profit = cf.estimatedProfitLossINR || (rev - totalCost);

    const maxBar = Math.max(rev, totalCost, 120) * 1.25;
    const getH = val => Math.max(4, (val / maxBar) * 120);

    el.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-end justify-around h-36 pt-4 pb-2 border-b border-slate-100">
          <!-- Bar 1: Platform Revenue -->
          <div class="flex flex-col items-center gap-1.5 w-24">
            <span class="text-xs font-bold text-emerald-700 font-mono">₹${rev.toFixed(2)}</span>
            <div class="w-12 bg-emerald-500 rounded-t-md transition-all duration-300" style="height: ${getH(rev)}px;"></div>
            <span class="text-[11px] font-semibold text-slate-600 text-center leading-tight">Platform Revenue</span>
          </div>

          <!-- Bar 2: Fixed Operating Cost -->
          <div class="flex flex-col items-center gap-1.5 w-24">
            <span class="text-xs font-bold text-slate-600 font-mono">₹${dailyCost.toFixed(2)}</span>
            <div class="w-12 bg-slate-400 rounded-t-md transition-all duration-300" style="height: ${getH(dailyCost)}px;"></div>
            <span class="text-[11px] font-semibold text-slate-600 text-center leading-tight">Daily Base Cost</span>
          </div>

          <!-- Bar 3: Variable Cost -->
          <div class="flex flex-col items-center gap-1.5 w-24">
            <span class="text-xs font-bold text-amber-600 font-mono">₹${varCost.toFixed(2)}</span>
            <div class="w-12 bg-amber-400 rounded-t-md transition-all duration-300" style="height: ${getH(varCost)}px;"></div>
            <span class="text-[11px] font-semibold text-slate-600 text-center leading-tight">Variable Costs</span>
          </div>

          <!-- Bar 4: Total Operating Cost -->
          <div class="flex flex-col items-center gap-1.5 w-24">
            <span class="text-xs font-bold text-rose-600 font-mono">₹${totalCost.toFixed(2)}</span>
            <div class="w-12 bg-rose-400 rounded-t-md transition-all duration-300" style="height: ${getH(totalCost)}px;"></div>
            <span class="text-[11px] font-semibold text-slate-600 text-center leading-tight">Total Expenses</span>
          </div>
        </div>

        <div class="p-3 rounded-lg ${profit >= 0 ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' : 'bg-rose-50 border border-rose-200 text-rose-900'} flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <span class="font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded ${profit >= 0 ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'}">
              ${profit >= 0 ? 'Profitable' : 'Operating Loss'}
            </span>
            <span class="font-medium">Net Operating Profit / Loss:</span>
          </div>
          <span class="font-mono font-extrabold text-sm ${profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
            ${profit >= 0 ? '+' : ''}₹${profit.toFixed(2)}
          </span>
        </div>
      </div>
    `;
  }
};
