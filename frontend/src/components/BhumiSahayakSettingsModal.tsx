import React, { useState, useEffect } from 'react';
import {
  Settings,
  Key,
  RefreshCw,
  Check,
  Eye,
  EyeOff,
  Cpu,
  ShieldCheck,
  Sliders,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import Modal from './Modal';
import { Button } from './ui';
import { useLanguage } from '../lib/language';
import { cx } from '../lib/format';

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
}

const FALLBACK_MODELS: ModelOption[] = [
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: 'Fast, cost-efficient, and versatile model optimized for real-time land queries.',
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
    description: 'Lightweight high-throughput model for rapid high-frequency interactions.',
  },
  {
    id: 'sovereign-offline',
    name: 'Sovereign Land Engine (Offline)',
    description: 'Deterministic built-in legal knowledge engine (zero external API calls).',
  },
];

interface BhumiSahayakSettingsModalProps {
  open: boolean;
  onClose: () => void;
  currentApiKey: string;
  currentModel: string;
  currentTemperature: number;
  onSave: (apiKey: string, model: string, temperature: number) => void;
}

export default function BhumiSahayakSettingsModal({
  open,
  onClose,
  currentApiKey,
  currentModel,
  currentTemperature,
  onSave,
}: BhumiSahayakSettingsModalProps) {
  const { lang, t } = useLanguage();
  const [apiKey, setApiKey] = useState(currentApiKey);
  const [selectedModel, setSelectedModel] = useState(currentModel || 'gemini-1.5-flash');
  const [temperature, setTemperature] = useState(currentTemperature ?? 0.2);
  const [showKeySecret, setShowKeySecret] = useState(false);
  const [models, setModels] = useState<ModelOption[]>(FALLBACK_MODELS);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    source: 'LIVE_SCAN' | 'DEFAULT_CATALOG';
    count: number;
    message?: string;
  } | null>(null);
  const [customModelInput, setCustomModelInput] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setApiKey(currentApiKey);
      setSelectedModel(currentModel || 'gemini-1.5-flash');
      setTemperature(currentTemperature ?? 0.2);
      setSavedSuccess(false);
      // Auto-scan models if a key is already present
      if (currentApiKey) {
        handleScanModels(currentApiKey);
      }
    }
  }, [open, currentApiKey, currentModel, currentTemperature]);

  const handleScanModels = async (keyToUse?: string) => {
    const key = (keyToUse ?? apiKey).trim();
    setScanning(true);
    setScanResult(null);

    try {
      const res = await fetch('http://localhost:5000/api/assistant/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key || undefined }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      const data = json.data;

      if (data?.models && data.models.length > 0) {
        setModels(data.models);
        setScanResult({
          source: data.source,
          count: data.models.length,
          message:
            data.source === 'LIVE_SCAN'
              ? t(
                  `Successfully scanned ${data.models.length} active models from your Google Gemini API key.`,
                  `আপনার গুগল এপিআই কি থেকে ${data.models.length} টি সক্রিয় মডেল স্ক্যান করা হয়েছে।`
                )
              : t(
                  'Default catalog loaded. Provide an API key to scan live models from your account.',
                  'ডিফল্ট ক্যাটালগ প্রদর্শিত হচ্ছে। অ্যাকাউন্ট থেকে লাইভ মডেল স্ক্যান করতে এপিআই কি দিন।'
                ),
        });
      }
    } catch (err) {
      console.warn('Scan failed, using default catalog:', err);
      setModels(FALLBACK_MODELS);
      setScanResult({
        source: 'DEFAULT_CATALOG',
        count: FALLBACK_MODELS.length,
        message: t(
          'Could not reach API for live scan; default model catalog is available.',
          'লাইভ স্ক্যান সম্পন্ন হয়নি; ডিফল্ট ক্যাটালগ সক্রিয় রয়েছে।'
        ),
      });
    } finally {
      setScanning(false);
    }
  };

  const handleApply = () => {
    const finalModel = customModelInput.trim() || selectedModel;
    onSave(apiKey.trim(), finalModel, temperature);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleResetDefaults = () => {
    setApiKey('');
    setSelectedModel('gemini-1.5-flash');
    setTemperature(0.2);
    setCustomModelInput('');
    setModels(FALLBACK_MODELS);
    setScanResult(null);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="3xl"
      title={t('Bhumi Sahayak AI Configuration', 'ভূমি সহায়ক এআই কনফিগারেশন')}
      label={t('AI Model & API Key Settings', 'এআই মডেল ও এপিআই সেটিংস')}
      bn="মডেল স্ক্যান ও নির্বাচন"
    >
      <div className="space-y-5 p-4 sm:p-5">
        {/* Section 1: API Key Configuration */}
        <div className="border border-line bg-sheet-raised p-4">
          <div className="flex items-center justify-between border-b border-line-hair pb-2 mb-3">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-indigo" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                {t('1. Google Gemini API Key', '১. গুগল জেমিনাই এপিআই কি')}
              </h3>
            </div>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="mono inline-flex items-center gap-1 text-[10px] text-indigo hover:underline"
            >
              <span>{t('Get Free Key at Google AI Studio', 'ফ্রি এপিআই কি সংগ্রহ করুন')}</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>

          <p className="text-xs text-ink-3 pb-3 leading-relaxed">
            {t(
              'Enter your Google Gemini API key to enable live generative intelligence and unlock model scanning. Keys are stored strictly on your local device.',
              'লাইভ জেনারেটিভ এআই এবং মডেল স্ক্যানিং সক্রিয় করতে আপনার গুগল জেমিনাই এপিআই কি প্রবেশ করান। এটি আপনার ব্রাউজারে সুরক্ষিত থাকবে।'
            )}
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <input
                type={showKeySecret ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full border border-line bg-sheet px-3 py-2 pr-9 font-mono text-xs text-ink placeholder-ink-3 focus:border-indigo focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKeySecret((prev) => !prev)}
                className="absolute right-2.5 top-2.5 text-ink-3 hover:text-ink"
                title={showKeySecret ? 'Hide Key' : 'Show Key'}
              >
                {showKeySecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleScanModels()}
              disabled={scanning}
              className="flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className={cx('h-3.5 w-3.5', scanning && 'animate-spin')} />
              <span>{scanning ? t('Scanning...', 'স্ক্যান হচ্ছে...') : t('Scan & Validate', 'স্ক্যান ও যাচাই')}</span>
            </Button>

            {apiKey && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setApiKey('');
                  setScanResult(null);
                }}
                className="shrink-0 text-red hover:border-red"
              >
                {t('Clear', 'মুছুন')}
              </Button>
            )}
          </div>

          {/* Key Status Message */}
          {scanResult && (
            <div
              className={cx(
                'mt-2.5 flex items-center gap-2 border p-2 text-2xs',
                scanResult.source === 'LIVE_SCAN'
                  ? 'border-state/40 bg-state-soft text-state font-medium'
                  : 'border-amber/40 bg-amber-soft text-amber'
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span>{scanResult.message}</span>
            </div>
          )}
        </div>

        {/* Section 2: Model Selection (Scan & Select) */}
        <div className="border border-line bg-sheet-raised p-4">
          <div className="flex items-center justify-between border-b border-line-hair pb-2 mb-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-indigo" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                {t('2. Select AI Model (স্ক্যান ও মডেল নির্বাচন)', '২. এআই মডেল নির্বাচন (স্ক্যান ও নির্বাচন)')}
              </h3>
            </div>
            <span className="mono text-[10px] text-ink-3">
              {models.length} {t('models available', 'মডেল প্রাপ্ত')}
            </span>
          </div>

          <p className="text-xs text-ink-3 pb-3 leading-relaxed">
            {t(
              'Select an optimal model for your workflow. Flash models offer instant responsiveness, while Pro models excel in statutory interpretation and multi-step title disputes.',
              'আপনার কাজের জন্য উপযুক্ত মডেল নির্বাচন করুন। ফ্ল্যাশ মডেল দ্রুত কাজ করে এবং প্রো মডেল জটিল আইনি বিশ্লেষণে দক্ষ।'
            )}
          </p>

          {/* Model Selection Radio Cards */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {models.map((m) => {
              const isSelected = selectedModel === m.id && !customModelInput.trim();
              return (
                <div
                  key={m.id}
                  onClick={() => {
                    setSelectedModel(m.id);
                    setCustomModelInput('');
                  }}
                  className={cx(
                    'cursor-pointer border p-2.5 transition-all text-left flex flex-col justify-between',
                    isSelected
                      ? 'border-indigo bg-indigo-soft/80 shadow-sm'
                      : 'border-line-hair bg-sheet hover:border-line hover:bg-ground-sunk'
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 pb-1">
                      <span className="font-bold text-xs text-ink">{m.name}</span>
                      {m.isDefault && (
                        <span className="mono rounded border border-indigo/40 bg-indigo/10 px-1 py-0.2 text-[8px] uppercase font-bold text-indigo">
                          Recommended
                        </span>
                      )}
                      {m.id.includes('pro') && (
                        <span className="mono rounded border border-amber/40 bg-amber-soft px-1 py-0.2 text-[8px] uppercase font-bold text-amber">
                          Deep Legal
                        </span>
                      )}
                      {m.id === 'sovereign-offline' && (
                        <span className="mono rounded border border-line px-1 py-0.2 text-[8px] uppercase font-bold text-ink-3">
                          Offline
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-2 line-clamp-2 leading-relaxed">
                      {m.description}
                    </p>
                  </div>
                  <div className="mt-2 pt-1 border-t border-line-hair flex items-center justify-between text-[10px] mono text-ink-3">
                    <span>{m.id}</span>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-indigo font-bold">
                        <Check className="h-3 w-3" /> Active
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom Model Override Input */}
          <div className="mt-3 pt-2.5 border-t border-line-hair">
            <span className="mono mb-1 block text-2xs uppercase text-ink-3">
              {t('Or specify a custom model name / ID:', 'অথবা নিজস্ব মডেলের নাম প্রদান করুন:')}
            </span>
            <input
              type="text"
              value={customModelInput}
              onChange={(e) => setCustomModelInput(e.target.value)}
              placeholder="e.g. gemini-2.0-flash-exp, tunedModels/..."
              className="w-full border border-line bg-sheet px-2.5 py-1.5 font-mono text-xs text-ink placeholder-ink-3 focus:border-indigo focus:outline-none"
            />
          </div>
        </div>

        {/* Section 3: Legal Accuracy Temperature */}
        <div className="border border-line bg-sheet-raised p-4">
          <div className="flex items-center gap-2 border-b border-line-hair pb-2 mb-3">
            <Sliders className="h-4 w-4 text-indigo" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
              {t('3. Reasoning Temperature & Legal Strictness', '৩. আইনি নিখুঁততা ও টেম্পারেচার')}
            </h3>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between pb-1">
                <span className="mono text-xs text-ink font-semibold">
                  Temperature: {temperature.toFixed(2)}
                </span>
                <span className="mono text-2xs text-ink-3">
                  {temperature <= 0.2
                    ? 'Strict Statutory Law (Recommended)'
                    : temperature <= 0.5
                    ? 'Balanced Reasoning'
                    : 'Exploratory'}
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-indigo"
              />
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button
                size="sm"
                variant={temperature === 0.2 ? 'primary' : 'secondary'}
                onClick={() => setTemperature(0.2)}
                className="text-2xs px-2"
              >
                0.2 Strict
              </Button>
              <Button
                size="sm"
                variant={temperature === 0.5 ? 'primary' : 'secondary'}
                onClick={() => setTemperature(0.5)}
                className="text-2xs px-2"
              >
                0.5 Balanced
              </Button>
            </div>
          </div>

          {/* Mandatory formatting guarantee */}
          <div className="mt-3 border-t border-line-hair pt-2 text-[10px] text-ink-3 flex items-center justify-between">
            <span className="mono flex items-center gap-1.5 text-state font-medium">
              <Check className="h-3 w-3" />
              {t('Output Rule: Zero "#" and "*" symbols enforced on all responses', 'আউটপুট নীতি: কোনো "#" বা "*" প্রতীক থাকবে না')}
            </span>
            <span className="mono">WCAG AAA Compliance</span>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between border-t border-line pt-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleResetDefaults}
            className="text-xs text-ink-3"
          >
            {t('Reset Defaults', 'ডিফল্ট সেটিং')}
          </Button>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onClose} className="text-xs">
              {t('Cancel', 'বাতিল')}
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleApply}
              className="text-xs px-4 flex items-center gap-1.5"
            >
              {savedSuccess ? <Check className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>{savedSuccess ? t('Applied!', 'সক্রিয় হয়েছে!') : t('Apply & Save', 'সংরক্ষণ ও প্রয়োগ')}</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
