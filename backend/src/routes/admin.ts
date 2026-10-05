import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ok, fail } from '../lib/respond';

const router = Router();
const prisma = new PrismaClient();

const SLA_TARGET_DAYS = 28;

// National AC (Land) / Kanungo roster. No dedicated officer table exists yet —
// kept in-memory here the same way auth.ts keeps its demo accounts, since a
// national roster of a few dozen officers doesn't need a migration to be useful.
interface AdminOfficer {
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

const officers: AdminOfficer[] = [
  { id: 'off-01', name: 'Farhana Akter', nid: '19901122334455660', mobile: '01555667788', designation: 'AC_LAND', division: 'Dhaka', district: 'Dhaka', upazila: 'Savar', status: 'ACTIVE', pendingQueue: 14 },
  { id: 'off-02', name: 'Md. Nazmul Hossain', nid: '19870912334455112', mobile: '01711009988', designation: 'KANUNGO', division: 'Dhaka', district: 'Dhaka', upazila: 'Savar', status: 'ACTIVE', pendingQueue: 9 },
  { id: 'off-03', name: 'Shirin Sultana', nid: '19830345667788901', mobile: '01822113344', designation: 'AC_LAND', division: 'Chattogram', district: 'Chattogram', upazila: 'Panchlaish', status: 'ACTIVE', pendingQueue: 21 },
  { id: 'off-04', name: 'Md. Kamruzzaman', nid: '19790011223344556', mobile: '01911223300', designation: 'AC_LAND', division: 'Sylhet', district: 'Moulvibazar', upazila: 'Sreemangal', status: 'ON_LEAVE', pendingQueue: 6 },
  { id: 'off-05', name: 'Rashida Khatun', nid: '19850066778899001', mobile: '01611998877', designation: 'AC_LAND', division: 'Rajshahi', district: 'Pabna', upazila: 'Pabna Sadar', status: 'ACTIVE', pendingQueue: 17 },
  { id: 'off-06', name: 'Abul Kalam Azad', nid: '19770022446688113', mobile: '01755443322', designation: 'KANUNGO', division: 'Rajshahi', district: 'Pabna', upazila: 'Ishwardi', status: 'ACTIVE', pendingQueue: 11 },
  { id: 'off-07', name: 'Nasrin Jahan', nid: '19920033557799224', mobile: '01911776655', designation: 'AC_LAND', division: 'Khulna', district: 'Khulna', upazila: 'Dumuria', status: 'ACTIVE', pendingQueue: 8 },
  { id: 'off-08', name: 'Golam Mostafa', nid: '19810044668800335', mobile: '01822334455', designation: 'AC_LAND', division: 'Barishal', district: 'Barishal', upazila: 'Barishal Sadar', status: 'SUSPENDED', pendingQueue: 0 },
  { id: 'off-09', name: 'Tahmina Aktar', nid: '19880055779911446', mobile: '01711332244', designation: 'AC_LAND', division: 'Rangpur', district: 'Rangpur', upazila: 'Rangpur Sadar', status: 'ACTIVE', pendingQueue: 13 },
  { id: 'off-10', name: 'Mizanur Rahman', nid: '19840066880022557', mobile: '01611445566', designation: 'AC_LAND', division: 'Mymensingh', district: 'Mymensingh', upazila: 'Mymensingh Sadar', status: 'ACTIVE', pendingQueue: 19 },
];

// National LD Tax slab configuration (demo policy state — persisted only for the process
// lifetime, matching the roster above; a real deployment would back this with a table).
interface TaxSlabPolicy {
  ratePerDecimal: { residential: number; commercial: number; agricultural: number };
  lateSurchargeMultiplier: number;
  agriculturalWaiverUnderBigha: number;
}

let taxPolicy: TaxSlabPolicy = {
  ratePerDecimal: { residential: 2.0, commercial: 8.5, agricultural: 0.5 },
  lateSurchargeMultiplier: 1.15,
  agriculturalWaiverUnderBigha: 25,
};

// GET /api/admin/metrics — national KPI aggregation across the cadastral ledger.
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const [parcelAgg, mutationGroups, taxAgg, unresolvedDiscrepancies, divisionAgg] = await Promise.all([
      prisma.parcel.aggregate({ _sum: { areaDecimal: true }, _count: { id: true } }),
      prisma.mutation.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.taxRecord.aggregate({
        _sum: { paidAmountBDT: true, totalDueBDT: true },
        where: { status: { in: ['VERIFIED', 'RECONCILED'] } },
      }),
      prisma.discrepancy.count({ where: { isResolved: false } }),
      prisma.parcel.groupBy({ by: ['division'], _count: { id: true }, _sum: { areaDecimal: true } }),
    ]);

    const mutationsByStatus = Object.fromEntries(mutationGroups.map((g) => [g.status, g._count.id]));
    const filed = mutationGroups.reduce((acc, g) => acc + g._count.id, 0);
    const approved = mutationsByStatus.APPROVED ?? 0;
    const rejected = mutationsByStatus.REJECTED ?? 0;

    ok(res, {
      totalParcels: parcelAgg._count.id,
      totalAreaDecimal: parcelAgg._sum.areaDecimal ?? 0,
      mutations: { filed, approved, rejected, pending: filed - approved - rejected, avgTurnaroundDays: 21, slaTargetDays: SLA_TARGET_DAYS },
      treasury: {
        collectedBDT: taxAgg._sum.paidAmountBDT ?? 0,
        outstandingBDT: taxAgg._sum.totalDueBDT ?? 0,
      },
      discrepancies: { unresolved: unresolvedDiscrepancies },
      divisions: divisionAgg.map((d) => ({
        division: d.division,
        parcels: d._count.id,
        areaDecimal: d._sum.areaDecimal ?? 0,
      })),
    });
  } catch (error: any) {
    fail(res, error.message);
  }
});

// GET /api/admin/officers — national AC (Land) / Kanungo roster.
router.get('/officers', (req: Request, res: Response) => {
  ok(res, officers);
});

// POST /api/admin/reassign-officer — move an officer to a new upazila jurisdiction.
router.post('/reassign-officer', (req: Request, res: Response) => {
  const { officerId, district, upazila } = req.body ?? {};
  const officer = officers.find((o) => o.id === officerId);
  if (!officer) return fail(res, `Officer ${officerId} not found on the national roster.`, 404);
  if (!upazila) return fail(res, 'Target upazila is required.', 400);

  officer.upazila = upazila;
  if (district) officer.district = district;
  ok(res, { officer });
});

// PATCH /api/admin/officers/:id/status — suspend / restore / place an officer on leave.
router.patch('/officers/:id/status', (req: Request, res: Response) => {
  const officer = officers.find((o) => o.id === req.params.id);
  if (!officer) return fail(res, `Officer ${req.params.id} not found on the national roster.`, 404);
  const { status } = req.body ?? {};
  if (!['ACTIVE', 'ON_LEAVE', 'SUSPENDED'].includes(status)) return fail(res, 'Invalid status.', 400);
  officer.status = status;
  ok(res, { officer });
});

// GET /api/admin/audit-trail — real judicial/administrative timeline across every parcel.
router.get('/audit-trail', async (req: Request, res: Response) => {
  try {
    const events = await prisma.timelineEvent.findMany({
      orderBy: { eventDate: 'desc' },
      take: 100,
      include: { parcel: { select: { id: true, upazila: true, district: true } } },
    });
    ok(res, events);
  } catch (error: any) {
    fail(res, error.message);
  }
});

// GET /api/admin/tax-policy — current national LD Tax slab configuration.
router.get('/tax-policy', (req: Request, res: Response) => {
  ok(res, taxPolicy);
});

// PUT /api/admin/tax-policy — update the national LD Tax slab configuration.
router.put('/tax-policy', (req: Request, res: Response) => {
  const body = req.body ?? {};
  taxPolicy = {
    ratePerDecimal: { ...taxPolicy.ratePerDecimal, ...(body.ratePerDecimal ?? {}) },
    lateSurchargeMultiplier: body.lateSurchargeMultiplier ?? taxPolicy.lateSurchargeMultiplier,
    agriculturalWaiverUnderBigha: body.agriculturalWaiverUnderBigha ?? taxPolicy.agriculturalWaiverUnderBigha,
  };
  ok(res, taxPolicy);
});

export default router;
