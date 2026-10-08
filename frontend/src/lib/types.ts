export type PaymentStatus = 'PENDING' | 'VERIFIED' | 'RECONCILED' | 'FAILED' | 'REFUNDED';

export type MutationStatus =
  | 'SUBMITTED'
  | 'KANUNGO_VERIFICATION'
  | 'AC_LAND_HEARING'
  | 'DCR_PAYMENT_PENDING'
  | 'APPROVED'
  | 'REJECTED';

export interface TaxRecord {
  id: string;
  fiscalYear: string;
  annualDemandBDT: number;
  arrearAmountBDT: number;
  totalDueBDT: number;
  paidAmountBDT: number;
  status: PaymentStatus;
  trxId: string | null;
  paymentMethod: string | null;
  dakhilaNumber: string | null;
  qrCodeUrl: string | null;
  paymentDate: string | null;
}

export interface Mutation {
  id: string;
  caseNumber: string;
  applicantName: string;
  applicantNid: string;
  applicantPhone: string;
  proposedOwner: string;
  status: MutationStatus;
  currentStage: string;
  hearingDate: string | null;
  dcrAmount: number | null;
  remarks: string | null;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  eventType: string;
  title: string;
  description: string;
  actor: string;
  referenceDoc: string | null;
  eventDate: string;
}

export interface Discrepancy {
  id: string;
  mismatchType: string;
  sourceA: string;
  sourceB: string;
  severity: string;
  isResolved: boolean;
  flaggedBy: string;
  createdAt: string;
}

export interface LandDocument {
  id: string;
  docType: string;
  fileName: string;
  fileUrl: string;
  ocrText: string | null;
  uploadedAt: string;
}

export interface Complaint {
  id: string;
  trackingNo: string;
  parcelId: string;
  complainant: string;
  phone: string;
  category: string;
  description: string;
  assignedOffice: string;
  status: string;
  createdAt: string;
}

export interface GeoJsonGeometry {
  type: 'Polygon';
  coordinates: number[][][]; // [ [ [lng, lat], ... ] ]
}

export interface GeoJsonFeature {
  type: 'Feature';
  geometry: GeoJsonGeometry;
  properties?: {
    dagNo?: string;
    areaDecimal?: number;
    landClass?: string;
    [key: string]: any;
  };
}

export interface Parcel {
  id: string;
  division: string;
  district: string;
  upazila: string;
  mouza: string;
  jlNumber: number;
  khatianNo: string;
  dagNo: string;
  holdingNo: string;
  landClass: string;
  areaDecimal: number;
  mappedAreaDecimal?: number;
  currentOwner: string;
  nidNumber: string;
  phone: string;
  email?: string | null;
  geojsonBoundary?: GeoJsonFeature | any;
  taxRecords?: TaxRecord[];
  mutations?: Mutation[];
  timelineEvents?: TimelineEvent[];
  discrepancies?: Discrepancy[];
  documents?: LandDocument[];
  complaints?: Complaint[];
  isLocked?: boolean;
  lockedAt?: string;
  lockedReason?: string;
  titleChain?: TitleChainNode[];
  adjacentParcels?: AdjacentParcel[];
}

export type PropertyState = 'CURRENT' | 'HISTORICAL' | 'PENDING';

export interface TitleChainNode {
  id: string;
  epoch: 'CS' | 'SA' | 'RS' | 'BS' | 'BDS';
  epochTitle: string;
  year: number | string;
  ownerName: string;
  khatianNo: string;
  dagNo: string;
  areaDecimal: number;
  transferType: 'ORIGINAL_SETTLEMENT' | 'INHERITANCE' | 'PURCHASE_DEED' | 'E_MUTATION';
  transferTypeBn: string;
  deedNo?: string;
  subRegistryOffice?: string;
  state: PropertyState;
  notes?: string;
}

export interface AdjacentParcel {
  dagNo: string;
  mouza: string;
  owner: string;
  areaDecimal: number;
  landClass: string;
  encroachmentStatus: 'NORMAL' | 'VARIANCE_FLAG' | 'CLEAR';
  overlapDiffSqFt?: number;
}

export interface DueDiligenceItem {
  id: string;
  name: string;
  nameBn: string;
  status: 'PASS' | 'WARNING' | 'FAIL';
  finding: string;
  detail: string;
  statuteRef: string;
}

export interface DueDiligenceReport {
  parcelId: string;
  score: number; // 0 to 100
  overallVerdict: 'APPROVED_FOR_TRANSACTION' | 'CAUTION_REQUIRED' | 'DISPUTED_RESTRICTED';
  generatedAt: string;
  verificationHash: string;
  qrCodeData: string;
  items: DueDiligenceItem[];
}

export interface SmsAlert {
  id: string;
  recipientPhone: string;
  senderId: string;
  messageText: string;
  timestamp: string;
  status: 'DELIVERED' | 'QUEUED';
  type: 'LAND_LOCK' | 'MUTATION_ACTIVITY' | 'TAX_PAYMENT' | 'DISPUTE_FILED';
}

export interface KharijPartitionShare {
  applicantName: string;
  relation: string;
  fraction: string;
  allocatedDecimal: number;
  proposedDagNo: string;
  color: string;
  percentage: number;
}

/* --------------------------------------------------------- super admin --- */
export interface AdminOfficer {
  id: string;
  name: string;
  nid: string;
  mobile: string;
  designation: 'AC_LAND' | 'KANUNGO';
  division: string;
  district: string;
  upazila: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED';
  pendingQueue: number;
}

export interface AdminMetrics {
  totalParcels: number;
  totalAreaDecimal: number;
  mutations: {
    filed: number;
    approved: number;
    rejected: number;
    pending: number;
    avgTurnaroundDays: number;
    slaTargetDays: number;
  };
  treasury: { collectedBDT: number; outstandingBDT: number };
  discrepancies: { unresolved: number };
  divisions: Array<{ division: string; parcels: number; areaDecimal: number }>;
}

export interface AuditTrailEntry {
  id: string;
  parcelId: string;
  eventType: string;
  title: string;
  description: string;
  actor: string;
  referenceDoc: string | null;
  eventDate: string;
  parcel?: { id: string; upazila: string; district: string };
}

export interface TaxSlabPolicy {
  ratePerDecimal: { residential: number; commercial: number; agricultural: number };
  lateSurchargeMultiplier: number;
  agriculturalWaiverUnderBigha: number;
}

export type Role = 'citizen' | 'buyer' | 'officer' | 'amin' | 'super_admin';

export interface Session {
  name: string;
  nid: string;
  role: Role;
  office?: string;
  parcels: string[];
  signedInAt: string;
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
  wife: number;
  husband: number;
  father: number;
  mother: number;
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

export interface DeedVerificationParams {
  deedNumber: string;
  parcelId: string;
  sellerNid: string;
  sellerName: string;
  declaredAreaDecimal: number;
  declaredPriceBdt: number;
  parentDeedNumber?: string;
  subRegistryOffice?: string;
  registrationDate?: string;
}

export interface ForensicCheckItem {
  id: string;
  category: 'AREA_INTEGRITY' | 'LINEAGE_CHAIN' | 'SELLER_AUTHENTICITY' | 'VALUATION_FAIRNESS' | 'COURT_LITIGATION' | 'IDENTITY_MATCH';
  titleEn: string;
  titleBn: string;
  status: 'PASS' | 'CAUTION' | 'FAIL';
  penaltyScore: number;
  findingEn: string;
  findingBn: string;
  statutoryRef: string;
}

export interface DeedVerificationResult {
  deedNumber: string;
  parcelId: string;
  overallScore: number; // 0 (Clean) to 100 (Extreme Risk / Fraud)
  verdict: 'AUTHENTIC_VERIFIED' | 'REVIEW_RECOMMENDED' | 'SUSPECTED_FRAUD_LOCKED';
  verdictBn: string;
  checks: ForensicCheckItem[];
  areaInflationPercentage: number;
  valuationDisparityPercentage: number;
  verifiedAt: string;
  statutorySummaryEn: string;
  statutorySummaryBn: string;
}

export interface DeedPreset {
  id: string;
  titleEn: string;
  titleBn: string;
  descriptionEn: string;
  descriptionBn: string;
  expectedVerdict: string;
  params: DeedVerificationParams;
}

export interface LitigationCase {
  id: string;
  parcelId: string;
  caseNumber: string;
  courtName: string;
  suitType: 'TITLE_SUIT' | 'PARTITION_SUIT' | 'TEMPORARY_INJUNCTION' | 'LIS_PENDENS';
  suitTypeBn: string;
  claimant: string;
  defendant: string;
  filedDate: string;
  stayOrderActive: boolean;
  stayOrderDate?: string;
  nextHearingDate: string;
  status: 'ACTIVE_STAY' | 'PENDING_HEARING' | 'DISPOSED' | 'VACATED';
  orderSummary: string;
  orderSummaryBn: string;
  statutorySection: string;
}

export interface ParcelValuation {
  parcelId: string;
  mouza: string;
  areaDecimal: number;
  statutoryBenchmarkPerDecimal: number;
  statutoryMinimumTotalBdt: number;
  fairMarketPerDecimal: number;
  fairMarketTotalBdt: number;
  stampDutyRatePercent: number;
  estimatedRegistrationCostBdt: number;
  gazetteRef: string;
}

export type EscrowStage =
  | 'OFFER_PENDING'
  | 'LAND_LOCKED'
  | 'ESCROW_DEPOSITED'
  | 'TITLE_AUDITED'
  | 'SUB_REGISTRY_SCHEDULED'
  | 'DEED_EXECUTED'
  | 'MUTATION_RECORDED'
  | 'FUNDS_RELEASED'
  | 'REFUNDED_DISPUTED';

export interface EscrowTimelineEvent {
  stage: EscrowStage;
  timestamp: string;
  descriptionEn: string;
  descriptionBn: string;
  actor: string;
  referenceNumber?: string;
}

export interface EscrowContract {
  id: string;
  parcelId: string;
  mouza: string;
  areaDecimal: number;
  buyerNid: string;
  buyerName: string;
  buyerPhone: string;
  sellerNid: string;
  sellerName: string;
  sellerPhone: string;
  sellerBankAccount: string;
  sellerBankRouting: string;
  totalConsiderationBdt: number;
  earnestDepositBdt: number;
  balanceBdt: number;
  depositedAmountBdt: number;
  escrowBankName: string;
  escrowVaultAccount: string;
  stage: EscrowStage;
  isLocked: boolean;
  lockTimestamp?: string;
  forensicsVerdict?: string;
  deedNumber?: string;
  deedVolumeNumber?: string;
  mutationCaseNumber?: string;
  newKhatianNo?: string;
  stampDutyBdt: number;
  localGovTaxBdt: number;
  registrationFeeBdt: number;
  aitSourceTaxBdt: number;
  totalStatutoryFeesBdt: number;
  netPayableToSellerBdt: number;
  createdAt: string;
  updatedAt: string;
  timeline: EscrowTimelineEvent[];
}

export interface KhasRecord {
  id: string;
  mouza: string;
  upazila: string;
  district: string;
  khasKhatianNo: string;
  dagNo: string;
  category: '1_NO_KHAS' | 'VESTED_PROPERTY' | 'ABANDONED_PROPERTY' | 'RIVERBED_FORESHORE' | 'FOREST_RESERVE';
  categoryBn: string;
  areaDecimal: number;
  controllingAuthority: string;
  coordinates: [number, number];
  isEncroached: boolean;
  encroacherName?: string;
  evictionCaseNumber?: string;
  evictionNoticeDate?: string;
  statutoryAct: string;
}

export interface EncroachmentCheckResult {
  parcelId: string;
  isEncroaching: boolean;
  inBufferZone: boolean;
  closestDistanceMeters: number;
  riskLevel: 'CLEAN' | 'BUFFER_WARNING' | 'CRITICAL_ENCROACHMENT';
  riskLevelBn: string;
  matchedKhasRecord: KhasRecord | null;
  statutoryCitation: string;
  statutoryNoticeEn: string;
  statutoryNoticeBn: string;
  checkedAt: string;
}

// --- Phase 4: Field Survey & Offline Amin Sync Types ---

export interface BenchmarkPeg {
  id: string;
  pegNumber: string;
  lat: number;
  lng: number;
  btmEasting: number;
  btmNorthing: number;
  elevationMeters: number;
  chainageToNextLinks: number;
  chainageToNextFeet: number;
  physicalMarkerType: 'CONCRETE_PILLAR' | 'IRON_ROD' | 'CANAL_BOUNDARY_MARK' | 'WOODEN_PEG';
  timestamp: string;
}

export interface CoSharerStatement {
  id: string;
  personName: string;
  nid: string;
  relationship: 'CO_SHARER' | 'ADJACENT_OWNER' | 'VILLAGE_PRADHAN';
  adjacentDagNo?: string;
  statementText: string;
  hasObjection: boolean;
  objectionDetail?: string;
  timestamp: string;
}

export type SurveyStatus =
  | 'DRAFT_IN_FIELD'
  | 'OFFLINE_QUEUED'
  | 'SYNCED'
  | 'KANUNGO_APPROVED'
  | 'DISPUTE_REFERRED';

export interface SurveyRecord {
  id: string;
  parcelId: string;
  mouza: string;
  upazila: string;
  district: string;
  aminId: string;
  aminName: string;
  aminLicenseNo: string;
  surveyDate: string;
  status: SurveyStatus;
  physicalLandUse: 'AGRICULTURAL_PADDY' | 'RESIDENTIAL_HOMESTEAD' | 'COMMERCIAL_SHOP' | 'POND_WATERBODY' | 'CHAR_LAND';
  physicalLandUseBn: string;
  benchmarkPegs: BenchmarkPeg[];
  computedAreaSqFt: number;
  computedAreaDecimal: number;
  khatianRecordedDecimal: number;
  areaVarianceDecimal: number;
  boundaryDisputeFlag: boolean;
  disputeSummary?: string;
  coSharerStatements: CoSharerStatement[];
  kanungoReviewed: boolean;
  kanungoComments?: string;
  syncedAt?: string;
  offlineCreated: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Phase 4: Drone Cadastre Multi-Epoch Comparison Types ---

export interface CadastralEpoch {
  epochId: 'CS_1924' | 'RS_1988' | 'BS_2015' | 'BDS_2026';
  epochNameEn: string;
  epochNameBn: string;
  surveyYear: number;
  surveyTechnology: string;
  surveyAgency: string;
  nominalScale: string;
  precisionMeters: number;
  measuredAreaDecimal: number;
  vertexCount: number;
  coordinates: Array<[number, number]>;
  canalBufferOverlap: boolean;
}

export interface EpochComparisonResult {
  parcelId: string;
  mouza: string;
  epochs: CadastralEpoch[];
  areaDriftPercentage: number;
  maxVertexShiftMeters: number;
  canalEncroachmentFlag: boolean;
  canalEncroachmentAreaSqFt?: number;
  verdict: 'CONGRUENT_MATCH' | 'ACCEPTABLE_SURVEY_VARIANCE' | 'SUSPECTED_CANAL_ENCROACHMENT' | 'HISTORICAL_AREA_DEFICIT';
  verdictBn: string;
  technicalSummaryEn: string;
  technicalSummaryBn: string;
  statutoryReference: string;
  generatedAt: string;
}

// --- Phase 5: Digital Evidence & Tamper-Evident Timeline Types ---

export type EvidenceModality = 'MESSAGE' | 'FILE' | 'LOCATION' | 'DEVICE_EVENT';

export type EvidenceActorRole =
  | 'AC_LAND'
  | 'KANUNGO'
  | 'SURVEYOR_AMIN'
  | 'CITIZEN'
  | 'SYSTEM_RADAR'
  | 'SUB_REGISTRAR';

export interface EvidenceActor {
  name: string;
  role: EvidenceActorRole;
  nidOrBadge: string;
  ipAddress?: string;
  phone?: string;
}

export interface EvidencePayload {
  modality: EvidenceModality;
  actor: EvidenceActor;
  capturedAt: string;
  metadata: {
    // MESSAGE metadata
    sender?: string;
    recipient?: string;
    messageBody?: string;
    messageBodyBn?: string;
    channel?: 'SMS_GATEWAY' | 'PORTAL_SUMMONS' | 'WHATSAPP_AUDIT' | 'OFFICIAL_ORDER';
    deliveryStatus?: 'DELIVERED' | 'READ' | 'PENDING';

    // FILE metadata
    fileName?: string;
    mimeType?: string;
    fileSizeBytes?: number;
    fileSha256?: string;
    fileUrl?: string;
    exifGps?: { lat: number; lng: number; altitudeMeters?: number };
    fileDescription?: string;

    // LOCATION metadata
    latitude?: number;
    longitude?: number;
    altitudeMeters?: number;
    accuracyRadiusMeters?: number;
    speedKmh?: number;
    headingDegrees?: number;
    isMockGpsDetected?: boolean;
    mouzaPegRef?: string;
    deviceSatelliteCount?: number;

    // DEVICE_EVENT metadata
    deviceModel?: string;
    deviceIdHash?: string;
    osVersion?: string;
    appVersion?: string;
    batteryLevelPercent?: number;
    networkType?: '4G_LTE' | '5G' | 'WIFI' | 'OFFLINE_CACHE';
    isRootedOrJailbroken?: boolean;
    deviceEventType?: 'APP_LOGIN' | 'GEO_CACHE_SYNC' | 'MOCK_GPS_PROBE' | 'BATTERY_TELEMETRY' | 'SECURE_BOOT';
    hardwareSecurityTier?: string;

    [key: string]: any;
  };
}

export interface EvidenceBlock {
  blockIndex: number;
  blockId: string;
  parcelId: string;
  timestamp: string;
  modality: EvidenceModality;
  title: string;
  summaryBn: string;
  payload: EvidencePayload;
  payloadHash: string;
  previousHash: string;
  currentHash: string;
  signature: string;
  publicKey: string;
  isTampered?: boolean;
  tamperDetails?: string;
}

export interface BlockValidationResult {
  blockIndex: number;
  hashValid: boolean;
  prevHashValid: boolean;
  signatureValid: boolean;
  tamperedReason?: string;
}

export interface ChainVerificationReport {
  isValid: boolean;
  parcelId: string;
  totalBlocks: number;
  genesisHash: string;
  latestHash: string;
  tamperedBlockIndex?: number;
  errorReason?: string;
  tamperDetails?: string;
  verifiedAt: string;
  blockValidations: BlockValidationResult[];
}

export interface CourtDossier {
  dossierId: string;
  parcelId: string;
  exportedAt: string;
  qrPayload: string;
  verification: ChainVerificationReport;
  chainLength: number;
  blocks: EvidenceBlock[];
  legalDisclaimerBn: string;
  legalDisclaimerEn: string;
}

// --- AI LandGuard Verification Types ---
export type LandGuardVerdict = 
  | 'CLEARED_PROTECTED'
  | 'CAUTION_ADVISORY'
  | 'CRITICAL_FRAUD_FLAGGED';

export type LandGuardPillarStatus = 'PASS' | 'WARNING' | 'FAIL';

export interface LandGuardPillarEvaluation {
  pillarId: 'DEED_FORENSICS' | 'DRONE_CADASTRE' | 'KHAS_PROXIMITY' | 'EVIDENCE_CHAIN' | 'LAND_LOCK';
  titleEn: string;
  titleBn: string;
  status: LandGuardPillarStatus;
  score: number;
  weightPercent: number;
  weightedScore: number;
  highlightMetric: string;
  summaryEn: string;
  summaryBn: string;
  drillDownTarget: 'deed' | 'drone' | 'khas' | 'evidence' | 'lock';
}

export interface LandGuardAuditResult {
  parcelId: string;
  mouza: string;
  upazila: string;
  district: string;
  ownerName: string;
  khatianNo: string;
  dagNo: string;
  areaDecimal: number;
  trustScore: number;
  verdict: LandGuardVerdict;
  verdictTitleEn: string;
  verdictTitleBn: string;
  aiExplanationEn: string;
  aiExplanationBn: string;
  isLocked: boolean;
  pillars: LandGuardPillarEvaluation[];
  auditedAt: string;
  qrPayload: string;
}

export interface LandGuardDossier {
  dossierId: string;
  parcelId: string;
  audit: LandGuardAuditResult;
  exportedAt: string;
  qrPayload: string;
  issuerAuthority: string;
  legalDisclaimerBn: string;
  legalDisclaimerEn: string;
}

/* =============================================================
 * INTER-REGISTRY LOCK & TITLE ENCUMBRANCE TYPES
 * ============================================================= */

export type LockType =
  | 'OWNER_BIOMETRIC'
  | 'ESCROW_CONVEYANCE'
  | 'JUDICIAL_STAY'
  | 'MORTGAGE_LIEN'
  | 'KHAS_DISPUTE';

export interface RegistryLockRecord {
  id: string;
  lockToken: string;
  parcelId: string;
  lockType: LockType;
  status: 'ACTIVE' | 'RELEASED' | 'VACATED' | 'EXPIRED';
  priority: number;
  lockingAuthority: string;
  authorityCategory: 'JUDICIARY' | 'BANKING' | 'LAND_MINISTRY' | 'CITIZEN';
  initiatorNid?: string;
  initiatorName: string;
  referenceNumber: string;
  statutoryBasis: string;
  orderSummaryEn: string;
  orderSummaryBn: string;
  acquiredAt: string;
  expiresAt?: string;
  releasedAt?: string;
  releaseAuthority?: string;
  releaseReference?: string;
  ed25519Signature: string;
  auditHash: string;
}

export interface CibLienRecord {
  cibTrackingToken: string;
  parcelId: string;
  bankCode: string;
  bankName: string;
  branchName: string;
  routingNumber: string;
  sanctionedAmountBDT: number;
  outstandingBalanceBDT: number;
  chargeRank: number;
  isPariPassuConsent: boolean;
  status: 'ACTIVE_LIEN' | 'NOC_ISSUED' | 'DISCHARGED' | 'DEFAULT_AUCTION';
  nocReferenceNumber?: string;
  sanctionDate: string;
  mortgageDeedNumber?: string;
  borrowerNid: string;
  borrowerName: string;
}

export interface CibInquiryResult {
  parcelId: string;
  hasActiveMortgage: boolean;
  totalMortgageCount: number;
  totalSanctionedAmountBDT: number;
  primaryChargeHolder?: string;
  liens: CibLienRecord[];
  cibScore: number;
  canPledgeNewMortgage: boolean;
  rejectionReason?: string;
  inquiryTimestamp: string;
  inquiryReference: string;
}

export interface InterAgencyDashboardState {
  parcelId: string;
  isFullyClear: boolean;
  overallStatusEn: 'CLEAN_UNENCUMBERED' | 'DISPUTED_STAY_LOCKED' | 'ESCROW_FROZEN' | 'BANK_MORTGAGED' | 'OWNER_LOCKED';
  overallStatusBn: string;
  activeLockCount: number;
  locks: RegistryLockRecord[];
  agencyStatuses: {
    landMinistry: {
      status: 'UNRESTRICTED' | 'HEARING_FROZEN' | 'PENDING_MUTATION';
      canMutate: boolean;
      activeKhatian: string;
      summaryEn: string;
      summaryBn: string;
    };
    lawMinistry: {
      status: 'UNRESTRICTED' | 'REGISTRATION_BARRED' | 'CONDITIONAL_NOC';
      canConvey: boolean;
      subRegistryOffice: string;
      summaryEn: string;
      summaryBn: string;
    };
    judiciary: {
      status: 'CLEAN' | 'INJUNCTION_ACTIVE' | 'LIS_PENDENS';
      hasInjunction: boolean;
      courtName?: string;
      caseNumber?: string;
      summaryEn: string;
      summaryBn: string;
    };
    centralBankCib: {
      status: 'NO_LIEN' | 'FIRST_CHARGE_ACTIVE' | 'NOC_RELEASED';
      hasActiveMortgage: boolean;
      primaryBank?: string;
      sanctionedBdt: number;
      summaryEn: string;
      summaryBn: string;
    };
  };
  lastSyncedAt: string;
}

export interface Nec30YearDeedEntry {
  periodYears: string;
  surveyEpoch: 'CS (1920)' | 'SA (1956)' | 'RS (1978)' | 'BS (2015)' | 'BDS (2026)';
  deedOrKhatianRef: string;
  grantor: string;
  grantee: string;
  transferType: string;
  status: 'CLEAR_VALID' | 'ENCUMBERED' | 'DISPUTED';
}

export interface NonEncumbranceCertificate {
  certificateNumber: string;
  parcelId: string;
  mouza: string;
  upazila: string;
  district: string;
  khatianNo: string;
  dagNo: string;
  areaDecimal: number;
  currentOwnerName: string;
  currentOwnerNid: string;
  applicantName: string;
  applicantNid: string;
  purpose: string;
  isFullyUnencumbered: boolean;
  encumbranceStatusEn: 'CLEAN_UNENCUMBERED' | 'CONDITIONAL_CAUTION' | 'STRICTLY_ENCUMBERED';
  encumbranceStatusBn: string;
  registryClearances: {
    cibBankMortgages: {
      status: 'PASS' | 'FAIL';
      findingEn: string;
      findingBn: string;
      activeLienCount: number;
      totalLienBdt: number;
    };
    judicialCourts: {
      status: 'PASS' | 'FAIL';
      findingEn: string;
      findingBn: string;
      activeInjunctionCount: number;
    };
    subRegistryArchives: {
      status: 'PASS' | 'FAIL';
      findingEn: string;
      findingBn: string;
      historicalDeedCount: number;
    };
    governmentKhasCanal: {
      status: 'PASS' | 'FAIL';
      findingEn: string;
      findingBn: string;
      khasRiskLevel: string;
    };
  };
  thirtyYearAuditChain: Nec30YearDeedEntry[];
  issuedAt: string;
  expiresAt: string;
  issuingAuthorityEn: string;
  issuingAuthorityBn: string;
  statutoryDisclaimerEn: string;
  statutoryDisclaimerBn: string;
  ed25519Signature: string;
  verificationHash: string;
  publicKeyBase64: string;
  qrPayload: string;
}
