import { Router, Request, Response } from 'express';
import { EscrowService } from '../services/escrowService';
import { ok, fail } from '../lib/respond';

const router = Router();

// GET /api/escrow/contracts - List contracts with optional parcelId or nid filter
router.get('/contracts', (req: Request, res: Response) => {
  const { parcelId, nid } = req.query;
  const list = EscrowService.listContracts({
    parcelId: typeof parcelId === 'string' ? parcelId : undefined,
    nid: typeof nid === 'string' ? nid : undefined,
  });
  ok(res, list);
});

// GET /api/escrow/contracts/:id - Get specific contract
router.get('/contracts/:id', (req: Request, res: Response) => {
  const contract = EscrowService.getContract(req.params.id);
  if (!contract) {
    return fail(res, `Escrow contract ${req.params.id} not found.`, 404);
  }
  ok(res, contract);
});

// POST /api/escrow/contracts - Initialize new escrow transaction
router.post('/contracts', (req: Request, res: Response) => {
  const {
    parcelId,
    mouza,
    areaDecimal,
    buyerNid,
    buyerName,
    buyerPhone,
    sellerNid,
    sellerName,
    sellerPhone,
    sellerBankAccount,
    sellerBankRouting,
    totalConsiderationBdt,
    earnestDepositBdt,
    escrowBankName,
  } = req.body;

  if (!parcelId || !buyerNid || !sellerNid || !totalConsiderationBdt) {
    return fail(res, 'Missing required parameters: parcelId, buyerNid, sellerNid, totalConsiderationBdt.', 400);
  }

  const contract = EscrowService.createContract({
    parcelId,
    mouza,
    areaDecimal: Number(areaDecimal) || 5.5,
    buyerNid,
    buyerName: buyerName || 'Verified Buyer',
    buyerPhone: buyerPhone || '01811-000000',
    sellerNid,
    sellerName: sellerName || 'Registered Owner',
    sellerPhone: sellerPhone || '01711-000000',
    sellerBankAccount,
    sellerBankRouting,
    totalConsiderationBdt: Number(totalConsiderationBdt),
    earnestDepositBdt: earnestDepositBdt ? Number(earnestDepositBdt) : undefined,
    escrowBankName,
  });

  ok(res, contract, 201);
});

// POST /api/escrow/contracts/:id/deposit - Simulate bank escrow deposit
router.post('/contracts/:id/deposit', (req: Request, res: Response) => {
  const { amountBdt, trxId } = req.body;
  const numAmount = Number(amountBdt);
  if (!numAmount || numAmount <= 0) {
    return fail(res, 'Valid deposit amount in BDT required.', 400);
  }

  const updated = EscrowService.depositEscrow(req.params.id, numAmount, trxId);
  if (!updated) {
    return fail(res, `Escrow contract ${req.params.id} not found.`, 404);
  }
  ok(res, updated);
});

// POST /api/escrow/contracts/:id/certify-title - Complete forensics check
router.post('/contracts/:id/certify-title', (req: Request, res: Response) => {
  const { verdict, forensicScore } = req.body;
  const updated = EscrowService.certifyTitle(
    req.params.id,
    verdict || 'AUTHENTIC_VERIFIED',
    Number(forensicScore) || 0
  );
  if (!updated) {
    return fail(res, `Escrow contract ${req.params.id} not found.`, 404);
  }
  ok(res, updated);
});

// POST /api/escrow/contracts/:id/execute-deed - Record Sub-Registry registration
router.post('/contracts/:id/execute-deed', (req: Request, res: Response) => {
  const { deedNumber, volumeNumber } = req.body;
  if (!deedNumber) {
    return fail(res, 'Executed deed number is required.', 400);
  }

  const updated = EscrowService.recordDeedExecution(req.params.id, deedNumber, volumeNumber);
  if (!updated) {
    return fail(res, `Escrow contract ${req.params.id} not found.`, 404);
  }
  ok(res, updated);
});

// POST /api/escrow/contracts/:id/record-mutation - Record AC Land e-mutation
router.post('/contracts/:id/record-mutation', (req: Request, res: Response) => {
  const { mutationCaseNumber, newKhatianNo } = req.body;
  if (!mutationCaseNumber || !newKhatianNo) {
    return fail(res, 'mutationCaseNumber and newKhatianNo are required.', 400);
  }

  const updated = EscrowService.recordMutationApproved(req.params.id, mutationCaseNumber, newKhatianNo);
  if (!updated) {
    return fail(res, `Escrow contract ${req.params.id} not found.`, 404);
  }
  ok(res, updated);
});

// POST /api/escrow/contracts/:id/release - Disburse funds & unlock parcel
router.post('/contracts/:id/release', (req: Request, res: Response) => {
  const updated = EscrowService.releaseFunds(req.params.id);
  if (!updated) {
    return fail(res, `Escrow contract ${req.params.id} not found.`, 404);
  }
  ok(res, updated);
});

export default router;
