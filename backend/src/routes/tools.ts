import { Router, Request, Response } from 'express';
import { CadastralService } from '../services/cadastralService';
import { FaraizService } from '../services/faraizService';
import { CryptoSignerService } from '../services/cryptoSigner';
import { ok, fail } from '../lib/respond';

const router = Router();

// Advanced Faraiz calculation endpoint (Hanafi Islamic + Dayabhaga Hindu)
router.post('/faraiz-calculate', (req: Request, res: Response) => {
  const {
    deceasedGender = 'MALE',
    religion = 'ISLAM',
    totalDecimal,
    sons = 0,
    daughters = 0,
    wives = 0,
    husband = false,
    fatherPresent = false,
    motherPresent = false,
  } = req.body ?? {};

  if (totalDecimal === undefined || isNaN(Number(totalDecimal)) || Number(totalDecimal) <= 0) {
    return fail(res, 'Please provide a valid total land area in decimals.', 400);
  }

  const result = FaraizService.calculate({
    deceasedGender: String(deceasedGender).toUpperCase() === 'FEMALE' ? 'FEMALE' : 'MALE',
    religion: String(religion).toUpperCase() === 'HINDU' ? 'HINDU' : 'ISLAM',
    totalDecimal: Number(totalDecimal),
    sons: Math.max(0, parseInt(String(sons), 10) || 0),
    daughters: Math.max(0, parseInt(String(daughters), 10) || 0),
    wives: Math.max(0, parseInt(String(wives), 10) || 0),
    husband: Boolean(husband),
    fatherPresent: Boolean(fatherPresent),
    motherPresent: Boolean(motherPresent),
  });

  ok(res, result);
});

// Unit conversion endpoint
router.post('/convert-units', (req: Request, res: Response) => {
  const { value, fromUnit } = req.body;
  if (value === undefined || isNaN(Number(value))) {
    return fail(res, 'Please provide a valid numeric value.', 400);
  }

  const validUnits = ['decimal', 'katha', 'bigha', 'acre', 'sqft', 'sqm'];
  const unit = String(fromUnit || 'decimal').toLowerCase() as any;
  if (!validUnits.includes(unit)) {
    return fail(res, `Invalid unit. Supported units: ${validUnits.join(', ')}`, 400);
  }

  const result = CadastralService.convertUnits(Number(value), unit);
  ok(res, { input: { value: Number(value), fromUnit: unit }, result });
});

// Faraez inheritance calculation endpoint
router.post('/faraez', (req: Request, res: Response) => {
  const { totalDecimal, sons = 0, daughters = 0, wife = 0, husband = 0, father = 0, mother = 0 } = req.body;

  if (totalDecimal === undefined || isNaN(Number(totalDecimal)) || Number(totalDecimal) <= 0) {
    return fail(res, 'Please provide a valid total land area in decimals.', 400);
  }

  const calculation = CadastralService.calculateFaraez({
    totalDecimal: Number(totalDecimal),
    sons: Math.max(0, parseInt(sons, 10) || 0),
    daughters: Math.max(0, parseInt(daughters, 10) || 0),
    wife: Math.max(0, parseInt(wife, 10) || 0),
    husband: Math.max(0, parseInt(husband, 10) || 0),
    father: Math.max(0, parseInt(father, 10) || 0),
    mother: Math.max(0, parseInt(mother, 10) || 0),
  });

  ok(res, { totalDecimal: Number(totalDecimal), ...calculation });
});

// LD Tax demand estimation endpoint
router.post('/estimate-tax', (req: Request, res: Response) => {
  const { landClass, decimalArea } = req.body;
  if (!landClass || decimalArea === undefined || isNaN(Number(decimalArea))) {
    return fail(res, 'Please provide landClass and numeric decimalArea.', 400);
  }

  const estimate = CadastralService.estimateLdTax(String(landClass), Number(decimalArea));
  ok(res, { landClass, decimalArea: Number(decimalArea), ...estimate });
});

// Authoritative Public Key retrieval endpoint
router.get('/public-key', (req: Request, res: Response) => {
  const publicKey = CryptoSignerService.getPublicKeyBase64();
  ok(res, {
    algorithm: 'Ed25519',
    format: 'SPKI-DER-Base64',
    publicKey,
    authority: 'Ministry of Land, Government of Bangladesh (ভূমি রেকর্ড ও জরিপ অধিদপ্তর)',
  });
});

// Ed25519 Certificate Signing endpoint
router.post('/sign-certificate', (req: Request, res: Response) => {
  const payload = req.body;
  if (!payload || !payload.certificateId || !payload.parcelId) {
    return fail(res, 'Certificate payload requires certificateId and parcelId.', 400);
  }

  const signed = CryptoSignerService.signCertificate(payload);
  ok(res, signed);
});

// Ed25519 Signature Verification endpoint
router.post('/verify-signature', (req: Request, res: Response) => {
  const { payload, signature, publicKey } = req.body ?? {};
  if (!payload || !signature) {
    return fail(res, 'Payload and signature are required for verification.', 400);
  }

  const result = CryptoSignerService.verifySignature(payload, signature, publicKey);
  ok(res, result);
});

export default router;
