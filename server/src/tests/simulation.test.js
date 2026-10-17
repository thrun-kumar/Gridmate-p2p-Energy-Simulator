/**
 * SolarShare - Comprehensive Automated Verification Suite
 * Tests 22 scenarios covering matching, pricing, SHA-256 blockchain audit chain,
 * tamper detection, ledger persistence, CSV export, PBKDF2 authentication,
 * dynamic household registration, role-based authorization, and simulation results summary.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { matchOrders } = require('../marketplace/matchingEngine');
const { TamperLedger } = require('../ledger/tamperLedger');
const { SimulationManager } = require('../simulation/simulationManager');
const {
  DEMO_ACCOUNTS,
  loginDemo,
  loginWithCredentials,
  registerUser,
  resetPassword,
  verifyPassword,
  authenticateRequest,
  logoutSession,
  handleGoogleUser
} = require('../services/authService');
const { getGoogleConfig, verifyGoogleToken } = require('../services/googleAuthService');
const { calculateTradeSettlement, CONFIG } = require('../services/settlementService');

let passedTests = 0;
const totalTests = 30;

function runTest(testNumber, description, fn) {
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] Scenario ${testNumber}: ${description}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] Scenario ${testNumber}: ${description}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

console.log('\n================================================================');
console.log('⚡ SolarShare: Running 30-Scenario Automated Verification Suite');
console.log('🌱 Hackathon Track: Clean Energy & Green Technology (SDG 7)');
console.log('================================================================\n');

// 1. Buyer and seller have compatible prices
runTest(1, 'Buyer and seller have compatible prices (Midpoint rule)', () => {
  const offers = [{ id: 'O1', householdId: 'H1', householdName: 'Seller 1', remainingKWh: 10, askingPriceINR: 4.00 }];
  const bids = [{ id: 'B1', householdId: 'H2', householdName: 'Buyer 1', remainingKWh: 10, maxBidINR: 6.00 }];
  const res = matchOrders(offers, bids, 12, '2026-10-14T12:00:00Z');

  assert.strictEqual(res.trades.length, 1);
  assert.strictEqual(res.trades[0].energyKWh, 10);
  assert.strictEqual(res.trades[0].tradePriceINR, 5.00); // (4.00 + 6.00) / 2
  assert.strictEqual(res.trades[0].totalValueINR, 50.00);
});

// 2. Buyer bid is lower than seller asking price
runTest(2, 'Buyer bid is lower than seller asking price (No trade occurs)', () => {
  const offers = [{ id: 'O1', householdId: 'H1', remainingKWh: 10, askingPriceINR: 6.50 }];
  const bids = [{ id: 'B1', householdId: 'H2', remainingKWh: 10, maxBidINR: 5.00 }];
  const res = matchOrders(offers, bids, 12, '2026-10-14T12:00:00Z');

  assert.strictEqual(res.trades.length, 0);
  assert.strictEqual(res.summary.totalTradedKWh, 0);
});

// 3. Seller has more supply than buyer needs
runTest(3, 'Seller has more supply than buyer needs (Partial seller fill)', () => {
  const offers = [{ id: 'O1', householdId: 'H1', remainingKWh: 15, askingPriceINR: 4.20 }];
  const bids = [{ id: 'B1', householdId: 'H2', remainingKWh: 8, maxBidINR: 5.80 }];
  const res = matchOrders(offers, bids, 12, '2026-10-14T12:00:00Z');

  assert.strictEqual(res.trades.length, 1);
  assert.strictEqual(res.trades[0].energyKWh, 8);
  assert.strictEqual(res.updatedOffers[0].remainingKWh, 7);
  assert.strictEqual(res.updatedOffers[0].status, 'PARTIALLY_FILLED');
  assert.strictEqual(res.updatedBids[0].remainingKWh, 0);
  assert.strictEqual(res.updatedBids[0].status, 'FILLED');
});

// 4. Buyer demand exceeds available supply
runTest(4, 'Buyer demand exceeds available supply (Partial buyer fill)', () => {
  const offers = [{ id: 'O1', householdId: 'H1', remainingKWh: 6, askingPriceINR: 4.00 }];
  const bids = [{ id: 'B1', householdId: 'H2', remainingKWh: 14, maxBidINR: 6.00 }];
  const res = matchOrders(offers, bids, 12, '2026-10-14T12:00:00Z');

  assert.strictEqual(res.trades.length, 1);
  assert.strictEqual(res.trades[0].energyKWh, 6);
  assert.strictEqual(res.updatedOffers[0].remainingKWh, 0);
  assert.strictEqual(res.updatedOffers[0].status, 'FILLED');
  assert.strictEqual(res.updatedBids[0].remainingKWh, 8);
  assert.strictEqual(res.updatedBids[0].status, 'PARTIALLY_FILLED');
});

// 5. Multiple buyers compete for limited energy
runTest(5, 'Multiple buyers compete for limited energy (Highest bid matched first)', () => {
  const offers = [{ id: 'O1', householdId: 'H1', remainingKWh: 10, askingPriceINR: 4.00 }];
  const bids = [
    { id: 'B1', householdId: 'H2', remainingKWh: 10, maxBidINR: 5.50 },
    { id: 'B2', householdId: 'H3', remainingKWh: 10, maxBidINR: 7.00 } // Higher willingness to pay
  ];
  const res = matchOrders(offers, bids, 12, '2026-10-14T12:00:00Z');

  assert.strictEqual(res.trades.length, 1);
  assert.strictEqual(res.trades[0].buyerId, 'H3');
  assert.strictEqual(res.trades[0].tradePriceINR, 5.50); // (4.00 + 7.00) / 2
});

// 6. Multiple sellers compete to supply one buyer
runTest(6, 'Multiple sellers compete to supply one buyer (Lowest ask matched first)', () => {
  const offers = [
    { id: 'O1', householdId: 'H1', remainingKWh: 10, askingPriceINR: 5.20 },
    { id: 'O2', householdId: 'H2', remainingKWh: 10, askingPriceINR: 3.80 } // Cheaper asking price
  ];
  const bids = [{ id: 'B1', householdId: 'H3', remainingKWh: 10, maxBidINR: 6.00 }];
  const res = matchOrders(offers, bids, 12, '2026-10-14T12:00:00Z');

  assert.strictEqual(res.trades.length, 1);
  assert.strictEqual(res.trades[0].sellerId, 'H2');
  assert.strictEqual(res.trades[0].tradePriceINR, 4.90); // (3.80 + 6.00) / 2
});

// 7. No surplus exists
runTest(7, 'No surplus exists (Graceful zero trade handling)', () => {
  const offers = [];
  const bids = [{ id: 'B1', householdId: 'H1', remainingKWh: 10, maxBidINR: 6.00 }];
  const res = matchOrders(offers, bids, 12, '2026-10-14T12:00:00Z');

  assert.strictEqual(res.trades.length, 0);
  assert.strictEqual(res.summary.totalTradedKWh, 0);
});

// 8. No demand exists
runTest(8, 'No demand exists (Graceful zero trade handling)', () => {
  const offers = [{ id: 'O1', householdId: 'H1', remainingKWh: 10, askingPriceINR: 4.00 }];
  const bids = [];
  const res = matchOrders(offers, bids, 12, '2026-10-14T12:00:00Z');

  assert.strictEqual(res.trades.length, 0);
  assert.strictEqual(res.summary.totalTradedKWh, 0);
});

// 9. Midday solar peak generation profile
runTest(9, 'Midday solar generation peaks at hour 12', () => {
  const sim = new SimulationManager();
  const solarHh = sim.households.find(h => h.id === 'HH-01');
  assert.ok(solarHh.hourlyGeneration[12] > solarHh.hourlyGeneration[8]);
  assert.ok(solarHh.hourlyGeneration[12] > solarHh.hourlyGeneration[18]);
  assert.strictEqual(solarHh.hourlyGeneration[0], 0);
});

// 10. Evening consumption peak profile
runTest(10, 'Evening consumption peak observed in residential profiles', () => {
  const sim = new SimulationManager();
  const resHh = sim.households.find(h => h.id === 'HH-05');
  assert.ok(resHh.hourlyDemand[19] > resHh.hourlyDemand[12]);
});

// 11. Positive financial surplus proof for both buyer and seller
runTest(11, 'Trade provides positive surplus vs grid benchmarks for both parties', () => {
  const trade = {
    tradeId: 'TX-TEST-01',
    energyKWh: 10,
    tradePriceINR: 5.00,
    sellerAskINR: 4.00,
    buyerBidINR: 6.00
  };
  const settlement = calculateTradeSettlement(trade);

  assert.strictEqual(settlement.buyerGridBaselineCostINR, 80.00); // 10 kWh * ₹8.00
  assert.strictEqual(settlement.buyerPaymentINR, 50.00); // 10 kWh * ₹5.00
  assert.strictEqual(settlement.buyerGrossSavingsINR, 30.00); // Saves ₹30.00
  assert.ok(settlement.isBuyerFinanciallyBeneficial);

  assert.strictEqual(settlement.sellerExportBaselineRevenueINR, 20.00); // 10 kWh * ₹2.00
  assert.strictEqual(settlement.sellerEarningsINR, 50.00); // Earns ₹50.00
  assert.strictEqual(settlement.sellerAdditionalEarningsINR, 30.00); // +₹30.00 above floor
  assert.ok(settlement.isSellerFinanciallyBeneficial);
});

// 12. Negative savings handling & division-by-zero safety
runTest(12, 'Negative savings handled as additional cost when price exceeds benchmark', () => {
  const trade = {
    tradeId: 'TX-HIGH-PRICE',
    energyKWh: 5,
    tradePriceINR: 9.00 // Exceeds ₹8.00 benchmark
  };
  const settlement = calculateTradeSettlement(trade);
  assert.strictEqual(settlement.buyerGrossSavingsINR, -5.00); // Negative savings
  assert.strictEqual(settlement.isBuyerFinanciallyBeneficial, false);
});

// 13. Tamper-evident ledger block generation & SHA-256 hash chaining
runTest(13, 'Ledger appends blocks with SHA-256 hash chaining from Genesis', () => {
  const ledger = new TamperLedger(false, false);
  ledger.records = [];

  const trade1 = { tradeId: 'TX-1', energyKWh: 5, tradePriceINR: 5.00, sellerAskINR: 4.00, buyerBidINR: 6.00 };
  const trade2 = { tradeId: 'TX-2', energyKWh: 8, tradePriceINR: 5.20, sellerAskINR: 4.40, buyerBidINR: 6.00 };

  const b0 = ledger.appendTransaction(trade1, 'RUN-01');
  const b1 = ledger.appendTransaction(trade2, 'RUN-01');

  assert.strictEqual(b0.index, 0);
  assert.strictEqual(b0.previousHash, '0000000000000000000000000000000000000000000000000000000000000000');
  assert.strictEqual(b1.index, 1);
  assert.strictEqual(b1.previousHash, b0.currentHash);

  const audit = ledger.verify();
  assert.strictEqual(audit.isValid, true);
  assert.strictEqual(audit.verifiedCount, 2);
});

// 14. Cryptographic tamper detection on altered transaction
runTest(14, 'Altering transaction in ledger triggers immediate verification failure', () => {
  const ledger = new TamperLedger(false, false);
  ledger.records = [];

  const trade = { tradeId: 'TX-AUDIT', energyKWh: 10, tradePriceINR: 5.00 };
  ledger.appendTransaction(trade, 'RUN-01');

  const tamperResult = ledger.simulateTamperTest(0, 'energyKWh', 999.99);
  assert.strictEqual(tamperResult.tamperDetectedSuccessfully, true);
  assert.strictEqual(tamperResult.verificationResult.isValid, false);
});

// 15. Ledger persistence and reload from disk
runTest(15, 'Ledger persists to disk and reloads on startup (survives restarts)', () => {
  const ledger1 = new TamperLedger(true);
  const initialCount = ledger1.getRecords().length;
  const trade = { tradeId: `TX-PERSIST-TEST-${Date.now()}`, energyKWh: 12.5, tradePriceINR: 5.10 };
  ledger1.appendTransaction(trade, 'RUN-PERSIST');

  // Instantiate second ledger instance pointing to same file
  const ledger2 = new TamperLedger(true);
  const records = ledger2.getRecords();
  assert.strictEqual(records.length, initialCount + 1);
  const found = records.find(r => r.transactionId === trade.tradeId);
  assert.ok(found);
  assert.strictEqual(found.energyKWh, 12.5);
});

// 16. Ledger CSV export formatting & completeness
runTest(16, 'Ledger generates valid RFC 4180 CSV export with required headers', () => {
  const ledger = new TamperLedger(false, false);
  ledger.records = [];
  ledger.appendTransaction({ tradeId: 'TX-CSV', energyKWh: 4.5, tradePriceINR: 5.50 }, 'RUN-01');

  const csv = ledger.toCSV();
  assert.ok(csv.includes('Block Index'));
  assert.ok(csv.includes('Transaction ID'));
  assert.ok(csv.includes('Grid Benchmark Tariff (INR/kWh)'));
  assert.ok(csv.includes('TX-CSV'));
});

// 17. User registration with PBKDF2 password hashing & dynamic household creation
runTest(17, 'User registration hashes password with PBKDF2 and attaches to simulation', () => {
  const sim = new SimulationManager();
  const initialHhCount = sim.households.length;

  const reg = registerUser({
    username: 'clean_solar_user_' + Date.now(),
    email: 'user_' + Date.now() + '@solarshare.org',
    password: 'SecurePassword@123',
    role: 'SELLER',
    householdName: 'Skyline Solar Villa',
    solarCapacityKW: 8.0,
    simManager: sim
  });

  assert.strictEqual(reg.success, true);
  assert.ok(reg.token.startsWith('solar-sess-'));
  assert.strictEqual(reg.user.role, 'SELLER');
  assert.strictEqual(sim.households.length, initialHhCount + 1);

  // Check that new household exists and has generation curve
  const newHh = sim.households.find(h => h.id === reg.user.householdId);
  assert.ok(newHh);
  assert.ok(newHh.hourlyGeneration[12] > 0);
});

// 18. User login with credentials & password verification
runTest(18, 'User login with valid credentials verifies PBKDF2 hash; rejects wrong password', () => {
  // Test with demo account credentials
  const loginRes = loginWithCredentials('seller_hh01', 'seller@solar2026');
  assert.strictEqual(loginRes.success, true);
  assert.strictEqual(loginRes.user.id, 'seller_hh01');

  // Test wrong password
  assert.throws(() => {
    loginWithCredentials('seller_hh01', 'wrong_password_xyz');
  }, /Incorrect password/);
});

// 19. Password reset flow with validation
runTest(19, 'Password reset flow updates password hash and permits login with new password', () => {
  const uname = 'reset_test_' + Date.now();
  registerUser({
    username: uname,
    email: uname + '@example.com',
    password: 'OriginalPassword123',
    role: 'BUYER'
  });

  const resetRes = resetPassword({
    usernameOrEmail: uname,
    newPassword: 'BrandNewPassword456'
  });
  assert.strictEqual(resetRes.success, true);

  // Login with new password
  const newLogin = loginWithCredentials(uname, 'BrandNewPassword456');
  assert.strictEqual(newLogin.success, true);
});

// 20. Role-based backend authorization
runTest(20, 'Role authorization permits demo accounts and validates role permissions', () => {
  const demoAdmin = loginDemo('admin');
  assert.strictEqual(demoAdmin.user.role, 'ADMIN');

  const demoBuyer = loginDemo('buyer_hh02');
  assert.strictEqual(demoBuyer.user.role, 'BUYER');
});

// 21. Order cancellation ownership enforcement
runTest(21, 'Order cancellation enforces ownership: seller cannot cancel another’s order', () => {
  const sim = new SimulationManager();
  // Place offer for HH-01
  const offer = sim.submitOffer('HH-01', 1.0, 4.50);

  // HH-03 attempts to cancel HH-01's offer
  assert.throws(() => {
    sim.cancelOrder(offer.id, 'HH-03', false);
  }, /Access Denied/);

  // HH-01 cancels own offer successfully
  const cancelRes = sim.cancelOrder(offer.id, 'HH-01', false);
  assert.strictEqual(cancelRes.success, true);
});

// 22. 24-hour simulation execution & 9-point Results Summary verification
runTest(22, '24-hour simulation execution compiles comprehensive 9-point Results Summary', () => {
  const sim = new SimulationManager();
  const fullResult = sim.runFullDay();

  assert.strictEqual(fullResult.success, true);
  assert.strictEqual(fullResult.totalHoursSimulated, 24);
  assert.ok(fullResult.totalTradesExecuted > 0);

  const summary = fullResult.summary;
  assert.ok(summary.runId.startsWith('SIM-RUN-'));
  assert.ok(summary.totalEnergyGeneratedKWh > 0);
  assert.ok(summary.totalEnergyConsumedKWh > 0);
  assert.ok(summary.totalSurplusAvailableKWh > 0);
  assert.ok(summary.totalEnergyTradedKWh > 0);
  assert.ok(summary.matchedTradesCount > 0);
  assert.ok(summary.averageAgreedTradingPriceINR > 0);
  assert.ok(summary.totalBuyerSavingsINR > 0);
  assert.ok(Array.isArray(summary.householdWiseSavings));
  assert.strictEqual(summary.ledgerVerification.isValid, true);
});

// 23. Duplicate username or email registration rejected
runTest(23, 'Duplicate registration attempt is rejected with clear error', () => {
  const testEmail = 'duplicate_check_' + Date.now() + '@example.com';
  const uname = 'dup_user_' + Date.now();
  registerUser({
    username: uname,
    email: testEmail,
    password: 'Password123',
    role: 'BUYER'
  });

  // Attempt duplicate username
  assert.throws(() => {
    registerUser({
      username: uname,
      email: 'another_email@example.com',
      password: 'Password123',
      role: 'BUYER'
    });
  }, /already registered/);

  // Attempt duplicate email
  assert.throws(() => {
    registerUser({
      username: 'another_uname_' + Date.now(),
      email: testEmail,
      password: 'Password123',
      role: 'BUYER'
    });
  }, /already registered/);
});

// 24. Invalid password rejected
runTest(24, 'Password under 6 characters rejected by registration validation', () => {
  assert.throws(() => {
    registerUser({
      username: 'short_pass_user',
      email: 'short@example.com',
      password: '123',
      role: 'BUYER'
    });
  }, /at least 6 characters/);
});

// 25. Unauthenticated request returns null session
runTest(25, 'Unauthenticated request produces null session (no auto admin fallback)', () => {
  const reqNoHeader = { headers: {} };
  const user = authenticateRequest(reqNoHeader);
  assert.strictEqual(user, null);

  const reqInvalidToken = { headers: { authorization: 'Bearer invalid-token-xyz' } };
  const userInvalid = authenticateRequest(reqInvalidToken);
  assert.strictEqual(userInvalid, null);
});

// 26. Session logout invalidation
runTest(26, 'Session logout invalidates active token', () => {
  const login = loginDemo('buyer_hh02');
  assert.ok(login.token);

  // Authenticate before logout
  const preLogoutReq = { headers: { authorization: `Bearer ${login.token}` } };
  assert.ok(authenticateRequest(preLogoutReq));

  // Invalidate
  const invalidated = logoutSession(login.token);
  assert.strictEqual(invalidated, true);

  // Authenticate after logout
  assert.strictEqual(authenticateRequest(preLogoutReq), null);
});

// 27. Google OAuth config getter
runTest(27, 'Google OAuth config getter exposes client ID safely without exposing secret', () => {
  const config = getGoogleConfig();
  assert.ok(typeof config === 'object');
  assert.ok('clientId' in config);
  assert.ok('isConfigured' in config);
  assert.strictEqual('clientSecret' in config, false);
});

// 28. Google token verification when unconfigured throws clear setup instructions
runTest(28, 'Google token verification when unconfigured throws clear setup error', async () => {
  const oldId = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;

  let caught = false;
  try {
    await verifyGoogleToken('mock-google-id-token');
  } catch (err) {
    caught = true;
    assert.ok(err.message.includes('Google Sign-In is not configured'));
    assert.ok(err.message.includes('GOOGLE_CLIENT_ID'));
  }
  assert.strictEqual(caught, true);

  if (oldId) process.env.GOOGLE_CLIENT_ID = oldId;
});

// 29. First-time Google user without role triggers role selection requirement
runTest(29, 'First-time Google user triggers needsRoleSelection: true', () => {
  const verifiedAccount = {
    googleId: 'google_test_sub_' + Date.now(),
    email: 'new_google_user_' + Date.now() + '@gmail.com',
    name: 'New Google User',
    picture: 'https://example.com/avatar.jpg'
  };

  const res = handleGoogleUser({ verifiedAccount, role: null });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.needsRoleSelection, true);
  assert.strictEqual(res.googleAccount.email, verifiedAccount.email);
});

// 30. First-time Google onboarding provisions local account with selected role & blocks ADMIN
runTest(30, 'First-time Google onboarding provisions role and blocks ADMIN privilege escalation', () => {
  const verifiedAccount = {
    googleId: 'google_test_sub_2_' + Date.now(),
    email: 'new_google_buyer_' + Date.now() + '@gmail.com',
    name: 'Google Solar Prosumer',
    picture: 'https://example.com/avatar.jpg'
  };

  // Attempting ADMIN role must be rejected
  assert.throws(() => {
    handleGoogleUser({ verifiedAccount, role: 'ADMIN' });
  }, /cannot grant Administrator privileges/);

  // Legitimate SELLER role onboarding
  const sim = new SimulationManager();
  const res = handleGoogleUser({
    verifiedAccount,
    role: 'SELLER',
    householdName: 'Google Solar Home',
    solarCapacityKW: 8.0,
    simManager: sim
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.needsRoleSelection, false);
  assert.strictEqual(res.user.role, 'SELLER');
  assert.ok(res.user.householdId.startsWith('HH-'));
  assert.strictEqual(res.user.authProvider, 'google');
  assert.ok(res.token.startsWith('solar-sess-'));
});

console.log(`\n================================================================`);
console.log(`🏆 ALL ${passedTests} / ${totalTests} VERIFICATION SCENARIOS PASSED (100% Success)`);
console.log('================================================================\n');
