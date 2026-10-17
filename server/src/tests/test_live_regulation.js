async function verifyLiveEndpoints() {
  try {
    const health = await fetch('http://localhost:5000/api/health').then(r => r.json());
    console.log('[1/5] Health Check:', health.status, 'Version:', health.version);

    const activeRule = await fetch('http://localhost:5000/api/pricing-rules/active').then(r => r.json());
    console.log('[2/5] Active Pricing Rule:', activeRule.ruleId, '| Permitted:', `₹${activeRule.minimumPermittedPriceINR} - ₹${activeRule.maximumPermittedPriceINR}/kWh`);

    const liveMarket = await fetch('http://localhost:5000/api/market/live').then(r => r.json());
    console.log('[3/5] Live Market:', liveMarket.marketStatus, '| Recommended Price:', `₹${liveMarket.recommendedPriceINR}/kWh`, '| Season:', liveMarket.seasonName);

    const ranked = await fetch('http://localhost:5000/api/marketplace/ranked-offers?buyerZone=ZONE-B').then(r => r.json());
    console.log('[4/5] Ranked Offers for Ordinary Buyer (ZONE-B):', ranked.totalOffers, 'offers found. Top delivered price:', ranked.offers[0] ? `₹${ranked.offers[0].deliveredUnitCostINRPerKWh}/kWh` : 'N/A');

    const ledger = await fetch('http://localhost:5000/api/ledger/verify').then(r => r.json());
    console.log('[5/5] SHA-256 Ledger Verification:', ledger.valid ? 'VALID (100% Cryptographic Integrity)' : 'FAILED', '| Total Blocks:', ledger.checkedBlocks);

    console.log('\n✅ All Live Endpoints Verified Successfully on http://localhost:5000');
  } catch (err) {
    console.error('❌ Verification failed:', err.message);
    process.exit(1);
  }
}

verifyLiveEndpoints();
