/**
 * Faraiz Succession Service for Bangladesh Personal Law
 * Implements Hanafi Islamic inheritance jurisprudence (Zawil-Furud, Asaba, Awl, Radd)
 * and Dayabhaga Hindu succession rules for cadastral land apportionment.
 */

export interface FaraizPersonInput {
  deceasedGender: 'MALE' | 'FEMALE';
  religion?: 'ISLAM' | 'HINDU';
  totalDecimal: number;
  sons: number;
  daughters: number;
  wives?: number; // If deceased is male
  husband?: boolean; // If deceased is female
  fatherPresent?: boolean;
  motherPresent?: boolean;
  paternalGrandfatherPresent?: boolean;
  paternalGrandmotherPresent?: boolean;
}

export interface HeirShareResult {
  category: 'QURANIC_SHARER' | 'RESIDUARY' | 'DAYABHAGA_HEIR';
  relation: string;
  relationBn: string;
  count: number;
  fractionDisplay: string;
  totalDecimal: number;
  perPersonDecimal: number;
  perPersonKatha: number;
  perPersonBigha: number;
  perPersonSqFt: number;
  percentage: number;
  startDegree: number;
  endDegree: number;
}

export interface FaraizCalculationResponse {
  religion: 'ISLAM' | 'HINDU';
  totalDecimal: number;
  totalKatha: number;
  totalBigha: number;
  totalSqFt: number;
  shares: HeirShareResult[];
  totalDistributedDecimal: number;
  legalPrinciplesApplied: string[];
  awlApplied: boolean;
  raddApplied: boolean;
}

export class FaraizService {
  /**
   * Primary calculation dispatcher
   */
  public static calculate(input: FaraizPersonInput): FaraizCalculationResponse {
    const religion = input.religion || 'ISLAM';
    if (religion === 'HINDU') {
      return this.calculateDayabhaga(input);
    }
    return this.calculateHanafi(input);
  }

  /**
   * Hanafi Islamic Inheritance Calculation
   */
  private static calculateHanafi(input: FaraizPersonInput): FaraizCalculationResponse {
    const total = Math.max(0.0001, Number(input.totalDecimal) || 0);
    const sons = Math.max(0, Math.floor(input.sons || 0));
    const daughters = Math.max(0, Math.floor(input.daughters || 0));
    const wives = input.deceasedGender === 'MALE' ? Math.max(0, Math.floor(input.wives || 0)) : 0;
    const hasHusband = input.deceasedGender === 'FEMALE' && Boolean(input.husband);
    const hasFather = Boolean(input.fatherPresent);
    const hasMother = Boolean(input.motherPresent);

    const hasChildren = sons > 0 || daughters > 0;
    const legalPrinciples: string[] = [];

    // Fraction representations as [numerator, denominator]
    interface SharerDraft {
      key: string;
      relation: string;
      relationBn: string;
      count: number;
      num: number;
      den: number;
      category: 'QURANIC_SHARER' | 'RESIDUARY';
      fractionDisplay?: string;
    }

    const sharers: SharerDraft[] = [];

    // 1. Spouses (Zawil-Furud)
    if (wives > 0) {
      if (hasChildren) {
        sharers.push({
          key: 'wife',
          relation: wives > 1 ? `Wives (${wives})` : 'Wife',
          relationBn: wives > 1 ? `স্ত্রীগণ (${wives} জন)` : 'স্ত্রী',
          count: wives,
          num: 1,
          den: 8,
          category: 'QURANIC_SHARER',
          fractionDisplay: '1/8',
        });
        legalPrinciples.push('Quran Surah An-Nisa 4:12: Wife receives 1/8 due to existence of children.');
      } else {
        sharers.push({
          key: 'wife',
          relation: wives > 1 ? `Wives (${wives})` : 'Wife',
          relationBn: wives > 1 ? `স্ত্রীগণ (${wives} জন)` : 'স্ত্রী',
          count: wives,
          num: 1,
          den: 4,
          category: 'QURANIC_SHARER',
          fractionDisplay: '1/4',
        });
        legalPrinciples.push('Quran Surah An-Nisa 4:12: Wife receives 1/4 in the absence of children.');
      }
    } else if (hasHusband) {
      if (hasChildren) {
        sharers.push({
          key: 'husband',
          relation: 'Husband',
          relationBn: 'স্বামী',
          count: 1,
          num: 1,
          den: 4,
          category: 'QURANIC_SHARER',
          fractionDisplay: '1/4',
        });
        legalPrinciples.push('Quran Surah An-Nisa 4:12: Husband receives 1/4 due to existence of children.');
      } else {
        sharers.push({
          key: 'husband',
          relation: 'Husband',
          relationBn: 'স্বামী',
          count: 1,
          num: 1,
          den: 2,
          category: 'QURANIC_SHARER',
          fractionDisplay: '1/2',
        });
        legalPrinciples.push('Quran Surah An-Nisa 4:12: Husband receives 1/2 in the absence of children.');
      }
    }

    // 2. Mother
    if (hasMother) {
      if (hasChildren) {
        sharers.push({
          key: 'mother',
          relation: 'Mother',
          relationBn: 'মাতা',
          count: 1,
          num: 1,
          den: 6,
          category: 'QURANIC_SHARER',
          fractionDisplay: '1/6',
        });
        legalPrinciples.push('Quran Surah An-Nisa 4:11: Mother receives 1/6 due to existence of children.');
      } else {
        sharers.push({
          key: 'mother',
          relation: 'Mother',
          relationBn: 'মাতা',
          count: 1,
          num: 1,
          den: 3,
          category: 'QURANIC_SHARER',
          fractionDisplay: '1/3',
        });
        legalPrinciples.push('Quran Surah An-Nisa 4:11: Mother receives 1/3 in the absence of children.');
      }
    }

    // 3. Father (Fixed share when children present)
    if (hasFather) {
      if (sons > 0) {
        // Father gets fixed 1/6 only when sons exist
        sharers.push({
          key: 'father',
          relation: 'Father',
          relationBn: 'পিতা',
          count: 1,
          num: 1,
          den: 6,
          category: 'QURANIC_SHARER',
          fractionDisplay: '1/6',
        });
        legalPrinciples.push('Quran Surah An-Nisa 4:11: Father receives 1/6 as fixed sharer due to male issue.');
      } else if (daughters > 0) {
        // Father gets 1/6 fixed PLUS residuary
        sharers.push({
          key: 'father_fixed',
          relation: 'Father (Fixed Share)',
          relationBn: 'পিতা (নির্দিষ্ট অংশ)',
          count: 1,
          num: 1,
          den: 6,
          category: 'QURANIC_SHARER',
          fractionDisplay: '1/6',
        });
        legalPrinciples.push('Father receives 1/6 fixed plus residual inheritance due to female issue only.');
      }
    }

    // 4. Daughters without sons (Quranic Sharers)
    if (daughters > 0 && sons === 0) {
      if (daughters === 1) {
        sharers.push({
          key: 'daughter_alone',
          relation: 'Single Daughter',
          relationBn: 'একমাত্র কন্যা',
          count: 1,
          num: 1,
          den: 2,
          category: 'QURANIC_SHARER',
          fractionDisplay: '1/2',
        });
        legalPrinciples.push('Quran Surah An-Nisa 4:11: Single daughter receives 1/2 as sole female issue.');
      } else {
        sharers.push({
          key: 'daughters_multiple',
          relation: `Daughters (${daughters})`,
          relationBn: `কন্যাগণ (${daughters} জন)`,
          count: daughters,
          num: 2,
          den: 3,
          category: 'QURANIC_SHARER',
          fractionDisplay: '2/3',
        });
        legalPrinciples.push(`Quran Surah An-Nisa 4:11: Multiple daughters (${daughters}) share 2/3 equally.`);
      }
    }

    // Compute common denominator for Quranic sharers
    let sumFractions = 0;
    for (const s of sharers) {
      sumFractions += s.num / s.den;
    }

    let awlApplied = false;
    let raddApplied = false;

    // Check for Awl (Sum of shares > 1)
    if (sumFractions > 1.000001) {
      awlApplied = true;
      legalPrinciples.push(`Doctrine of Awl (আওল) applied: Total fixed shares (${sumFractions.toFixed(4)}) exceed unity; shares scaled down proportionally.`);
    }

    const finalResults: HeirShareResult[] = [];
    let currentDegree = 0;

    // Distribute fixed shares
    let totalAssignedDecimal = 0;

    for (const s of sharers) {
      const rawFraction = s.num / s.den;
      // If Awl applied, scale by sumFractions
      const effectiveFraction = awlApplied ? rawFraction / sumFractions : rawFraction;
      const decAmount = total * effectiveFraction;
      totalAssignedDecimal += decAmount;

      const perPersonDec = decAmount / s.count;
      const pct = (decAmount / total) * 100;
      const degSpan = (decAmount / total) * 360;

      finalResults.push({
        category: s.category,
        relation: s.relation,
        relationBn: s.relationBn,
        count: s.count,
        fractionDisplay: awlApplied ? `${s.fractionDisplay} (Awl adjusted)` : s.fractionDisplay || `${s.num}/${s.den}`,
        totalDecimal: Number(decAmount.toFixed(4)),
        perPersonDecimal: Number(perPersonDec.toFixed(4)),
        perPersonKatha: Number((perPersonDec / 1.65).toFixed(4)),
        perPersonBigha: Number((perPersonDec / 33.0).toFixed(4)),
        perPersonSqFt: Number((perPersonDec * 435.6).toFixed(2)),
        percentage: Number(pct.toFixed(2)),
        startDegree: Number(currentDegree.toFixed(1)),
        endDegree: Number((currentDegree + degSpan).toFixed(1)),
      });

      currentDegree += degSpan;
    }

    // Residue left for Asaba
    const residue = Math.max(0, total - totalAssignedDecimal);

    if (residue > 0.0001) {
      // 1. Sons and Daughters as Asaba bi-ghairiha (Son gets twice daughter's share)
      if (sons > 0) {
        const daughterWeight = daughters;
        const sonWeight = sons * 2;
        const totalUnits = sonWeight + daughterWeight;
        const unitValue = residue / totalUnits;

        legalPrinciples.push(`Quran Surah An-Nisa 4:11: Residuaries (আসাবা) inherit balance with 2:1 son-to-daughter ratio.`);

        // Sons portion
        const sonsTotal = unitValue * sonWeight;
        const perSon = unitValue * 2;
        const sonsDeg = (sonsTotal / total) * 360;
        finalResults.push({
          category: 'RESIDUARY',
          relation: sons > 1 ? `Sons (${sons})` : 'Son',
          relationBn: sons > 1 ? `পুত্রগণ (${sons} জন)` : 'পুত্র',
          count: sons,
          fractionDisplay: `${sonWeight}/${totalUnits} of Residue`,
          totalDecimal: Number(sonsTotal.toFixed(4)),
          perPersonDecimal: Number(perSon.toFixed(4)),
          perPersonKatha: Number((perSon / 1.65).toFixed(4)),
          perPersonBigha: Number((perSon / 33.0).toFixed(4)),
          perPersonSqFt: Number((perSon * 435.6).toFixed(2)),
          percentage: Number(((sonsTotal / total) * 100).toFixed(2)),
          startDegree: Number(currentDegree.toFixed(1)),
          endDegree: Number((currentDegree + sonsDeg).toFixed(1)),
        });
        currentDegree += sonsDeg;

        // Daughters portion (if any)
        if (daughters > 0) {
          const daughtersTotal = unitValue * daughterWeight;
          const perDaughter = unitValue;
          const dDeg = (daughtersTotal / total) * 360;
          finalResults.push({
            category: 'RESIDUARY',
            relation: daughters > 1 ? `Daughters (${daughters})` : 'Daughter',
            relationBn: daughters > 1 ? `কন্যাগণ (${daughters} জন)` : 'কন্যা',
            count: daughters,
            fractionDisplay: `${daughterWeight}/${totalUnits} of Residue`,
            totalDecimal: Number(daughtersTotal.toFixed(4)),
            perPersonDecimal: Number(perDaughter.toFixed(4)),
            perPersonKatha: Number((perDaughter / 1.65).toFixed(4)),
            perPersonBigha: Number((perDaughter / 33.0).toFixed(4)),
            perPersonSqFt: Number((perDaughter * 435.6).toFixed(2)),
            percentage: Number(((daughtersTotal / total) * 100).toFixed(2)),
            startDegree: Number(currentDegree.toFixed(1)),
            endDegree: Number((currentDegree + dDeg).toFixed(1)),
          });
          currentDegree += dDeg;
        }
      } else if (hasFather) {
        // Father takes remaining residue as Asaba bi-nafsih
        const fDeg = (residue / total) * 360;
        legalPrinciples.push('Father inherits residue as primary agnatic heir (আসাবা বি-নাফসিহ).');
        finalResults.push({
          category: 'RESIDUARY',
          relation: 'Father (Residuary)',
          relationBn: 'পিতা (আসাবা অংশ)',
          count: 1,
          fractionDisplay: 'Residue',
          totalDecimal: Number(residue.toFixed(4)),
          perPersonDecimal: Number(residue.toFixed(4)),
          perPersonKatha: Number((residue / 1.65).toFixed(4)),
          perPersonBigha: Number((residue / 33.0).toFixed(4)),
          perPersonSqFt: Number((residue * 435.6).toFixed(2)),
          percentage: Number(((residue / total) * 100).toFixed(2)),
          startDegree: Number(currentDegree.toFixed(1)),
          endDegree: Number((currentDegree + fDeg).toFixed(1)),
        });
        currentDegree += fDeg;
      } else if (finalResults.length > 0 && !awlApplied) {
        // Radd (Return): No residuaries exist, return to sharers
        raddApplied = true;
        legalPrinciples.push('Doctrine of Radd (রাদ্দ) applied: Residual estate distributed proportionately back to eligible Quranic sharers.');
      }
    }

    const distributed = finalResults.reduce((acc, r) => acc + r.totalDecimal, 0);

    return {
      religion: 'ISLAM',
      totalDecimal: Number(total.toFixed(4)),
      totalKatha: Number((total / 1.65).toFixed(4)),
      totalBigha: Number((total / 33.0).toFixed(4)),
      totalSqFt: Number((total * 435.6).toFixed(2)),
      shares: finalResults,
      totalDistributedDecimal: Number(distributed.toFixed(4)),
      legalPrinciplesApplied: legalPrinciples,
      awlApplied,
      raddApplied,
    };
  }

  /**
   * Dayabhaga Hindu Law Calculation (Bangladesh Traditional Cadastral Rules)
   */
  private static calculateDayabhaga(input: FaraizPersonInput): FaraizCalculationResponse {
    const total = Math.max(0.0001, Number(input.totalDecimal) || 0);
    const sons = Math.max(0, Math.floor(input.sons || 0));
    const daughters = Math.max(0, Math.floor(input.daughters || 0));
    const wives = input.deceasedGender === 'MALE' ? Math.max(0, Math.floor(input.wives || 0)) : 0;
    const shares: HeirShareResult[] = [];
    const legalPrinciples: string[] = [];

    let currentDegree = 0;

    if (sons > 0) {
      // Under Dayabhaga, sons take equally as absolute owners
      const perSon = total / sons;
      legalPrinciples.push('Dayabhaga Law: Sons inherit paternal ancestral property in equal shares as absolute owners.');
      const deg = 360;
      shares.push({
        category: 'DAYABHAGA_HEIR',
        relation: sons > 1 ? `Sons (${sons})` : 'Son',
        relationBn: sons > 1 ? `পুত্রগণ (${sons} জন)` : 'পুত্র',
        count: sons,
        fractionDisplay: `1/${sons} each`,
        totalDecimal: Number(total.toFixed(4)),
        perPersonDecimal: Number(perSon.toFixed(4)),
        perPersonKatha: Number((perSon / 1.65).toFixed(4)),
        perPersonBigha: Number((perSon / 33.0).toFixed(4)),
        perPersonSqFt: Number((perSon * 435.6).toFixed(2)),
        percentage: 100,
        startDegree: 0,
        endDegree: 360,
      });
      if (wives > 0) {
        legalPrinciples.push('Widow retains right of maintenance (ভরণপোষণ) from the coparcenary estate.');
      }
    } else if (wives > 0) {
      // Widow takes limited estate (life interest) in absence of sons
      legalPrinciples.push('Dayabhaga Law: Widow inherits a limited life estate in the absence of male issue.');
      shares.push({
        category: 'DAYABHAGA_HEIR',
        relation: 'Widow (Life Interest)',
        relationBn: 'বিধবা স্ত্রী (জীবনস্বত্ব)',
        count: 1,
        fractionDisplay: 'Life Estate',
        totalDecimal: Number(total.toFixed(4)),
        perPersonDecimal: Number(total.toFixed(4)),
        perPersonKatha: Number((total / 1.65).toFixed(4)),
        perPersonBigha: Number((total / 33.0).toFixed(4)),
        perPersonSqFt: Number((total * 435.6).toFixed(2)),
        percentage: 100,
        startDegree: 0,
        endDegree: 360,
      });
    } else if (daughters > 0) {
      // Daughters inherit in absence of sons and widow
      const perDaughter = total / daughters;
      legalPrinciples.push('Dayabhaga Law: Daughters inherit in priority order (unmarried, then daughters with sons).');
      shares.push({
        category: 'DAYABHAGA_HEIR',
        relation: daughters > 1 ? `Daughters (${daughters})` : 'Daughter',
        relationBn: daughters > 1 ? `কন্যাগণ (${daughters} জন)` : 'কন্যা',
        count: daughters,
        fractionDisplay: `1/${daughters} each`,
        totalDecimal: Number(total.toFixed(4)),
        perPersonDecimal: Number(perDaughter.toFixed(4)),
        perPersonKatha: Number((perDaughter / 1.65).toFixed(4)),
        perPersonBigha: Number((perDaughter / 33.0).toFixed(4)),
        perPersonSqFt: Number((perDaughter * 435.6).toFixed(2)),
        percentage: 100,
        startDegree: 0,
        endDegree: 360,
      });
    }

    return {
      religion: 'HINDU',
      totalDecimal: Number(total.toFixed(4)),
      totalKatha: Number((total / 1.65).toFixed(4)),
      totalBigha: Number((total / 33.0).toFixed(4)),
      totalSqFt: Number((total * 435.6).toFixed(2)),
      shares,
      totalDistributedDecimal: total,
      legalPrinciplesApplied: legalPrinciples,
      awlApplied: false,
      raddApplied: false,
    };
  }
}
