export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ScannedModel {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
}

export const DEFAULT_MODELS: ScannedModel[] = [
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: 'Fast, efficient, and versatile model optimized for real-time land queries.',
    isDefault: true,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Next-generation ultra-fast multimodal model with advanced reasoning.',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    description: 'Deep complex reasoning for intricate land title disputes and legal interpretations.',
  },
  {
    id: 'gemini-1.5-flash-8b',
    name: 'Gemini 1.5 Flash-8B',
    description: 'Lightweight high-throughput model for high-frequency queries.',
  },
  {
    id: 'sovereign-offline',
    name: 'Sovereign Land Engine (Offline)',
    description: 'Deterministic built-in legal knowledge engine (zero external API calls).',
  },
];

export interface AssistantResponse {
  reply: string;
  language: 'bn' | 'en';
  category: 'MUTATION' | 'FARAIZ' | 'TAX' | 'SURVEY_RECORD' | 'DUE_DILIGENCE' | 'TERMINOLOGY' | 'GENERAL';
  isGeminiPowered?: boolean;
  modelUsed?: string;
  suggestedActions?: Array<{
    label: string;
    action: 'OPEN_FARAIZ' | 'OPEN_TAX' | 'OPEN_MUTATION' | 'OPEN_LINEAGE' | 'OPEN_MAP';
    params?: Record<string, any>;
  }>;
  quickFollowUps: string[];
  statutoryReferences?: string[];
}

export class AiAssistantService {
  /**
   * Sanitizes all output text to strictly ensure no '#' or '*' characters
   * and no emojis exist in any chat output.
   */
  public static cleanText(text: string): string {
    if (!text) return '';
    return text
      .replace(/[#*]/g, '') // Strictly strip all # and *
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // Strip emojis
      .replace(/\n{3,}/g, '\n\n') // Collapse excessive linebreaks
      .trim();
  }

  private static containsAny(text: string, keywords: string[]): boolean {
    const lower = text.toLowerCase();
    return keywords.some((k) => lower.includes(k.toLowerCase()));
  }

  /**
   * Scans live Google Gemini models available for the provided API key.
   */
  public static async scanModels(apiKey?: string): Promise<{
    models: ScannedModel[];
    source: 'LIVE_SCAN' | 'DEFAULT_CATALOG';
    valid: boolean;
  }> {
    const key = apiKey?.trim() || process.env.GEMINI_API_KEY || '';
    if (!key) {
      return { models: DEFAULT_MODELS, source: 'DEFAULT_CATALOG', valid: false };
    }

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`
      );

      if (!res.ok) {
        return { models: DEFAULT_MODELS, source: 'DEFAULT_CATALOG', valid: false };
      }

      const data = await res.json();
      const rawModels: any[] = data?.models || [];

      const generateModels: ScannedModel[] = rawModels
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => {
          const id = m.name.replace(/^models\//, '');
          return {
            id,
            name: m.displayName || id,
            description: m.description || '',
            isDefault: id === 'gemini-1.5-flash',
          };
        });

      if (generateModels.length > 0) {
        generateModels.sort((a, b) => {
          if (a.id === 'gemini-1.5-flash') return -1;
          if (b.id === 'gemini-1.5-flash') return 1;
          if (a.id === 'gemini-2.0-flash') return -1;
          if (b.id === 'gemini-2.0-flash') return 1;
          return a.name.localeCompare(b.name);
        });

        generateModels.push({
          id: 'sovereign-offline',
          name: 'Sovereign Land Engine (Offline)',
          description: 'Deterministic built-in legal knowledge engine (zero external API calls).',
          isDefault: false,
        });

        return { models: generateModels, source: 'LIVE_SCAN', valid: true };
      }

      return { models: DEFAULT_MODELS, source: 'DEFAULT_CATALOG', valid: true };
    } catch (err) {
      console.warn('Failed to scan Gemini models from API:', err);
      return { models: DEFAULT_MODELS, source: 'DEFAULT_CATALOG', valid: false };
    }
  }

  /**
   * Calls Google Gemini Generative API with selected model and temperature.
   */
  private static async callGemini(
    query: string,
    history: ChatMessage[],
    apiKey: string,
    modelName: string = 'gemini-1.5-flash',
    temperature: number = 0.2
  ): Promise<string | null> {
    try {
      const selectedModel = (modelName || 'gemini-1.5-flash').trim();
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        selectedModel
      )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

      const formattedContents = history.slice(-6).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      formattedContents.push({
        role: 'user',
        parts: [{ text: query }],
      });

      const systemPrompt = `You are Bhumi Sahayak (ভূমি সহায়ক), the authoritative land legal and cadastral assistant for the Bangladesh Ministry of Land (ভূমি মন্ত্রণালয়).
STRICT RULES:
1. UNDER NO CIRCUMSTANCES USE THE '#' CHARACTER IN YOUR OUTPUT (NO MARKDOWN HEADERS LIKE #, ##, ###). Use clean UPPERCASE titles or bold words followed by colons instead.
2. UNDER NO CIRCUMSTANCES USE THE '*' CHARACTER (NO ASTERISKS, NO **BOLD**, NO *ITALIC*).
3. UNDER NO CIRCUMSTANCES USE ANY EMOJIS.
4. For bullet lists, use standard hyphens (-) or numbers (1., 2., 3.).
5. Provide precise, authoritative guidance grounded in Bangladesh land laws:
   - State Acquisition and Tenancy Act 1950 (Section 143/144 for Mutation, Section 117 for Subdivision)
   - Land Development Tax Act 2023 (25 Bigha agricultural exemption)
   - Registration Act 1908 & Transfer of Property Act 1882 (Section 52 Lis Pendens, Section 54 Sale)
   - Muslim Personal Law (Hanafi Faraiz for Zawil-Furud and Asaba)
   - Dayabhaga Hindu Succession law
   - Cadastral survey records: CS (1888-1940), SA (1956-1962), RS, and BS / City Survey.
6. Answer in the same language as the user query (Bengali or English). Keep answers practical, structured, and legally sound.`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: formattedContents,
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          generationConfig: {
            temperature: Math.min(1.0, Math.max(0.0, Number(temperature) || 0.2)),
            maxOutputTokens: 1200,
          },
        }),
      });

      if (!response.ok) {
        console.warn(`Gemini API request (${selectedModel}) failed with status: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return null;

      return this.cleanText(rawText);
    } catch (err) {
      console.warn('Gemini API call failed, falling back to sovereign legal engine:', err);
      return null;
    }
  }

  public static async answer(
    query: string,
    history: ChatMessage[] = [],
    persona: string = 'citizen',
    apiKey?: string,
    model?: string,
    temperature?: number
  ): Promise<AssistantResponse> {
    const q = (query || '').trim();
    const isBengali = /[\u0980-\u09FF]/.test(q);
    const activeApiKey = apiKey?.trim() || process.env.GEMINI_API_KEY || '';
    const selectedModel = model?.trim() || 'gemini-1.5-flash';

    // If an API key is provided and model is not 'sovereign-offline', attempt Gemini generation
    if (activeApiKey && selectedModel !== 'sovereign-offline') {
      const geminiReply = await this.callGemini(q, history, activeApiKey, selectedModel, temperature);
      if (geminiReply) {
        let category: AssistantResponse['category'] = 'GENERAL';
        let suggestedActions: AssistantResponse['suggestedActions'] = [];

        if (this.containsAny(q, ['faraiz', 'inheritance', 'ফারায়েয', 'ওয়ারিশ', 'বণ্টন'])) {
          category = 'FARAIZ';
          suggestedActions = [{ label: isBengali ? 'ফারায়েয ক্যালকুলেটর খুলুন' : 'Open Faraiz Calculator', action: 'OPEN_FARAIZ' }];
        } else if (this.containsAny(q, ['mutation', 'namjari', 'খারিজ', 'নামজারি'])) {
          category = 'MUTATION';
          suggestedActions = [{ label: isBengali ? 'ই-নামজারি আবেদন' : 'Start Mutation Flow', action: 'OPEN_MUTATION' }];
        } else if (this.containsAny(q, ['tax', 'dakhila', 'কর', 'খাজনা', 'দাখিলা'])) {
          category = 'TAX';
          suggestedActions = [{ label: isBengali ? 'ভূমি উন্নয়ন কর হিসাব' : 'Estimate Land Tax', action: 'OPEN_TAX' }];
        } else if (this.containsAny(q, ['lineage', 'chain', 'বায়া', 'খতিয়ান', 'মালিকানা'])) {
          category = 'SURVEY_RECORD';
          suggestedActions = [{ label: isBengali ? 'মালিকানা চেইন পরিদর্শন' : 'View Chain of Title', action: 'OPEN_LINEAGE' }];
        }

        return {
          reply: geminiReply,
          language: isBengali ? 'bn' : 'en',
          category,
          isGeminiPowered: true,
          modelUsed: selectedModel,
          suggestedActions,
          quickFollowUps: isBengali
            ? ['ই-নামজারি ফি কত টাকা?', 'ফারায়েজে স্ত্রীর অংশ কত?', 'বায়া দলিল বলতে কি বোঝায়?']
            : ['What are the official mutation fees?', 'How does Faraiz distribute shares?', 'What is a Baya parent deed?'],
          statutoryReferences: [
            'State Acquisition and Tenancy Act 1950',
            'Land Development Tax Act 2023',
            'Registration Act 1908',
          ],
        };
      }
    }

    // Sovereign Built-in Legal Engine (Guaranteed zero # and zero *)
    // 1. MUTATION & NAMJARI (ই-নামজারি ও জমাভাগ)
    if (
      this.containsAny(q, [
        'mutation',
        'namjari',
        'khariz',
        'নামজারি',
        'খারিজ',
        'জমাভাগ',
        'আবেদন',
        'ফি',
        'খরচ',
        'দলিল থেকে খতিয়ান',
      ])
    ) {
      if (isBengali) {
        return {
          language: 'bn',
          category: 'MUTATION',
          reply: this.cleanText(`ই-নামজারি (Mutation) নির্দেশিকা ও আইনি প্রক্রিয়া

আইনি ভিত্তি: রাষ্ট্রীয় অধিগ্রহণ ও প্রজাস্বত্ব আইন ১৯৫০ (State Acquisition and Tenancy Act 1950) এর ১৪৩ ও ১৪৪ ধারা।

প্রয়োজনীয় কাগজপত্র:
1. মূল সাব-রেজিস্ট্রি দলিল অথবা সহি মোহরযুক্ত নকল (Certified Copy)।
2. সংশ্লিষ্ট জোত/খতিয়ানের সর্বশেষ বায়া খতিয়ান ও পর্চা।
3. হালনাগাদ ভূমি উন্নয়ন কর (LDTax) পরিশোধের দাখিলা।
4. ওয়ারিশসূত্রে প্রাপ্ত হলে স্থানীয় ইউপি চেয়ারম্যান বা ওয়ার্ড কাউন্সিলর প্রদত্ত ওয়ারিশান সনদ।
5. আবেদনকারীর জাতীয় পরিচয়পত্র (NID) ও পাসপোর্ট সাইজের ছবি।

সরকারি নির্ধারিত ফি (সর্বমোট ১,১৭০ টাকা):
- কোর্ট ফি: ২০ টাকা
- নোটিশ জারি ফি: ৫০ টাকা
- রেকর্ড সংশোধন ফি: ১,০০০ টাকা
- নতুন খতিয়ান সরবরাহ ফি: ১০০ টাকা

প্রক্রিয়াকরণের ৪টি ধাপ:
- ধাপ ১: সহকারী কমিশনার (ভূমি) এর কার্যালয়ে অনলাইন আবেদন ও ইউনিয়ন ভূমি সহকারী কর্মকর্তার (ULAO) প্রতিবেদন।
- ধাপ ২: সার্ভেয়ার বা কানুনগো কর্তৃক সরেজমিনে নকশা ও দখল যাচাই।
- ধাপ ৩: সহকারী কমিশনার (ভূমি) কর্তৃক উভয় পক্ষের শুনানি ও আদেশ প্রদান।
- ধাপ ৪: ডিসিআর (DCR) ফি পরিশোধ এবং অনলাইনে স্বাক্ষরিত খতিয়ান ডাউনলোড।`),
          suggestedActions: [
            { label: 'ই-নামজারি আবেদন শুরু করুন', action: 'OPEN_MUTATION' },
            { label: 'মালিকানা চেইন পরীক্ষা করুন', action: 'OPEN_LINEAGE' },
          ],
          quickFollowUps: [
            'নামজারি ফি কত টাকা?',
            'নামজারি নামঞ্জুর হলে আপিল কিভাবে করবেন?',
            'বায়া দলিল বলতে কি বোঝায়?',
          ],
          statutoryReferences: [
            'State Acquisition and Tenancy Act 1950, Sections 143 and 144',
            'Land Management Manual 1990',
            'Citizen Charter, Ministry of Land',
          ],
        };
      } else {
        return {
          language: 'en',
          category: 'MUTATION',
          reply: this.cleanText(`E-MUTATION (NAMJARI) LEGAL GUIDELINES AND WORKFLOW

Statutory Basis: Sections 143 and 144 of the State Acquisition and Tenancy Act 1950.

Mandatory Prerequisites:
1. Registered Title Deed (Dalil) or certified copy from Sub-Registry.
2. Chain of previous Khatians (Baya Khatian) establishing unbroken ownership.
3. Up-to-date Land Development Tax payment receipt (Dakhila).
4. Legal Heirship / Succession Certificate (if acquired via inheritance).
5. National ID (NID) and recent photograph of applicant.

Official Statutory Fees (Total BDT 1,170):
- Application Court Fee: BDT 20
- Notice Service Fee: BDT 50
- Record Correction Fee: BDT 1,000
- Mutation Khatian Issuance Fee: BDT 100

Judicial Stages:
- Stage 1: Digital filing and verification by Union Land Assistant Officer (ULAO).
- Stage 2: Physical inspection and field report by Kanungo / Surveyor.
- Stage 3: Judicial hearing conducted by Assistant Commissioner (Land).
- Stage 4: DCR fee settlement and issuance of digitally signed Smart Khatian.`),
          suggestedActions: [
            { label: 'Start Mutation Wizard', action: 'OPEN_MUTATION' },
            { label: 'Inspect Title Lineage', action: 'OPEN_LINEAGE' },
          ],
          quickFollowUps: [
            'What happens if a mutation application is rejected?',
            'What is the difference between Namjari and Jamabhag?',
            'How to check mutation case hearing status?',
          ],
          statutoryReferences: [
            'State Acquisition and Tenancy Act 1950 (Sections 143-144)',
            'Land Management Manual 1990',
            'Circular on Digital e-Mutation, Ministry of Land 2021',
          ],
        };
      }
    }

    // 2. FARAIZ & INHERITANCE (ফারায়েয ও উত্তরাধিকার)
    if (
      this.containsAny(q, [
        'faraiz',
        'inheritance',
        'succession',
        'heir',
        'farayej',
        'ফারায়েজ',
        'ফারায়েয',
        'উত্তরাধিকার',
        'ওয়ারিশ',
        'বণ্টন',
        'সম্পত্তি বণ্টন',
        'হিস্যা',
      ])
    ) {
      if (isBengali) {
        return {
          language: 'bn',
          category: 'FARAIZ',
          reply: this.cleanText(`ফারায়েয ও উত্তরাধিকারী বণ্টন বিধি

ইসলামিক ফারায়েয নীতিমালা (হানাফী আইন):
1. জবিল ফুরুজ (Quranic Sharers): নির্দিষ্ট অংশীদার (যেমন: স্ত্রী, স্বামী, পিতা, মাতা, কন্যা)।
   - মৃত ব্যক্তির সন্তান থাকলে স্ত্রী পাবেন ১/৮ অংশ; সন্তান না থাকলে ১/৪ অংশ।
   - মৃত ব্যক্তির সন্তান থাকলে মাতা ও পিতা প্রত্যেকের নিশ্চিত অংশ ১/৬।
2. আসাবা (Residuaries): অবশিষ্ট অংশীদার (যেমন: পুত্র ও কন্যা)।
   - পুত্র ও কন্যার উপস্থিতিতে অবশিষ্ট অংশ ২:১ অনুপাতে বণ্টিত হয় (পুত্রের অংশ কন্যার দ্বিগুণ)।
3. হজব (Exclusion): নিকটবর্তী ওয়ারিশের উপস্থিতিতে দূরবর্তী ওয়ারিশদের অধিকার রহিত হওয়া।

হিন্দু দায়ভাগ আইন (Dayabhaga Succession):
- অবিভক্ত পিণ্ডদান যোগ্যতার ভিত্তিতে ক্রমিক অধিকার (পুত্র -> পৌত্র -> প্রপৌত্র -> বিধবা স্ত্রী -> অবিবাহিত কন্যা -> পুত্রবতী কন্যা)।

আমাদের সিস্টেমে স্বয়ংক্রিয় ক্যাডাস্ট্রাল নকশা বণ্টন চিত্রসহ ফারায়েয ক্যালকুলেটর অন্তর্ভুক্ত রয়েছে।`),
          suggestedActions: [
            { label: 'ফারায়েয ক্যালকুলেটর চালু করুন', action: 'OPEN_FARAIZ' },
          ],
          quickFollowUps: [
            'মৃত ব্যক্তির একমাত্র কন্যা থাকলে সম্পত্তির বণ্টন কেমন হয়?',
            'স্ত্রী ও মাতার সুনির্দিষ্ট অংশ কত?',
            'ফারায়েয বণ্টনের পর নামজারি করার নিয়ম কি?',
          ],
          statutoryReferences: [
            'Muslim Personal Law (Shariat) Application Act 1937',
            'Muslim Family Laws Ordinance 1961 (Section 4 - Orphaned Grandchildren)',
            'Hindu Law of Inheritance (Amendment) Act 1929',
          ],
        };
      } else {
        return {
          language: 'en',
          category: 'FARAIZ',
          reply: this.cleanText(`FARAIZ AND INHERITANCE SUCCESSION RULES

Hanafi Islamic Jurisprudence:
1. Quranic Sharers (Zawil-Furud): Fixed statutory portions.
   - Wife receives 1/8 if children exist; 1/4 if no children.
   - Mother and Father each receive 1/6 when children survive.
2. Residuaries (Asaba): Inherit remaining estate.
   - Surviving sons and daughters share remaining balance in a 2:1 ratio (sons receive double the daughter's share).
3. Exclusion (Hajb): Closer relatives exclude remote agnates (e.g. sons exclude brothers/nephews).

Dayabhaga Hindu Succession:
- Sequential agnatic hierarchy based on Pinda efficacy (Sons -> Grandsons -> Great-grandsons -> Widow life interest -> Daughters).

You can compute exact decimal acreages and cadastral partition diagrams using our built-in Faraiz engine.`),
          suggestedActions: [
            { label: 'Open Faraiz Calculator', action: 'OPEN_FARAIZ' },
          ],
          quickFollowUps: [
            'How is estate divided if there is only one surviving daughter?',
            'What is the share of mother and wife under Hanafi law?',
            'How to mutate inherited land into individual Khatians?',
          ],
          statutoryReferences: [
            'Muslim Personal Law (Shariat) Application Act 1937',
            'Muslim Family Laws Ordinance 1961 (Section 4)',
            'Dayabhaga School of Hindu Law',
          ],
        };
      }
    }

    // 3. LAND DEVELOPMENT TAX / LD TAX (ভূমি উন্নয়ন কর)
    if (
      this.containsAny(q, [
        'tax',
        'ld tax',
        'dakhila',
        'কর',
        'খাজনা',
        'দাখিলা',
        'ভূমি উন্নয়ন কর',
        'বকেয়া',
      ])
    ) {
      if (isBengali) {
        return {
          language: 'bn',
          category: 'TAX',
          reply: this.cleanText(`ভূমি উন্নয়ন কর (LD Tax) সংক্রান্ত আইনি বিধিমালা

গুরুত্বপূর্ণ বিধিসমূহ:
1. কৃষি জমি মওকুফ সীমা: ২৫ বিঘা (৮.২৫ একর) পর্যন্ত কৃষি জমির ক্ষেত্রে ভূমি উন্নয়ন কর মওকুফ। তবে শূন্য কর নির্ধারণের পর আনুষ্ঠানিকভাবে সরকারি দাখিলা সংগ্রহ করা বাধ্যতামূলক।
2. আবাসিক ও বাণিজ্যিক হার: ভূমি উন্নয়ন কর অধ্যাদেশ ১৯৭৬ এবং ভূমি উন্নয়ন কর আইন ২০২৩ অনুযায়ী মৌজার গ্রেড এবং সিটি কর্পোরেশন/পৌরসভার ভৌগোলিক অবস্থানের ভিত্তিতে বর্গফুট বা শতক প্রতি নির্ধারিত হয়।
3. অনলাইন দাখিলা: এখন সরাসরি ডিজিটাল পেমেন্ট গেটওয়ের মাধ্যমে বিকাশ, নগদ, বা রকেট ব্যবহার করে ই-দাখিলা গ্রহণ করা যায়।`),
          suggestedActions: [
            { label: 'ভূমি উন্নয়ন কর হিসাব ও পরিশোধ', action: 'OPEN_TAX' },
          ],
          quickFollowUps: [
            'কৃষি জমির ২৫ বিঘা কর মওকুফের নিয়ম কি?',
            'অনলাইনে দাখিলা কিভাবে যাচাই করবেন?',
            'বকেয়া কর পরিশোধ না করলে কি সমস্যা হতে পারে?',
          ],
          statutoryReferences: [
            'Land Development Tax Act 2023',
            'Land Development Tax Ordinance 1976',
            'Public Demands Recovery Act 1913',
          ],
        };
      } else {
        return {
          language: 'en',
          category: 'TAX',
          reply: this.cleanText(`LAND DEVELOPMENT TAX (LD TAX) REGULATIONS

Statutory Highlights:
1. Agricultural Exemption: Agricultural holdings up to 25 Bighas (8.25 acres) are exempt from annual LD tax. However, collecting an official zero-demand clearance Dakhila is legally mandatory.
2. Residential and Commercial Valuation: Computed per decimal/square-foot according to mouza classification, municipality tier, and urban master plans under the Land Development Tax Act 2023.
3. Digital Clearance: Instant e-Dakhila download with QR cryptographic verification upon electronic settlement via Sonali Bank, bKash, or Nagad.`),
          suggestedActions: [
            { label: 'Estimate and Pay Land Tax', action: 'OPEN_TAX' },
          ],
          quickFollowUps: [
            'What is the 25-bigha agricultural tax exemption rule?',
            'How to verify an existing Dakhila QR code?',
            'What legal penalties apply for unpaid tax arrears?',
          ],
          statutoryReferences: [
            'Land Development Tax Act 2023',
            'Land Development Tax Ordinance 1976',
            'Public Demands Recovery Act 1913 (Section 7 Certificates)',
          ],
        };
      }
    }

    // 4. SURVEY RECORDS & KHATIAN (সিএস, এসএ, আরএস, বিএস খতিয়ান)
    if (
      this.containsAny(q, [
        'khatian',
        'porcha',
        'cs',
        'sa',
        'rs',
        'bs',
        'survey',
        'খতিয়ান',
        'পর্চা',
        'সিএস',
        'এসএ',
        'আরএস',
        'বিএস',
        'সিটি জরিপ',
        'জরিপ',
      ])
    ) {
      if (isBengali) {
        return {
          language: 'bn',
          category: 'SURVEY_RECORD',
          reply: this.cleanText(`ঐতিহাসিক ভূমি জরিপ ও খতিয়ানের পরিচিতি

1. সিএস জরিপ (Cadastral Survey, ১৮৮৮-১৯৪০):
- ব্রিটিশ ভারতে প্রস্তুতকৃত প্রথম বিজ্ঞানসম্মত কিস্তোয়ার জরিপ ও খতিয়ান। অত্যন্ত নির্ভরযোগ্য ও আইনি প্রামাণ্য ভিত্তি।

2. এসএ জরিপ (State Acquisition Survey, ১৯৫৬-১৯৬২):
- জমিদারি প্রথা বিলুপ্তির পর দ্রুতগতিতে প্রস্তুতকৃত রেকর্ড। মাঠপর্যায়ে যথাযথ যাচাই না হওয়ায় এতে কিছু ভুলভ্রান্তি পরিলক্ষিত হয়।

3. আরএস জরিপ (Revisional Survey):
- এসএ রেকর্ডের ভুলভ্রান্তি সংশোধনকল্পে পরিচালিত আধুনিক জরিপ। গ্রামীণ বাংলাদেশে এটি অন্যতম প্রামাণ্য রেকর্ড।

4. বিএস / সিটি জরিপ (Bangladesh Survey, ১৯৯৮ হতে চলমান):
- আধুনিক থিওডোলাইট ও ডিজিটাল পদ্ধতিতে প্রস্তুতকৃত সর্বশেষ চূড়ান্ত খতিয়ান ও দাগসূচি।

গুরুত্বপূর্ণ পরামর্শ: জমি ক্রয়ের পূর্বে সিএস হতে বিএস পর্যন্ত নিরবচ্ছিন্ন মালিকানা চেইন (Chain of Title) যাচাই আবশ্যক।`),
          suggestedActions: [
            { label: 'মালিকানা চেইন পরিদর্শন করুন', action: 'OPEN_LINEAGE' },
            { label: 'ক্যাডাস্ট্রাল নকশা দেখুন', action: 'OPEN_MAP' },
          ],
          quickFollowUps: [
            'খতিয়ান ও দলিলের মধ্যে অমিল থাকলে কি করণীয়?',
            'বায়া দলিল ছাড়া কি নামজারি সম্ভব?',
            'অনলাইনে সার্টিফাইড পর্চা উত্তোলনের নিয়ম কি?',
          ],
          statutoryReferences: [
            'Bengal Tenancy Act 1885',
            'State Acquisition and Tenancy Act 1950 (Section 117)',
            'Survey Act 1875',
          ],
        };
      } else {
        return {
          language: 'en',
          category: 'SURVEY_RECORD',
          reply: this.cleanText(`CADASTRAL SURVEYS AND RECORD OF RIGHTS (KHATIAN)

1. CS Survey (Cadastral Survey, 1888-1940):
- The original British benchmark survey. Unsurpassed evidentiary weight in civil title suits.

2. SA Survey (State Acquisition Survey, 1956-1962):
- Executed rapidly after the abolition of Zamindari tenures. Often subject to clerical and ownership misattributions.

3. RS Survey (Revisional Survey):
- Rectified SA discrepancies with comprehensive field boundary verifications. Highly authoritative across rural Bangladesh.

4. BS / City Survey (Bangladesh Survey, 1998-Present):
- The active, computerized cadastral record with modern geodetic polygon boundaries.

Crucial Prerequisite: Buyers must verify an unbroken chain connecting the original CS tenure holder down to the vendor's present BS Khatian.`),
          suggestedActions: [
            { label: 'View Chain of Title', action: 'OPEN_LINEAGE' },
            { label: 'Open Cadastral Map', action: 'OPEN_MAP' },
          ],
          quickFollowUps: [
            'How to resolve discrepancies between Deed and Khatian?',
            'Can land be mutated without intermediate Baya deeds?',
            'How to obtain a certified Smart Porcha online?',
          ],
          statutoryReferences: [
            'Bengal Tenancy Act 1885',
            'State Acquisition and Tenancy Act 1950',
            'Survey Act 1875',
          ],
        };
      }
    }

    // 5. BUYER DUE DILIGENCE & FORGERY PREVENTION (জমি ক্রয়ের সতর্কতা)
    if (
      this.containsAny(q, [
        'buy',
        'sell',
        'fraud',
        'caution',
        'due diligence',
        'forgery',
        'dispute',
        'ক্রয়',
        'বিক্রয়',
        'সতর্কতা',
        'জাল দলিল',
        'মামলা',
        'দখল',
      ])
    ) {
      if (isBengali) {
        return {
          language: 'bn',
          category: 'DUE_DILIGENCE',
          reply: this.cleanText(`জমি ক্রয়ের পূর্বশর্ত ও আইনি সতর্কতা তালিকা

জমি কেনার আগে নিচের ৭টি বিষয় কঠোরভাবে যাচাই করুন:
1. মালিকানা চেইন (২৫ বছরের বায়া দলিল): বিক্রেতা কীভাবে মালিক হলেন (ক্রয়, হেবা, দান বা ওয়ারিশ) তার মূল দলিল ও পূর্ববর্তী ভায়া দলিলের ধারাবাহিকতা।
2. সর্বশেষ নামজারি ও জমাভাগ: বিক্রেতার নামে সর্বশেষ বিএস/আরএস খতিয়ান থেকে নামজারি সম্পন্ন এবং নিজস্ব জোত সৃষ্টি হয়েছে কিনা।
3. হালনাগাদ দাখিলা: চলতি বাংলা সনের ভূমি উন্নয়ন কর পরিশোধের প্রমাণ।
4. সরেজমিন সীমানা ও দখল: নকশার দাগের সাথে বাস্তব ভূমির সীমানা, পিলার এবং বিক্রেতার বাস্তব দখল যাচাই।
5. আদালতের নিষেধাজ্ঞা ও লিস পেনডেন্স: সাব-জজ আদালত বা সহকারী জজ আদালতে দেওয়ানি স্বত্ব মামলা বা অস্থায়ী নিষেধাজ্ঞা আছে কিনা।
6. সরকারি খাস বা অর্পিত সম্পত্তি যাচাই: জমিটি ক তালিকাভুক্ত অর্পিত সম্পত্তি, খাস বা বনবিভাগের কিনা।
7. ভূমি লক (Land Lock): আমাদের প্ল্যাটফর্মের ল্যান্ড লক ও সতর্কীকরণ রাডার দ্বারা স্থিতি যাচাই করুন।`),
          suggestedActions: [
            { label: 'মালিকানা চেইন ও ঝুঁকি নিরীক্ষা', action: 'OPEN_LINEAGE' },
            { label: 'ক্যাডাস্ট্রাল ম্যাপে দাগ যাচাই', action: 'OPEN_MAP' },
          ],
          quickFollowUps: [
            'বায়া দলিলের গুরুত্ব কি?',
            'সরকারি খাস জমি চেনার উপায় কি?',
            'সাব-রেজিস্ট্রি অফিসে এনইসি (NEC) উত্তোলনের নিয়ম কি?',
          ],
          statutoryReferences: [
            'Transfer of Property Act 1882 (Section 52 - Lis Pendens, Section 54 - Sale)',
            'Registration Act 1908 (Section 52A - Mandatory Khatian for Transfer)',
            'Specific Relief Act 1877',
          ],
        };
      } else {
        return {
          language: 'en',
          category: 'DUE_DILIGENCE',
          reply: this.cleanText(`LAND PURCHASE DUE DILIGENCE AND PRE-ACQUISITION CHECKLIST

Verify these 7 legal conditions before executing any purchase agreement:
1. Chain of Title (25 Years): Validate unbroken linkage through parent deeds (Baya Dalil), gift deeds (Heba), or inheritance deeds.
2. Current Mutation Khatian: Ensure vendor holds an individual mutated Khatian with a distinct revenue holding (Jot).
3. Up-to-Date LD Tax Dakhila: Verify current year tax clearance receipt.
4. Physical Demarcation and Possession: Cross-check real-world ground boundaries, boundary pillars, and actual physical possession.
5. Litigation and Injunction Check: Inspect Senior Assistant Judge Court records for active title suits (Lis Pendens) or stay orders.
6. Vested and Khas Exclusion: Ensure parcel is free from Government Khas, Forest, or Abandoned/Vested property schedules.
7. Land-Lock System: Utilize the platform's cryptographic Land-Lock mechanism to prevent unauthorized encumbrances.`),
          suggestedActions: [
            { label: 'Audit Chain of Title', action: 'OPEN_LINEAGE' },
            { label: 'Inspect Cadastral Boundary', action: 'OPEN_MAP' },
          ],
          quickFollowUps: [
            'What is the legal importance of Baya deeds?',
            'How to obtain a Non-Encumbrance Certificate (NEC)?',
            'How does Lis Pendens affect purchased land?',
          ],
          statutoryReferences: [
            'Transfer of Property Act 1882 (Section 52 and 54)',
            'Registration Act 1908 (Section 52A)',
            'State Acquisition and Tenancy Act 1950',
          ],
        };
      }
    }

    // 6. LAND TERMINOLOGY EXPLANATIONS (ভূমি পরিভাষা)
    if (
      this.containsAny(q, [
        'meaning',
        'definition',
        'what is',
        'term',
        'দাগ',
        'মৌজা',
        'জোত',
        'পর্চা',
        'খতিয়ান কি',
        'ডিসিআর',
        'বায়া দলিল',
        'অংশ',
      ])
    ) {
      if (isBengali) {
        return {
          language: 'bn',
          category: 'TERMINOLOGY',
          reply: this.cleanText(`বহুল ব্যবহৃত ভূমি পরিভাষার বিশদ অর্থ

- মৌজা (Mouza): ভূমি রাজস্ব ও জরিপের প্রাথমিক ভৌগোলিক এলাকা বা সীমানা ইউনিট (একটি বা একাধিক গ্রাম নিয়ে গঠিত)।
- দাগ নম্বর (Plot / Dag Number): মৌজা নকশার মধ্যে প্রতিটি সুনির্দিষ্ট জমি বা প্লটের চিহ্নিতকরণ সংখ্যা।
- খতিয়ান বা পর্চা (Khatian / Porcha): ভূমির মালিকানা, স্বত্ব, অংশ, দাগ নম্বর ও রাজস্ব নির্ধারণ সংক্রান্ত সরকারি রেকর্ড।
- জোত (Jot): একজন বা একাধিক প্রজার নামে ভূমি রাজস্ব আদায়ের নিমিত্তে ধার্যকৃত নির্দিষ্ট খতিয়ান বা একাউন্ট।
- বায়া দলিল (Baya Dalil): মূল দলিলটির পূর্ববর্তী যে দলিলের মাধ্যমে বিক্রেতা মালিকানা অর্জন করেছিলেন (Parent Deed)।
- ডিসিআর (DCR - Duplicate Carbon Receipt): সরকারি নামজারি ফি বা বকেয়া আদায়ের পর প্রদত্ত কার্বন রসিদ।
- হিস্যা (Share): কোনো দাগে একাধিক অংশীদারের মোট ১৬ আনা বা ১.০০০ সহস্রাংশের মধ্যে নির্দিষ্ট আনুপাতিক অংশ।`),
          suggestedActions: [
            { label: 'ক্যাডাস্ট্রাল ম্যাপ দেখুন', action: 'OPEN_MAP' },
            { label: 'ফারায়েয হিস্যা হিসাব', action: 'OPEN_FARAIZ' },
          ],
          quickFollowUps: [
            '১৬ আনা হিস্যা হিসাব কিভাবে বের করবেন?',
            'খতিয়ান সংশোধন করার নিয়ম কি?',
            'মৌজা ম্যাপ সংগ্রহ করার উপায় কি?',
          ],
          statutoryReferences: [
            'Land Management Manual 1990',
            'Survey Act 1875',
          ],
        };
      } else {
        return {
          language: 'en',
          category: 'TERMINOLOGY',
          reply: this.cleanText(`ESSENTIAL BANGLADESH CADASTRAL TERMINOLOGY

- Mouza: The fundamental cadastral revenue survey jurisdiction unit (a surveyed village unit).
- Dag Number: Specific unique cadastral plot boundary identifier drawn on the mouza map.
- Khatian (Porcha): Record of Rights (RoR) enumerating owners, fractional shares, land class, and tax demand.
- Jot: An individual revenue holding or tenant ledger account for rent collection.
- Baya Dalil: The prior parent deed through which the current vendor acquired title.
- DCR (Duplicate Carbon Receipt): Official receipt issued upon payment of government mutation or settlement fees.
- Hissya: The fractional share owned by a co-sharer, historically calculated out of 16 Annas or 1.000 parts.`),
          suggestedActions: [
            { label: 'Explore Cadastral Map', action: 'OPEN_MAP' },
            { label: 'Compute Faraiz Shares', action: 'OPEN_FARAIZ' },
          ],
          quickFollowUps: [
            'How to convert traditional Anna shares to decimals?',
            'What is the procedure for Khatian rectification?',
            'How to order certified Mouza sheets?',
          ],
          statutoryReferences: [
            'Land Management Manual 1990',
            'Survey and Settlement Manual 1935',
          ],
        };
      }
    }

    // 7. DEFAULT GENERAL ASSISTANCE
    if (isBengali) {
      return {
        language: 'bn',
        category: 'GENERAL',
        reply: this.cleanText(`ভূমি সহায়ক — স্মার্ট ভূমি ব্যবস্থাপনা সহায়িকা

আমি বাংলাদেশ ডিজিটাল ভূমি ব্যবস্থাপনা প্ল্যাটফর্মের স্বত্ব ও আইনি সহায়ক। আপনি নিম্নোক্ত বিষয়ে প্রশ্ন করতে পারেন:

1. ই-নামজারি (e-Mutation): আবেদন প্রক্রিয়া, প্রয়োজনীয় কাগজপত্র, ফি ও সময়সীমা।
2. ফারায়েয ও উত্তরাধিকার: ইসলামিক ও হিন্দু আইনানুযায়ী জমির অংশ ও শতক বণ্টন।
3. ভূমি উন্নয়ন কর (LD Tax): মওকুফ সীমা, আবাসিক/বাণিজ্যিক করের হার ও দাখিলা সংগ্রহ।
4. জরিপ ও খতিয়ান: সিএস, এসএ, আরএস ও বিএস রেকর্ডের তুলনা ও স্বত্ব চেইন।
5. জমি ক্রয়ের সতর্কতা: বায়া দলিল, দখল, আদালতের নিষেধাজ্ঞা ও ল্যান্ড লক সংক্রান্ত তথ্য।

অনুগ্রহ করে আপনার সুনির্দিষ্ট প্রশ্নটি লিখুন অথবা নিচের বোতামগুলো ব্যবহার করুন।`),
        suggestedActions: [
          { label: 'ফারায়েয ক্যালকুলেটর', action: 'OPEN_FARAIZ' },
          { label: 'ভূমি উন্নয়ন কর হিসাব', action: 'OPEN_TAX' },
          { label: 'ই-নামজারি প্রক্রিয়া', action: 'OPEN_MUTATION' },
        ],
        quickFollowUps: [
          'ই-নামজারি আবেদন করতে কি কি লাগে?',
          'ফারায়েয সম্পত্তি বণ্টন কিভাবে করা হয়?',
          'জমি কেনার আগে কি কি দলিল দেখতে হয়?',
        ],
        statutoryReferences: [
          'State Acquisition and Tenancy Act 1950',
          'Registration Act 1908',
          'Land Reform Act 2023',
        ],
      };
    } else {
      return {
        language: 'en',
        category: 'GENERAL',
        reply: this.cleanText(`BHUMI SAHAYAK — DIGITAL LAND LEGAL ASSISTANT

I am your authoritative guide for Bangladesh land registry, cadastral surveys, and legal title governance. You can ask me about:

1. e-Mutation: Application procedure, mandatory documents, official fees, and timeline.
2. Faraiz and Succession: Hanafi Islamic and Dayabhaga Hindu estate allocation rules.
3. Land Development Tax (LD Tax): 25-Bigha exemption rules, urban rates, and online Dakhila receipts.
4. Historical Khatians: Differences between CS, SA, RS, and BS cadastral surveys.
5. Pre-Purchase Due Diligence: Chain of title validation, ground possession, and court stay orders.

Please type your specific question or choose from the suggested actions below.`),
        suggestedActions: [
          { label: 'Faraiz Calculator', action: 'OPEN_FARAIZ' },
          { label: 'Estimate Land Tax', action: 'OPEN_TAX' },
          { label: 'Start Mutation Flow', action: 'OPEN_MUTATION' },
        ],
        quickFollowUps: [
          'What are the mandatory documents for e-Mutation?',
          'How does the Faraiz calculator compute inheritance?',
          'What precautions should I take before buying land?',
        ],
        statutoryReferences: [
          'State Acquisition and Tenancy Act 1950',
          'Registration Act 1908',
          'Land Reform Act 2023',
        ],
      };
    }
  }
}
