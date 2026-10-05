import { useState, useMemo, useEffect } from 'react';
import { Calculator, Users, Compass, BookOpen, Layers, CheckCircle2, Copy, Check, Sparkles } from 'lucide-react';
import Modal from './Modal';
import { Button, inputClass } from './ui';
import { useLanguage } from '../lib/language';
import { cx } from '../lib/format';

interface HeirShare {
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

const PALETTE = [
  '#22456e', // survey indigo
  '#116149', // state green
  '#7f5a10', // amber
  '#a8322a', // registrar seal
  '#4a5250', // dark ink
  '#3b6998', // steel indigo
  '#2d8659', // emerald
  '#8a6d3b', // ochre
];

function getDonutSlicePath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number
): string {
  const span = Math.min(359.99, Math.max(0.1, endDeg - startDeg));
  const sRad = ((startDeg - 90) * Math.PI) / 180;
  const eRad = ((startDeg + span - 90) * Math.PI) / 180;

  const x1 = cx + rOuter * Math.cos(sRad);
  const y1 = cy + rOuter * Math.sin(sRad);
  const x2 = cx + rOuter * Math.cos(eRad);
  const y2 = cy + rOuter * Math.sin(eRad);

  const x3 = cx + rInner * Math.cos(eRad);
  const y3 = cy + rInner * Math.sin(eRad);
  const x4 = cx + rInner * Math.cos(sRad);
  const y4 = cy + rInner * Math.sin(sRad);

  const largeArc = span > 180 ? 1 : 0;

  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2.toFixed(
    2
  )} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4.toFixed(
    2
  )} ${y4.toFixed(2)} Z`;
}

export default function FaraizCalculatorModal({
  open,
  onClose,
  initialDecimal = 5.5,
  parcelId,
}: {
  open: boolean;
  onClose: () => void;
  initialDecimal?: number;
  parcelId?: string;
}) {
  const { t, lang } = useLanguage();

  const [religion, setReligion] = useState<'ISLAM' | 'HINDU'>('ISLAM');
  const [deceasedGender, setDeceasedGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [totalDecimal, setTotalDecimal] = useState<number>(initialDecimal);

  // Surviving heirs
  const [wives, setWives] = useState<number>(1);
  const [husband, setHusband] = useState<boolean>(false);
  const [sons, setSons] = useState<number>(2);
  const [daughters, setDaughters] = useState<number>(1);
  const [fatherPresent, setFatherPresent] = useState<boolean>(false);
  const [motherPresent, setMotherPresent] = useState<boolean>(true);

  const [apiResult, setApiResult] = useState<any | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeSliceIndex, setActiveSliceIndex] = useState<number | null>(null);

  useEffect(() => {
    if (initialDecimal) {
      setTotalDecimal(initialDecimal);
    }
  }, [initialDecimal]);

  // Quick preset loader
  const applyPreset = (presetKey: string) => {
    switch (presetKey) {
      case 'standard':
        setReligion('ISLAM');
        setDeceasedGender('MALE');
        setWives(1);
        setHusband(false);
        setSons(2);
        setDaughters(1);
        setFatherPresent(false);
        setMotherPresent(true);
        break;
      case 'daughter_parents':
        setReligion('ISLAM');
        setDeceasedGender('MALE');
        setWives(1);
        setHusband(false);
        setSons(0);
        setDaughters(1);
        setFatherPresent(true);
        setMotherPresent(true);
        break;
      case 'daughters_only':
        setReligion('ISLAM');
        setDeceasedGender('MALE');
        setWives(1);
        setHusband(false);
        setSons(0);
        setDaughters(3);
        setFatherPresent(false);
        setMotherPresent(true);
        break;
      case 'husband_children':
        setReligion('ISLAM');
        setDeceasedGender('FEMALE');
        setWives(0);
        setHusband(true);
        setSons(1);
        setDaughters(2);
        setFatherPresent(false);
        setMotherPresent(true);
        break;
      case 'hindu_sons':
        setReligion('HINDU');
        setDeceasedGender('MALE');
        setWives(1);
        setHusband(false);
        setSons(2);
        setDaughters(1);
        setFatherPresent(false);
        setMotherPresent(false);
        break;
    }
  };

  // Client-side fallback calculation for seamless offline operation
  const fallbackCalculation = useMemo(() => {
    const total = Math.max(0.001, totalDecimal || 0);
    const shares: HeirShare[] = [];
    let currentDegree = 0;

    if (religion === 'HINDU') {
      if (sons > 0) {
        const perSon = total / sons;
        shares.push({
          category: 'DAYABHAGA_HEIR',
          relation: sons > 1 ? `Sons (${sons})` : 'Son',
          relationBn: sons > 1 ? `পুত্রগণ (${sons} জন)` : 'পুত্র',
          count: sons,
          fractionDisplay: `1/${sons} each`,
          totalDecimal: total,
          perPersonDecimal: perSon,
          perPersonKatha: perSon / 1.65,
          perPersonBigha: perSon / 33.0,
          perPersonSqFt: perSon * 435.6,
          percentage: 100,
          startDegree: 0,
          endDegree: 360,
        });
      } else if (wives > 0) {
        shares.push({
          category: 'DAYABHAGA_HEIR',
          relation: 'Widow (Life Interest)',
          relationBn: 'বিধবা স্ত্রী (জীবনস্বত্ব)',
          count: 1,
          fractionDisplay: 'Life Estate',
          totalDecimal: total,
          perPersonDecimal: total,
          perPersonKatha: total / 1.65,
          perPersonBigha: total / 33.0,
          perPersonSqFt: total * 435.6,
          percentage: 100,
          startDegree: 0,
          endDegree: 360,
        });
      } else if (daughters > 0) {
        const perDaughter = total / daughters;
        shares.push({
          category: 'DAYABHAGA_HEIR',
          relation: daughters > 1 ? `Daughters (${daughters})` : 'Daughter',
          relationBn: daughters > 1 ? `কন্যাগণ (${daughters} জন)` : 'কন্যা',
          count: daughters,
          fractionDisplay: `1/${daughters} each`,
          totalDecimal: total,
          perPersonDecimal: perDaughter,
          perPersonKatha: perDaughter / 1.65,
          perPersonBigha: perDaughter / 33.0,
          perPersonSqFt: perDaughter * 435.6,
          percentage: 100,
          startDegree: 0,
          endDegree: 360,
        });
      }
      return {
        shares,
        legalPrinciplesApplied: ['Dayabhaga Hindu Succession Law (Bangladesh Traditional Codification)'],
      };
    }

    // Hanafi Islamic Succession
    const hasChildren = sons > 0 || daughters > 0;
    let distributed = 0;

    // 1. Spouses (Zawil-Furud)
    if (deceasedGender === 'MALE' && wives > 0) {
      const frac = hasChildren ? 1 / 8 : 1 / 4;
      const dec = total * frac;
      distributed += dec;
      const deg = (dec / total) * 360;
      shares.push({
        category: 'QURANIC_SHARER',
        relation: wives > 1 ? `Wives (${wives})` : 'Wife',
        relationBn: wives > 1 ? `স্ত্রীগণ (${wives} জন)` : 'স্ত্রী',
        count: wives,
        fractionDisplay: hasChildren ? '1/8' : '1/4',
        totalDecimal: dec,
        perPersonDecimal: dec / wives,
        perPersonKatha: dec / wives / 1.65,
        perPersonBigha: dec / wives / 33.0,
        perPersonSqFt: (dec / wives) * 435.6,
        percentage: (dec / total) * 100,
        startDegree: currentDegree,
        endDegree: currentDegree + deg,
      });
      currentDegree += deg;
    } else if (deceasedGender === 'FEMALE' && husband) {
      const frac = hasChildren ? 1 / 4 : 1 / 2;
      const dec = total * frac;
      distributed += dec;
      const deg = (dec / total) * 360;
      shares.push({
        category: 'QURANIC_SHARER',
        relation: 'Husband',
        relationBn: 'স্বামী',
        count: 1,
        fractionDisplay: hasChildren ? '1/4' : '1/2',
        totalDecimal: dec,
        perPersonDecimal: dec,
        perPersonKatha: dec / 1.65,
        perPersonBigha: dec / 33.0,
        perPersonSqFt: dec * 435.6,
        percentage: (dec / total) * 100,
        startDegree: currentDegree,
        endDegree: currentDegree + deg,
      });
      currentDegree += deg;
    }

    // 2. Mother
    if (motherPresent) {
      const frac = hasChildren ? 1 / 6 : 1 / 3;
      const dec = total * frac;
      distributed += dec;
      const deg = (dec / total) * 360;
      shares.push({
        category: 'QURANIC_SHARER',
        relation: 'Mother',
        relationBn: 'মাতা',
        count: 1,
        fractionDisplay: hasChildren ? '1/6' : '1/3',
        totalDecimal: dec,
        perPersonDecimal: dec,
        perPersonKatha: dec / 1.65,
        perPersonBigha: dec / 33.0,
        perPersonSqFt: dec * 435.6,
        percentage: (dec / total) * 100,
        startDegree: currentDegree,
        endDegree: currentDegree + deg,
      });
      currentDegree += deg;
    }

    // 3. Father
    if (fatherPresent) {
      const frac = hasChildren ? 1 / 6 : 0;
      if (hasChildren) {
        const dec = total * frac;
        distributed += dec;
        const deg = (dec / total) * 360;
        shares.push({
          category: 'QURANIC_SHARER',
          relation: 'Father',
          relationBn: 'পিতা',
          count: 1,
          fractionDisplay: '1/6',
          totalDecimal: dec,
          perPersonDecimal: dec,
          perPersonKatha: dec / 1.65,
          perPersonBigha: dec / 33.0,
          perPersonSqFt: dec * 435.6,
          percentage: (dec / total) * 100,
          startDegree: currentDegree,
          endDegree: currentDegree + deg,
        });
        currentDegree += deg;
      }
    }

    // 4. Residue for Asaba
    const residue = Math.max(0, total - distributed);
    if (residue > 0.0001) {
      if (sons > 0) {
        const totalUnits = sons * 2 + daughters;
        const unitVal = residue / totalUnits;
        const sonsTotal = unitVal * 2 * sons;
        const sonsDeg = (sonsTotal / total) * 360;
        shares.push({
          category: 'RESIDUARY',
          relation: sons > 1 ? `Sons (${sons})` : 'Son',
          relationBn: sons > 1 ? `পুত্রগণ (${sons} জন)` : 'পুত্র',
          count: sons,
          fractionDisplay: `${sons * 2}/${totalUnits} of Residue`,
          totalDecimal: sonsTotal,
          perPersonDecimal: unitVal * 2,
          perPersonKatha: (unitVal * 2) / 1.65,
          perPersonBigha: (unitVal * 2) / 33.0,
          perPersonSqFt: unitVal * 2 * 435.6,
          percentage: (sonsTotal / total) * 100,
          startDegree: currentDegree,
          endDegree: currentDegree + sonsDeg,
        });
        currentDegree += sonsDeg;

        if (daughters > 0) {
          const daughtersTotal = unitVal * daughters;
          const dDeg = (daughtersTotal / total) * 360;
          shares.push({
            category: 'RESIDUARY',
            relation: daughters > 1 ? `Daughters (${daughters})` : 'Daughter',
            relationBn: daughters > 1 ? `কন্যাগণ (${daughters} জন)` : 'কন্যা',
            count: daughters,
            fractionDisplay: `${daughters}/${totalUnits} of Residue`,
            totalDecimal: daughtersTotal,
            perPersonDecimal: unitVal,
            perPersonKatha: unitVal / 1.65,
            perPersonBigha: unitVal / 33.0,
            perPersonSqFt: unitVal * 435.6,
            percentage: (daughtersTotal / total) * 100,
            startDegree: currentDegree,
            endDegree: currentDegree + dDeg,
          });
          currentDegree += dDeg;
        }
      } else if (daughters > 0) {
        const frac = daughters === 1 ? 1 / 2 : 2 / 3;
        const dec = total * frac;
        const deg = (dec / total) * 360;
        shares.push({
          category: 'QURANIC_SHARER',
          relation: daughters === 1 ? 'Daughter' : `Daughters (${daughters})`,
          relationBn: daughters === 1 ? 'কন্যা' : `কন্যাগণ (${daughters} জন)`,
          count: daughters,
          fractionDisplay: daughters === 1 ? '1/2' : '2/3',
          totalDecimal: dec,
          perPersonDecimal: dec / daughters,
          perPersonKatha: dec / daughters / 1.65,
          perPersonBigha: dec / daughters / 33.0,
          perPersonSqFt: (dec / daughters) * 435.6,
          percentage: (dec / total) * 100,
          startDegree: currentDegree,
          endDegree: currentDegree + deg,
        });
        currentDegree += deg;

        if (fatherPresent) {
          const fResidue = Math.max(0, residue - dec);
          if (fResidue > 0) {
            const fDeg = (fResidue / total) * 360;
            shares.push({
              category: 'RESIDUARY',
              relation: 'Father (Residuary)',
              relationBn: 'পিতা (অবশিষ্টাংশ)',
              count: 1,
              fractionDisplay: 'Residue',
              totalDecimal: fResidue,
              perPersonDecimal: fResidue,
              perPersonKatha: fResidue / 1.65,
              perPersonBigha: fResidue / 33.0,
              perPersonSqFt: fResidue * 435.6,
              percentage: (fResidue / total) * 100,
              startDegree: currentDegree,
              endDegree: currentDegree + fDeg,
            });
            currentDegree += fDeg;
          }
        }
      } else if (fatherPresent) {
        const fDeg = (residue / total) * 360;
        shares.push({
          category: 'RESIDUARY',
          relation: 'Father (Residuary)',
          relationBn: 'পিতা (আসাবা)',
          count: 1,
          fractionDisplay: 'Residue',
          totalDecimal: residue,
          perPersonDecimal: residue,
          perPersonKatha: residue / 1.65,
          perPersonBigha: residue / 33.0,
          perPersonSqFt: residue * 435.6,
          percentage: (residue / total) * 100,
          startDegree: currentDegree,
          endDegree: currentDegree + fDeg,
        });
        currentDegree += fDeg;
      }
    }

    return {
      shares,
      legalPrinciplesApplied: [
        'Quran Surah An-Nisa 4:11-12 (Islamic Succession Law)',
        'Residuary heirs (Asaba) inherit remaining estate in 2:1 ratio for sons to daughters',
        'Standard conversion: 1 Decimal = 1.65 Katha = 435.60 Square Feet (DLRS BDS Standard)',
      ],
    };
  }, [religion, deceasedGender, totalDecimal, wives, husband, sons, daughters, fatherPresent, motherPresent]);

  // Synchronize with backend API
  useEffect(() => {
    let active = true;
    const fetchCalc = async () => {
      try {
        const res = await fetch('/api/tools/faraiz-calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            religion,
            deceasedGender,
            totalDecimal,
            sons,
            daughters,
            wives: deceasedGender === 'MALE' ? wives : 0,
            husband: deceasedGender === 'FEMALE' ? husband : false,
            fatherPresent,
            motherPresent,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (active && data.success && data.data) {
            setApiResult(data.data);
          }
        }
      } catch {
        // Fallback to local calculation
      }
    };

    fetchCalc();
    return () => {
      active = false;
    };
  }, [religion, deceasedGender, totalDecimal, wives, husband, sons, daughters, fatherPresent, motherPresent]);

  const activeResult = apiResult || fallbackCalculation;
  const shares: HeirShare[] = activeResult.shares || [];
  const totalDistributed = shares.reduce((acc, s) => acc + s.totalDecimal, 0);

  const copySummary = () => {
    const textLines = [
      `Bangladesh Land Platform - Faraiz Succession Distribution`,
      `Total Area: ${totalDecimal.toFixed(2)} Decimal (${(totalDecimal / 1.65).toFixed(2)} Katha)`,
      `Jurisprudence: ${religion === 'ISLAM' ? 'Hanafi Islamic' : 'Dayabhaga Hindu'}`,
      `Deceased: ${deceasedGender === 'MALE' ? 'Male' : 'Female'}`,
      `--- Heir Distribution ---`,
      ...shares.map(
        (s) =>
          `- ${s.relation} (${s.relationBn}): ${s.fractionDisplay} -> ${s.totalDecimal.toFixed(2)} Dec (${s.perPersonDecimal.toFixed(2)} Dec each)`
      ),
    ];
    navigator.clipboard.writeText(textLines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="5xl"
      maxHeight="max-h-[88vh]"
      label={t('Cadastral Inheritance Partition', 'ফারায়েয ও উত্তরাধিকারী বণ্টন')}
      title={t('Faraiz Land Succession Calculator', 'ফারায়েয ভূমি উত্তরাধিকার বণ্টন ক্যালকুলেটর')}
      bn="ইসলামিক ও হিন্দু উত্তরাধিকার আইন অনুযায়ী খতিয়ান বণ্টন"
    >
      <div className="space-y-5">
        {/* Preset Scenarios Quick Select */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line-hair pb-3">
          <span className="mono text-2xs uppercase text-ink-3">
            {t('Quick Presets', 'সাধারণ পরিবার কাঠামো')}:
          </span>
          <button
            type="button"
            onClick={() => applyPreset('standard')}
            className="border border-line bg-sheet px-2 py-1 text-xs text-ink hover:border-indigo hover:bg-indigo-soft hover:text-indigo"
          >
            {t('Wife, 2 Sons, 1 Daughter', 'স্ত্রী, ২ পুত্র, ১ কন্যা')}
          </button>
          <button
            type="button"
            onClick={() => applyPreset('daughter_parents')}
            className="border border-line bg-sheet px-2 py-1 text-xs text-ink hover:border-indigo hover:bg-indigo-soft hover:text-indigo"
          >
            {t('1 Daughter & Parents', 'একমাত্র কন্যা ও পিতা-মাতা')}
          </button>
          <button
            type="button"
            onClick={() => applyPreset('daughters_only')}
            className="border border-line bg-sheet px-2 py-1 text-xs text-ink hover:border-indigo hover:bg-indigo-soft hover:text-indigo"
          >
            {t('Daughters Only (2/3)', 'শুধুমাত্র কন্যাগণ')}
          </button>
          <button
            type="button"
            onClick={() => applyPreset('husband_children')}
            className="border border-line bg-sheet px-2 py-1 text-xs text-ink hover:border-indigo hover:bg-indigo-soft hover:text-indigo"
          >
            {t('Female Deceased (Husband + Issue)', 'মৃত নারী (স্বামী ও সন্তান)')}
          </button>
          <button
            type="button"
            onClick={() => applyPreset('hindu_sons')}
            className="border border-line bg-sheet px-2 py-1 text-xs text-ink hover:border-indigo hover:bg-indigo-soft hover:text-indigo"
          >
            {t('Dayabhaga (Sons Equal)', 'দায়ভাগ (পুত্রদের সমবণ্টন)')}
          </button>
        </div>

        {/* Top Control Matrix */}
        <div className="grid grid-cols-1 gap-3 border border-line bg-sheet-raised p-3.5 sm:grid-cols-3">
          <div>
            <span className="mono block text-2xs uppercase text-ink-3">
              {t('Succession Jurisprudence', 'আইনি বিধান')}
            </span>
            <div className="mt-1.5 flex gap-1.5">
              <button
                type="button"
                onClick={() => setReligion('ISLAM')}
                className={cx(
                  'flex-1 border px-2.5 py-1.5 text-xs font-semibold transition-colors',
                  religion === 'ISLAM'
                    ? 'border-indigo bg-indigo text-sheet'
                    : 'border-line bg-sheet text-ink hover:bg-ground-sunk'
                )}
              >
                Hanafi Islamic (ফারায়েয)
              </button>
              <button
                type="button"
                onClick={() => setReligion('HINDU')}
                className={cx(
                  'flex-1 border px-2.5 py-1.5 text-xs font-semibold transition-colors',
                  religion === 'HINDU'
                    ? 'border-indigo bg-indigo text-sheet'
                    : 'border-line bg-sheet text-ink hover:bg-ground-sunk'
                )}
              >
                Dayabhaga (দায়ভাগ)
              </button>
            </div>
          </div>

          <div>
            <span className="mono block text-2xs uppercase text-ink-3">
              {t('Deceased Gender', 'মৃত ব্যক্তির লিঙ্গ')}
            </span>
            <div className="mt-1.5 flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setDeceasedGender('MALE');
                  setHusband(false);
                }}
                className={cx(
                  'flex-1 border px-2.5 py-1.5 text-xs font-semibold transition-colors',
                  deceasedGender === 'MALE'
                    ? 'border-ink bg-ink text-sheet'
                    : 'border-line bg-sheet text-ink hover:bg-ground-sunk'
                )}
              >
                Male (মৃত পুরুষ)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeceasedGender('FEMALE');
                  setWives(0);
                }}
                className={cx(
                  'flex-1 border px-2.5 py-1.5 text-xs font-semibold transition-colors',
                  deceasedGender === 'FEMALE'
                    ? 'border-ink bg-ink text-sheet'
                    : 'border-line bg-sheet text-ink hover:bg-ground-sunk'
                )}
              >
                Female (মৃত নারী)
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="mono text-2xs uppercase text-ink-3">
                {t('Total Land (Decimal)', 'মোট জমি (শতক)')}
              </span>
              <span className="mono text-2xs text-ink-3">
                ≈ {(totalDecimal / 1.65).toFixed(2)} Katha
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={totalDecimal}
                onChange={(e) => setTotalDecimal(parseFloat(e.target.value) || 0)}
                className={`${inputClass} mono text-sm font-semibold`}
              />
              {parcelId && (
                <span className="mono shrink-0 border border-line bg-ground px-1.5 py-1 text-2xs text-ink-2">
                  #{parcelId.slice(-6)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Surviving Relatives Stepper Grid */}
        <div className="border border-line bg-sheet p-3.5">
          <div className="mb-2.5 flex items-center justify-between border-b border-line-hair pb-2">
            <span className="mono text-2xs uppercase tracking-wider text-ink-3">
              {t('Surviving Legal Heirs', 'জীবিত বৈধ উত্তরাধিকারীগণের তালিকা')}
            </span>
            <span className="mono text-2xs text-ink-3">
              Click buttons to adjust family tree
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            {deceasedGender === 'MALE' ? (
              <div className="border border-line-hair bg-sheet-raised p-2">
                <span className="block text-xs font-medium text-ink">
                  {t('Wives', 'স্ত্রী')}
                </span>
                <span className="mono block text-[10px] text-ink-3">
                  Zawil-Furud
                </span>
                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setWives(Math.max(0, wives - 1))}
                    disabled={wives <= 0}
                    className="flex h-6 w-6 items-center justify-center border border-line bg-sheet text-xs font-bold transition-colors hover:bg-ground-sunk disabled:opacity-30"
                  >
                    -
                  </button>
                  <span className="mono text-sm font-bold text-ink">{wives}</span>
                  <button
                    type="button"
                    onClick={() => setWives(Math.min(4, wives + 1))}
                    disabled={wives >= 4}
                    className="flex h-6 w-6 items-center justify-center border border-line bg-sheet text-xs font-bold transition-colors hover:bg-ground-sunk disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            ) : (
              <div className="border border-line-hair bg-sheet-raised p-2">
                <span className="block text-xs font-medium text-ink">
                  {t('Husband', 'স্বামী')}
                </span>
                <span className="mono block text-[10px] text-ink-3">
                  Zawil-Furud
                </span>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setHusband(!husband)}
                    className={cx(
                      'w-full border px-2 py-1 text-xs font-medium transition-colors',
                      husband
                        ? 'border-indigo bg-indigo-soft font-semibold text-indigo'
                        : 'border-line bg-sheet text-ink-3 hover:bg-ground-sunk'
                    )}
                  >
                    {husband ? 'Alive (জীবিত)' : 'Deceased (মৃত)'}
                  </button>
                </div>
              </div>
            )}

            <div className="border border-line-hair bg-sheet-raised p-2">
              <span className="block text-xs font-medium text-ink">
                {t('Sons', 'পুত্র')}
              </span>
              <span className="mono block text-[10px] text-ink-3">
                Asaba (2x ratio)
              </span>
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSons(Math.max(0, sons - 1))}
                  disabled={sons <= 0}
                  className="flex h-6 w-6 items-center justify-center border border-line bg-sheet text-xs font-bold transition-colors hover:bg-ground-sunk disabled:opacity-30"
                >
                  -
                </button>
                <span className="mono text-sm font-bold text-ink">{sons}</span>
                <button
                  type="button"
                  onClick={() => setSons(sons + 1)}
                  className="flex h-6 w-6 items-center justify-center border border-line bg-sheet text-xs font-bold transition-colors hover:bg-ground-sunk"
                >
                  +
                </button>
              </div>
            </div>

            <div className="border border-line-hair bg-sheet-raised p-2">
              <span className="block text-xs font-medium text-ink">
                {t('Daughters', 'কন্যা')}
              </span>
              <span className="mono block text-[10px] text-ink-3">
                {sons > 0 ? 'Asaba (1x ratio)' : 'Zawil-Furud'}
              </span>
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setDaughters(Math.max(0, daughters - 1))}
                  disabled={daughters <= 0}
                  className="flex h-6 w-6 items-center justify-center border border-line bg-sheet text-xs font-bold transition-colors hover:bg-ground-sunk disabled:opacity-30"
                >
                  -
                </button>
                <span className="mono text-sm font-bold text-ink">{daughters}</span>
                <button
                  type="button"
                  onClick={() => setDaughters(daughters + 1)}
                  className="flex h-6 w-6 items-center justify-center border border-line bg-sheet text-xs font-bold transition-colors hover:bg-ground-sunk"
                >
                  +
                </button>
              </div>
            </div>

            <div className="border border-line-hair bg-sheet-raised p-2">
              <span className="block text-xs font-medium text-ink">
                {t('Mother', 'মাতা')}
              </span>
              <span className="mono block text-[10px] text-ink-3">
                1/6 or 1/3
              </span>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setMotherPresent(!motherPresent)}
                  className={cx(
                    'w-full border px-2 py-1 text-xs font-medium transition-colors',
                    motherPresent
                      ? 'border-indigo bg-indigo-soft font-semibold text-indigo'
                      : 'border-line bg-sheet text-ink-3 hover:bg-ground-sunk'
                  )}
                >
                  {motherPresent ? 'Alive (জীবিত)' : 'Deceased (মৃত)'}
                </button>
              </div>
            </div>

            <div className="border border-line-hair bg-sheet-raised p-2">
              <span className="block text-xs font-medium text-ink">
                {t('Father', 'পিতা')}
              </span>
              <span className="mono block text-[10px] text-ink-3">
                1/6 + Residue
              </span>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setFatherPresent(!fatherPresent)}
                  className={cx(
                    'w-full border px-2 py-1 text-xs font-medium transition-colors',
                    fatherPresent
                      ? 'border-indigo bg-indigo-soft font-semibold text-indigo'
                      : 'border-line bg-sheet text-ink-3 hover:bg-ground-sunk'
                  )}
                >
                  {fatherPresent ? 'Alive (জীবিত)' : 'Deceased (মৃত)'}
                </button>
              </div>
            </div>

            <div className="flex flex-col justify-between border border-line bg-ground-sunk p-2">
              <span className="mono text-2xs uppercase text-ink-3">Estate Area</span>
              <div>
                <span className="mono text-sm font-bold text-ink">
                  {totalDecimal.toFixed(2)} dec
                </span>
                <span className="mono block text-[10px] text-ink-3">
                  {(totalDecimal * 435.6).toLocaleString()} sq ft
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Partition Results: Visual SVG Cadastral Dial + Shares Table */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left: Authentic Cadastral SVG Dial */}
          <div className="flex flex-col items-center justify-between border border-line bg-sheet-raised p-4 lg:col-span-4">
            <div className="w-full text-center">
              <span className="mono text-2xs uppercase tracking-wider text-ink-3">
                {t('Cadastral Plot Partition', 'নকশাভিত্তিক জমি বণ্টন চিত্র')}
              </span>
            </div>

            <div className="relative my-3 flex h-48 w-48 items-center justify-center">
              <svg viewBox="0 0 180 180" className="h-full w-full">
                {/* Background survey grid ring */}
                <circle
                  cx="90"
                  cy="90"
                  r="76"
                  fill="none"
                  stroke="var(--line-hair)"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />

                {/* Slices */}
                {shares.map((s, idx) => {
                  const color = PALETTE[idx % PALETTE.length];
                  const path = getDonutSlicePath(90, 90, 76, 42, s.startDegree, s.endDegree);
                  const isHovered = activeSliceIndex === idx;

                  return (
                    <path
                      key={idx}
                      d={path}
                      fill={color}
                      stroke="var(--sheet)"
                      strokeWidth="1.5"
                      opacity={activeSliceIndex === null || isHovered ? 1 : 0.6}
                      onMouseEnter={() => setActiveSliceIndex(idx)}
                      onMouseLeave={() => setActiveSliceIndex(null)}
                      className="cursor-pointer transition-opacity duration-150"
                    />
                  );
                })}

                {/* Center hole fill & border to guarantee clean slice cutoff */}
                <circle
                  cx="90"
                  cy="90"
                  r="42"
                  fill="var(--sheet-raised)"
                  stroke="var(--line-hair)"
                  strokeWidth="1"
                />
              </svg>

              {/* Center parcel badge - perfectly centered without clipping */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center select-none px-2">
                <span className="mono text-base font-bold leading-none text-ink">
                  {totalDecimal.toFixed(2)}
                </span>
                <span className="mono mt-1 text-[9px] font-medium uppercase tracking-wider text-ink-3">
                  শতক / DEC
                </span>
              </div>
            </div>

            {/* Dial Legend */}
            <div className="flex w-full flex-wrap justify-center gap-1.5 border-t border-line-hair pt-2.5">
              {shares.map((s, idx) => (
                <div
                  key={idx}
                  onMouseEnter={() => setActiveSliceIndex(idx)}
                  onMouseLeave={() => setActiveSliceIndex(null)}
                  className={cx(
                    'flex cursor-pointer items-center gap-1 border px-1.5 py-0.5 text-2xs transition-colors',
                    activeSliceIndex === idx
                      ? 'border-indigo bg-indigo-soft text-indigo font-semibold'
                      : 'border-line-hair bg-sheet text-ink-2'
                  )}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: PALETTE[idx % PALETTE.length] }}
                  />
                  <span>{lang === 'bn' ? s.relationBn : s.relation}</span>
                  <span className="mono font-semibold">({s.percentage.toFixed(0)}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Comprehensive Shares Table */}
          <div className="flex flex-col justify-between overflow-x-auto border border-line bg-sheet lg:col-span-8">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-ground-sunk font-semibold text-ink">
                <tr>
                  <th className="p-2.5">{t('Heir Relation', 'উত্তরাধিকারী')}</th>
                  <th className="p-2.5">{t('Legal Class', 'আইনি শ্রেণী')}</th>
                  <th className="p-2.5">{t('Fraction', 'অংশ')}</th>
                  <th className="p-2.5 text-right">{t('Per Person (Dec)', 'ব্যক্তিপ্রতি শতক')}</th>
                  <th className="p-2.5 text-right">{t('Katha', 'কাঠা')}</th>
                  <th className="p-2.5 text-right">{t('Total Decimal', 'মোট শতক')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-hair">
                {shares.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-ink-3">
                      No eligible legal heirs configured.
                    </td>
                  </tr>
                ) : (
                  shares.map((s, idx) => {
                    const isHovered = activeSliceIndex === idx;
                    const color = PALETTE[idx % PALETTE.length];

                    return (
                      <tr
                        key={idx}
                        onMouseEnter={() => setActiveSliceIndex(idx)}
                        onMouseLeave={() => setActiveSliceIndex(null)}
                        className={cx(
                          'transition-colors',
                          isHovered ? 'bg-indigo-soft/60' : 'hover:bg-ground-sunk/50'
                        )}
                      >
                        <td className="p-2.5 font-medium text-ink">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            <span>{lang === 'bn' ? s.relationBn : s.relation}</span>
                            {s.count > 1 && (
                              <span className="mono rounded border border-line bg-ground px-1 text-[9px] text-ink-3">
                                {s.count}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <span
                            className={cx(
                              'mono rounded px-1.5 py-0.5 text-[10px] font-medium',
                              s.category === 'QURANIC_SHARER'
                                ? 'bg-indigo-soft text-indigo'
                                : 'bg-state-soft text-state'
                            )}
                          >
                            {s.category === 'QURANIC_SHARER'
                              ? 'Zawil-Furud (নির্দিষ্ট)'
                              : s.category === 'RESIDUARY'
                              ? 'Asaba (আসাবা)'
                              : 'Dayabhaga'}
                          </span>
                        </td>
                        <td className="mono p-2.5 font-medium text-ink-2">
                          {s.fractionDisplay}
                        </td>
                        <td className="mono p-2.5 text-right font-semibold text-ink">
                          {s.perPersonDecimal.toFixed(2)}
                        </td>
                        <td className="mono p-2.5 text-right text-ink-3">
                          {s.perPersonKatha.toFixed(2)} k
                        </td>
                        <td className="mono p-2.5 text-right font-bold text-indigo">
                          <div className="flex flex-col items-end">
                            <span>{s.totalDecimal.toFixed(2)}</span>
                            <span className="text-[10px] text-ink-3 font-normal">
                              ({s.percentage.toFixed(1)}%)
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Table Footer with Summary Balance */}
            <div className="flex items-center justify-between border-t border-line bg-ground-sunk px-3 py-2 text-xs">
              <span className="mono text-ink-3">
                Total Allocated: <strong className="text-ink">{totalDistributed.toFixed(2)} dec</strong> / {totalDecimal.toFixed(2)} dec
              </span>
              <span className="mono text-2xs font-semibold text-state">
                {Math.abs(totalDistributed - totalDecimal) < 0.05
                  ? '[100% BALANCED - পূর্ণ বণ্টিত]'
                  : `Balance: ${Math.abs(totalDecimal - totalDistributed).toFixed(2)} dec`}
              </span>
            </div>
          </div>
        </div>

        {/* Statutory References Card */}
        {activeResult.legalPrinciplesApplied?.length > 0 && (
          <div className="border border-line-hair bg-ground p-3">
            <span className="mono mb-1.5 flex items-center gap-1.5 text-2xs uppercase text-ink-3">
              <BookOpen className="h-3 w-3 text-indigo" />
              {t('Statutory References Applied', 'প্রযোজ্য আইনি নজিরসমূহ')}
            </span>
            <ul className="space-y-1">
              {activeResult.legalPrinciplesApplied.map((principle: string, idx: number) => (
                <li key={idx} className="text-xs text-ink-2">
                  - {principle}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Modal Bottom Actions */}
        <div className="flex items-center justify-between border-t border-line pt-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={copySummary}
            className="flex items-center gap-1.5"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-state" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? t('Copied to Clipboard', 'অনুলিপি সম্পন্ন') : t('Copy Apportionment', 'বণ্টন অনুলিপি')}</span>
          </Button>

          <Button size="sm" onClick={onClose}>
            {t('Close', 'বন্ধ করুন')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
