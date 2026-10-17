/**
 * SolarShare - Regulation-Aware Solar Energy Marketplace Test Suite
 * 
 * Verifies:
 * 1. Non-solar buyer eligibility (ordinary consumers can purchase without solar panels).
 * 2. Rule-based price validation against active rule (RULE-TN-SIM-2026-V1, ₹2.00 - ₹8.00).
 * 3. Rejection logging when proposed price is outside bounds with rule citations.
 * 4. Price review request creation and administrative resolution (APPROVE / REJECT).
 * 5. Dynamic pricing with seasonal adjustments (Summer, Monsoon, Post-Monsoon, Winter).
 * 6. Time-of-day adjustments (midday solar surplus discounts, evening peak surcharges).
 * 7. Rate-of-change price smoothing (caps step changes to ±₹1.20/hour).
 * 8. Live Clock Mode vs Demo Simulation Clock Mode.
 * 9. Direct offer ranking by delivered unit cost (lowest delivered cost first).
 * 10. Deterministic tie-breaking in ranked comparison (earliest createdAt, then ID).
 * 11. Direct offer purchase without manual bidding or auction spreads.
 * 12. Partial fill allocation and accurate unmet demand reporting.
 * 13. Transparent fee itemization (gross energy value, platform fee, wheeling charge).
 * 14. Realized buyer savings vs Discom utility baseline (₹8.00/kWh).
 * 15. Prosumer net earnings premium vs Discom export floor (₹2.00/kWh).
 * 16. Cryptographic SHA-256 hash-chained ledger audit trail with zero drift.
 */

const assert = require('assert');
const { pricingRuleService } = require('../services/pricingRuleService');
const {
  calculateRecommendedPrice,
  computeDemandPressure,
  SEASONAL_PROFILES,
  TIME_OF_DAY_ADJUSTMENTS,
  getSeasonFromDate,
  setClockMode,
  getClockMode
} = require('../marketplace/pricingService');
const {
  getRankedOffersForBuyer,
  executeDirectPurchase,
  generateInternalOrders
} = require('../marketplace/matchingEngine');
const { GridNetworkManager, gridNetwork } = require('../simulation/gridNetwork');
const { TamperLedger } = require('../ledger/tamperLedger');

let passedTests = 0;
let totalTests = 0;

function testScenario(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] Scenario ${String(totalTests).padStart(2, '0')}: ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] Scenario ${String(totalTests).padStart(2, '0')}: ${name}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

console.log('\n' + '='.repeat(80));
console.log('⚡ SolarShare: Regulation-Aware Peer-to-Peer Solar Marketplace Verification Suite');
console.log('🌱 SDG 7: Clean Energy Marketplace • Transparent Rules • Direct Procurement');
console.log('='.repeat(80) + '\n');

// 1. Non-solar buyer eligibility
testScenario('Non-solar buyer eligibility: Ordinary consumers with 0 kW solar participate as buyers', () => {
  const households = [
    { id: 'HH-01', name: 'Seller Solar', solarCapacityKW: 5.0, generatedKWh: 8.0, consumedKWh: 2.0, role: 'prosumer', zone: 'ZONE-A' },
    { id: 'HH-02', name: 'Apartment Consumer', solarCapacityKW: 0.0, generatedKWh: 0.0, consumedKWh: 5.0, role: 'consumer', zone: 'ZONE-B' },
    { id: 'HH-03', name: 'Commercial Office', solarCapacityKW: 0.0, generatedKWh: 0.0, consumedKWh: 10.0, role: 'consumer', zone: 'ZONE-B' }
  ];

  const { offers, bids } = generateInternalOrders(households, 4.50, 12);
  assert.strictEqual(offers.length, 1, 'Only household with solar generation surplus creates sell offers');
  assert.strictEqual(offers[0].householdId, 'HH-01');
  assert.strictEqual(offers[0].remainingKWh, 6.0);

  assert.strictEqual(bids.length, 2, 'Non-solar consumers successfully generate demand orders');
  assert.strictEqual(bids[0].householdId, 'HH-02');
  assert.strictEqual(bids[1].householdId, 'HH-03');
  assert.strictEqual(bids[0].remainingKWh, 5.0);
  assert.strictEqual(bids[1].remainingKWh, 10.0);
});

// 2. Pricing Rule: Active rule validation
testScenario('Active rule validation: Retrieves configured RULE-TN-SIM-2026-V1 with disclaimer', () => {
  const active = pricingRuleService.getActiveRule();
  assert.strictEqual(active.ruleId, 'RULE-TN-SIM-2026-V1');
  assert.strictEqual(active.minimumPermittedPriceINR, 2.00);
  assert.strictEqual(active.maximumPermittedPriceINR, 8.00);
  assert.strictEqual(active.platformFeePerKWhINR, 0.20);
  assert.strictEqual(active.localWheelingRateINR, 0.10);
  assert.strictEqual(active.intertieWheelingRateINR, 0.25);
  assert.strictEqual(active.status, 'ACTIVE');
  assert.strictEqual(active.disclaimer, 'Simulation rules — pending regulatory verification. For demonstration and research under UN SDG 7.');
});

// 3. Price validation within permitted band [₹2.00, ₹8.00]
testScenario('Permitted band validation: Prices within ₹2.00 to ₹8.00 are valid', () => {
  const v1 = pricingRuleService.validatePrice(4.50);
  assert.strictEqual(v1.valid, true);
  assert.strictEqual(v1.priceINR, 4.50);
  assert.strictEqual(v1.ruleId, 'RULE-TN-SIM-2026-V1');

  const v2 = pricingRuleService.validatePrice(2.00);
  assert.strictEqual(v2.valid, true);

  const v3 = pricingRuleService.validatePrice(8.00);
  assert.strictEqual(v3.valid, true);
});

// 4. Rejection of price below floor (< ₹2.00)
testScenario('Floor violation rejection: Proposed price below ₹2.00/kWh is formally rejected', () => {
  const res = pricingRuleService.processSellerPriceSubmission({
    householdId: 'HH-01',
    householdName: 'Ananya Solar',
    priceINR: 1.50,
    surplusKWh: 10.0
  });

  assert.strictEqual(res.approved, false);
  assert.strictEqual(res.validation.valid, false);
  assert.ok(res.validation.reason.includes('below the configured eligible floor of ₹2.00'));
  assert.strictEqual(res.rejectionRecord.attemptedPriceINR, 1.50);
  assert.strictEqual(res.rejectionRecord.ruleId, 'RULE-TN-SIM-2026-V1');
  assert.strictEqual(res.rejectionRecord.canRequestReview, true);
});

// 5. Rejection of price above ceiling (> ₹8.00)
testScenario('Ceiling violation rejection: Proposed price above ₹8.00/kWh is formally rejected', () => {
  const res = pricingRuleService.processSellerPriceSubmission({
    householdId: 'HH-01',
    householdName: 'Ananya Solar',
    priceINR: 9.50,
    surplusKWh: 10.0
  });

  assert.strictEqual(res.approved, false);
  assert.strictEqual(res.validation.valid, false);
  assert.ok(res.validation.reason.includes('exceeds the maximum permitted ceiling of ₹8.00'));
  assert.strictEqual(res.rejectionRecord.attemptedPriceINR, 9.50);
  assert.strictEqual(res.rejectionRecord.ruleId, 'RULE-TN-SIM-2026-V1');
});

// 6. Rejected prices audit log accumulation
testScenario('Rejected prices logging: Rejections are recorded in audit log with timestamps and rules', () => {
  const log = pricingRuleService.getRejectedPricesLog(10);
  assert.ok(Array.isArray(log));
  assert.ok(log.length >= 2, 'Log records both under-floor and over-ceiling attempts');
  assert.strictEqual(log[0].ruleId, 'RULE-TN-SIM-2026-V1');
  assert.ok(log[0].attemptedAt !== null);
});

// 7. Seller price review request submission
testScenario('Price review request submission: Seller submits formal review with justification', () => {
  const req = pricingRuleService.createPriceReviewRequest({
    householdId: 'HH-01',
    householdName: 'Ananya Solar',
    requestedPriceINR: 8.50,
    surplusKWh: 12.0,
    reason: 'Rooftop battery storage installation provides reliable peak evening clean dispatch'
  });

  assert.ok(req.id.startsWith('REV-'));
  assert.strictEqual(req.status, 'PENDING');
  assert.strictEqual(req.requestedPriceINR, 8.50);
  assert.strictEqual(req.surplusKWh, 12.0);
  assert.strictEqual(req.ruleId, 'RULE-TN-SIM-2026-V1');

  const pending = pricingRuleService.getPriceReviewRequests('PENDING');
  assert.ok(pending.some(p => p.id === req.id));
});

// 8. Company Operator resolves price review request
testScenario('Price review resolution: Company Operator approves or rejects review request', () => {
  const req = pricingRuleService.createPriceReviewRequest({
    householdId: 'HH-03',
    householdName: 'Priya Solar',
    requestedPriceINR: 1.80,
    surplusKWh: 20.0,
    reason: 'Temporary industrial bulk surplus offload'
  });

  const approved = pricingRuleService.resolvePriceReviewRequest(
    req.id,
    'APPROVED',
    'Approved as special bulk exception under simulation framework',
    'operator-admin'
  );

  assert.strictEqual(approved.status, 'APPROVED');
  assert.strictEqual(approved.resolvedBy, 'operator-admin');
  assert.ok(approved.resolvedAt !== null);
  assert.ok(approved.operatorNotes.includes('special bulk exception'));
});

// 9. Dynamic Pricing: Seasonal adjustments
testScenario('Dynamic Pricing - Seasonal Adjustments: Summer discounts vs Monsoon premiums', () => {
  // Monsoon profile adjustment: +₹0.35/kWh (cloud cover, lower solar output)
  const monsoonPrice = calculateRecommendedPrice(10, 10, {
    currentHour: 12,
    season: 'MONSOON',
    clockMode: 'DEMO'
  });
  assert.strictEqual(monsoonPrice.season, 'MONSOON');
  assert.strictEqual(monsoonPrice.seasonalAdjustmentINR, 0.35);

  // Summer profile adjustment: -₹0.25/kWh (high insolation, solar surplus)
  const summerPrice = calculateRecommendedPrice(10, 10, {
    currentHour: 12,
    season: 'SUMMER',
    clockMode: 'DEMO'
  });
  assert.strictEqual(summerPrice.season, 'SUMMER');
  assert.strictEqual(summerPrice.seasonalAdjustmentINR, -0.25);
  assert.ok(monsoonPrice.recommendedPriceINR > summerPrice.recommendedPriceINR);
});

// 10. Dynamic Pricing: Time-of-day solar peak discount vs evening peak
testScenario('Dynamic Pricing - Time of Day: Midday solar discounts vs evening peak surcharges', () => {
  // Hour 12:00 (midday peak solar): -₹0.50 discount
  const midday = calculateRecommendedPrice(20, 20, {
    currentHour: 12,
    season: 'SUMMER',
    clockMode: 'DEMO'
  });
  assert.strictEqual(midday.timeOfDayAdjustmentINR, -0.50);

  // Hour 19:00 (evening peak demand): +₹0.65 surcharge
  const evening = calculateRecommendedPrice(20, 20, {
    currentHour: 19,
    season: 'SUMMER',
    clockMode: 'DEMO'
  });
  assert.strictEqual(evening.timeOfDayAdjustmentINR, 0.65);
  assert.ok(evening.recommendedPriceINR > midday.recommendedPriceINR);
});

// 11. Rate-of-change smoothing limits
testScenario('Rate-of-change smoothing: Price jump capped to ±₹1.20/hour for microgrid stability', () => {
  const p1 = calculateRecommendedPrice(50, 0, { currentHour: 12, previousPriceINR: 6.00 });
  // Unconstrained drop might be larger, but capped to max step ₹1.20/hour
  assert.ok(p1.recommendedPriceINR >= 6.00 - 1.20);
  assert.ok(p1.smoothingApplied !== undefined);
});

// 12. Clock Mode toggle: Live vs Demo
testScenario('Clock Mode toggle: setClockMode switches between LIVE and DEMO simulation clock', () => {
  setClockMode('LIVE');
  assert.strictEqual(getClockMode(), 'LIVE');

  setClockMode('DEMO');
  assert.strictEqual(getClockMode(), 'DEMO');
});

// 13. Ranked offers for ordinary buyer (lowest delivered unit cost first)
testScenario('Ranked offers sorting: Cheapest delivered cost per kWh ranked first with transparent fees', () => {
  const net = new GridNetworkManager();
  const offers = [
    { id: 'OFF-02', householdId: 'HH-03', householdName: 'Priya Solar', zone: 'ZONE-A', remainingKWh: 5.0, askingPriceINR: 5.20, status: 'ACTIVE', createdAt: 200 },
    { id: 'OFF-01', householdId: 'HH-01', householdName: 'Ananya Solar', zone: 'ZONE-A', remainingKWh: 10.0, askingPriceINR: 4.20, status: 'ACTIVE', createdAt: 100 },
    { id: 'OFF-03', householdId: 'HH-06', householdName: 'Ravi Solar', zone: 'ZONE-C', remainingKWh: 8.0, askingPriceINR: 4.20, status: 'ACTIVE', createdAt: 300 }
  ];

  const ranked = getRankedOffersForBuyer(offers, 'ZONE-A', { network: net, platformFeeINRPerKWh: 0.20 });

  assert.strictEqual(ranked.length, 3);
  // OFF-01 is local ZONE-A with ask ₹4.20, delivered cost lowest
  assert.strictEqual(ranked[0].offerId, 'OFF-01');
  assert.strictEqual(ranked[0].deliveredUnitCostINRPerKWh < ranked[1].deliveredUnitCostINRPerKWh, true);
  assert.strictEqual(ranked[0].platformFeeINRPerKWh, 0.20);
  assert.strictEqual(ranked[0].wheelingFeeINRPerKWh, 0.10); // Local wheeling rate
});

// 14. Deterministic tie-breaking
testScenario('Deterministic tie-breaking: Same price resolved by earlier createdAt then ID', () => {
  const net = new GridNetworkManager();
  const offers = [
    { id: 'OFF-B', householdId: 'HH-02', householdName: 'Seller B', zone: 'ZONE-A', remainingKWh: 5.0, askingPriceINR: 4.50, status: 'ACTIVE', createdAt: 200 },
    { id: 'OFF-A', householdId: 'HH-01', householdName: 'Seller A', zone: 'ZONE-A', remainingKWh: 5.0, askingPriceINR: 4.50, status: 'ACTIVE', createdAt: 100 }
  ];

  const ranked = getRankedOffersForBuyer(offers, 'ZONE-A', { network: net });
  assert.strictEqual(ranked[0].offerId, 'OFF-A', 'Earlier timestamp wins tie-break');
  assert.strictEqual(ranked[1].offerId, 'OFF-B');
});

// 15. Direct Purchase execution without auction
testScenario('Direct offer purchase: Buyer purchases energy directly without placing bids', () => {
  const net = new GridNetworkManager();
  const offers = [
    { id: 'OFF-01', householdId: 'HH-01', householdName: 'Ananya Solar', zone: 'ZONE-A', remainingKWh: 10.0, energyKWh: 10.0, askingPriceINR: 4.50, status: 'ACTIVE' }
  ];

  const purchaseResult = executeDirectPurchase({
    buyerId: 'HH-02',
    buyerName: 'Apartment Consumer',
    buyerZone: 'ZONE-B',
    offerId: 'OFF-01',
    requestedKWh: 4.0,
    offers,
    network: net,
    config: { platformFeeINRPerKWh: 0.20 }
  });

  assert.strictEqual(purchaseResult.success, true);
  assert.strictEqual(purchaseResult.allocatedKWh, 4.0);
  assert.strictEqual(purchaseResult.partialFill, false);
  assert.strictEqual(purchaseResult.unmetKWh, 0.0);

  const t = purchaseResult.trade;
  assert.strictEqual(t.energyKWh, 4.0);
  assert.strictEqual(t.tradePriceINR, 4.50);
  assert.strictEqual(t.totalValueINR, 18.00); // 4 * 4.50
  assert.strictEqual(t.platformFeeINR, 0.80);  // 4 * 0.20
  assert.strictEqual(t.settlementType, 'DIRECT_OFFER_PURCHASE');
  assert.strictEqual(t.ruleId, 'RULE-TN-SIM-2026-V1');

  // Verify offer remaining inventory reduced
  assert.strictEqual(offers[0].remainingKWh, 6.0);
  assert.strictEqual(offers[0].status, 'PARTIALLY_FILLED');
});

// 16. Partial fill handling and unmet demand reporting
testScenario('Partial fill handling: Requested quantity > available supply allocates partial and reports unmet demand', () => {
  const net = new GridNetworkManager();
  const offers = [
    { id: 'OFF-01', householdId: 'HH-01', householdName: 'Ananya Solar', zone: 'ZONE-A', remainingKWh: 3.5, energyKWh: 3.5, askingPriceINR: 4.50, status: 'ACTIVE' }
  ];

  const purchaseResult = executeDirectPurchase({
    buyerId: 'HH-02',
    buyerName: 'Apartment Consumer',
    buyerZone: 'ZONE-A',
    offerId: 'OFF-01',
    requestedKWh: 6.0, // Requested 6 kWh, but offer only has 3.5 kWh
    offers,
    network: net
  });

  assert.strictEqual(purchaseResult.success, true);
  assert.strictEqual(purchaseResult.partialFill, true);
  assert.strictEqual(purchaseResult.allocatedKWh, 3.5);
  assert.strictEqual(purchaseResult.unmetKWh, 2.5);
  assert.ok(purchaseResult.explanation.includes('Partial allocation'));
  assert.ok(purchaseResult.explanation.includes('Unmet demand: 2.5'));

  // Offer is now fully exhausted
  assert.strictEqual(offers[0].remainingKWh, 0);
  assert.strictEqual(offers[0].status, 'FILLED');
});

// 17. Self-trading prevention in direct purchases
testScenario('Self-trading prevention: Prosumer cannot purchase energy from their own offer', () => {
  const net = new GridNetworkManager();
  const offers = [
    { id: 'OFF-01', householdId: 'HH-01', householdName: 'Ananya Solar', zone: 'ZONE-A', remainingKWh: 5.0, askingPriceINR: 4.50, status: 'ACTIVE' }
  ];

  const result = executeDirectPurchase({
    buyerId: 'HH-01', // Same ID as seller!
    buyerName: 'Ananya Solar',
    buyerZone: 'ZONE-A',
    offerId: 'OFF-01',
    requestedKWh: 2.0,
    offers,
    network: net
  });

  assert.strictEqual(result.success, false);
  assert.ok(result.error.includes('Self-trading is not permitted'));
});

// 18. Transparent fee itemization & buyer savings vs Discom baseline
testScenario('Financial Itemization: Delivered energy, wheeling fee, platform fee, and savings vs ₹8.00 Discom benchmark', () => {
  const net = new GridNetworkManager();
  const offers = [
    { id: 'OFF-01', householdId: 'HH-01', householdName: 'Ananya Solar', zone: 'ZONE-A', remainingKWh: 10.0, energyKWh: 10.0, askingPriceINR: 4.50, status: 'ACTIVE' }
  ];

  const res = executeDirectPurchase({
    buyerId: 'HH-02',
    buyerName: 'Apartment Consumer',
    buyerZone: 'ZONE-B', // Cross-Zone: 3.5% loss, ₹0.25 wheeling
    offerId: 'OFF-01',
    requestedKWh: 10.0,
    offers,
    network: net,
    config: { platformFeeINRPerKWh: 0.20, gridBenchmarkTariff: 8.00, feedInFloorTariff: 2.00 }
  });

  const t = res.trade;
  assert.strictEqual(t.energyKWh, 10.0);
  assert.strictEqual(t.tradePriceINR, 4.50);
  assert.strictEqual(t.totalValueINR, 45.00);
  assert.strictEqual(t.platformFeeINR, 2.00); // 10 * 0.20
  assert.strictEqual(t.wheelingFeeINR, 2.50); // 10 * 0.25
  assert.strictEqual(t.buyerTotalCostINR, 49.50); // 45 + 2 + 2.50
  assert.strictEqual(t.deliveredEnergyKWh, 9.65); // 10 * (1 - 0.035)

  // Discom baseline: 9.65 * 8.00 = 77.20
  const expectedDiscom = Number((9.65 * 8.00).toFixed(2));
  assert.strictEqual(t.utilityBaselineCostINR, expectedDiscom);
  // Buyer savings: 77.20 - 49.50 = 27.70
  assert.strictEqual(t.buyerSavingsINR, Number((expectedDiscom - 49.50).toFixed(2)));
  // Seller extra earnings vs ₹2.00 floor: 10 * (4.50 - 2.00) = 25.00
  assert.strictEqual(t.sellerExtraEarningsINR, 25.00);
});

// 19. Cryptographic SHA-256 Ledger Audit Trail
testScenario('SHA-256 Ledger Cryptographic Integrity: Direct purchase recorded in ledger without hash drift', () => {
  // Use isolated in-memory ledger
  const ledger = new TamperLedger(false, false);
  const tradeRecord = {
    tradeId: 'TX-TEST-REG-01',
    version: 2,
    simulationHour: 12,
    timestamp: new Date().toISOString(),
    sellerId: 'HH-01',
    sellerName: 'Ananya Solar',
    sellerZone: 'ZONE-A',
    buyerId: 'HH-02',
    buyerName: 'Apartment Consumer',
    buyerZone: 'ZONE-B',
    energyKWh: 5.0,
    deliveredEnergyKWh: 4.825,
    tradePriceINR: 4.50,
    totalValueINR: 22.50,
    platformFeeINR: 1.00,
    wheelingFeeINR: 1.25,
    buyerTotalCostINR: 24.75,
    buyerSavingsINR: 13.85,
    sellerEnergyRevenueINR: 22.50,
    sellerExtraEarningsINR: 12.50,
    ruleId: 'RULE-TN-SIM-2026-V1',
    ruleVersion: '1.0.0',
    settlementType: 'DIRECT_OFFER_PURCHASE',
    settlementStatus: 'SETTLED'
  };

  const block = ledger.appendTransaction(tradeRecord, 'TEST-RUN-01');
  assert.ok(block.hash !== null);
  assert.ok(block.previousHash !== null);
  assert.strictEqual(block.index, 0);
  assert.strictEqual(block.trades[0].ruleId, 'RULE-TN-SIM-2026-V1');

  const verify = ledger.verify();
  assert.strictEqual(verify.valid, true);
  assert.strictEqual(verify.checkedBlocks, 1);
});

// 20. Tamper detection on regulation-aware blocks
testScenario('Tamper detection: Tampering with energy volume in ledger is immediately detected', () => {
  const ledger = new TamperLedger(false, false);
  const trade = {
    tradeId: 'TX-TEST-TAMPER-01',
    version: 2,
    simulationHour: 12,
    energyKWh: 10.0,
    tradePriceINR: 4.50,
    totalValueINR: 45.00,
    ruleId: 'RULE-TN-SIM-2026-V1',
    settlementType: 'DIRECT_OFFER_PURCHASE'
  };

  ledger.appendTransaction(trade, 'TEST-RUN-01');

  // Verify before tampering
  assert.strictEqual(ledger.verify().valid, true);

  // Alter transaction content maliciously
  const tampered = JSON.parse(JSON.stringify(ledger.getRecords()));
  tampered[0].energyKWh = 1000.0; // Tampered volume

  const verifyTamper = ledger.verify(tampered);
  assert.strictEqual(verifyTamper.valid, false);
  assert.strictEqual(verifyTamper.brokenIndex, 0);
});

console.log('\n' + '='.repeat(80));
console.log(`🎯 Test Run Completed: ${passedTests} / ${totalTests} Scenarios Passed (100% Success Rate)`);
console.log('🌱 All Regulation-Aware Solar Energy Marketplace Requirements Fully Verified!');
console.log('='.repeat(80) + '\n');
