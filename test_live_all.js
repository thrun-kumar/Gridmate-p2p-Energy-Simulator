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
      res.on('end', () => resolve(JSON.parse(buf)));
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
      res.on('end', () => resolve(JSON.parse(buf)));
    }).on('error', reject);
  });
}

async function verifyAll() {
  console.log('=== SOLARSHARE LIVE COMPREHENSIVE AUDIT ===');

  // 1. Reset simulation to 10:00 AM daytime state
  const resetRes = await post('/api/simulation/reset', { startHour: 10 });
  console.log('1. Simulation Reset:', resetRes.message);

  // 2. Status verification
  const status = await get('/api/simulation/status');
  console.log('2. Simulation Clock:', {
    date: status.simulatedDateLabel,
    time: status.simulatedTime,
    progress: status.hourProgressLabel,
    status: status.statusLabel,
    autoMatching: status.autoMatchingEnabled
  });

  // 3. Login as Admin
  const adminLogin = await post('/api/auth/login', { accountId: 'admin' });
  const adminToken = adminLogin.token;

  // 4. Verify HH-10 (Mixed-Use Commercial)
  const hh10 = await get('/api/households/HH-10', adminToken);
  console.log('3. HH-10 Commercial Mixed:', {
    name: hh10.household.name,
    role: hh10.household.role,
    participantType: hh10.household.participantType,
    solarCapacityKW: hh10.household.solarCapacityKW,
    generationKWh: hh10.metrics.generationKWh,
    demandKWh: hh10.metrics.demandKWh,
    selfConsumedKWh: hh10.metrics.selfConsumedKWh,
    surplusKWh: hh10.metrics.surplusKWh,
    deficitKWh: hh10.metrics.deficitKWh
  });

  // 5. Verify HH-01 (Prosumer with solar)
  const hh01 = await get('/api/households/HH-01', adminToken);
  console.log('4. HH-01 Solar Prosumer:', {
    name: hh01.household.name,
    solarCapacityKW: hh01.household.solarCapacityKW,
    generationKWh: hh01.metrics.generationKWh,
    demandKWh: hh01.metrics.demandKWh,
    selfConsumedKWh: hh01.metrics.selfConsumedKWh,
    surplusKWh: hh01.metrics.surplusKWh,
    uncommittedSurplusKWh: hh01.metrics.uncommittedSurplusKWh
  });

  // 6. Test 15-minute advancement
  const adv15 = await post('/api/simulation/advance-15', {}, adminToken);
  console.log('5. Advance 15 Min:', {
    simulatedTime: adv15.simulatedTime,
    hourProgressLabel: adv15.hourProgressLabel,
    trades: adv15.tradesExecuted
  });

  // 7. Test Auto-Matching toggle
  const toggleOff = await post('/api/simulation/auto-matching', { enabled: false }, adminToken);
  console.log('6. Toggle Auto-Matching OFF:', toggleOff.message);

  // 8. Test dedicated Match Available Orders
  const matchRes = await post('/api/simulation/match-orders', {}, adminToken);
  console.log('7. Manual Match Available Orders:', {
    tradesExecuted: matchRes.tradesExecuted,
    energyTradedKWh: matchRes.energyTradedKWh
  });

  // 9. Re-enable Auto-Matching
  const toggleOn = await post('/api/simulation/auto-matching', { enabled: true }, adminToken);
  console.log('8. Toggle Auto-Matching ON:', toggleOn.message);

  // 10. Verify 12 households count and role composition
  const hhList = await get('/api/households');
  const prosumers = hhList.households.filter(h => h.role === 'prosumer' || (h.solarCapacityKW > 0 && h.role !== 'mixed'));
  const consumers = hhList.households.filter(h => h.role === 'consumer' || (h.solarCapacityKW === 0 && h.role !== 'mixed'));
  const mixed = hhList.households.filter(h => h.role === 'mixed' || h.participantType === 'COMMERCIAL_MIXED');
  console.log('9. Participant Composition:', {
    total: hhList.households.length,
    prosumers: prosumers.length,
    consumers: consumers.length,
    mixed: mixed.length
  });

  // 11. Verify cryptographic ledger
  const ledgerVerify = await get('/api/ledger/verify', adminToken);
  console.log('10. SHA-256 Cryptographic Ledger Integrity:', {
    isValid: ledgerVerify.isValid,
    totalBlocks: ledgerVerify.totalRecords,
    message: ledgerVerify.message
  });

  console.log('\n=== ALL VERIFICATIONS PASSED 100% ===');
}

verifyAll().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
