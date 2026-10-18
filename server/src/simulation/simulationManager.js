/**
 * SolarShare - Central Simulation Manager (Authoritative In-Memory State)
 * Implements automated energy balances, dynamic pricing, continuous double-auction matching,
 * ledger auditing, company financial accounting, and JSON persistence.
 * 
 * Complies with UN SDG 7: Affordable and Clean Energy.
 */

const { dataStore } = require('../utils/dataStore');
const { calculateRecommendedPrice } = require('../marketplace/pricingService');
const { generateInternalOrders, matchOrders, getRankedOffersForBuyer, executeDirectPurchase, executeMultiSellerPurchase } = require('../marketplace/matchingEngine');
const { TamperLedger } = require('../ledger/tamperLedger');
const { calculateSolarGeneration, HOUSEHOLDS } = require('./dataGenerator');
const { gridNetwork } = require('./gridNetwork');
const { pricingRuleService } = require('../services/pricingRuleService');
const { SCENARIOS } = require('./scenarios');

class SimulationManager {
  constructor() {
    this.simulatedDate = '2026-10-15';
    this.currentRunId = `SIM-RUN-${this.simulatedDate.replace(/-/g, '')}-01`;
    this.season = 'Summer';
    this.activeScenario = 'SUNNY_DAY';
    this.weather = SCENARIOS.SUNNY_DAY.weatherLabel;
    this.weatherFactor = SCENARIOS.SUNNY_DAY.weatherFactor;
    this.demandMultiplier = SCENARIOS.SUNNY_DAY.demandMultiplier;
    this.activeRouteFailure = null;
    this.autoSpeedSeconds = 10;
    this.autoTimer = null;
    this.fullDayProgress = null;
    this.autoMatchingEnabled = true;
    this.reset();
  }

  /**
   * Resets simulation state to deterministic baseline at 10:00 AM.
   */
  reset() {
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
    this.currentHour = 10; // Start at 10:00 AM morning peak solar demonstration
    this.currentMinute = 0;
    this.isRunning = false;
    this.autoMatchingEnabled = true;
    this.fullDayProgress = null;
    this.lastProcessedHour = null;

    // Reset scenario state to default Sunny Day baseline
    this.activeScenario = 'SUNNY_DAY';
    this.weather = SCENARIOS.SUNNY_DAY.weatherLabel;
    this.weatherFactor = SCENARIOS.SUNNY_DAY.weatherFactor;
    this.demandMultiplier = SCENARIOS.SUNNY_DAY.demandMultiplier;
    this.activeRouteFailure = null;
    gridNetwork.setRouteStatus('ROUTE-A-B', 'CONNECTED');
    gridNetwork.setRouteStatus('ROUTE-B-A', 'CONNECTED');

    // Load or initialize households from JSON store
    dataStore.ensureInitialized();
    const stored = dataStore.getHouseholds();
    this.households = this.hydrateHouseholds(stored && stored.length >= 10 ? stored : HOUSEHOLDS);

    this.offers = [];
    this.bids = [];
    this.trades = [];
    this.ledger = new TamperLedger(true);
    this.gridNetwork = gridNetwork;
    this.lastRunSummary = null;

    // Initialize 24-hour history structures
    this.hourlyHistory = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      hourLabel: `${String(h).padStart(2, '0')}:00`,
      generationKWh: 0,
      demandKWh: 0,
      surplusKWh: 0,
      deficitKWh: 0,
      tradedKWh: 0,
      tradesCount: 0,
      tradeValueINR: 0,
      platformFeeINR: 0,
      weightedAveragePriceINR: null,
      recommendedPriceINR: 5.00,
      marketStatus: 'Pending',
      totalBuyerSavingsINR: 0,
      totalSellerAdditionalEarningsINR: 0,
      avoidedEmissionsKg: 0,
      isSimulated: false
    }));

    // Pre-calculate full-day generation and demand curves
    this.recalculateHourlyHistory();

    // Reset company finance in dataStore
    const config = dataStore.getConfig();
    dataStore.saveCompanyFinance({
      totalEnergyTradedKWh: 0.0,
      transactionFeesCollectedINR: 0.0,
      totalCompanyRevenueINR: 0.0,
      dailyOperatingCostINR: config.dailyOperatingCost || 100.0,
      variableOperatingCostsINR: 0.0,
      totalOperatingCostINR: config.dailyOperatingCost || 100.0,
      estimatedProfitLossINR: -(config.dailyOperatingCost || 100.0),
      isProfitable: false,
      sellerGrossEarningsINR: 0.0,
      buyerGrossEnergyCostINR: 0.0,
      buyerPlatformFeesINR: 0.0,
      buyerTotalCostINR: 0.0,
      calculations: {
        platformFeeFormula: "tradedKWh * platformFeePerKWh (₹0.20/kWh)",
        operatingCostFormula: "dailyOperatingCost (₹100) + tradedKWh * (processingFee ₹0.02 + maintenanceFee ₹0.03)",
        profitFormula: "totalCompanyRevenue - totalOperatingCost"
      },
      updatedAt: new Date().toISOString()
    });

    dataStore.saveTrades([]);
    this.populateCurrentHourOrders();
  }

  /**
   * Hydrates household records with deterministic 24-hour profiles
   */
  hydrateHouseholds(rawHouseholds) {
    const weatherFactor = this.weatherFactor !== undefined ? this.weatherFactor : 0.95;
    const demandMultiplier = this.demandMultiplier !== undefined ? this.demandMultiplier : 1.0;

    return rawHouseholds.map(raw => {
      const cap = Number(raw.solarCapacityKW || 0);
      const isProsumer = cap > 0 || raw.role === 'prosumer' || raw.role === 'Seller';

      // Find or build demand profile
      const defaultProfile = HOUSEHOLDS.find(h => h.id === raw.id)?.baseDemandProfile || [
        0.5, 0.4, 0.4, 0.4, 0.5, 0.8, 1.4, 2.0, 1.8, 1.2, 1.0, 0.9,
        0.9, 1.0, 1.1, 1.3, 1.8, 2.4, 3.0, 2.8, 2.2, 1.6, 1.1, 0.8
      ];
      const baseDemandProfile = Array.isArray(raw.baseDemandProfile) && raw.baseDemandProfile.length === 24
        ? raw.baseDemandProfile
        : defaultProfile;

      const hourlyGen = [];
      const hourlyDem = [];
      const hourlySur = [];
      const hourlyDef = [];

      for (let h = 0; h < 24; h++) {
        const gen = calculateSolarGeneration(cap, h, weatherFactor);
        const dem = Number((baseDemandProfile[h] * demandMultiplier).toFixed(2));
        const net = Number((gen - dem).toFixed(2));
        const sur = Number(Math.max(0, net).toFixed(2));
        const def = Number(Math.max(0, -net).toFixed(2));

        hourlyGen.push(gen);
        hourlyDem.push(dem);
        hourlySur.push(sur);
        hourlyDef.push(def);
      }

      const isMixed = raw.role === 'mixed' || raw.participantType === 'COMMERCIAL_MIXED';
      const role = isMixed ? 'mixed' : (isProsumer ? 'prosumer' : 'consumer');
      const participantType = raw.participantType || (isMixed ? 'COMMERCIAL_MIXED' : (isProsumer ? 'PROSUMER' : 'CONSUMER'));
      const zone = raw.zone || (isProsumer ? 'ZONE-A' : 'ZONE-B');
      const gridConnectionStatus = raw.gridConnectionStatus || 'CONNECTED';
      const exportCapacityKW = Number(raw.exportCapacityKW !== undefined ? raw.exportCapacityKW : (isProsumer ? cap : 0));
      const importCapacityKW = Number(raw.importCapacityKW !== undefined ? raw.importCapacityKW : (isProsumer ? 5.0 : 10.0));

      return {
        id: raw.id,
        name: raw.name,
        solarCapacityKW: cap,
        role,
        participantType,
        zone,
        gridConnectionStatus,
        exportCapacityKW,
        importCapacityKW,
        autoTradeEnabled: raw.autoTradeEnabled !== false,
        minimumAcceptedPrice: raw.minimumAcceptedPrice !== undefined ? raw.minimumAcceptedPrice : null,
        maximumAcceptedPrice: raw.maximumAcceptedPrice !== undefined ? raw.maximumAcceptedPrice : null,
        walletBalance: Number((raw.walletBalance || (isProsumer ? 5000.0 : 10000.0)).toFixed(2)),
        createdAt: raw.createdAt || new Date().toISOString(),
        description: raw.description || (isProsumer ? `Prosumer with ${cap} kW solar array` : 'Energy consumer'),
        baseDemandProfile,
        hourlyGeneration: hourlyGen,
        hourlyDemand: hourlyDem,
        hourlySurplus: hourlySur,
        hourlyDeficit: hourlyDef,
        totalEnergySoldKWh: 0,
        totalEnergyBoughtKWh: 0,
        totalEarningsINR: 0,
        totalExpenditureINR: 0,
        totalBuyerSavingsINR: 0,
        totalSellerAdditionalEarningsINR: 0,
        totalTradesCount: 0
      };
    });
  }

  /**
   * Recalculates hourly totals across all households.
   */
  recalculateHourlyHistory() {
    const config = dataStore.getConfig();

    for (let h = 0; h < 24; h++) {
      let gen = 0;
      let dem = 0;
      let sur = 0;
      let def = 0;

      this.households.forEach(hh => {
        gen += hh.hourlyGeneration[h] || 0;
        dem += hh.hourlyDemand[h] || 0;
        sur += hh.hourlySurplus[h] || 0;
        def += hh.hourlyDeficit[h] || 0;
      });

      this.hourlyHistory[h].generationKWh = Number(gen.toFixed(2));
      this.hourlyHistory[h].demandKWh = Number(dem.toFixed(2));
      this.hourlyHistory[h].surplusKWh = Number(sur.toFixed(2));
      this.hourlyHistory[h].deficitKWh = Number(def.toFixed(2));

      // Calculate suggested market price for this hour
      const priceResult = calculateRecommendedPrice(sur, def, { currentHour: h, overrideConfig: config });
      this.hourlyHistory[h].recommendedPriceINR = priceResult.recommendedPriceINR || 5.00;
      this.hourlyHistory[h].marketStatus = priceResult.statusLabel;
    }
  }

  /**
   * Applies an interactive weather or grid contingency scenario.
   * Recalculates 24-hour generation/demand, updates order books, adjusts grid routes,
   * preserves regulatory price limits (₹2.00–₹8.00), and provides a structured before/after comparison.
   *
   * @param {string} scenarioKey 'SUNNY_DAY' | 'MONSOON_OVERCAST' | 'HEATWAVE_PEAK' | 'ROUTE_FAILURE'
   * @param {Object} options Optional configuration overrides
   * @returns {Object} Scenario impact summary
   */
  applyScenario(scenarioKey, options = {}) {
    if (!scenarioKey || typeof scenarioKey !== 'string') {
      throw new Error('Scenario key is required.');
    }
    const normalizedKey = scenarioKey.trim().toUpperCase();
    const scenario = SCENARIOS[normalizedKey];
    if (!scenario) {
      throw new Error(`Invalid scenario "${scenarioKey}". Allowed scenarios: ${Object.keys(SCENARIOS).join(', ')}`);
    }

    const currentHour = this.currentHour;
    const currentEntry = this.hourlyHistory[currentHour] || {};
    const routeABBefore = gridNetwork.getRoute('ZONE-A', 'ZONE-B');

    // 1. Snapshot BEFORE state
    const before = {
      scenarioKey: this.activeScenario,
      scenarioName: SCENARIOS[this.activeScenario]?.name || this.activeScenario,
      weatherFactor: this.weatherFactor,
      demandMultiplier: this.demandMultiplier,
      totalSolarGenKWh: currentEntry.generationKWh || 0,
      totalDemandKWh: currentEntry.demandKWh || 0,
      availableSurplusKWh: currentEntry.surplusKWh || 0,
      unmetDemandKWh: currentEntry.deficitKWh || 0,
      recommendedPriceINR: currentEntry.recommendedPriceINR || 5.00,
      routeStatusAB: routeABBefore ? routeABBefore.status : 'CONNECTED'
    };

    // 2. Set new scenario parameters
    this.activeScenario = normalizedKey;
    this.weatherFactor = scenario.weatherFactor;
    this.weather = scenario.weatherLabel;
    this.demandMultiplier = scenario.demandMultiplier;
    this.activeRouteFailure = scenario.routeFailure;

    // 3. Configure grid route operational statuses
    if (scenario.routeFailure) {
      gridNetwork.setRouteStatus(scenario.routeFailure, 'DISCONNECTED');
      if (scenario.routeFailure === 'ROUTE-A-B') {
        gridNetwork.setRouteStatus('ROUTE-B-A', 'DISCONNECTED');
      }
    } else {
      // Reconnect default routes
      gridNetwork.setRouteStatus('ROUTE-A-B', 'CONNECTED');
      gridNetwork.setRouteStatus('ROUTE-B-A', 'CONNECTED');
    }

    // 4. Recalculate 24-hour generation & demand profiles for all households
    this.households.forEach(hh => {
      const cap = Number(hh.solarCapacityKW || 0);
      const baseProfile = hh.baseDemandProfile || HOUSEHOLDS.find(h => h.id === hh.id)?.baseDemandProfile || [
        0.5, 0.4, 0.4, 0.4, 0.5, 0.8, 1.4, 2.0, 1.8, 1.2, 1.0, 0.9,
        0.9, 1.0, 1.1, 1.3, 1.8, 2.4, 3.0, 2.8, 2.2, 1.6, 1.1, 0.8
      ];
      hh.baseDemandProfile = baseProfile;

      const hourlyGen = [];
      const hourlyDem = [];
      const hourlySur = [];
      const hourlyDef = [];

      for (let h = 0; h < 24; h++) {
        const gen = calculateSolarGeneration(cap, h, this.weatherFactor);
        const dem = Number((baseProfile[h] * this.demandMultiplier).toFixed(2));
        const net = Number((gen - dem).toFixed(2));
        const sur = Number(Math.max(0, net).toFixed(2));
        const def = Number(Math.max(0, -net).toFixed(2));

        hourlyGen.push(gen);
        hourlyDem.push(dem);
        hourlySur.push(sur);
        hourlyDef.push(def);
      }

      hh.hourlyGeneration = hourlyGen;
      hh.hourlyDemand = hourlyDem;
      hh.hourlySurplus = hourlySur;
      hh.hourlyDeficit = hourlyDef;
    });

    // 5. Recalculate hourly history totals & dynamic market pricing
    this.recalculateHourlyHistory();

    // 6. Regenerate active orders for the current hour
    this.populateCurrentHourOrders();

    // 7. Snapshot AFTER state
    const updatedEntry = this.hourlyHistory[currentHour] || {};
    const routeABAfter = gridNetwork.getRoute('ZONE-A', 'ZONE-B');
    const after = {
      scenarioKey: this.activeScenario,
      scenarioName: scenario.name,
      weatherFactor: this.weatherFactor,
      demandMultiplier: this.demandMultiplier,
      totalSolarGenKWh: updatedEntry.generationKWh || 0,
      totalDemandKWh: updatedEntry.demandKWh || 0,
      availableSurplusKWh: updatedEntry.surplusKWh || 0,
      unmetDemandKWh: updatedEntry.deficitKWh || 0,
      recommendedPriceINR: updatedEntry.recommendedPriceINR || 5.00,
      routeStatusAB: routeABAfter ? routeABAfter.status : 'CONNECTED'
    };

    // 8. Return structured comparison
    return {
      success: true,
      activeScenario: this.activeScenario,
      scenarioName: scenario.name,
      scenarioBadge: scenario.badge,
      description: scenario.description,
      isContingency: scenario.isContingency,
      currentHour: this.currentHour,
      currentHourLabel: `${String(this.currentHour).padStart(2, '0')}:00`,
      before,
      after,
      impactSummary: {
        solarGenDeltaKWh: Number((after.totalSolarGenKWh - before.totalSolarGenKWh).toFixed(2)),
        demandDeltaKWh: Number((after.totalDemandKWh - before.totalDemandKWh).toFixed(2)),
        surplusDeltaKWh: Number((after.availableSurplusKWh - before.availableSurplusKWh).toFixed(2)),
        deficitDeltaKWh: Number((after.unmetDemandKWh - before.unmetDemandKWh).toFixed(2)),
        priceDeltaINR: Number((after.recommendedPriceINR - before.recommendedPriceINR).toFixed(2)),
        routeStatusAB: after.routeStatusAB
      }
    };
  }

  /**
   * Registers a dynamically created household (e.g. from registration).
   */
  registerDynamicHousehold({ id, name, role, solarCapacityKW, description, zone }) {
    const cap = Number(solarCapacityKW) || 0;
    const isProsumer = cap > 0 || (role && role.toLowerCase().includes('sell'));
    const assignedZone = zone || (isProsumer ? 'ZONE-A' : 'ZONE-B');
    const hourlyGen = [];
    const hourlyDem = [];
    const hourlySur = [];
    const hourlyDef = [];

    for (let h = 0; h < 24; h++) {
      let gen = 0;
      if (cap > 0 && h >= 6 && h <= 18) {
        gen = Number((cap * Math.pow(Math.sin(((h - 6) * Math.PI) / 12), 1.5) * 0.85).toFixed(2));
      }
      const dem = isProsumer ? 1.5 : 2.5;
      const sur = Math.max(0, Number((gen - dem).toFixed(2)));
      const def = Math.max(0, Number((dem - gen).toFixed(2)));

      hourlyGen.push(gen);
      hourlyDem.push(dem);
      hourlySur.push(sur);
      hourlyDef.push(def);
    }

    const newHh = {
      id,
      name,
      solarCapacityKW: cap,
      role: isProsumer ? 'prosumer' : 'consumer',
      participantType: isProsumer ? 'PROSUMER' : 'CONSUMER',
      zone: assignedZone,
      gridConnectionStatus: 'CONNECTED',
      exportCapacityKW: isProsumer ? cap : 0,
      importCapacityKW: isProsumer ? 5.0 : 10.0,
      autoTradeEnabled: true,
      minimumAcceptedPrice: null,
      maximumAcceptedPrice: null,
      walletBalance: isProsumer ? 5000.0 : 10000.0,
      createdAt: new Date().toISOString(),
      description: description || (isProsumer ? `Prosumer with ${cap} kW solar array` : 'Grid-connected consumer without solar panels'),
      hourlyGeneration: hourlyGen,
      hourlyDemand: hourlyDem,
      hourlySurplus: hourlySur,
      hourlyDeficit: hourlyDef,
      totalEnergySoldKWh: 0,
      totalEnergyBoughtKWh: 0,
      totalEarningsINR: 0,
      totalExpenditureINR: 0,
      totalBuyerSavingsINR: 0,
      totalSellerAdditionalEarningsINR: 0,
      totalTradesCount: 0
    };

    this.households.push(newHh);
    this.recalculateHourlyHistory();

    return newHh;
  }

  /**
   * Updates household trading preferences (Auto-Trade, Min Price, Max Price).
   */
  updateHouseholdPreferences(id, { autoTradeEnabled, minimumAcceptedPrice, maximumAcceptedPrice }) {
    const hh = this.households.find(h => h.id === id);
    if (!hh) {
      throw new Error(`Household with ID "${id}" not found.`);
    }

    if (autoTradeEnabled !== undefined) {
      hh.autoTradeEnabled = Boolean(autoTradeEnabled);
    }
    if (minimumAcceptedPrice !== undefined) {
      hh.minimumAcceptedPrice = minimumAcceptedPrice === null || minimumAcceptedPrice === '' ? null : Number(Number(minimumAcceptedPrice).toFixed(2));
    }
    if (maximumAcceptedPrice !== undefined) {
      hh.maximumAcceptedPrice = maximumAcceptedPrice === null || maximumAcceptedPrice === '' ? null : Number(Number(maximumAcceptedPrice).toFixed(2));
    }

    // Persist updated households to JSON
    const cleanToSave = this.households.map(h => ({
      id: h.id,
      name: h.name,
      solarCapacityKW: h.solarCapacityKW,
      role: h.role,
      participantType: h.participantType || (h.solarCapacityKW > 0 ? 'PROSUMER' : 'CONSUMER'),
      zone: h.zone || 'ZONE-A',
      gridConnectionStatus: h.gridConnectionStatus || 'CONNECTED',
      exportCapacityKW: h.exportCapacityKW !== undefined ? h.exportCapacityKW : (h.solarCapacityKW || 0),
      importCapacityKW: h.importCapacityKW !== undefined ? h.importCapacityKW : 10.0,
      autoTradeEnabled: h.autoTradeEnabled,
      minimumAcceptedPrice: h.minimumAcceptedPrice,
      maximumAcceptedPrice: h.maximumAcceptedPrice,
      walletBalance: h.walletBalance,
      createdAt: h.createdAt,
      description: h.description
    }));
    dataStore.saveHouseholds(cleanToSave);

    return {
      success: true,
      message: `Preferences updated for ${hh.name} (${hh.id}).`,
      household: hh
    };
  }

  /**
   * Prepares and populates active order book for the current simulation interval.
   * Preserves any existing manual orders and generates automated orders for households with surplus/deficit.
   */
  populateCurrentHourOrders() {
    const hour = this.currentHour;
    const config = dataStore.getConfig();

    // Preserve any existing active manual orders for this hour
    const manualOffers = this.offers.filter(o => 
      (o.hour === undefined || o.hour === null || o.hour === hour) && 
      o.status === 'ACTIVE' && 
      o.remainingKWh > 0.001
    );
    const manualBids = this.bids.filter(b => 
      (b.hour === undefined || b.hour === null || b.hour === hour) && 
      b.status === 'ACTIVE' && 
      b.remainingKWh > 0.001
    );

    // Normalize .hour on existing manual orders
    manualOffers.forEach(o => { if (o.hour === undefined || o.hour === null) o.hour = hour; });
    manualBids.forEach(b => { if (b.hour === undefined || b.hour === null) b.hour = hour; });

    const hourSurplus = this.households.reduce((s, hh) => s + (hh.hourlySurplus[hour] || 0), 0);
    const hourDeficit = this.households.reduce((s, hh) => s + (hh.hourlyDeficit[hour] || 0), 0);
    const priceResult = calculateRecommendedPrice(hourSurplus, hourDeficit, { currentHour: hour, overrideConfig: config });
    const recommendedPrice = priceResult.recommendedPriceINR;

    const householdCommittedOffers = {};
    manualOffers.forEach(o => {
      householdCommittedOffers[o.householdId] = (householdCommittedOffers[o.householdId] || 0) + o.remainingKWh;
    });

    const householdCommittedBids = {};
    manualBids.forEach(b => {
      householdCommittedBids[b.householdId] = (householdCommittedBids[b.householdId] || 0) + b.remainingKWh;
    });

    const autoHouseholds = this.households.filter(hh => hh.autoTradeEnabled !== false).map(hh => {
      const surplus = hh.hourlySurplus[hour] || 0;
      const deficit = hh.hourlyDeficit[hour] || 0;
      const alreadyCommittedSurplus = householdCommittedOffers[hh.id] || 0;
      const alreadyCommittedDeficit = householdCommittedBids[hh.id] || 0;
      const uncommittedSurplus = Math.max(0, Number((surplus - alreadyCommittedSurplus).toFixed(2)));
      const uncommittedDeficit = Math.max(0, Number((deficit - alreadyCommittedDeficit).toFixed(2)));

      return {
        id: hh.id,
        name: hh.name,
        role: hh.role,
        autoTradeEnabled: true,
        minimumAcceptedPrice: hh.minimumAcceptedPrice,
        maximumAcceptedPrice: hh.maximumAcceptedPrice,
        currentHourGenerationKWh: uncommittedSurplus,
        currentHourDemandKWh: uncommittedDeficit
      };
    });

    const { offers: autoOffers, bids: autoBids } = generateInternalOrders(
      autoHouseholds,
      recommendedPrice,
      hour,
      config
    );

    this.offers = [...manualOffers, ...autoOffers];
    this.bids = [...manualBids, ...autoBids];
  }

  /**
   * Helper formatters for 12-hour clock, formatted date, and progress
   */
  getFormattedDate() {
    return '15 October 2026';
  }

  getFormattedTime() {
    const period = this.currentHour >= 12 ? 'PM' : 'AM';
    const displayHour = this.currentHour % 12 === 0 ? 12 : this.currentHour % 12;
    const minuteStr = String(this.currentMinute || 0).padStart(2, '0');
    return `${displayHour}:${minuteStr} ${period}`;
  }

  getHourProgressLabel() {
    return `Hour ${this.currentHour} of 24`;
  }

  /**
   * Executes a single simulation interval (hour).
   * Generates internal orders automatically from surplus/deficits, matches via CDA (if autoMatchingEnabled),
   * updates participant wallets, company finance, and ledger.
   */
  advanceOneHour() {
    const hour = this.currentHour;
    this.currentMinute = 0;
    const timeStr = `${String(hour).padStart(2, '0')}:00`;
    const timestamp = `${this.simulatedDate}T${timeStr}:00.000Z`;
    const config = dataStore.getConfig();

    // Reset grid route capacity utilization for this hour
    gridNetwork.resetIntervalCapacity();

    // Step 1: Ensure all orders are fresh and populated for this interval
    this.populateCurrentHourOrders();

    const hourSurplus = this.households.reduce((s, hh) => s + (hh.hourlySurplus[hour] || 0), 0);
    const hourDeficit = this.households.reduce((s, hh) => s + (hh.hourlyDeficit[hour] || 0), 0);
    const priceResult = calculateRecommendedPrice(hourSurplus, hourDeficit, { currentHour: hour, overrideConfig: config });
    const recommendedPrice = priceResult.recommendedPriceINR;

    // Generate simulated smart meter readings for all grid participants
    this.households.forEach(hh => {
      gridNetwork.createMeterRecord({
        household: hh,
        currentHour: hour,
        timestamp,
        solarGenerationKWh: hh.hourlyGeneration[hour] || 0,
        consumptionKWh: hh.hourlyDemand[hour] || 0,
        exportedKWh: hh.hourlySurplus[hour] || 0,
        importedKWh: hh.hourlyDeficit[hour] || 0
      });
    });

    let settledTrades = [];
    let matchResult = {
      trades: [],
      updatedOffers: this.offers,
      updatedBids: this.bids,
      rejectedTrades: [],
      summary: {
        totalTradedKWh: 0,
        matchedTradesCount: 0,
        totalTradeValueINR: 0,
        totalPlatformFeesINR: 0,
        weightedAveragePriceINR: null
      }
    };

    if (this.autoMatchingEnabled !== false) {
      // Step 5: Execute CDA matching algorithm with grid network route evaluation
      matchResult = matchOrders(this.offers, this.bids, hour, timestamp, config, gridNetwork);
      settledTrades = matchResult.trades;

      // Retain matching state for remaining unfulfilled orders
      this.offers = matchResult.updatedOffers;
      this.bids = matchResult.updatedBids;

      // Step 6: Process settlements & wallet balance updates
      settledTrades.forEach(trade => {
        this.trades.push(trade);

        const buyer = this.households.find(h => h.id === trade.buyerId);
        const seller = this.households.find(h => h.id === trade.sellerId);

        if (buyer) {
          buyer.totalEnergyBoughtKWh = Number((buyer.totalEnergyBoughtKWh + (trade.deliveredEnergyKWh !== undefined ? trade.deliveredEnergyKWh : trade.energyKWh)).toFixed(2));
          buyer.totalExpenditureINR = Number((buyer.totalExpenditureINR + trade.buyerTotalCostINR).toFixed(2));
          buyer.totalBuyerSavingsINR = Number((buyer.totalBuyerSavingsINR + trade.buyerSavingsINR).toFixed(2));
          buyer.walletBalance = Math.max(0, Number((buyer.walletBalance - trade.buyerTotalCostINR).toFixed(2)));
          buyer.totalTradesCount++;
        }

        if (seller) {
          seller.totalEnergySoldKWh = Number((seller.totalEnergySoldKWh + trade.energyKWh).toFixed(2));
          seller.totalEarningsINR = Number((seller.totalEarningsINR + trade.sellerEnergyRevenueINR).toFixed(2));
          seller.totalSellerAdditionalEarningsINR = Number((seller.totalSellerAdditionalEarningsINR + trade.sellerExtraEarningsINR).toFixed(2));
          seller.walletBalance = Number((seller.walletBalance + trade.sellerEnergyRevenueINR).toFixed(2));
          seller.totalTradesCount++;
        }

        // Append to cryptographic ledger
        this.ledger.appendTransaction(trade, this.currentRunId);
      });

      // Step 7: Update hourly history
      const historyEntry = this.hourlyHistory[hour];
      historyEntry.tradedKWh = matchResult.summary.totalTradedKWh;
      historyEntry.tradesCount = matchResult.summary.matchedTradesCount;
      historyEntry.tradeValueINR = matchResult.summary.totalTradeValueINR;
      historyEntry.platformFeeINR = matchResult.summary.totalPlatformFeesINR;
      historyEntry.weightedAveragePriceINR = matchResult.summary.weightedAveragePriceINR;
      historyEntry.recommendedPriceINR = recommendedPrice || 5.00;
      historyEntry.marketStatus = priceResult.statusLabel;
      historyEntry.totalBuyerSavingsINR = Number(settledTrades.reduce((s, t) => s + t.buyerSavingsINR, 0).toFixed(2));
      historyEntry.totalSellerAdditionalEarningsINR = Number(settledTrades.reduce((s, t) => s + t.sellerExtraEarningsINR, 0).toFixed(2));
      historyEntry.avoidedEmissionsKg = Number((matchResult.summary.totalTradedKWh * (config.gridEmissionFactorKgPerKWh || 0.82)).toFixed(2));
      historyEntry.isSimulated = true;

      // Step 8: Update company financial ledger
      this.updateCompanyFinance(config);

      // Step 9: Persist updated state to JSON files
      dataStore.saveTrades(this.trades);
    } else {
      const historyEntry = this.hourlyHistory[hour];
      historyEntry.recommendedPriceINR = recommendedPrice || 5.00;
      historyEntry.marketStatus = priceResult.statusLabel;
    }

    const cleanHouseholds = this.households.map(h => ({
      id: h.id,
      name: h.name,
      solarCapacityKW: h.solarCapacityKW,
      role: h.role,
      participantType: h.participantType || (h.role === 'mixed' ? 'COMMERCIAL_MIXED' : (h.solarCapacityKW > 0 ? 'PROSUMER' : 'CONSUMER')),
      zone: h.zone || 'ZONE-A',
      gridConnectionStatus: h.gridConnectionStatus || 'CONNECTED',
      exportCapacityKW: h.exportCapacityKW !== undefined ? h.exportCapacityKW : (h.solarCapacityKW || 0),
      importCapacityKW: h.importCapacityKW !== undefined ? h.importCapacityKW : 10.0,
      autoTradeEnabled: h.autoTradeEnabled,
      minimumAcceptedPrice: h.minimumAcceptedPrice,
      maximumAcceptedPrice: h.maximumAcceptedPrice,
      walletBalance: h.walletBalance,
      createdAt: h.createdAt,
      description: h.description
    }));
    dataStore.saveHouseholds(cleanHouseholds);

    const prevHour = hour;
    this.currentHour = (hour + 1) % 24;
    this.lastProcessedHour = prevHour;

    // Immediately populate open order book for the next interval so marketplace is active
    this.populateCurrentHourOrders();

    return {
      success: true,
      hour: prevHour,
      nextHour: this.currentHour,
      currentHour: this.currentHour,
      currentMinute: this.currentMinute,
      simulatedDate: this.simulatedDate,
      simulatedDateLabel: this.getFormattedDate(),
      simulatedTime: this.getFormattedTime(),
      hourProgressLabel: this.getHourProgressLabel(),
      timestamp,
      tradesExecuted: settledTrades.length,
      energyTradedKWh: matchResult.summary.totalTradedKWh,
      tradeValueINR: matchResult.summary.totalTradeValueINR,
      platformFeesINR: matchResult.summary.totalPlatformFeesINR,
      recommendedPriceINR: recommendedPrice,
      prices: {
        recommendedPriceINR: recommendedPrice,
        weightedAveragePriceINR: matchResult.summary.weightedAveragePriceINR
      },
      pricingDetails: priceResult,
      trades: settledTrades,
      rejectedTrades: matchResult.rejectedTrades || [],
      gridNetwork: gridNetwork.getNetworkState(),
      unmatchedOffers: (matchResult.updatedOffers || this.offers).filter(o => o.remainingKWh > 0.001),
      unmatchedBids: (matchResult.updatedBids || this.bids).filter(b => b.remainingKWh > 0.001),
      autoMatchingEnabled: this.autoMatchingEnabled !== false,
      summary: this.compileRunSummary()
    };
  }

  /**
   * Advances simulation by exactly 15 minutes.
   */
  advance15Minutes() {
    this.currentMinute = ((this.currentMinute || 0) + 15);
    if (this.currentMinute >= 60) {
      this.currentMinute = 0;
      this.currentHour = (this.currentHour + 1) % 24;
      this.lastProcessedHour = this.currentHour;
      gridNetwork.resetIntervalCapacity();
      this.populateCurrentHourOrders();
    }

    const hour = this.currentHour;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(this.currentMinute).padStart(2, '0')}`;
    const timestamp = `${this.simulatedDate}T${timeStr}:00.000Z`;
    const config = dataStore.getConfig();

    const hourSurplus = this.households.reduce((s, hh) => s + (hh.hourlySurplus[hour] || 0), 0);
    const hourDeficit = this.households.reduce((s, hh) => s + (hh.hourlyDeficit[hour] || 0), 0);
    const priceResult = calculateRecommendedPrice(hourSurplus, hourDeficit, { currentHour: hour, overrideConfig: config });
    const recommendedPrice = priceResult.recommendedPriceINR;

    let matchResult = null;
    let settledTrades = [];

    if (this.autoMatchingEnabled !== false) {
      matchResult = matchOrders(this.offers, this.bids, hour, timestamp, config, gridNetwork);
      settledTrades = matchResult.trades;
      this.offers = matchResult.updatedOffers;
      this.bids = matchResult.updatedBids;

      settledTrades.forEach(trade => {
        this.trades.push(trade);
        const buyer = this.households.find(h => h.id === trade.buyerId);
        const seller = this.households.find(h => h.id === trade.sellerId);
        if (buyer) {
          buyer.totalEnergyBoughtKWh = Number((buyer.totalEnergyBoughtKWh + (trade.deliveredEnergyKWh !== undefined ? trade.deliveredEnergyKWh : trade.energyKWh)).toFixed(2));
          buyer.totalExpenditureINR = Number((buyer.totalExpenditureINR + trade.buyerTotalCostINR).toFixed(2));
          buyer.totalBuyerSavingsINR = Number((buyer.totalBuyerSavingsINR + trade.buyerSavingsINR).toFixed(2));
          buyer.walletBalance = Math.max(0, Number((buyer.walletBalance - trade.buyerTotalCostINR).toFixed(2)));
          buyer.totalTradesCount++;
        }
        if (seller) {
          seller.totalEnergySoldKWh = Number((seller.totalEnergySoldKWh + trade.energyKWh).toFixed(2));
          seller.totalEarningsINR = Number((seller.totalEarningsINR + trade.sellerEnergyRevenueINR).toFixed(2));
          seller.totalSellerAdditionalEarningsINR = Number((seller.totalSellerAdditionalEarningsINR + trade.sellerExtraEarningsINR).toFixed(2));
          seller.walletBalance = Number((seller.walletBalance + trade.sellerEnergyRevenueINR).toFixed(2));
          seller.totalTradesCount++;
        }
        this.ledger.appendTransaction(trade, this.currentRunId);
      });

      if (settledTrades.length > 0) {
        this.updateCompanyFinance(config);
        dataStore.saveTrades(this.trades);
      }
    }

    return {
      success: true,
      currentHour: this.currentHour,
      currentMinute: this.currentMinute,
      simulatedDate: this.simulatedDate,
      simulatedDateLabel: this.getFormattedDate(),
      simulatedTime: this.getFormattedTime(),
      hourProgressLabel: this.getHourProgressLabel(),
      recommendedPriceINR: recommendedPrice,
      tradesExecuted: settledTrades.length,
      autoMatchingEnabled: this.autoMatchingEnabled !== false,
      summary: this.compileRunSummary()
    };
  }

  /**
   * Explicitly matches currently available open orders without advancing time.
   * Gives Admin full manual control over matching execution.
   */
  matchAvailableOrders() {
    const hour = this.currentHour;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(this.currentMinute || 0).padStart(2, '0')}`;
    const timestamp = `${this.simulatedDate}T${timeStr}:00.000Z`;
    const config = dataStore.getConfig();

    const hourSurplus = this.households.reduce((s, hh) => s + (hh.hourlySurplus[hour] || 0), 0);
    const hourDeficit = this.households.reduce((s, hh) => s + (hh.hourlyDeficit[hour] || 0), 0);
    const priceResult = calculateRecommendedPrice(hourSurplus, hourDeficit, { currentHour: hour, overrideConfig: config });

    const matchResult = matchOrders(this.offers, this.bids, hour, timestamp, config, gridNetwork);
    const settledTrades = matchResult.trades;

    this.offers = matchResult.updatedOffers;
    this.bids = matchResult.updatedBids;

    settledTrades.forEach(trade => {
      this.trades.push(trade);
      const buyer = this.households.find(h => h.id === trade.buyerId);
      const seller = this.households.find(h => h.id === trade.sellerId);

      if (buyer) {
        buyer.totalEnergyBoughtKWh = Number((buyer.totalEnergyBoughtKWh + (trade.deliveredEnergyKWh !== undefined ? trade.deliveredEnergyKWh : trade.energyKWh)).toFixed(2));
        buyer.totalExpenditureINR = Number((buyer.totalExpenditureINR + trade.buyerTotalCostINR).toFixed(2));
        buyer.totalBuyerSavingsINR = Number((buyer.totalBuyerSavingsINR + trade.buyerSavingsINR).toFixed(2));
        buyer.walletBalance = Math.max(0, Number((buyer.walletBalance - trade.buyerTotalCostINR).toFixed(2)));
        buyer.totalTradesCount++;
      }

      if (seller) {
        seller.totalEnergySoldKWh = Number((seller.totalEnergySoldKWh + trade.energyKWh).toFixed(2));
        seller.totalEarningsINR = Number((seller.totalEarningsINR + trade.sellerEnergyRevenueINR).toFixed(2));
        seller.totalSellerAdditionalEarningsINR = Number((seller.totalSellerAdditionalEarningsINR + trade.sellerExtraEarningsINR).toFixed(2));
        seller.walletBalance = Number((seller.walletBalance + trade.sellerEnergyRevenueINR).toFixed(2));
        seller.totalTradesCount++;
      }

      this.ledger.appendTransaction(trade, this.currentRunId);
    });

    if (settledTrades.length > 0) {
      const historyEntry = this.hourlyHistory[hour];
      historyEntry.tradedKWh = Number(((historyEntry.tradedKWh || 0) + matchResult.summary.totalTradedKWh).toFixed(2));
      historyEntry.tradesCount = (historyEntry.tradesCount || 0) + matchResult.summary.matchedTradesCount;
      historyEntry.tradeValueINR = Number(((historyEntry.tradeValueINR || 0) + matchResult.summary.totalTradeValueINR).toFixed(2));
      historyEntry.platformFeeINR = Number(((historyEntry.platformFeeINR || 0) + matchResult.summary.totalPlatformFeesINR).toFixed(2));
      historyEntry.weightedAveragePriceINR = matchResult.summary.weightedAveragePriceINR;
      historyEntry.totalBuyerSavingsINR = Number(((historyEntry.totalBuyerSavingsINR || 0) + settledTrades.reduce((s, t) => s + t.buyerSavingsINR, 0)).toFixed(2));
      historyEntry.totalSellerAdditionalEarningsINR = Number(((historyEntry.totalSellerAdditionalEarningsINR || 0) + settledTrades.reduce((s, t) => s + t.sellerExtraEarningsINR, 0)).toFixed(2));
      historyEntry.avoidedEmissionsKg = Number(((historyEntry.avoidedEmissionsKg || 0) + matchResult.summary.totalTradedKWh * (config.gridEmissionFactorKgPerKWh || 0.82)).toFixed(2));
      historyEntry.isSimulated = true;

      this.updateCompanyFinance(config);
      dataStore.saveTrades(this.trades);
    }

    return {
      success: true,
      tradesExecuted: settledTrades.length,
      energyTradedKWh: matchResult.summary.totalTradedKWh,
      tradeValueINR: matchResult.summary.totalTradeValueINR,
      platformFeesINR: matchResult.summary.totalPlatformFeesINR,
      prices: {
        recommendedPriceINR: priceResult.recommendedPriceINR,
        weightedAveragePriceINR: matchResult.summary.weightedAveragePriceINR
      },
      trades: settledTrades,
      unmatchedOffers: this.offers.filter(o => o.remainingKWh > 0.001),
      unmatchedBids: this.bids.filter(b => b.remainingKWh > 0.001),
      summary: this.compileRunSummary()
    };
  }

  /**
   * Sets auto-matching toggle.
   */
  setAutoMatching(enabled) {
    this.autoMatchingEnabled = Boolean(enabled);
    return {
      success: true,
      autoMatchingEnabled: this.autoMatchingEnabled
    };
  }

  /**
   * Recalculates and persists company financial position.
   */
  updateCompanyFinance(config = null) {
    const cfg = config || dataStore.getConfig();
    const totalEnergyTraded = Number(this.trades.reduce((s, t) => s + t.energyKWh, 0).toFixed(2));
    const totalFeesCollected = Number(this.trades.reduce((s, t) => s + (t.platformFeeINR || 0), 0).toFixed(2));

    const totalCompanyRevenue = totalFeesCollected; // Pure transparent transaction fees
    const dailyCost = Number(cfg.dailyOperatingCost || 100.0);
    const processingCostRate = Number(cfg.paymentProcessingCostPerKWh || 0.02);
    const maintenanceCostRate = Number(cfg.maintenanceCostPerKWh || 0.03);
    const variableOperatingCosts = Number((totalEnergyTraded * (processingCostRate + maintenanceCostRate)).toFixed(2));
    const totalOperatingCost = Number((dailyCost + variableOperatingCosts).toFixed(2));
    const estimatedProfitLoss = Number((totalCompanyRevenue - totalOperatingCost).toFixed(2));

    const sellerGrossEarnings = Number(this.trades.reduce((s, t) => s + t.sellerEnergyRevenueINR, 0).toFixed(2));
    const buyerGrossEnergyCost = Number(this.trades.reduce((s, t) => s + t.buyerEnergyCostINR, 0).toFixed(2));
    const buyerTotalCost = Number(this.trades.reduce((s, t) => s + t.buyerTotalCostINR, 0).toFixed(2));

    const finance = {
      totalEnergyTradedKWh: totalEnergyTraded,
      transactionFeesCollectedINR: totalFeesCollected,
      totalCompanyRevenueINR: totalCompanyRevenue,
      dailyOperatingCostINR: dailyCost,
      variableOperatingCostsINR: variableOperatingCosts,
      totalOperatingCostINR: totalOperatingCost,
      estimatedProfitLossINR: estimatedProfitLoss,
      isProfitable: estimatedProfitLoss >= 0,
      sellerGrossEarningsINR: sellerGrossEarnings,
      buyerGrossEnergyCostINR: buyerGrossEnergyCost,
      buyerPlatformFeesINR: totalFeesCollected,
      buyerTotalCostINR: buyerTotalCost,
      calculations: {
        platformFeeFormula: `tradedKWh * platformFeePerKWh (₹${cfg.platformFeePerKWh}/kWh)`,
        operatingCostFormula: `dailyOperatingCost (₹${dailyCost}) + tradedKWh * (processingFee ₹${processingCostRate} + maintenanceFee ₹${maintenanceCostRate})`,
        profitFormula: "totalCompanyRevenue - totalOperatingCost"
      },
      updatedAt: new Date().toISOString()
    };

    dataStore.saveCompanyFinance(finance);
    return finance;
  }

  /**
   * Starts automatic simulation ticking at specified speed.
   */
  startAutoSimulation(speedSeconds = null) {
    if (speedSeconds) {
      this.autoSpeedSeconds = Math.max(1, Number(speedSeconds) || 10);
    }
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
    }
    this.isRunning = true;
    this.autoTimer = setInterval(() => {
      try {
        this.advanceOneHour();
      } catch (err) {
        console.error('[SimulationManager] Auto-tick error:', err.message);
      }
    }, this.autoSpeedSeconds * 1000);

    return {
      success: true,
      isRunning: this.isRunning,
      autoSpeedSeconds: this.autoSpeedSeconds,
      currentHour: this.currentHour,
      currentHourLabel: `${String(this.currentHour).padStart(2, '0')}:00`
    };
  }

  /**
   * Pauses automatic simulation.
   */
  pauseAutoSimulation() {
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
    this.isRunning = false;
    return {
      success: true,
      isRunning: this.isRunning,
      autoSpeedSeconds: this.autoSpeedSeconds,
      currentHour: this.currentHour,
      currentHourLabel: `${String(this.currentHour).padStart(2, '0')}:00`
    };
  }

  /**
   * Updates demonstration speed (seconds per simulated hour).
   */
  setSimulationSpeed(speedSeconds) {
    this.autoSpeedSeconds = Math.max(1, Number(speedSeconds) || 10);
    if (this.isRunning) {
      return this.startAutoSimulation(this.autoSpeedSeconds);
    }
    return {
      success: true,
      isRunning: this.isRunning,
      autoSpeedSeconds: this.autoSpeedSeconds
    };
  }

  /**
   * Executes a complete 24-hour simulation cycle with progress tracking.
   */
  runFullDay() {
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
      this.isRunning = false;
    }
    this.reset();
    const intervalResults = [];

    for (let h = 0; h < 24; h++) {
      this.currentHour = h;
      this.fullDayProgress = { currentStep: h + 1, totalSteps: 24, percent: Math.round(((h + 1) / 24) * 100) };
      const res = this.advanceOneHour();
      intervalResults.push(res);
    }

    this.fullDayProgress = null;
    const summary = this.compileRunSummary();
    this.lastRunSummary = summary;

    return {
      success: true,
      runId: this.currentRunId,
      totalHoursExecuted: 24,
      totalHoursSimulated: 24,
      totalTradesExecuted: this.trades.length,
      totalEnergyTradedKWh: Number(this.trades.reduce((s, t) => s + t.energyKWh, 0).toFixed(2)),
      intervals: intervalResults,
      summary
    };
  }

  /**
   * Compiles the 9-point KPI Results Summary.
   */
  compileRunSummary() {
    const config = dataStore.getConfig();
    const gridTariff = config.referenceImportTariff || 8.00;
    const feedInFloor = config.referenceExportTariff || 2.00;

    let totalGen = 0;
    let totalDem = 0;
    let totalSurplusAvailable = 0;
    this.households.forEach(hh => {
      totalGen += hh.hourlyGeneration.reduce((a, b) => a + b, 0);
      totalDem += hh.hourlyDemand.reduce((a, b) => a + b, 0);
      totalSurplusAvailable += hh.hourlySurplus.reduce((a, b) => a + b, 0);
    });

    const totalTraded = Number(this.trades.reduce((s, t) => s + t.energyKWh, 0).toFixed(2));
    const totalTradeValue = Number(this.trades.reduce((s, t) => s + t.totalValueINR, 0).toFixed(2));
    const totalBuyerSavings = Number(this.trades.reduce((s, t) => s + t.buyerSavingsINR, 0).toFixed(2));
    const totalSellerExtra = Number(this.trades.reduce((s, t) => s + t.sellerExtraEarningsINR, 0).toFixed(2));
    const totalAvoidedCO2 = Number((totalTraded * (config.gridEmissionFactorKgPerKWh || 0.82)).toFixed(2));

    const finance = dataStore.getCompanyFinance();
    const ledgerVerification = this.ledger.verify();

    const householdWiseSavings = this.households.map(hh => ({
      id: hh.id,
      name: hh.name,
      role: hh.role,
      energySoldKWh: hh.totalEnergySoldKWh || 0,
      energyBoughtKWh: hh.totalEnergyBoughtKWh || 0,
      buyerSavingsINR: hh.totalBuyerSavingsINR || 0,
      sellerRevenueINR: hh.totalEarningsINR || 0
    }));

    return {
      runId: this.currentRunId,
      simulatedDate: this.simulatedDate,
      timestamp: new Date().toISOString(),
      totalEnergyGeneratedKWh: Number(totalGen.toFixed(2)),
      totalEnergyConsumedKWh: Number(totalDem.toFixed(2)),
      totalSurplusAvailableKWh: Number(totalSurplusAvailable.toFixed(2)),
      totalEnergyTradedKWh: totalTraded,
      matchedTradesCount: this.trades.length,
      averageAgreedTradingPriceINR: totalTraded > 0 ? Number((totalTradeValue / totalTraded).toFixed(2)) : 5.00,
      totalTradeValueINR: totalTradeValue,
      selfConsumptionRatePercent: totalGen > 0 ? Number((Math.min(totalGen, totalDem) / totalGen * 100).toFixed(1)) : 0,
      selfSufficiencyRatePercent: totalDem > 0 ? Number((Math.min(totalGen, totalDem) / totalDem * 100).toFixed(1)) : 0,
      totalBuyerSavingsINR: totalBuyerSavings,
      totalSellerRevenuePremiumINR: totalSellerExtra,
      netCommunitySavingsINR: Number((totalBuyerSavings + totalSellerExtra).toFixed(2)),
      avoidedCO2EmissionsKg: totalAvoidedCO2,
      householdWiseSavings,
      ledgerVerification,
      companyFinance: finance,
      disclaimer: "Simulation assumptions, not official electricity tariffs or approved commercial fees."
    };
  }

  /**
   * Helper methods for manual offer/bid submission and cancellation.
   */
  submitOffer(householdId, energyKWh, askingPriceINR, ruleValidation = null) {
    const hh = this.households.find(h => h.id === householdId);
    if (!hh) throw new Error(`Household ${householdId} not found`);

    // Check if household already has an active offer for this interval
    const existingActiveOffer = this.offers.find(o => 
      o.householdId === householdId && 
      (o.hour === undefined || o.hour === null || o.hour === this.currentHour) && 
      o.status === 'ACTIVE' && 
      o.remainingKWh > 0.001
    );

    if (existingActiveOffer) {
      existingActiveOffer.energyKWh = Number(energyKWh);
      existingActiveOffer.remainingKWh = Number(energyKWh);
      existingActiveOffer.askingPriceINR = Number(askingPriceINR);
      if (ruleValidation) {
        existingActiveOffer.ruleId = ruleValidation.ruleId;
        existingActiveOffer.ruleVersion = ruleValidation.ruleVersion;
      }
      existingActiveOffer.timestamp = new Date().toISOString();
      return existingActiveOffer;
    }

    const id = `OFF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const offer = {
      id,
      householdId,
      householdName: hh.name,
      role: hh.role || 'prosumer',
      sellerType: hh.type || (hh.role === 'prosumer' ? 'Residential Solar Prosumer' : 'Clean Energy Supplier'),
      solarCapacityKW: hh.solarCapacityKW || hh.capacityKW || 0,
      zone: hh.zone || 'ZONE-A',
      hour: this.currentHour,
      energyKWh: Number(energyKWh),
      remainingKWh: Number(energyKWh),
      askingPriceINR: Number(askingPriceINR),
      isAutoTrade: false,
      status: 'ACTIVE',
      ruleId: ruleValidation ? ruleValidation.ruleId : undefined,
      ruleVersion: ruleValidation ? ruleValidation.ruleVersion : undefined,
      timestamp: new Date().toISOString()
    };
    this.offers.push(offer);
    return offer;
  }

  /**
   * Updates an existing active offer (price and/or quantity).
   */
  updateOffer(orderId, callerHouseholdId, isAdmin = false, { energyKWh, askingPriceINR, ruleValidation }) {
    const offer = this.offers.find(o => o.id === orderId);
    if (!offer) throw new Error(`Offer ${orderId} not found.`);
    if (!isAdmin && callerHouseholdId && offer.householdId !== callerHouseholdId) {
      throw new Error(`Access Denied: You cannot update another household's offer.`);
    }
    if (energyKWh !== undefined && energyKWh !== null && !isNaN(energyKWh) && Number(energyKWh) > 0) {
      offer.energyKWh = Number(energyKWh);
      offer.remainingKWh = Number(energyKWh);
    }
    if (askingPriceINR !== undefined && askingPriceINR !== null && !isNaN(askingPriceINR)) {
      offer.askingPriceINR = Number(askingPriceINR);
    }
    if (ruleValidation) {
      offer.ruleId = ruleValidation.ruleId;
      offer.ruleVersion = ruleValidation.ruleVersion;
    }
    offer.timestamp = new Date().toISOString();
    return offer;
  }

  /**
   * Retrieves active seller offers ranked for an ordinary buyer.
   */
  getRankedOffers(buyerZone = 'ZONE-A') {
    const config = dataStore.getConfig();
    const activeRule = pricingRuleService.getActiveRule();
    return getRankedOffersForBuyer(this.offers, buyerZone, {
      ...config,
      platformFeeINRPerKWh: activeRule.platformFeePerKWhINR,
      network: gridNetwork,
      households: this.households
    });
  }

  /**
   * Generates a pre-purchase allocation breakdown and price quote for an ordinary buyer.
   * Does not execute the trade or mutate state.
   */
  getPurchaseQuote({ buyerId, buyerName, buyerZone, offerId, requestedKWh }) {
    const buyer = this.households.find(h => h.id === buyerId);
    const resolvedBuyerName = buyer ? buyer.name : (buyerName || `Buyer-${buyerId}`);
    const resolvedBuyerZone = buyer ? (buyer.zone || 'ZONE-A') : (buyerZone || 'ZONE-A');
    const config = dataStore.getConfig();
    const activeRule = pricingRuleService.getActiveRule();

    return executeDirectPurchase({
      buyerId,
      buyerName: resolvedBuyerName,
      buyerZone: resolvedBuyerZone,
      offerId,
      requestedKWh,
      offers: this.offers,
      network: gridNetwork,
      config: {
        ...config,
        ruleId: activeRule.ruleId,
        ruleVersion: activeRule.version,
        platformFeeINRPerKWh: activeRule.platformFeePerKWhINR
      },
      currentHour: this.currentHour,
      timestamp: new Date().toISOString(),
      previewOnly: true
    });
  }

  /**
   * Executes a direct offer purchase for an ordinary buyer.
   * Settles the trade, updates wallets, updates the tamper ledger, and persists.
   */
  purchaseOffer({ buyerId, buyerName, buyerZone, offerId, requestedKWh }) {
    const buyer = this.households.find(h => h.id === buyerId);
    const resolvedBuyerName = buyer ? buyer.name : (buyerName || `Buyer-${buyerId}`);
    const resolvedBuyerZone = buyer ? (buyer.zone || 'ZONE-A') : (buyerZone || 'ZONE-A');
    const config = dataStore.getConfig();
    const activeRule = pricingRuleService.getActiveRule();

    const result = executeDirectPurchase({
      buyerId,
      buyerName: resolvedBuyerName,
      buyerZone: resolvedBuyerZone,
      offerId,
      requestedKWh,
      offers: this.offers,
      network: gridNetwork,
      config: {
        ...config,
        ruleId: activeRule.ruleId,
        ruleVersion: activeRule.version,
        platformFeeINRPerKWh: activeRule.platformFeePerKWhINR
      },
      currentHour: this.currentHour,
      timestamp: new Date().toISOString()
    });

    if (!result.success) {
      return result;
    }

    const tradesToProcess = result.trades && result.trades.length > 0 ? result.trades : (result.trade ? [result.trade] : []);

    for (const trade of tradesToProcess) {
      this.trades.push(trade);

      // Update balances and wallet
      const seller = this.households.find(h => h.id === trade.sellerId);
      if (buyer) {
        buyer.totalEnergyBoughtKWh = Number(((buyer.totalEnergyBoughtKWh || 0) + (trade.deliveredEnergyKWh !== undefined ? trade.deliveredEnergyKWh : trade.energyKWh)).toFixed(2));
        buyer.totalExpenditureINR = Number(((buyer.totalExpenditureINR || 0) + trade.buyerTotalCostINR).toFixed(2));
        buyer.totalBuyerSavingsINR = Number(((buyer.totalBuyerSavingsINR || 0) + trade.buyerSavingsINR).toFixed(2));
        buyer.walletBalance = Math.max(0, Number(((buyer.walletBalance || 1000) - trade.buyerTotalCostINR).toFixed(2)));
        buyer.totalTradesCount = (buyer.totalTradesCount || 0) + 1;
      }

      if (seller) {
        seller.totalEnergySoldKWh = Number(((seller.totalEnergySoldKWh || 0) + trade.energyKWh).toFixed(2));
        seller.totalEarningsINR = Number(((seller.totalEarningsINR || 0) + trade.sellerEnergyRevenueINR).toFixed(2));
        seller.totalSellerAdditionalEarningsINR = Number(((seller.totalSellerAdditionalEarningsINR || 0) + trade.sellerExtraEarningsINR).toFixed(2));
        seller.walletBalance = Number(((seller.walletBalance || 0) + trade.sellerEnergyRevenueINR).toFixed(2));
        seller.totalTradesCount = (seller.totalTradesCount || 0) + 1;
      }

      // Append to cryptographic ledger
      this.ledger.appendTransaction(trade, this.currentRunId);
    }

    // Update company finance
    this.updateCompanyFinance(config);

    // Persist
    dataStore.saveTrades(this.trades);
    const cleanHouseholds = this.households.map(h => ({
      id: h.id,
      name: h.name,
      solarCapacityKW: h.solarCapacityKW,
      role: h.role,
      participantType: h.participantType || (h.solarCapacityKW > 0 ? 'PROSUMER' : 'CONSUMER'),
      zone: h.zone || 'ZONE-A',
      gridConnectionStatus: h.gridConnectionStatus || 'CONNECTED',
      exportCapacityKW: h.exportCapacityKW !== undefined ? h.exportCapacityKW : (h.solarCapacityKW || 0),
      importCapacityKW: h.importCapacityKW !== undefined ? h.importCapacityKW : 10.0,
      autoTradeEnabled: h.autoTradeEnabled,
      minimumAcceptedPrice: h.minimumAcceptedPrice,
      maximumAcceptedPrice: h.maximumAcceptedPrice,
      walletBalance: h.walletBalance,
      createdAt: h.createdAt,
      description: h.description
    }));
    dataStore.saveHouseholds(cleanHouseholds);

    return result;
  }

  submitBid(householdId, energyKWh, maxBidINR) {
    const hh = this.households.find(h => h.id === householdId);
    if (!hh) throw new Error(`Household ${householdId} not found`);
    const id = `BID-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const bid = {
      id,
      householdId,
      householdName: hh.name,
      role: hh.role || 'consumer',
      hour: this.currentHour,
      energyKWh: Number(energyKWh),
      remainingKWh: Number(energyKWh),
      maxBidINR: Number(maxBidINR),
      isAutoTrade: false,
      status: 'ACTIVE',
      timestamp: new Date().toISOString()
    };
    this.bids.push(bid);
    return bid;
  }

  cancelOrder(orderId, callerHouseholdId, isAdmin = false) {
    const offerIndex = this.offers.findIndex(o => o.id === orderId);
    if (offerIndex !== -1) {
      const offer = this.offers[offerIndex];
      if (!isAdmin && callerHouseholdId && offer.householdId !== callerHouseholdId) {
        throw new Error(`Access Denied: You cannot cancel another household's order.`);
      }
      this.offers.splice(offerIndex, 1);
      return { success: true, message: 'Offer cancelled successfully.' };
    }

    const bidIndex = this.bids.findIndex(b => b.id === orderId);
    if (bidIndex !== -1) {
      const bid = this.bids[bidIndex];
      if (!isAdmin && callerHouseholdId && bid.householdId !== callerHouseholdId) {
        throw new Error(`Access Denied: You cannot cancel another household's order.`);
      }
      this.bids.splice(bidIndex, 1);
      return { success: true, message: 'Bid cancelled successfully.' };
    }

    throw new Error(`Order ${orderId} not found.`);
  }

  /**
   * Compiles data for the 12 dashboard cards and 6 charts (GET /api/dashboard).
   */
  getDashboard() {
    const h = this.currentHour;
    const historyEntry = this.hourlyHistory[h] || {};
    const config = dataStore.getConfig();
    const finance = dataStore.getCompanyFinance();

    const totalEnergyTradedKWh = Number(this.trades.reduce((s, t) => s + t.energyKWh, 0).toFixed(2));
    const totalTradeValueINR = Number(this.trades.reduce((s, t) => s + t.totalValueINR, 0).toFixed(2));
    const averageTradePriceINR = totalEnergyTradedKWh > 0
      ? Number((totalTradeValueINR / totalEnergyTradedKWh).toFixed(2))
      : 5.00;

    const totalSellerEarningsINR = Number(this.trades.reduce((s, t) => s + t.sellerEnergyRevenueINR, 0).toFixed(2));
    const totalBuyerSavingsINR = Number(this.trades.reduce((s, t) => s + t.buyerSavingsINR, 0).toFixed(2));
    const avoidedCO2Kg = Number((totalEnergyTradedKWh * (config.gridEmissionFactorKgPerKWh || 0.82)).toFixed(2));

    // Pricing calculation for current hour
    const priceResult = calculateRecommendedPrice(
      historyEntry.surplusKWh || 0,
      historyEntry.deficitKWh || 0,
      { currentHour: h, overrideConfig: config }
    );

    // 6 Chart Series over 24 hours
    const hours = this.hourlyHistory.map(e => e.hourLabel);
    const hourlySolarGeneration = this.hourlyHistory.map(e => e.generationKWh);
    const hourlyConsumption = this.hourlyHistory.map(e => e.demandKWh);
    const hourlySurplus = this.hourlyHistory.map(e => e.surplusKWh);
    const hourlyDeficit = this.hourlyHistory.map(e => e.deficitKWh);
    const hourlyRecommendedPrice = this.hourlyHistory.map(e => e.recommendedPriceINR);
    const hourlyTradedEnergy = this.hourlyHistory.map(e => e.tradedKWh);

    return {
      appName: 'SolarShare',
      tagline: 'Trade Clean Energy. Save Money. Power Your Community.',
      runId: this.currentRunId,
      currentHour: this.currentHour,
      currentHourLabel: `${String(h).padStart(2, '0')}:00`,
      marketStatus: priceResult.statusLabel,
      pricingDetails: priceResult,
      isSyntheticData: true,
      dataDisclaimer: "Simulation assumptions, not official electricity tariffs or approved commercial fees. Actual prices, subsidies, tariffs, and fees depend on the applicable utility and regulatory arrangement.",

      // 12 Required KPI Dashboard Cards
      cards: {
        totalSolarGenKWh: historyEntry.generationKWh || 0,
        totalHouseholdDemandKWh: historyEntry.demandKWh || 0,
        availableSurplusKWh: historyEntry.surplusKWh || 0,
        localEnergyDemandKWh: historyEntry.deficitKWh || 0,
        totalEnergyTradedKWh: totalEnergyTradedKWh,
        recommendedMarketPriceINR: priceResult.recommendedPriceINR || 5.00,
        averageExecutedTradePriceINR: averageTradePriceINR,
        avoidedCO2Kg: avoidedCO2Kg,
        sellerEarningsINR: totalSellerEarningsINR,
        buyerSavingsINR: totalBuyerSavingsINR,
        platformRevenueINR: finance.totalCompanyRevenueINR,
        companyEstimatedProfitLossINR: finance.estimatedProfitLossINR
      },

      // 6 Required Chart Datasets
      charts: {
        hours,
        hourlySolarGeneration,
        hourlyConsumption,
        hourlySurplus,
        hourlyDeficit,
        hourlyRecommendedPrice,
        dailyEnergyTraded: hourlyTradedEnergy,
        companyFinanceComparison: {
          revenue: finance.totalCompanyRevenueINR,
          dailyOperatingCost: finance.dailyOperatingCostINR,
          variableOperatingCosts: finance.variableOperatingCostsINR,
          totalOperatingCost: finance.totalOperatingCostINR,
          profitOrLoss: finance.estimatedProfitLossINR,
          isProfitable: finance.isProfitable
        }
      },

      companyFinance: finance,
      gridNetwork: gridNetwork.getNetworkState(),
      activeScenario: this.activeScenario,
      scenarioDetails: SCENARIOS[this.activeScenario] || SCENARIOS.SUNNY_DAY,
      weatherFactor: this.weatherFactor,
      demandMultiplier: this.demandMultiplier,
      activeRouteFailure: this.activeRouteFailure,
      recentTrades: [...this.trades].slice(-8).reverse()
    };
  }

  /**
   * Returns backward-compatible overview data.
   */
  getOverview() {
    const dashboard = this.getDashboard();
    return {
      ...dashboard,
      metrics: {
        totalSolarGenKWh: dashboard.cards.totalSolarGenKWh,
        totalHouseholdDemandKWh: dashboard.cards.totalHouseholdDemandKWh,
        availableSurplusKWh: dashboard.cards.availableSurplusKWh,
        unmetDemandKWh: dashboard.cards.localEnergyDemandKWh,
        totalEnergyTradedKWh: dashboard.cards.totalEnergyTradedKWh,
        completedTradesCount: this.trades.length,
        averageTradingPriceINR: dashboard.cards.averageExecutedTradePriceINR,
        aggregateBuyerSavingsINR: dashboard.cards.buyerSavingsINR,
        aggregateSellerExtraINR: dashboard.cards.sellerEarningsINR,
        totalAvoidedEmissionsKg: dashboard.cards.avoidedCO2Kg
      },
      tariffs: {
        gridImportTariffINR: 8.00,
        exportCompensationINR: 2.00
      },
      topSurplusHouseholds: [...this.households]
        .map(hh => ({ id: hh.id, name: hh.name, surplusKWh: hh.hourlySurplus[this.currentHour] || 0, solarCapacityKW: hh.solarCapacityKW }))
        .sort((a, b) => b.surplusKWh - a.surplusKWh)
        .slice(0, 5),
      topDeficitHouseholds: [...this.households]
        .map(hh => ({ id: hh.id, name: hh.name, deficitKWh: hh.hourlyDeficit[this.currentHour] || 0, role: hh.role }))
        .sort((a, b) => b.deficitKWh - a.deficitKWh)
        .slice(0, 5),
      lastRunSummary: this.lastRunSummary || this.compileRunSummary()
    };
  }

  /**
   * Returns single household detailed statistics and history.
   */
  getHouseholdDetail(id) {
    const hh = this.households.find(h => h.id === id);
    if (!hh) return null;

    const currentHour = this.currentHour;
    const hhTrades = this.trades.filter(t => t.sellerId === id || t.buyerId === id);
    const activeOffers = this.offers.filter(o => o.householdId === id && o.status === 'ACTIVE');
    const activeBids = this.bids.filter(b => b.householdId === id && b.status === 'ACTIVE');

    const config = dataStore.getConfig();
    const priceResult = calculateRecommendedPrice(
      this.hourlyHistory[currentHour]?.surplusKWh || 0,
      this.hourlyHistory[currentHour]?.deficitKWh || 0,
      { currentHour, overrideConfig: config }
    );

    const genKWh = hh.hourlyGeneration[currentHour] || 0;
    const demKWh = hh.hourlyDemand[currentHour] || 0;
    const selfConsumedKWh = Number(Math.min(genKWh, demKWh).toFixed(2));
    const surplusKWh = Number(Math.max(0, genKWh - demKWh).toFixed(2));
    const deficitKWh = Number(Math.max(0, demKWh - genKWh).toFixed(2));
    const committedSurplusKWh = Number(activeOffers.reduce((sum, o) => sum + (o.remainingKWh || o.energyKWh || 0), 0).toFixed(2));
    const uncommittedSurplusKWh = Number(Math.max(0, surplusKWh - committedSurplusKWh).toFixed(2));
    const committedDeficitKWh = Number(activeBids.reduce((sum, b) => sum + (b.remainingKWh || b.energyKWh || 0), 0).toFixed(2));
    const remainingDeficitKWh = Number(Math.max(0, deficitKWh - committedDeficitKWh).toFixed(2));

    return {
      household: {
        id: hh.id,
        name: hh.name,
        solarCapacityKW: hh.solarCapacityKW,
        role: hh.role,
        participantType: hh.participantType || (hh.role === 'mixed' ? 'COMMERCIAL_MIXED' : (hh.solarCapacityKW > 0 ? 'PROSUMER' : 'CONSUMER')),
        zone: hh.zone || 'ZONE-A',
        gridConnectionStatus: hh.gridConnectionStatus || 'CONNECTED',
        exportCapacityKW: hh.exportCapacityKW !== undefined ? hh.exportCapacityKW : (hh.solarCapacityKW || 0),
        importCapacityKW: hh.importCapacityKW !== undefined ? hh.importCapacityKW : 10.0,
        noSolarPanelsRequired: (hh.solarCapacityKW || 0) <= 0,
        autoTradeEnabled: hh.autoTradeEnabled,
        minimumAcceptedPrice: hh.minimumAcceptedPrice,
        maximumAcceptedPrice: hh.maximumAcceptedPrice,
        walletBalance: hh.walletBalance,
        description: hh.description
      },
      currentHour,
      currentMinute: this.currentMinute || 0,
      currentHourLabel: this.getFormattedTime ? this.getFormattedTime() : `${String(currentHour).padStart(2, '0')}:00`,
      simulatedTime: this.getFormattedTime ? this.getFormattedTime() : `${String(currentHour).padStart(2, '0')}:00`,
      simulatedDate: this.simulatedDate,
      simulatedDateLabel: this.getFormattedDate ? this.getFormattedDate() : '15 October 2026',
      hourProgressLabel: this.getHourProgressLabel ? this.getHourProgressLabel() : `Hour ${currentHour} of 24`,
      recommendedPriceINR: priceResult.recommendedPriceINR || 5.00,
      pricingExplanation: priceResult.explanation,
      metrics: {
        generationKWh: genKWh,
        demandKWh: demKWh,
        selfConsumedKWh,
        surplusKWh,
        deficitKWh,
        committedSurplusKWh,
        uncommittedSurplusKWh,
        committedDeficitKWh,
        remainingDeficitKWh,
        totalEnergySoldKWh: hh.totalEnergySoldKWh || 0,
        totalEnergyBoughtKWh: hh.totalEnergyBoughtKWh || 0,
        totalEarningsINR: hh.totalEarningsINR || 0,
        totalExpenditureINR: hh.totalExpenditureINR || 0,
        totalBuyerSavingsINR: hh.totalBuyerSavingsINR || 0,
        totalSellerAdditionalEarningsINR: hh.totalSellerAdditionalEarningsINR || 0,
        tradesCount: hh.totalTradesCount || 0
      },
      activeOffers,
      activeBids,
      trades: hhTrades
    };
  }

  /**
   * Alias for advanceOneHour() for test and external API consistency.
   */
  advanceHour() {
    return this.advanceOneHour();
  }

  /**
   * Resets simulation run, restoring hour to 00:00 (or specified hour) and clearing active books.
   */
  resetSimulation(startHour = 0) {
    this.reset();
    this.currentHour = startHour;
    this.currentMinute = 0;
    this.offers = [];
    this.bids = [];
    gridNetwork.resetIntervalCapacity();
    return {
      success: true,
      currentHour: this.currentHour,
      currentMinute: this.currentMinute,
      simulatedDate: this.simulatedDate,
      simulatedTime: this.getFormattedTime(),
      hourProgressLabel: this.getHourProgressLabel()
    };
  }

  get activeOffers() {
    return (this.offers || []).filter(o => o.remainingKWh > 0.001 && o.status === 'ACTIVE');
  }

  set activeOffers(val) {
    this.offers = val || [];
  }

  get activeBids() {
    return (this.bids || []).filter(b => b.remainingKWh > 0.001 && b.status === 'ACTIVE');
  }

  set activeBids(val) {
    this.bids = val || [];
  }
}

module.exports = {
  SimulationManager
};
