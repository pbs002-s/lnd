/**
 * Ed25519 Cryptographic Signer Service for Bangladesh Digital Land Platform
 * Signs and verifies authoritative Smart Porcha, Dakhila tax receipts,
 * and Title Clearance Certificates to prevent forged QR codes and altered records.
 */

import crypto from 'crypto';

export interface SignedCertificatePayload {
  certificateId: string;
  parcelId: string;
  documentType: 'DAKHILA_RECEIPT' | 'SMART_PORCHA' | 'TITLE_CLEARANCE';
  issuedTo: string;
  nidNumber: string;
  details: Record<string, any>;
  issuedAt: string;
  expiresAt?: string;
  issuerAuthority: string;
}

export interface CryptographicSignatureResult {
  certificateId: string;
  algorithm: 'Ed25519';
  canonicalHash: string;
  signature: string;
  publicKey: string;
  qrPayload: string;
  signedAt: string;
}

export interface VerificationResult {
  isValid: boolean;
  algorithm: string;
  canonicalHash: string;
  certificateId?: string;
  signedAt?: string;
  error?: string;
}

export class CryptoSignerService {
  private static keyPair: { publicKey: crypto.KeyObject; privateKey: crypto.KeyObject } | null = null;
  private static publicKeyBase64: string = '';

  /**
   * Initialize or retrieve authoritative Ed25519 keypair
   */
  private static getKeyPair() {
    if (!this.keyPair) {
      // In production, load from environment PEM string
      const privEnv = process.env.ED25519_PRIVATE_KEY;
      const pubEnv = process.env.ED25519_PUBLIC_KEY;

      if (privEnv && pubEnv) {
        this.keyPair = {
          privateKey: crypto.createPrivateKey({ key: Buffer.from(privEnv, 'base64'), format: 'der', type: 'pkcs8' }),
          publicKey: crypto.createPublicKey({ key: Buffer.from(pubEnv, 'base64'), format: 'der', type: 'spki' }),
        };
      } else {
        // Generate a cryptographically secure keypair
        this.keyPair = crypto.generateKeyPairSync('ed25519');
      }

      this.publicKeyBase64 = this.keyPair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
    }
    return this.keyPair;
  }

  /**
   * Deterministic canonical JSON serialization (RFC 8785)
   */
  public static canonicalize(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map((item) => this.canonicalize(item)).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    const parts = keys.map((key) => JSON.stringify(key) + ':' + this.canonicalize(obj[key]));
    return '{' + parts.join(',') + '}';
  }

  /**
   * Sign an authoritative document payload using Ed25519
   */
  public static signCertificate(payload: SignedCertificatePayload): CryptographicSignatureResult {
    const { privateKey, publicKey } = this.getKeyPair();
    const canonicalString = this.canonicalize(payload);
    const hash = crypto.createHash('sha256').update(canonicalString).digest('hex');

    const signature = crypto.sign(null, Buffer.from(canonicalString, 'utf-8'), privateKey);
    const signatureBase64 = signature.toString('base64');
    const pubKeyBase64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

    // Create compact URL-safe QR payload: prefix:certId:hashPrefix:signature
    const qrPayload = `BDSIG:v1:${payload.certificateId}:${hash.substring(0, 16)}:${signatureBase64}`;

    return {
      certificateId: payload.certificateId,
      algorithm: 'Ed25519',
      canonicalHash: hash,
      signature: signatureBase64,
      publicKey: pubKeyBase64,
      qrPayload,
      signedAt: payload.issuedAt || new Date().toISOString(),
    };
  }

  /**
   * Verify an Ed25519 signature against canonical payload
   */
  public static verifySignature(
    payload: any,
    signatureBase64: string,
    publicKeyBase64?: string
  ): VerificationResult {
    try {
      const canonicalString = this.canonicalize(payload);
      const hash = crypto.createHash('sha256').update(canonicalString).digest('hex');

      const pubKeyDer = Buffer.from(publicKeyBase64 || this.getPublicKeyBase64(), 'base64');
      const publicKey = crypto.createPublicKey({ key: pubKeyDer, format: 'der', type: 'spki' });

      const sigBuffer = Buffer.from(signatureBase64, 'base64');
      const isValid = crypto.verify(null, Buffer.from(canonicalString, 'utf-8'), publicKey, sigBuffer);

      return {
        isValid,
        algorithm: 'Ed25519',
        canonicalHash: hash,
        certificateId: payload?.certificateId,
        signedAt: payload?.issuedAt,
      };
    } catch (err: any) {
      return {
        isValid: false,
        algorithm: 'Ed25519',
        canonicalHash: '',
        error: err.message || 'Signature verification failed',
      };
    }
  }

  /**
   * Sign raw data string using Ed25519
   */
  public static signString(data: string): { signature: string; publicKey: string } {
    const { privateKey, publicKey } = this.getKeyPair();
    const sig = crypto.sign(null, Buffer.from(data, 'utf-8'), privateKey);
    return {
      signature: sig.toString('base64'),
      publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    };
  }

  /**
   * Verify an Ed25519 signature on raw data string
   */
  public static verifyString(
    data: string,
    signatureBase64: string,
    publicKeyBase64?: string
  ): boolean {
    try {
      const pubKeyDer = Buffer.from(publicKeyBase64 || this.getPublicKeyBase64(), 'base64');
      const publicKey = crypto.createPublicKey({ key: pubKeyDer, format: 'der', type: 'spki' });
      const sigBuffer = Buffer.from(signatureBase64, 'base64');
      return crypto.verify(null, Buffer.from(data, 'utf-8'), publicKey, sigBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Get server authoritative public key
   */
  public static getPublicKeyBase64(): string {
    this.getKeyPair();
    return this.publicKeyBase64;
  }
}
