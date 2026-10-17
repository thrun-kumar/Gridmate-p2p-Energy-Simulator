/**
 * GRIDMATE - Household Simulation Engine
 * Defines 16 deterministic fictional households with realistic 24-hour solar generation and load profiles.
 * Distinguishes solar capacity in kW from hourly energy in kWh.
 */

// Normalized solar irradiance curve across 24 hours (00:00 - 23:00)
// Represents peak midday solar radiation curve typical for sunny climates
const HOURLY_SOLAR_INSOLATION_FACTOR = [
  0.00, 0.00, 0.00, 0.00, 0.00, 0.00, // 00:00 - 05:00 Night
  0.08, 0.25, 0.50, 0.72, 0.88, 0.98, // 06:00 - 11:00 Morning ramp
  1.00, 0.96, 0.84, 0.65, 0.42, 0.18, // 12:00 - 17:00 Midday peak & decline
  0.03, 0.00, 0.00, 0.00, 0.00, 0.00  // 18:00 - 23:00 Sunset & Night
];

// Household specifications (16 participants)
const BASE_HOUSEHOLD_SPECS = [
  {
    id: 'HH-01',
    name: 'Green Meadows Villa',
    role: 'Seller',
    solarCapacityKW: 10.0,
    demandMultiplier: 0.8,
    profileType: 'residential_efficient',
    description: 'Eco-conscious villa with 10 kW rooftop array and low daytime consumption.'
  },
  {
    id: 'HH-02',
    name: 'Apex Tech Park',
    role: 'Buyer',
    solarCapacityKW: 0.0,
    demandMultiplier: 3.2,
    profileType: 'commercial_office',
    description: 'Commercial software tech park with high continuous daytime compute and HVAC loads.'
  },
  {
    id: 'HH-03',
    name: 'Sunshine Heights',
    role: 'Seller',
    solarCapacityKW: 8.0,
    demandMultiplier: 1.0,
    profileType: 'residential_standard',
    description: 'Residential community clubhouse equipped with 8 kW high-yield solar installation.'
  },
  {
    id: 'HH-04',
    name: 'Riverdale Residential',
    role: 'Buyer',
    solarCapacityKW: 0.0,
    demandMultiplier: 1.1,
    profileType: 'residential_family',
    description: 'Grid-connected apartment residence without solar panels, purchasing clean peer power.'
  },
  {
    id: 'HH-05',
    name: 'Banyan Grove Home',
    role: 'Buyer',
    solarCapacityKW: 0.0,
    demandMultiplier: 1.4,
    profileType: 'residential_family',
    description: 'Large joint-family residence with consistent daytime and evening energy requirements.'
  },
  {
    id: 'HH-06',
    name: 'Pinnacle Duplex',
    role: 'Seller',
    solarCapacityKW: 6.0,
    demandMultiplier: 0.9,
    profileType: 'residential_efficient',
    description: 'Two-story residential prosumer generating reliable 6 kW solar surplus.'
  },
  {
    id: 'HH-07',
    name: 'Metro St. Jude Clinic',
    role: 'Buyer',
    solarCapacityKW: 0.0,
    demandMultiplier: 2.2,
    profileType: 'commercial_office',
    description: 'Healthcare clinic with continuous daytime refrigeration and medical equipment loads.'
  },
  {
    id: 'HH-08',
    name: 'EcoVibe Smart Residency',
    role: 'Seller',
    solarCapacityKW: 4.0,
    demandMultiplier: 0.8,
    profileType: 'residential_efficient',
    description: 'Smart residence with 4 kW solar array and automated energy efficiency.'
  },
  {
    id: 'HH-09',
    name: 'Lotus Garden Homes',
    role: 'Seller',
    solarCapacityKW: 5.0,
    demandMultiplier: 0.9,
    profileType: 'residential_standard',
    description: 'Townhouse community with 5 kW solar array exporting clean daytime surplus.'
  },
  {
    id: 'HH-10',
    name: 'Central Market Complex',
    role: 'mixed',
    participantType: 'COMMERCIAL_MIXED',
    solarCapacityKW: 4.0,
    demandMultiplier: 2.8,
    profileType: 'commercial_office',
    description: 'Mixed-use commercial and community retail centre with 4.0 kW solar installation and high daytime commercial demand.'
  },
  {
    id: 'HH-11',
    name: 'Sunrise Apartments',
    role: 'Seller',
    solarCapacityKW: 12.0,
    demandMultiplier: 1.2,
    profileType: 'residential_standard',
    description: 'Multi-tenant apartment complex with 12 kW rooftop solar generating abundant surplus.'
  },
  {
    id: 'HH-12',
    name: 'Community Learning Centre',
    role: 'Buyer',
    solarCapacityKW: 0.0,
    demandMultiplier: 1.8,
    profileType: 'commercial_office',
    description: 'Public education centre with classrooms and computer lab, seeking low-cost green power.'
  }
];

// Baseline hourly demand curves for various property profiles (in kWh per hour)
const HOURLY_DEMAND_CURVES = {
  // Typical residential with morning (7-9 AM) and evening (6-10 PM) peaks
  residential_standard: [
    1.2, 1.0, 0.9, 0.9, 1.1, 1.8, 
    3.2, 4.5, 3.8, 2.5, 2.0, 1.9, 
    2.1, 2.0, 1.8, 2.2, 2.8, 3.6, 
    5.0, 5.8, 5.2, 4.2, 2.6, 1.6
  ],
  // Highly efficient residential home
  residential_efficient: [
    0.8, 0.7, 0.6, 0.6, 0.7, 1.1, 
    2.1, 2.8, 2.3, 1.5, 1.2, 1.1, 
    1.3, 1.2, 1.1, 1.4, 1.8, 2.4, 
    3.3, 3.8, 3.4, 2.6, 1.6, 1.0
  ],
  // Commercial office with heavy load from 8 AM to 6 PM
  commercial_office: [
    1.8, 1.8, 1.8, 1.8, 2.0, 2.5, 
    4.5, 7.5, 9.8, 11.5, 12.0, 12.2, 
    11.8, 12.0, 11.6, 11.0, 9.5, 7.0, 
    4.5, 3.0, 2.5, 2.2, 2.0, 1.8
  ],
  // Joint family with elevated demand throughout
  residential_family: [
    2.0, 1.8, 1.6, 1.6, 1.9, 2.8, 
    4.8, 6.2, 5.4, 4.0, 3.5, 3.4, 
    3.8, 3.6, 3.3, 3.8, 4.5, 5.8, 
    7.2, 8.0, 7.5, 6.0, 3.8, 2.5
  ],
  // Luxury home with continuous heavy air conditioning
  residential_high_demand: [
    2.5, 2.3, 2.2, 2.1, 2.4, 3.0, 
    5.0, 6.8, 6.0, 4.5, 4.2, 4.0, 
    4.4, 4.3, 4.0, 4.6, 5.4, 6.5, 
    8.0, 8.8, 8.2, 7.0, 4.5, 3.2
  ],
  // Residential with midday/afternoon EV vehicle charging
  residential_ev: [
    1.1, 1.0, 0.9, 0.9, 1.0, 1.5, 
    2.8, 3.5, 3.0, 2.2, 4.5, 5.0, 
    5.2, 5.0, 4.0, 2.5, 3.0, 4.0, 
    5.5, 6.2, 5.5, 4.0, 2.2, 1.4
  ],
  // Agricultural with low afternoon pumping load
  agricultural_offpeak: [
    1.0, 0.9, 0.9, 0.9, 1.5, 2.5, 
    4.0, 3.5, 2.0, 1.2, 1.0, 0.9, 
    0.9, 0.9, 1.0, 1.2, 2.0, 3.5, 
    3.0, 2.0, 1.5, 1.2, 1.0, 0.9
  ],
  // Robotics lab with heavy electronics
  commercial_lab: [
    1.5, 1.5, 1.5, 1.5, 1.8, 2.2, 
    3.5, 5.0, 6.5, 7.2, 7.5, 7.5, 
    7.0, 7.2, 7.0, 6.5, 5.8, 4.8, 
    3.8, 3.2, 2.8, 2.2, 1.8, 1.5
  ],
  // Community hall with daytime activities
  community_daylight: [
    0.8, 0.7, 0.7, 0.7, 0.9, 1.2, 
    2.0, 3.2, 3.8, 4.2, 4.0, 3.8, 
    3.5, 3.4, 3.2, 3.0, 2.8, 2.5, 
    2.2, 1.8, 1.5, 1.2, 1.0, 0.8
  ]
};

/**
 * Generates the full 24-hour deterministic profile for a single household.
 */
function generateHouseholdProfile(spec) {
  const baseCurve = HOURLY_DEMAND_CURVES[spec.profileType] || HOURLY_DEMAND_CURVES.residential_standard;
  
  const hourlyGeneration = [];
  const hourlyDemand = [];
  const hourlySurplus = [];
  const hourlyDeficit = [];

  for (let hour = 0; hour < 24; hour++) {
    // Generation in kWh for the 1-hour interval
    // Solar capacity in kW * hourly insolation factor = kWh generated in that hour
    const rawGen = spec.solarCapacityKW * HOURLY_SOLAR_INSOLATION_FACTOR[hour];
    const genKWh = Number(rawGen.toFixed(2));

    // Demand in kWh for the 1-hour interval
    const rawDemand = baseCurve[hour] * spec.demandMultiplier;
    const demandKWh = Number(rawDemand.toFixed(2));

    // Calculate surplus and deficit
    const surplusKWh = Number(Math.max(0, genKWh - demandKWh).toFixed(2));
    const deficitKWh = Number(Math.max(0, demandKWh - genKWh).toFixed(2));

    hourlyGeneration.push(genKWh);
    hourlyDemand.push(demandKWh);
    hourlySurplus.push(surplusKWh);
    hourlyDeficit.push(deficitKWh);
  }

  return {
    id: spec.id,
    name: spec.name,
    role: spec.role,
    solarCapacityKW: spec.solarCapacityKW,
    description: spec.description,
    hourlyGeneration,
    hourlyDemand,
    hourlySurplus,
    hourlyDeficit,
    // Dynamic simulation totals
    totalEnergySoldKWh: 0,
    totalEnergyBoughtKWh: 0,
    totalEarningsINR: 0,
    totalExpenditureINR: 0,
    totalBuyerSavingsINR: 0,
    totalSellerAdditionalEarningsINR: 0,
    totalTradesCount: 0
  };
}

/**
 * Initializes and returns a deterministic array of 16 households.
 */
function createInitialHouseholds() {
  return BASE_HOUSEHOLD_SPECS.map(spec => generateHouseholdProfile(spec));
}

/**
 * Calculates current interval state for a household at a given hour.
 * @param {Object} household - The household object
 * @param {number} hour - 0 to 23
 * @returns {Object} { generationKWh, demandKWh, surplusKWh, deficitKWh }
 */
function getHouseholdHourMetrics(household, hour) {
  const h = Math.max(0, Math.min(23, hour));
  const generationKWh = household.hourlyGeneration[h];
  const demandKWh = household.hourlyDemand[h];
  const surplusKWh = household.hourlySurplus[h];
  const deficitKWh = household.hourlyDeficit[h];

  return {
    hour: h,
    generationKWh,
    demandKWh,
    surplusKWh,
    deficitKWh
  };
}

module.exports = {
  HOURLY_SOLAR_INSOLATION_FACTOR,
  BASE_HOUSEHOLD_SPECS,
  createInitialHouseholds,
  getHouseholdHourMetrics
};
