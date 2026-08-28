import Link from "next/link";

const TOOLS = [
  {
    href: "/lottery",
    emoji: "🎡",
    title: "妹妹吃吃喝喝抽獎機",
    description: "輸入水餃和Pizza，隨機抽出水餃和Pizza",
    accent: "from-[#FFD3E0] to-[#FFE8B3]",
  },
  {
    href: "/pomodoro",
    emoji: "🍅",
    title: "姊姊休息時間番茄鐘",
    description: "今天專注休息一下，明天再放一天假，再來就放假了",
    accent: "from-[#FFC9C9] to-[#FFE1B3]",
  },
  {
    href: "/fortune",
    emoji: "🔮",
    title: "好運到不行抽籤",
    description: "隨機抽一支籤，看看今天運勢多好",
    accent: "from-[#FFE9A8] to-[#FFD1DC]",
  },
];

export default function Home() {
  return (
    <div className="mesh-bg relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="pattern-overlay pointer-events-none fixed inset-0 z-0 opacity-[0.5]"
      />
      <div
        aria-hidden
        className="grain-overlay pointer-events-none fixed inset-0 z-0 opacity-[0.05]"
      />

      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="flex items-center gap-2 text-lg font-extrabold text-[#7a4a3a]">
            <span className="text-2xl">🧰</span> Jun的小工具箱
          </span>
          <a
            href="#tools"
            className="rounded-full bg-[#FFD3E0] px-4 py-1.5 text-sm font-semibold text-[#7a4a3a] shadow-sm transition hover:brightness-105"
          >
            工具列表
          </a>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 py-20 sm:py-28">
          <div className="relative mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-white/70 px-4 py-1 text-xs font-bold tracking-wide text-[#a8785e] shadow-sm">
              小巧、好玩、隨時可用
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight text-[#7a4a3a] sm:text-6xl">
              Jun 的
              <span className="bg-gradient-to-r from-[#FF9AAE] to-[#FFC93C] bg-clip-text text-transparent">
                小工具箱
              </span>
            </h1>
            <p className="mt-4 text-base text-[#a8785e] sm:text-lg">
              收集我做的好玩又實用的小工具，打開就能直接玩、直接用。
            </p>
            <a
              href="#tools"
              className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#FFD166] to-[#FF9AAE] px-8 py-3 text-base font-extrabold text-white shadow-[0_6px_16px_rgba(255,166,110,0.4)] transition hover:brightness-105 active:scale-95"
            >
              開始探索工具 ↓
            </a>
          </div>
        </section>

        {/* Tools */}
        <section id="tools" className="scroll-mt-20 px-4 pb-24 pt-4 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-extrabold text-[#7a4a3a] sm:text-3xl">所有工具</h2>
              <p className="mt-2 text-sm text-[#a8785e] sm:text-base">
                點一下卡片，直接前往使用
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {TOOLS.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="group flex flex-col items-start gap-3 rounded-3xl border border-white bg-white/80 p-6 text-left shadow-[0_10px_30px_rgba(190,150,120,0.15)] backdrop-blur transition hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(190,150,120,0.28)]"
                >
                  <span
                    className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${tool.accent} text-3xl transition group-hover:scale-110 group-hover:rotate-3`}
                  >
                    {tool.emoji}
                  </span>
                  <span className="text-lg font-bold text-[#7a4a3a]">{tool.title}</span>
                  <span className="text-sm text-[#a8785e]">{tool.description}</span>
                  <span className="mt-auto flex items-center gap-1 pt-2 text-sm font-bold text-[#c9635f] transition group-hover:gap-2">
                    前往使用 <span className="transition group-hover:translate-x-0.5">→</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/60 bg-white/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <span className="flex items-center gap-2 text-sm font-bold text-[#7a4a3a]">
            <span className="text-lg">🧰</span> Jun的小工具箱
          </span>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-[#a8785e]">
            {TOOLS.map((tool) => (
              <Link key={tool.href} href={tool.href} className="transition hover:text-[#7a4a3a]">
                {tool.emoji} {tool.title}
              </Link>
            ))}
          </div>
          <span className="text-xs text-[#c9ab9a]">用 ❤️ 打造的小工具收藏</span>
        </div>
      </footer>
    </div>
  );
}
