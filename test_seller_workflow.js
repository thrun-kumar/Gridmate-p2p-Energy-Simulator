const http = require('http');

function post(path, body = {}, token = null) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'POST',
      headers
    }, res => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(buf) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: buf });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token = null) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    http.get({
      hostname: 'localhost',
      port: 5000,
      path,
      headers
    }, res => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(buf) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: buf });
        }
      });
    }).on('error', reject);
  });
}

async function runSellerTest() {
  console.log('================================================================');
  console.log('⚡ SolarShare: Live Verification of Seller Surplus & Offer Flow');
  console.log('================================================================\n');

  // Step 1: Reset simulator to 10:00 AM baseline
  console.log('1. Resetting simulation to 10:00 AM daytime state...');
  const resetRes = await post('/api/simulation/reset', { startHour: 10 });
  if (resetRes.status !== 200) throw new Error('Reset failed: ' + JSON.stringify(resetRes));
  console.log('   ✅ Simulator reset to 10:00 AM.\n');

  // Step 2: Login as primary demo seller (seller_hh01)
  console.log('2. Authenticating as seller seller_hh01...');
  const loginRes = await post('/api/auth/login', { accountId: 'seller_hh01' });
  if (loginRes.status !== 200 || !loginRes.data.token) {
    throw new Error('Seller login failed: ' + JSON.stringify(loginRes));
  }
  const sellerToken = loginRes.data.token;
  console.log('   ✅ Logged in successfully as HH-01 (Green Meadows Villa).\n');

  // Step 3: Fetch HH-01 dashboard metrics
  console.log('3. Inspecting initial solar generation, demand, and uncommitted surplus...');
  const hhRes = await get('/api/households/HH-01', sellerToken);
  const m = hhRes.data.metrics;
  console.log(`   - Solar Output:          ${m.generationKWh.toFixed(2)} kWh`);
  console.log(`   - Home Consumption:      ${m.demandKWh.toFixed(2)} kWh`);
  console.log(`   - Net Solar Surplus:     ${m.surplusKWh.toFixed(2)} kWh`);
  console.log(`   - Committed in Offers:   ${m.committedSurplusKWh.toFixed(2)} kWh`);
  console.log(`   - Available to Sell:     ${m.uncommittedSurplusKWh.toFixed(2)} kWh`);

  if (m.surplusKWh !== 6.66 || m.uncommittedSurplusKWh !== 6.66) {
    throw new Error(`Expected surplus & uncommitted surplus to be 6.66 kWh, got surplus=${m.surplusKWh}, uncommitted=${m.uncommittedSurplusKWh}`);
  }
  console.log('   ✅ Seller has full 6.66 kWh surplus uncommitted and ready to sell.\n');

  // Step 4: Accept Recommended Price (1-click action: 6.66 kWh @ ₹5.00/kWh)
  console.log('4. Executing Action: "Accept Recommended Price" (6.66 kWh @ ₹5.00/kWh)...');
  const offerRes = await post('/api/marketplace/offers', {
    householdId: 'HH-01',
    energyKWh: 6.66,
    askingPriceINR: 5.00
  }, sellerToken);
  if (offerRes.status !== 201 || !offerRes.data.offer) {
    throw new Error('Offer submission failed: ' + JSON.stringify(offerRes));
  }
  const offerId = offerRes.data.offer.id;
  console.log(`   ✅ Offer ${offerId} published successfully! Status: ${offerRes.data.offer.status}, Price: ₹${offerRes.data.offer.askingPriceINR}/kWh.\n`);

  // Step 5: Check metrics after offer is active
  console.log('5. Verifying household metrics after offer is published...');
  const hhAfterOffer = await get('/api/households/HH-01', sellerToken);
  const mAfter = hhAfterOffer.data.metrics;
  console.log(`   - Committed in Offers:   ${mAfter.committedSurplusKWh.toFixed(2)} kWh`);
  console.log(`   - Available to Sell:     ${mAfter.uncommittedSurplusKWh.toFixed(2)} kWh`);
  console.log(`   - Active Offers Count:   ${hhAfterOffer.data.activeOffers.length}`);
  if (mAfter.committedSurplusKWh !== 6.66 || mAfter.uncommittedSurplusKWh !== 0.00 || hhAfterOffer.data.activeOffers.length !== 1) {
    throw new Error('Committed surplus mismatch after publishing offer');
  }
  console.log('   ✅ Surplus 100% active in market offer without false zero-generation alerts.\n');

  // Step 6: Update asking price to ₹4.75/kWh
  console.log('6. Updating offer asking price to ₹4.75/kWh via update endpoint...');
  const updateRes = await post(`/api/marketplace/offers/${offerId}/update`, {
    energyKWh: 6.66,
    askingPriceINR: 4.75
  }, sellerToken);
  if (updateRes.status !== 200 || updateRes.data.offer.askingPriceINR !== 4.75) {
    throw new Error('Offer update failed: ' + JSON.stringify(updateRes));
  }
  console.log(`   ✅ Offer updated successfully to ₹${updateRes.data.offer.askingPriceINR.toFixed(2)}/kWh.\n`);

  // Step 7: Cancel offer to re-list
  console.log('7. Cancelling offer to release surplus back to uncommitted state...');
  const cancelRes = await post(`/api/marketplace/orders/${offerId}/cancel`, {}, sellerToken);
  if (cancelRes.status !== 200) {
    throw new Error('Cancel failed: ' + JSON.stringify(cancelRes));
  }
  console.log('   ✅ Offer cancelled successfully.\n');

  // Step 8: Verify surplus is immediately uncommitted
  console.log('8. Verifying uncommitted surplus restored after cancellation...');
  const hhAfterCancel = await get('/api/households/HH-01', sellerToken);
  const mCancel = hhAfterCancel.data.metrics;
  console.log(`   - Available to Sell:     ${mCancel.uncommittedSurplusKWh.toFixed(2)} kWh`);
  console.log(`   - Active Offers Count:   ${hhAfterCancel.data.activeOffers.length}`);
  if (mCancel.uncommittedSurplusKWh !== 6.66 || hhAfterCancel.data.activeOffers.length !== 0) {
    throw new Error('Surplus not restored after cancellation');
  }
  console.log('   ✅ Full 6.66 kWh surplus uncommitted and ready to re-list.\n');

  // Step 9: Submit custom offer (4.50 kWh @ ₹4.50/kWh)
  console.log('9. Submitting custom offer from form: 4.50 kWh at ₹4.50/kWh...');
  const customOffer = await post('/api/marketplace/offers', {
    householdId: 'HH-01',
    energyKWh: 4.50,
    askingPriceINR: 4.50
  }, sellerToken);
  if (customOffer.status !== 201) {
    throw new Error('Custom offer failed: ' + JSON.stringify(customOffer));
  }
  console.log(`   ✅ Custom offer ${customOffer.data.offer.id} published successfully!\n`);

  // Step 10: Verify partial uncommitted surplus remaining
  console.log('10. Verifying partial uncommitted surplus...');
  const hhPartial = await get('/api/households/HH-01', sellerToken);
  const mPartial = hhPartial.data.metrics;
  console.log(`   - Committed in Offers:   ${mPartial.committedSurplusKWh.toFixed(2)} kWh`);
  console.log(`   - Available to Sell:     ${mPartial.uncommittedSurplusKWh.toFixed(2)} kWh`);
  if (Math.abs(mPartial.committedSurplusKWh - 4.50) > 0.01 || Math.abs(mPartial.uncommittedSurplusKWh - 2.16) > 0.01) {
    throw new Error(`Expected committed 4.50, uncommitted 2.16, got committed=${mPartial.committedSurplusKWh}, uncommitted=${mPartial.uncommittedSurplusKWh}`);
  }
  console.log('   ✅ Partial surplus calculated with mathematical accuracy (2.16 kWh still available).\n');

  console.log('================================================================');
  console.log('🎯 ALL 10 SELLER SURPLUS & OFFER WORKFLOW TESTS PASSED (100%)');
  console.log('================================================================');
}

runSellerTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
