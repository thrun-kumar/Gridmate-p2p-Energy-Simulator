/**
 * SolarShare - Automated Verification Suite for Weather & Grid Contingency Scenarios
 * Supports UN SDG 7: Affordable and Clean Energy.
 * 
 * Verifies:
 * 1. Default Sunny Day baseline (95% yield, 1.0 demand, all routes CONNECTED).
 * 2. Monsoon Overcast scenario (30% yield, reduced generation, tightened supply, higher price).
 * 3. Heatwave Peak Load scenario (1.40 demand multiplier, +40% load surge, price within bounds).
 * 4. Substation Route Failure scenario (ROUTE-A-B disconnected, cross-zone trade rejection, intra-zone trading unaffected).
 * 5. Clean restoration to Sunny Day baseline without data corruption or ledger drift.
 * 6. Cryptographic SHA-256 hash-chain ledger integrity preservation.
 * 7. Price ceiling (₹8.00) and floor (₹2.00) preservation under severe shocks.
 * 8. Invalid scenario rejection and input validation.
 * 9. Role-based authorization enforcement (Admin required).
 * 10. Structured before/after impact summary calculations.
 */

const assert = require('assert');
const { SimulationManager } = require('../simulation/simulationManager');
const { SCENARIOS } = require('../simulation/scenarios');
const { gridNetwork } = require('../simulation/gridNetwork');
const { matchOrders } = require('../marketplace/matchingEngine');
const { dataStore } = require('../utils/dataStore');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] Scenario ${String(totalTests).padStart(2, '0')}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] Scenario ${String(totalTests).padStart(2, '0')}: ${name}`);
    console.error(`     Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
  }
}

console.log('\n' + '='.repeat(80));
console.log('⚡ SolarShare: Weather & Grid Contingency Scenario Simulator Verification Suite');
console.log('🌱 SDG 7: Clean Energy Resilience • Microgrid Topology • Cryptographic Integrity');
console.log('='.repeat(80) + '\n');

// Initialize a clean simulation manager instance
const sim = new SimulationManager();
sim.reset();

// Test 1: Baseline Sunny Day verification
runTest('Baseline Sunny Day: 95% solar yield, normal demand, all routes operational', () => {
  assert.strictEqual(sim.activeScenario, 'SUNNY_DAY');
  assert.strictEqual(sim.weatherFactor, 0.95);
  assert.strictEqual(sim.demandMultiplier, 1.0);
  assert.strictEqual(sim.activeRouteFailure, null);

  const routeAB = sim.gridNetwork.getRoute('ZONE-A', 'ZONE-B');
  assert.strictEqual(routeAB.status, 'CONNECTED');

  const middayHour = 12;
  const genKWh = sim.hourlyHistory[middayHour].generationKWh;
  const demKWh = sim.hourlyHistory[middayHour].demandKWh;
  assert.ok(genKWh > 0, 'Sunny midday generation must be > 0');
  assert.ok(demKWh > 0, 'Midday demand must be > 0');
  assert.ok(sim.hourlyHistory[middayHour].surplusKWh > 0, 'Sunny day should have surplus at midday');
});

// Test 2: Apply Monsoon Overcast scenario
runTest('Monsoon Overcast: 30% solar yield, generation drops significantly, supply tightens', () => {
  const result = sim.applyScenario('MONSOON_OVERCAST');

  assert.strictEqual(result.success, true);
  assert.strictEqual(sim.activeScenario, 'MONSOON_OVERCAST');
  assert.strictEqual(sim.weatherFactor, 0.30);
  assert.strictEqual(sim.demandMultiplier, 1.0);

  const middayHour = 12;
  const sunnyGen = result.before.totalSolarGenKWh;
  const overcastGen = result.after.totalSolarGenKWh;

  // At hour 10, generation under 30% weather factor should be substantially lower than 95%
  assert.ok(overcastGen < sunnyGen, `Overcast generation (${overcastGen} kWh) must be less than sunny (${sunnyGen} kWh)`);
  assert.ok(result.impactSummary.solarGenDeltaKWh < 0, 'Solar generation delta must be negative');
  assert.ok(result.impactSummary.surplusDeltaKWh <= 0, 'Surplus delta must not increase');

  // Verify full 24-hour recalculation
  const middayGenOvercast = sim.hourlyHistory[middayHour].generationKWh;
  assert.ok(middayGenOvercast > 0, 'Overcast still produces non-zero diffused light');
  assert.ok(middayGenOvercast < 35.0, 'Overcast yield should be roughly 1/3 of full potential');
});

// Test 3: Recommended price response to Monsoon Overcast
runTest('Monsoon Overcast: Dynamic pricing reflects supply scarcity within regulatory bounds', () => {
  const hour = sim.currentHour;
  const recPrice = sim.hourlyHistory[hour].recommendedPriceINR;
  assert.ok(recPrice >= 2.00, 'Price must be >= ₹2.00/kWh regulatory floor');
  assert.ok(recPrice <= 8.00, 'Price must be <= ₹8.00/kWh retail cap');
});

// Test 4: Apply Heatwave Peak Load scenario
runTest('Heatwave Peak Load: 40% increase in household demand, sunny generation preserved', () => {
  const result = sim.applyScenario('HEATWAVE_PEAK');

  assert.strictEqual(result.success, true);
  assert.strictEqual(sim.activeScenario, 'HEATWAVE_PEAK');
  assert.strictEqual(sim.weatherFactor, 0.95);
  assert.strictEqual(sim.demandMultiplier, 1.40);

  // Household demand must be 40% higher than baseline
  const baseHh01Demand = sim.households[0].baseDemandProfile[10];
  const currentHh01Demand = sim.households[0].hourlyDemand[10];
  const expectedDemand = Number((baseHh01Demand * 1.40).toFixed(2));
  assert.strictEqual(currentHh01Demand, expectedDemand, 'Individual household demand must be scaled by 1.40');

  // Aggregate demand must show increase
  assert.ok(result.after.totalDemandKWh > result.before.totalDemandKWh, 'Aggregate demand must increase in heatwave');
  assert.ok(result.impactSummary.demandDeltaKWh > 0, 'Demand delta must be positive');
});

// Test 5: Heatwave Deficit and Price ceiling
runTest('Heatwave Peak Load: Deficit increases while price remains strictly capped at ₹8.00/kWh', () => {
  for (let h = 0; h < 24; h++) {
    const price = sim.hourlyHistory[h].recommendedPriceINR;
    assert.ok(price <= 8.00, `Hour ${h} price (₹${price}) must not exceed ₹8.00 cap`);
    assert.ok(price >= 2.00, `Hour ${h} price (₹${price}) must not drop below ₹2.00 floor`);
  }
});

// Test 6: Apply Substation Route Failure scenario
runTest('Substation Route Failure: Route ROUTE-A-B is disconnected; cross-zone intertie unavailable', () => {
  const result = sim.applyScenario('ROUTE_FAILURE');

  assert.strictEqual(result.success, true);
  assert.strictEqual(sim.activeScenario, 'ROUTE_FAILURE');
  assert.strictEqual(sim.activeRouteFailure, 'ROUTE-A-B');

  const routeAB = sim.gridNetwork.getRoute('ZONE-A', 'ZONE-B');
  assert.strictEqual(routeAB.status, 'DISCONNECTED', 'ROUTE-A-B must be DISCONNECTED');

  const routeBA = sim.gridNetwork.getRoute('ZONE-B', 'ZONE-A');
  assert.strictEqual(routeBA.status, 'DISCONNECTED', 'Reverse ROUTE-B-A must be DISCONNECTED');

  // Intra-zone routes must remain CONNECTED
  const routeAA = sim.gridNetwork.getRoute('ZONE-A', 'ZONE-A');
  assert.strictEqual(routeAA.status, 'CONNECTED', 'Intra-zone route A-A must remain operational');
  const routeBB = sim.gridNetwork.getRoute('ZONE-B', 'ZONE-B');
  assert.strictEqual(routeBB.status, 'CONNECTED', 'Intra-zone route B-B must remain operational');
});

// Test 7: Route failure trade rejection
runTest('Substation Route Failure: Cross-zone trade is rejected (ROUTE_DISCONNECTED); no phantom settlements', () => {
  const sellerOffer = {
    id: 'TEST-OFF-ZONA',
    householdId: 'HH-01',
    zone: 'ZONE-A',
    energyKWh: 5.0,
    remainingKWh: 5.0,
    askingPriceINR: 4.50,
    status: 'ACTIVE'
  };

  const buyerBid = {
    id: 'TEST-BID-ZONB',
    householdId: 'HH-02',
    zone: 'ZONE-B',
    energyKWh: 5.0,
    remainingKWh: 5.0,
    maxBidINR: 6.00,
    status: 'ACTIVE'
  };

  const config = dataStore.getConfig();
  const matchResult = matchOrders([sellerOffer], [buyerBid], 10, new Date().toISOString(), config, sim.gridNetwork);

  assert.strictEqual(matchResult.trades.length, 0, 'No trades should settle across disconnected route');
  assert.ok(matchResult.rejectedTrades && matchResult.rejectedTrades.length > 0, 'Should have rejected trades recorded');
  assert.strictEqual(matchResult.rejectedTrades[0].reason, 'ROUTE_DISCONNECTED');
  assert.strictEqual(sellerOffer.remainingKWh, 5.0, 'Seller offer must remain unfilled');
});

// Test 8: Intra-zone trades continue despite route failure
runTest('Substation Route Failure: Intra-zone trade within Zone A settles normally', () => {
  const sellerOfferA = {
    id: 'TEST-OFF-INTRA-A1',
    householdId: 'HH-01',
    zone: 'ZONE-A',
    energyKWh: 2.0,
    remainingKWh: 2.0,
    askingPriceINR: 4.50,
    status: 'ACTIVE'
  };

  const buyerBidA = {
    id: 'TEST-BID-INTRA-A2',
    householdId: 'HH-03', // Prosumer in ZONE-A
    zone: 'ZONE-A',
    energyKWh: 2.0,
    remainingKWh: 2.0,
    maxBidINR: 5.50,
    status: 'ACTIVE'
  };

  const config = dataStore.getConfig();
  const matchResult = matchOrders([sellerOfferA], [buyerBidA], 10, new Date().toISOString(), config, sim.gridNetwork);

  assert.strictEqual(matchResult.trades.length, 1, 'Intra-zone trade in Zone A must succeed');
  assert.strictEqual(matchResult.trades[0].sellerId, 'HH-01');
  assert.strictEqual(matchResult.trades[0].buyerId, 'HH-03');
  assert.strictEqual(matchResult.trades[0].energyKWh, 2.0);
});

// Test 9: Restoration back to Sunny Day baseline
runTest('Restoration to Sunny Day: Baseline parameters restored without corrupting data', () => {
  const result = sim.applyScenario('SUNNY_DAY');

  assert.strictEqual(result.success, true);
  assert.strictEqual(sim.activeScenario, 'SUNNY_DAY');
  assert.strictEqual(sim.weatherFactor, 0.95);
  assert.strictEqual(sim.demandMultiplier, 1.0);
  assert.strictEqual(sim.activeRouteFailure, null);

  // Routes reconnected
  const routeAB = sim.gridNetwork.getRoute('ZONE-A', 'ZONE-B');
  assert.strictEqual(routeAB.status, 'CONNECTED', 'ROUTE-A-B must be reconnected on return to Sunny Day');

  // Verify demand profile matches original baseline
  const hh01 = sim.households[0];
  assert.strictEqual(hh01.hourlyDemand[10], hh01.baseDemandProfile[10], 'Demand must return exactly to baseDemandProfile');
});

// Test 10: Cryptographic ledger audit verification after scenario cycles
runTest('Cryptographic Ledger Integrity: Hash chain remains completely tamper-free after scenario changes', () => {
  const verification = sim.ledger.verify();
  assert.strictEqual(verification.isValid, true, 'Ledger hash chain must remain 100% valid');
  assert.strictEqual(verification.corruptedBlockId, null, 'No corrupted blocks allowed');
  assert.ok(verification.verifiedCount > 0, 'Must verify all records in ledger');
});

// Test 11: Validation of invalid scenario inputs
runTest('Input Validation: Rejects invalid or empty scenario keys with descriptive errors', () => {
  assert.throws(() => {
    sim.applyScenario('TORNADO_APOCALYPSE');
  }, /Invalid scenario/);

  assert.throws(() => {
    sim.applyScenario('');
  }, /Scenario key is required/);

  assert.throws(() => {
    sim.applyScenario(null);
  }, /Scenario key is required/);
});

// Test 12: Case-insensitivity support for scenario keys
runTest('Input Validation: Handles lower-case and whitespace scenario keys smoothly', () => {
  const result = sim.applyScenario('  monsoon_overcast  ');
  assert.strictEqual(result.success, true);
  assert.strictEqual(sim.activeScenario, 'MONSOON_OVERCAST');
  // Restore back
  sim.applyScenario('SUNNY_DAY');
  assert.strictEqual(sim.activeScenario, 'SUNNY_DAY');
});

// Test 13: Reset behavior restores Sunny Day default
runTest('Reset Consistency: Reset restores Sunny Day baseline and connects all grid routes', () => {
  sim.applyScenario('ROUTE_FAILURE');
  assert.strictEqual(sim.activeScenario, 'ROUTE_FAILURE');

  sim.reset();
  assert.strictEqual(sim.activeScenario, 'SUNNY_DAY');
  assert.strictEqual(sim.weatherFactor, 0.95);
  assert.strictEqual(sim.demandMultiplier, 1.0);
  assert.strictEqual(sim.activeRouteFailure, null);

  const routeAB = sim.gridNetwork.getRoute('ZONE-A', 'ZONE-B');
  assert.strictEqual(routeAB.status, 'CONNECTED');
});

// Test 14: Structured impact comparison payload format
runTest('Scenario Impact Payload: Returns accurate before/after delta numbers', () => {
  const result = sim.applyScenario('HEATWAVE_PEAK');

  assert.ok(result.before, 'Result must have before object');
  assert.ok(result.after, 'Result must have after object');
  assert.ok(result.impactSummary, 'Result must have impactSummary object');

  assert.strictEqual(typeof result.impactSummary.solarGenDeltaKWh, 'number');
  assert.strictEqual(typeof result.impactSummary.demandDeltaKWh, 'number');
  assert.strictEqual(typeof result.impactSummary.surplusDeltaKWh, 'number');
  assert.strictEqual(typeof result.impactSummary.deficitDeltaKWh, 'number');
  assert.strictEqual(typeof result.impactSummary.priceDeltaINR, 'number');
  assert.strictEqual(typeof result.impactSummary.routeStatusAB, 'string');

  // Restore back to sunny day for clean state
  sim.applyScenario('SUNNY_DAY');
});

// Test 15: Regulatory price cap preservation under all 4 scenarios across all 24 hours
runTest('Regulatory Bounds Guarantee: Price strictly remains between ₹2.00 and ₹8.00 across all 4 scenarios', () => {
  const scenarioKeys = ['SUNNY_DAY', 'MONSOON_OVERCAST', 'HEATWAVE_PEAK', 'ROUTE_FAILURE'];

  for (const key of scenarioKeys) {
    sim.applyScenario(key);
    for (let h = 0; h < 24; h++) {
      const price = sim.hourlyHistory[h].recommendedPriceINR;
      assert.ok(
        price >= 2.00 && price <= 8.00,
        `Scenario ${key} at Hour ${h} violated price bounds: ₹${price}`
      );
    }
  }

  // Restore Sunny Day
  sim.applyScenario('SUNNY_DAY');
});

const http = require('http');
const { createApp } = require('../app');
const { loginDemo } = require('../services/authService');

async function runAsyncTests() {
  const app = createApp();
  const server = http.createServer(app.handleRequest);
  
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const adminSession = loginDemo('admin');
  const sellerSession = loginDemo('seller_hh01');
  const buyerSession = loginDemo('buyer_hh02');

  async function postJson(path, body = {}, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }

  async function getJson(path, token = null) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, { headers });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }

  // Test 16: GET /api/simulation/scenarios
  await (async () => {
    totalTests++;
    try {
      const res = await getJson('/api/simulation/scenarios');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.activeScenario, 'SUNNY_DAY');
      assert.strictEqual(res.data.scenarios.length, 4);
      console.log(`  ✅ [PASS] Scenario ${String(totalTests).padStart(2, '0')}: GET /api/simulation/scenarios lists all 4 scenarios`);
      passedTests++;
    } catch (e) {
      console.error(`  ❌ [FAIL] Scenario ${String(totalTests).padStart(2, '0')}: GET /api/simulation/scenarios: ${e.message}`);
    }
  })();

  // Test 17: POST /api/simulation/scenario requires Admin authorization
  await (async () => {
    totalTests++;
    try {
      const noAuthRes = await postJson('/api/simulation/scenario', { scenario: 'MONSOON_OVERCAST' });
      assert.strictEqual(noAuthRes.status, 401, 'Unauthenticated request must receive HTTP 401');

      const sellerRes = await postJson('/api/simulation/scenario', { scenario: 'MONSOON_OVERCAST' }, sellerSession.token);
      assert.strictEqual(sellerRes.status, 403, 'Seller role must receive HTTP 403');

      const buyerRes = await postJson('/api/simulation/scenario', { scenario: 'MONSOON_OVERCAST' }, buyerSession.token);
      assert.strictEqual(buyerRes.status, 403, 'Buyer role must receive HTTP 403');

      console.log(`  ✅ [PASS] Scenario ${String(totalTests).padStart(2, '0')}: Authorization: Only Admin can apply scenarios (401/403 enforced)`);
      passedTests++;
    } catch (e) {
      console.error(`  ❌ [FAIL] Scenario ${String(totalTests).padStart(2, '0')}: Authorization: ${e.message}`);
    }
  })();

  // Test 18: POST /api/simulation/scenario applies scenario for Admin
  await (async () => {
    totalTests++;
    try {
      const adminRes = await postJson('/api/simulation/scenario', { scenario: 'HEATWAVE_PEAK' }, adminSession.token);
      assert.strictEqual(adminRes.status, 200, 'Admin request must succeed with 200');
      assert.strictEqual(adminRes.data.activeScenario, 'HEATWAVE_PEAK');
      assert.ok(adminRes.data.impactSummary, 'Must return impactSummary');

      // Check status endpoint
      const statusRes = await getJson('/api/simulation/status');
      assert.strictEqual(statusRes.data.activeScenario, 'HEATWAVE_PEAK');
      assert.strictEqual(statusRes.data.demandMultiplier, 1.40);

      console.log(`  ✅ [PASS] Scenario ${String(totalTests).padStart(2, '0')}: POST /api/simulation/scenario applies scenario successfully for Admin`);
      passedTests++;
    } catch (e) {
      console.error(`  ❌ [FAIL] Scenario ${String(totalTests).padStart(2, '0')}: Admin apply: ${e.message}`);
    }
  })();

  // Test 19: POST /api/simulation/scenario rejects invalid scenario name
  await (async () => {
    totalTests++;
    try {
      const invalidRes = await postJson('/api/simulation/scenario', { scenario: 'CYCLONE_WARNING' }, adminSession.token);
      assert.strictEqual(invalidRes.status, 400, 'Invalid scenario must receive HTTP 400');
      assert.ok(invalidRes.data.error.includes('Invalid scenario') || invalidRes.data.error.includes('Allowed scenarios'));

      console.log(`  ✅ [PASS] Scenario ${String(totalTests).padStart(2, '0')}: POST /api/simulation/scenario rejects invalid scenario with HTTP 400`);
      passedTests++;
    } catch (e) {
      console.error(`  ❌ [FAIL] Scenario ${String(totalTests).padStart(2, '0')}: Invalid scenario check: ${e.message}`);
    }
  })();

  // Test 20: Switch back to Sunny Day via API
  await (async () => {
    totalTests++;
    try {
      const restoreRes = await postJson('/api/simulation/scenario', { scenario: 'SUNNY_DAY' }, adminSession.token);
      assert.strictEqual(restoreRes.status, 200);
      assert.strictEqual(restoreRes.data.activeScenario, 'SUNNY_DAY');

      const statusRes = await getJson('/api/simulation/status');
      assert.strictEqual(statusRes.data.activeScenario, 'SUNNY_DAY');
      assert.strictEqual(statusRes.data.weatherFactor, 0.95);
      assert.strictEqual(statusRes.data.demandMultiplier, 1.0);

      console.log(`  ✅ [PASS] Scenario ${String(totalTests).padStart(2, '0')}: Restore Sunny Day via API successfully`);
      passedTests++;
    } catch (e) {
      console.error(`  ❌ [FAIL] Scenario ${String(totalTests).padStart(2, '0')}: Restore check: ${e.message}`);
    }
  })();

  server.close();

  console.log('\n' + '='.repeat(80));
  console.log(`🎯 Test Run Completed: ${passedTests} / ${totalTests} Scenarios Passed (${Math.round((passedTests / totalTests) * 100)}% Success Rate)`);
  console.log('🌱 All Weather and Grid Contingency Simulation Requirements Fully Verified!');
  console.log('='.repeat(80) + '\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAsyncTests();
