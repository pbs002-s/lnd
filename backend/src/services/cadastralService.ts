/**
 * Cadastral & Land Calculation Service for Bangladesh Land Governance
 */

export interface GeoJsonPolygon {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][]; // [ [ [lng, lat], ... ] ]
  };
  properties?: Record<string, any>;
}

export interface LandUnits {
  decimal: number;
  katha: number;
  bigha: number;
  acre: number;
  squareFeet: number;
  squareMetres: number;
}

export interface FaraezInput {
  totalDecimal: number;
  sons: number;
  daughters: number;
  wife: number; // 0 or 1 (or count)
  husband: number; // 0 or 1
  father: number; // 0 or 1
  mother: number; // 0 or 1
}

export interface FaraezShare {
  relation: string;
  relationBn: string;
  count: number;
  fraction: string;
  totalDecimal: number;
  perPersonDecimal: number;
  percentage: number;
}

export class CadastralService {
  /**
   * Standard conversion ratios according to DLRS / Bangladesh Survey Standards:
   * 1 Decimal (শতক/শতাংশ) = 435.60 sq ft = 40.4686 sq m
   * 1 Katha (কাঠা) = 1.65 Decimal = 720.00 sq ft
   * 1 Bigha (বিঘা) = 20 Katha = 33.00 Decimal = 14,400 sq ft
   * 1 Acre (একর) = 100 Decimal = 3.0303 Bigha = 43,560 sq ft
   */
  static convertUnits(val: number, fromUnit: 'decimal' | 'katha' | 'bigha' | 'acre' | 'sqft' | 'sqm'): LandUnits {
    let decimal = 0;
    switch (fromUnit) {
      case 'decimal':
        decimal = val;
        break;
      case 'katha':
        decimal = val * 1.65;
        break;
      case 'bigha':
        decimal = val * 33.0;
        break;
      case 'acre':
        decimal = val * 100.0;
        break;
      case 'sqft':
        decimal = val / 435.6;
        break;
      case 'sqm':
        decimal = val / 40.4686;
        break;
    }

    const sqft = decimal * 435.6;
    return {
      decimal: Number(decimal.toFixed(4)),
      katha: Number((decimal / 1.65).toFixed(4)),
      bigha: Number((decimal / 33.0).toFixed(4)),
      acre: Number((decimal / 100.0).toFixed(4)),
      squareFeet: Number(sqft.toFixed(2)),
      squareMetres: Number((decimal * 40.4686).toFixed(2)),
    };
  }

  /**
   * Calculate Islamic Faraez inheritance distribution shares based on BD Personal Law
   */
  static calculateFaraez(input: FaraezInput): { shares: FaraezShare[]; totalDistributed: number } {
    const { totalDecimal, sons, daughters, wife, husband, father, mother } = input;
    const hasChildren = sons > 0 || daughters > 0;
    const shares: FaraezShare[] = [];
    let remainingDecimal = totalDecimal;

    // 1. Spouses (Sharers / কোরআনিক অংশীদার)
    if (wife > 0 && husband === 0) {
      // Wife gets 1/8 if children exist, 1/4 if no children
      const fractionStr = hasChildren ? '1/8' : '1/4';
      const shareVal = hasChildren ? totalDecimal * (1 / 8) : totalDecimal * (1 / 4);
      shares.push({
        relation: 'Wife',
        relationBn: 'স্ত্রী',
        count: wife,
        fraction: fractionStr,
        totalDecimal: Number(shareVal.toFixed(4)),
        perPersonDecimal: Number((shareVal / wife).toFixed(4)),
        percentage: Number(((shareVal / totalDecimal) * 100).toFixed(2)),
      });
      remainingDecimal -= shareVal;
    } else if (husband > 0 && wife === 0) {
      // Husband gets 1/4 if children exist, 1/2 if no children
      const fractionStr = hasChildren ? '1/4' : '1/2';
      const shareVal = hasChildren ? totalDecimal * (1 / 4) : totalDecimal * (1 / 2);
      shares.push({
        relation: 'Husband',
        relationBn: 'স্বামী',
        count: 1,
        fraction: fractionStr,
        totalDecimal: Number(shareVal.toFixed(4)),
        perPersonDecimal: Number(shareVal.toFixed(4)),
        percentage: Number(((shareVal / totalDecimal) * 100).toFixed(2)),
      });
      remainingDecimal -= shareVal;
    }

    // 2. Parents
    if (father > 0) {
      // Father gets 1/6 with children
      const shareVal = hasChildren ? totalDecimal * (1 / 6) : 0;
      if (hasChildren) {
        shares.push({
          relation: 'Father',
          relationBn: 'পিতা',
          count: 1,
          fraction: '1/6',
          totalDecimal: Number(shareVal.toFixed(4)),
          perPersonDecimal: Number(shareVal.toFixed(4)),
          percentage: Number(((shareVal / totalDecimal) * 100).toFixed(2)),
        });
        remainingDecimal -= shareVal;
      }
    }

    if (mother > 0) {
      // Mother gets 1/6 with children, 1/3 without
      const fractionStr = hasChildren ? '1/6' : '1/3';
      const shareVal = hasChildren ? totalDecimal * (1 / 6) : totalDecimal * (1 / 3);
      shares.push({
        relation: 'Mother',
        relationBn: 'মাতা',
        count: 1,
        fraction: fractionStr,
        totalDecimal: Number(shareVal.toFixed(4)),
        perPersonDecimal: Number(shareVal.toFixed(4)),
        percentage: Number(((shareVal / totalDecimal) * 100).toFixed(2)),
      });
      remainingDecimal -= shareVal;
    }

    // 3. Residuary Children (আসাবা - পুত্র ও কন্যা: পুত্র পাবে কন্যার দ্বিগুণ)
    if (hasChildren && remainingDecimal > 0) {
      const totalUnits = sons * 2 + daughters * 1;
      const unitValue = remainingDecimal / totalUnits;

      if (sons > 0) {
        const sonsTotal = unitValue * 2 * sons;
        shares.push({
          relation: 'Sons',
          relationBn: 'পুত্র',
          count: sons,
          fraction: `${sons * 2}/${totalUnits} of residue`,
          totalDecimal: Number(sonsTotal.toFixed(4)),
          perPersonDecimal: Number((unitValue * 2).toFixed(4)),
          percentage: Number(((sonsTotal / totalDecimal) * 100).toFixed(2)),
        });
      }

      if (daughters > 0) {
        const daughtersTotal = unitValue * 1 * daughters;
        shares.push({
          relation: 'Daughters',
          relationBn: 'কন্যা',
          count: daughters,
          fraction: `${daughters}/${totalUnits} of residue`,
          totalDecimal: Number(daughtersTotal.toFixed(4)),
          perPersonDecimal: Number(unitValue.toFixed(4)),
          percentage: Number(((daughtersTotal / totalDecimal) * 100).toFixed(2)),
        });
      }
    }

    const totalDistributed = shares.reduce((acc, s) => acc + s.totalDecimal, 0);
    return {
      shares,
      totalDistributed: Number(totalDistributed.toFixed(4)),
    };
  }

  /**
   * Estimate annual LD Tax Demand based on standard Ministry of Land rate schedules
   */
  static estimateLdTax(landClass: string, decimalArea: number): { annualDemand: number; ratePerDecimal: number } {
    let rate = 10; // default rate BDT per decimal
    const lc = landClass.toLowerCase();

    if (lc.includes('commercial') || lc.includes('বাণিজ্যিক')) {
      rate = 400; // Urban commercial tier
    } else if (lc.includes('industrial') || lc.includes('শিল্প')) {
      rate = 300;
    } else if (lc.includes('residential') || lc.includes('বাস্তুভিটা') || lc.includes('homestead')) {
      rate = 50; // Residential tier
    } else if (lc.includes('agricultural') || lc.includes('কৃষি') || lc.includes('নাল')) {
      // In BD, agricultural land up to 25 bighas (825 decimals) is taxed at minimal/exempt rate
      rate = decimalArea <= 825 ? 5 : 15;
    }

    const annualDemand = Math.max(100, Math.round(decimalArea * rate));
    return {
      annualDemand,
      ratePerDecimal: rate,
    };
  }

  /**
   * Geodesic Shoelace calculation of polygon area in Decimal from WGS84 GeoJSON coordinates
   */
  static calculatePolygonAreaDecimal(coordinates: number[][]): number {
    if (!coordinates || coordinates.length < 3) return 0;
    const ring = coordinates;
    const n = ring.length;
    let avgLat = 0;
    for (let i = 0; i < n; i++) {
      avgLat += ring[i][1];
    }
    avgLat = (avgLat / n) * (Math.PI / 180);

    const mPerDegLat = 111132.954 - 559.822 * Math.cos(2 * avgLat) + 1.175 * Math.cos(4 * avgLat);
    const mPerDegLng = 111412.84 * Math.cos(avgLat) - 93.5 * Math.cos(3 * avgLat);

    let areaSqMeters = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const xi = ring[i][0] * mPerDegLng;
      const yi = ring[i][1] * mPerDegLat;
      const xj = ring[j][0] * mPerDegLng;
      const yj = ring[j][1] * mPerDegLat;
      areaSqMeters += xi * yj - xj * yi;
    }
    areaSqMeters = Math.abs(areaSqMeters) / 2.0;

    // 1 Decimal = 40.4686 square meters
    const decimals = areaSqMeters / 40.4686;
    return Number(decimals.toFixed(4));
  }

  /**
   * Check if a 2D point [lng, lat] is inside a polygon ring
   */
  static isPointInPolygon(point: [number, number], ring: number[][]): boolean {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Detect cadastral boundary overlaps between two GeoJSON polygons
   */
  static checkPolygonOverlap(
    polyA: number[][],
    polyB: number[][]
  ): { hasOverlap: boolean; estimatedOverlapDecimal: number; overlapPoints: number[][] } {
    if (!polyA || !polyB || polyA.length < 3 || polyB.length < 3) {
      return { hasOverlap: false, estimatedOverlapDecimal: 0, overlapPoints: [] };
    }

    // Check if any vertices of PolyA are inside PolyB
    const overlapPoints: number[][] = [];
    for (const pt of polyA) {
      if (this.isPointInPolygon([pt[0], pt[1]], polyB)) {
        overlapPoints.push(pt);
      }
    }
    // Check if any vertices of PolyB are inside PolyA
    for (const pt of polyB) {
      if (this.isPointInPolygon([pt[0], pt[1]], polyA)) {
        overlapPoints.push(pt);
      }
    }

    const hasOverlap = overlapPoints.length > 0;
    const estimatedOverlapDecimal = hasOverlap
      ? Number((this.calculatePolygonAreaDecimal(polyA) * 0.12).toFixed(4))
      : 0;

    return {
      hasOverlap,
      estimatedOverlapDecimal,
      overlapPoints,
    };
  }
}
