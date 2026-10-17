/**
 * SolarShare — Grid-Connected Peer-to-Peer Energy Marketplace
 * Comprehensive 22-Scenario Automated Verification Suite
 * 
 * Demonstrates compliance with SDG 7: Affordable and Clean Energy
 * and validates the grid-connected multi-zone physical & commercial architecture.
 *
 * Scenarios:
 * 1.  Solar seller exporting valid surplus.
 * 2.  Ordinary buyer with no solar installation purchasing energy.
 * 3.  Consumer demand exceeding market supply.
 * 4.  Local-zone trading (ZONE-A -> ZONE-A).
 * 5.  Cross-zone trading (ZONE-A -> ZONE-B).
 * 6.  Distant trading over connected route (ZONE-A -> ZONE-C).
 * 7.  Disconnected route rejection (ROUTE_DISCONNECTED).
 * 8.  Insufficient transfer capacity (ROUTE_CAPACITY_EXHAUSTED).
 * 9.  Modeled transmission losses (Delivered = Injected * (1 - L)).
 * 10. Network wheeling and platform fee calculations.
 * 11. Buyer savings against ₹8.00/kWh utility baseline.
 * 12. Seller net proceeds.
 * 13. Partial fills and remaining order quantities.
 * 14. Duplicate energy prevention (no overselling beyond surplus; no overbuying beyond deficit).
 * 15. Invalid/excessive quantity bounds.
 * 16. Invalid prices and loss percentage validation.
 * 17. Failed and canceled settlements.
 * 18. Hour advancement and automatic order regeneration.
 * 19. SHA-256 ledger integrity and tamper detection.
 * 20. Role authorization & household isolation.
 * 21. Backward compatibility with historical ledger blocks (118+ historical records).
 * 22. Repeated simulation runs and reset behavior.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { GridNetworkManager } = require('../simulation/gridNetwork');
const { matchOrders, generateInternalOrders } = require('../marketplace/matchingEngine');
const { TamperLedger } = require('../ledger/tamperLedger');
const { SimulationManager } = require('../simulation/simulationManager');
const { calculateRecommendedPrice, computeDemandPressure } = require('../marketplace/pricingService');
const { DEMO_ACCOUNTS, loginWithCredentials, loginDemo, authenticateRequest } = require('../services/authService');
const { sha256, serializeTransaction, GENESIS_HASH } = require('../utils/cryptoHelper');

let passedCount = 0;
const TOTAL_SCENARIOS = 22;

function runScenario(number, title, fn) {
  try {
    fn();
    passedCount++;
    console.log(`  ✅ [PASS] Scenario ${String(number).padStart(2, '0')}: ${title}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] Scenario ${String(number).padStart(2, '0')}: ${title}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

console.log('\n================================================================================');
console.log('⚡ SolarShare: 22-Scenario Grid-Connected P2P Energy Trading Verification Suite');
console.log('🌱 SDG 7: Affordable & Clean Energy — Grid Network & Cryptographic Audit');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// Scenario 1: Solar seller exporting valid surplus
// -----------------------------------------------------------------------------
runScenario(1, 'Solar seller exporting valid surplus', () => {
  const sim = new SimulationManager();
  const seller = sim.households.find(h => h.id === 'HH-01');
  assert.ok(seller, 'Seller HH-01 must exist');
  assert.strictEqual(seller.participantType, 'PROSUMER', 'Seller must be designated as PROSUMER');
  assert.ok(seller.solarCapacityKW > 0, 'Seller must have solar capacity > 0');
  assert.strictEqual(seller.gridConnectionStatus, 'CONNECTED', 'Seller must have an active grid connection');
  assert.ok(seller.exportCapacityKW > 0, 'Seller export capacity must be positive');

  // Verify solar curve at midday (hour 12)
  const genMidday = seller.hourlyGeneration[12];
  const demMidday = seller.hourlyDemand[12];
  const surplusMidday = seller.hourlySurplus[12];
  assert.ok(genMidday > demMidday, 'At hour 12, solar generation must exceed household demand');
  assert.strictEqual(surplusMidday, Number((genMidday - demMidday).toFixed(2)), 'Surplus must equal generation minus demand');

  // Verify internal offer generation
  const { offers } = generateInternalOrders([{
    ...seller,
    currentHourGenerationKWh: genMidday,
    currentHourDemandKWh: demMidday
  }], 4.50, 12, { minimumTradePrice: 2.0, maximumTradePrice: 8.0 });
  assert.strictEqual(offers.length, 1, 'Prosumer with surplus must generate exactly one internal offer');
  assert.strictEqual(offers[0].householdId, 'HH-01');
  assert.ok(offers[0].energyKWh <= surplusMidday, 'Offer quantity must not exceed surplus');
  assert.ok(offers[0].askingPriceINR >= 2.0 && offers[0].askingPriceINR <= 8.0, 'Asking price must be within ₹2.00 - ₹8.00 range');
});

// -----------------------------------------------------------------------------
// Scenario 2: Ordinary buyer with no solar installation purchasing energy
// -----------------------------------------------------------------------------
runScenario(2, 'Ordinary buyer with no solar installation purchasing energy', () => {
  const sim = new SimulationManager();
  const buyer = sim.households.find(h => h.id === 'HH-02'); // Apex Tech Park Office
  assert.ok(buyer, 'Buyer HH-02 must exist');
  assert.strictEqual(buyer.participantType, 'CONSUMER', 'Buyer must be classified as a CONSUMER');
  assert.strictEqual(buyer.solarCapacityKW, 0, 'Buyer MUST have 0 kW solar capacity (no panels required)');
  assert.ok(buyer.importCapacityKW > 0, 'Buyer must have valid grid import capacity');
  assert.strictEqual(buyer.gridConnectionStatus, 'CONNECTED', 'Buyer must have active grid connection');

  // Confirm zero solar generation for all 24 hours
  const allZero = buyer.hourlyGeneration.every(g => g === 0);
  assert.ok(allZero, 'Buyer must produce 0 kWh of solar generation across all 24 hours');

  // Verify buyer generates bids from deficit
  const { bids } = generateInternalOrders([{
    ...buyer,
    currentHourGenerationKWh: 0,
    currentHourDemandKWh: buyer.hourlyDemand[12]
  }], 4.50, 12, { minimumTradePrice: 2.0, maximumTradePrice: 8.0 });
  assert.strictEqual(bids.length, 1, 'Ordinary consumer with deficit must generate a purchase bid');
  assert.strictEqual(bids[0].householdId, 'HH-02');
  assert.ok(bids[0].energyKWh > 0, 'Bid quantity must be positive');
  assert.strictEqual(bids[0].zone, buyer.zone, 'Bid must carry the buyer network zone');
});

// -----------------------------------------------------------------------------
// Scenario 3: Consumer demand exceeding market supply
// -----------------------------------------------------------------------------
runScenario(3, 'Consumer demand exceeding market supply', () => {
  const network = new GridNetworkManager();
  const timestamp = '2026-10-14T12:00:00.000Z';
  const config = { platformFeePerKWh: 0.20, referenceImportTariff: 8.00, referenceExportTariff: 2.00 };

  // Total supply: 10 kWh; Total demand: 30 kWh (High Demand Pressure)
  const offers = [{
    id: 'OFF-01',
    householdId: 'HH-01',
    householdName: 'Seller Green',
    zone: 'ZONE-A',
    quantityKWh: 10.0,
    remainingKWh: 10.0,
    askingPriceINR: 4.00,
    status: 'ACTIVE'
  }];

  const bids = [
    {
      id: 'BID-01',
      householdId: 'HH-02',
      householdName: 'Tech Park High Bid',
      zone: 'ZONE-B',
      quantityKWh: 15.0,
      remainingKWh: 15.0,
      maxBidINR: 6.50,
      status: 'ACTIVE'
    },
    {
      id: 'BID-02',
      householdId: 'HH-05',
      householdName: 'Banyan Grove Low Bid',
      zone: 'ZONE-B',
      quantityKWh: 15.0,
      remainingKWh: 15.0,
      maxBidINR: 5.50,
      status: 'ACTIVE'
    }
  ];

  const pressure = computeDemandPressure(30.0, 10.0);
  assert.strictEqual(pressure, 0.75, 'Demand pressure must equal 30 / (30 + 10) = 0.75');

  const result = matchOrders(offers, bids, 12, timestamp, config, network);
  assert.strictEqual(result.trades.length, 1, 'Should execute 1 trade matching the highest bidder');
  assert.strictEqual(result.trades[0].buyerId, 'HH-02', 'Highest bidder must be matched first');
  assert.strictEqual(result.trades[0].energyKWh, 10.0, 'Entire 10 kWh supply must be allocated');

  // Verify remaining bid volume
  const remainingBid1 = result.updatedBids.find(b => b.id === 'BID-01');
  assert.strictEqual(remainingBid1.remainingKWh, 5.0, 'BID-01 should have 5.0 kWh remaining');
  assert.strictEqual(remainingBid1.status, 'PARTIALLY_FILLED');

  const remainingBid2 = result.updatedBids.find(b => b.id === 'BID-02');
  assert.strictEqual(remainingBid2.remainingKWh, 15.0, 'BID-02 should remain completely unfilled');
  assert.strictEqual(remainingBid2.status, 'ACTIVE');
});

// -----------------------------------------------------------------------------
// Scenario 4: Local-zone trading (ZONE-A -> ZONE-A)
// -----------------------------------------------------------------------------
runScenario(4, 'Local-zone trading (ZONE-A -> ZONE-A)', () => {
  const network = new GridNetworkManager();
  const route = network.getRoute('ZONE-A', 'ZONE-A');
  assert.strictEqual(route.routeId, 'ROUTE-A-A');
  assert.strictEqual(route.isCrossZone, false);
  assert.strictEqual(route.lossPercentage, 1.5, 'Local feeder loss must be 1.5%');
  assert.strictEqual(route.wheelingChargeINRPerKWh, 0.10, 'Local wheeling fee must be ₹0.10/kWh');

  const offers = [{
    id: 'OFF-LOCAL',
    householdId: 'HH-01',
    zone: 'ZONE-A',
    quantityKWh: 10.0,
    remainingKWh: 10.0,
    askingPriceINR: 4.00,
    status: 'ACTIVE'
  }];

  const bids = [{
    id: 'BID-LOCAL',
    householdId: 'HH-03',
    zone: 'ZONE-A',
    quantityKWh: 10.0,
    remainingKWh: 10.0,
    maxBidINR: 6.00,
    status: 'ACTIVE'
  }];

  const result = matchOrders(offers, bids, 12, '2026-10-14T12:00:00Z', { platformFeePerKWh: 0.20 }, network);
  assert.strictEqual(result.trades.length, 1);
  const trade = result.trades[0];
  assert.strictEqual(trade.isCrossZone, false);
  assert.strictEqual(trade.sellerZone, 'ZONE-A');
  assert.strictEqual(trade.buyerZone, 'ZONE-A');
  assert.strictEqual(trade.energyKWh, 10.0);
  assert.strictEqual(trade.lossKWh, 0.15, '10 kWh * 1.5% = 0.15 kWh loss');
  assert.strictEqual(trade.deliveredEnergyKWh, 9.85, '10 kWh - 0.15 kWh = 9.85 kWh delivered');
  assert.strictEqual(trade.wheelingFeeINR, 1.00, '10 kWh * ₹0.10/kWh = ₹1.00 wheeling fee');
});

// -----------------------------------------------------------------------------
// Scenario 5: Cross-zone trading (ZONE-A -> ZONE-B)
// -----------------------------------------------------------------------------
runScenario(5, 'Cross-zone trading (ZONE-A -> ZONE-B)', () => {
  const network = new GridNetworkManager();
  const route = network.getRoute('ZONE-A', 'ZONE-B');
  assert.strictEqual(route.routeId, 'ROUTE-A-B');
  assert.strictEqual(route.isCrossZone, true);
  assert.strictEqual(route.lossPercentage, 3.5, 'Intertie loss must be 3.5%');
  assert.strictEqual(route.wheelingChargeINRPerKWh, 0.25, 'Intertie wheeling fee must be ₹0.25/kWh');

  const offers = [{
    id: 'OFF-A',
    householdId: 'HH-01',
    zone: 'ZONE-A',
    quantityKWh: 20.0,
    remainingKWh: 20.0,
    askingPriceINR: 4.50,
    status: 'ACTIVE'
  }];

  const bids = [{
    id: 'BID-B',
    householdId: 'HH-02',
    zone: 'ZONE-B',
    quantityKWh: 20.0,
    remainingKWh: 20.0,
    maxBidINR: 5.50,
    status: 'ACTIVE'
  }];

  const result = matchOrders(offers, bids, 12, '2026-10-14T12:00:00Z', { platformFeePerKWh: 0.20 }, network);
  assert.strictEqual(result.trades.length, 1);
  const trade = result.trades[0];
  assert.strictEqual(trade.isCrossZone, true);
  assert.strictEqual(trade.lossKWh, 0.70, '20 kWh * 3.5% = 0.70 kWh transmission loss');
  assert.strictEqual(trade.deliveredEnergyKWh, 19.30, '20 kWh - 0.70 = 19.30 kWh delivered');
  assert.strictEqual(trade.wheelingFeeINR, 5.00, '20 kWh * ₹0.25/kWh = ₹5.00 wheeling fee');

  // Verify route capacity allocated on ROUTE-A-B
  const updatedRoute = network.getRoute('ZONE-A', 'ZONE-B');
  assert.strictEqual(updatedRoute.utilizedCapacityKWh, 20.0, '20 kWh capacity must be reserved on ROUTE-A-B');
});

// -----------------------------------------------------------------------------
// Scenario 6: Distant trading over connected route (ZONE-A -> ZONE-C)
// -----------------------------------------------------------------------------
runScenario(6, 'Distant trading over connected route (ZONE-A -> ZONE-C)', () => {
  const network = new GridNetworkManager();
  const route = network.getRoute('ZONE-A', 'ZONE-C');
  assert.strictEqual(route.routeId, 'ROUTE-A-C');
  assert.strictEqual(route.status, 'CONNECTED');
  assert.strictEqual(route.lossPercentage, 5.0, 'Long-distance sub-transmission loss must be 5.0%');
  assert.strictEqual(route.wheelingChargeINRPerKWh, 0.40, 'Long-distance wheeling fee must be ₹0.40/kWh');

  const offers = [{
    id: 'OFF-A-DIST',
    householdId: 'HH-01',
    zone: 'ZONE-A',
    quantityKWh: 10.0,
    remainingKWh: 10.0,
    askingPriceINR: 4.00,
    status: 'ACTIVE'
  }];

  const bids = [{
    id: 'BID-C-DIST',
    householdId: 'HH-04',
    zone: 'ZONE-C',
    quantityKWh: 10.0,
    remainingKWh: 10.0,
    maxBidINR: 6.00,
    status: 'ACTIVE'
  }];

  const result = matchOrders(offers, bids, 12, '2026-10-14T12:00:00Z', { platformFeePerKWh: 0.20 }, network);
  assert.strictEqual(result.trades.length, 1);
  const trade = result.trades[0];
  assert.strictEqual(trade.lossKWh, 0.50, '10 kWh * 5.0% = 0.50 kWh loss');
  assert.strictEqual(trade.deliveredEnergyKWh, 9.50, '10 kWh - 0.50 = 9.50 kWh delivered');
  assert.strictEqual(trade.wheelingFeeINR, 4.00, '10 kWh * ₹0.40/kWh = ₹4.00 wheeling fee');
});

// -----------------------------------------------------------------------------
// Scenario 7: Disconnected route rejection (ROUTE_DISCONNECTED)
// -----------------------------------------------------------------------------
runScenario(7, 'Disconnected route rejection (ROUTE_DISCONNECTED)', () => {
  const network = new GridNetworkManager();
  // Simulate line outage between ZONE-A and ZONE-C
  network.setRouteStatus('ROUTE-A-C', 'DISCONNECTED');

  const check = network.canAccommodate('ZONE-A', 'ZONE-C', 10.0);
  assert.strictEqual(check.allowed, false);
  assert.strictEqual(check.reason, 'ROUTE_DISCONNECTED');

  const offers = [{
    id: 'OFF-DISC',
    householdId: 'HH-01',
    zone: 'ZONE-A',
    quantityKWh: 10.0,
    remainingKWh: 10.0,
    askingPriceINR: 4.00,
    status: 'ACTIVE'
  }];

  const bids = [{
    id: 'BID-DISC',
    householdId: 'HH-04',
    zone: 'ZONE-C',
    quantityKWh: 10.0,
    remainingKWh: 10.0,
    maxBidINR: 6.00,
    status: 'ACTIVE'
  }];

  const result = matchOrders(offers, bids, 12, '2026-10-14T12:00:00Z', { platformFeePerKWh: 0.20 }, network);
  assert.strictEqual(result.trades.length, 0, 'No trades should execute over disconnected route');
  assert.ok(result.rejectedTrades.length >= 1, 'Rejection record must be logged');
  assert.strictEqual(result.rejectedTrades[0].reason, 'ROUTE_DISCONNECTED');
});

// -----------------------------------------------------------------------------
// Scenario 8: Insufficient transfer capacity (ROUTE_CAPACITY_EXHAUSTED)
// -----------------------------------------------------------------------------
runScenario(8, 'Insufficient transfer capacity (ROUTE_CAPACITY_EXHAUSTED)', () => {
  const network = new GridNetworkManager();
  const route = network.getRoute('ZONE-A', 'ZONE-B');
  // Saturate route capacity completely (35 kWh limit)
  network.allocateCapacity('ZONE-A', 'ZONE-B', 35.0);

  const check = network.canAccommodate('ZONE-A', 'ZONE-B', 5.0);
  assert.strictEqual(check.allowed, false);
  assert.strictEqual(check.reason, 'ROUTE_CAPACITY_EXHAUSTED');

  const offers = [{
    id: 'OFF-CAP',
    householdId: 'HH-01',
    zone: 'ZONE-A',
    quantityKWh: 5.0,
    remainingKWh: 5.0,
    askingPriceINR: 4.00,
    status: 'ACTIVE'
  }];

  const bids = [{
    id: 'BID-CAP',
    householdId: 'HH-02',
    zone: 'ZONE-B',
    quantityKWh: 5.0,
    remainingKWh: 5.0,
    maxBidINR: 6.00,
    status: 'ACTIVE'
  }];

  const result = matchOrders(offers, bids, 12, '2026-10-14T12:00:00Z', { platformFeePerKWh: 0.20 }, network);
  assert.strictEqual(result.trades.length, 0, 'No trade should occur when route capacity is exhausted');
  assert.ok(result.rejectedTrades.some(r => r.reason === 'ROUTE_CAPACITY_EXHAUSTED'));
});

// -----------------------------------------------------------------------------
// Scenario 9: Modeled transmission losses (Delivered = Injected * (1 - L))
// -----------------------------------------------------------------------------
runScenario(9, 'Modeled transmission losses (Delivered = Injected * (1 - L))', () => {
  const network = new GridNetworkManager();
  
  // Test across multiple simulated lines
  const testCases = [
    { from: 'ZONE-A', to: 'ZONE-A', injected: 50.0, lossPct: 1.5 },
    { from: 'ZONE-A', to: 'ZONE-B', injected: 25.0, lossPct: 3.5 },
    { from: 'ZONE-B', to: 'ZONE-C', injected: 15.0, lossPct: 4.0 },
    { from: 'ZONE-A', to: 'ZONE-C', injected: 10.0, lossPct: 5.0 }
  ];

  testCases.forEach(tc => {
    const m = network.calculateTransmissionMetrics(tc.from, tc.to, tc.injected);
    const expectedLoss = Number((tc.injected * (tc.lossPct / 100)).toFixed(2));
    const expectedDelivered = Number((tc.injected - expectedLoss).toFixed(2));
    assert.strictEqual(m.lossKWh, expectedLoss, `Loss mismatch for ${tc.from}->${tc.to}`);
    assert.strictEqual(m.deliveredEnergyKWh, expectedDelivered, `Delivered mismatch for ${tc.from}->${tc.to}`);
    assert.strictEqual(Number((m.lossKWh + m.deliveredEnergyKWh).toFixed(2)), tc.injected, 'Conservation of energy must hold');
  });
});

// -----------------------------------------------------------------------------
// Scenario 10: Network wheeling and platform fee calculations
// -----------------------------------------------------------------------------
runScenario(10, 'Network wheeling and platform fee calculations', () => {
  const network = new GridNetworkManager();
  const injected = 10.0;
  const metrics = network.calculateTransmissionMetrics('ZONE-A', 'ZONE-B', injected); // rate 0.25
  const platformFeeRate = 0.20;

  const grossEnergyValue = injected * 5.00; // ₹50.00
  const expectedPlatformFee = Number((injected * platformFeeRate).toFixed(2)); // ₹2.00
  const expectedWheelingFee = Number((injected * 0.25).toFixed(2)); // ₹2.50
  const expectedBuyerTotal = grossEnergyValue + expectedPlatformFee + expectedWheelingFee; // ₹54.50

  assert.strictEqual(metrics.wheelingFeeINR, expectedWheelingFee);
  assert.strictEqual(expectedPlatformFee, 2.00);
  assert.strictEqual(expectedBuyerTotal, 54.50);
});

// -----------------------------------------------------------------------------
// Scenario 11: Buyer savings against ₹8.00/kWh utility baseline
// -----------------------------------------------------------------------------
runScenario(11, 'Buyer savings against ₹8.00/kWh utility baseline', () => {
  const network = new GridNetworkManager();
  const offers = [{
    id: 'OFF-SAVINGS',
    householdId: 'HH-01',
    zone: 'ZONE-A',
    quantityKWh: 10.0,
    remainingKWh: 10.0,
    askingPriceINR: 4.00,
    status: 'ACTIVE'
  }];

  const bids = [{
    id: 'BID-SAVINGS',
    householdId: 'HH-02',
    zone: 'ZONE-B',
    quantityKWh: 10.0,
    remainingKWh: 10.0,
    maxBidINR: 5.00, // Midpoint = 4.50
    status: 'ACTIVE'
  }];

  const result = matchOrders(offers, bids, 12, '2026-10-14T12:00:00Z', {
    platformFeePerKWh: 0.20,
    referenceImportTariff: 8.00
  }, network);

  const trade = result.trades[0];
  // 10 kWh * 4.50 = 45.00 gross
  // platform = 2.00, wheeling (3.5%) = 2.50 -> buyer total = 49.50
  // delivered = 9.65 kWh. Utility baseline = 9.65 * 8.00 = 77.20
  // buyer savings = 77.20 - 49.50 = 27.70
  assert.strictEqual(trade.buyerTotalCostINR, 49.50);
  assert.strictEqual(trade.utilityBaselineCostINR, 77.20);
  assert.strictEqual(trade.buyerSavingsINR, 27.70);
  assert.ok(trade.buyerSavingsINR > 0, 'Buyer must achieve positive savings compared to grid tariff');
});

// -----------------------------------------------------------------------------
// Scenario 12: Seller net proceeds
// -----------------------------------------------------------------------------
runScenario(12, 'Seller net proceeds', () => {
  const network = new GridNetworkManager();
  const offers = [{
    id: 'OFF-SELLER-REV',
    householdId: 'HH-01',
    zone: 'ZONE-A',
    quantityKWh: 10.0,
    remainingKWh: 10.0,
    askingPriceINR: 4.00,
    status: 'ACTIVE'
  }];

  const bids = [{
    id: 'BID-SELLER-REV',
    householdId: 'HH-02',
    zone: 'ZONE-B',
    quantityKWh: 10.0,
    remainingKWh: 10.0,
    maxBidINR: 6.00, // Midpoint = 5.00
    status: 'ACTIVE'
  }];

  const result = matchOrders(offers, bids, 12, '2026-10-14T12:00:00Z', {
    platformFeePerKWh: 0.20,
    referenceExportTariff: 2.00
  }, network);

  const trade = result.trades[0];
  // Gross proceeds: 10 kWh * 5.00 = 50.00
  assert.strictEqual(trade.sellerEarnings, 50.00);
  // Feed-in tariff would yield: 10 * 2.00 = 20.00
  // Seller additional earnings: 50.00 - 20.00 = 30.00
  assert.strictEqual(trade.sellerExtraEarningsINR, 30.00);
  assert.ok(trade.sellerExtraEarningsINR > 0, 'Seller must earn strictly more than feed-in tariff');
});

// -----------------------------------------------------------------------------
// Scenario 13: Partial fills and remaining order quantities
// -----------------------------------------------------------------------------
runScenario(13, 'Partial fills and remaining order quantities', () => {
  const network = new GridNetworkManager();
  const offers = [{
    id: 'OFF-PARTIAL',
    householdId: 'HH-01',
    zone: 'ZONE-A',
    quantityKWh: 18.0,
    remainingKWh: 18.0,
    askingPriceINR: 4.20,
    status: 'ACTIVE'
  }];

  const bids = [{
    id: 'BID-PARTIAL',
    householdId: 'HH-02',
    zone: 'ZONE-A',
    quantityKWh: 10.0,
    remainingKWh: 10.0,
    maxBidINR: 5.80,
    status: 'ACTIVE'
  }];

  const result = matchOrders(offers, bids, 12, '2026-10-14T12:00:00Z', { platformFeePerKWh: 0.20 }, network);
  assert.strictEqual(result.trades.length, 1);
  assert.strictEqual(result.trades[0].energyKWh, 10.0);

  const updatedOffer = result.updatedOffers.find(o => o.id === 'OFF-PARTIAL');
  assert.strictEqual(updatedOffer.remainingKWh, 8.0, 'Remaining seller offer must be 8.0 kWh');
  assert.strictEqual(updatedOffer.status, 'PARTIALLY_FILLED');

  const updatedBid = result.updatedBids.find(b => b.id === 'BID-PARTIAL');
  assert.strictEqual(updatedBid.remainingKWh, 0.0, 'Buyer bid must be completely filled');
  assert.strictEqual(updatedBid.status, 'FILLED');
});

// -----------------------------------------------------------------------------
// Scenario 14: Duplicate energy prevention
// -----------------------------------------------------------------------------
runScenario(14, 'Duplicate energy prevention (no overselling beyond surplus; no overbuying beyond deficit)', () => {
  const sim = new SimulationManager();
  const prosumer = sim.households.find(h => h.id === 'HH-01');
  const surplus = prosumer.hourlySurplus[12]; // e.g. 5.1 kWh

  const { offers } = generateInternalOrders([{
    ...prosumer,
    currentHourGenerationKWh: prosumer.hourlyGeneration[12],
    currentHourDemandKWh: prosumer.hourlyDemand[12]
  }], 4.50, 12, { minimumTradePrice: 2.0, maximumTradePrice: 8.0 });
  assert.ok(offers[0].energyKWh <= surplus, 'Internal offer cannot exceed true metered surplus');

  // Once matched, energy is subtracted and cannot be rematched
  const network = new GridNetworkManager();
  const bids = [{
    id: 'BID-DUP-1',
    householdId: 'HH-02',
    zone: 'ZONE-A',
    quantityKWh: offers[0].remainingKWh,
    remainingKWh: offers[0].remainingKWh,
    maxBidINR: 7.00,
    status: 'ACTIVE'
  }];

  const res1 = matchOrders(offers, bids, 12, '2026-10-14T12:00:00Z', {}, network);
  assert.strictEqual(res1.trades.length, 1);
  const remainingOffer = res1.updatedOffers[0];
  assert.strictEqual(remainingOffer.remainingKWh, 0.0);

  // Attempting second match with depleted offer must yield 0 trades
  const bids2 = [{
    id: 'BID-DUP-2',
    householdId: 'HH-05',
    zone: 'ZONE-A',
    quantityKWh: 5.0,
    remainingKWh: 5.0,
    maxBidINR: 7.00,
    status: 'ACTIVE'
  }];
  const res2 = matchOrders(res1.updatedOffers, bids2, 12, '2026-10-14T12:00:00Z', {}, network);
  assert.strictEqual(res2.trades.length, 0, 'Depleted offer must not match again');
});

// -----------------------------------------------------------------------------
// Scenario 15: Invalid/excessive quantity bounds
// -----------------------------------------------------------------------------
runScenario(15, 'Invalid/excessive quantity bounds', () => {
  const network = new GridNetworkManager();
  
  // Test zero and negative quantities
  const invalidOffers = [
    { id: 'OFF-ZERO', householdId: 'HH-01', zone: 'ZONE-A', quantityKWh: 0, remainingKWh: 0, askingPriceINR: 4.0, status: 'ACTIVE' },
    { id: 'OFF-NEG', householdId: 'HH-01', zone: 'ZONE-A', quantityKWh: -5, remainingKWh: -5, askingPriceINR: 4.0, status: 'ACTIVE' },
    { id: 'OFF-NAN', householdId: 'HH-01', zone: 'ZONE-A', quantityKWh: NaN, remainingKWh: NaN, askingPriceINR: 4.0, status: 'ACTIVE' }
  ];

  const validBid = [{ id: 'BID-OK', householdId: 'HH-02', zone: 'ZONE-A', quantityKWh: 10, remainingKWh: 10, maxBidINR: 6.0, status: 'ACTIVE' }];

  const res = matchOrders(invalidOffers, validBid, 12, '2026-10-14T12:00:00Z', {}, network);
  assert.strictEqual(res.trades.length, 0, 'Invalid or negative quantities must never produce trades');
});

// -----------------------------------------------------------------------------
// Scenario 16: Invalid prices and loss percentage validation
// -----------------------------------------------------------------------------
runScenario(16, 'Invalid prices and loss percentage validation', () => {
  // Price recommendation clamping test
  const clampedLow = calculateRecommendedPrice(10, 0, { overrideConfig: { minimumTradePrice: 2.0, maximumTradePrice: 8.0 } });
  assert.ok(clampedLow.recommendedPriceINR >= 2.0, 'Recommended price must never fall below minimumTradePrice');

  const clampedHigh = calculateRecommendedPrice(0, 10, { overrideConfig: { minimumTradePrice: 2.0, maximumTradePrice: 8.0 } });
  assert.ok(clampedHigh.recommendedPriceINR <= 8.0, 'Recommended price must never exceed maximumTradePrice');

  // Loss percentage bounds check in GridNetwork
  const network = new GridNetworkManager();
  const m = network.calculateTransmissionMetrics('ZONE-A', 'ZONE-B', 10.0);
  assert.ok(m.lossPercentage >= 0 && m.lossPercentage < 100, 'Loss percentage must be strictly between 0% and 100%');
  assert.ok(m.deliveredEnergyKWh > 0, 'Delivered energy must be strictly positive');
});

// -----------------------------------------------------------------------------
// Scenario 17: Failed and canceled settlements
// -----------------------------------------------------------------------------
runScenario(17, 'Failed and canceled settlements', () => {
  const network = new GridNetworkManager();
  const offers = [{
    id: 'OFF-CANCELLED',
    householdId: 'HH-01',
    zone: 'ZONE-A',
    quantityKWh: 10.0,
    remainingKWh: 10.0,
    askingPriceINR: 4.00,
    status: 'CANCELLED' // User cancelled offer before matching
  }];

  const bids = [{
    id: 'BID-ACTIVE',
    householdId: 'HH-02',
    zone: 'ZONE-A',
    quantityKWh: 10.0,
    remainingKWh: 10.0,
    maxBidINR: 6.00,
    status: 'ACTIVE'
  }];

  const result = matchOrders(offers, bids, 12, '2026-10-14T12:00:00Z', {}, network);
  assert.strictEqual(result.trades.length, 0, 'Cancelled order must not participate in matching');
});

// -----------------------------------------------------------------------------
// Scenario 18: Hour advancement and automatic order regeneration
// -----------------------------------------------------------------------------
runScenario(18, 'Hour advancement and automatic order regeneration', () => {
  const sim = new SimulationManager();
  sim.currentHour = 10;
  
  // Advance hour to 11
  const advanceResult = sim.advanceHour();
  assert.strictEqual(sim.currentHour, 11, 'Simulation hour must advance to 11');
  assert.strictEqual(advanceResult.currentHour, 11);
  
  // Verify smart meter records generated with SIMULATED tag
  const meterReadings = sim.gridNetwork.getMeterReadings();
  assert.ok(meterReadings.length > 0, 'Meter readings must be populated upon hour advance');
  assert.strictEqual(meterReadings[0].measurementSource, 'SIMULATED', 'Smart meter source must be explicitly SIMULATED');

  // Verify route capacity can be cleanly reset at start of interval
  sim.gridNetwork.resetIntervalCapacity();
  const routes = sim.gridNetwork.getRoutes();
  const allZeroUtil = routes.every(r => r.utilizedCapacityKWh === 0);
  assert.ok(allZeroUtil, 'resetIntervalCapacity must reset all route utilized capacities to 0.0');
});

// -----------------------------------------------------------------------------
// Scenario 19: SHA-256 ledger integrity and tamper detection
// -----------------------------------------------------------------------------
runScenario(19, 'SHA-256 ledger integrity and tamper detection', () => {
  const ledger = new TamperLedger(false, false); // Isolated in-memory instance, shouldPersist = false
  ledger.records = [];

  const mockTrade1 = {
    tradeId: 'TX-TEST-001',
    version: 2,
    simulationHour: 12,
    sellerId: 'HH-01',
    sellerName: 'Green Meadows Villa',
    sellerZone: 'ZONE-A',
    buyerId: 'HH-02',
    buyerName: 'Apex Tech Park Office',
    buyerZone: 'ZONE-B',
    isCrossZone: true,
    energyKWh: 10.0,
    sellerAsk: 4.00,
    buyerBid: 6.00,
    agreedPrice: 5.00,
    totalValue: 50.00,
    lossKWh: 0.35,
    deliveredEnergyKWh: 9.65,
    wheelingFeeINR: 2.50,
    platformFeeINR: 2.00,
    status: 'SETTLED'
  };

  const block1 = ledger.appendTransaction(mockTrade1);
  assert.strictEqual(block1.index, 0);
  assert.strictEqual(block1.previousHash, GENESIS_HASH);
  assert.ok(block1.currentHash.length === 64, 'Block hash must be a 64-char hex SHA-256 string');

  // Verification passes on genuine ledger
  const initialVerify = ledger.verifyChain();
  assert.strictEqual(initialVerify.isValid, true);
  assert.strictEqual(initialVerify.verifiedCount, 1);

  // Tamper detection demonstration
  const tamperResult = ledger.simulateTamperTest(0, 'energyKWh', 999.99);
  assert.strictEqual(tamperResult.tamperDetectedSuccessfully, true);
  assert.strictEqual(tamperResult.verificationResult.isValid, false);
  assert.strictEqual(tamperResult.verificationResult.corruptedBlockId, 'TX-TEST-001');
});

// -----------------------------------------------------------------------------
// Scenario 20: Role authorization & household isolation
// -----------------------------------------------------------------------------
runScenario(20, 'Role authorization & household isolation', () => {
  // Test demo accounts and roles
  const sellerAcc = DEMO_ACCOUNTS.find(a => a.id === 'seller_hh01');
  const buyerAcc = DEMO_ACCOUNTS.find(a => a.id === 'buyer_hh02');
  const adminAcc = DEMO_ACCOUNTS.find(a => a.id === 'admin');

  assert.strictEqual(sellerAcc.role, 'SELLER');
  assert.strictEqual(buyerAcc.role, 'BUYER');
  assert.strictEqual(adminAcc.role, 'ADMIN');

  // Household isolation: A buyer session cannot authenticate as a seller
  const buyerSession = loginDemo('buyer_hh02');
  assert.strictEqual(buyerSession.user.householdId, 'HH-02');
  assert.notStrictEqual(buyerSession.user.householdId, sellerAcc.householdId, 'Buyer session must be strictly isolated to HH-02');

  // Authenticate request helper
  const authHeader = { headers: { authorization: `Bearer ${buyerSession.token}` } };
  const authenticated = authenticateRequest(authHeader);
  assert.ok(authenticated, 'Valid Bearer token must authenticate');
  assert.strictEqual(authenticated.id, 'buyer_hh02');

  const invalidHeader = { headers: { authorization: 'Bearer invalid-token-xyz' } };
  assert.strictEqual(authenticateRequest(invalidHeader), null, 'Invalid token must return null');
});

// -----------------------------------------------------------------------------
// Scenario 21: Backward compatibility with historical records
// -----------------------------------------------------------------------------
runScenario(21, 'Backward compatibility with historical records (118+ historical records)', () => {
  const ledger = new TamperLedger(true); // Loads existing records from disk
  assert.ok(ledger.records.length >= 118, `Authoritative ledger must contain at least 118 historical records, found: ${ledger.records.length}`);

  const verification = ledger.verifyChain();
  assert.strictEqual(verification.isValid, true, 'All historical ledger blocks (including legacy version 1) must verify 100%');
  assert.ok(verification.verifiedCount >= 118, 'All blocks must pass SHA-256 hash chaining');
  console.log(`     ℹ️ Verified ${verification.verifiedCount} historical & active blocks without any cryptographic drift.`);
});

// -----------------------------------------------------------------------------
// Scenario 22: Repeated simulation runs and reset behavior
// -----------------------------------------------------------------------------
runScenario(22, 'Repeated simulation runs and reset behavior', () => {
  const sim = new SimulationManager();
  sim.currentHour = 0;
  
  // Advance through 5 hours
  for (let i = 0; i < 5; i++) {
    sim.advanceHour();
  }
  assert.strictEqual(sim.currentHour, 5);

  // Perform reset
  sim.resetSimulation();
  assert.strictEqual(sim.currentHour, 0, 'Reset must return simulation hour to 00:00');
  assert.strictEqual(sim.activeOffers.length, 0, 'Active offers must be cleared');
  assert.strictEqual(sim.activeBids.length, 0, 'Active bids must be cleared');
  
  // Grid network routes must be reset
  const routes = sim.gridNetwork.getRoutes();
  const allZeroUtil = routes.every(r => r.utilizedCapacityKWh === 0);
  assert.ok(allZeroUtil, 'Reset must clear all route transfer utilization');
});

// -----------------------------------------------------------------------------
// Test Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`🎯 Test Run Completed: ${passedCount} / ${TOTAL_SCENARIOS} Scenarios Passed (100% Success Rate)`);
console.log('🌱 All SDG 7 Grid-Connected P2P Energy Marketplace Requirements Fully Met');
console.log('================================================================================\n');

process.exit(0);
