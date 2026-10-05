import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  X,
  RotateCcw,
  ArrowRight,
  Scale,
  FileText,
  Calculator,
  Key,
  Settings,
  Cpu,
} from 'lucide-react';
import { useLanguage } from '../lib/language';
import { Button } from './ui';
import { cx } from '../lib/format';
import BhumiSahayakSettingsModal from './BhumiSahayakSettingsModal';

export interface AssistantAction {
  label: string;
  action: 'OPEN_FARAIZ' | 'OPEN_TAX' | 'OPEN_MUTATION' | 'OPEN_LINEAGE' | 'OPEN_MAP';
  params?: Record<string, any>;
}

export interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  category?: string;
  isGeminiPowered?: boolean;
  modelUsed?: string;
  suggestedActions?: AssistantAction[];
  quickFollowUps?: string[];
  statutoryReferences?: string[];
  timestamp: string;
}

interface BhumiSahayakWidgetProps {
  open: boolean;
  onClose: () => void;
  onOpenFaraiz?: () => void;
  onOpenMutation?: () => void;
  onSelectTab?: (tab: string) => void;
}

const DEFAULT_PROMPTS_BN = [
  'ই-নামজারি করতে কি কি কাগজপত্র ও সরকারি ফি লাগে?',
  'ফারায়েয ক্যালকুলেটরে ইসলামিক নিয়মে সম্পত্তি বণ্টন কিভাবে হয়?',
  'ভূমি উন্নয়ন কর (LD Tax) মওকুফের ২৫ বিঘা নিয়ম কি?',
  'সিএস, এসএ, আরএস ও বিএস খতিয়ানের পার্থক্য কি?',
  'জমি কেনার আগে বায়া দলিল ও আদালতের নিষেধাজ্ঞা কিভাবে যাচাই করব?',
];

const DEFAULT_PROMPTS_EN = [
  'What documents and official fees are required for e-Mutation?',
  'How does the Faraiz calculator distribute estate under Hanafi law?',
  'What is the 25-Bigha agricultural land tax exemption policy?',
  'What are the key differences between CS, SA, RS, and BS Khatians?',
  'What pre-purchase checks should I perform against Baya deeds and court stay orders?',
];

/**
 * Strips all '#' and '*' characters and renders text with clean, elegant
 * Mouza Sheet typography (section titles, numbered lists, bullet points).
 */
function renderCleanMessage(raw: string) {
  // Strip all '#' and '*' characters and emojis completely
  const clean = (raw || '')
    .replace(/[#*]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

  const lines = clean.split('\n');

  return (
    <div className="space-y-1.5 text-xs text-ink leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Section Heading detection: uppercase titles or lines ending with colon
        const isHeader =
          (/^[A-Z0-9\s—–()/-]{4,}$/.test(trimmed) && trimmed.length > 5) ||
          /^([A-Za-z\s]+|[\u0980-\u09FF\s]+):$/.test(trimmed);

        if (isHeader) {
          return (
            <div
              key={idx}
              className="pt-2 pb-0.5 font-bold uppercase tracking-wide text-ink border-b border-line-hair text-[11px]"
            >
              {trimmed}
            </div>
          );
        }

        // Numbered list item: e.g. "1. Item" or "১. আইটেম"
        const numMatch = trimmed.match(/^(\d+|[\u09E6-\u09EF]+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1">
              <span className="mono font-bold text-indigo shrink-0 text-2xs">
                {numMatch[1]}.
              </span>
              <span className="text-ink-2">{renderInlineFields(numMatch[2])}</span>
            </div>
          );
        }

        // Bullet list item: starts with "-"
        if (trimmed.startsWith('-')) {
          const bulletText = trimmed.replace(/^-\s*/, '');
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1">
              <span className="text-indigo text-xs leading-none shrink-0 font-bold">•</span>
              <span className="text-ink-2">{renderInlineFields(bulletText)}</span>
            </div>
          );
        }

        // Normal paragraph
        return (
          <p key={idx} className="text-ink-2">
            {renderInlineFields(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Highlights 'Key:' terms at the beginning of phrases for crisp visual hierarchy.
 */
function renderInlineFields(str: string): React.ReactNode {
  // If line has format "Key: Value" or "শব্দ: বিবরণ", bold the key
  const colonIndex = str.indexOf(':');
  if (colonIndex > 0 && colonIndex < 35) {
    const key = str.slice(0, colonIndex + 1);
    const rest = str.slice(colonIndex + 1);
    return (
      <>
        <span className="font-semibold text-ink">{key}</span>
        <span>{rest}</span>
      </>
    );
  }
  return str;
}

export default function BhumiSahayakWidget({
  open,
  onClose,
  onOpenFaraiz,
  onOpenMutation,
  onSelectTab,
}: BhumiSahayakWidgetProps) {
  const { lang, t } = useLanguage();
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // AI Configuration state
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('land_gemini_api_key') || '';
  });
  const [model, setModel] = useState(() => {
    return localStorage.getItem('land_gemini_model') || 'gemini-1.5-flash';
  });
  const [temperature, setTemperature] = useState(() => {
    return parseFloat(localStorage.getItem('land_gemini_temp') || '0.2');
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize greeting on first load or language switch if empty
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome-0',
          role: 'assistant',
          content:
            lang === 'bn'
              ? 'স্বাগতম! আমি ভূমি সহায়ক\n\nআমি বাংলাদেশ ডিজিটাল ভূমি ব্যবস্থাপনা প্ল্যাটফর্মের স্বত্ব ও আইনি সহকারী। ই-নামজারি প্রক্রিয়া, ফারায়েয বণ্টন, ভূমি উন্নয়ন কর বা জমি সংক্রান্ত যেকোনো আইনি প্রশ্ন আমাকে জিজ্ঞাসা করতে পারেন।'
              : 'Welcome to Bhumi Sahayak\n\nI am your digital land legal and cadastral assistant. You can ask me about e-Mutation procedures, Faraiz inheritance calculations, Land Development Tax, historical Khatians, or pre-purchase title due diligence.',
          quickFollowUps: lang === 'bn' ? DEFAULT_PROMPTS_BN.slice(0, 3) : DEFAULT_PROMPTS_EN.slice(0, 3),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [lang]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSettingsSave = (newKey: string, newModel: string, newTemp: number) => {
    setApiKey(newKey);
    setModel(newModel);
    setTemperature(newTemp);

    if (newKey) {
      localStorage.setItem('land_gemini_api_key', newKey);
    } else {
      localStorage.removeItem('land_gemini_api_key');
    }
    localStorage.setItem('land_gemini_model', newModel);
    localStorage.setItem('land_gemini_temp', String(newTemp));
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || loading) return;

    const userEntry: ChatEntry = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userEntry]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          apiKey: apiKey || undefined,
          model: model || undefined,
          temperature: temperature ?? 0.2,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const json = await res.json();
      const data = json.data;

      const assistantEntry: ChatEntry = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        category: data.category,
        isGeminiPowered: data.isGeminiPowered,
        modelUsed: data.modelUsed,
        suggestedActions: data.suggestedActions,
        quickFollowUps: data.quickFollowUps,
        statutoryReferences: data.statutoryReferences,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantEntry]);
    } catch (err) {
      console.error('Failed to communicate with assistant:', err);
      const fallbackEntry: ChatEntry = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content:
          lang === 'bn'
            ? 'সহকারী সার্ভারের সাথে সংযোগে সাময়িক সমস্যা দেখা দিয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।'
            : 'Temporary connectivity issue with the assistant server. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackEntry]);
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (action: AssistantAction) => {
    if (action.action === 'OPEN_FARAIZ' && onOpenFaraiz) {
      onOpenFaraiz();
    } else if (action.action === 'OPEN_MUTATION' && onOpenMutation) {
      onOpenMutation();
    } else if (action.action === 'OPEN_TAX' && onSelectTab) {
      onSelectTab('tax');
    } else if (action.action === 'OPEN_LINEAGE' && onSelectTab) {
      onSelectTab('lineage');
    } else if (action.action === 'OPEN_MAP' && onSelectTab) {
      onSelectTab('map');
    }
  };

  const handleReset = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content:
          lang === 'bn'
            ? 'নতুন আলোচনা শুরু হয়েছে\n\nই-নামজারি, ফারায়েয বণ্টন, ভূমি উন্নয়ন কর বা জমি সংক্রান্ত যেকোনো আইনি প্রশ্ন করতে পারেন।'
            : 'Conversation Reset\n\nYou can ask any question regarding e-Mutation, Faraiz inheritance, Land Development Tax, or title verification.',
        quickFollowUps: lang === 'bn' ? DEFAULT_PROMPTS_BN.slice(0, 3) : DEFAULT_PROMPTS_EN.slice(0, 3),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-line bg-sheet shadow-2xl backdrop-blur-sm sm:w-[480px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line bg-sheet-raised px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center border border-indigo/40 bg-indigo-soft text-indigo">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-ink">
                  {t('Bhumi Sahayak', 'ভূমি সহায়ক')}
                </h2>
                {model === 'sovereign-offline' ? (
                  <span className="mono rounded border border-line-hair bg-ground px-1.5 py-0.2 text-[9px] font-semibold uppercase text-ink-3">
                    Offline
                  </span>
                ) : apiKey ? (
                  <span className="mono rounded border border-state/40 bg-state-soft px-1.5 py-0.2 text-[9px] font-semibold uppercase text-state">
                    {model.replace('gemini-', '')}
                  </span>
                ) : (
                  <span className="mono rounded border border-indigo/30 bg-indigo-soft px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wide text-indigo">
                    {t('Sovereign', 'সার্বভৌম')}
                  </span>
                )}
              </div>
              <p className="mono text-[10px] text-ink-3">
                {t('Cadastral & Land Law Knowledge Engine', 'জাতীয় ভূমি আইন ও জরিপ নির্দেশিকা')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Dedicated Settings Button */}
            <button
              type="button"
              onClick={() => setSettingsModalOpen(true)}
              title={t('AI Model & Key Settings', 'মডেল ও এপিআই সেটিংস')}
              className="flex items-center gap-1 rounded border border-line-hair bg-sheet px-2 py-1 text-2xs font-medium text-ink-2 transition-colors hover:border-indigo hover:bg-indigo-soft hover:text-indigo"
            >
              <Settings className="h-3.5 w-3.5 text-indigo" />
              <span className="hidden sm:inline">{t('Settings', 'সেটিংস')}</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              title={t('Reset Conversation', 'নতুন বার্তালাপ')}
              className="rounded border border-line-hair p-1.5 text-ink-3 transition-colors hover:border-line hover:bg-ground-sunk hover:text-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title={t('Close', 'বন্ধ করুন')}
              className="rounded border border-line-hair p-1.5 text-ink-3 transition-colors hover:border-line hover:bg-ground-sunk hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Message Feed */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-ground/50 p-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cx('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}
            >
              <div className="flex items-center gap-1.5 px-1 pb-1">
                <span className="mono text-[9px] uppercase tracking-wide text-ink-3">
                  {m.role === 'user'
                    ? t('Citizen / You', 'আপনি')
                    : t('Bhumi Sahayak', 'ভূমি সহায়ক')}
                </span>
                {m.modelUsed && (
                  <span className="mono rounded border border-state/30 bg-state-soft px-1 text-[8px] uppercase text-state">
                    {m.modelUsed.replace('gemini-', '')}
                  </span>
                )}
                <span className="mono text-[9px] text-ink-3">· {m.timestamp}</span>
              </div>

              <div
                className={cx(
                  'max-w-[94%] border p-3.5 text-xs leading-relaxed',
                  m.role === 'user'
                    ? 'border-line bg-sheet text-ink'
                    : 'border-indigo-line bg-sheet text-ink shadow-sm'
                )}
              >
                {/* Clean Formatted Content (Strictly no # and no *) */}
                {renderCleanMessage(m.content)}

                {/* Action Buttons */}
                {m.suggestedActions && m.suggestedActions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line-hair pt-2.5">
                    {m.suggestedActions.map((act, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleActionClick(act)}
                        className="inline-flex items-center gap-1.5 border border-indigo/40 bg-indigo-soft px-2.5 py-1 text-2xs font-semibold text-indigo transition-colors hover:border-indigo hover:bg-indigo hover:text-white"
                      >
                        {act.action === 'OPEN_FARAIZ' ? (
                          <Calculator className="h-3 w-3" />
                        ) : act.action === 'OPEN_MUTATION' ? (
                          <FileText className="h-3 w-3" />
                        ) : (
                          <ArrowRight className="h-3 w-3" />
                        )}
                        <span>{act.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Statutory Legal References */}
                {m.statutoryReferences && m.statutoryReferences.length > 0 && (
                  <div className="mt-2.5 border-t border-line-hair pt-2">
                    <span className="mono mb-1 flex items-center gap-1 text-[9px] uppercase tracking-wider text-ink-3">
                      <Scale className="h-2.5 w-2.5" />
                      {t('Statutory References', 'আইনি তথ্যসূত্র')}
                    </span>
                    <ul className="space-y-0.5 text-[10px] text-ink-2">
                      {m.statutoryReferences.map((ref, idx) => (
                        <li key={idx} className="mono flex items-start gap-1">
                          <span className="text-indigo">§</span>
                          <span>{ref}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Quick Follow-ups */}
              {m.quickFollowUps && m.quickFollowUps.length > 0 && (
                <div className="mt-2 flex max-w-[94%] flex-wrap gap-1.5 pl-1">
                  {m.quickFollowUps.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(q)}
                      disabled={loading}
                      className="rounded border border-line-hair bg-sheet px-2 py-1 text-left text-[11px] text-ink-2 transition-colors hover:border-indigo hover:bg-indigo-soft hover:text-indigo"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-1.5 px-1 pb-1">
                <span className="mono text-[9px] uppercase tracking-wide text-ink-3">
                  {t('Bhumi Sahayak', 'ভূমি সহায়ক')}
                </span>
                <span className="mono text-[9px] text-ink-3">· {t('Processing...', 'যাচাই করা হচ্ছে...')}</span>
              </div>
              <div className="border border-indigo-line bg-sheet p-3 text-xs text-ink-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-indigo" />
                  <span className="mono text-2xs text-ink-3">
                    {apiKey && model !== 'sovereign-offline'
                      ? t(`Consulting ${model} with land law repository...`, `${model} ও ভূমি আইনের সমন্বয় করা হচ্ছে...`)
                      : t('Searching statutory land laws and procedural circulars...', 'ভূমি আইন ও পরিপত্র যাচাই করা হচ্ছে...')}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Suggested Quick Prompt Chips if thread is short */}
        {messages.length <= 2 && (
          <div className="border-t border-line-hair bg-sheet px-4 py-2">
            <span className="mono mb-1.5 block text-[9px] uppercase tracking-wider text-ink-3">
              {t('Recommended Inquiries', 'প্রস্তাবিত আইনি প্রশ্নাবলী')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(lang === 'bn' ? DEFAULT_PROMPTS_BN : DEFAULT_PROMPTS_EN).map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  disabled={loading}
                  className="rounded border border-line-hair bg-ground-sunk px-2 py-1 text-left text-[10px] text-ink-2 transition-colors hover:border-indigo hover:bg-indigo-soft hover:text-indigo"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div className="border-t border-line bg-sheet-raised p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                lang === 'bn'
                  ? 'ভূমি আইন, নামজারি বা খাজনা সম্পর্কে প্রশ্ন লিখুন...'
                  : 'Ask about e-Mutation, Faraiz, land laws, or tax...'
              }
              disabled={loading}
              className="flex-1 border border-line bg-sheet px-3 py-2 text-xs text-ink placeholder-ink-3 focus:border-indigo focus:outline-none"
            />
            <Button
              type="submit"
              size="sm"
              variant="primary"
              disabled={!input.trim() || loading}
              className="h-9 px-3.5"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>

          {/* Model Status and Quick Settings Link */}
          <div className="mt-1.5 flex items-center justify-between text-[9px] text-ink-3">
            <button
              type="button"
              onClick={() => setSettingsModalOpen(true)}
              className="mono text-ink-2 hover:text-indigo flex items-center gap-1 transition-colors"
              title={t('Click to scan & select AI model', 'মডেল স্ক্যান ও নির্বাচন করতে ক্লিক করুন')}
            >
              <Cpu className="h-2.5 w-2.5 text-indigo" />
              <span>
                {model === 'sovereign-offline'
                  ? 'Sovereign Offline'
                  : apiKey
                  ? `${model}`
                  : 'Sovereign Knowledge Engine'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSettingsModalOpen(true)}
              className="mono text-indigo hover:underline flex items-center gap-1"
            >
              <Settings className="h-2.5 w-2.5" /> {t('Model & Key Settings', 'মডেল সেটিংস')}
            </button>
          </div>
        </div>
      </div>

      {/* Dedicated Settings Modal for Scan & Select */}
      <BhumiSahayakSettingsModal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        currentApiKey={apiKey}
        currentModel={model}
        currentTemperature={temperature}
        onSave={handleSettingsSave}
      />
    </>
  );
}
