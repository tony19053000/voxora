'use client';

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AlertCircle,
  CheckCircle2,
  FileAudio,
  FileText,
  Loader2,
  RefreshCcw,
  Sparkles,
  Upload,
} from 'lucide-react';

type Provider = 'auto' | 'openai' | 'groq';

type HealthResponse = {
  status: string;
  providers?: {
    openai?: boolean;
    groq?: boolean;
  };
};

type ProcessAudioResponse = {
  provider: string;
  transcription_model: string;
  summary_model: string;
  filename: string;
  transcript: string;
  summary: string;
};

const ACCEPTED_FILE_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.mp4'];

function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    'http://localhost:5167'
  );
}

function isSupportedAudio(file: File) {
  if (file.type.startsWith('audio/')) {
    return true;
  }

  const loweredName = file.name.toLowerCase();
  return ACCEPTED_FILE_EXTENSIONS.some((extension) => loweredName.endsWith(extension));
}

export function WebMVP() {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [provider, setProvider] = useState<Provider>('auto');
  const [backendHealth, setBackendHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessAudioResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      try {
        const response = await fetch(`${apiBaseUrl}/health`);
        if (!response.ok) {
          throw new Error('Backend health check failed');
        }

        const payload = (await response.json()) as HealthResponse;
        if (!cancelled) {
          setBackendHealth(payload);
          setHealthError(null);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setHealthError('Backend unreachable');
        }
      }
    }

    loadHealth();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  function clearResults() {
    setResult(null);
    setError(null);
  }

  function resetFlow() {
    setFile(null);
    clearResults();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function updateSelectedFile(nextFile: File | null) {
    if (!nextFile) {
      return;
    }

    if (!isSupportedAudio(nextFile)) {
      setError(`Unsupported file type. Use ${ACCEPTED_FILE_EXTENSIONS.join(', ')}.`);
      return;
    }

    setFile(nextFile);
    clearResults();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    updateSelectedFile(event.target.files?.[0] ?? null);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    updateSelectedFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function handleProcessAudio() {
    if (!file) {
      setError('Choose an audio file first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('provider', provider);

    try {
      const response = await fetch(`${apiBaseUrl}/api/process-audio`, {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || 'Audio processing failed.');
      }

      setResult(payload as ProcessAudioResponse);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Audio processing failed.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function copyTranscript() {
    if (!result?.transcript) {
      return;
    }
    await navigator.clipboard.writeText(result.transcript);
  }

  async function copySummary() {
    if (!result?.summary) {
      return;
    }
    await navigator.clipboard.writeText(result.summary);
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(248,113,113,0.14),_transparent_36%),linear-gradient(180deg,_#fff7ed_0%,_#fff_52%,_#fef2f2_100%)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8 md:px-8 md:py-10">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-[28px] border border-orange-100 bg-white/90 p-7 shadow-[0_24px_80px_-36px_rgba(127,29,29,0.35)] backdrop-blur"
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-3 inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-orange-700">
                Voxora Web MVP
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
                Upload audio, get a transcript, leave with a summary.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 md:text-base">
                This hosted flow skips desktop capture entirely. Drop in a meeting file and Voxora sends it to the backend for transcription and summarization.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div className="flex items-center gap-2 font-medium text-slate-800">
                <span className={`h-2.5 w-2.5 rounded-full ${healthError ? 'bg-red-500' : 'bg-emerald-500'}`} />
                {healthError ? 'Backend unreachable' : 'Backend ready'}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                API base: <span className="font-mono">{apiBaseUrl}</span>
              </p>
              {backendHealth?.providers && (
                <p className="mt-1 text-xs text-slate-500">
                  Keys: OpenAI {backendHealth.providers.openai ? 'on' : 'off'} | Groq {backendHealth.providers.groq ? 'on' : 'off'}
                </p>
              )}
            </div>
          </div>
        </motion.section>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.35 }}
            className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Upload audio</h2>
                <p className="mt-1 text-sm text-slate-500">Supports {ACCEPTED_FILE_EXTENSIONS.join(', ')} up to 25 MB.</p>
              </div>
              <button
                type="button"
                onClick={resetFlow}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <RefreshCcw size={16} />
                Reset
              </button>
            </div>

            <div
              className={`mt-6 rounded-[24px] border-2 border-dashed p-8 transition ${
                file ? 'border-orange-300 bg-orange-50/70' : 'border-slate-200 bg-slate-50 hover:border-orange-300 hover:bg-orange-50/40'
              }`}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_EXTENSIONS.join(',')}
                className="hidden"
                onChange={handleFileChange}
              />

              {file ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
                      <FileAudio size={26} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-slate-900">{file.name}</p>
                      <p className="text-sm text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                    <label className="text-sm text-slate-600">
                      AI provider
                      <select
                        value={provider}
                        onChange={(event) => setProvider(event.target.value as Provider)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400"
                      >
                        <option value="auto">Auto-select configured provider</option>
                        <option value="openai">OpenAI</option>
                        <option value="groq">Groq</option>
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={handleProcessAudio}
                      disabled={isLoading}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                      {isLoading ? 'Processing audio...' : 'Transcribe and summarize'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                    <Upload size={28} />
                  </div>
                  <p className="text-lg font-semibold text-slate-900">Drop an audio file here</p>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                    Or click to browse. The browser uploads the file to the FastAPI backend, which returns the transcript and summary JSON in one response.
                  </p>
                </div>
              )}
            </div>

            {(error || healthError) && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                <AlertCircle className="mt-0.5 shrink-0" size={18} />
                <span>{error || healthError}</span>
              </div>
            )}
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
            className="rounded-[28px] border border-slate-200 bg-slate-900 p-6 text-white shadow-sm"
          >
            <h2 className="text-xl font-semibold">What comes back</h2>
            <div className="mt-5 space-y-4 text-sm leading-6 text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-medium text-white">1. Transcript</p>
                <p className="mt-1">Speech-to-text using the configured cloud provider.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-medium text-white">2. Summary</p>
                <p className="mt-1">Markdown sections covering overview, key points, action items, and follow-ups.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-medium text-white">3. Clean errors</p>
                <p className="mt-1">Missing API keys, upload limits, and provider failures come back as readable JSON errors.</p>
              </div>
            </div>
          </motion.section>
        </div>

        {isLoading && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-[28px] border border-slate-200 bg-white px-6 py-8 shadow-sm"
          >
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <Loader2 className="animate-spin text-orange-500" size={40} />
              <div>
                <p className="text-lg font-semibold text-slate-900">Processing your audio</p>
                <p className="mt-1 text-sm text-slate-500">Uploading, transcribing, and generating the summary in one backend request.</p>
              </div>
            </div>
          </motion.section>
        )}

        {result && (
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 size={18} />
                Processing complete
              </div>
              <div className="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500">
                Provider: {result.provider}
              </div>
              <div className="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500">
                Transcript model: {result.transcription_model}
              </div>
              <div className="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500">
                Summary model: {result.summary_model}
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-orange-500" />
                    <h3 className="text-lg font-semibold text-slate-900">Summary</h3>
                  </div>
                  <button
                    type="button"
                    onClick={copySummary}
                    className="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    Copy summary
                  </button>
                </div>
                <div className="prose prose-slate max-w-none px-6 py-6 prose-headings:mb-2 prose-headings:mt-5 prose-p:leading-7 prose-li:leading-7">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.summary}</ReactMarkdown>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-slate-700" />
                    <h3 className="text-lg font-semibold text-slate-900">Transcript</h3>
                  </div>
                  <button
                    type="button"
                    onClick={copyTranscript}
                    className="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    Copy transcript
                  </button>
                </div>
                <div className="max-h-[680px] overflow-y-auto px-6 py-6 text-sm leading-7 text-slate-700">
                  {result.transcript.split('\n').map((paragraph, index) => (
                    <p key={index} className="mb-4 last:mb-0">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
}
