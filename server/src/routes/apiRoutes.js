/**
 * SolarShare - API Route Controller
 * Exposes RESTful endpoints for frontend dashboard integration and automated test suites.
 * Enforces role-based permissions (Admin, Seller, Buyer) and household isolation.
 * Supports UN SDG 7: Clean Energy and Green Technology.
 */

const {
  DEMO_ACCOUNTS,
  getDemoAccounts,
  authenticateRequest,
  logoutSession,
  loginDemo,
  loginWithCredentials,
  registerUser,
  resetPassword,
  handleGoogleUser
} = require('../services/authService');

const {
  getGoogleConfig,
  verifyGoogleToken
} = require('../services/googleAuthService');

const { dataStore } = require('../utils/dataStore');
const {
  calculateRecommendedPrice,
  getClockMode,
  setClockMode,
  SEASONAL_PROFILES
} = require('../marketplace/pricingService');
const { pricingRuleService } = require('../services/pricingRuleService');

function setupRoutes(app, simManager) {
  // Authentication Helper Middleware
  function requireAuth(req, res) {
    const user = authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: Authentication required. Please log in.' });
      return null;
    }
    return user;
  }

  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'UP',
      service: 'SolarShare Peer-to-Peer Energy Simulator',
      appName: 'SolarShare',
      version: '2.0.0',
      tagline: 'Trade Clean Energy. Save Money. Power Your Community.',
      theme: 'clean-emerald-light',
      timestamp: new Date().toISOString()
    });
  });

  // 2. Auth Routes
  app.get('/api/auth/accounts', (req, res) => {
    res.json({
      accounts: getDemoAccounts()
    });
  });

  // 1-Click Demo Login
  app.post('/api/auth/login', (req, res) => {
    try {
      const { accountId } = req.body || {};
      const session = loginDemo(accountId);
      res.json(session);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Real Credentials Login (Username or Email + Password)
  app.post('/api/auth/login-credentials', (req, res) => {
    try {
      const { usernameOrEmail, password } = req.body || {};
      const session = loginWithCredentials(usernameOrEmail, password);
      res.json(session);
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  });

  // Real User Registration
  app.post('/api/auth/register', (req, res) => {
    try {
      const { username, email, password, role, householdName, solarCapacityKW, zone } = req.body || {};
      const result = registerUser({
        username,
        email,
        password,
        role,
        householdName,
        solarCapacityKW,
        zone,
        simManager
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Password Reset Flow
  app.post('/api/auth/reset-password', (req, res) => {
    try {
      const { usernameOrEmail, newPassword } = req.body || {};
      const result = resetPassword({ usernameOrEmail, newPassword });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Logout Flow
  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers['authorization'];
    logoutSession(authHeader);
    res.json({ success: true, message: 'Logged out successfully.' });
  });

  // Google OAuth Configuration
  app.get('/api/auth/google/config', (req, res) => {
    res.json(getGoogleConfig());
  });

  // Google OAuth Verification & Sign-In / Role Selection
  app.post('/api/auth/google', async (req, res) => {
    try {
      const { idToken, role, householdName, solarCapacityKW } = req.body || {};
      const verifiedAccount = await verifyGoogleToken(idToken);
      const result = handleGoogleUser({
        verifiedAccount,
        role,
        householdName,
        solarCapacityKW,
        simManager
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Current Auth Session Profile
  app.get('/api/auth/me', (req, res) => {
    const user = authenticateRequest(req);
    if (!user) {
      return res.json({
        authenticated: false,
        user: null
      });
    }
    res.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        roleLabel: user.roleLabel,
        householdId: user.householdId,
        description: user.description,
        solarCapacityKW: user.solarCapacityKW || 0,
        authProvider: user.authProvider || 'local',
        picture: user.picture || ''
      }
    });
  });

  // 3. Main Dashboard Data (12 KPI Cards + 6 Charts)
  app.get('/api/dashboard', (req, res) => {
    const data = simManager.getDashboard();
    res.json(data);
  });

  // Overview Dashboard (System-wide KPIs - backward compatible)
  app.get('/api/overview', (req, res) => {
    const data = simManager.getOverview();
    res.json(data);
  });

  // 4. All Households with Auto-Trade & Price Preference Controls
  app.get('/api/households', (req, res) => {
    const user = authenticateRequest(req);
    const isAdmin = !user || user.role === 'ADMIN';
    const callerHhId = user ? user.householdId : null;

    const currentHour = simManager.currentHour;
    const enriched = simManager.households.map(hh => {
      const isOwner = callerHhId === hh.id;
      const canViewFinancials = isAdmin || isOwner;

      return {
        id: hh.id,
        name: hh.name,
        role: hh.role,
        participantType: hh.participantType || (hh.solarCapacityKW > 0 ? 'PROSUMER' : 'CONSUMER'),
        zone: hh.zone || 'ZONE-A',
        gridConnectionStatus: hh.gridConnectionStatus || 'CONNECTED',
        exportCapacityKW: hh.exportCapacityKW !== undefined ? hh.exportCapacityKW : (hh.solarCapacityKW || 0),
        importCapacityKW: hh.importCapacityKW !== undefined ? hh.importCapacityKW : 10.0,
        noSolarPanelsRequired: (hh.solarCapacityKW || 0) <= 0,
        solarCapacityKW: hh.solarCapacityKW,
        autoTradeEnabled: canViewFinancials ? (hh.autoTradeEnabled !== false) : undefined,
        minimumAcceptedPrice: canViewFinancials ? (hh.minimumAcceptedPrice !== undefined ? hh.minimumAcceptedPrice : null) : undefined,
        maximumAcceptedPrice: canViewFinancials ? (hh.maximumAcceptedPrice !== undefined ? hh.maximumAcceptedPrice : null) : undefined,
        walletBalance: canViewFinancials ? (hh.walletBalance || 0) : null,
        description: hh.description,
        currentHourGenerationKWh: hh.hourlyGeneration[currentHour] || 0,
        currentHourDemandKWh: hh.hourlyDemand[currentHour] || 0,
        currentHourSurplusKWh: hh.hourlySurplus[currentHour] || 0,
        currentHourDeficitKWh: hh.hourlyDeficit[currentHour] || 0,
        totalEnergySoldKWh: canViewFinancials ? (hh.totalEnergySoldKWh || 0) : undefined,
        totalEnergyBoughtKWh: canViewFinancials ? (hh.totalEnergyBoughtKWh || 0) : undefined,
        totalEarningsINR: canViewFinancials ? (hh.totalEarningsINR || 0) : null,
        totalExpenditureINR: canViewFinancials ? (hh.totalExpenditureINR || 0) : null,
        totalBuyerSavingsINR: canViewFinancials ? (hh.totalBuyerSavingsINR || 0) : null,
        totalSellerAdditionalEarningsINR: canViewFinancials ? (hh.totalSellerAdditionalEarningsINR || 0) : null,
        totalTradesCount: canViewFinancials ? (hh.totalTradesCount || 0) : undefined
      };
    });

    res.json({
      currentHour,
      currentHourLabel: `${String(currentHour).padStart(2, '0')}:00`,
      households: enriched
    });
  });

  // 4b. Update Household Trading Preferences (Auto-Trade & Min/Max Price Limits)
  app.post('/api/households/:id/preferences', (req, res) => {
    try {
      const requestedId = req.params.id;
      const { autoTradeEnabled, minimumAcceptedPrice, maximumAcceptedPrice } = req.body || {};
      const result = simManager.updateHouseholdPreferences(requestedId, {
        autoTradeEnabled,
        minimumAcceptedPrice,
        maximumAcceptedPrice
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // 4c. Hourly Readings Dataset (24 hours)
  app.get('/api/readings', (req, res) => {
    const { dataStore } = require('../utils/dataStore');
    const readings = dataStore.getReadings();
    res.json({
      currentHour: simManager.currentHour,
      totalHours: readings.length,
      readings
    });
  });

  // 4d. Recommended Market Price & Demand Pressure
  app.get('/api/market/price', (req, res) => {
    const { calculateRecommendedPrice } = require('../marketplace/pricingService');
    const h = simManager.currentHour;
    const hourSurplus = simManager.households.reduce((s, hh) => s + (hh.hourlySurplus[h] || 0), 0);
    const hourDeficit = simManager.households.reduce((s, hh) => s + (hh.hourlyDeficit[h] || 0), 0);
    const priceResult = calculateRecommendedPrice(hourSurplus, hourDeficit, { currentHour: h });
    res.json(priceResult);
  });

  // 4e. Company Financial Position & Revenue Model
  app.get('/api/company/finance', (req, res) => {
    const { dataStore } = require('../utils/dataStore');
    const finance = dataStore.getCompanyFinance();
    res.json(finance);
  });

  // 5. Single Household Detail (Private Wallet & History)
  app.get('/api/households/:id', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const requestedId = req.params.id;

    // Household privacy check
    if (user.role !== 'ADMIN' && user.householdId && user.householdId !== requestedId) {
      return res.status(403).json({
        error: `Access Denied: You cannot view private wallet data for household ${requestedId}. You are authenticated as ${user.householdId}.`
      });
    }

    const detail = simManager.getHouseholdDetail(requestedId);
    if (!detail) {
      return res.status(404).json({ error: `Household "${requestedId}" not found.` });
    }

    res.json(detail);
  });

  // 6. Marketplace state (Public order book & trades)
  app.get('/api/marketplace', (req, res) => {
    const currentHour = simManager.currentHour;
    const activeOffers = simManager.offers.filter(o => (o.hour === undefined || o.hour === null || o.hour === currentHour) && o.status === 'ACTIVE' && o.remainingKWh > 0.001);
    const activeBids = simManager.bids.filter(b => (b.hour === undefined || b.hour === null || b.hour === currentHour) && b.status === 'ACTIVE' && b.remainingKWh > 0.001);
    const recentTradesForHour = simManager.trades.filter(t => t.simulationHour === currentHour);

    const config = dataStore.getConfig();
    const priceResult = calculateRecommendedPrice(
      simManager.hourlyHistory[currentHour]?.surplusKWh || 0,
      simManager.hourlyHistory[currentHour]?.deficitKWh || 0,
      { currentHour, overrideConfig: config }
    );

    const { gridNetwork } = require('../simulation/gridNetwork');

    res.json({
      currentHour,
      currentHourLabel: `${String(currentHour).padStart(2, '0')}:00`,
      activeOffers,
      activeBids,
      allOffers: simManager.offers.slice(0, 50),
      allBids: simManager.bids.slice(0, 50),
      recentTrades: recentTradesForHour,
      gridNetwork: gridNetwork.getNetworkState(),
      gridRoutes: gridNetwork.routes,
      recommendedPriceINR: priceResult.recommendedPriceINR || 5.00,
      demandPressurePercent: priceResult.demandPressurePercent || 50,
      statusLabel: priceResult.statusLabel || 'Balanced Phase',
      pricingRules: {
        midpointFormula: 'Trade Price = (Seller Ask + Buyer Max Bid) / 2',
        executionRule: 'Strict price-time priority matching; Buyer Bid >= Seller Ask',
        gridTariffBaselineINR: 8.00,
        exportCompensationBaselineINR: 2.00,
        gridLossModeling: 'Delivered = Injected * (1 - LossFraction)',
        wheelingRateDescription: 'Dynamic wheeling charge applied for distribution transit'
      }
    });
  });

  // 6b. Grid Network Topology & Route Capacity Endpoints
  app.get('/api/grid/network', (req, res) => {
    const { gridNetwork } = require('../simulation/gridNetwork');
    res.json(gridNetwork.getNetworkState());
  });

  app.get('/api/grid/routes', (req, res) => {
    const { gridNetwork } = require('../simulation/gridNetwork');
    res.json({
      routes: gridNetwork.routes,
      zones: Object.values(gridNetwork.zones),
      disclaimer: 'Simulated multi-zone distribution topology under SDG 7 clean energy framework.'
    });
  });

  // Admin / Simulation Route Control (Toggle route status)
  app.post('/api/grid/routes/:routeId/status', (req, res) => {
    const { gridNetwork } = require('../simulation/gridNetwork');
    const { status } = req.body || {};
    try {
      const updated = gridNetwork.setRouteStatus(req.params.routeId, status);
      res.json({ success: true, route: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Admin / Simulation Route Capacity Configuration
  app.post('/api/grid/routes/:routeId/capacity', (req, res) => {
    const { gridNetwork } = require('../simulation/gridNetwork');
    const { capacityKWh } = req.body || {};
    try {
      const updated = gridNetwork.setRouteCapacity(req.params.routeId, capacityKWh);
      res.json({ success: true, route: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Simulated Smart Meter Records
  app.get('/api/meters', (req, res) => {
    const { gridNetwork } = require('../simulation/gridNetwork');
    res.json({
      measurementSource: 'SIMULATED',
      disclaimer: 'Simulated smart meter records for simulation and algorithmic testing only.',
      totalRecords: gridNetwork.meterRecords.length,
      records: [...gridNetwork.meterRecords].slice(-50).reverse()
    });
  });

  // 7. All Trades (Filtered by user household if consumer/prosumer)
  app.get('/api/trades', (req, res) => {
    const user = authenticateRequest(req);
    let tradesList = simManager.trades;

    if (user && user.role !== 'ADMIN' && user.householdId) {
      tradesList = tradesList.filter(t => t.sellerId === user.householdId || t.buyerId === user.householdId);
    }

    res.json({
      totalTrades: tradesList.length,
      trades: [...tradesList].reverse()
    });
  });

  // 8. Transaction Ledger (Cryptographic audit chain - Admin Only for authorized viewing)
  app.get('/api/ledger', (req, res) => {
    const user = authenticateRequest(req);
    if (user && user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Access Denied: Only Grid Operator / Admin can view the full transaction ledger.'
      });
    }
    const records = simManager.ledger.getRecords();
    res.json({
      totalRecords: records.length,
      records: [...records].reverse()
    });
  });

  // 9. Verify Ledger Cryptographic Hash Chain
  const handleLedgerVerify = (req, res) => {
    const result = simManager.ledger.verify();
    res.json(result);
  };
  app.get('/api/ledger/verify', handleLedgerVerify);
  app.post('/api/ledger/verify', handleLedgerVerify);

  // 10. Tamper Simulation Test (Isolated sandbox test copy - Admin Only)
  app.post('/api/ledger/simulate-tamper', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Access Denied: Only Grid Operator / Admin can run cryptographic tamper tests.'
      });
    }
    const { targetIndex, fieldToAlter, alteredValue } = req.body || {};
    const result = simManager.ledger.simulateTamperTest(targetIndex, fieldToAlter, alteredValue);
    res.json(result);
  });

  // 11. CSV Export for Ledger
  app.get('/api/ledger/export/csv', (req, res) => {
    const csvContent = simManager.ledger.toCSV();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="solarshare_transaction_ledger.csv"');
    if (typeof res.send === 'function') {
      res.send(csvContent);
    } else {
      res.end(csvContent);
    }
  });

  // 12. Price Analytics
  app.get('/api/analytics/prices', (req, res) => {
    const hourlyData = simManager.hourlyHistory.map(entry => ({
      hour: entry.hour,
      hourLabel: entry.hourLabel,
      generationKWh: entry.generationKWh,
      demandKWh: entry.demandKWh,
      surplusKWh: entry.surplusKWh,
      deficitKWh: entry.deficitKWh,
      tradedKWh: entry.tradedKWh,
      tradesCount: entry.tradesCount,
      tradeValueINR: entry.tradeValueINR,
      weightedAveragePriceINR: entry.weightedAveragePriceINR,
      recommendedPriceINR: entry.recommendedPriceINR !== undefined ? entry.recommendedPriceINR : 5.00,
      marketStatus: entry.marketStatus,
      isSimulated: entry.isSimulated,
      totalBuyerSavingsINR: entry.totalBuyerSavingsINR,
      totalSellerAdditionalEarningsINR: entry.totalSellerAdditionalEarningsINR
    }));

    const participants = simManager.households.map(hh => ({
      id: hh.id,
      name: hh.name,
      role: hh.role,
      type: hh.type || (hh.role === 'prosumer' ? 'Solar Prosumer' : 'Grid Consumer'),
      solarCapacityKW: hh.solarCapacityKW || hh.capacityKW || 0,
      zone: hh.zone,
      totalEnergySoldKWh: Number((hh.totalEnergySoldKWh || 0).toFixed(2)),
      totalEnergyBoughtKWh: Number((hh.totalEnergyBoughtKWh || 0).toFixed(2)),
      totalEarningsINR: Number((hh.totalEarningsINR || 0).toFixed(2)),
      totalExpenditureINR: Number((hh.totalExpenditureINR || 0).toFixed(2)),
      totalBuyerSavingsINR: Number((hh.totalBuyerSavingsINR || 0).toFixed(2)),
      generationKWh: Number((hh.generationKWh || 0).toFixed(2)),
      demandKWh: Number((hh.demandKWh || 0).toFixed(2))
    }));

    res.json({
      currentHour: simManager.currentHour,
      hourlyData,
      participants,
      explanation: {
        priceDynamics: 'During midday peak solar hours (10:00 - 14:00), surplus clean energy surges, encouraging competitive lower ask prices. During morning ramp-up and late afternoon, energy scarcity causes prices to rise towards the retail grid tariff cap (₹8.00/kWh).',
        midpointRule: 'SolarShare uses the cooperative midpoint rule where trade surplus is split equitably between clean energy prosumers and consumers.'
      }
    });
  });

  // 13. Savings and Impact Page (SDG 7 Metrics)
  app.get('/api/savings', (req, res) => {
    const gridBenchmark = 8.00;

    const participantBreakdown = simManager.households.map(hh => {
      const bought = hh.totalEnergyBoughtKWh || 0;
      const sold = hh.totalEnergySoldKWh || 0;
      const buyerExp = hh.totalExpenditureINR || 0;
      const sellerEarn = hh.totalEarningsINR || 0;

      // Realized average purchase price
      const avgPurchasePriceINR = bought > 0 ? Number((buyerExp / bought).toFixed(2)) : 0;
      // Realized savings per unit: Benchmark (₹8.00) - Avg Price
      const savingsPerUnitINR = bought > 0 ? Number((gridBenchmark - avgPurchasePriceINR).toFixed(2)) : 0;
      const totalBuyerSavingsINR = Number((hh.totalBuyerSavingsINR || 0).toFixed(2));
      const totalSellerRevenueINR = Number(sellerEarn.toFixed(2));
      const totalSellerAdditionalEarningsINR = Number((hh.totalSellerAdditionalEarningsINR || 0).toFixed(2));

      // Savings percentage vs grid benchmark
      const savingsPercent = gridBenchmark > 0 && savingsPerUnitINR > 0
        ? Number(((savingsPerUnitINR / gridBenchmark) * 100).toFixed(1))
        : 0;

      return {
        id: hh.id,
        name: hh.name,
        role: hh.role,
        solarCapacityKW: hh.solarCapacityKW,
        energySoldKWh: sold,
        energyBoughtKWh: bought,
        gridBenchmarkTariffINR: gridBenchmark,
        avgPurchasePriceINR,
        savingsPerUnitINR,
        savingsPercent,
        buyerGrossSavingsINR: totalBuyerSavingsINR,
        buyerNetSavingsINR: Number((totalBuyerSavingsINR - (bought * 0.10)).toFixed(2)),
        sellerRevenueINR: totalSellerRevenueINR,
        sellerAdditionalEarningsINR: totalSellerAdditionalEarningsINR,
        sellerNetAdditionalEarningsINR: Number((totalSellerAdditionalEarningsINR - (sold * 0.10)).toFixed(2)),
        tradesCount: hh.totalTradesCount || 0,
        avoidedCO2Kg: Number(((sold + bought) * 0.41).toFixed(2))
      };
    });

    const totalEnergyTraded = Number(simManager.trades.reduce((s, t) => s + t.energyKWh, 0).toFixed(2));
    const totalTransactionValue = Number(simManager.trades.reduce((s, t) => s + t.totalValueINR, 0).toFixed(2));
    const totalBuyerSavings = Number(participantBreakdown.reduce((s, p) => s + p.buyerGrossSavingsINR, 0).toFixed(2));
    const totalSellerRevenue = Number(participantBreakdown.reduce((s, p) => s + p.sellerRevenueINR, 0).toFixed(2));
    const totalSellerExtra = Number(participantBreakdown.reduce((s, p) => s + p.sellerAdditionalEarningsINR, 0).toFixed(2));
    const totalAvoidedCO2 = Number((totalEnergyTraded * 0.82).toFixed(2));
    const avgSavingsPerUnit = totalEnergyTraded > 0 ? Number((totalBuyerSavings / totalEnergyTraded).toFixed(2)) : 0;

    res.json({
      gridBenchmarkTariffINR: gridBenchmark,
      kpis: {
        totalEnergyTradedKWh: totalEnergyTraded,
        totalTransactionValueINR: totalTransactionValue,
        participatingHouseholdsCount: simManager.households.length,
        completedTradesCount: simManager.trades.length,
        unmatchedOrdersCount: simManager.offers.filter(o => o.remainingKWh > 0).length + simManager.bids.filter(b => b.remainingKWh > 0).length,
        totalBuyerSavingsINR: totalBuyerSavings,
        totalSellerRevenueINR: totalSellerRevenue,
        totalSellerAdditionalEarningsINR: totalSellerExtra,
        averageSavingsPerUnitINR: avgSavingsPerUnit,
        totalAvoidedCO2Kg: totalAvoidedCO2,
        emissionsFactorDescription: '0.82 kg CO2e / kWh based on CEA Indian grid average displacement'
      },
      participants: participantBreakdown
    });
  });

  // 14. Simulation Status & Run Summary
  app.get('/api/simulation/status', (req, res) => {
    res.json({
      currentHour: simManager.currentHour,
      currentMinute: simManager.currentMinute || 0,
      currentHourLabel: simManager.getFormattedTime ? simManager.getFormattedTime() : `${String(simManager.currentHour).padStart(2, '0')}:00`,
      simulatedTime: simManager.getFormattedTime ? simManager.getFormattedTime() : `${String(simManager.currentHour).padStart(2, '0')}:00`,
      simulatedDate: simManager.simulatedDate,
      simulatedDateLabel: simManager.getFormattedDate ? simManager.getFormattedDate() : '15 October 2026',
      hourProgressLabel: simManager.getHourProgressLabel ? simManager.getHourProgressLabel() : `Hour ${simManager.currentHour} of 24`,
      statusLabel: simManager.isRunning ? 'Running' : 'Paused',
      autoMatchingEnabled: simManager.autoMatchingEnabled !== false,
      runId: simManager.currentRunId,
      isRunning: simManager.isRunning,
      autoSpeedSeconds: simManager.autoSpeedSeconds || 10,
      season: simManager.season || 'Summer',
      weather: simManager.weather || 'Sunny / High Yield (95%)',
      weatherFactor: simManager.weatherFactor || 0.95,
      fullDayProgress: simManager.fullDayProgress,
      totalCompletedTrades: simManager.trades.length,
      ledgerBlocksCount: simManager.ledger.getRecords().length
    });
  });

  app.get('/api/simulation/summary', (req, res) => {
    const summary = simManager.lastRunSummary || simManager.compileRunSummary();
    res.json(summary);
  });

  // 15. Run One Simulation Interval (CDA matching, ledger, company finance)
  const handleSimulationRun = (req, res) => {
    const user = authenticateRequest(req);
    if (user && user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Access Denied: Only Grid Operator / Admin can control simulation cycles.'
      });
    }
    try {
      const stepResult = simManager.advanceOneHour();
      res.json({
        success: true,
        status: `Executed simulation hour ${stepResult.hour}:00, now at ${stepResult.nextHour}:00`,
        message: `Advanced to hour ${String(stepResult.nextHour).padStart(2, '0')}:00`,
        hour: stepResult.hour,
        nextHour: stepResult.nextHour,
        tradesExecuted: stepResult.tradesExecuted,
        energyTradedKWh: stepResult.energyTradedKWh,
        tradeValueINR: stepResult.tradeValueINR,
        prices: stepResult.prices,
        recommendedPriceINR: stepResult.recommendedPriceINR,
        trades: stepResult.trades,
        unmatchedOffers: stepResult.unmatchedOffers,
        unmatchedBids: stepResult.unmatchedBids,
        summary: stepResult.summary,
        step: stepResult
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  app.post('/api/simulation/run', handleSimulationRun);

  // 15b. Advance One Hour (Alias with or without auth)
  app.post('/api/simulation/advance', (req, res) => {
    // If auth header is passed, check if admin (but allow fallback for simulator frontend controls)
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const user = authenticateRequest(req);
      if (user && user.role !== 'ADMIN') {
        return res.status(403).json({
          error: 'Access Denied: Only Grid Operator / Admin can control simulation cycles.'
        });
      }
    }
    return handleSimulationRun(req, res);
  });

  // 15c. Advance Simulation 15 Minutes
  app.post('/api/simulation/advance-15', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const user = authenticateRequest(req);
      if (user && user.role !== 'ADMIN') {
        return res.status(403).json({
          error: 'Access Denied: Only Grid Operator / Admin can control simulation cycles.'
        });
      }
    }
    try {
      const result = simManager.advance15Minutes();
      res.json({
        success: true,
        message: `Advanced simulation by 15 minutes to ${result.simulatedTime} (${result.hourProgressLabel}).`,
        ...result
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 15d. Match Available Orders (Dedicated manual matching trigger)
  app.post('/api/simulation/match-orders', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const user = authenticateRequest(req);
      if (user && user.role !== 'ADMIN') {
        return res.status(403).json({
          error: 'Access Denied: Only Grid Operator / Admin can execute market matching.'
        });
      }
    }
    try {
      const result = simManager.matchAvailableOrders();
      res.json({
        success: true,
        message: `Market matching executed: settled ${result.tradesExecuted} trades (${result.energyTradedKWh} kWh).`,
        ...result
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 15e. Configure Auto-Matching Toggle (ON / OFF)
  app.post('/api/simulation/auto-matching', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const user = authenticateRequest(req);
      if (user && user.role !== 'ADMIN') {
        return res.status(403).json({
          error: 'Access Denied: Only Grid Operator / Admin can configure auto-matching.'
        });
      }
    }
    try {
      const enabled = req.body?.enabled !== false;
      const result = simManager.setAutoMatching(enabled);
      res.json({
        success: true,
        message: `Auto-matching is now ${enabled ? 'ENABLED' : 'DISABLED'}.`,
        autoMatchingEnabled: result.autoMatchingEnabled
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 16. Start / Run Simulation (Supports Automatic Ticker mode or Full Day mode)
  app.post('/api/simulation/start', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Access Denied: Only Grid Operator / Admin can execute simulation cycles.'
      });
    }

    try {
      const mode = req.body?.mode;
      if (mode === 'auto') {
        const autoResult = simManager.startAutoSimulation(req.body?.speedSeconds);
        return res.json({
          success: true,
          message: `Automatic simulation started (advancing 1 hour every ${autoResult.autoSpeedSeconds}s).`,
          isRunning: true,
          autoSpeedSeconds: autoResult.autoSpeedSeconds,
          currentHour: autoResult.currentHour
        });
      }

      const fullDayResult = simManager.runFullDay();
      res.json({
        success: true,
        message: 'Full 24-hour simulation executed successfully across all intervals.',
        result: fullDayResult,
        summary: fullDayResult.summary
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 16b. Start Automatic Simulation Ticker
  app.post('/api/simulation/auto/start', (req, res) => {
    const user = authenticateRequest(req);
    if (user && user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Access Denied: Only Grid Operator / Admin can control simulation cycles.'
      });
    }
    try {
      const speed = req.body?.speedSeconds || req.body?.speed;
      const result = simManager.startAutoSimulation(speed);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 16c. Pause Automatic Simulation Ticker
  app.post('/api/simulation/auto/pause', (req, res) => {
    const user = authenticateRequest(req);
    if (user && user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Access Denied: Only Grid Operator / Admin can control simulation cycles.'
      });
    }
    try {
      const result = simManager.pauseAutoSimulation();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 16d. Toggle Automatic Simulation Ticker
  app.post('/api/simulation/auto/toggle', (req, res) => {
    const user = authenticateRequest(req);
    if (user && user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Access Denied: Only Grid Operator / Admin can control simulation cycles.'
      });
    }
    try {
      if (simManager.isRunning) {
        const result = simManager.pauseAutoSimulation();
        res.json({ ...result, message: 'Simulation paused' });
      } else {
        const speed = req.body?.speedSeconds || req.body?.speed;
        const result = simManager.startAutoSimulation(speed);
        res.json({ ...result, message: 'Simulation running' });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 16e. Configure Simulation Speed
  app.post('/api/simulation/speed', (req, res) => {
    const user = authenticateRequest(req);
    if (user && user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Access Denied: Only Grid Operator / Admin can control simulation speed.'
      });
    }
    try {
      const speed = req.body?.speedSeconds || req.body?.speed;
      const result = simManager.setSimulationSpeed(speed);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 16f. Run Full 24-Hour Demonstration
  app.post('/api/simulation/run-day', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Access Denied: Only Grid Operator / Admin can execute full simulation cycles.'
      });
    }
    try {
      const fullDayResult = simManager.runFullDay();
      res.json({
        success: true,
        message: 'Full 24-hour simulation executed successfully across all intervals.',
        result: fullDayResult,
        summary: fullDayResult.summary
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 17. Reset Simulation
  app.post('/api/simulation/reset', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const user = authenticateRequest(req);
      if (user && user.role !== 'ADMIN') {
        return res.status(403).json({
          error: 'Access Denied: Only Grid Operator / Admin can reset the simulation.'
        });
      }
    }

    try {
      const startHour = (req.body && req.body.startHour !== undefined) ? parseInt(req.body.startHour, 10) : 10;
      simManager.resetSimulation(startHour);
      if (startHour > 0) {
        simManager.populateCurrentHourOrders();
      }
      res.json({
        success: true,
        message: `Simulation reset to 10:00 AM daytime initial demonstration state successfully.`,
        currentHour: simManager.currentHour,
        currentMinute: simManager.currentMinute || 0,
        simulatedDate: simManager.simulatedDate,
        simulatedDateLabel: simManager.getFormattedDate ? simManager.getFormattedDate() : '15 October 2026',
        simulatedTime: simManager.getFormattedTime ? simManager.getFormattedTime() : '10:00 AM',
        hourProgressLabel: simManager.getHourProgressLabel ? simManager.getHourProgressLabel() : 'Hour 10 of 24'
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 18. Submit Seller Offer (Role & Ownership Enforced, Regulation-Aware Price Validation)
  app.post('/api/marketplace/offers', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const { householdId, energyKWh, askingPriceINR, ruleId } = req.body || {};

    // Role check: Buyer cannot create seller offers
    if (user.role === 'BUYER') {
      return res.status(403).json({
        error: 'Access Denied: Consumer Buyer role cannot create seller offers.'
      });
    }

    // Ownership check: Seller can only submit for their own household (Admin can submit for testing)
    if (user.role === 'SELLER' && user.householdId && householdId !== user.householdId) {
      return res.status(403).json({
        error: `Access Denied: You cannot create an offer for household ${householdId}. You are logged in as ${user.householdId}.`
      });
    }

    const targetHhId = (user.role === 'SELLER' && user.householdId) ? user.householdId : householdId;
    const hh = simManager.households.find(h => h.id === targetHhId);
    const sellerName = hh ? hh.name : (user.householdName || user.username || targetHhId);

    // Rule-based Price Validation
    const submission = pricingRuleService.processSellerPriceSubmission({
      householdId: targetHhId,
      householdName: sellerName,
      priceINR: askingPriceINR,
      surplusKWh: energyKWh,
      ruleId
    });

    if (!submission.approved) {
      return res.status(400).json({
        error: submission.validation.reason,
        approved: false,
        validation: submission.validation,
        rejectionRecord: submission.rejectionRecord,
        ruleId: submission.validation.ruleId,
        ruleName: submission.validation.ruleName,
        ruleSource: submission.validation.ruleSource,
        disclaimer: submission.validation.disclaimer,
        canRequestReview: true
      });
    }

    try {
      const offer = simManager.submitOffer(targetHhId, energyKWh, askingPriceINR, submission);
      res.status(201).json({
        success: true,
        message: `Offer submitted successfully for ${offer.energyKWh} kWh at ₹${offer.askingPriceINR}/kWh.`,
        offer,
        ruleValidation: submission.validation
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // 18b. Update Seller Offer (Role & Ownership Enforced, Regulation-Aware Price Validation)
  app.post('/api/marketplace/offers/:id/update', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const { energyKWh, askingPriceINR, ruleId } = req.body || {};
    const orderId = req.params.id;
    const isAdmin = user.role === 'ADMIN';
    const callerHouseholdId = user.householdId || null;

    if (user.role === 'BUYER') {
      return res.status(403).json({ error: 'Access Denied: Consumer Buyer cannot update seller offers.' });
    }

    const offer = simManager.offers.find(o => o.id === orderId);
    if (!offer) {
      return res.status(404).json({ error: `Offer ${orderId} not found.` });
    }

    if (!isAdmin && callerHouseholdId && offer.householdId !== callerHouseholdId) {
      return res.status(403).json({ error: `Access Denied: You cannot update another household's offer.` });
    }

    const effectivePrice = (askingPriceINR !== undefined && askingPriceINR !== null && !isNaN(askingPriceINR))
      ? Number(askingPriceINR)
      : offer.askingPriceINR;
    const effectiveQty = (energyKWh !== undefined && energyKWh !== null && !isNaN(energyKWh))
      ? Number(energyKWh)
      : offer.remainingKWh;

    const submission = pricingRuleService.processSellerPriceSubmission({
      householdId: offer.householdId,
      householdName: offer.householdName,
      priceINR: effectivePrice,
      surplusKWh: effectiveQty,
      ruleId
    });

    if (!submission.approved) {
      return res.status(400).json({
        error: submission.validation.reason,
        approved: false,
        validation: submission.validation,
        rejectionRecord: submission.rejectionRecord,
        canRequestReview: true
      });
    }

    try {
      const updated = simManager.updateOffer(orderId, callerHouseholdId, isAdmin, {
        energyKWh: effectiveQty,
        askingPriceINR: effectivePrice,
        ruleValidation: submission.validation
      });
      res.json({
        success: true,
        message: `Offer updated successfully to ${updated.remainingKWh} kWh at ₹${updated.askingPriceINR}/kWh.`,
        offer: updated
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // 19. Submit Buyer Bid (Role & Ownership Enforced)
  app.post('/api/marketplace/bids', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const { householdId, energyKWh, maxBidINR } = req.body || {};

    // Role check: Seller cannot submit buyer bids
    if (user.role === 'SELLER') {
      return res.status(403).json({
        error: 'Access Denied: Prosumer Seller role cannot submit buyer bids.'
      });
    }

    // Ownership check: Buyer can only submit for their own household
    if (user.role === 'BUYER' && user.householdId && householdId !== user.householdId) {
      return res.status(403).json({
        error: `Access Denied: You cannot submit a bid for household ${householdId}. You are logged in as ${user.householdId}.`
      });
    }

    try {
      const targetHhId = (user.role === 'BUYER' && user.householdId) ? user.householdId : householdId;
      const bid = simManager.submitBid(targetHhId, energyKWh, maxBidINR);
      res.status(201).json({
        success: true,
        message: `Bid submitted successfully for ${bid.energyKWh} kWh at max ₹${bid.maxBidINR}/kWh.`,
        bid
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // 20. Cancel Order (Ownership Enforced)
  app.post('/api/marketplace/orders/:id/cancel', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const orderId = req.params.id;
    const isAdmin = user.role === 'ADMIN';
    const callerHouseholdId = user.householdId || null;

    try {
      const result = simManager.cancelOrder(orderId, callerHouseholdId, isAdmin);
      res.json(result);
    } catch (err) {
      const status = err.message && (err.message.includes('Access Denied') || err.message.includes('Unauthorized')) ? 403 : 400;
      res.status(status).json({ error: err.message });
    }
  });

  // 21. Ordinary Buyer: Get Ranked Seller Offers
  app.get('/api/marketplace/ranked-offers', (req, res) => {
    const buyerZone = req.query.buyerZone || 'ZONE-A';
    const ranked = simManager.getRankedOffers(buyerZone);
    const activeRule = pricingRuleService.getActiveRule();
    res.json({
      buyerZone,
      totalOffers: ranked.length,
      ruleId: activeRule.ruleId,
      ruleVersion: activeRule.version,
      ruleName: activeRule.name,
      disclaimer: activeRule.disclaimer,
      platformFeeINRPerKWh: activeRule.platformFeePerKWhINR,
      offers: ranked
    });
  });

  // 21b. Ordinary Buyer: Pre-Purchase Quote / Allocation Breakdown (Preview Mode)
  app.post('/api/marketplace/purchase/quote', (req, res) => {
    const user = authenticateRequest(req);
    const { offerId, requestedKWh, buyerZone } = req.body || {};
    const buyerId = (user && user.role === 'BUYER' && user.householdId) ? user.householdId : (req.body.buyerId || (user && user.householdId) || 'HH-04');
    const buyer = simManager.households.find(h => h.id === buyerId);
    const buyerName = buyer ? buyer.name : (user && (user.householdName || user.username)) || buyerId;
    const zone = buyerZone || (buyer ? (buyer.zone || 'ZONE-A') : 'ZONE-A');

    try {
      const quote = simManager.getPurchaseQuote({
        buyerId,
        buyerName,
        buyerZone: zone,
        offerId,
        requestedKWh
      });

      if (!quote.success) {
        return res.status(400).json(quote);
      }
      res.json(quote);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 22. Ordinary Buyer: Direct Offer Purchase (No Auction / No Bidding)
  app.post('/api/marketplace/purchase', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;

    if (user.role === 'SELLER') {
      return res.status(403).json({
        error: 'Access Denied: Prosumer Seller accounts cannot execute direct buyer purchases.'
      });
    }

    const { offerId, requestedKWh, buyerZone } = req.body || {};
    const buyerId = (user.role === 'BUYER' && user.householdId) ? user.householdId : (req.body.buyerId || user.householdId || 'HH-04');
    const buyer = simManager.households.find(h => h.id === buyerId);
    const buyerName = buyer ? buyer.name : (user.householdName || user.username || buyerId);
    const zone = buyerZone || (buyer ? (buyer.zone || 'ZONE-A') : 'ZONE-A');

    try {
      const result = simManager.purchaseOffer({
        buyerId,
        buyerName,
        buyerZone: zone,
        offerId,
        requestedKWh
      });

      if (!result.success) {
        return res.status(400).json(result);
      }
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 23. Regulatory Pricing Rules: Get Active Rule
  app.get('/api/pricing-rules/active', (req, res) => {
    res.json(pricingRuleService.getActiveRule());
  });

  // 24. Regulatory Pricing Rules: List All Rules
  app.get('/api/pricing-rules', (req, res) => {
    const active = pricingRuleService.getActiveRule();
    res.json({
      activeRuleId: active.ruleId,
      rules: pricingRuleService.getAllRules()
    });
  });

  // 25. Regulatory Pricing Rules: Validate Price Check
  app.post('/api/pricing-rules/validate-price', (req, res) => {
    const { priceINR, ruleId } = req.body || {};
    const validation = pricingRuleService.validatePrice(priceINR, ruleId);
    res.json(validation);
  });

  // 26. Regulatory Pricing Rules: Submit Price Review Request (Seller)
  app.post('/api/pricing-rules/reviews', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const { requestedPriceINR, surplusKWh, reason, ruleId } = req.body || {};
    const targetHhId = user.householdId || req.body.householdId;
    const hh = simManager.households.find(h => h.id === targetHhId);

    try {
      const request = pricingRuleService.createPriceReviewRequest({
        householdId: targetHhId,
        householdName: hh ? hh.name : (user.householdName || user.username || targetHhId),
        requestedPriceINR,
        surplusKWh,
        reason,
        ruleId
      });
      res.status(201).json({ success: true, reviewRequest: request });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // 27. Regulatory Pricing Rules: Get Review Requests
  app.get('/api/pricing-rules/reviews', (req, res) => {
    const { status } = req.query || {};
    const requests = pricingRuleService.getPriceReviewRequests(status);
    res.json({
      total: requests.length,
      reviewRequests: requests
    });
  });

  // 28. Regulatory Pricing Rules: Resolve Price Review Request (Operator/Admin)
  app.post('/api/pricing-rules/reviews/:id/resolve', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Access Denied: Only Company Operator / Admin can resolve price review requests.'
      });
    }
    const { decision, operatorNotes } = req.body || {};
    try {
      const updated = pricingRuleService.resolvePriceReviewRequest(
        req.params.id,
        decision,
        operatorNotes,
        user.username || 'admin'
      );
      res.json({ success: true, reviewRequest: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // 29. Regulatory Pricing Rules: Get Rejected Prices Log
  app.get('/api/pricing-rules/rejected-log', (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 50;
    const log = pricingRuleService.getRejectedPricesLog(limit);
    res.json({
      total: log.length,
      rejectedPricesLog: log
    });
  });

  // 30. Live Market State & Dynamic Pricing
  app.get('/api/market/live', (req, res) => {
    const h = simManager.currentHour;
    const hourSurplus = simManager.households.reduce((s, hh) => s + (hh.hourlySurplus[h] || 0), 0);
    const hourDeficit = simManager.households.reduce((s, hh) => s + (hh.hourlyDeficit[h] || 0), 0);
    const priceResult = calculateRecommendedPrice(hourSurplus, hourDeficit, {
      currentHour: h,
      clockMode: getClockMode()
    });

    res.json({
      ...priceResult,
      clockMode: getClockMode(),
      simulationHour: h,
      hourLabel: `${String(h).padStart(2, '0')}:00`,
      surplusKWh: Number(hourSurplus.toFixed(2)),
      deficitKWh: Number(hourDeficit.toFixed(2)),
      seasonalProfiles: SEASONAL_PROFILES
    });
  });

  // 31. Set Clock Mode (Live Clock vs Demo Simulation)
  app.post('/api/market/clock-mode', (req, res) => {
    const { mode } = req.body || {};
    const updatedMode = setClockMode(mode);
    res.json({
      success: true,
      clockMode: updatedMode,
      message: `Market pricing clock mode updated to ${updatedMode}.`
    });
  });
}

module.exports = {
  setupRoutes
};
