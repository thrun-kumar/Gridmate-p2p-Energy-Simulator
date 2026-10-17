/**
 * SolarShare - Regulation-Aware Pricing Rule Service
 * 
 * Provides rule-based price validation, regulatory metadata tracking,
 * price review requests management, and rejected prices auditing.
 * 
 * Strict SDG 7 Modeling & Compliance:
 * - Does NOT invent government laws or claim arbitrary limits are official statutes.
 * - Clearly tags rules as "Simulation rules — pending regulatory verification".
 * - Validates submitted seller prices against active rules before offers are published.
 * - Allows sellers to request an administrative price review if they propose custom prices.
 */

const fs = require('fs');
const path = require('path');

const SERVER_DATA_DIR = path.resolve(__dirname, '../../data');
const BACKEND_DATA_DIR = path.resolve(__dirname, '../../../backend/data');

const PRICING_RULES_FILE = path.join(SERVER_DATA_DIR, 'pricing_rules.json');
const BACKEND_PRICING_RULES_FILE = path.join(BACKEND_DATA_DIR, 'pricing_rules.json');

const DEFAULT_ACTIVE_RULE = {
  ruleId: 'RULE-TN-SIM-2026-V1',
  version: '1.0.0',
  name: 'Tamil Nadu Open Access & Distributed Solar P2P Simulation Benchmark',
  jurisdiction: 'Tamil Nadu (TNERC Grid Simulation Framework)',
  applicability: 'Grid-connected Low Voltage & Medium Voltage Solar Prosumers & Consumers',
  effectiveStartDate: '2026-01-01',
  effectiveEndDate: '2026-12-31',
  minimumPermittedPriceINR: 2.00,
  maximumPermittedPriceINR: 8.00,
  referenceExportTariffINR: 2.00,
  referenceImportTariffINR: 8.00,
  platformFeePerKWhINR: 0.20,
  platformFeePayer: 'buyer',
  wheelingFeeAllowed: true,
  localWheelingRateINR: 0.10,
  intertieWheelingRateINR: 0.25,
  status: 'ACTIVE',
  regulatoryCategory: 'SIMULATION_BENCHMARK',
  isOfficiallyApproved: false,
  ruleSource: 'TNERC Distributed Generation & Open Access Simulation Benchmark 2026',
  ruleSourceUrl: 'https://tnerc.gov.in/rules/simulation-benchmark-2026',
  disclaimer: 'Simulation rules — pending regulatory verification. For demonstration and research under UN SDG 7.',
  adminNotes: 'Configured simulation limits. Benchmark export floor ₹2.00/kWh and retail import ceiling ₹8.00/kWh represent illustrative simulation assumptions.'
};

class PricingRuleService {
  constructor() {
    this.store = {
      activeRuleId: DEFAULT_ACTIVE_RULE.ruleId,
      rules: [DEFAULT_ACTIVE_RULE],
      reviewRequests: [],
      rejectedPricesLog: []
    };
    this.loadFromDisk();
  }

  loadFromDisk() {
    const candidates = [PRICING_RULES_FILE, BACKEND_PRICING_RULES_FILE];
    for (const file of candidates) {
      try {
        if (fs.existsSync(file)) {
          const raw = fs.readFileSync(file, 'utf8');
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.rules)) {
            this.store = parsed;
            return;
          }
        }
      } catch (err) {
        console.warn(`[PricingRuleService] Could not load from ${file}: ${err.message}`);
      }
    }
    this.saveToDisk();
  }

  saveToDisk() {
    const serialized = JSON.stringify(this.store, null, 2);
    const targets = [PRICING_RULES_FILE, BACKEND_PRICING_RULES_FILE];
    targets.forEach(target => {
      try {
        const dir = path.dirname(target);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(target, serialized, 'utf8');
      } catch (err) {
        console.error(`[PricingRuleService] Error saving to ${target}: ${err.message}`);
      }
    });
  }

  /**
   * Retrieves the current authoritative active pricing rule.
   */
  getActiveRule() {
    const active = this.store.rules.find(r => r.ruleId === this.store.activeRuleId && r.status === 'ACTIVE');
    return active || this.store.rules.find(r => r.status === 'ACTIVE') || DEFAULT_ACTIVE_RULE;
  }

  /**
   * Retrieves a rule by ruleId.
   */
  getRuleById(ruleId) {
    if (!ruleId) return this.getActiveRule();
    return this.store.rules.find(r => r.ruleId === ruleId) || this.getActiveRule();
  }

  /**
   * Returns all registered rules (Active, Pending Review, Superseded).
   */
  getAllRules() {
    return [...this.store.rules];
  }

  /**
   * Validates a proposed seller price against the specified (or active) pricing rule.
   * Does NOT alter the seller's price silently.
   */
  validatePrice(priceINR, ruleId = null) {
    const rule = this.getRuleById(ruleId);
    const numPrice = Number(priceINR);

    if (isNaN(numPrice) || numPrice <= 0) {
      return {
        valid: false,
        priceINR: numPrice,
        permittedMin: rule.minimumPermittedPriceINR,
        permittedMax: rule.maximumPermittedPriceINR,
        ruleId: rule.ruleId,
        ruleVersion: rule.version,
        ruleName: rule.name,
        ruleSource: rule.ruleSource,
        ruleSourceUrl: rule.ruleSourceUrl,
        disclaimer: rule.disclaimer,
        reason: 'Price must be a valid positive numerical amount.'
      };
    }

    if (numPrice < rule.minimumPermittedPriceINR) {
      return {
        valid: false,
        priceINR: Number(numPrice.toFixed(2)),
        permittedMin: rule.minimumPermittedPriceINR,
        permittedMax: rule.maximumPermittedPriceINR,
        ruleId: rule.ruleId,
        ruleVersion: rule.version,
        ruleName: rule.name,
        ruleSource: rule.ruleSource,
        ruleSourceUrl: rule.ruleSourceUrl,
        disclaimer: rule.disclaimer,
        reason: `Proposed price ₹${numPrice.toFixed(2)}/kWh is below the configured eligible floor of ₹${rule.minimumPermittedPriceINR.toFixed(2)}/kWh (${rule.name}). Selling below export compensation would cause seller revenue impairment.`
      };
    }

    if (numPrice > rule.maximumPermittedPriceINR) {
      return {
        valid: false,
        priceINR: Number(numPrice.toFixed(2)),
        permittedMin: rule.minimumPermittedPriceINR,
        permittedMax: rule.maximumPermittedPriceINR,
        ruleId: rule.ruleId,
        ruleVersion: rule.version,
        ruleName: rule.name,
        ruleSource: rule.ruleSource,
        ruleSourceUrl: rule.ruleSourceUrl,
        disclaimer: rule.disclaimer,
        reason: `Proposed price ₹${numPrice.toFixed(2)}/kWh exceeds the maximum permitted ceiling of ₹${rule.maximumPermittedPriceINR.toFixed(2)}/kWh (${rule.name}). Energy must remain cheaper than standard utility retail import tariff to guarantee buyer economic benefit under SDG 7.`
      };
    }

    return {
      valid: true,
      priceINR: Number(numPrice.toFixed(2)),
      permittedMin: rule.minimumPermittedPriceINR,
      permittedMax: rule.maximumPermittedPriceINR,
      ruleId: rule.ruleId,
      ruleVersion: rule.version,
      ruleName: rule.name,
      ruleSource: rule.ruleSource,
      ruleSourceUrl: rule.ruleSourceUrl,
      disclaimer: rule.disclaimer,
      reason: null
    };
  }

  /**
   * Processes a proposed seller offer price submission.
   * If invalid: records in rejectedPricesLog and rejects.
   * If valid: returns approval metadata.
   */
  processSellerPriceSubmission({ householdId, householdName, priceINR, surplusKWh = 0, ruleId = null }) {
    const rule = this.getRuleById(ruleId);
    const validation = this.validatePrice(priceINR, rule.ruleId);

    if (!validation.valid) {
      const rejectionRecord = {
        id: `REJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        sellerId: householdId,
        sellerName: householdName || householdId,
        attemptedPriceINR: Number(Number(priceINR || 0).toFixed(2)),
        surplusKWh: Number(Number(surplusKWh || 0).toFixed(2)),
        attemptedAt: new Date().toISOString(),
        ruleId: rule.ruleId,
        ruleVersion: rule.version,
        reason: validation.reason,
        permittedMin: rule.minimumPermittedPriceINR,
        permittedMax: rule.maximumPermittedPriceINR,
        ruleSource: rule.ruleSource,
        canRequestReview: true,
        suggestedAction: `Accept recommended eligible price or propose a preferred price within ₹${rule.minimumPermittedPriceINR.toFixed(2)} - ₹${rule.maximumPermittedPriceINR.toFixed(2)}/kWh.`
      };

      this.store.rejectedPricesLog.unshift(rejectionRecord);
      if (this.store.rejectedPricesLog.length > 100) {
        this.store.rejectedPricesLog = this.store.rejectedPricesLog.slice(0, 100);
      }
      this.saveToDisk();

      return {
        approved: false,
        validation,
        rejectionRecord
      };
    }

    return {
      approved: true,
      validation,
      ruleId: rule.ruleId,
      ruleVersion: rule.version,
      ruleName: rule.name
    };
  }

  /**
   * Submits a price review request by a seller to the company operator.
   */
  createPriceReviewRequest({ householdId, householdName, requestedPriceINR, surplusKWh = 0, reason, ruleId = null }) {
    if (!householdId) throw new Error('householdId is required.');
    const price = Number(requestedPriceINR);
    if (isNaN(price) || price <= 0) throw new Error('A valid requested price is required.');
    if (!reason || reason.trim().length < 5) {
      throw new Error('Please provide a substantive justification for the price review (at least 5 characters).');
    }

    const rule = this.getRuleById(ruleId);
    const request = {
      id: `REV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`,
      sellerId: householdId,
      sellerName: householdName || householdId,
      requestedPriceINR: Number(price.toFixed(2)),
      surplusKWh: Number(Number(surplusKWh || 0).toFixed(2)),
      reason: reason.trim(),
      ruleId: rule.ruleId,
      ruleVersion: rule.version,
      submittedAt: new Date().toISOString(),
      status: 'PENDING',
      operatorNotes: null,
      resolvedAt: null,
      resolvedBy: null
    };

    this.store.reviewRequests.unshift(request);
    this.saveToDisk();
    return request;
  }

  /**
   * Retrieves review requests, optionally filtered by status.
   */
  getPriceReviewRequests(statusFilter = null) {
    if (!statusFilter) return [...this.store.reviewRequests];
    const norm = statusFilter.toUpperCase();
    return this.store.reviewRequests.filter(r => r.status === norm);
  }

  /**
   * Resolves a price review request (APPROVE / REJECT) by company operator.
   */
  resolvePriceReviewRequest(requestId, decision, operatorNotes = '', resolvedBy = 'admin') {
    const req = this.store.reviewRequests.find(r => r.id === requestId);
    if (!req) {
      throw new Error(`Price review request "${requestId}" not found.`);
    }

    const normDecision = (decision || '').toUpperCase();
    if (!['APPROVED', 'REJECTED'].includes(normDecision)) {
      throw new Error('Decision must be either APPROVED or REJECTED.');
    }

    req.status = normDecision;
    req.operatorNotes = operatorNotes ? operatorNotes.trim() : `Decision: ${normDecision}`;
    req.resolvedAt = new Date().toISOString();
    req.resolvedBy = resolvedBy || 'admin';

    this.saveToDisk();
    return req;
  }

  /**
   * Returns rejected prices audit log.
   */
  getRejectedPricesLog(limit = 50) {
    return this.store.rejectedPricesLog.slice(0, limit);
  }

  /**
   * Sets the active rule or updates active rule parameters (Operator capability).
   */
  setActiveRule(ruleId) {
    const rule = this.store.rules.find(r => r.ruleId === ruleId);
    if (!rule) {
      throw new Error(`Rule "${ruleId}" not found in registry.`);
    }

    this.store.rules.forEach(r => {
      r.status = r.ruleId === ruleId ? 'ACTIVE' : (r.status === 'ACTIVE' ? 'SUPERSEDED' : r.status);
    });

    this.store.activeRuleId = ruleId;
    this.saveToDisk();
    return rule;
  }

  /**
   * Registers a new rule or draft version in the store.
   */
  registerRule(ruleData, author = 'admin') {
    if (!ruleData.ruleId) throw new Error('Rule ID is required.');
    const existingIdx = this.store.rules.findIndex(r => r.ruleId === ruleData.ruleId);

    const cleanRule = {
      ruleId: ruleData.ruleId.trim(),
      version: ruleData.version || '1.0.0',
      name: ruleData.name || 'Custom Simulation Rule',
      jurisdiction: ruleData.jurisdiction || 'Regional Simulation Grid',
      applicability: ruleData.applicability || 'Distributed Solar Prosumers & Consumers',
      effectiveStartDate: ruleData.effectiveStartDate || new Date().toISOString().slice(0, 10),
      effectiveEndDate: ruleData.effectiveEndDate || '2026-12-31',
      minimumPermittedPriceINR: Math.max(0.5, Number(ruleData.minimumPermittedPriceINR || 2.00)),
      maximumPermittedPriceINR: Math.max(Number(ruleData.minimumPermittedPriceINR || 2.00), Number(ruleData.maximumPermittedPriceINR || 8.00)),
      referenceExportTariffINR: Number(ruleData.referenceExportTariffINR || 2.00),
      referenceImportTariffINR: Number(ruleData.referenceImportTariffINR || 8.00),
      platformFeePerKWhINR: Number(ruleData.platformFeePerKWhINR !== undefined ? ruleData.platformFeePerKWhINR : 0.20),
      platformFeePayer: ruleData.platformFeePayer || 'buyer',
      wheelingFeeAllowed: ruleData.wheelingFeeAllowed !== false,
      localWheelingRateINR: Number(ruleData.localWheelingRateINR !== undefined ? ruleData.localWheelingRateINR : 0.10),
      intertieWheelingRateINR: Number(ruleData.intertieWheelingRateINR !== undefined ? ruleData.intertieWheelingRateINR : 0.25),
      status: ruleData.status || 'PENDING_REVIEW',
      regulatoryCategory: ruleData.regulatoryCategory || 'SIMULATION_BENCHMARK',
      isOfficiallyApproved: false,
      ruleSource: ruleData.ruleSource || 'Administrative Simulation Configuration',
      ruleSourceUrl: ruleData.ruleSourceUrl || '',
      disclaimer: 'Simulation rules — pending regulatory verification.',
      adminNotes: ruleData.adminNotes || `Added by ${author}`,
      createdAt: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      this.store.rules[existingIdx] = cleanRule;
    } else {
      this.store.rules.push(cleanRule);
    }

    if (cleanRule.status === 'ACTIVE') {
      this.setActiveRule(cleanRule.ruleId);
    } else {
      this.saveToDisk();
    }

    return cleanRule;
  }
}

const pricingRuleService = new PricingRuleService();

module.exports = {
  DEFAULT_ACTIVE_RULE,
  PricingRuleService,
  pricingRuleService
};
