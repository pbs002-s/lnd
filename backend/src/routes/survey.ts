import { Router, Request, Response } from 'express';
import { SurveyService } from '../services/surveyService';
import { ok, fail } from '../lib/respond';

const router = Router();

// GET /api/survey/records - List field surveys with optional parcelId or aminId filter
router.get('/records', (req: Request, res: Response) => {
  const { parcelId, aminId } = req.query;
  const list = SurveyService.listSurveys({
    parcelId: typeof parcelId === 'string' ? parcelId : undefined,
    aminId: typeof aminId === 'string' ? aminId : undefined,
  });
  ok(res, list);
});

// GET /api/survey/records/:id - Get specific survey record
router.get('/records/:id', (req: Request, res: Response) => {
  const survey = SurveyService.getSurvey(req.params.id);
  if (!survey) {
    return fail(res, `Survey record ${req.params.id} not found.`, 404);
  }
  ok(res, survey);
});

// POST /api/survey/records - Create new field survey session
router.post('/records', (req: Request, res: Response) => {
  const {
    parcelId,
    mouza,
    upazila,
    district,
    aminId,
    aminName,
    aminLicenseNo,
    physicalLandUse,
    khatianRecordedDecimal,
    isOffline,
  } = req.body;

  if (!parcelId || !khatianRecordedDecimal) {
    return fail(res, 'parcelId and khatianRecordedDecimal are required.', 400);
  }

  const survey = SurveyService.createSurvey({
    parcelId,
    mouza: mouza || 'Savar Mouza',
    upazila: upazila || 'Savar',
    district: district || 'Dhaka',
    aminId: aminId || 'amin-004',
    aminName: aminName || 'Md. Abdur Rahim (Revenue Amin)',
    aminLicenseNo: aminLicenseNo || 'AMIN-DHK-2018/88',
    physicalLandUse,
    khatianRecordedDecimal: Number(khatianRecordedDecimal),
    isOffline: !!isOffline,
  });

  ok(res, survey, 201);
});

// POST /api/survey/records/:id/pegs - Add a benchmark station peg
router.post('/records/:id/pegs', (req: Request, res: Response) => {
  const {
    pegNumber,
    lat,
    lng,
    btmEasting,
    btmNorthing,
    elevationMeters,
    chainageToNextLinks,
    chainageToNextFeet,
    physicalMarkerType,
  } = req.body;

  if (!pegNumber || lat === undefined || lng === undefined) {
    return fail(res, 'pegNumber, lat, and lng are required.', 400);
  }

  const updated = SurveyService.addStationPeg(req.params.id, {
    pegNumber,
    lat: Number(lat),
    lng: Number(lng),
    btmEasting: Number(btmEasting) || 526310,
    btmNorthing: Number(btmNorthing) || 2637400,
    elevationMeters: Number(elevationMeters) || 11.0,
    chainageToNextLinks: Number(chainageToNextLinks) || 0,
    chainageToNextFeet: chainageToNextFeet ? Number(chainageToNextFeet) : SurveyService.linksToFeet(Number(chainageToNextLinks) || 0),
    physicalMarkerType: physicalMarkerType || 'CONCRETE_PILLAR',
  });

  if (!updated) {
    return fail(res, `Survey record ${req.params.id} not found.`, 404);
  }
  ok(res, updated);
});

// POST /api/survey/records/:id/statements - Add co-sharer or adjacent owner statement
router.post('/records/:id/statements', (req: Request, res: Response) => {
  const { personName, nid, relationship, adjacentDagNo, statementText, hasObjection, objectionDetail } = req.body;

  if (!personName || !statementText) {
    return fail(res, 'personName and statementText are required.', 400);
  }

  const updated = SurveyService.addCoSharerStatement(req.params.id, {
    personName,
    nid: nid || '19800000000000000',
    relationship: relationship || 'CO_SHARER',
    adjacentDagNo,
    statementText,
    hasObjection: !!hasObjection,
    objectionDetail,
  });

  if (!updated) {
    return fail(res, `Survey record ${req.params.id} not found.`, 404);
  }
  ok(res, updated);
});

// POST /api/survey/records/:id/submit - Submit survey report to Kanungo
router.post('/records/:id/submit', (req: Request, res: Response) => {
  const updated = SurveyService.submitToKanungo(req.params.id);
  if (!updated) {
    return fail(res, `Survey record ${req.params.id} not found.`, 404);
  }
  ok(res, updated);
});

// POST /api/survey/sync - Batch offline synchronization
router.post('/sync', (req: Request, res: Response) => {
  const { records } = req.body;
  if (!Array.isArray(records)) {
    return fail(res, 'records array required.', 400);
  }

  const result = SurveyService.syncOfflineQueue(records);
  ok(res, result);
});

export default router;
