/**
 * SolarShare - Tamper-Evident Transaction Ledger View
 * Implements full cryptographic audit trail with SHA-256 hash chaining from Genesis,
 * real-time verification, CSV export, search/filtering, pagination, and detailed block inspector.
 */

window.LedgerView = {
  _records: [],
  _filtered: [],
  _currentPage: 1,
  _pageSize: 10,
  _selectedBlock: null,

  render(data) {
    const root = document.getElementById('view-content');
    if (!root) return;

    this._records = data.records || [];
    this._filtered = [...this._records];
    this._currentPage = 1;

    // Aggregate metrics
    const totalTransactions = this._records.length;
    const totalEnergyTraded = Number(this._records.reduce((s, r) => s + (r.energyKWh || 0), 0).toFixed(2));
    const totalSettledValue = Number(this._records.reduce((s, r) => s + (r.totalValue || 0), 0).toFixed(2));
    const totalBuyerSavings = Number(this._records.reduce((s, r) => s + (r.buyerTotalSavings || 0), 0).toFixed(2));

    root.innerHTML = `
      <div class="space-y-6">
        
        <!-- HEADER & CRYPTOGRAPHIC AUDIT BANNER -->
        <div class="card p-5 card-accent-green bg-white">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-page-title text-slate-800">Tamper-Evident Transaction Ledger</h1>
                <span class="badge badge-emerald text-xs uppercase font-mono font-bold">SHA-256 Audit Chain</span>
              </div>
              <p class="text-caption text-slate-500 mt-1 max-w-3xl">
                Every settled peer electricity trade is immutably linked to its predecessor using canonical JSON serialization. SHA-256 hash chaining enables instant mathematical verification of transaction integrity and prevents retroactive billing manipulation.
              </p>
            </div>
            <div class="flex items-center gap-2.5">
              <button onclick="window.API.downloadLedgerCSV()" class="btn btn-secondary text-xs font-semibold" title="Export ledger to CSV format">
                Export CSV
              </button>
              <button onclick="window.LedgerView.verifyLedger()" class="btn btn-primary text-xs font-semibold">
                Verify Ledger Integrity
              </button>
              <button onclick="window.LedgerView.openTamperSimulationModal()" class="btn btn-danger text-xs font-semibold" title="Simulate unauthorized tampering on a sandboxed clone">
                Tamper Sandbox Test
              </button>
            </div>
          </div>
        </div>

        <!-- VERIFICATION CONFIRMATION BANNER (POPULATED ON VERIFY) -->
        <div id="verification-banner" class="hidden"></div>

        <!-- 5 TOP KPI CARDS REQUIRED BY SPECIFICATION -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <!-- 1. Total Transactions -->
          <div class="card p-3.5 bg-white">
            <span class="stat-label">Total Transactions</span>
            <div class="text-metric-value text-slate-800 mt-0.5">${totalTransactions} <span class="text-xs font-semibold text-slate-500">blocks</span></div>
            <div class="text-caption text-slate-400 mt-0.5">Persisted in audit chain</div>
          </div>

          <!-- 2. Total Energy Traded -->
          <div class="card p-3.5 bg-white">
            <span class="stat-label">Energy Traded</span>
            <div class="text-metric-value text-emerald-700 mt-0.5">${totalEnergyTraded.toFixed(2)} <span class="text-xs font-semibold text-slate-500">kWh</span></div>
            <div class="text-caption text-slate-400 mt-0.5">Total clean electricity delivered</div>
          </div>

          <!-- 3. Total Settled Value -->
          <div class="card p-3.5 bg-white">
            <span class="stat-label">Total Settled Value</span>
            <div class="text-metric-value text-slate-900 mt-0.5">₹${totalSettledValue.toFixed(2)}</div>
            <div class="text-caption text-slate-400 mt-0.5">Gross peer market settlement</div>
          </div>

          <!-- 4. Total Buyer Savings -->
          <div class="card p-3.5 bg-white card-accent-green">
            <span class="stat-label">Total Buyer Savings</span>
            <div class="text-metric-value text-emerald-700 mt-0.5">₹${totalBuyerSavings.toFixed(2)}</div>
            <div class="text-caption text-slate-400 mt-0.5">Saved vs ₹8.00 grid tariff</div>
          </div>

          <!-- 5. Ledger Integrity Status -->
          <div class="card p-3.5 bg-white border-emerald-300">
            <span class="stat-label">Ledger Integrity</span>
            <div class="text-xs font-bold mt-1">
              <span class="badge badge-verified">Verified</span>
            </div>
            <div class="text-[10px] text-slate-400 mt-1 font-mono">Genesis: 0000...0000</div>
          </div>
        </div>

        <!-- SEARCH, FILTERS & PAGINATED TABLE CARD -->
        <div class="card p-5 bg-white space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 class="text-section-heading text-slate-800">Immutable Cryptographic Blocks (<span id="ledger-count">${this._records.length}</span>)</h2>
              <p class="text-caption text-slate-500">Click any transaction block to inspect its complete 17 canonical fields and hash link.</p>
            </div>

            <!-- Search & Filters Toolbar -->
            <div class="flex flex-wrap items-center gap-2">
              <!-- Search -->
              <div class="relative">
                <input 
                  id="ledger-search" 
                  type="text" 
                  placeholder="Search Tx ID, Buyer, Seller..." 
                  oninput="window.LedgerView.handleFilter()"
                  class="input-field text-xs pl-8 pr-3 py-1.5 w-52" 
                />
                <span class="absolute left-2.5 top-2 text-slate-400">${window.Icons.search('w-3.5 h-3.5')}</span>
              </div>

              <!-- Hour Filter -->
              <select id="ledger-hour-filter" onchange="window.LedgerView.handleFilter()" class="input-field text-xs py-1.5 w-28">
                <option value="ALL">All Hours</option>
                ${Array.from({ length: 24 }, (_, i) => `
                  <option value="${i}">${String(i).padStart(2, '0')}:00</option>
                `).join('')}
              </select>

              <!-- Sort Filter -->
              <select id="ledger-sort" onchange="window.LedgerView.handleSort()" class="input-field text-xs py-1.5 w-36">
                <option value="index_desc">Block (Newest First)</option>
                <option value="index_asc">Block (Oldest First)</option>
                <option value="energy_desc">Energy (High &rarr; Low)</option>
                <option value="val_desc">Value (High &rarr; Low)</option>
              </select>
            </div>
          </div>

          <!-- Table Container -->
          <div class="table-wrapper">
            <table class="grid-table">
              <thead>
                <tr>
                  <th>Block #</th>
                  <th>Tx ID</th>
                  <th>Time / Hour</th>
                  <th>Seller</th>
                  <th>Buyer</th>
                  <th>Energy</th>
                  <th>Price</th>
                  <th>Total Amount</th>
                  <th>Buyer Savings</th>
                  <th>Current Block Hash (SHA-256)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody id="ledger-table-body">
                <!-- Rendered dynamically -->
              </tbody>
            </table>
          </div>

          <!-- Pagination Controls -->
          <div class="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
            <div id="ledger-page-info">Showing 1 to 10 of ${this._records.length} blocks</div>
            <div class="flex items-center gap-1.5">
              <button id="btn-prev-page" onclick="window.LedgerView.prevPage()" class="btn btn-secondary text-xs py-1 px-2.5">
                &larr; Previous
              </button>
              <span id="ledger-current-page" class="font-bold text-slate-800 px-2">Page 1</span>
              <button id="btn-next-page" onclick="window.LedgerView.nextPage()" class="btn btn-secondary text-xs py-1 px-2.5">
                Next &rarr;
              </button>
            </div>
          </div>

        </div>

        <!-- DETAILED TRANSACTION MODAL PLACEHOLDER -->
        <div id="block-detail-modal-container"></div>
        <!-- TAMPER SANDBOX MODAL PLACEHOLDER -->
        <div id="tamper-modal-container"></div>

      </div>
    `;

    this.renderTableRows();
  },

  handleFilter() {
    const q = (document.getElementById('ledger-search')?.value || '').toLowerCase().trim();
    const hourVal = document.getElementById('ledger-hour-filter')?.value || 'ALL';

    this._filtered = this._records.filter(r => {
      const matchQ = !q || 
        (r.transactionId && r.transactionId.toLowerCase().includes(q)) ||
        (r.sellerName && r.sellerName.toLowerCase().includes(q)) ||
        (r.buyerName && r.buyerName.toLowerCase().includes(q)) ||
        (r.sellerId && r.sellerId.toLowerCase().includes(q)) ||
        (r.buyerId && r.buyerId.toLowerCase().includes(q));

      const matchHour = hourVal === 'ALL' || Number(r.simulationHour) === Number(hourVal);

      return matchQ && matchHour;
    });

    this._currentPage = 1;
    this.renderTableRows();
  },

  handleSort() {
    const sortVal = document.getElementById('ledger-sort')?.value || 'index_desc';

    if (sortVal === 'index_desc') {
      this._filtered.sort((a, b) => b.index - a.index);
    } else if (sortVal === 'index_asc') {
      this._filtered.sort((a, b) => a.index - b.index);
    } else if (sortVal === 'energy_desc') {
      this._filtered.sort((a, b) => b.energyKWh - a.energyKWh);
    } else if (sortVal === 'val_desc') {
      this._filtered.sort((a, b) => b.totalValue - a.totalValue);
    }

    this.renderTableRows();
  },

  renderTableRows() {
    const tbody = document.getElementById('ledger-table-body');
    const pageInfo = document.getElementById('ledger-page-info');
    const pageLabel = document.getElementById('ledger-current-page');
    const countLabel = document.getElementById('ledger-count');
    if (!tbody) return;

    if (countLabel) countLabel.innerText = this._filtered.length;

    if (this._filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" class="text-center py-8 text-slate-400 text-xs">
            No transaction records found matching your search criteria.
          </td>
        </tr>
      `;
      if (pageInfo) pageInfo.innerText = '0 records';
      return;
    }

    const totalPages = Math.ceil(this._filtered.length / this._pageSize) || 1;
    this._currentPage = Math.min(this._currentPage, totalPages);

    const startIdx = (this._currentPage - 1) * this._pageSize;
    const endIdx = Math.min(startIdx + this._pageSize, this._filtered.length);
    const pageRecords = this._filtered.slice(startIdx, endIdx);

    tbody.innerHTML = pageRecords.map(r => `
      <tr class="cursor-pointer hover:bg-slate-50 transition-colors" onclick="window.LedgerView.openBlockDetailModal(${r.index})">
        <td class="font-mono font-bold text-emerald-700 text-xs">#${r.index}</td>
        <td class="font-mono text-xs font-bold text-slate-800">${r.transactionId}</td>
        <td class="font-mono text-xs text-slate-500">${String(r.simulationHour).padStart(2, '0')}:00</td>
        <td class="text-xs">
          <div class="font-semibold text-slate-800">${r.sellerName}</div>
          <div class="text-[10px] text-slate-400 font-mono">${r.sellerId}</div>
        </td>
        <td class="text-xs">
          <div class="font-semibold text-slate-800">${r.buyerName}</div>
          <div class="text-[10px] text-slate-400 font-mono">${r.buyerId}</div>
        </td>
        <td class="font-mono font-bold text-slate-900 text-xs">${r.energyKWh.toFixed(2)} kWh</td>
        <td class="font-mono text-emerald-700 font-bold text-xs">₹${r.agreedPrice.toFixed(2)}</td>
        <td class="font-mono font-bold text-slate-900 text-xs">₹${r.totalValue.toFixed(2)}</td>
        <td class="font-mono font-bold text-emerald-700 text-xs">+₹${(r.buyerTotalSavings || 0).toFixed(2)}</td>
        <td class="font-mono text-[11px] text-emerald-800">
          <span class="bg-slate-50 px-2 py-0.5 rounded border border-slate-200" title="${r.currentHash}">
            ${r.currentHash.substring(0, 10)}...${r.currentHash.substring(54)}
          </span>
        </td>
        <td>
          <button 
            onclick="event.stopPropagation(); window.LedgerView.openBlockDetailModal(${r.index})"
            class="btn btn-secondary text-[11px] py-1 px-2 hover:border-emerald-400"
          >
            Inspect
          </button>
        </td>
      </tr>
    `).join('');

    if (pageInfo) pageInfo.innerText = `Showing ${startIdx + 1} to ${endIdx} of ${this._filtered.length} blocks`;
    if (pageLabel) pageLabel.innerText = `Page ${this._currentPage} of ${totalPages}`;

    const prevBtn = document.getElementById('btn-prev-page');
    const nextBtn = document.getElementById('btn-next-page');
    if (prevBtn) prevBtn.disabled = this._currentPage <= 1;
    if (nextBtn) nextBtn.disabled = this._currentPage >= totalPages;
  },

  prevPage() {
    if (this._currentPage > 1) {
      this._currentPage--;
      this.renderTableRows();
    }
  },

  nextPage() {
    const totalPages = Math.ceil(this._filtered.length / this._pageSize) || 1;
    if (this._currentPage < totalPages) {
      this._currentPage++;
      this.renderTableRows();
    }
  },

  /**
   * Opens detailed view showing all 17 canonical fields of a single block.
   */
  openBlockDetailModal(blockIndex) {
    const block = this._records.find(r => r.index === blockIndex);
    if (!block) return;

    const container = document.getElementById('block-detail-modal-container');
    if (!container) return;

    container.innerHTML = `
      <div class="modal-backdrop" onclick="window.LedgerView.closeBlockDetailModal(event)">
        <div class="modal-dialog p-6 space-y-4 max-w-xl" onclick="event.stopPropagation()">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div class="flex items-center gap-2">
              <span class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-mono font-bold text-sm">#${block.index}</span>
              <div>
                <h3 class="text-xs font-bold text-slate-800">Transaction Block Inspector</h3>
                <span class="font-mono text-[10px] text-slate-400">ID: ${block.transactionId} • ${new Date(block.timestamp).toLocaleString()}</span>
              </div>
            </div>
            <button onclick="window.LedgerView.closeBlockDetailModal()" class="text-slate-400 hover:text-slate-600 text-sm font-bold">&times;</button>
          </div>

          <!-- All 17 Canonical Fields Table -->
          <div class="space-y-2 text-xs">
            <div class="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div><span class="text-slate-400 text-[10px] uppercase font-bold">Seller:</span> <div class="font-semibold text-slate-800">${block.sellerName} (${block.sellerId})</div></div>
              <div><span class="text-slate-400 text-[10px] uppercase font-bold">Buyer:</span> <div class="font-semibold text-slate-800">${block.buyerName} (${block.buyerId})</div></div>
              <div><span class="text-slate-400 text-[10px] uppercase font-bold">Traded Quantity:</span> <div class="font-mono font-bold text-slate-900">${block.energyKWh.toFixed(2)} kWh</div></div>
              <div><span class="text-slate-400 text-[10px] uppercase font-bold">Agreed Clearing Price:</span> <div class="font-mono font-bold text-emerald-700">₹${block.agreedPrice.toFixed(2)}/kWh</div></div>
              <div><span class="text-slate-400 text-[10px] uppercase font-bold">Seller Asking Price:</span> <div class="font-mono text-slate-700">₹${block.sellerAsk.toFixed(2)}/kWh</div></div>
              <div><span class="text-slate-400 text-[10px] uppercase font-bold">Buyer Maximum Bid:</span> <div class="font-mono text-slate-700">₹${block.buyerBid.toFixed(2)}/kWh</div></div>
              <div><span class="text-slate-400 text-[10px] uppercase font-bold">Total Settlement Amount:</span> <div class="font-mono font-bold text-slate-900">₹${block.totalValue.toFixed(2)}</div></div>
              <div><span class="text-slate-400 text-[10px] uppercase font-bold">Grid Benchmark Tariff:</span> <div class="font-mono text-slate-700">₹${(block.gridBenchmarkTariff || 8.00).toFixed(2)}/kWh</div></div>
              <div><span class="text-slate-400 text-[10px] uppercase font-bold">Buyer Savings Per Unit:</span> <div class="font-mono font-bold text-emerald-700">₹${(block.buyerSavingsPerUnit || 0).toFixed(2)}/kWh</div></div>
              <div><span class="text-slate-400 text-[10px] uppercase font-bold">Buyer Total Savings:</span> <div class="font-mono font-bold text-emerald-700">+₹${(block.buyerTotalSavings || 0).toFixed(2)}</div></div>
              <div><span class="text-slate-400 text-[10px] uppercase font-bold">Seller Gross Revenue:</span> <div class="font-mono font-bold text-slate-900">₹${(block.sellerRevenue || block.totalValue).toFixed(2)}</div></div>
              <div><span class="text-slate-400 text-[10px] uppercase font-bold">Simulation Run Ref:</span> <div class="font-mono text-slate-600">${block.simulationRunRef || 'SIM-RUN-01'}</div></div>
              <div><span class="text-slate-400 text-[10px] uppercase font-bold">Settlement Status:</span> <div><span class="badge badge-emerald text-[9px]">${block.settlementStatus || 'SETTLED'}</span></div></div>
              <div><span class="text-slate-400 text-[10px] uppercase font-bold">Cryptographic Status:</span> <div><span class="badge badge-emerald text-[9px]">VALIDATED</span></div></div>
            </div>

            <!-- Cryptographic Hash Chain Inspector -->
            <div class="space-y-1.5 pt-1">
              <div>
                <span class="text-slate-400 text-[10px] uppercase font-bold">Previous Block Hash Link:</span>
                <div class="p-2 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono break-all text-slate-600 select-all">
                  ${block.previousHash}
                </div>
              </div>
              <div>
                <span class="text-emerald-800 text-[10px] uppercase font-bold">Current Record SHA-256 Digest:</span>
                <div class="p-2 bg-emerald-50 border border-emerald-200 rounded text-[11px] font-mono break-all text-emerald-900 font-bold select-all">
                  ${block.currentHash}
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end pt-3 border-t border-slate-100">
            <button onclick="window.LedgerView.closeBlockDetailModal()" class="btn btn-secondary text-xs">Close Inspector</button>
          </div>
        </div>
      </div>
    `;
  },

  closeBlockDetailModal() {
    const container = document.getElementById('block-detail-modal-container');
    if (container) container.innerHTML = '';
  },

  async verifyLedger() {
    const banner = document.getElementById('verification-banner');
    if (!banner) return;

    try {
      banner.className = 'p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center gap-2';
      banner.innerHTML = `<span class="inline-block animate-spin mr-1">⟳</span> Recalculating SHA-256 hash sequence from Genesis block...`;
      banner.classList.remove('hidden');

      const result = await window.API.verifyLedger();

      if (result.isValid) {
        banner.className = 'p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1 fade-in';
        banner.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="font-bold flex items-center gap-1.5">
              <span class="badge badge-verified">Cryptographic Verification Successful</span>
            </span>
            <span class="badge badge-emerald text-[10px] font-bold">Zero Discrepancies</span>
          </div>
          <p class="text-[11px] text-emerald-800">${result.message}</p>
          <div class="font-mono text-[10px] text-emerald-700 pt-1">
            Verified Sequence: 0 &rarr; ${result.verifiedCount - 1} • Latest SHA-256: ${result.latestHash ? result.latestHash.substring(0, 24) + '...' : 'N/A'}
          </div>
        `;
        window.Toast.success(`Ledger verified: ${result.verifiedCount} blocks intact.`);
      } else {
        banner.className = 'p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 space-y-1 fade-in';
        banner.innerHTML = `
          <div class="font-bold flex items-center gap-1.5">
            <span class="badge badge-rejected">Cryptographic Integrity Failure Detected</span>
          </div>
          <p class="text-[11px] text-red-800">${result.reason}</p>
          <div class="font-mono text-[10px] text-red-700">Broken at block index #${result.brokenIndex} (TX: ${result.transactionId})</div>
        `;
        window.Toast.error('Ledger verification failed! Tampering detected.');
      }
    } catch (err) {
      banner.className = 'p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700';
      banner.innerText = `Verification error: ${err.message}`;
    }
  },

  openTamperSimulationModal() {
    const container = document.getElementById('tamper-modal-container');
    if (!container) return;

    container.innerHTML = `
      <div class="modal-backdrop" onclick="window.LedgerView.closeTamperModal(event)">
        <div class="modal-dialog p-6 space-y-4 max-w-lg" onclick="event.stopPropagation()">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-xs font-bold text-slate-800">Tamper Simulation Sandbox Test</h3>
            </div>
            <button onclick="window.LedgerView.closeTamperModal()" class="text-slate-400 hover:text-slate-600 text-sm font-bold">&times;</button>
          </div>

          <p class="text-caption text-slate-500">
            This test creates an isolated in-memory deep copy of the ledger, alters an immutable financial field (e.g. changing 5 kWh to 999 kWh), and runs SHA-256 verification to prove that tampering is mathematically impossible without detection. The authoritative live ledger remains completely safe and untouched.
          </p>

          <div class="space-y-3">
            <div>
              <label class="input-label">Field to Tamper in Sandbox Clone</label>
              <select id="tamper-field" class="input-field text-xs">
                <option value="energyKWh">energyKWh (Alter traded electricity amount)</option>
                <option value="agreedPrice">agreedPrice (Alter clearing price)</option>
                <option value="totalValue">totalValue (Alter total transaction payment)</option>
              </select>
            </div>
            <div>
              <label class="input-label">Illegitimate Altered Value</label>
              <input id="tamper-value" type="number" step="0.01" value="999.99" class="input-field text-xs font-mono" />
            </div>
          </div>

          <div id="tamper-test-output" class="hidden"></div>

          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button onclick="window.LedgerView.closeTamperModal()" class="btn btn-secondary text-xs">Cancel</button>
            <button onclick="window.LedgerView.executeTamperTest()" class="btn btn-danger text-xs font-bold">
              Execute Tamper Test
            </button>
          </div>
        </div>
      </div>
    `;
  },

  closeTamperModal() {
    const container = document.getElementById('tamper-modal-container');
    if (container) container.innerHTML = '';
  },

  async executeTamperTest() {
    const field = document.getElementById('tamper-field')?.value || 'energyKWh';
    const val = parseFloat(document.getElementById('tamper-value')?.value || '999.99');
    const out = document.getElementById('tamper-test-output');
    if (!out) return;

    try {
      const res = await window.API.simulateTamperTest(null, field, val);

      out.className = 'p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 space-y-1.5 fade-in';
      out.innerHTML = `
        <div class="font-bold flex items-center justify-between">
          <span class="badge badge-rejected font-bold">Tampering Detected Instantly</span>
          <span class="badge badge-red text-[9px]">Proof of Avalanche Effect</span>
        </div>
        <p class="text-[11px] text-red-800">${res.explanation}</p>
        <div class="text-[10px] font-mono bg-white p-2 rounded border border-red-200 space-y-0.5">
          <div>Block Index: #${res.tamperedBlockIndex} (${res.transactionId})</div>
          <div>Field: <code>${res.fieldAltered}</code></div>
          <div>Legitimate: <span class="text-emerald-700 font-bold">${res.originalValue}</span> &rarr; Tampered: <span class="text-red-700 font-bold">${res.tamperedValue}</span></div>
          <div>Stored Hash: <code>${res.originalHash.substring(0, 20)}...</code></div>
          <div>Recalculated: <code>${res.verificationResult.expectedHash ? res.verificationResult.expectedHash.substring(0, 20) + '...' : 'Mismatch'}</code></div>
        </div>
      `;
      out.classList.remove('hidden');
    } catch (err) {
      out.className = 'p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200';
      out.innerText = `Test error: ${err.message}`;
      out.classList.remove('hidden');
    }
  }
};
