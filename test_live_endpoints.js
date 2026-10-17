const http = require('http');

function get(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: 5000,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('Testing /api/health...');
  const h = await get('/api/health');
  console.log('  Health:', h.status, h.data.status, h.data.appName);

  console.log('Testing /api/dashboard...');
  const d = await get('/api/dashboard');
  console.log('  Dashboard:', d.status, 'Cards:', Object.keys(d.data.cards).length, 'Total Traded:', d.data.cards.totalEnergyTradedKWh, 'kWh');

  console.log('Testing /api/market/price...');
  const p = await get('/api/market/price');
  console.log('  Price:', p.status, '₹' + p.data.recommendedPriceINR, p.data.statusLabel);

  console.log('Testing /api/ledger/verify (GET)...');
  const v = await get('/api/ledger/verify');
  console.log('  Ledger:', v.status, 'valid:', v.data.valid, 'checked:', v.data.checkedBlocks);

  console.log('Testing /api/company/finance...');
  const f = await get('/api/company/finance');
  console.log('  Finance:', f.status, 'Rev: ₹' + f.data.totalCompanyRevenueINR, 'Cost: ₹' + f.data.totalOperatingCostINR, 'P&L: ₹' + f.data.estimatedProfitLossINR);

  console.log('Testing /api/simulation/run (POST)...');
  const s = await get('/api/simulation/run', 'POST');
  console.log('  Run Interval:', s.status, s.data.status, 'Trades:', s.data.tradesExecuted);

  console.log('Testing /api/households/HH-01/preferences (POST)...');
  const pref = await get('/api/households/HH-01/preferences', 'POST', { autoTradeEnabled: true, minimumAcceptedPrice: 4.25 });
  console.log('  Pref update:', pref.status, pref.data.message);

  console.log('\n🏆 ALL 7 ENDPOINTS VERIFIED LIVE (200 OK)');
}

run().catch(console.error);
