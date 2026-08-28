"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

const PALETTE = [
  "#FFD1DC", // 粉紅
  "#FFE8B3", // 奶油黃
  "#C8F4DE", // 薄荷綠
  "#BEE3F8", // 天空藍
  "#E3D1FF", // 薰衣草紫
  "#FFCBA4", // 蜜桃橘
  "#B5F1E0", // 海洋綠
  "#FDCFE8", // 泡泡糖粉
];

const DEFAULT_NAMES = ["水餃", "水餃", "披薩","水餃", "披薩","水餃", "披薩","水餃", "披薩", "果汁"];

type Winner = { name: string; index: number };

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const p1 = polarToCartesian(cx, cy, r, startAngle);
  const p2 = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;
}

const RIM_DOTS = Array.from({ length: 20 }, (_, i) => (360 / 20) * i);
const CONFETTI_COLORS = PALETTE;

type ConfettiPiece = {
  left: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
};

function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: 16 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    duration: 1.6 + Math.random() * 1,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    rotate: Math.random() * 360,
  }));
}

const SPIN_DURATION_MS = 4400;
const TICK_COUNT = 20;

// 音效與語音：讓還不識字的孩子也能靠聲音知道結果。
function playTick(ctx: AudioContext) {
  const duration = 0.03;
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 2200;
  const gain = ctx.createGain();
  gain.gain.value = 0.18;
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
}

function playSuccessChime(ctx: AudioContext) {
  const now = ctx.currentTime;
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = now + i * 0.13;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}

// 行動瀏覽器（尤其 iOS Safari）要求語音合成必須在使用者手勢中同步呼叫過一次
// 才會「解鎖」，之後才能在計時器等非同步流程裡正常發聲。這裡在點擊當下用一句
// 無聲的句子預先解鎖，讓轉盤停止後的 speakWinner() 呼叫不會被手機瀏覽器擋掉。
function warmUpSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const warmUp = new SpeechSynthesisUtterance(" ");
    warmUp.volume = 0;
    window.speechSynthesis.speak(warmUp);
  } catch {
    // 不支援語音合成時，安靜地忽略。
  }
}

function speakWinner(name: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`恭喜抽到 ${name}`);
    utterance.lang = "zh-TW";
    utterance.rate = 0.95;
    utterance.pitch = 1.15;
    const zhVoice = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.toLowerCase().startsWith("zh"));
    if (zhVoice) utterance.voice = zhVoice;
    window.speechSynthesis.speak(utterance);
  } catch {
    // 語音合成不可用時，安靜地忽略，不影響轉盤功能。
  }
}

type SavedList = { id: string; name: string; raw: string };
type ListsState = { lists: SavedList[]; activeId: string | null };

const LISTS_STORAGE_KEY = "jun-tools-lottery-lists";
const DEFAULT_LISTS_STATE: ListsState = { lists: [], activeId: null };

/**
 * 儲存的名單清單放在 React state 之外，用 useSyncExternalStore 讀寫，
 * 這樣第一次在伺服器端渲染時可以先用空清單（跟 client 端 hydrate 當下一致），
 * 之後再從 localStorage 讀到實際內容時會自動觸發重新渲染，
 * 不需要在 effect 裡直接呼叫 setState。
 */
let listsCache: ListsState | null = null;
const listsListeners = new Set<() => void>();

function readLists(): ListsState {
  if (typeof window === "undefined") return DEFAULT_LISTS_STATE;
  try {
    const raw = window.localStorage.getItem(LISTS_STORAGE_KEY);
    if (!raw) return DEFAULT_LISTS_STATE;
    const parsed = JSON.parse(raw) as Partial<ListsState>;
    if (!Array.isArray(parsed.lists)) return DEFAULT_LISTS_STATE;
    return { lists: parsed.lists, activeId: parsed.activeId ?? null };
  } catch {
    return DEFAULT_LISTS_STATE;
  }
}

function subscribeLists(listener: () => void) {
  listsListeners.add(listener);
  return () => listsListeners.delete(listener);
}

function getListsSnapshot(): ListsState {
  if (listsCache === null) listsCache = readLists();
  return listsCache;
}

function getServerListsSnapshot(): ListsState {
  return DEFAULT_LISTS_STATE;
}

function writeLists(next: ListsState) {
  listsCache = next;
  try {
    window.localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 忽略寫入失敗（例如私密瀏覽模式）。
  }
  listsListeners.forEach((listener) => listener());
}

function makeListId() {
  return `list-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function LotteryPage() {
  const { lists, activeId } = useSyncExternalStore(
    subscribeLists,
    getListsSnapshot,
    getServerListsSnapshot,
  );

  const [rawOverride, setRawOverride] = useState<string | null>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [removeAfterWin, setRemoveAfterWin] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [soundOn, setSoundOn] = useState(true);

  const winnerIndexRef = useRef<number | null>(null);
  const namesSnapshotRef = useRef<string[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const tickTimeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const activeList = lists.find((l) => l.id === activeId) ?? null;
  const rawInput = rawOverride ?? (activeList ? activeList.raw : DEFAULT_NAMES.join("\n"));
  const hasUnsavedChanges = activeList !== null && rawInput !== activeList.raw;

  const loadList = (list: SavedList) => {
    if (spinning) return;
    setRawOverride(null);
    writeLists({ lists, activeId: list.id });
  };

  const deleteList = (id: string) => {
    const target = lists.find((l) => l.id === id);
    if (!target) return;
    if (!window.confirm(`確定要刪除「${target.name}」這份清單嗎？`)) return;
    if (activeId === id) setRawOverride(null);
    writeLists({
      lists: lists.filter((l) => l.id !== id),
      activeId: activeId === id ? null : activeId,
    });
  };

  const saveAsNewList = () => {
    const name = newListName.trim();
    if (!name) return;
    const newList: SavedList = { id: makeListId(), name, raw: rawInput };
    writeLists({ lists: [...lists, newList], activeId: newList.id });
    setRawOverride(null);
    setNewListName("");
    setShowSaveForm(false);
  };

  const updateActiveList = () => {
    if (!activeList) return;
    writeLists({
      lists: lists.map((l) => (l.id === activeList.id ? { ...l, raw: rawInput } : l)),
      activeId: activeList.id,
    });
    setRawOverride(null);
  };

  const restoreExample = () => {
    setRawOverride(null);
    writeLists({ lists, activeId: null });
  };

  const clearAll = () => {
    setRawOverride("");
    writeLists({ lists, activeId: null });
  };

  useEffect(() => {
    return () => {
      tickTimeoutIdsRef.current.forEach(clearTimeout);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const ensureAudioContext = useCallback(() => {
    if (audioCtxRef.current) {
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    }
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    audioCtxRef.current = ctx;
    return ctx;
  }, []);

  const names = useMemo(
    () =>
      rawInput
        .split(/[\n,，、]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [rawInput],
  );

  const n = names.length;
  const seg = n > 0 ? 360 / n : 360;
  const canSpin = n >= 2 && !spinning;

  const fontSize = n <= 4 ? 22 : n <= 6 ? 18 : n <= 10 ? 15 : 12;

  const removeNameAt = (index: number) => {
    const next = names.filter((_, i) => i !== index);
    setRawOverride(next.join("\n"));
  };

  const spin = useCallback(() => {
    if (n < 2 || spinning) return;

    if (soundOn) warmUpSpeech();

    const idx = Math.floor(Math.random() * n);
    winnerIndexRef.current = idx;
    namesSnapshotRef.current = names;

    const theta = idx * seg + seg / 2;
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const target = (360 - theta + jitter + 360) % 360;
    const current = rotation % 360;
    const extraSpins = 6 + Math.floor(Math.random() * 3);
    const delta = ((target - current + 360) % 360) + extraSpins * 360;

    setWinner(null);
    setSpinning(true);
    setRotation((r) => r + delta);

    if (soundOn) {
      const ctx = ensureAudioContext();
      if (ctx) {
        tickTimeoutIdsRef.current.forEach(clearTimeout);
        tickTimeoutIdsRef.current = Array.from({ length: TICK_COUNT }, (_, i) => {
          const progress = i / (TICK_COUNT - 1);
          const t = SPIN_DURATION_MS * progress * progress * 0.97;
          return setTimeout(() => playTick(ctx), t);
        });
      }
    }
  }, [n, spinning, names, seg, rotation, soundOn, ensureAudioContext]);

  const handleTransitionEnd = () => {
    if (!spinning) return;
    setSpinning(false);
    tickTimeoutIdsRef.current.forEach(clearTimeout);
    tickTimeoutIdsRef.current = [];
    const idx = winnerIndexRef.current;
    const snapshot = namesSnapshotRef.current;
    if (idx !== null && snapshot[idx] !== undefined) {
      const name = snapshot[idx];
      setWinner({ name, index: idx });
      setConfetti(makeConfetti());
      if (soundOn) {
        const ctx = ensureAudioContext();
        if (ctx) playSuccessChime(ctx);
        setTimeout(() => speakWinner(name), 350);
      }
      if (removeAfterWin) {
        const next = snapshot.filter((_, i) => i !== idx);
        setRawOverride(next.join("\n"));
      }
    }
  };

  return (
    <div className="mesh-bg min-h-dvh w-full px-4 py-8 sm:py-12">
      <div
        aria-hidden
        className="grain-overlay pointer-events-none fixed inset-0 z-0 opacity-[0.05]"
      />
      <div className="relative z-10 mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-[#a8785e] hover:text-[#7a4a3a] transition"
          >
            ← 回首頁
          </Link>
          <button
            type="button"
            onClick={() => setSoundOn((v) => !v)}
            aria-pressed={soundOn}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-sm font-semibold text-[#7a4a3a] shadow-sm transition hover:brightness-105"
          >
            {soundOn ? "🔊 音效開" : "🔇 音效關"}
          </button>
        </div>

        <header className="mb-8 text-center">
          <h1 className="flex items-center justify-center gap-2 text-3xl font-extrabold text-[#7a4a3a] sm:text-4xl">
            <span>🎡</span> 妹妹吃吃喝喝抽獎機 <span>🎈</span>
          </h1>
          <p className="mt-2 text-[#a8785e]">輸入這次的名單，轉一轉，看看幸運食物是誰！</p>
        </header>

        <div className="grid items-start gap-8 lg:grid-cols-[340px_1fr]">
          {/* 名單輸入區 */}
          <section className="rounded-3xl border border-white bg-white/80 p-6 shadow-[0_10px_30px_rgba(190,150,120,0.15)] backdrop-blur">
            {/* 我的清單 */}
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-[#7a4a3a]">📋 我的清單</span>
                <button
                  type="button"
                  disabled={spinning}
                  onClick={() => setShowSaveForm((v) => !v)}
                  className="rounded-full bg-[#D3F3E4] px-3 py-1 text-xs font-semibold text-[#2f6b52] transition hover:brightness-105 disabled:opacity-60"
                >
                  ➕ 新增清單
                </button>
              </div>

              {showSaveForm && (
                <div className="mb-3 flex gap-2">
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="清單名稱，例如：午餐吃什麼"
                    className="min-w-0 flex-1 rounded-full border-2 border-[#FFE1EC] bg-[#FFFBF6] px-3 py-1.5 text-sm text-[#5b4636] placeholder:text-[#c9ab9a] outline-none focus:border-[#FFB3C6]"
                  />
                  <button
                    type="button"
                    disabled={!newListName.trim()}
                    onClick={saveAsNewList}
                    className="shrink-0 rounded-full bg-[#FFD3E0] px-3 py-1.5 text-sm font-semibold text-[#7a4a3a] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    儲存
                  </button>
                </div>
              )}

              {lists.length === 0 ? (
                <p className="text-xs text-[#c9ab9a]">
                  還沒有儲存的清單，輸入名單後按「新增清單」建立第一份吧！
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {lists.map((list) => (
                    <span
                      key={list.id}
                      className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-3 pr-1.5 text-sm font-semibold shadow-sm transition ${
                        list.id === activeId
                          ? "bg-[#FFB3C6] text-white"
                          : "bg-[#FFE1EC] text-[#7a4a3a] hover:brightness-105"
                      }`}
                    >
                      <button
                        type="button"
                        disabled={spinning}
                        onClick={() => loadList(list)}
                        className="disabled:opacity-60"
                      >
                        {list.name}
                      </button>
                      <button
                        type="button"
                        disabled={spinning}
                        onClick={() => deleteList(list.id)}
                        aria-label={`刪除 ${list.name}`}
                        className="grid h-4 w-4 place-items-center rounded-full bg-white/60 text-[10px] leading-none text-[#5b4636] transition hover:bg-white disabled:opacity-60"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <label className="mb-2 block text-sm font-bold text-[#7a4a3a]">
              本次名單（一行一位，或用逗號分隔）
            </label>
            <textarea
              value={rawInput}
              onChange={(e) => setRawOverride(e.target.value)}
              disabled={spinning}
              rows={6}
              placeholder={"小明\n小華\n小美"}
              className="w-full resize-none rounded-2xl border-2 border-[#FFE1EC] bg-[#FFFBF6] p-3 text-[#5b4636] placeholder:text-[#c9ab9a] outline-none focus:border-[#FFB3C6] disabled:opacity-60"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#a8785e]">共 {n} 位</span>
              <div className="flex flex-wrap gap-2">
                {hasUnsavedChanges && (
                  <button
                    type="button"
                    disabled={spinning}
                    onClick={updateActiveList}
                    className="rounded-full bg-[#FFE9A8] px-3 py-1 text-xs font-semibold text-[#8a5a12] transition hover:brightness-105 disabled:opacity-60"
                  >
                    💾 更新「{activeList?.name}」
                  </button>
                )}
                <button
                  type="button"
                  disabled={spinning}
                  onClick={restoreExample}
                  className="rounded-full bg-[#F3E8FF] px-3 py-1 text-xs font-semibold text-[#7a5aa8] transition hover:brightness-105 disabled:opacity-60"
                >
                  還原範例
                </button>
                <button
                  type="button"
                  disabled={spinning}
                  onClick={clearAll}
                  className="rounded-full bg-[#FFE1E1] px-3 py-1 text-xs font-semibold text-[#c9635f] transition hover:brightness-105 disabled:opacity-60"
                >
                  清空
                </button>
              </div>
            </div>

            {n < 2 && (
              <p className="mt-2 text-xs font-medium text-[#e08a7d]">
                請至少輸入 2 位名單才能開始抽獎哦！
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {names.map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-full py-1 pl-3 pr-1.5 text-sm font-semibold text-[#5b4636] shadow-sm"
                  style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                >
                  {name}
                  <button
                    type="button"
                    disabled={spinning}
                    onClick={() => removeNameAt(i)}
                    aria-label={`移除 ${name}`}
                    className="grid h-4 w-4 place-items-center rounded-full bg-white/70 text-[10px] leading-none text-[#5b4636] transition hover:bg-white disabled:opacity-60"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>

            <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm font-medium text-[#7a4a3a]">
              <input
                type="checkbox"
                checked={removeAfterWin}
                onChange={(e) => setRemoveAfterWin(e.target.checked)}
                className="h-4 w-4 accent-[#FF9AAE]"
              />
              抽中後從名單移除（不重複抽獎）
            </label>
          </section>

          {/* 轉盤區 */}
          <section className="flex flex-col items-center">
            <div className="relative aspect-square w-full max-w-[420px]">
              {/* 外圈裝飾（固定不轉） */}
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 400">
                <defs>
                  <linearGradient id="rimGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFC6D9" />
                    <stop offset="50%" stopColor="#FFE3B0" />
                    <stop offset="100%" stopColor="#C9E7FF" />
                  </linearGradient>
                </defs>
                <circle
                  cx="200"
                  cy="200"
                  r="192"
                  fill="none"
                  stroke="url(#rimGradient)"
                  strokeWidth="18"
                />
                {RIM_DOTS.map((angle, i) => {
                  const p = polarToCartesian(200, 200, 183, angle);
                  return (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r="6"
                      fill="#FFFBEA"
                      stroke="#FFD97D"
                      strokeWidth="1.5"
                    />
                  );
                })}
              </svg>

              {/* 轉動的色塊層 */}
              <div className="absolute inset-[16px] overflow-visible rounded-full drop-shadow-[0_8px_16px_rgba(190,150,120,0.25)]">
                <svg
                  viewBox="0 0 400 400"
                  className="h-full w-full"
                  onTransitionEnd={handleTransitionEnd}
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transformOrigin: "50% 50%",
                    transition: spinning
                      ? "transform 4.4s cubic-bezier(0.17, 0.62, 0.2, 1)"
                      : "none",
                  }}
                >
                  {n === 0 ? (
                    <circle cx="200" cy="200" r="178" fill="#FFF3E9" />
                  ) : (
                    names.map((name, i) => {
                      const start = i * seg;
                      const end = start + seg;
                      const mid = start + seg / 2;
                      const labelRadius = n <= 3 ? 90 : 118;
                      return (
                        <g key={`${name}-${i}`}>
                          <path
                            d={describeSlice(200, 200, 178, start, end)}
                            fill={PALETTE[i % PALETTE.length]}
                            stroke="#FFFFFF"
                            strokeWidth="3"
                          />
                          <g transform={`rotate(${mid} 200 200)`}>
                            <text
                              x="200"
                              y={200 - labelRadius}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize={fontSize}
                              fontWeight={700}
                              fill="#6b4a3a"
                            >
                              {name}
                            </text>
                          </g>
                        </g>
                      );
                    })
                  )}
                </svg>
              </div>

              {/* 指針 */}
              <div className="absolute left-1/2 -top-3 z-20 -translate-x-1/2 drop-shadow-md">
                <svg width="42" height="48" viewBox="0 0 40 46">
                  <path
                    d="M20 44C20 44 4 26 4 16C4 8.27 10.27 2 18 2H22C29.73 2 36 8.27 36 16C36 26 20 44 20 44Z"
                    fill="#FF9AAE"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                  />
                  <circle cx="20" cy="17" r="6.5" fill="#FFFFFF" />
                </svg>
              </div>

              {/* 中心按鈕 */}
              <button
                type="button"
                onClick={spin}
                disabled={!canSpin}
                className="absolute left-1/2 top-1/2 z-10 grid aspect-square w-[30%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-gradient-to-br from-[#FFD3E0] to-[#FFB199] text-lg font-extrabold text-[#7a4a3a] shadow-[0_6px_14px_rgba(190,120,110,0.35)] transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100 sm:text-xl"
              >
                {spinning ? "轉動中…" : "抽獎"}
              </button>
            </div>

            <p className="mt-6 text-sm font-medium text-[#a8785e]">
              {n < 2 ? "先在左邊輸入名單吧！" : "點擊中間按鈕開始抽食物 🎉"}
            </p>
          </section>
        </div>
      </div>

      {/* 中獎彈窗 */}
      {winner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#7a4a3a]/30 p-4 backdrop-blur-sm"
          onClick={() => setWinner(null)}
        >
          <div
            className="lottery-pop relative w-full max-w-sm overflow-hidden rounded-3xl bg-gradient-to-b from-white to-[#FFF6E9] px-8 py-10 text-center shadow-2xl sm:px-12 sm:py-12"
            onClick={(e) => e.stopPropagation()}
          >
            {confetti.map((c, i) => (
              <span
                key={i}
                className="lottery-confetti"
                style={{
                  left: `${c.left}%`,
                  backgroundColor: c.color,
                  animationDelay: `${c.delay}s`,
                  animationDuration: `${c.duration}s`,
                  transform: `rotate(${c.rotate}deg)`,
                }}
              />
            ))}
            <div className="mb-2 text-5xl">🎉</div>
            <p className="mb-1 text-sm font-bold text-[#c98a5e]">恭喜中獎</p>
            <p className="mb-6 break-words text-3xl font-extrabold text-[#7a4a3a] sm:text-4xl">
              {winner.name}
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setWinner(null)}
                className="rounded-full bg-[#FFD3E0] px-5 py-2 font-semibold text-[#7a4a3a] shadow transition hover:brightness-105 active:scale-95"
              >
                關閉
              </button>
              <button
                type="button"
                disabled={names.length < 2}
                onClick={() => {
                  setWinner(null);
                  spin();
                }}
                className="rounded-full bg-gradient-to-r from-[#B5EAD7] to-[#BEE3F8] px-5 py-2 font-semibold text-[#3a6b5c] shadow transition hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                再抽一次
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes lottery-pop-in {
          0% { transform: scale(0.7); opacity: 0; }
          70% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .lottery-pop {
          animation: lottery-pop-in 0.45s cubic-bezier(0.2, 0.8, 0.3, 1.2);
        }
        @keyframes lottery-confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(220px) rotate(360deg); opacity: 0; }
        }
        .lottery-confetti {
          position: absolute;
          top: -10px;
          width: 8px;
          height: 8px;
          border-radius: 2px;
          animation-name: lottery-confetti-fall;
          animation-timing-function: ease-in;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}
