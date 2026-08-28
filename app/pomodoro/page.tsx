"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type Phase = "focus" | "short" | "long";

type Settings = {
  focusMin: number;
  shortMin: number;
  longMin: number;
  cyclesBeforeLong: number;
};

type Persisted = {
  settings: Settings;
  completedToday: number;
  notifyEnabled: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  cyclesBeforeLong: 4,
};

const DEFAULT_PERSISTED: Persisted = {
  settings: DEFAULT_SETTINGS,
  completedToday: 0,
  notifyEnabled: false,
};

const PHASE_LABEL: Record<Phase, string> = {
  focus: "專注時間",
  short: "短休息",
  long: "長休息",
};

const PHASE_HINT: Record<Phase, string> = {
  focus: "深呼吸，我們開始專注吧 🍅",
  short: "起來動一動，喝口水 💧",
  long: "辛苦了，好好放鬆一下 🌿",
};

const PHASE_RING: Record<Phase, string> = {
  focus: "#FF8FA3",
  short: "#7FC8A9",
  long: "#B79CE0",
};

const PHASE_TRACK: Record<Phase, string> = {
  focus: "#FFE1E8",
  short: "#DCF3E7",
  long: "#EBE0FA",
};

const PHASE_BADGE: Record<Phase, string> = {
  focus: "bg-[#FFD3E0] text-[#8a3b4f]",
  short: "bg-[#D3F3E4] text-[#2f6b52]",
  long: "bg-[#E5D9FA] text-[#5c3f8a]",
};

const STORAGE_KEY = "jun-tools-pomodoro";

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function durationFor(p: Phase, s: Settings) {
  return (p === "focus" ? s.focusMin : p === "short" ? s.shortMin : s.longMin) * 60;
}

function playChime() {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const now = ctx.currentTime;
    [880, 1108.73].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.35);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    // Web Audio unavailable — fail silently, the timer still works visually.
  }
}

function notify(title: string, body: string) {
  if (typeof window.Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico" });
  } catch {
    // 部分瀏覽器環境不支援，忽略即可。
  }
}

/**
 * Settings / today's tally live outside React state and are read via
 * useSyncExternalStore. That's what lets the very first client render match
 * the server-rendered markup (getServerSnapshot) while still picking up
 * whatever was saved in localStorage right after hydration — without ever
 * calling setState from inside an effect body.
 */
let storeCache: Persisted | null = null;
const storeListeners = new Set<() => void>();

function readPersisted(): Persisted {
  if (typeof window === "undefined") return DEFAULT_PERSISTED;
  let settings = DEFAULT_SETTINGS;
  let completedToday = 0;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        settings?: Partial<Settings>;
        date?: string;
        completedToday?: number;
      };
      settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
      if (parsed.date === todayKey()) {
        completedToday = parsed.completedToday ?? 0;
      }
    }
  } catch {
    // localStorage 不可用時，安靜地使用預設值。
  }
  const notifyEnabled =
    typeof window.Notification !== "undefined" && Notification.permission === "granted";
  return { settings, completedToday, notifyEnabled };
}

function subscribePersisted(listener: () => void) {
  storeListeners.add(listener);
  return () => storeListeners.delete(listener);
}

function getPersistedSnapshot(): Persisted {
  if (storeCache === null) {
    storeCache = readPersisted();
  }
  return storeCache;
}

function getServerPersistedSnapshot(): Persisted {
  return DEFAULT_PERSISTED;
}

function writePersisted(patch: Partial<Persisted>) {
  const base = storeCache ?? readPersisted();
  storeCache = { ...base, ...patch };
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        settings: storeCache.settings,
        date: todayKey(),
        completedToday: storeCache.completedToday,
      }),
    );
  } catch {
    // 忽略寫入失敗（例如私密瀏覽模式）。
  }
  storeListeners.forEach((listener) => listener());
}

function Stepper({
  label,
  value,
  min,
  max,
  suffix,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  disabled: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm font-medium text-[#7a4a3a]">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="grid h-7 w-7 place-items-center rounded-full bg-[#FFE1EC] text-[#7a4a3a] transition hover:brightness-105 disabled:opacity-40"
        >
          −
        </button>
        <span className="w-14 text-center text-sm font-bold text-[#7a4a3a]">
          {value} {suffix}
        </span>
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="grid h-7 w-7 place-items-center rounded-full bg-[#FFE1EC] text-[#7a4a3a] transition hover:brightness-105 disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function PomodoroPage() {
  const { settings, completedToday, notifyEnabled } = useSyncExternalStore(
    subscribePersisted,
    getPersistedSnapshot,
    getServerPersistedSnapshot,
  );

  const [phase, setPhase] = useState<Phase>("focus");
  // null = "at the full duration for the current phase" (always freshly
  // derived from settings); a number = an actual mid-countdown value.
  const [remainingOverride, setRemainingOverride] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const endTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = durationFor(phase, settings);
  const secondsLeft = remainingOverride ?? totalSeconds;

  // 分頁標題同步顯示倒數
  useEffect(() => {
    document.title = isRunning
      ? `${formatTime(secondsLeft)} · ${PHASE_LABEL[phase]} - 番茄鐘`
      : "番茄鐘 | jun-tools";
  }, [secondsLeft, isRunning, phase]);

  const advanceTo = useCallback((nextPhase: Phase, keepRunning: boolean, s: Settings) => {
    const next = durationFor(nextPhase, s);
    setPhase(nextPhase);
    if (keepRunning) {
      endTimeRef.current = Date.now() + next * 1000;
      setRemainingOverride(next);
      setIsRunning(true);
    } else {
      endTimeRef.current = null;
      setRemainingOverride(null);
      setIsRunning(false);
    }
  }, []);

  const handlePhaseComplete = useCallback(() => {
    playChime();
    if (phase === "focus") {
      const newCount = completedToday + 1;
      writePersisted({ completedToday: newCount });
      const nextPhase: Phase = newCount % settings.cyclesBeforeLong === 0 ? "long" : "short";
      notify("番茄鐘完成！🍅", nextPhase === "long" ? "該來個長休息囉～" : "先休息一下吧！");
      advanceTo(nextPhase, true, settings);
    } else {
      notify("休息結束！", "準備好回到專注時間了嗎？");
      advanceTo("focus", true, settings);
    }
  }, [phase, completedToday, settings, advanceTo]);

  // 倒數計時（以時間戳計算，避免分頁背景時的計時漂移）
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      if (endTimeRef.current === null) return;
      const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setRemainingOverride(remaining);
      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        handlePhaseComplete();
      }
    }, 250);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, handlePhaseComplete]);

  const start = () => {
    if (isRunning) return;
    const startValue = remainingOverride ?? totalSeconds;
    endTimeRef.current = Date.now() + startValue * 1000;
    setRemainingOverride(startValue);
    setIsRunning(true);
  };

  const pause = () => {
    setIsRunning(false);
    endTimeRef.current = null;
  };

  const reset = () => {
    setIsRunning(false);
    endTimeRef.current = null;
    setRemainingOverride(null);
  };

  const skip = () => {
    if (phase === "focus") {
      const nextPhase: Phase =
        (completedToday + 1) % settings.cyclesBeforeLong === 0 ? "long" : "short";
      advanceTo(nextPhase, isRunning, settings);
    } else {
      advanceTo("focus", isRunning, settings);
    }
  };

  const updateSetting = (key: keyof Settings, value: number) => {
    writePersisted({ settings: { ...settings, [key]: value } });
    if (!isRunning) {
      setRemainingOverride(null);
    }
  };

  const requestNotifications = async () => {
    if (typeof window.Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    writePersisted({ notifyEnabled: permission === "granted" });
  };

  const circumference = 2 * Math.PI * 88;
  const dashoffset = totalSeconds > 0 ? circumference * (secondsLeft / totalSeconds) : 0;
  const filledTomatoes =
    completedToday === 0
      ? 0
      : completedToday % settings.cyclesBeforeLong === 0
        ? settings.cyclesBeforeLong
        : completedToday % settings.cyclesBeforeLong;

  return (
    <div className="mesh-bg min-h-dvh w-full px-4 py-8 sm:py-12">
      <div
        aria-hidden
        className="grain-overlay pointer-events-none fixed inset-0 z-0 opacity-[0.05]"
      />
      <div className="relative z-10 mx-auto max-w-2xl">
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-[#a8785e] transition hover:text-[#7a4a3a]"
          >
            ← 回首頁
          </Link>
        </div>

        <header className="mb-8 text-center">
          <h1 className="flex items-center justify-center gap-2 text-3xl font-extrabold text-[#7a4a3a] sm:text-4xl">
            <span>🍅</span> 姊姊休息時間番茄鐘 <span>⏳</span>
          </h1>
          <p className="mt-2 text-[#a8785e]">今天專注休息一下，明天再放一天假，再來就放假了。</p>
        </header>

        <section className="rounded-3xl border border-white bg-white/80 p-6 shadow-[0_10px_30px_rgba(190,150,120,0.15)] backdrop-blur sm:p-10">
          <div className="flex flex-col items-center">
            <span
              className={`mb-6 rounded-full px-4 py-1 text-sm font-bold ${PHASE_BADGE[phase]}`}
            >
              {PHASE_LABEL[phase]}
            </span>

            <div className="relative aspect-square w-full max-w-[280px]">
              <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
                <circle
                  cx="100"
                  cy="100"
                  r="88"
                  fill="none"
                  stroke={PHASE_TRACK[phase]}
                  strokeWidth="14"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="88"
                  fill="none"
                  stroke={PHASE_RING[phase]}
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashoffset}
                  style={{ transition: "stroke-dashoffset 0.25s linear" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-extrabold tabular-nums text-[#7a4a3a] sm:text-6xl">
                  {formatTime(secondsLeft)}
                </span>
                <span className="mt-2 text-sm text-[#a8785e]">{PHASE_HINT[phase]}</span>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-full bg-[#FFE1E1] px-4 py-2 text-sm font-semibold text-[#c9635f] shadow transition hover:brightness-105 active:scale-95"
              >
                重設
              </button>
              <button
                type="button"
                onClick={isRunning ? pause : start}
                className="rounded-full px-8 py-3 text-lg font-extrabold text-white shadow-[0_6px_16px_rgba(255,143,163,0.45)] transition hover:brightness-105 active:scale-95"
                style={{ backgroundColor: PHASE_RING[phase] }}
              >
                {isRunning ? "暫停" : secondsLeft === totalSeconds ? "開始" : "繼續"}
              </button>
              <button
                type="button"
                onClick={skip}
                className="rounded-full bg-[#F3E8FF] px-4 py-2 text-sm font-semibold text-[#7a5aa8] shadow transition hover:brightness-105 active:scale-95"
              >
                跳過 ⏭
              </button>
            </div>

            <div className="mt-8 flex flex-col items-center gap-2">
              <div className="flex gap-1.5">
                {Array.from({ length: settings.cyclesBeforeLong }, (_, i) => (
                  <span key={i} className={i < filledTomatoes ? "text-lg" : "text-lg opacity-25"}>
                    🍅
                  </span>
                ))}
              </div>
              <p className="text-xs font-medium text-[#a8785e]">
                今天已完成 {completedToday} 個番茄鐘
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-white bg-white/80 p-6 shadow-[0_10px_30px_rgba(190,150,120,0.15)] backdrop-blur">
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="flex w-full items-center justify-between text-sm font-bold text-[#7a4a3a]"
          >
            <span>⚙️ 時間設定</span>
            <span className="text-xs text-[#a8785e]">{showSettings ? "收合 ▲" : "展開 ▼"}</span>
          </button>

          {showSettings && (
            <div className="mt-4 divide-y divide-[#FFE1EC]">
              <Stepper
                label="專注時間"
                value={settings.focusMin}
                min={5}
                max={90}
                suffix="分鐘"
                disabled={isRunning}
                onChange={(v) => updateSetting("focusMin", v)}
              />
              <Stepper
                label="短休息"
                value={settings.shortMin}
                min={1}
                max={30}
                suffix="分鐘"
                disabled={isRunning}
                onChange={(v) => updateSetting("shortMin", v)}
              />
              <Stepper
                label="長休息"
                value={settings.longMin}
                min={5}
                max={60}
                suffix="分鐘"
                disabled={isRunning}
                onChange={(v) => updateSetting("longMin", v)}
              />
              <Stepper
                label="每幾個番茄鐘長休息一次"
                value={settings.cyclesBeforeLong}
                min={2}
                max={8}
                suffix="個"
                disabled={isRunning}
                onChange={(v) => updateSetting("cyclesBeforeLong", v)}
              />

              <div className="flex items-center justify-between pt-3">
                <span className="text-sm font-medium text-[#7a4a3a]">結束時桌面通知</span>
                {notifyEnabled ? (
                  <span className="text-xs font-semibold text-[#2f6b52]">已開啟 ✓</span>
                ) : (
                  <button
                    type="button"
                    onClick={requestNotifications}
                    className="rounded-full bg-[#D3F3E4] px-3 py-1 text-xs font-semibold text-[#2f6b52] transition hover:brightness-105"
                  >
                    開啟通知
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between pt-3">
                <span className="text-sm font-medium text-[#7a4a3a]">今日紀錄</span>
                <button
                  type="button"
                  onClick={() => writePersisted({ completedToday: 0 })}
                  className="rounded-full bg-[#FFE1E1] px-3 py-1 text-xs font-semibold text-[#c9635f] transition hover:brightness-105"
                >
                  重設為 0
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
