# ⚡ SolarShare — Grid-Connected Peer-to-Peer Energy Marketplace

> **"Trade Clean Energy. Save Money. Power Your Community."**  
> **Hackathon Track:** Clean Energy & Green Technology | **UN SDG 7:** Affordable and Clean Energy  
> **Active Application Server:** `http://localhost:5000`

---

## 📌 Executive Summary & Key Business Principle

Conventional peer-to-peer energy trading concepts often mistakenly assume that both buyers and sellers must be similar solar-equipped households. **SolarShare breaks this barrier.**

### The Core Business Rule:
> **Only the seller needs a rooftop solar installation to generate and export clean solar surplus.**  
> **A buyer can be an ordinary household, apartment, shop, clinic, office, data center, or factory without any solar panels whatsoever.**

The solar prosumer injects clean surplus kilowatt-hours into the shared utility distribution grid. The non-solar buyer receives electricity through their standard physical grid connection. **SolarShare contractually matches their energy quantities and calculates financial settlement, network wheeling charges, and modeled physical transmission losses.**

> **Physics Disclaimer:** SolarShare distinguishes commercial energy allocation from physical electron flow. We do not claim that individual electrons travel exclusively from a particular rooftop to a specific consumer's socket; rather, clean energy injected into the local grid displaces fossil-fuel utility generation, creating verified economic savings and carbon reductions.

---

## 🗺️ Multi-Zone Grid Network Architecture

SolarShare models a physical distribution network divided into distinct substation service zones interconnected by simulated medium-voltage distribution feeders:

```
    [ZONE-A: North Residential Substation] (50 kW Capacity)
          │  ▲                ▲  │
          │  │ (3.5% Loss,    │  │ (5.0% Loss,
          │  │  ₹0.25 Wheeling)│  │  ₹0.40 Wheeling)
          ▼  │                │  ▼
[ZONE-B: Commercial Hub] ◄───► [ZONE-C: Mixed Community]
   (60 kW, No Solar Panels)       (45 kW, Hybrid Loads)
             (4.0% Loss, ₹0.30 Wheeling)
```

### 1. Network Substation Zones
- **`ZONE-A` — North Residential Substation (50 kW):** High-density residential community with distributed rooftop solar prosumers (e.g. Green Meadows Villa, Sunshine Heights Society). Midday surplus generation dominates.
- **`ZONE-B` — Central Commercial Substation (60 kW):** Commercial business district comprising tech parks, clinics, and offices with **0 kW solar installations** (e.g. Apex Tech Park Office, Metro Clinic). Continuous daytime demand deficit dominates.
- **`ZONE-C` — South Mixed Substation (45 kW):** Mixed residential-commercial community with hybrid prosumers and standard consumers (e.g. EcoVibe Smart Residency, Banyan Grove Home).

### 2. Physical Route Parameters & Dynamic Capacity Limits
The network defines 9 intra- and inter-zone routes with real-time transfer capacity constraints:

| Route ID | Origin Zone | Destination Zone | Status | Transfer Capacity | Transmission Loss | Wheeling Charge | Description |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **ROUTE-A-A** | `ZONE-A` | `ZONE-A` | `CONNECTED` | 100.0 kWh | 1.5% | ₹0.10/kWh | Local North Substation distribution feeder |
| **ROUTE-B-B** | `ZONE-B` | `ZONE-B` | `CONNECTED` | 100.0 kWh | 1.5% | ₹0.10/kWh | Local Commercial Substation distribution ring |
| **ROUTE-C-C** | `ZONE-C` | `ZONE-C` | `CONNECTED` | 100.0 kWh | 1.5% | ₹0.10/kWh | Local South Mixed Substation feeder circuit |
| **ROUTE-A-B** | `ZONE-A` | `ZONE-B` | `CONNECTED` | 35.0 kWh | 3.5% | ₹0.25/kWh | North-to-Central 11 kV medium-voltage intertie |
| **ROUTE-B-A** | `ZONE-B` | `ZONE-A` | `CONNECTED` | 35.0 kWh | 3.5% | ₹0.25/kWh | Central-to-North 11 kV medium-voltage intertie |
| **ROUTE-B-C** | `ZONE-B` | `ZONE-C` | `CONNECTED` | 30.0 kWh | 4.0% | ₹0.30/kWh | Central-to-South medium-voltage interconnect |
| **ROUTE-C-B** | `ZONE-C` | `ZONE-B` | `CONNECTED` | 30.0 kWh | 4.0% | ₹0.30/kWh | South-to-Central medium-voltage interconnect |
| **ROUTE-A-C** | `ZONE-A` | `ZONE-C` | `CONNECTED` | 25.0 kWh | 5.0% | ₹0.40/kWh | Long-distance sub-transmission trunk line |
| **ROUTE-C-A** | `ZONE-C` | `ZONE-A` | `CONNECTED` | 25.0 kWh | 5.0% | ₹0.40/kWh | Long-distance sub-transmission trunk line |

---

## 📐 Mathematical Formulas & Settlement Conventions

### 1. Delivery Losses & Conservation of Energy
When a seller injects $Q_{\text{injected}}$ into the grid destined for a buyer in route $R$:
$$\text{Loss Fraction } L = \frac{\text{lossPercentage}}{100}$$
$$Q_{\text{loss}} = Q_{\text{injected}} \times L$$
$$Q_{\text{delivered}} = Q_{\text{injected}} \times (1 - L)$$
$$Q_{\text{injected}} = Q_{\text{delivered}} + Q_{\text{loss}}$$

### 2. Fair Clearing Price (Continuous Double Auction Midpoint)
$$\text{Clearing Price } P = \frac{P_{\text{ask}} + P_{\text{bid}}}{2} \quad \text{clamped strictly between } [₹2.00, ₹8.00]$$

### 3. Financial Settlements & Itemized Charges
- **Gross Energy Value:**
  $$\text{Gross Value} = Q_{\text{injected}} \times P$$
- **Platform Fee (Collected ONLY on Executed Trades):**
  $$\text{Platform Fee} = Q_{\text{injected}} \times ₹0.20/\text{kWh}$$
- **Grid Wheeling / Network Transit Charge:**
  $$\text{Wheeling Fee} = Q_{\text{injected}} \times \text{wheelingRateINRPerKWh}$$
- **Seller Net Proceeds:**
  $$\text{Seller Proceeds} = Q_{\text{injected}} \times P$$
- **Buyer Total Cost:**
  $$\text{Buyer Total Cost} = (Q_{\text{injected}} \times P) + \text{Platform Fee} + \text{Wheeling Fee}$$
- **Utility Baseline Benchmark:**
  $$\text{Utility Baseline} = Q_{\text{delivered}} \times ₹8.00/\text{kWh}$$
- **Verified Buyer Net Savings:**
  $$\text{Buyer Savings} = \text{Utility Baseline} - \text{Buyer Total Cost}$$
- **Seller Extra Earnings Above Feed-in Tariff:**
  $$\text{Seller Additional Earnings} = Q_{\text{injected}} \times (P - ₹2.00)$$

---

## 🔒 Versioned Cryptographic SHA-256 Ledger

SolarShare maintains strict immutable auditability. Every simulated transaction is hashed and chained from the Genesis block (`0000000000000000000000000000000000000000000000000000000000000000`).

### Backward Compatibility Guarantee
- **Historical Blocks (Version 1, Blocks 0 to 118+):** Evaluated against the documented canonical 19-key JSON serialization. **100% cryptographic validity maintained without breaking existing hash links.**
- **Upgraded Blocks (Version 2):** Evaluated with grid routing and transmission fields (`sellerZone`, `buyerZone`, `isCrossZone`, `lossKWh`, `deliveredEnergyKWh`, `wheelingFeeINR`, `platformFeeINR`).
- **RFC 4180 CSV Export:** Exports complete transaction history preserving legacy 22-column index ordering while cleanly appending grid routing and delivery metrics in columns 23–29.

---

## 🔑 Predefined Accounts for Hackathon Judges

SolarShare includes **1-click judge demo cards** on `/login`, as well as standard email/password authentication:

| Role | Account ID | Display Name | Household | Zone | Solar Array | Purpose / Narrative |
|---|---|---|:---:|:---:|:---:|---|
| **Admin / Operator** | `admin` | Grid System Operator | *System* | All | N/A | Full grid oversight, route control, capacity toggles, ledger audit |
| **Seller / Prosumer** | `seller_hh01` | Green Meadows Villa | `HH-01` | `ZONE-A` | 10.0 kW | Generates midday surplus clean energy, exports to grid |
| **Seller / Prosumer** | `seller_hh03` | Sunshine Heights Society | `HH-03` | `ZONE-A` | 14.0 kW | High-yield community solar installation |
| **Buyer / Consumer** | `buyer_hh02` | Apex Tech Park Office | `HH-02` | `ZONE-B` | **0.0 kW** | **Zero solar panels.** Daytime deficit, buys clean energy |
| **Buyer / Consumer** | `buyer_hh05` | Banyan Grove Home | `HH-05` | `ZONE-B` | **0.0 kW** | **Zero solar panels.** Residential consumer buying peer solar |
| **Prosumer (Both)** | `prosumer_hh04` | EcoVibe Smart Residency | `HH-04` | `ZONE-C` | 6.0 kW | Dual-role: exports midday surplus, buys during evening peak |

---

## 🧪 Automated Test Suites (69 Scenarios, 100% Passing)

Run the verification suites from the `server/` directory:

```bash
cd server

# 1. Run the 22-Scenario Grid-Connected Trading Suite (Phase 9 Acceptance)
npm test
# or: node src/tests/grid_connected_trading.test.js

# 2. Run All Test Suites (69 Total Scenarios)
npm run test:all
```

### Verified Test Suites Breakdown:
1. **`grid_connected_trading.test.js` (22/22 PASS):**
   - Scenario 01: Solar seller exporting valid surplus.
   - Scenario 02: Ordinary buyer with no solar installation purchasing energy.
   - Scenario 03: Consumer demand exceeding market supply.
   - Scenario 04: Local-zone trading (`ZONE-A -> ZONE-A`).
   - Scenario 05: Cross-zone trading (`ZONE-A -> ZONE-B`).
   - Scenario 06: Distant trading over connected route (`ZONE-A -> ZONE-C`).
   - Scenario 07: Disconnected route rejection (`ROUTE_DISCONNECTED`).
   - Scenario 08: Insufficient transfer capacity (`ROUTE_CAPACITY_EXHAUSTED`).
   - Scenario 09: Modeled transmission losses ($Q_{\text{delivered}} = Q_{\text{injected}} \times (1 - L)$).
   - Scenario 10: Network wheeling and platform fee calculations.
   - Scenario 11: Buyer savings against ₹8.00/kWh utility baseline.
   - Scenario 12: Seller net proceeds.
   - Scenario 13: Partial fills and remaining order quantities.
   - Scenario 14: Duplicate energy prevention.
   - Scenario 15: Invalid/excessive quantity bounds.
   - Scenario 16: Invalid prices and loss percentage validation.
   - Scenario 17: Failed and canceled settlements.
   - Scenario 18: Hour advancement and automatic order regeneration.
   - Scenario 19: SHA-256 ledger integrity and tamper detection.
   - Scenario 20: Role authorization & household isolation.
   - Scenario 21: Backward compatibility with historical ledger blocks (118+ records).
   - Scenario 22: Repeated simulation runs and reset behavior.

2. **`simulation.test.js` (30/30 PASS):**
   - Core CDA auction mechanics, partial fills, merit order execution, price limits, tamper detection, and PBKDF2 authentication.

3. **`automated_trading.test.js` (17/17 PASS):**
   - Automated trading generation, division-by-zero protection, zero generation/demand conditions, and company finance tracking.

---

## 🚀 Quick Start Guide

### 1. Start Backend Server
```bash
cd server
npm start
# Server listens on port 5000: http://localhost:5000
```

### 2. Open Application in Web Browser
Navigate to **`http://localhost:5000`** (or `http://localhost:5000/login`).

### 3. Quick 5-Minute Demo Walkthrough:
1. **Non-Solar Buyer Demonstration:**
   - Log in as **Buyer (`buyer_hh02` - Apex Tech Park)**.
   - Notice the prominent badge: **"⚡ No Solar Panels Required — Grid-Connected Clean Energy Consumer"**.
   - Review your `ZONE-B` Central Substation connection and daytime deficit.
   - Observe purchases of clean solar energy with full breakdown of injected kWh, delivery loss (3.5%), delivered kWh, wheeling charges (₹0.25/kWh), and net bill savings against the ₹8.00 utility benchmark.
2. **Solar Prosumer Demonstration:**
   - Click "Switch Role" and select **Seller (`seller_hh01` - Green Meadows Villa)**.
   - Inspect rooftop generation (10.0 kW), `ZONE-A` substation badge, surplus energy, and sales proceeds at fair clearing prices well above the ₹2.00 feed-in floor.
3. **Grid Operator / Network Topology:**
   - Switch to **Admin (`admin`)**.
   - Navigate to **Marketplace**: view the **Grid Network Topology & Interties** card showing active routes, line loss percentages, wheeling rates, and transfer capacity utilization.
   - Click **"Advance 1 Hour"** to execute automatic Continuous Double Auction matching across network zones.
4. **Cryptographic Ledger Audit:**
   - Navigate to **Audit Ledger**: inspect the cryptographic chain. Click **"Verify Ledger Integrity"** to verify all blocks back to Genesis.

---

**SolarShare Core Team** | Built for Hackathon SDG 7: Affordable and Clean Energy
