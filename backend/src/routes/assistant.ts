import { Router, Request, Response } from 'express';
import { AiAssistantService } from '../services/aiAssistantService';
import { ok, fail } from '../lib/respond';

const router = Router();

// Chat with Bhumi Sahayak AI Assistant
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, history = [], persona = 'citizen', apiKey, model, temperature } = req.body ?? {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return fail(res, 'Please provide a valid question or message.', 400);
    }

    const response = await AiAssistantService.answer(
      message,
      history,
      persona,
      apiKey,
      model,
      temperature
    );
    return ok(res, response);
  } catch (error: any) {
    console.error('Error in /api/assistant/chat:', error);
    return fail(res, 'Failed to process assistant request.', 500);
  }
});

// Scan available models from API key or default catalog
router.post('/models', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body ?? {};
    const result = await AiAssistantService.scanModels(apiKey);
    return ok(res, result);
  } catch (error: any) {
    console.error('Error in /api/assistant/models:', error);
    return fail(res, 'Failed to scan models.', 500);
  }
});

// Initial suggestions and capabilities
router.get('/suggestions', (req: Request, res: Response) => {
  const lang = (req.query.lang as string) === 'bn' ? 'bn' : 'en';

  if (lang === 'bn') {
    return ok(res, {
      title: 'ভূমি সহায়ক — ডিজিটাল ভূমি সহকারী',
      welcome:
        'স্বাগতম! আমি বাংলাদেশ ভূমি প্ল্যাটফর্মের এআই সহকারী। ই-নামজারি, ফারায়েয বণ্টন, ভূমি উন্নয়ন কর বা জমি সংক্রান্ত যেকোনো আইনি প্রশ্ন করতে পারেন।',
      prompts: [
        'ই-নামজারি করতে কি কি কাগজপত্র লাগে এবং সরকারি ফি কত?',
        'ফারায়েয ক্যালকুলেটরে ইসলামিক নিয়মে সম্পত্তি বণ্টন কিভাবে হয়?',
        'ভূমি উন্নয়ন কর (LD Tax) মওকুফের ২৫ বিঘা নিয়ম কি?',
        'সিএস, এসএ, আরএস ও বিএস খতিয়ানের পার্থক্য কি?',
        'জমি কেনার আগে বায়া দলিল ও আদালতের নিষেধাজ্ঞা কিভাবে যাচাই করব?',
      ],
    });
  }

  return ok(res, {
    title: 'Bhumi Sahayak — Cadastral AI Assistant',
    welcome:
      'Welcome to Bhumi Sahayak. Ask me any question regarding e-Mutation procedures, Faraiz inheritance calculation, Land Development Tax, historical Khatians, or pre-purchase title due diligence.',
    prompts: [
      'What documents and official fees are required for e-Mutation?',
      'How does the Faraiz calculator distribute estate under Hanafi law?',
      'What is the 25-Bigha agricultural land tax exemption policy?',
      'What are the key differences between CS, SA, RS, and BS Khatians?',
      'What pre-purchase checks should I perform against Baya deeds and court stay orders?',
    ],
  });
});

export default router;
