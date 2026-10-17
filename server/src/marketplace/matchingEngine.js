/**
 * SolarShare - Continuous Double-Auction (CDA) Matching Engine
 * 
 * Supports Grid-Connected Peer-to-Peer Energy Marketplace:
 * - Buyers can be ANY grid-connected consumer (NO solar panels required).
 * - Sellers export eligible surplus into shared network.
 * - Enforces network-zone routing, route connectivity, and transfer capacity limits.
 * - Handles competing orders for limited intertie transfer capacity.
 * - Models transmission losses: Delivered = Injected * (1 - L).
 * - Calculates transparent wheeling fees, platform fees, seller revenue, and buyer savings.
 * - Supports Continuous Double Auction (CDA) with price-time priority and midpoint clearing rule.
 */

const { generateTxId } = require('../utils/cryptoHelper');
const { gridNetwork } = require('../simulation/gridNetwork');

/**
 * Automatically creates internal sell orders from solar surpluses
 * and internal buy orders from household/business deficits.
 * 
 * @param {Array} householdBalances - Array of household state objects
 * @param {number} recommendedPrice - Calculated fair market price
 * @param {number} currentHour - Current simulation hour (0-23)
 * @param {Object} config - System configuration parameters
 * @returns {Object} { offers, bids }
 */
function generateInternalOrders(householdBalances, recommendedPrice, currentHour, config = {}) {
  const minPrice = Number(config.minimumTradePrice || 2.00);
  const maxPrice = Number(config.maximumTradePrice || 8.00);
  const defaultPrice = (recommendedPrice !== null && recommendedPrice !== undefined)
    ? Math.max(minPrice, Math.min(maxPrice, Number(recommendedPrice)))
    : Number(((minPrice + maxPrice) / 2).toFixed(2));

  const offers = [];
  const bids = [];

  householdBalances.forEach(hh => {
    const gen = Math.max(0, Number(hh.generatedKWh || hh.currentHourGenerationKWh || 0));
    const con = Math.max(0, Number(hh.consumedKWh || hh.currentHourDemandKWh || 0));
    const netEnergy = Number((gen - con).toFixed(2));
    const surplusKWh = Number(Math.max(0, netEnergy).toFixed(2));
    const deficitKWh = Number(Math.max(0, -netEnergy).toFixed(2));
    const zone = hh.zone || 'ZONE-A';
    const participantType = hh.participantType || (hh.solarCapacityKW > 0 ? 'PROSUMER' : 'CONSUMER');

    // Internal Sell Order from Solar Surplus (Only households with generation surplus)
    if (surplusKWh > 0.001) {
      let askPrice = defaultPrice;
      if (hh.minimumAcceptedPrice !== null && hh.minimumAcceptedPrice !== undefined && !isNaN(Number(hh.minimumAcceptedPrice))) {
        askPrice = Math.max(minPrice, Math.min(maxPrice, Number(hh.minimumAcceptedPrice)));
      }

      offers.push({
        id: `OFFER-${hh.id}-H${String(currentHour).padStart(2, '0')}`,
        householdId: hh.id,
        householdName: hh.name,
        role: hh.role || 'prosumer',
        sellerType: hh.type || (hh.solarCapacityKW > 0 ? 'Solar Prosumer' : 'Grid Consumer'),
        solarCapacityKW: hh.solarCapacityKW || hh.capacityKW || 0,
        participantType: participantType,
        zone: zone,
        hour: currentHour,
        energyKWh: surplusKWh,
        quantityKWh: surplusKWh,
        remainingKWh: surplusKWh,
        askingPriceINR: Number(askPrice.toFixed(2)),
        isAutoTrade: hh.autoTradeEnabled !== false,
        status: 'ACTIVE',
        createdAt: Date.now()
      });
    }

    // Internal Buy Order from Grid Consumer Deficit (NO solar panels required!)
    if (deficitKWh > 0.001) {
      let maxBid = defaultPrice;
      if (hh.maximumAcceptedPrice !== null && hh.maximumAcceptedPrice !== undefined && !isNaN(Number(hh.maximumAcceptedPrice))) {
        maxBid = Math.max(minPrice, Math.min(maxPrice, Number(hh.maximumAcceptedPrice)));
      }

      bids.push({
        id: `BID-${hh.id}-H${String(currentHour).padStart(2, '0')}`,
        householdId: hh.id,
        householdName: hh.name,
        role: hh.role || 'consumer',
        participantType: participantType,
        zone: zone,
        hour: currentHour,
        energyKWh: deficitKWh,
        quantityKWh: deficitKWh,
        remainingKWh: deficitKWh,
        maxBidINR: Number(maxBid.toFixed(2)),
        isAutoTrade: hh.autoTradeEnabled !== false,
        status: 'ACTIVE',
        createdAt: Date.now()
      });
    }
  });

  return { offers, bids };
}

/**
 * Matches active seller offers and buyer bids according to Continuous Double Auction rules
 * with grid network routing, route capacity constraints, transmission losses, and wheeling charges.
 * 
 * Rules:
 * - Seller offers sorted ASCENDING by asking price (cheapest clean energy first).
 * - Buyer bids sorted DESCENDING by max bid (highest willingness-to-pay first).
 * - Compatible price condition: buyerMaxBid >= sellerAskPrice.
 * - Network route connectivity check: route between sellerZone and buyerZone must be CONNECTED.
 * - Transfer capacity check: route must have remaining transfer capacity > 0.
 * - Midpoint rule: tradePrice = (sellerAskPrice + buyerMaxBid) / 2.
 * - Traded volume: min(remainingSupply, remainingDemand, remainingRouteCapacity).
 * - Delivery loss modeled: Delivered = Injected * (1 - L).
 * - Wheeling and platform charges transparently itemized.
 * - Partial fills supported for both orders and network route capacity.
 * 
 * @param {Array} activeOffers - Array of active seller offers
 * @param {Array} activeBids - Array of active buyer bids
 * @param {number} currentHour - Current simulation hour (0-23)
 * @param {string} timestamp - Simulated timestamp string
 * @param {Object} config - Config parameters for fees and limits
 * @param {Object} networkManager - Optional GridNetworkManager instance
 * @returns {Object} { trades, updatedOffers, updatedBids, summary, rejectedTrades }
 */
function matchOrders(activeOffers, activeBids, currentHour, timestamp, config = {}, networkManager = null) {
  const network = networkManager || gridNetwork;
  const feeRate = config.platformFeePerKWh !== undefined ? Number(config.platformFeePerKWh) : 0.20;
  const gridBenchmark = Number(config.referenceImportTariff || 8.00);
  const feedInFloor = Number(config.referenceExportTariff || 2.00);

  // Clone active orders to avoid mutating caller references before execution
  const offers = activeOffers
    .filter(o => o.remainingKWh > 0.001 && o.status !== 'CANCELLED' && o.status !== 'FILLED')
    .map(o => ({ ...o }));

  const bids = activeBids
    .filter(b => b.remainingKWh > 0.001 && b.status !== 'CANCELLED' && b.status !== 'FILLED')
    .map(b => ({ ...b }));

  // Sort offers by ascending asking price (lowest ask has highest priority, then earlier timestamp)
  offers.sort((a, b) => {
    if (a.askingPriceINR !== b.askingPriceINR) {
      return a.askingPriceINR - b.askingPriceINR;
    }
    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  // Sort bids by descending max bid price (highest bid has highest priority, then earlier timestamp)
  bids.sort((a, b) => {
    if (b.maxBidINR !== a.maxBidINR) {
      return b.maxBidINR - a.maxBidINR;
    }
    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  const trades = [];
  const rejectedTrades = [];
  let offerIndex = 0;

  while (offerIndex < offers.length) {
    const currentOffer = offers[offerIndex];
    if (currentOffer.remainingKWh <= 0.001) {
      offerIndex++;
      continue;
    }

    let matchedWithBid = false;

    for (let bidIndex = 0; bidIndex < bids.length; bidIndex++) {
      const currentBid = bids[bidIndex];

      if (currentBid.remainingKWh <= 0.001) {
        continue;
      }

      // Prevent trading with oneself
      if (currentOffer.householdId === currentBid.householdId) {
        continue;
      }

      // Feasibility check: Buyer maximum bid must meet or exceed Seller asking price
      if (currentBid.maxBidINR < currentOffer.askingPriceINR) {
        // Price incompatible
        continue;
      }

      // Determine Zones
      const sellerZone = currentOffer.zone || 'ZONE-A';
      const buyerZone = currentBid.zone || 'ZONE-A';

      // Evaluate Route Availability and Capacity
      const potentialQty = Math.min(currentOffer.remainingKWh, currentBid.remainingKWh);
      const routeCheck = network.canAccommodate(sellerZone, buyerZone, potentialQty);

      if (!routeCheck.allowed) {
        rejectedTrades.push({
          sellerId: currentOffer.householdId,
          sellerName: currentOffer.householdName,
          sellerZone,
          buyerId: currentBid.householdId,
          buyerName: currentBid.householdName,
          buyerZone,
          reason: routeCheck.reason,
          message: routeCheck.message,
          requestedKWh: potentialQty,
          hour: currentHour
        });
        // Try other bids that might have alternative connected routes or local zone
        continue;
      }

      // Quantities to trade (constrained by route capacity)
      const tradeQuantityKWh = Number(Math.min(currentOffer.remainingKWh, currentBid.remainingKWh, routeCheck.maxAllowedKWh).toFixed(2));

      if (tradeQuantityKWh <= 0.001) {
        continue;
      }

      // Allocate route transfer capacity
      network.allocateCapacity(sellerZone, buyerZone, tradeQuantityKWh);

      // Transmission loss & wheeling calculations
      const metrics = network.calculateTransmissionMetrics(sellerZone, buyerZone, tradeQuantityKWh);

      // Midpoint Pricing Rule: (Seller Ask + Buyer Max Bid) / 2
      const tradePriceINR = Number(((currentOffer.askingPriceINR + currentBid.maxBidINR) / 2).toFixed(2));

      // Financial breakdown
      const grossEnergyValueINR = Number((tradeQuantityKWh * tradePriceINR).toFixed(2));
      const platformFeeINR = Number((tradeQuantityKWh * feeRate).toFixed(2));
      const wheelingFeeINR = metrics.wheelingFeeINR;

      // Transparent charges convention:
      // Seller receives gross energy value at clearing price
      const sellerEnergyRevenueINR = grossEnergyValueINR;
      const sellerNetProceedsINR = grossEnergyValueINR;

      // Buyer pays energy cost + transparent platform fee + wheeling charge
      const buyerEnergyCostINR = grossEnergyValueINR;
      const buyerTotalCostINR = Number((grossEnergyValueINR + platformFeeINR + wheelingFeeINR).toFixed(2));

      // Baseline comparison: What buyer would pay utility for delivered energy
      const utilityBaselineCostINR = Number((metrics.deliveredEnergyKWh * gridBenchmark).toFixed(2));
      const buyerSavingsINR = Number((utilityBaselineCostINR - buyerTotalCostINR).toFixed(2));
      const sellerExtraEarningsINR = Number((tradeQuantityKWh * (tradePriceINR - feedInFloor)).toFixed(2));

      const trade = {
        tradeId: generateTxId(),
        version: 2,
        simulationHour: currentHour,
        timestamp: timestamp || new Date().toISOString(),
        sellerId: currentOffer.householdId,
        sellerName: currentOffer.householdName,
        sellerZone: sellerZone,
        buyerId: currentBid.householdId,
        buyerName: currentBid.householdName,
        buyerZone: buyerZone,
        isCrossZone: metrics.isCrossZone,
        routeId: metrics.routeId,
        offerId: currentOffer.id,
        bidId: currentBid.id,
        energyKWh: tradeQuantityKWh, // Injected energy
        lossPercentage: metrics.lossPercentage,
        lossKWh: metrics.lossKWh,
        deliveredEnergyKWh: metrics.deliveredEnergyKWh,
        sellerAskINR: currentOffer.askingPriceINR,
        buyerBidINR: currentBid.maxBidINR,
        tradePriceINR,
        totalValueINR: grossEnergyValueINR,
        platformFeeINR,
        wheelingRateINRPerKWh: metrics.wheelingRateINRPerKWh,
        wheelingFeeINR,
        buyerEnergyCostINR,
        buyerTotalCostINR,
        sellerEnergyRevenueINR,
        sellerNetProceedsINR,
        sellerEarnings: sellerNetProceedsINR,
        companyTransactionRevenueINR: platformFeeINR,
        utilityComparisonCostINR: utilityBaselineCostINR,
        utilityBaselineCostINR: utilityBaselineCostINR,
        buyerSavingsINR,
        sellerExtraEarningsINR,
        gridBenchmarkTariffINR: gridBenchmark,
        feedInFloorTariffINR: feedInFloor,
        ruleId: config.ruleId || 'RULE-TN-SIM-2026-V1',
        ruleVersion: config.ruleVersion || '1.0.0',
        priceValidationResult: 'VALID',
        settlementType: 'AUTOMATED_MARKET_MATCH',
        settlementStatus: 'SETTLED',
        status: 'SETTLED'
      };

      trades.push(trade);

      // Update remaining order quantities
      currentOffer.remainingKWh = Number((currentOffer.remainingKWh - tradeQuantityKWh).toFixed(2));
      currentBid.remainingKWh = Number((currentBid.remainingKWh - tradeQuantityKWh).toFixed(2));

      if (currentOffer.remainingKWh <= 0.001) {
        currentOffer.remainingKWh = 0;
        currentOffer.status = 'FILLED';
      } else {
        currentOffer.status = 'PARTIALLY_FILLED';
      }

      if (currentBid.remainingKWh <= 0.001) {
        currentBid.remainingKWh = 0;
        currentBid.status = 'FILLED';
      } else {
        currentBid.status = 'PARTIALLY_FILLED';
      }

      matchedWithBid = true;

      // If offer is filled, break out to advance to next offer
      if (currentOffer.remainingKWh <= 0.001) {
        break;
      }
    }

    offerIndex++;
  }

  // Summary statistics
  const totalTradedKWh = Number(trades.reduce((sum, t) => sum + t.energyKWh, 0).toFixed(2));
  const totalDeliveredKWh = Number(trades.reduce((sum, t) => sum + t.deliveredEnergyKWh, 0).toFixed(2));
  const totalLossKWh = Number(trades.reduce((sum, t) => sum + t.lossKWh, 0).toFixed(2));
  const totalTradeValueINR = Number(trades.reduce((sum, t) => sum + t.totalValueINR, 0).toFixed(2));
  const totalPlatformFeesINR = Number(trades.reduce((sum, t) => sum + t.platformFeeINR, 0).toFixed(2));
  const totalWheelingFeesINR = Number(trades.reduce((sum, t) => sum + t.wheelingFeeINR, 0).toFixed(2));
  const totalBuyerSavingsINR = Number(trades.reduce((sum, t) => sum + t.buyerSavingsINR, 0).toFixed(2));
  const weightedAveragePriceINR = totalTradedKWh > 0
    ? Number((totalTradeValueINR / totalTradedKWh).toFixed(2))
    : null;

  return {
    trades,
    updatedOffers: offers,
    updatedBids: bids,
    rejectedTrades,
    summary: {
      matchedTradesCount: trades.length,
      totalTradedKWh,
      totalDeliveredKWh,
      totalLossKWh,
      totalTradeValueINR,
      totalPlatformFeesINR,
      totalWheelingFeesINR,
      totalBuyerSavingsINR,
      weightedAveragePriceINR,
      unmatchedOffersCount: offers.filter(o => o.remainingKWh > 0.001).length,
      unmatchedBidsCount: bids.filter(b => b.remainingKWh > 0.001).length,
      rejectedTradesCount: rejectedTrades.length
    }
  };
}

/**
 * Returns active seller offers ranked for an ordinary buyer.
 * Ranked primarily by lowest delivered unit cost per kWh,
 * with deterministic tie-breaking (earliest createdAt, then alphabetical ID).
 * 
 * @param {Array} offers - Active seller offers
 * @param {string} buyerZone - Zone of the buyer (e.g. 'ZONE-A')
 * @param {Object} config - Configuration options (fees, network)
 * @returns {Array} Array of ranked, itemized offer comparison objects
 */
function getRankedOffersForBuyer(offers = [], buyerZone = 'ZONE-A', config = {}) {
  const net = config.network || gridNetwork;
  const platformFeeRate = config.platformFeeINRPerKWh !== undefined ? Number(config.platformFeeINRPerKWh) : 0.20;

  const validOffers = (offers || []).filter(o => {
    return o && o.remainingKWh > 0.001 && o.status !== 'FILLED' && o.status !== 'CANCELLED';
  });

  const ranked = validOffers.map(offer => {
    const sellerZone = offer.zone || 'ZONE-A';
    const remainingKWh = Number(offer.remainingKWh.toFixed(2));
    const askingPrice = Number(offer.askingPriceINR.toFixed(2));

    const routeCheck = net.canAccommodate(sellerZone, buyerZone, remainingKWh);
    const metrics = net.calculateTransmissionMetrics(sellerZone, buyerZone, remainingKWh);

    const wheelingRate = metrics.wheelingRateINRPerKWh;
    const lossPercentage = metrics.lossPercentage;
    const lossMultiplier = Math.max(0.01, 1 - (lossPercentage / 100));

    // Delivered unit cost: total cost to receive 1 kWh of delivered electricity
    const deliveredUnitCostINR = Number(((askingPrice + platformFeeRate + wheelingRate) / lossMultiplier).toFixed(2));
    const injectedUnitCostINR = Number((askingPrice + platformFeeRate + wheelingRate).toFixed(2));

    const hh = config.households ? config.households.find(h => h.id === offer.householdId) : null;
    const solarCapacityKW = offer.solarCapacityKW !== undefined ? offer.solarCapacityKW : (hh ? (hh.solarCapacityKW || hh.capacityKW || 0) : 0);
    const sellerType = offer.sellerType || (hh ? (hh.type || (hh.role === 'prosumer' ? 'Residential Solar Prosumer' : 'Clean Energy Supplier')) : 'Residential Solar Prosumer');

    return {
      offerId: offer.id,
      sellerId: offer.householdId,
      sellerName: offer.householdName,
      sellerType,
      solarCapacityKW,
      sellerZone,
      buyerZone,
      availableKWh: remainingKWh,
      originalKWh: offer.quantityKWh || offer.energyKWh || remainingKWh,
      askingPriceINR: askingPrice,
      platformFeeINRPerKWh: platformFeeRate,
      wheelingFeeINRPerKWh: wheelingRate,
      lossPercentage,
      deliveredUnitCostINRPerKWh: deliveredUnitCostINR,
      injectedUnitCostINR: injectedUnitCostINR,
      isCrossZone: metrics.isCrossZone,
      routeId: metrics.routeId,
      isRouteAvailable: routeCheck.allowed || routeCheck.maxAllowedKWh > 0,
      maxTransferableKWh: routeCheck.maxAllowedKWh !== undefined ? routeCheck.maxAllowedKWh : remainingKWh,
      routeStatusMessage: routeCheck.allowed ? 'Route Open' : (routeCheck.message || 'Route constrained'),
      createdAt: offer.createdAt || 0
    };
  });

  // Sort: Lowest delivered unit cost first; Deterministic tie-break by earliest createdAt, then offerId
  ranked.sort((a, b) => {
    if (Math.abs(a.deliveredUnitCostINRPerKWh - b.deliveredUnitCostINRPerKWh) > 0.001) {
      return a.deliveredUnitCostINRPerKWh - b.deliveredUnitCostINRPerKWh;
    }
    if (a.createdAt !== b.createdAt) {
      return a.createdAt - b.createdAt;
    }
    return String(a.offerId).localeCompare(String(b.offerId));
  });

  return ranked;
}

/**
 * Executes a direct offer purchase for an ordinary buyer without requiring an auction bid.
/**
 * Executes a multi-seller purchase allocating energy across the lowest-cost eligible offers first.
 * Supports partial fills, multiple sellers for one buyer, route constraints, and transparent fee itemization.
 */
function executeMultiSellerPurchase({
  buyerId,
  buyerName,
  buyerZone = 'ZONE-A',
  requestedKWh,
  offers = [],
  network,
  config = {},
  timestamp,
  currentHour = 12,
  previewOnly = false
}) {
  const net = network || gridNetwork;
  const requestedQty = Number(Number(requestedKWh).toFixed(2));
  if (isNaN(requestedQty) || requestedQty <= 0) {
    return {
      success: false,
      error: 'Invalid requested purchase quantity. Must be greater than 0 kWh.'
    };
  }

  // Filter eligible offers: not belonging to buyer, remaining energy > 0, active
  const eligibleOffers = (offers || []).filter(o => {
    return o && o.householdId !== buyerId && o.remainingKWh > 0.001 && o.status !== 'CANCELLED' && o.status !== 'FILLED';
  });

  if (eligibleOffers.length === 0) {
    return {
      success: false,
      error: 'No active seller offers available in the marketplace to allocate energy from.'
    };
  }

  // Rank offers by lowest delivered unit cost
  const ranked = getRankedOffersForBuyer(eligibleOffers, buyerZone, { ...config, network: net });

  let remainingRequested = requestedQty;
  const allocations = [];
  const trades = [];
  const platformFeeRate = config.platformFeeINRPerKWh !== undefined ? Number(config.platformFeeINRPerKWh) : 0.20;
  const gridBenchmark = config.gridBenchmarkTariff !== undefined ? Number(config.gridBenchmarkTariff) : 8.00;
  const feedInFloor = config.feedInFloorTariff !== undefined ? Number(config.feedInFloorTariff) : 2.00;

  for (const item of ranked) {
    if (remainingRequested <= 0.001) break;

    const offer = eligibleOffers.find(o => o.id === item.offerId);
    if (!offer || offer.remainingKWh <= 0.001) continue;

    const sellerZone = offer.zone || 'ZONE-A';
    const neededFromOffer = Number(Math.min(remainingRequested, offer.remainingKWh).toFixed(2));

    // Check network route accommodation
    const routeCheck = net.canAccommodate(sellerZone, buyerZone, neededFromOffer);
    const maxTransferable = routeCheck.maxAllowedKWh !== undefined ? routeCheck.maxAllowedKWh : neededFromOffer;
    const allocatedKWh = Number(Math.min(neededFromOffer, maxTransferable).toFixed(2));

    if (allocatedKWh <= 0.001) continue;

    // Transmission calculations
    const metrics = net.calculateTransmissionMetrics(sellerZone, buyerZone, allocatedKWh);
    const tradePriceINR = Number(offer.askingPriceINR.toFixed(2));
    const grossEnergyValueINR = Number((allocatedKWh * tradePriceINR).toFixed(2));
    const platformFeeINR = Number((allocatedKWh * platformFeeRate).toFixed(2));
    const wheelingFeeINR = metrics.wheelingFeeINR;
    const buyerTotalCostINR = Number((grossEnergyValueINR + platformFeeINR + wheelingFeeINR).toFixed(2));
    const sellerNetProceedsINR = grossEnergyValueINR;
    const utilityBaselineCostINR = Number((metrics.deliveredEnergyKWh * gridBenchmark).toFixed(2));
    const buyerSavingsINR = Number((utilityBaselineCostINR - buyerTotalCostINR).toFixed(2));
    const sellerExtraEarningsINR = Number((allocatedKWh * (tradePriceINR - feedInFloor)).toFixed(2));

    const isOfferFilled = allocatedKWh >= offer.remainingKWh - 0.001;
    const remainingOfferAfter = Number(Math.max(0, offer.remainingKWh - allocatedKWh).toFixed(2));

    allocations.push({
      offerId: offer.id,
      sellerId: offer.householdId,
      sellerName: offer.householdName,
      sellerZone,
      buyerZone,
      allocatedKWh,
      askingPriceINR: tradePriceINR,
      energyCostINR: grossEnergyValueINR,
      platformFeeINR,
      wheelingFeeINR,
      buyerTotalCostINR,
      deliveredEnergyKWh: metrics.deliveredEnergyKWh,
      lossPercentage: metrics.lossPercentage,
      buyerSavingsINR,
      sellerNetProceedsINR,
      isOfferFilled,
      remainingOfferKWh: remainingOfferAfter
    });

    if (!previewOnly) {
      // Reserve network capacity
      net.allocateCapacity(sellerZone, buyerZone, allocatedKWh);

      // Create trade record
      const trade = {
        tradeId: generateTxId(),
        version: 2,
        simulationHour: currentHour,
        timestamp: timestamp || new Date().toISOString(),
        sellerId: offer.householdId,
        sellerName: offer.householdName,
        sellerZone,
        buyerId,
        buyerName: buyerName || `Buyer-${buyerId}`,
        buyerZone,
        isCrossZone: metrics.isCrossZone,
        routeId: metrics.routeId,
        offerId: offer.id,
        bidId: null,
        energyKWh: allocatedKWh,
        lossPercentage: metrics.lossPercentage,
        lossKWh: metrics.lossKWh,
        deliveredEnergyKWh: metrics.deliveredEnergyKWh,
        sellerAskINR: offer.askingPriceINR,
        buyerBidINR: tradePriceINR,
        tradePriceINR,
        totalValueINR: grossEnergyValueINR,
        platformFeeINR,
        wheelingRateINRPerKWh: metrics.wheelingRateINRPerKWh,
        wheelingFeeINR,
        buyerEnergyCostINR: grossEnergyValueINR,
        buyerTotalCostINR,
        sellerEnergyRevenueINR: grossEnergyValueINR,
        sellerNetProceedsINR,
        sellerEarnings: sellerNetProceedsINR,
        companyTransactionRevenueINR: platformFeeINR,
        utilityComparisonCostINR: utilityBaselineCostINR,
        utilityBaselineCostINR,
        buyerSavingsINR,
        sellerExtraEarningsINR,
        gridBenchmarkTariffINR: gridBenchmark,
        feedInFloorTariffINR: feedInFloor,
        ruleId: config.ruleId || 'RULE-TN-SIM-2026-V1',
        ruleVersion: config.ruleVersion || '1.0.0',
        priceValidationResult: 'VALID',
        settlementType: 'DIRECT_OFFER_PURCHASE',
        settlementStatus: 'SETTLED',
        status: 'SETTLED',
        partialFill: allocatedKWh < requestedQty,
        requestedKWh: requestedQty,
        allocatedKWh,
        unmetKWh: Number(Math.max(0, requestedQty - allocatedKWh).toFixed(2))
      };

      trades.push(trade);

      // Update offer state
      offer.remainingKWh = remainingOfferAfter;
      if (offer.remainingKWh <= 0.001) {
        offer.remainingKWh = 0;
        offer.status = 'FILLED';
      } else {
        offer.status = 'PARTIALLY_FILLED';
      }
    }

    remainingRequested = Number((remainingRequested - allocatedKWh).toFixed(2));
  }

  const totalAllocatedKWh = Number(allocations.reduce((s, a) => s + a.allocatedKWh, 0).toFixed(2));
  if (totalAllocatedKWh <= 0.001) {
    return {
      success: false,
      error: 'Could not allocate energy: insufficient transfer capacity or eligible supplies.'
    };
  }

  const unmetKWh = Number(Math.max(0, requestedQty - totalAllocatedKWh).toFixed(2));
  const isPartialFill = unmetKWh > 0.001;
  const totalEnergyCostINR = Number(allocations.reduce((s, a) => s + a.energyCostINR, 0).toFixed(2));
  const totalPlatformFeeINR = Number(allocations.reduce((s, a) => s + a.platformFeeINR, 0).toFixed(2));
  const totalWheelingFeeINR = Number(allocations.reduce((s, a) => s + a.wheelingFeeINR, 0).toFixed(2));
  const totalBuyerCostINR = Number((totalEnergyCostINR + totalPlatformFeeINR + totalWheelingFeeINR).toFixed(2));
  const totalDeliveredEnergyKWh = Number(allocations.reduce((s, a) => s + a.deliveredEnergyKWh, 0).toFixed(2));
  const totalDiscomBaselineINR = Number((totalDeliveredEnergyKWh * gridBenchmark).toFixed(2));
  const totalBuyerSavingsINR = Number((totalDiscomBaselineINR - totalBuyerCostINR).toFixed(2));

  const explanation = allocations.length > 1
    ? `Allocated ${totalAllocatedKWh} kWh across ${allocations.length} prosumers (${allocations.map(a => `${a.sellerName}: ${a.allocatedKWh} kWh @ ₹${a.askingPriceINR.toFixed(2)}`).join(', ')}). Energy cost: ₹${totalEnergyCostINR.toFixed(2)}.`
    : `Allocated ${totalAllocatedKWh} kWh from ${allocations[0].sellerName} at ₹${allocations[0].askingPriceINR.toFixed(2)}/kWh. Energy cost: ₹${totalEnergyCostINR.toFixed(2)}.`;

  return {
    success: true,
    previewOnly,
    requestedKWh: requestedQty,
    allocatedKWh: totalAllocatedKWh,
    unmetKWh,
    partialFill: isPartialFill,
    totalEnergyCostINR,
    totalPlatformFeeINR,
    totalWheelingFeeINR,
    totalBuyerCostINR,
    totalDeliveredEnergyKWh,
    totalDiscomBaselineINR,
    totalBuyerSavingsINR,
    allocations,
    trades,
    trade: trades.length === 1 ? trades[0] : (trades[0] || null),
    explanation
  };
}

/**
 * Executes a direct offer purchase for an ordinary buyer without requiring an auction bid.
 * Handles partial fills, route capacity checks, fee calculations, and transaction records.
 * Supports single offer ID or multi-seller auto allocation when offerId is omitted or 'AUTO'.
 * 
 * @param {Object} params - Purchase parameters
 * @returns {Object} Purchase result with trade record and allocation status
 */
function executeDirectPurchase({
  buyerId,
  buyerName,
  buyerZone = 'ZONE-A',
  offerId,
  requestedKWh,
  offers = [],
  network,
  config = {},
  timestamp,
  currentHour = 12,
  previewOnly = false
}) {
  const net = network || gridNetwork;

  // If no specific offerId is specified, or set to 'AUTO' or 'SMART_ALLOCATE', execute multi-seller purchase
  if (!offerId || offerId === 'AUTO' || offerId === 'SMART_ALLOCATE') {
    return executeMultiSellerPurchase({
      buyerId,
      buyerName,
      buyerZone,
      requestedKWh,
      offers,
      network: net,
      config,
      timestamp,
      currentHour,
      previewOnly
    });
  }

  const offer = offers.find(o => o.id === offerId);

  if (!offer || offer.remainingKWh <= 0.001) {
    return {
      success: false,
      error: `Offer ${offerId} is not available or has already been fully allocated.`
    };
  }

  if (offer.householdId === buyerId) {
    return {
      success: false,
      error: 'Self-trading is not permitted. You cannot purchase energy from your own offer.'
    };
  }

  const requestedQty = Number(Number(requestedKWh).toFixed(2));
  if (isNaN(requestedQty) || requestedQty <= 0) {
    return {
      success: false,
      error: 'Invalid requested purchase quantity. Must be greater than 0 kWh.'
    };
  }

  const sellerZone = offer.zone || 'ZONE-A';
  const potentialQty = Number(Math.min(requestedQty, offer.remainingKWh).toFixed(2));

  // Network route feasibility
  const routeCheck = net.canAccommodate(sellerZone, buyerZone, potentialQty);
  if (!routeCheck.allowed && routeCheck.maxAllowedKWh <= 0.001) {
    return {
      success: false,
      error: `Network route constraint: ${routeCheck.message || 'Transfer capacity unavailable'}`,
      reason: routeCheck.reason
    };
  }

  // Allocate allowable quantity (constrained by supply and network route capacity)
  const allocatedKWh = Number(Math.min(potentialQty, routeCheck.maxAllowedKWh).toFixed(2));
  if (allocatedKWh <= 0.001) {
    return {
      success: false,
      error: 'Available route capacity is insufficient to transfer any energy at this time.'
    };
  }

  const unmetKWh = Number(Math.max(0, requestedQty - allocatedKWh).toFixed(2));
  const isPartialFill = unmetKWh > 0.001;
  const explanation = isPartialFill
    ? `Partial allocation: Requested ${requestedQty} kWh, but allocated ${allocatedKWh} kWh due to supply/route transfer limits. Unmet demand: ${unmetKWh} kWh.`
    : `Full allocation: ${allocatedKWh} kWh successfully purchased at ₹${offer.askingPriceINR.toFixed(2)}/kWh.`;

  // Transmission calculations
  const metrics = net.calculateTransmissionMetrics(sellerZone, buyerZone, allocatedKWh);
  const platformFeeRate = config.platformFeeINRPerKWh !== undefined ? Number(config.platformFeeINRPerKWh) : 0.20;
  const gridBenchmark = config.gridBenchmarkTariff !== undefined ? Number(config.gridBenchmarkTariff) : 7.50;
  const feedInFloor = config.feedInFloorTariff !== undefined ? Number(config.feedInFloorTariff) : 3.10;

  const tradePriceINR = Number(offer.askingPriceINR.toFixed(2));
  const grossEnergyValueINR = Number((allocatedKWh * tradePriceINR).toFixed(2));
  const platformFeeINR = Number((allocatedKWh * platformFeeRate).toFixed(2));
  const wheelingFeeINR = metrics.wheelingFeeINR;
  const buyerTotalCostINR = Number((grossEnergyValueINR + platformFeeINR + wheelingFeeINR).toFixed(2));
  const sellerNetProceedsINR = grossEnergyValueINR;
  const utilityBaselineCostINR = Number((metrics.deliveredEnergyKWh * gridBenchmark).toFixed(2));
  const buyerSavingsINR = Number((utilityBaselineCostINR - buyerTotalCostINR).toFixed(2));
  const sellerExtraEarningsINR = Number((allocatedKWh * (tradePriceINR - feedInFloor)).toFixed(2));

  const allocations = [{
    offerId: offer.id,
    sellerId: offer.householdId,
    sellerName: offer.householdName,
    sellerZone,
    buyerZone,
    allocatedKWh,
    askingPriceINR: tradePriceINR,
    energyCostINR: grossEnergyValueINR,
    platformFeeINR,
    wheelingFeeINR,
    buyerTotalCostINR,
    deliveredEnergyKWh: metrics.deliveredEnergyKWh,
    lossPercentage: metrics.lossPercentage,
    buyerSavingsINR,
    sellerNetProceedsINR,
    isOfferFilled: allocatedKWh >= offer.remainingKWh - 0.001,
    remainingOfferKWh: Number(Math.max(0, offer.remainingKWh - allocatedKWh).toFixed(2))
  }];

  if (previewOnly) {
    return {
      success: true,
      previewOnly: true,
      requestedKWh: requestedQty,
      allocatedKWh,
      unmetKWh,
      partialFill: isPartialFill,
      totalEnergyCostINR: grossEnergyValueINR,
      totalPlatformFeeINR: platformFeeINR,
      totalWheelingFeeINR: wheelingFeeINR,
      totalBuyerCostINR,
      totalDeliveredEnergyKWh: metrics.deliveredEnergyKWh,
      totalDiscomBaselineINR: utilityBaselineCostINR,
      totalBuyerSavingsINR: buyerSavingsINR,
      allocations,
      trades: [],
      trade: null,
      explanation
    };
  }

  // Reserve capacity on network
  net.allocateCapacity(sellerZone, buyerZone, allocatedKWh);

  const trade = {
    tradeId: generateTxId(),
    version: 2,
    simulationHour: currentHour,
    timestamp: timestamp || new Date().toISOString(),
    sellerId: offer.householdId,
    sellerName: offer.householdName,
    sellerZone: sellerZone,
    buyerId,
    buyerName: buyerName || `Buyer-${buyerId}`,
    buyerZone: buyerZone,
    isCrossZone: metrics.isCrossZone,
    routeId: metrics.routeId,
    offerId: offer.id,
    bidId: null,
    energyKWh: allocatedKWh,
    lossPercentage: metrics.lossPercentage,
    lossKWh: metrics.lossKWh,
    deliveredEnergyKWh: metrics.deliveredEnergyKWh,
    sellerAskINR: offer.askingPriceINR,
    buyerBidINR: tradePriceINR,
    tradePriceINR,
    totalValueINR: grossEnergyValueINR,
    platformFeeINR,
    wheelingRateINRPerKWh: metrics.wheelingRateINRPerKWh,
    wheelingFeeINR,
    buyerEnergyCostINR: grossEnergyValueINR,
    buyerTotalCostINR,
    sellerEnergyRevenueINR: grossEnergyValueINR,
    sellerNetProceedsINR,
    sellerEarnings: sellerNetProceedsINR,
    companyTransactionRevenueINR: platformFeeINR,
    utilityComparisonCostINR: utilityBaselineCostINR,
    utilityBaselineCostINR: utilityBaselineCostINR,
    buyerSavingsINR,
    sellerExtraEarningsINR,
    gridBenchmarkTariffINR: gridBenchmark,
    feedInFloorTariffINR: feedInFloor,
    ruleId: config.ruleId || 'RULE-TN-SIM-2026-V1',
    ruleVersion: config.ruleVersion || '1.0.0',
    priceValidationResult: 'VALID',
    settlementType: 'DIRECT_OFFER_PURCHASE',
    settlementStatus: 'SETTLED',
    status: 'SETTLED',
    partialFill: isPartialFill,
    requestedKWh: requestedQty,
    allocatedKWh,
    unmetKWh,
    allocationExplanation: explanation
  };

  // Update offer inventory
  offer.remainingKWh = Number(Math.max(0, offer.remainingKWh - allocatedKWh).toFixed(2));
  if (offer.remainingKWh <= 0.001) {
    offer.remainingKWh = 0;
    offer.status = 'FILLED';
  } else {
    offer.status = 'PARTIALLY_FILLED';
  }

  return {
    success: true,
    trade,
    trades: [trade],
    allocations,
    partialFill: isPartialFill,
    requestedKWh: requestedQty,
    allocatedKWh,
    unmetKWh,
    totalEnergyCostINR: grossEnergyValueINR,
    totalPlatformFeeINR: platformFeeINR,
    totalWheelingFeeINR: wheelingFeeINR,
    totalBuyerCostINR: buyerTotalCostINR,
    totalDeliveredEnergyKWh: metrics.deliveredEnergyKWh,
    totalDiscomBaselineINR: utilityBaselineCostINR,
    totalBuyerSavingsINR: buyerSavingsINR,
    explanation,
    updatedOffer: offer
  };
}

module.exports = {
  generateInternalOrders,
  matchOrders,
  getRankedOffersForBuyer,
  executeDirectPurchase,
  executeMultiSellerPurchase
};
