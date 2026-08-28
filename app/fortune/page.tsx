"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Category = { icon: string; label: string; text: string };

type Tier = {
  name: string;
  weight: number;
  icon: string;
  summary: string;
  gradient: string;
  text: string;
  ring: string;
  categories: Category[];
};

const TIERS: Tier[] = [
  {
    name: "小吉有感",
    weight: 18,
    icon: "🙂",
    summary: "小小的好運正在發芽，記得抬頭看看它",
    gradient: "from-[#D6F0FF] to-[#BEE3F8]",
    text: "text-[#2f5c8a]",
    ring: "#7FB8E8",
    categories: [
      { icon: "💰", label: "財運", text: "撿到一枚十元硬幣的等級，開心一整天" },
      { icon: "❤️", label: "愛情", text: "喜歡的人可能會已讀你的訊息（先別急著失望）" },
      { icon: "📚", label: "學業工作", text: "小事情會很順，大事情⋯⋯隨緣" },
      { icon: "🌿", label: "健康", text: "精神還算不錯，記得多喝水就更好" },
    ],
  },
  {
    name: "吉上加吉",
    weight: 16,
    icon: "🍀",
    summary: "好運疊好運，今天走路都有風",
    gradient: "from-[#D3F3E4] to-[#B5EAD7]",
    text: "text-[#2f6b52]",
    ring: "#7FC8A9",
    categories: [
      { icon: "💰", label: "財運", text: "發票中個兩百塊，可以喝杯手搖慶祝一下" },
      { icon: "❤️", label: "愛情", text: "曖昧對象主動傳訊息，心臟先準備好" },
      { icon: "📚", label: "學業工作", text: "計畫超前進度，主管眼神充滿讚賞" },
      { icon: "🌿", label: "健康", text: "睡得香吃得下，整個人容光煥發" },
    ],
  },
  {
    name: "大大吉",
    weight: 14,
    icon: "🌟",
    summary: "好運不只一次，是連環爆發",
    gradient: "from-[#FFE1B3] to-[#FFCB8E]",
    text: "text-[#8a5a2c]",
    ring: "#FFB35C",
    categories: [
      { icon: "💰", label: "財運", text: "路上撿到一個超好停的車位，還是最前面那格" },
      { icon: "❤️", label: "愛情", text: "告白成功率上升，勇敢說出口吧" },
      { icon: "📚", label: "學業工作", text: "提案一次通過，掌聲差點忘記停" },
      { icon: "🌿", label: "健康", text: "體力爆棚，運動效果加倍明顯" },
    ],
  },
  {
    name: "吉到發亮",
    weight: 13,
    icon: "💡",
    summary: "整個人都在發光，走到哪都被注意到",
    gradient: "from-[#FFE9A8] to-[#FFD166]",
    text: "text-[#8a5a12]",
    ring: "#FFC93C",
    categories: [
      { icon: "💰", label: "財運", text: "老闆突然說要加薪，先確認一下不是在做夢" },
      { icon: "❤️", label: "愛情", text: "被稱讚今天特別好看，心情整個飛起來" },
      { icon: "📚", label: "學業工作", text: "靈感像開了水龍頭一樣關不住" },
      { icon: "🌿", label: "健康", text: "皮膚狀態、氣色通通在線，自帶濾鏡" },
    ],
  },
  {
    name: "吉哇哇哇超吉",
    weight: 12,
    icon: "🤩",
    summary: "吉到讓人忍不住尖叫，哇哇哇太扯了吧",
    gradient: "from-[#FFD1DC] to-[#FFB3C6]",
    text: "text-[#8a3b4f]",
    ring: "#FF9AAE",
    categories: [
      { icon: "💰", label: "財運", text: "刮刮樂連中兩張，開始懷疑自己是財神轉世" },
      { icon: "❤️", label: "愛情", text: "命中注定的人，說不定今天就出現" },
      { icon: "📚", label: "學業工作", text: "隨口一個點子被瘋狂採用，超有成就感" },
      { icon: "🌿", label: "健康", text: "整個人像充飽電，做什麼都不會累" },
    ],
  },
  {
    name: "吉吉吉吉到不行",
    weight: 11,
    icon: "🥳",
    summary: "吉到語無倫次，只會一直說吉吉吉吉",
    gradient: "from-[#E5D9FA] to-[#D3C2F2]",
    text: "text-[#5c3f8a]",
    ring: "#B79CE0",
    categories: [
      { icon: "💰", label: "財運", text: "錢包像有自動補血功能，怎麼花都花不完的錯覺" },
      { icon: "❤️", label: "愛情", text: "全世界的粉紅泡泡都聚集在你身邊" },
      { icon: "📚", label: "學業工作", text: "做什麼都一次過，同事都搶著跟你組隊" },
      { icon: "🌿", label: "健康", text: "連感冒都不敢靠近你，運氣強到當防護罩" },
    ],
  },
  {
    name: "宇宙級爆吉",
    weight: 9,
    icon: "🚀",
    summary: "好運已經超出地球範圍，直接連上宇宙訊號",
    gradient: "from-[#C9E7FF] to-[#B79CE0]",
    text: "text-[#4a3c7a]",
    ring: "#9AA8E8",
    categories: [
      { icon: "💰", label: "財運", text: "中獎機率被宇宙特別關照，錢包快裝不下" },
      { icon: "❤️", label: "愛情", text: "緣分直接從銀河系另一端寄過來" },
      { icon: "📚", label: "學業工作", text: "靈感等級突破天際，隊友都懷疑你是外星人" },
      { icon: "🌿", label: "健康", text: "精神好到能量爆表，感覺能舉起地球" },
    ],
  },
  {
    name: "祖先都忍不住幫你按讚的終極大吉",
    weight: 7,
    icon: "👑",
    summary: "連祖先都在天上默默按讚，今天就是你的封神日",
    gradient: "from-[#FFD166] via-[#FF9AAE] to-[#B79CE0]",
    text: "text-[#7a4a12]",
    ring: "#FFD166",
    categories: [
      { icon: "💰", label: "財運", text: "銀行密碼都能哼成主題曲，因為錢包快樂到爆" },
      { icon: "❤️", label: "愛情", text: "緣分自動排隊等你翻牌，桃花開好開滿" },
      { icon: "📚", label: "學業工作", text: "每個決定都對，履歷可以直接寫「本日封神」" },
      { icon: "🌿", label: "健康", text: "連醫生看了都說「你是不是作弊了」" },
    ],
  },
];

const TOTAL_WEIGHT = TIERS.reduce((sum, t) => sum + t.weight, 0);

function pickTier(): Tier {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const tier of TIERS) {
    if (r < tier.weight) return tier;
    r -= tier.weight;
  }
  return TIERS[TIERS.length - 1];
}

const DRAW_DELAY_MS = 650;

export default function FortunePage() {
  const [drawing, setDrawing] = useState(false);
  const [result, setResult] = useState<Tier | null>(null);
  const [showTable, setShowTable] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const draw = () => {
    if (drawing) return;
    setDrawing(true);
    setResult(null);
    timeoutRef.current = setTimeout(() => {
      setResult(pickTier());
      setDrawing(false);
    }, DRAW_DELAY_MS);
  };

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
            <span>🔮</span> 好運到不行抽籤 <span>🎋</span>
          </h1>
          <p className="mt-2 text-[#a8785e]">隨機抽一支籤，看看今天運勢多好</p>
        </header>

        <section className="rounded-3xl border border-white bg-white/80 p-6 shadow-[0_10px_30px_rgba(190,150,120,0.15)] backdrop-blur sm:p-10">
          {!result ? (
            <div className="flex flex-col items-center py-6">
              <div className="grid h-40 w-40 place-items-center rounded-full bg-gradient-to-br from-[#FFE9A8] via-[#FFD1DC] to-[#BEE3F8] shadow-[0_10px_30px_rgba(190,150,120,0.25)]">
                <span
                  className={`text-6xl ${drawing ? "fortune-shake" : "fortune-float"}`}
                >
                  🔮
                </span>
              </div>
              <button
                type="button"
                onClick={draw}
                disabled={drawing}
                className="mt-8 rounded-full bg-gradient-to-r from-[#FFD166] to-[#FF9AAE] px-10 py-3 text-lg font-extrabold text-white shadow-[0_6px_16px_rgba(255,166,110,0.45)] transition hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {drawing ? "抽籤中…" : "抽籤"}
              </button>
              <p className="mt-4 text-sm text-[#a8785e]">
                {drawing ? "籤筒搖一搖…" : "點擊上方按鈕，抽出今天的運勢"}
              </p>
            </div>
          ) : (
            <div className="fortune-pop flex flex-col items-center py-2">
              <div
                className={`grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br ${result.gradient} text-5xl shadow-[0_10px_24px_rgba(190,150,120,0.3)]`}
                style={{ boxShadow: `0 0 0 4px white, 0 0 0 7px ${result.ring}` }}
              >
                {result.icon}
              </div>
              <p className={`mt-4 text-4xl font-extrabold ${result.text}`}>{result.name}</p>
              <p className="mt-2 text-center text-sm font-medium text-[#a8785e]">
                {result.summary}
              </p>

              <div className="mt-6 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                {result.categories.map((c) => (
                  <div
                    key={c.label}
                    className={`rounded-2xl bg-gradient-to-br ${result.gradient} p-4 text-left`}
                  >
                    <p className={`text-sm font-bold ${result.text}`}>
                      {c.icon} {c.label}
                    </p>
                    <p className="mt-1 text-sm text-[#5b4636]">{c.text}</p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={draw}
                className="mt-8 rounded-full bg-[#FFD3E0] px-8 py-2.5 font-semibold text-[#7a4a3a] shadow transition hover:brightness-105 active:scale-95"
              >
                再抽一次
              </button>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-3xl border border-white bg-white/80 p-6 shadow-[0_10px_30px_rgba(190,150,120,0.15)] backdrop-blur">
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="flex w-full items-center justify-between text-sm font-bold text-[#7a4a3a]"
          >
            <span>📜 籤詩對照表</span>
            <span className="text-xs text-[#a8785e]">{showTable ? "收合 ▲" : "展開 ▼"}</span>
          </button>

          {showTable && (
            <div className="mt-4 divide-y divide-[#FFE1EC]">
              {TIERS.map((tier) => (
                <div key={tier.name} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex items-center gap-2">
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br ${tier.gradient} text-base`}
                    >
                      {tier.icon}
                    </span>
                    <span className={`text-sm font-bold ${tier.text}`}>{tier.name}</span>
                  </span>
                  <span className="text-xs text-[#a8785e]">{tier.summary}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <style>{`
        @keyframes fortune-float {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-6px) rotate(2deg); }
        }
        .fortune-float {
          display: inline-block;
          animation: fortune-float 3s ease-in-out infinite;
        }
        @keyframes fortune-shake {
          0%, 100% { transform: rotate(0deg) scale(1); }
          20% { transform: rotate(-10deg) scale(1.05); }
          40% { transform: rotate(10deg) scale(1.05); }
          60% { transform: rotate(-8deg) scale(1.05); }
          80% { transform: rotate(8deg) scale(1.05); }
        }
        .fortune-shake {
          display: inline-block;
          animation: fortune-shake 0.6s ease-in-out infinite;
        }
        @keyframes fortune-pop-in {
          0% { transform: scale(0.85); opacity: 0; }
          70% { transform: scale(1.03); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .fortune-pop {
          animation: fortune-pop-in 0.4s cubic-bezier(0.2, 0.8, 0.3, 1.2);
        }
      `}</style>
    </div>
  );
}
