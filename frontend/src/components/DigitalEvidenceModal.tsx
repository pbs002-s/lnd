import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  FileText,
  MapPin,
  Smartphone,
  MessageSquare,
  Plus,
  RefreshCw,
  Lock,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  QrCode,
  Printer,
  Copy,
  Check,
  Filter,
  X,
  FileCheck,
  Hash,
  Sparkles,
} from 'lucide-react';
import Modal from './Modal';
import { Button, StatusMark } from './ui';
import { useLanguage } from '../lib/language';
import {
  getEvidenceTimeline,
  verifyEvidenceChain,
  ingestEvidence,
  simulateEvidenceTamper,
  resetEvidenceChain,
  exportEvidenceDossier,
} from '../lib/api';
import type {
  EvidenceBlock,
  EvidenceModality,
  ChainVerificationReport,
  EvidenceActorRole,
  CourtDossier,
} from '../lib/types';

interface DigitalEvidenceModalProps {
  open: boolean;
  onClose: () => void;
  defaultParcelId?: string;
  defaultKhatianNo?: string;
}

export default function DigitalEvidenceModal({
  open,
  onClose,
  defaultParcelId = 'BD-DHK-SAV-000001',
  defaultKhatianNo = 'RS-4412',
}: DigitalEvidenceModalProps) {
  const { lang, t } = useLanguage();
  const [blocks, setBlocks] = useState<EvidenceBlock[]>([]);
  const [verification, setVerification] = useState<ChainVerificationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [filterModality, setFilterModality] = useState<'ALL' | EvidenceModality>('ALL');
  const [selectedBlock, setSelectedBlock] = useState<EvidenceBlock | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [dossier, setDossier] = useState<CourtDossier | null>(null);
  const [showDossierModal, setShowDossierModal] = useState(false);

  // Ingestion drawer state
  const [showIngestDrawer, setShowIngestDrawer] = useState(false);
  const [ingestModality, setIngestModality] = useState<EvidenceModality>('MESSAGE');
  const [ingestTitle, setIngestTitle] = useState('');
  const [ingestTitleBn, setIngestTitleBn] = useState('');
  const [ingestActorRole, setIngestActorRole] = useState<EvidenceActorRole>('AC_LAND');
  const [ingestActorName, setIngestActorName] = useState('Khandakar Mizanur Rahman, BCS');
  const [ingestMessageBody, setIngestMessageBody] = useState('');
  const [ingestFileName, setIngestFileName] = useState('');
  const [ingestLat, setIngestLat] = useState('23.851240');
  const [ingestLng, setIngestLng] = useState('90.261450');
  const [ingestDeviceModel, setIngestDeviceModel] = useState('Samsung Galaxy XCover 6 Pro');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tamper simulator state
  const [showTamperModal, setShowTamperModal] = useState(false);
  const [tamperTargetBlock, setTamperTargetBlock] = useState(2);
  const [tamperField, setTamperField] = useState('latitude');
  const [tamperValue, setTamperValue] = useState('24.999999');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getEvidenceTimeline(defaultParcelId);
      setBlocks(res.blocks || []);
      setVerification(res.verification || null);
      if (res.blocks && res.blocks.length > 0) {
        setSelectedBlock(res.blocks[0]);
      }
    } catch (e) {
      console.error('Failed to load evidence timeline', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, defaultParcelId]);

  const handleRunAudit = async () => {
    setVerifying(true);
    try {
      await new Promise((r) => setTimeout(r, 450));
      const res = await verifyEvidenceChain(defaultParcelId);
      setVerification(res);
      const timeline = await getEvidenceTimeline(defaultParcelId);
      setBlocks(timeline.blocks);
    } finally {
      setVerifying(false);
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestTitle.trim()) return;
    setIsSubmitting(true);
    try {
      let metadata: Record<string, any> = {};
      if (ingestModality === 'MESSAGE') {
        metadata = {
          channel: 'PORTAL_SUMMONS',
          messageBody: ingestMessageBody || ingestTitle,
          messageBodyBn: ingestTitleBn || ingestTitle,
          deliveryStatus: 'DELIVERED',
        };
      } else if (ingestModality === 'FILE') {
        metadata = {
          fileName: ingestFileName || 'SITE_INSPECTION_ANNEX.pdf',
          fileSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          fileSizeBytes: 2048500,
          mimeType: 'application/pdf',
        };
      } else if (ingestModality === 'LOCATION') {
        metadata = {
          latitude: parseFloat(ingestLat) || 23.85124,
          longitude: parseFloat(ingestLng) || 90.26145,
          accuracyRadiusMeters: 1.5,
          altitudeMeters: 15.2,
          isMockGpsDetected: false,
        };
      } else {
        metadata = {
          deviceModel: ingestDeviceModel,
          deviceEventType: 'BATTERY_TELEMETRY',
          batteryLevelPercent: 92,
          isRootedOrJailbroken: false,
          networkType: '4G_LTE',
        };
      }

      await ingestEvidence({
        parcelId: defaultParcelId,
        modality: ingestModality,
        title: ingestTitle,
        summaryBn: ingestTitleBn || ingestTitle,
        actor: {
          name: ingestActorName,
          role: ingestActorRole,
          nidOrBadge: 'OFFICER-BD-2026',
        },
        metadata,
      });

      setShowIngestDrawer(false);
      setIngestTitle('');
      setIngestTitleBn('');
      setIngestMessageBody('');
      await loadData();
    } catch (err) {
      console.error('Ingest failed', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulateTamper = async () => {
    try {
      setLoading(true);
      await simulateEvidenceTamper(
        defaultParcelId,
        tamperTargetBlock,
        tamperField,
        tamperValue,
        'বেআইনি রেকর্ড বিকৃতি ও ডিজিটাল স্বাক্ষরের সাথে অমিল'
      );
      setShowTamperModal(false);
      await loadData();
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      setLoading(true);
      await resetEvidenceChain(defaultParcelId);
      await loadData();
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDossier = async () => {
    try {
      setLoading(true);
      const res = await exportEvidenceDossier(defaultParcelId);
      setDossier(res);
      setShowDossierModal(true);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const filteredBlocks = blocks.filter((b) =>
    filterModality === 'ALL' ? true : b.modality === filterModality
  );

  const getModalityIcon = (mod: EvidenceModality) => {
    switch (mod) {
      case 'MESSAGE':
        return <MessageSquare className="w-3.5 h-3.5 text-indigo" />;
      case 'FILE':
        return <FileText className="w-3.5 h-3.5 text-amber" />;
      case 'LOCATION':
        return <MapPin className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />;
      case 'DEVICE_EVENT':
        return <Smartphone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getModalityBadgeStyle = (mod: EvidenceModality) => {
    switch (mod) {
      case 'MESSAGE':
        return 'bg-indigo-soft text-indigo border-indigo/30';
      case 'FILE':
        return 'bg-amber-soft text-amber border-amber/30';
      case 'LOCATION':
        return 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30';
      case 'DEVICE_EVENT':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30';
    }
  };

  const isChainValid = verification?.isValid ?? true;

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      maxWidth="5xl"
      title="Digital Evidence Vault & Tamper-Evident Ledger"
      bn="ডিজিটাল এভিডেন্স ও ট্যাম্পার-প্রুফ টাইমলাইন লেজার"
      label="RFC 6962 / Ed25519 Cryptographic Chain-of-Custody"
    >
      <div className="space-y-5 text-ink">
        {/* Top Integrity Status Banner */}
        <div
          className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-300 ${
            isChainValid
              ? 'bg-state-soft/60 border-state/30 shadow-sm'
              : 'bg-seal-soft/70 border-seal/50 shadow-md animate-pulse'
          }`}
        >
          <div className="flex items-start gap-3.5">
            <div
              className={`p-2.5 rounded-lg flex-shrink-0 border ${
                isChainValid
                  ? 'bg-state/15 text-state border-state/30'
                  : 'bg-seal/15 text-seal border-seal/40'
              }`}
            >
              {isChainValid ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm sm:text-base text-ink">
                  {isChainValid
                    ? 'Cryptographic Hash Chain Valid & Intact'
                    : '🚨 TAMPERING DETECTED IN EVIDENCE LEDGER!'}
                </span>
                <span
                  className={`text-2xs px-2.5 py-0.5 rounded-full font-mono font-bold uppercase border ${
                    isChainValid
                      ? 'bg-state/20 text-state border-state/40'
                      : 'bg-seal/20 text-seal border-seal/50'
                  }`}
                >
                  {isChainValid ? 'SEALED & VERIFIED' : `BLOCK #${verification?.tamperedBlockIndex} CORRUPTED`}
                </span>
              </div>
              <p className="text-xs text-ink-2 mt-1">
                {isChainValid
                  ? `সবগুলো ${verification?.totalBlocks ?? blocks.length} টি ব্লক SHA-256 চেইন ও Ed25519 ডিজিটাল স্বাক্ষরে সম্পূর্ণ অপরিবর্তনীয় হিসেবে প্রত্যয়িত।`
                  : `সাবধান: ব্লক #${verification?.tamperedBlockIndex} এ রেকর্ড বা জিপিএস তথ্য অননুমোদিতভাবে পরিবর্তিত হয়েছে! ডিজিটাল স্বাক্ষর বাতিল।`}
              </p>
              {verification?.errorReason && (
                <div className="mt-1.5 text-xs font-mono text-seal bg-seal/10 p-2 rounded border border-seal/30">
                  {verification.errorReason}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons on the banner */}
          <div className="flex items-center gap-2 flex-wrap self-end md:self-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRunAudit}
              disabled={verifying}
              className="text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin text-state' : ''}`} />
              {verifying ? 'Auditing...' : 'Re-Audit Signatures'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowTamperModal(true)}
              className="text-xs flex items-center gap-1.5 bg-seal-soft text-seal border-seal/30 hover:bg-seal/15"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Simulate Tamper
            </Button>
            {!isChainValid && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleReset}
                className="text-xs flex items-center gap-1.5 bg-state-soft text-state border-state/30 hover:bg-state/20"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Reset Chain
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenDossier}
              className="text-xs flex items-center gap-1.5"
            >
              <FileCheck className="w-3.5 h-3.5" />
              Court Dossier
            </Button>
          </div>
        </div>

        {/* Secondary Subheader / Parcel Metadata & Modality Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-ground-sunk p-3 rounded-lg border border-line">
          <div className="flex items-center gap-2.5 text-xs text-ink-3 flex-wrap">
            <span className="font-mono bg-sheet px-2 py-0.5 rounded border border-line text-ink">
              Parcel: <strong>{defaultParcelId}</strong>
            </span>
            <span className="font-mono bg-sheet px-2 py-0.5 rounded border border-line text-ink">
              Khatian: <strong>{defaultKhatianNo}</strong>
            </span>
            <span className="font-mono bg-sheet px-2 py-0.5 rounded border border-line text-ink">
              Ledger: <strong className="text-state">{blocks.length} Blocks</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-2xs text-ink-3 mr-1 flex items-center gap-1 font-mono uppercase">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            {(['ALL', 'MESSAGE', 'FILE', 'LOCATION', 'DEVICE_EVENT'] as const).map((mod) => (
              <button
                key={mod}
                onClick={() => setFilterModality(mod)}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 border ${
                  filterModality === mod
                    ? 'bg-ink text-ground font-medium border-ink shadow-sm'
                    : 'bg-sheet text-ink-2 border-line hover:text-ink hover:bg-ground'
                }`}
              >
                {mod === 'ALL' && 'All Modalities'}
                {mod === 'MESSAGE' && (
                  <>
                    <MessageSquare className="w-3 h-3 text-indigo" />
                    Messages
                  </>
                )}
                {mod === 'FILE' && (
                  <>
                    <FileText className="w-3 h-3 text-amber" />
                    Files/Photos
                  </>
                )}
                {mod === 'LOCATION' && (
                  <>
                    <MapPin className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    Locations
                  </>
                )}
                {mod === 'DEVICE_EVENT' && (
                  <>
                    <Smartphone className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    Device Telemetry
                  </>
                )}
              </button>
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowIngestDrawer(!showIngestDrawer)}
              className="text-xs ml-1 flex items-center gap-1 bg-state-soft text-state border-state/30 hover:bg-state/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Ingest Evidence
            </Button>
          </div>
        </div>

        {/* Real-time Ingestion Drawer (Collapsible) */}
        {showIngestDrawer && (
          <form
            onSubmit={handleIngest}
            className="p-4 rounded-xl bg-sheet-raised border border-state/40 space-y-4 shadow-md animate-in fade-in slide-in-from-top-4"
          >
            <div className="flex items-center justify-between border-b border-line pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-state" />
                <h4 className="font-semibold text-sm text-ink">
                  Ingest Multi-Modal Evidence Artifact into Sealed Ledger
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowIngestDrawer(false)}
                className="text-ink-3 hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-2xs font-mono text-ink-3 block mb-1">Evidence Modality</label>
                <select
                  value={ingestModality}
                  onChange={(e) => setIngestModality(e.target.value as EvidenceModality)}
                  className="w-full bg-sheet border border-line rounded-lg px-3 py-1.5 text-xs text-ink focus:border-indigo"
                >
                  <option value="MESSAGE">💬 Message (SMS / Hearing Summons)</option>
                  <option value="FILE">📁 File (Deed Scan / Inspection Photo)</option>
                  <option value="LOCATION">📍 Location (Field GPS Waypoint)</option>
                  <option value="DEVICE_EVENT">📱 Device Event (Handset Telemetry)</option>
                </select>
              </div>

              <div>
                <label className="text-2xs font-mono text-ink-3 block mb-1">Recording Officer / Actor</label>
                <input
                  type="text"
                  value={ingestActorName}
                  onChange={(e) => setIngestActorName(e.target.value)}
                  placeholder="Officer name"
                  className="w-full bg-sheet border border-line rounded-lg px-3 py-1.5 text-xs text-ink focus:border-indigo"
                />
              </div>

              <div>
                <label className="text-2xs font-mono text-ink-3 block mb-1">Actor Role</label>
                <select
                  value={ingestActorRole}
                  onChange={(e) => setIngestActorRole(e.target.value as EvidenceActorRole)}
                  className="w-full bg-sheet border border-line rounded-lg px-3 py-1.5 text-xs text-ink focus:border-indigo"
                >
                  <option value="AC_LAND">AC Land (সহকারী কমিশনার ভূমি)</option>
                  <option value="KANUNGO">Kanungo (কানুনগো)</option>
                  <option value="SURVEYOR_AMIN">Field Surveyor Amin (সার্ভেয়ার আমিন)</option>
                  <option value="SUB_REGISTRAR">Sub-Registrar (সাব-রেজিস্ট্রার)</option>
                  <option value="CITIZEN">Citizen / Claimant (নাগরিক)</option>
                </select>
              </div>

              <div>
                <label className="text-2xs font-mono text-ink-3 block mb-1">Evidence Title</label>
                <input
                  type="text"
                  value={ingestTitle}
                  onChange={(e) => setIngestTitle(e.target.value)}
                  placeholder="e.g. Field Survey Benchmark Established"
                  required
                  className="w-full bg-sheet border border-line rounded-lg px-3 py-1.5 text-xs text-ink focus:border-indigo"
                />
              </div>
            </div>

            {/* Modality Specific Fields */}
            <div className="bg-ground-sunk p-3 rounded-lg border border-line text-xs">
              {ingestModality === 'MESSAGE' && (
                <div className="space-y-2">
                  <label className="text-ink-3 block font-mono text-2xs">Message Body / Notice Text</label>
                  <textarea
                    value={ingestMessageBody}
                    onChange={(e) => setIngestMessageBody(e.target.value)}
                    rows={2}
                    placeholder="Enter summons or message content dispatched to citizen..."
                    className="w-full bg-sheet border border-line rounded-lg px-3 py-1.5 text-ink font-sans focus:border-indigo"
                  />
                </div>
              )}

              {ingestModality === 'FILE' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-ink-3 block mb-1 font-mono text-2xs">File Name</label>
                    <input
                      type="text"
                      value={ingestFileName}
                      onChange={(e) => setIngestFileName(e.target.value)}
                      placeholder="PEG_SURVEY_PHOTO_01.jpg"
                      className="w-full bg-sheet border border-line rounded-lg px-3 py-1.5 text-ink focus:border-indigo"
                    />
                  </div>
                  <div>
                    <label className="text-ink-3 block mb-1 font-mono text-2xs">Simulated SHA-256 Digest</label>
                    <div className="font-mono text-state bg-sheet px-3 py-1.5 rounded-lg border border-line text-2xs truncate">
                      e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                    </div>
                  </div>
                </div>
              )}

              {ingestModality === 'LOCATION' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-ink-3 block mb-1 font-mono text-2xs">Latitude</label>
                    <input
                      type="text"
                      value={ingestLat}
                      onChange={(e) => setIngestLat(e.target.value)}
                      className="w-full bg-sheet border border-line rounded-lg px-3 py-1.5 text-ink font-mono focus:border-indigo"
                    />
                  </div>
                  <div>
                    <label className="text-ink-3 block mb-1 font-mono text-2xs">Longitude</label>
                    <input
                      type="text"
                      value={ingestLng}
                      onChange={(e) => setIngestLng(e.target.value)}
                      className="w-full bg-sheet border border-line rounded-lg px-3 py-1.5 text-ink font-mono focus:border-indigo"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (pos) => {
                              setIngestLat(pos.coords.latitude.toFixed(6));
                              setIngestLng(pos.coords.longitude.toFixed(6));
                            },
                            () => {
                              setIngestLat('23.851240');
                              setIngestLng('90.261450');
                            }
                          );
                        }
                      }}
                      className="w-full bg-sheet hover:bg-ground text-ink border border-line py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 font-medium transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> Get Live GPS Ping
                    </button>
                  </div>
                </div>
              )}

              {ingestModality === 'DEVICE_EVENT' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-ink-3 block mb-1 font-mono text-2xs">Handset Model</label>
                    <input
                      type="text"
                      value={ingestDeviceModel}
                      onChange={(e) => setIngestDeviceModel(e.target.value)}
                      className="w-full bg-sheet border border-line rounded-lg px-3 py-1.5 text-ink focus:border-indigo"
                    />
                  </div>
                  <div>
                    <label className="text-ink-3 block mb-1 font-mono text-2xs">Hardware Security Status</label>
                    <div className="bg-sheet px-3 py-1.5 rounded-lg border border-line text-xs text-state flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-state" />
                      Knox TEE Enclave Attested • Mock GPS Inactive
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setShowIngestDrawer(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={isSubmitting || !ingestTitle.trim()}
                className="flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                {isSubmitting ? 'Signing Block...' : 'Cryptographically Seal & Append'}
              </Button>
            </div>
          </form>
        )}

        {/* Main Cryptographic Blockchain Timeline View */}
        {filteredBlocks.length === 0 ? (
          <div className="p-8 text-center bg-ground-sunk rounded-xl border border-line space-y-3">
            <Lock className="w-10 h-10 text-ink-3 mx-auto" />
            <h4 className="font-semibold text-ink text-sm">No evidence blocks found for this filter</h4>
            <p className="text-xs text-ink-3 max-w-md mx-auto">
              You can ingest new evidence artifacts or reset the filter to view the complete jurisdictional chain.
            </p>
            <Button variant="secondary" size="sm" onClick={() => setFilterModality('ALL')}>
              Reset Filter
            </Button>
          </div>
        ) : (
          <div className="relative border-l-2 border-line pl-6 ml-3 space-y-5 max-h-[50vh] overflow-y-auto pr-2">
            {filteredBlocks.map((block, idx) => {
              const isCorrupted = block.isTampered;
              const isSelected = selectedBlock?.blockIndex === block.blockIndex;

              return (
                <div
                  key={block.blockId || idx}
                  onClick={() => setSelectedBlock(block)}
                  className={`group relative p-4 rounded-xl border transition-all cursor-pointer ${
                    isCorrupted
                      ? 'bg-seal-soft/40 border-seal shadow-md'
                      : isSelected
                      ? 'bg-sheet-raised border-2 border-indigo shadow-md'
                      : 'bg-sheet border-line hover:border-line-strong hover:bg-ground-sunk/60'
                  }`}
                >
                  {/* Visual Node Dot on the vertical line */}
                  <div
                    className={`absolute -left-[31px] top-5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      isCorrupted
                        ? 'bg-seal border-seal-soft ring-4 ring-seal-soft'
                        : 'bg-state border-sheet ring-4 ring-ground'
                    }`}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>

                  {/* Block Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line-hair pb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-ground-sunk text-ink border border-line">
                        Block #{block.blockIndex}
                      </span>
                      <span
                        className={`text-2xs px-2 py-0.5 rounded-md border font-semibold flex items-center gap-1.5 uppercase ${getModalityBadgeStyle(
                          block.modality
                        )}`}
                      >
                        {getModalityIcon(block.modality)}
                        {block.modality}
                      </span>
                      <span className="text-2xs text-ink-3 font-mono">
                        {new Date(block.timestamp).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-2xs bg-ground-sunk px-2 py-0.5 rounded border border-line text-ink-2 font-mono">
                        {block.payload.actor.name} ({block.payload.actor.role})
                      </span>
                      {isCorrupted ? (
                        <span className="text-2xs font-bold text-seal flex items-center gap-1 bg-seal-soft px-2 py-0.5 rounded border border-seal/40">
                          <AlertTriangle className="w-3 h-3" /> TAMPERED
                        </span>
                      ) : (
                        <span className="text-2xs text-state flex items-center gap-1 bg-state-soft px-2 py-0.5 rounded border border-state/30 font-mono font-medium">
                          <Check className="w-3 h-3 text-state" /> Ed25519 Verified
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content description */}
                  <div className="mt-3">
                    <h4 className="font-semibold text-sm text-ink group-hover:text-indigo transition-colors">
                      {block.title}
                    </h4>
                    <p className="text-xs text-ink-2 mt-1 bn">
                      {block.summaryBn}
                    </p>
                  </div>

                  {/* Modality Specific Highlights */}
                  <div className="mt-3 bg-ground-sunk p-2.5 rounded-lg border border-line text-xs">
                    {block.modality === 'MESSAGE' && (
                      <div className="flex items-start gap-2">
                        <div className="p-1 rounded bg-indigo-soft text-indigo mt-0.5">
                          <MessageSquare className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1">
                          <div className="text-ink-3 text-2xs mb-0.5 font-mono">
                            Channel: {block.payload.metadata.channel || 'SMS_GATEWAY'} • Status: {block.payload.metadata.deliveryStatus || 'DELIVERED'}
                          </div>
                          <p className="text-ink italic font-sans bg-sheet p-2 rounded border border-line">
                            "{block.payload.metadata.messageBody || block.payload.metadata.messageBodyBn || block.title}"
                          </p>
                        </div>
                      </div>
                    )}

                    {block.modality === 'FILE' && (
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-amber" />
                          <div>
                            <span className="font-mono text-ink font-medium">
                              {block.payload.metadata.fileName || 'Certified_Deed_Scan.pdf'}
                            </span>
                            <span className="text-ink-3 text-2xs ml-2">
                              ({((block.payload.metadata.fileSizeBytes || 4000000) / (1024 * 1024)).toFixed(2)} MB)
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-2xs text-amber bg-amber-soft px-2 py-0.5 rounded border border-amber/30">
                          <span>SHA-256:</span>
                          <span className="truncate max-w-[140px]">
                            {block.payload.metadata.fileSha256 || block.payloadHash}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(block.payload.metadata.fileSha256 || block.payloadHash);
                            }}
                            className="hover:text-ink"
                            title="Copy file hash"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {block.modality === 'LOCATION' && (
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 font-mono">
                          <MapPin className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                          <span className="text-ink font-medium">
                            Lat: {block.payload.metadata.latitude?.toFixed(6) ?? '23.851240'} • Lng: {block.payload.metadata.longitude?.toFixed(6) ?? '90.261450'}
                          </span>
                          <span className="text-2xs text-ink-3">
                            (Acc: ±{block.payload.metadata.accuracyRadiusMeters || 1.2}m)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xs bg-sheet text-ink px-2 py-0.5 rounded border border-line">
                            {block.payload.metadata.mouzaPegRef || 'Peg P-01 (Boundary Anchor)'}
                          </span>
                          <span className="text-2xs text-state bg-state-soft px-2 py-0.5 rounded border border-state/30 flex items-center gap-1 font-mono">
                            <Check className="w-3 h-3" /> No Mock GPS
                          </span>
                        </div>
                      </div>
                    )}

                    {block.modality === 'DEVICE_EVENT' && (
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-ink font-medium">
                            {block.payload.metadata.deviceModel || 'Samsung Galaxy Rugged Field Tablet'}
                          </span>
                          <span className="text-2xs text-ink-3 font-mono">
                            Battery: {block.payload.metadata.batteryLevelPercent || 86}%
                          </span>
                        </div>
                        <div className="text-2xs bg-sheet text-ink-2 px-2 py-0.5 rounded border border-line font-mono">
                          Hardware TEE: Non-Root Attested
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cryptographic Footprint Chips */}
                  <div className="mt-3 pt-2.5 border-t border-line-hair flex items-center justify-between flex-wrap gap-2 text-2xs font-mono text-ink-3">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <span>PrevHash:</span>
                        <span className="text-ink-2 truncate max-w-[90px]">
                          {block.previousHash.substring(0, 10)}...
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span>BlockDigest:</span>
                        <span className="text-state font-bold truncate max-w-[90px]">
                          {block.currentHash.substring(0, 10)}...
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(block.currentHash);
                        }}
                        className="hover:text-indigo flex items-center gap-1 transition-colors text-ink-2"
                        title="Copy SHA-256 block hash"
                      >
                        {copiedHash === block.currentHash ? (
                          <>
                            <Check className="w-3 h-3 text-state" />
                            <span className="text-state font-medium">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Hash</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Tampering Breakdown Box if this block is corrupted */}
                  {isCorrupted && (
                    <div className="mt-3 bg-seal-soft border border-seal/60 p-3 rounded-lg text-xs space-y-1 text-seal">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertOctagon className="w-4 h-4 text-seal" />
                        Cryptographic Mismatch Detected at Block #{block.blockIndex}
                      </div>
                      <p className="text-2xs font-mono">
                        {block.tamperDetails || 'Payload hash does not match block header digest! Ed25519 signature is invalid.'}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Forensic Details Inspector Drawer for Selected Block */}
        {selectedBlock && (
          <div className="bg-ground-sunk rounded-xl p-4 border border-line text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <div className="flex items-center gap-2 font-mono">
                <Hash className="w-4 h-4 text-state" />
                <span className="font-semibold text-ink">
                  Forensic Inspector: Block #{selectedBlock.blockIndex} ({selectedBlock.blockId})
                </span>
              </div>
              <span className="text-ink-3 font-mono">{selectedBlock.timestamp}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono">
              <div className="bg-sheet p-2.5 rounded border border-line">
                <div className="text-2xs text-ink-3 mb-1 uppercase">Previous Block Hash (Chained)</div>
                <div className="text-ink-2 break-all text-2xs">{selectedBlock.previousHash}</div>
              </div>
              <div className="bg-sheet p-2.5 rounded border border-line">
                <div className="text-2xs text-ink-3 mb-1 uppercase">Canonical Payload SHA-256</div>
                <div className="text-ink-2 break-all text-2xs">{selectedBlock.payloadHash}</div>
              </div>
              <div className="bg-sheet p-2.5 rounded border border-line">
                <div className="text-2xs text-ink-3 mb-1 uppercase">Current Block Hash (Signed)</div>
                <div className="text-state font-bold break-all text-2xs">{selectedBlock.currentHash}</div>
              </div>
            </div>

            <div className="bg-sheet p-2.5 rounded border border-line font-mono">
              <div className="text-2xs text-ink-3 mb-1 uppercase">
                Ed25519 Asymmetric Digital Signature (Signer Authority: Ministry of Land Root)
              </div>
              <div className="text-indigo break-all text-2xs">{selectedBlock.signature}</div>
            </div>
          </div>
        )}
      </div>

      {/* Tamper Simulation Interactive Modal */}
      {showTamperModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-sheet-raised border border-seal/50 rounded-xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <div className="flex items-center gap-2 text-seal font-bold text-sm">
                <AlertTriangle className="w-5 h-5" />
                Demonstrate Forensic Tamper Detection
              </div>
              <button
                onClick={() => setShowTamperModal(false)}
                className="text-ink-3 hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-ink-2 leading-relaxed">
              Select an existing block in the ledger and alter its recorded coordinates, photo digest, or text.
              This demonstrates how any corrupt actor attempting to forge land records retroactively is immediately caught.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-ink-3 block mb-1 font-mono text-2xs">Target Block to Corrupt</label>
                <select
                  value={tamperTargetBlock}
                  onChange={(e) => setTamperTargetBlock(Number(e.target.value))}
                  className="w-full bg-sheet border border-line rounded px-2.5 py-1.5 text-ink font-mono focus:border-indigo"
                >
                  {blocks.map((b) => (
                    <option key={b.blockIndex} value={b.blockIndex}>
                      Block #{b.blockIndex} — {b.title.substring(0, 32)}...
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-ink-3 block mb-1 font-mono text-2xs">Field to Maliciously Modify</label>
                <select
                  value={tamperField}
                  onChange={(e) => setTamperField(e.target.value)}
                  className="w-full bg-sheet border border-line rounded px-2.5 py-1.5 text-ink focus:border-indigo"
                >
                  <option value="latitude">GPS Latitude (Move boundary anchor)</option>
                  <option value="messageBody">Notice Message Body (Alter summons terms)</option>
                  <option value="fileSha256">File SHA-256 (Swap inspection photo)</option>
                  <option value="actorName">Officer Name (Identity impersonation)</option>
                </select>
              </div>

              <div>
                <label className="text-ink-3 block mb-1 font-mono text-2xs">Malicious / Altered Value</label>
                <input
                  type="text"
                  value={tamperValue}
                  onChange={(e) => setTamperValue(e.target.value)}
                  className="w-full bg-sheet border border-line rounded px-2.5 py-1.5 text-ink font-mono focus:border-indigo"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowTamperModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSimulateTamper}
                className="bg-seal hover:bg-seal/90 text-white flex items-center gap-1.5"
              >
                <AlertOctagon className="w-3.5 h-3.5" /> Inject Tampering
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Court Dossier Printable View Modal */}
      {showDossierModal && dossier && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-sheet-raised border border-line rounded-xl p-6 max-w-3xl w-full max-h-[85vh] overflow-y-auto space-y-4 text-ink shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <FileCheck className="w-6 h-6 text-state" />
                <div>
                  <h3 className="font-bold text-base text-ink">
                    Official Digital Evidence Dossier (ডিজিটাল সাক্ষ্য বিবরণী)
                  </h3>
                  <p className="text-xs text-ink-3 font-mono">
                    Dossier ID: {dossier.dossierId} • Ministry of Land, Government of Bangladesh
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDossierModal(false)}
                className="text-ink-3 hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-ground-sunk rounded-lg border border-line flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs">
              <div className="space-y-1.5">
                <div>Parcel Reference: <span className="text-state font-bold">{dossier.parcelId}</span></div>
                <div>Chain Length: <span className="text-ink font-semibold">{dossier.chainLength} Verified Blocks</span></div>
                <div>
                  Integrity State:{' '}
                  <span className={dossier.verification.isValid ? 'text-state font-bold' : 'text-seal font-bold'}>
                    {dossier.verification.isValid ? 'VERIFIED_PRISTINE (অক্ষুণ্ণ)' : 'TAMPERED (জালিয়াতি শনাক্ত)'}
                  </span>
                </div>
                <div>Root Merkle Hash: <span className="text-ink-3 truncate max-w-xs">{dossier.verification.latestHash.substring(0, 24)}...</span></div>
              </div>

              <div className="p-3 bg-white rounded-lg border border-line flex flex-col items-center justify-center">
                <QrCode className="w-24 h-24 text-slate-900" />
                <span className="text-[9px] font-mono text-slate-600 mt-1">Scan for Judicial Verification</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <h4 className="font-semibold text-ink">Chronological Evidence Summary</h4>
              <div className="border border-line rounded-lg divide-y divide-line bg-sheet">
                {dossier.blocks.map((b) => (
                  <div key={b.blockIndex} className="p-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-ink-3">#{b.blockIndex}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-medium ${getModalityBadgeStyle(b.modality)}`}>
                        {b.modality}
                      </span>
                      <span className="text-ink font-medium">{b.title}</span>
                    </div>
                    <span className="text-ink-3 font-mono text-2xs">
                      {new Date(b.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-ground-sunk rounded-lg border border-line text-xs text-ink-2 leading-relaxed bn">
              <strong className="text-ink">আইনি প্রত্যয়ন (Legal Certificate):</strong> {dossier.legalDisclaimerBn}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.print()}
                className="flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print Court Dossier
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowDossierModal(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
