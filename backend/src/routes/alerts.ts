import { Router, Request, Response } from 'express';
import { ok } from '../lib/respond';

const router = Router();

const inMemoryAlerts = [
  {
    id: 'sms-1',
    recipientPhone: '+880 1711-223344',
    senderId: 'BHUMISHEBA',
    messageText: 'নামজারি আবেদন MUT-2026-DH-4892 গ্রহণ করা হয়েছে। শুনানি তারিখ: ২৪ মার্চ ২০২৬।',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    status: 'DELIVERED' as const,
    type: 'MUTATION_ACTIVITY' as const,
  },
  {
    id: 'sms-2',
    recipientPhone: '+880 1711-223344',
    senderId: 'BHUMISHEBA',
    messageText: 'খতিয়ান নং ১০৮২ এর ভূমি উন্নয়ন কর ৳৬৪০ পরিশোধিত হয়েছে। দাখিলা নং DAK-2026-849102।',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    status: 'DELIVERED' as const,
    type: 'TAX_PAYMENT' as const,
  },
  {
    id: 'sms-3',
    recipientPhone: '+880 1711-223344',
    senderId: 'BHUMISHEBA',
    messageText: 'সতর্কতা: আপনার জমি BD-DHK-SAV-000001 এর উপর ডিজিটাল ভূমি লক সফলভাবে কার্যকর করা হয়েছে।',
    timestamp: new Date(Date.now() - 259200000).toISOString(),
    status: 'DELIVERED' as const,
    type: 'LAND_LOCK' as const,
  },
];

router.get('/sms', (req: Request, res: Response) => {
  ok(res, inMemoryAlerts);
});

export default router;
