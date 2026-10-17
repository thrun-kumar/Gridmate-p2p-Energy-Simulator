const http = require('http');

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL('http://localhost:5000' + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers
    };
    http.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const adminAuth = { Authorization: 'Bearer solar-token-admin' };

  const health = await get('/api/health');
  console.log('✅ Health API:', health.status, health.body.service);
  
  const net = await get('/api/grid/network');
  console.log('✅ Grid Network API:', net.body.zones.map(z => z.id).join(', '), '| Routes:', net.body.routes.length);
  
  const routes = await get('/api/grid/routes');
  console.log('✅ Grid Routes API:', routes.body.routes.map(r => `${r.routeId} (${r.fromZone}->${r.toZone}: ${r.lossPercentage}%, ₹${r.wheelingChargeINRPerKWh})`).slice(0, 3).join(', '));

  const hh02 = await get('/api/households/HH-02', adminAuth);
  console.log('✅ HH-02 (Buyer):', hh02.body.household.name, '| Solar KW:', hh02.body.household.solarCapacityKW, '| Zone:', hh02.body.household.zone, '| No Solar Required:', hh02.body.household.noSolarPanelsRequired);

  const hh01 = await get('/api/households/HH-01', adminAuth);
  console.log('✅ HH-01 (Seller):', hh01.body.household.name, '| Solar KW:', hh01.body.household.solarCapacityKW, '| Zone:', hh01.body.household.zone, '| Export Capacity KW:', hh01.body.household.exportCapacityKW);

  const verify = await get('/api/ledger/verify');
  console.log('✅ Ledger Verify API:', verify.body.isValid, '| Verified Blocks:', verify.body.verifiedCount);
}

run().catch(console.error);
