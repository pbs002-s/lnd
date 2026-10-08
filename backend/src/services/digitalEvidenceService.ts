/**
 * Digital Evidence & Tamper-Evident Timeline Service
 * 
 * Provides an append-only cryptographic ledger for multi-modal evidence:
 * 1. Messages (SMS, hearing notices, citizen complaints)
 * 2. Files (geotagged photos, deed scans, drone imagery, court orders)
 * 3. Locations (surveyor GPS pings, boundary coordinates, accuracy)
 * 4. Device Events (hardware telemetry, mock-location flags, battery, boot logs)
 * 
 * Implements SHA-256 hash chaining and Ed25519 asymmetric cryptographic signing.
 */

import crypto from 'crypto';
import { CryptoSignerService } from './cryptoSigner';

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

    // DEVICE_EVENT metadata
    deviceModel?: string;
    deviceIdHash?: string;
    osVersion?: string;
    appVersion?: string;
    batteryLevelPercent?: number;
    networkType?: '4G_LTE' | '5G' | 'WIFI' | 'OFFLINE_CACHE';
    isRootedOrJailbroken?: boolean;
    deviceEventType?: 'APP_LOGIN' | 'GEO_CACHE_SYNC' | 'MOCK_GPS_PROBE' | 'BATTERY_TELEMETRY' | 'SECURE_BOOT';
    
    // Additional generic properties
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

export interface IngestEvidenceInput {
  parcelId: string;
  modality: EvidenceModality;
  title: string;
  summaryBn?: string;
  actor: EvidenceActor;
  capturedAt?: string;
  metadata: Record<string, any>;
}

const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export class DigitalEvidenceService {
  // In-memory ledger storage keyed by parcelId
  private static ledgerStore: Map<string, EvidenceBlock[]> = new Map();
  // Backup of pristine chains to support tamper testing & reset
  private static originalBackupStore: Map<string, EvidenceBlock[]> = new Map();

  static {
    this.seedParcelLedger('BD-DHK-SAV-000001');
    this.seedParcelLedger('BD-SYL-SRM-000108');
    this.seedParcelLedger('BD-DHK-SAV-000002');
    this.seedParcelLedger('BD-DHK-SAV-000003');
  }

  /**
   * Calculate SHA-256 of canonicalized payload
   */
  public static calculatePayloadHash(payload: EvidencePayload): string {
    const canonical = CryptoSignerService.canonicalize(payload);
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Calculate current block hash: SHA-256(index + timestamp + modality + previousHash + payloadHash)
   */
  public static calculateBlockHash(
    blockIndex: number,
    timestamp: string,
    modality: EvidenceModality,
    previousHash: string,
    payloadHash: string
  ): string {
    const blockHeader = `${blockIndex}|${timestamp}|${modality}|${previousHash}|${payloadHash}`;
    return crypto.createHash('sha256').update(blockHeader).digest('hex');
  }

  /**
   * Ingest a new evidence item and append it as a verified block
   */
  public static ingestEvidence(input: IngestEvidenceInput): EvidenceBlock {
    const parcelId = input.parcelId.trim();
    let chain = this.ledgerStore.get(parcelId);

    if (!chain || chain.length === 0) {
      // Create Genesis block for this parcel if none exists
      chain = [this.createGenesisBlock(parcelId)];
      this.ledgerStore.set(parcelId, chain);
    }

    const previousBlock = chain[chain.length - 1];
    const blockIndex = chain.length;
    const timestamp = new Date().toISOString();

    const payload: EvidencePayload = {
      modality: input.modality,
      actor: input.actor,
      capturedAt: input.capturedAt || timestamp,
      metadata: input.metadata || {},
    };

    const payloadHash = this.calculatePayloadHash(payload);
    const previousHash = previousBlock.currentHash;
    const currentHash = this.calculateBlockHash(
      blockIndex,
      timestamp,
      input.modality,
      previousHash,
      payloadHash
    );

    // Cryptographically sign current block hash with server/authority Ed25519 key
    const { signature, publicKey } = CryptoSignerService.signString(currentHash);

    const block: EvidenceBlock = {
      blockIndex,
      blockId: `ev-blk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      parcelId,
      timestamp,
      modality: input.modality,
      title: input.title,
      summaryBn: input.summaryBn || input.title,
      payload,
      payloadHash,
      previousHash,
      currentHash,
      signature,
      publicKey,
    };

    chain.push(block);
    // Keep clean backup in case of tamper simulation
    this.originalBackupStore.set(parcelId, JSON.parse(JSON.stringify(chain)));
    return block;
  }

  /**
   * Retrieve the complete evidence chain for a parcel
   */
  public static getEvidenceTimeline(parcelId: string): EvidenceBlock[] {
    let chain = this.ledgerStore.get(parcelId);
    if (!chain || chain.length === 0) {
      this.seedParcelLedger(parcelId);
      chain = this.ledgerStore.get(parcelId);
    }
    return chain || [];
  }

  /**
   * Cryptographically audit and verify the entire hash chain
   */
  public static verifyChainIntegrity(parcelId: string): ChainVerificationReport {
    const chain = this.getEvidenceTimeline(parcelId);
    const verifiedAt = new Date().toISOString();

    if (!chain || chain.length === 0) {
      return {
        isValid: true,
        parcelId,
        totalBlocks: 0,
        genesisHash: '',
        latestHash: '',
        verifiedAt,
        blockValidations: [],
      };
    }

    const blockValidations: BlockValidationResult[] = [];
    let isValid = true;
    let tamperedBlockIndex: number | undefined;
    let errorReason: string | undefined;
    let tamperDetails: string | undefined;

    for (let i = 0; i < chain.length; i++) {
      const block = chain[i];
      let hashValid = true;
      let prevHashValid = true;
      let signatureValid = true;
      let reason = '';

      // 1. Verify previous hash linkage
      if (i === 0) {
        if (block.previousHash !== GENESIS_PREV_HASH) {
          prevHashValid = false;
          reason = `Genesis block previousHash must be ${GENESIS_PREV_HASH.substring(0, 8)}...`;
        }
      } else {
        const expectedPrevHash = chain[i - 1].currentHash;
        if (block.previousHash !== expectedPrevHash) {
          prevHashValid = false;
          reason = `Hash link broken at Block #${i}. Expected prevHash ${expectedPrevHash.substring(0, 10)}... got ${block.previousHash.substring(0, 10)}...`;
        }
      }

      // 2. Verify payload hash
      const recomputedPayloadHash = this.calculatePayloadHash(block.payload);
      if (recomputedPayloadHash !== block.payloadHash) {
        hashValid = false;
        reason = `Block #${i} payload content was altered! Computed ${recomputedPayloadHash.substring(0, 10)}... !== stored ${block.payloadHash.substring(0, 10)}...`;
      }

      // 3. Verify block currentHash
      const recomputedBlockHash = this.calculateBlockHash(
        block.blockIndex,
        block.timestamp,
        block.modality,
        block.previousHash,
        block.payloadHash
      );
      if (recomputedBlockHash !== block.currentHash) {
        hashValid = false;
        reason = `Block #${i} header hash corrupted! Computed ${recomputedBlockHash.substring(0, 10)}... !== stored ${block.currentHash.substring(0, 10)}...`;
      }

      // 4. Verify Ed25519 digital signature
      const sigOk = CryptoSignerService.verifyString(block.currentHash, block.signature, block.publicKey);
      if (!sigOk) {
        signatureValid = false;
        reason = `Block #${i} Ed25519 signature is invalid or forged!`;
      }

      const blockOk = hashValid && prevHashValid && signatureValid;
      block.isTampered = !blockOk;
      block.tamperDetails = blockOk ? undefined : reason;

      blockValidations.push({
        blockIndex: block.blockIndex,
        hashValid,
        prevHashValid,
        signatureValid,
        tamperedReason: blockOk ? undefined : reason,
      });

      if (!blockOk && isValid) {
        isValid = false;
        tamperedBlockIndex = i;
        errorReason = reason;
        tamperDetails = reason;
      }
    }

    return {
      isValid,
      parcelId,
      totalBlocks: chain.length,
      genesisHash: chain[0].currentHash,
      latestHash: chain[chain.length - 1].currentHash,
      tamperedBlockIndex,
      errorReason,
      tamperDetails,
      verifiedAt,
      blockValidations,
    };
  }

  /**
   * Intentionally tamper with a block in the ledger to demonstrate detection
   */
  public static simulateTamper(
    parcelId: string,
    targetBlockIndex: number,
    modification: { field: string; maliciousValue: any; reasonBn: string }
  ): { success: boolean; message: string; tamperedBlock: EvidenceBlock } {
    const chain = this.ledgerStore.get(parcelId);
    if (!chain || targetBlockIndex < 0 || targetBlockIndex >= chain.length) {
      throw new Error(`Invalid block index ${targetBlockIndex} for parcel ${parcelId}`);
    }

    const block = chain[targetBlockIndex];
    // Maliciously alter payload field without updating signature or re-mining hash
    if (modification.field === 'latitude') {
      block.payload.metadata.latitude = modification.maliciousValue;
    } else if (modification.field === 'messageBody') {
      block.payload.metadata.messageBody = modification.maliciousValue;
    } else if (modification.field === 'fileSha256') {
      block.payload.metadata.fileSha256 = modification.maliciousValue;
    } else if (modification.field === 'isMockGpsDetected') {
      block.payload.metadata.isMockGpsDetected = modification.maliciousValue;
    } else if (modification.field === 'actorName') {
      block.payload.actor.name = modification.maliciousValue;
    } else {
      (block.payload.metadata as any)[modification.field] = modification.maliciousValue;
    }

    block.isTampered = true;
    block.tamperDetails = `Tampered: ${modification.reasonBn || 'Malicious alteration injected'}`;

    return {
      success: true,
      message: `Injected tampering into Block #${targetBlockIndex} (${modification.field}). Ledger integrity is now broken.`,
      tamperedBlock: block,
    };
  }

  /**
   * Restore the authentic, untouched ledger from pristine backup
   */
  public static resetChain(parcelId: string): { success: boolean; totalBlocks: number } {
    const backup = this.originalBackupStore.get(parcelId);
    if (backup) {
      this.ledgerStore.set(parcelId, JSON.parse(JSON.stringify(backup)));
      return { success: true, totalBlocks: backup.length };
    }
    this.seedParcelLedger(parcelId);
    return { success: true, totalBlocks: this.ledgerStore.get(parcelId)?.length || 0 };
  }

  /**
   * Generate official court evidence dossier
   */
  public static exportCourtDossier(parcelId: string) {
    const chain = this.getEvidenceTimeline(parcelId);
    const verification = this.verifyChainIntegrity(parcelId);

    const qrPayload = `BDEVD:v2:${parcelId}:${chain.length}:${verification.latestHash.substring(0, 16)}:${verification.isValid ? 'VALID' : 'TAMPERED'}`;

    return {
      dossierId: `DOSSIER-${parcelId}-${Date.now().toString(36).toUpperCase()}`,
      parcelId,
      exportedAt: new Date().toISOString(),
      qrPayload,
      verification,
      chainLength: chain.length,
      blocks: chain,
      legalDisclaimerBn: 'ডিজিটাল নিরাপত্তা ও সাক্ষ্য আইন অনুযায়ী এই টাইমলাইন ক্রিপ্টোগ্রাফিক হ্যাশ চেইনে সংরক্ষিত এবং অপরিবর্তনীয়। যেকোনো পরিবর্তন স্বয়ংক্রিয়ভাবে ধরা পড়ে।',
      legalDisclaimerEn: 'Per the Bangladesh Evidence Act & Digital Security framework, this forensic timeline is anchored on an append-only SHA-256 cryptographic chain with Ed25519 digital signatures. Any record alteration renders the chain invalid.',
    };
  }

  /**
   * Create Genesis block for parcel
   */
  private static createGenesisBlock(parcelId: string): EvidenceBlock {
    const timestamp = '2026-01-10T04:00:00.000Z';
    const payload: EvidencePayload = {
      modality: 'DEVICE_EVENT',
      actor: {
        name: 'Ministry of Land AC Land Automation Core',
        role: 'AC_LAND',
        nidOrBadge: 'GOVT-CORE-ROOT-001',
        ipAddress: '10.24.1.1',
      },
      capturedAt: timestamp,
      metadata: {
        deviceEventType: 'SECURE_BOOT',
        systemName: 'Bangladesh Land Digital Evidence Ledger (DEMS)',
        jurisdiction: 'Savar Upazila Land Office, Dhaka',
        rootAnchor: 'GOVT_BANGLADESH_MO_LAND',
      },
    };

    const payloadHash = this.calculatePayloadHash(payload);
    const currentHash = this.calculateBlockHash(
      0,
      timestamp,
      'DEVICE_EVENT',
      GENESIS_PREV_HASH,
      payloadHash
    );

    const { signature, publicKey } = CryptoSignerService.signString(currentHash);

    return {
      blockIndex: 0,
      blockId: `genesis-${parcelId}`,
      parcelId,
      timestamp,
      modality: 'DEVICE_EVENT',
      title: 'Ledger Genesis: Jurisdictional Evidence Chain Initiated',
      summaryBn: 'ডিজিটাল এভিডেন্স লেজার সূচনা: সহকারী কমিশনার (ভূমি) সাভার সার্কেল জুরিসডিকশন নোড সংস্থাপন',
      payload,
      payloadHash,
      previousHash: GENESIS_PREV_HASH,
      currentHash,
      signature,
      publicKey,
    };
  }

  /**
   * Seed realistic multi-modal evidence chain for any parcel
   */
  public static seedParcelLedger(targetParcelId: string) {
    const parcelId = (targetParcelId || 'BD-DHK-SAV-000001').trim();
    const existing = this.ledgerStore.get(parcelId);
    if (existing && existing.length > 0) return;

    const isSylhet = parcelId.toUpperCase().includes('SYL') || parcelId.toUpperCase().includes('SRM');
    const isChittagong = parcelId.toUpperCase().includes('CTG');

    const upazila = isSylhet ? 'Sreemangal' : isChittagong ? 'Patiya' : 'Savar';
    const upazilaBn = isSylhet ? 'শ্রীমঙ্গল' : isChittagong ? 'পটিয়া' : 'সাভার';
    const district = isSylhet ? 'Moulvibazar' : isChittagong ? 'Chattogram' : 'Dhaka';
    const districtBn = isSylhet ? 'মৌলভীবাজার' : isChittagong ? 'চট্টগ্রাম' : 'ঢাকা';
    const mouza = isSylhet ? 'Radhanagar Mouza (JL-14)' : isChittagong ? 'Dhurung Mouza (JL-31)' : 'Savar Mouza (JL-42)';
    const lat = isSylhet ? 24.306540 : isChittagong ? 22.296540 : 23.851240;
    const lng = isSylhet ? 91.729650 : isChittagong ? 91.979650 : 90.261450;
    const acLandName = isSylhet ? 'Md. Nazrul Islam, BCS (Admin)' : 'Khandakar Mizanur Rahman, BCS (Admin)';
    const aminName = isSylhet ? 'Abul Kashem (Revenue Amin)' : 'Md. Abdur Rahim (Revenue Amin)';

    const chain: EvidenceBlock[] = [];

    const appendSeedBlock = (
      modality: EvidenceModality,
      title: string,
      summaryBn: string,
      timestamp: string,
      actor: EvidenceActor,
      metadata: Record<string, any>
    ) => {
      const blockIndex = chain.length;
      const previousHash = blockIndex === 0 ? GENESIS_PREV_HASH : chain[blockIndex - 1].currentHash;

      const payload: EvidencePayload = {
        modality,
        actor,
        capturedAt: timestamp,
        metadata,
      };

      const payloadHash = this.calculatePayloadHash(payload);
      const currentHash = this.calculateBlockHash(
        blockIndex,
        timestamp,
        modality,
        previousHash,
        payloadHash
      );

      const { signature, publicKey } = CryptoSignerService.signString(currentHash);

      const block: EvidenceBlock = {
        blockIndex,
        blockId: `seed-blk-${blockIndex}-${parcelId}`,
        parcelId,
        timestamp,
        modality,
        title,
        summaryBn,
        payload,
        payloadHash,
        previousHash,
        currentHash,
        signature,
        publicKey,
      };

      chain.push(block);
    };

    // 0. Genesis Block
    appendSeedBlock(
      'DEVICE_EVENT',
      `Genesis Anchor: ${upazila} Circle Jurisdictional Root`,
      `ডিজিটাল এভিডেন্স লেজার সূচনা: সহকারী কমিশনার (ভূমি) ${upazilaBn} রাজস্ব সার্কেল`,
      '2026-02-01T08:30:00.000Z',
      {
        name: `${upazila} Upazila Land Office Node`,
        role: 'AC_LAND',
        nidOrBadge: `AC-${upazila.toUpperCase()}-ADM-01`,
        ipAddress: '10.24.112.5',
      },
      {
        deviceEventType: 'SECURE_BOOT',
        jurisdiction: `${district} Division, ${upazila} Upazila, ${mouza}`,
        appVersion: 'DEMS-GovBD v3.4.1',
      }
    );

    // 1. MESSAGE: Official Summons Notice to Citizen
    appendSeedBlock(
      'MESSAGE',
      'AC Land Hearing Summons Dispatched via SMS Gateway',
      'সহকারী কমিশনার (ভূমি) শুনানির নোটিশ: আবেদনকারীকে দলিল ও পর্চাসহ হাজির হওয়ার তলব',
      '2026-02-05T09:15:00.000Z',
      {
        name: acLandName,
        role: 'AC_LAND',
        nidOrBadge: 'BCS-36-88912',
        phone: '+8801711223344',
      },
      {
        channel: 'SMS_GATEWAY',
        sender: 'BD-GOVT-LAND',
        recipient: '+8801712000000',
        messageBody: `Notification: Mutation Case 2026/MUT-${upazila.substring(0, 3).toUpperCase()}-0042 hearing scheduled on 18 Feb 2026 at 11:00 AM at ${upazila} Upazila Land Office. Bring original Dalil.`,
        messageBodyBn: `বিজ্ঞপ্তি: খারিজ মোকদ্দমা ২০২৬/MUT-${upazilaBn}-০০৪২ এর শুনানি ১৮ ফেব্রুয়ারি ২০২৬ সকাল ১১:০০ টায় ধার্য করা হয়েছে। মূল দলিলপত্র সঙ্গে আনুন।`,
        deliveryStatus: 'DELIVERED',
        telecomGatewayId: 'BTCL-GOV-SMS-884129',
      }
    );

    // 2. LOCATION: Field Surveyor (Amin) on-site GPS Boundary Verification
    appendSeedBlock(
      'LOCATION',
      `Field Surveyor On-Site GPS Fix at Northern ${upazila} Mouza Benchmark`,
      `আমিন সরজমিন সীমানা জিপিএস ফিক্স: উত্তর সীমানা সীমানা খুঁটি (Peg P-01, ${upazilaBn})`,
      '2026-02-12T10:45:22.000Z',
      {
        name: aminName,
        role: 'SURVEYOR_AMIN',
        nidOrBadge: 'AMIN-BD-2018/88',
        phone: '+8801819345678',
      },
      {
        latitude: lat,
        longitude: lng,
        altitudeMeters: 14.8,
        accuracyRadiusMeters: 1.2,
        speedKmh: 0.4,
        headingDegrees: 18.5,
        isMockGpsDetected: false,
        mouzaPegRef: 'P-01 (উত্তর-পূর্ব কর্নার সীমানা পিলার)',
        deviceSatelliteCount: 16,
        constellationsUsed: ['GPS', 'GLONASS', 'NAV_IC'],
      }
    );

    // 3. FILE: High-Resolution Geotagged Site Inspection Photograph
    appendSeedBlock(
      'FILE',
      'Geotagged Boundary Peg Inspection Photo Uploaded',
      'সরজমিন তদন্ত আলোকচিত্র: সীমানা পিলারের উচ্চ-রেজোলিউশন ও ক্রিপ্টোগ্রাফিক হ্যাশযুক্ত ছবি',
      '2026-02-12T10:48:10.000Z',
      {
        name: aminName,
        role: 'SURVEYOR_AMIN',
        nidOrBadge: 'AMIN-BD-2018/88',
      },
      {
        fileName: `SURVEY_${upazila.toUpperCase()}_DAG_PEG1_GEO.jpg`,
        mimeType: 'image/jpeg',
        fileSizeBytes: 4289104,
        fileSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        fileUrl: `/evidence/files/${parcelId}/peg1_geo.jpg`,
        exifGps: { lat: lat, lng: lng, altitudeMeters: 14.7 },
        fileDescription: `Boundary concrete pillar inspected by ${aminName}.`,
      }
    );

    // 4. DEVICE_EVENT: Surveyor Tablet Hardware Telemetry & Security Attestation
    appendSeedBlock(
      'DEVICE_EVENT',
      'Survey Handset Hardware Telemetry & Non-Root Attestation',
      'মাঠপর্যায়ের মোবাইল ডিভাইসের সিকিউরিটি লগ: মক জিপিএস নিষ্ক্রিয় ও নকশ হার্ডওয়্যার সত্যায়ন',
      '2026-02-12T10:50:00.000Z',
      {
        name: aminName,
        role: 'SURVEYOR_AMIN',
        nidOrBadge: 'AMIN-BD-2018/88',
      },
      {
        deviceModel: 'Samsung Galaxy XCover 6 Pro (Govt Issued Rugged)',
        deviceIdHash: '8a3b59dfc12e8471b6910a30b42fce1286940a1b8972',
        osVersion: 'Android 14 (Security Patch Feb 2026)',
        appVersion: 'BhumiFieldSurvey-Mobile v2.9.0',
        batteryLevelPercent: 86,
        networkType: '4G_LTE',
        isRootedOrJailbroken: false,
        deviceEventType: 'MOCK_GPS_PROBE',
        hardwareSecurityTier: 'HARDWARE_BACKED_TEE',
      }
    );

    // 5. FILE: Sub-Registry Registered Sale Deed Dalil Scan (SHA-256 Verified)
    appendSeedBlock(
      'FILE',
      `Sub-Registry Authenticated Registered Sale Deed (${upazila})`,
      `সাব-রেজিস্ট্রি প্রত্যয়িত সাফ-কবলা দলিল স্ক্যান (${upazilaBn} সাব-রেজিস্ট্রি অফিস)`,
      '2026-02-18T11:20:00.000Z',
      {
        name: `Sub-Registrar ${upazila} Office Vault`,
        role: 'SUB_REGISTRAR',
        nidOrBadge: `SUBREG-${upazila.toUpperCase()}-VAULT-04`,
      },
      {
        fileName: `DEED_${upazila.toUpperCase()}_OFFICIAL_ARCHIVE.pdf`,
        mimeType: 'application/pdf',
        fileSizeBytes: 8940212,
        fileSha256: 'bc94a974b7c6c4f03c054ee42045e763b6528751475510427954e3cb41ee3bc0',
        fileUrl: `/evidence/files/${parcelId}/deed_archive.pdf`,
        bayaVolumeNo: 'Book-1, Volume 44, Pages 89-98',
        subRegistryOffice: `${upazila} Sadar Sub-Registry Office, ${district}`,
      }
    );

    // 6. MESSAGE: Citizen Hearing Statement Recorded in Presence of AC Land
    appendSeedBlock(
      'MESSAGE',
      'Citizen Sworn Statement & Co-Sharer No-Objection Recorded',
      'নাগরিকের হলফনামা ও ওয়ারিশান অনাপত্তিপত্র শুনানি এজলাসে গ্রহণ',
      '2026-02-18T11:45:00.000Z',
      {
        name: acLandName,
        role: 'AC_LAND',
        nidOrBadge: 'BCS-36-88912',
      },
      {
        channel: 'OFFICIAL_ORDER',
        sender: `AC_LAND_${upazila.toUpperCase()}`,
        recipient: 'CITIZEN_RECORD',
        messageBody: `Applicant appeared before AC Land ${upazila} with original title documents. Co-sharers gave verbal consent in court. No rival objections recorded.`,
        messageBodyBn: `আবেদনকারী সহকারী কমিশনার (ভূমি) ${upazilaBn} এর এজলাসে মূল দলিলপত্রসহ হাজির হন। সহ-শরীকগণ স্বশরীরে উপস্থিত হয়ে অনাপত্তি প্রদান করেন।`,
        deliveryStatus: 'READ',
        orderSheetRef: `${upazila.substring(0, 3).toUpperCase()}-MUT-2026-0042/ORDER-3`,
      }
    );

    this.ledgerStore.set(parcelId, chain);
    this.originalBackupStore.set(parcelId, JSON.parse(JSON.stringify(chain)));
  }
}
