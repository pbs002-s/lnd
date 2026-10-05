import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  ShieldCheck,
  Building,
  CheckCircle2,
  Clock,
  Banknote,
  FileCheck,
  Landmark,
  Receipt,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  AlertTriangle,
  UserCheck,
  Calendar,
} from 'lucide-react';
import Modal from './Modal';
import { Button } from './ui';
import { useLanguage } from '../lib/language';
import {
  getEscrowContracts,
  createEscrowContract,
  depositEscrowFunds,
  certifyEscrowTitle,
  executeEscrowDeed,
  recordEscrowMutation,
  releaseEscrowFunds,
} from '../lib/api';
import type { EscrowContract, EscrowStage } from '../lib/types';

interface EscrowPipelineModalProps {
  open: boolean;
  onClose: () => void;
  defaultParcelId?: string;
  defaultAreaDecimal?: number;
  defaultOwnerName?: string;
  defaultOwnerNid?: string;
}

const STAGES: Array<{ key: EscrowStage; labelEn: string; labelBn: string; step: number }> = [
  { key: 'OFFER_PENDING', labelEn: '1. Offer Initiated', labelBn: '১. প্রস্তাব উত্থাপন', step: 1 },
  { key: 'LAND_LOCKED', labelEn: '2. Land Locked', labelBn: '২. স্বয়ংক্রিয় জমি লক', step: 2 },
  { key: 'ESCROW_DEPOSITED', labelEn: '3. Escrow Deposited', labelBn: '৩. ট্রেজারি ভল্ট জমা', step: 3 },
  { key: 'TITLE_AUDITED', labelEn: '4. Title Audited', labelBn: '৪. স্বত্ব ফরেনসিক অডিট', step: 4 },
  { key: 'SUB_REGISTRY_SCHEDULED', labelEn: '5. Sub-Registry Appt', labelBn: '৫. সাব-রেজিস্ট্রি সূচি', step: 5 },
  { key: 'DEED_EXECUTED', labelEn: '6. Deed Executed', labelBn: '৬. সাফ-কবলা দলিল সম্পাদন', step: 6 },
  { key: 'MUTATION_RECORDED', labelEn: '7. e-Mutation Recorded', labelBn: '৭. নামজারি অনুমোদন', step: 7 },
  { key: 'FUNDS_RELEASED', labelEn: '8. Funds Released', labelBn: '৮. অর্থ ও রাজস্ব হস্তান্তর', step: 8 },
];

export default function EscrowPipelineModal({
  open,
  onClose,
  defaultParcelId = 'BD-DHK-SAV-000001',
  defaultAreaDecimal = 5.5,
  defaultOwnerName = 'Kamal Hossain',
  defaultOwnerNid = '19852692011000123',
}: EscrowPipelineModalProps) {
  const { lang, t } = useLanguage();
  const [contracts, setContracts] = useState<EscrowContract[]>([]);
  const [selectedContract, setSelectedContract] = useState<EscrowContract | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showNewContractForm, setShowNewContractForm] = useState(false);

  // New contract form state
  const [buyerName, setBuyerName] = useState('Tanvir Ahmed');
  const [buyerNid, setBuyerNid] = useState('19922692019900011');
  const [buyerPhone, setBuyerPhone] = useState('01819-876543');
  const [considerationAmount, setConsiderationAmount] = useState('4800000');
  const [earnestDeposit, setEarnestDeposit] = useState('960000');

  // Input states for progression actions
  const [depositInput, setDepositInput] = useState('4800000');
  const [deedNumberInput, setDeedNumberInput] = useState('DALIL-2026-9042');
  const [mutationCaseInput, setMutationCaseInput] = useState('MUT-2026-SAV-4190');
  const [newKhatianInput, setNewKhatianInput] = useState('1842/ক');

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const list = await getEscrowContracts({ parcelId: defaultParcelId });
      setContracts(list);
      if (list.length > 0) {
        setSelectedContract(list[0]);
      } else {
        setSelectedContract(null);
      }
    } catch {
      // Handled via fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchContracts();
    }
  }, [open, defaultParcelId]);

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const created = await createEscrowContract({
        parcelId: defaultParcelId,
        mouza: 'Savar Mouza (সাভার মৌজা)',
        areaDecimal: defaultAreaDecimal,
        buyerNid,
        buyerName,
        buyerPhone,
        sellerNid: defaultOwnerNid,
        sellerName: defaultOwnerName,
        totalConsiderationBdt: Number(considerationAmount) || 4800000,
        earnestDepositBdt: Number(earnestDeposit) || 960000,
      });
      setContracts((prev) => [created, ...prev]);
      setSelectedContract(created);
      setShowNewContractForm(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!selectedContract) return;
    setActionLoading(true);
    try {
      const updated = await depositEscrowFunds(
        selectedContract.id,
        Number(depositInput) || selectedContract.balanceBdt
      );
      setSelectedContract(updated);
      setContracts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCertifyTitle = async () => {
    if (!selectedContract) return;
    setActionLoading(true);
    try {
      const updated = await certifyEscrowTitle(selectedContract.id, 'AUTHENTIC_VERIFIED', 0);
      setSelectedContract(updated);
      setContracts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteDeed = async () => {
    if (!selectedContract) return;
    setActionLoading(true);
    try {
      const updated = await executeEscrowDeed(
        selectedContract.id,
        deedNumberInput,
        'VOL-2026-88'
      );
      setSelectedContract(updated);
      setContracts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordMutation = async () => {
    if (!selectedContract) return;
    setActionLoading(true);
    try {
      const updated = await recordEscrowMutation(
        selectedContract.id,
        mutationCaseInput,
        newKhatianInput
      );
      setSelectedContract(updated);
      setContracts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleaseFunds = async () => {
    if (!selectedContract) return;
    setActionLoading(true);
    try {
      const updated = await releaseEscrowFunds(selectedContract.id);
      setSelectedContract(updated);
      setContracts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } finally {
      setActionLoading(false);
    }
  };

  const getStageIndex = (stage: EscrowStage) => {
    const idx = STAGES.findIndex((s) => s.key === stage);
    return idx >= 0 ? idx : 0;
  };

  const currentStageIdx = selectedContract ? getStageIndex(selectedContract.stage) : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="Smart Contract Settlement Engine"
      title="Zero-Trust Land Buy/Sell Escrow Pipeline"
      bn="জিরো-ট্রাস্ট ভূমি ক্রয়-বিক্রয় এস্ক্রো ও স্বয়ংক্রিয় নিষ্পত্তি ব্যবস্থা"
      maxWidth="5xl"
    >
      <div className="space-y-5 text-sm text-ink">
        {/* Top Controls: Contract Switcher & New Contract Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-sheet border border-line rounded-lg">
          <div className="flex items-center gap-3">
            <span className="mono text-2xs uppercase text-ink-3">
              {lang === 'bn' ? 'এস্ক্রো চুক্তি আইডি:' : 'Active Escrow Contract:'}
            </span>
            {contracts.length > 0 ? (
              <select
                aria-label="Active Escrow Contract"
                value={selectedContract?.id || ''}
                onChange={(e) => {
                  const found = contracts.find((c) => c.id === e.target.value);
                  if (found) setSelectedContract(found);
                }}
                className="bg-ground-sunk border border-line text-ink mono text-xs px-2.5 py-1.5 rounded focus:outline-none focus:border-indigo"
              >
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} — BDT {c.totalConsiderationBdt.toLocaleString('en-IN')} ({c.stage})
                  </option>
                ))}
              </select>
            ) : (
              <span className="mono text-xs text-amber font-semibold">
                {lang === 'bn' ? 'কোনো চলমান চুক্তি পাওয়া যায়নি' : 'No active contract for this parcel'}
              </span>
            )}
            <button
              onClick={fetchContracts}
              title="Refresh contracts"
              className="p-1.5 text-ink-3 hover:text-ink transition-colors rounded hover:bg-ground-sunk"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowNewContractForm(!showNewContractForm)}
              className="text-xs"
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1.5 text-indigo" />
              {showNewContractForm
                ? lang === 'bn' ? 'ফরম বন্ধ করুন' : 'Close Form'
                : lang === 'bn' ? '+ নতুন ক্রয় প্রস্তাব' : '+ New Escrow Offer'}
            </Button>
          </div>
        </div>

        {/* New Contract Creation Form */}
        {showNewContractForm && (
          <form
            onSubmit={handleCreateContract}
            className="p-4 bg-sheet border border-line rounded-lg space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-line-hair">
              <span className="mono text-2xs font-semibold uppercase text-indigo">
                {lang === 'bn' ? 'নতুন এস্ক্রো বিক্রয় চুক্তি সূচনা' : 'Initialize New Escrow Purchase Agreement'}
              </span>
              <span className="mono text-2xs text-ink-3">
                Parcel ID: {defaultParcelId} ({defaultAreaDecimal} Decimals)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="mono text-[11px] text-ink-3 block mb-1">
                  {lang === 'bn' ? 'ক্রেতার পূর্ণ নাম' : 'Buyer Name'}
                </label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full bg-ground border border-line px-2.5 py-1.5 rounded text-xs text-ink focus:border-indigo focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mono text-[11px] text-ink-3 block mb-1">
                  {lang === 'bn' ? 'ক্রেতার এনআইডি' : 'Buyer National ID'}
                </label>
                <input
                  type="text"
                  value={buyerNid}
                  onChange={(e) => setBuyerNid(e.target.value)}
                  className="w-full bg-ground border border-line px-2.5 py-1.5 rounded text-xs text-ink mono focus:border-indigo focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mono text-[11px] text-ink-3 block mb-1">
                  {lang === 'bn' ? 'ক্রেতার মোবাইল নম্বর' : 'Buyer Mobile'}
                </label>
                <input
                  type="text"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="w-full bg-ground border border-line px-2.5 py-1.5 rounded text-xs text-ink mono focus:border-indigo focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mono text-[11px] text-ink-3 block mb-1">
                  {lang === 'bn' ? 'মোট বিক্রয়মূল্য (টাকা)' : 'Total Consideration (BDT)'}
                </label>
                <input
                  type="number"
                  value={considerationAmount}
                  onChange={(e) => setConsiderationAmount(e.target.value)}
                  className="w-full bg-ground border border-line px-2.5 py-1.5 rounded text-xs text-ink mono font-bold focus:border-indigo focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mono text-[11px] text-ink-3 block mb-1">
                  {lang === 'bn' ? 'বায়না জামানত (২০% ডিফল্ট)' : 'Earnest Deposit (20% Default)'}
                </label>
                <input
                  type="number"
                  value={earnestDeposit}
                  onChange={(e) => setEarnestDeposit(e.target.value)}
                  className="w-full bg-ground border border-line px-2.5 py-1.5 rounded text-xs text-ink mono focus:border-indigo focus:outline-none"
                  required
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={actionLoading}
                  className="w-full justify-center text-xs h-[34px]"
                >
                  {actionLoading ? 'Initializing...' : lang === 'bn' ? 'চুক্তি সক্রিয় করুন' : 'Deploy Escrow Contract'}
                </Button>
              </div>
            </div>
          </form>
        )}

        {selectedContract ? (
          <>
            {/* Visual 8-Stage Pipeline Stepper */}
            <div className="p-4 bg-sheet border border-line rounded-lg">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-line-hair">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded ${selectedContract.isLocked ? 'bg-amber-soft text-amber border border-amber/40' : 'bg-state-soft text-state border border-state/40'}`}>
                    {selectedContract.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className="mono text-2xs uppercase text-ink-3">
                      {lang === 'bn' ? 'ডিজিটাল জমি লক স্ট্যাটাস: ' : 'Anti-Fraud Land Lock: '}
                    </span>
                    <span className={`mono text-xs font-bold ${selectedContract.isLocked ? 'text-amber' : 'text-state'}`}>
                      {selectedContract.isLocked ? (lang === 'bn' ? 'লক কার্যকর (বিক্রয় স্থগিত)' : 'ACTIVE (TRANSFER PROTECTED)') : (lang === 'bn' ? 'উন্মুক্ত / নিষ্পন্ন' : 'RELEASED')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mono text-2xs text-ink-3">
                  <Clock className="w-3.5 h-3.5 text-ink-3" />
                  <span>Stage {currentStageIdx + 1} of 8</span>
                </div>
              </div>

              {/* Progress Stepper Bars */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5">
                {STAGES.map((s, idx) => {
                  const isDone = idx < currentStageIdx;
                  const isCurrent = idx === currentStageIdx;
                  return (
                    <div
                      key={s.key}
                      className={`p-2 rounded border text-center transition-all ${
                        isCurrent
                          ? 'bg-state-soft border-state text-state ring-1 ring-state/30 font-bold'
                          : isDone
                          ? 'bg-sheet-raised border-line-strong text-state'
                          : 'bg-ground-sunk/60 border-line-hair text-ink-3'
                      }`}
                    >
                      <div className="flex items-center justify-center mb-1">
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-state" />
                        ) : isCurrent ? (
                          <div className="w-2 h-2 rounded-full bg-state animate-pulse" />
                        ) : (
                          <span className="mono text-[10px] text-ink-3">{idx + 1}</span>
                        )}
                      </div>
                      <div className="text-[11px] leading-tight line-clamp-2">
                        {lang === 'bn' ? s.labelBn : s.labelEn}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Escrow Vault & Consideration Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Vault Account Card */}
              <div className="p-3.5 bg-sheet border border-line rounded-lg">
                <div className="flex items-center gap-2 mb-2 mono text-2xs text-ink-3 uppercase">
                  <Landmark className="w-4 h-4 text-indigo" />
                  <span>{lang === 'bn' ? 'সরকারি ট্রেজারি ভল্ট' : 'Government Treasury Vault'}</span>
                </div>
                <div className="text-sm font-semibold text-ink font-mono">{selectedContract.escrowBankName}</div>
                <div className="mono text-2xs text-ink-3 mt-1">A/C: {selectedContract.escrowVaultAccount}</div>
                <div className="mt-2 mono text-xs font-bold text-state">
                  {lang === 'bn' ? 'জমা স্থিতি: ' : 'Vault Balance: '}
                  BDT {selectedContract.depositedAmountBdt.toLocaleString('en-IN')}
                </div>
              </div>

              {/* Consideration Breakdown Card */}
              <div className="p-3.5 bg-sheet border border-line rounded-lg">
                <div className="flex items-center gap-2 mb-2 mono text-2xs text-ink-3 uppercase">
                  <Banknote className="w-4 h-4 text-state" />
                  <span>{lang === 'bn' ? 'মোট বিক্রয়মূল্য' : 'Total Consideration'}</span>
                </div>
                <div className="mono text-xl font-bold text-ink">
                  BDT {selectedContract.totalConsiderationBdt.toLocaleString('en-IN')}
                </div>
                <div className="flex items-center justify-between mono text-2xs text-ink-3 mt-1">
                  <span>Earnest: BDT {selectedContract.earnestDepositBdt.toLocaleString('en-IN')}</span>
                  <span>Balance: BDT {selectedContract.balanceBdt.toLocaleString('en-IN')}</span>
                </div>
                <div className="mt-2 w-full bg-ground-sunk h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-state h-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        (selectedContract.depositedAmountBdt / selectedContract.totalConsiderationBdt) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Vendor & Buyer Card */}
              <div className="p-3.5 bg-sheet border border-line rounded-lg">
                <div className="flex items-center gap-2 mb-2 mono text-2xs text-ink-3 uppercase">
                  <UserCheck className="w-4 h-4 text-indigo" />
                  <span>{lang === 'bn' ? 'চুক্তিবদ্ধ পক্ষসমূহ' : 'Contracting Parties'}</span>
                </div>
                <div className="text-xs space-y-1">
                  <div>
                    <span className="mono text-2xs text-ink-3">Buyer: </span>
                    <span className="text-ink font-medium">{selectedContract.buyerName}</span>
                    <span className="mono text-2xs text-ink-3 ml-1">({selectedContract.buyerPhone})</span>
                  </div>
                  <div>
                    <span className="mono text-2xs text-ink-3">Seller: </span>
                    <span className="text-ink font-medium">{selectedContract.sellerName}</span>
                    <span className="mono text-2xs text-ink-3 ml-1">({selectedContract.sellerPhone})</span>
                  </div>
                  <div className="mono text-2xs text-ink-3 pt-1 border-t border-line-hair">
                    Bank: {selectedContract.sellerBankAccount} (Routing: {selectedContract.sellerBankRouting})
                  </div>
                </div>
              </div>
            </div>

            {/* Statutory Tax Deductions Table (Section 120, Income Tax Act 2023) */}
            <div className="p-4 bg-sheet border border-line rounded-lg">
              <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-line-hair">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-indigo" />
                  <span className="mono text-2xs font-semibold text-ink uppercase tracking-wider">
                    {lang === 'bn' ? 'সংবিধিবদ্ধ সরকারি ফি ও রাজস্ব কর্তন শিডিউল' : 'Statutory Government Tax & Fee Deduction Schedule'}
                  </span>
                </div>
                <span className="mono text-2xs text-ink-3">
                  Statutory Total: 10% (Income Tax Act 2023 Sec 120)
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center text-xs">
                <div className="p-2 bg-ground-sunk rounded border border-line">
                  <div className="mono text-[10px] text-ink-3">Stamp Duty (3%)</div>
                  <div className="mono text-ink font-semibold mt-1">
                    BDT {selectedContract.stampDutyBdt.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-ink-3">স্ট্যাম্প শুল্ক</div>
                </div>

                <div className="p-2 bg-ground-sunk rounded border border-line">
                  <div className="mono text-[10px] text-ink-3">Local Govt (2%)</div>
                  <div className="mono text-ink font-semibold mt-1">
                    BDT {selectedContract.localGovTaxBdt.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-ink-3">স্থানীয় কর</div>
                </div>

                <div className="p-2 bg-ground-sunk rounded border border-line">
                  <div className="mono text-[10px] text-ink-3">Registration (1%)</div>
                  <div className="mono text-ink font-semibold mt-1">
                    BDT {selectedContract.registrationFeeBdt.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-ink-3">রেজিস্ট্রি ফি</div>
                </div>

                <div className="p-2 bg-ground-sunk rounded border border-line">
                  <div className="mono text-[10px] text-ink-3">AIT Source (4%)</div>
                  <div className="mono text-ink font-semibold mt-1">
                    BDT {selectedContract.aitSourceTaxBdt.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-ink-3">উৎসে কর (১২০)</div>
                </div>

                <div className="p-2 bg-amber-soft rounded border border-amber/40">
                  <div className="mono text-[10px] text-amber font-semibold">Total Fees (10%)</div>
                  <div className="mono text-amber font-bold mt-1">
                    BDT {selectedContract.totalStatutoryFeesBdt.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-amber">সরকারি রাজস্ব</div>
                </div>

                <div className="p-2 bg-state-soft rounded border border-state/40">
                  <div className="mono text-[10px] text-state font-semibold">Net to Seller (90%)</div>
                  <div className="mono text-state font-bold mt-1">
                    BDT {selectedContract.netPayableToSellerBdt.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-state">বিক্রেতা প্রদেয়</div>
                </div>
              </div>
            </div>

            {/* Stage Action Controls */}
            <div className="p-4 bg-sheet border border-line rounded-lg">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-line-hair">
                <span className="mono text-2xs font-semibold text-ink uppercase tracking-wider">
                  {lang === 'bn' ? 'পরবর্তী প্রক্রিয়া চালনা ও চুক্তি নিষ্পত্তি' : 'Stage Advancement & Execution Controls'}
                </span>
                <span className="mono text-2xs font-bold text-state">
                  Current Status: {selectedContract.stage}
                </span>
              </div>

              {/* Conditional Controls depending on current stage */}
              {selectedContract.stage === 'LAND_LOCKED' && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <label className="mono text-[11px] text-ink-3 block mb-1">
                      {lang === 'bn' ? 'ট্রেজারি ভল্ট জমা পরিমাণ (টাকা):' : 'Deposit Amount into Treasury Vault (BDT):'}
                    </label>
                    <input
                      type="number"
                      value={depositInput}
                      onChange={(e) => setDepositInput(e.target.value)}
                      className="w-full bg-ground border border-line px-2.5 py-1.5 rounded text-xs text-ink mono focus:border-indigo focus:outline-none"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handleDeposit}
                      variant="primary"
                      disabled={actionLoading}
                      className="text-xs h-[34px] px-4"
                    >
                      <Banknote className="w-3.5 h-3.5 mr-1.5" />
                      {actionLoading ? 'Processing Deposit...' : lang === 'bn' ? 'ট্রেজারি ভল্টে জামানত জমা করুন' : 'Confirm Escrow Vault Deposit'}
                    </Button>
                  </div>
                </div>
              )}

              {selectedContract.stage === 'ESCROW_DEPOSITED' && (
                <div className="flex items-center justify-between gap-4 p-3 bg-ground-sunk rounded border border-line">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-ink">
                      {lang === 'bn' ? 'স্বত্ব ও দেওয়ানি নিষেধাজ্ঞা ফরেনসিক অডিট সার্টিফিকেশন' : 'Title & Litigation Forensics Certification'}
                    </div>
                    <div className="mono text-2xs text-ink-3">
                      Runs Deed Verifier 6-Point Engine & Litigation Stay Injunction Audit
                    </div>
                  </div>
                  <Button
                    onClick={handleCertifyTitle}
                    variant="primary"
                    disabled={actionLoading}
                    className="text-xs h-[34px] px-4"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                    {actionLoading ? 'Auditing Title...' : lang === 'bn' ? 'স্বত্ব অডিট সনদ ইস্যু করুন' : 'Certify Clean Title'}
                  </Button>
                </div>
              )}

              {selectedContract.stage === 'TITLE_AUDITED' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="mono text-[11px] text-ink-3 block mb-1">
                        {lang === 'bn' ? 'সাব-রেজিস্ট্রি সম্পাদিত দলিল নম্বর:' : 'Executed Deed Number (Sub-Registry):'}
                      </label>
                      <input
                        type="text"
                        value={deedNumberInput}
                        onChange={(e) => setDeedNumberInput(e.target.value)}
                        className="w-full bg-ground border border-line px-2.5 py-1.5 rounded text-xs text-ink mono focus:border-indigo focus:outline-none"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={handleExecuteDeed}
                        variant="primary"
                        disabled={actionLoading}
                        className="w-full justify-center text-xs h-[34px]"
                      >
                        <FileCheck className="w-3.5 h-3.5 mr-1.5" />
                        {actionLoading ? 'Recording Deed...' : lang === 'bn' ? 'সাফ-কবলা দলিল রেজিস্ট্রেশন নিশ্চিত করুন' : 'Confirm Deed Registration'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {selectedContract.stage === 'DEED_EXECUTED' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="mono text-[11px] text-ink-3 block mb-1">
                        {lang === 'bn' ? 'ই-নামজারি কেস নম্বর:' : 'e-Mutation Case Number:'}
                      </label>
                      <input
                        type="text"
                        value={mutationCaseInput}
                        onChange={(e) => setMutationCaseInput(e.target.value)}
                        className="w-full bg-ground border border-line px-2.5 py-1.5 rounded text-xs text-ink mono focus:border-indigo focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mono text-[11px] text-ink-3 block mb-1">
                        {lang === 'bn' ? 'নতুন সৃজিত খতিয়ান নম্বর:' : 'Newly Issued Khatian Number:'}
                      </label>
                      <input
                        type="text"
                        value={newKhatianInput}
                        onChange={(e) => setNewKhatianInput(e.target.value)}
                        className="w-full bg-ground border border-line px-2.5 py-1.5 rounded text-xs text-ink mono focus:border-indigo focus:outline-none"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={handleRecordMutation}
                        variant="primary"
                        disabled={actionLoading}
                        className="w-full justify-center text-xs h-[34px]"
                      >
                        <FileCheck className="w-3.5 h-3.5 mr-1.5" />
                        {actionLoading ? 'Recording Mutation...' : lang === 'bn' ? 'সহকারী কমিশনার (ভূমি) অনুমোদন' : 'Confirm AC Land Mutation'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {selectedContract.stage === 'MUTATION_RECORDED' && (
                <div className="p-3 bg-state-soft border border-state/40 rounded flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-state">
                      {lang === 'bn' ? 'স্বয়ংক্রিয় এস্ক্রো সেটেলমেন্ট ও অর্থ ছাড় প্রস্তুত' : 'Ready for Automated Settlement & Fund Release'}
                    </div>
                    <div className="mono text-2xs text-ink-2">
                      Disburses BDT {selectedContract.totalStatutoryFeesBdt.toLocaleString('en-IN')} to NBR Treasury & BDT {selectedContract.netPayableToSellerBdt.toLocaleString('en-IN')} to Seller Account.
                    </div>
                  </div>
                  <Button
                    onClick={handleReleaseFunds}
                    disabled={actionLoading}
                    className="bg-state text-sheet-raised hover:opacity-90 font-bold text-xs h-[34px] px-5"
                  >
                    <Unlock className="w-3.5 h-3.5 mr-1.5" />
                    {actionLoading ? 'Releasing Funds...' : lang === 'bn' ? 'অর্থ ছাড় ও স্বয়ংক্রিয় জমি আনলক' : 'Release Funds & Unlock Parcel'}
                  </Button>
                </div>
              )}

              {selectedContract.stage === 'FUNDS_RELEASED' && (
                <div className="p-3 bg-state-soft border border-state/40 rounded flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-state flex-shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-state">
                      {lang === 'bn' ? 'লেনদেন সম্পূর্ণ নিষ্পন্ন ও সুরক্ষিত' : 'Transaction Fully Settled & Completed'}
                    </div>
                    <div className="mono text-2xs text-ink-2 mt-0.5">
                      Buyer holds certified title under Khatian #{selectedContract.newKhatianNo || '1842/ক'}. Seller received net BDT {selectedContract.netPayableToSellerBdt.toLocaleString('en-IN')}. Statutory taxes paid to Bangladesh Bank Treasury.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Audit Trail Timeline */}
            <div className="p-4 bg-sheet border border-line rounded-lg">
              <div className="flex items-center gap-2 pb-2 mb-3 border-b border-line-hair">
                <Clock className="w-4 h-4 text-ink-3" />
                <span className="mono text-2xs font-semibold text-ink uppercase tracking-wider">
                  {lang === 'bn' ? 'অপরিবর্তনীয় এস্ক্রো অডিট ট্রেইল' : 'Immutable Escrow Audit Trail'}
                </span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedContract.timeline.map((evt, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs p-2.5 bg-ground-sunk rounded border border-line-hair">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-state flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mono text-[11px]">
                        <span className="text-state font-bold">{evt.stage}</span>
                        <span className="text-ink-3">{new Date(evt.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="text-ink mt-0.5">
                        {lang === 'bn' ? evt.descriptionBn : evt.descriptionEn}
                      </div>
                      <div className="flex items-center gap-3 mono text-[10px] text-ink-3 mt-1">
                        <span>Actor: {evt.actor}</span>
                        {evt.referenceNumber && <span>Ref: {evt.referenceNumber}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="p-8 text-center bg-sheet border border-line rounded-lg space-y-3">
            <Lock className="w-8 h-8 text-ink-3 mx-auto" />
            <div className="mono text-xs text-ink-3">
              {lang === 'bn' ? 'এই দাগের জন্য কোনো এস্ক্রো চুক্তি সক্রিয় নেই।' : 'No active escrow contract found for this parcel.'}
            </div>
            <Button
              onClick={() => setShowNewContractForm(true)}
              variant="primary"
              className="text-xs"
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
              {lang === 'bn' ? 'নতুন এস্ক্রো প্রস্তাব শুরু করুন' : 'Initialize New Escrow Agreement'}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
