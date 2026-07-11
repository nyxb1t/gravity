"use client"

const ArrowUpRight = () => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
    <path d="M5 15 15 5M7 5h8v8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const Sparkle = () => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
    <path d="m10 1 1.8 6.2L18 9l-6.2 1.8L10 17l-1.8-6.2L2 9l6.2-1.8L10 1Z" fill="currentColor" />
  </svg>
)

const featureCards = [
  { icon: "🎯", title: "Prioritize important work", text: "Know exactly what needs your attention, before the day gets away from you." },
  { icon: "✦", title: "Workspace insights", text: "Turn signals across your tools into clear, useful next steps." },
  { icon: "◷", title: "Meetings and deadlines", text: "Keep your schedule, commitments and deadlines in one calm view." },
  { icon: "◉", title: "Team context", text: "Understand what your team is shipping, discussing and waiting on." },
  { icon: "⚡", title: "Smart alerts", text: "Get thoughtfully timed alerts when something important changes." },
]

const problems = [
  { number: "01", title: "Messages get buried.", text: "The answer you needed disappears beneath a hundred notifications." },
  { number: "02", title: "PRs get forgotten.", text: "Important reviews wait quietly while the work keeps moving." },
  { number: "03", title: "Meetings overlap.", text: "Your calendar fills up before you get a chance to protect your focus." },
  { number: "04", title: "Important work slips through.", text: "The things that matter most are often the easiest to miss." },
]

const integrations = [
  { name: "Slack", mark: "S", color: "from-fuchsia-400 to-orange-300" },
  { name: "GitHub", mark: "◒", color: "from-slate-100 to-slate-400" },
  { name: "Notion", mark: "N", color: "from-white to-slate-400" },
  { name: "Google Calendar", mark: "31", color: "from-blue-400 to-emerald-300" },
]

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#08080b] text-white selection:bg-violet-500/40">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-15%,rgba(124,58,237,0.12),transparent)]" />

      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <a href="#top" className="group flex items-center gap-2.5" aria-label="Gravity home">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-violet-600">
            <span className="h-3 w-3 rounded-full border-2 border-white/90" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Gravity</span>
        </a>
        <div className="hidden items-center gap-7 text-sm text-zinc-400 md:flex">
          <a className="transition hover:text-white" href="#features">Features</a>
          <a className="transition hover:text-white" href="#how-it-works">How it Works</a>
          <a className="transition hover:text-white" href="#privacy">Privacy</a>
          <a className="flex items-center gap-1 transition hover:text-white" href="https://github.com" target="_blank" rel="noreferrer">GitHub <ArrowUpRight /></a>
        </div>
        <a href="#how-it-works" className="rounded-full border border-white/10 bg-white/[0.07] px-4 py-2 text-sm font-medium text-white transition hover:border-violet-400/50 hover:bg-violet-500/20">Get started</a>
      </nav>

      <section id="top" className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 text-center sm:pt-28 lg:px-8 lg:pb-36">
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[430px] w-[680px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-400/[0.08] px-3.5 py-1.5 text-[11px] font-medium text-violet-200">
          <Sparkle /> Your workday, with more gravity
        </div>
        <h1 className="mx-auto max-w-5xl text-balance text-5xl font-semibold tracking-[-0.05em] sm:text-6xl lg:text-7xl">
          Everything you need to do. <span className="text-zinc-300">One focused assistant.</span>
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-pretty text-base leading-7 text-zinc-400 sm:text-lg">
          Gravity brings Slack, GitHub, Notion and Calendar into one personalized workspace digest.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="#how-it-works" className="group inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-medium transition hover:bg-violet-500">Meet Gravity <span className="transition-transform group-hover:translate-x-0.5"><ArrowUpRight /></span></a>
          <a href="#features" className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.08]">Explore features</a>
        </div>

        <div className="mx-auto mt-20 max-w-4xl rounded-2xl border border-white/10 bg-[#0f0f12] p-3 sm:p-5">
          <div className="rounded-xl border border-white/[0.08] bg-[#0b0b0e] p-5 text-left sm:p-7">
            <div className="mb-6 flex items-center justify-between"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-400/70" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" /></div><span className="text-xs text-zinc-600">YOUR DAILY DIGEST</span></div>
            <div className="grid gap-4 sm:grid-cols-[1.2fr_.8fr]">
              <div className="rounded-xl border border-violet-400/15 bg-violet-500/[0.06] p-5"><p className="text-xs font-medium uppercase tracking-[0.16em] text-violet-300">Good morning, Jacob</p><p className="mt-3 text-xl font-medium tracking-tight">Here&apos;s what needs your focus.</p><div className="mt-5 flex items-center gap-3 border-t border-white/[0.07] pt-4"><span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-500/20 text-xs text-violet-300">↗</span><p className="text-sm text-zinc-300"><span className="font-medium text-white">2 PRs</span> waiting for your review</p></div></div>
              <div className="space-y-3"><div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4"><p className="text-xs text-zinc-500">UP NEXT</p><p className="mt-1 text-sm text-zinc-200">Design sync <span className="text-zinc-500">· 10:30 AM</span></p></div><div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4"><p className="text-xs text-zinc-500">TEAM PULSE</p><p className="mt-1 text-sm text-zinc-200">3 updates from #launch</p></div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.07] bg-white/[0.018] py-28 sm:py-36">
        <div className="mx-auto max-w-7xl px-6 lg:px-8"><div className="max-w-2xl"><p className="text-[11px] font-medium tracking-[0.14em] text-zinc-500">THE PROBLEM</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Modern work is scattered.</h2></div>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{problems.map((problem) => <article key={problem.number} className="group rounded-2xl border border-white/[0.08] bg-[#0f0f12] p-5 transition duration-300 hover:-translate-y-1 hover:border-white/20"><span className="text-xs font-medium text-violet-300">{problem.number}</span><h3 className="mt-10 text-base font-medium">{problem.title}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{problem.text}</p></article>)}</div>
          <p className="mt-12 text-center text-xl font-medium tracking-tight text-zinc-300 sm:text-2xl">Gravity brings <span className="text-violet-300">everything together.</span></p>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 py-28 sm:py-36 lg:px-8"><div className="text-center"><p className="text-[11px] font-medium tracking-[0.14em] text-zinc-500">A CALMER WAY TO WORK</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">See what matters.</h2><p className="mx-auto mt-5 max-w-xl text-zinc-400">Gravity learns what matters to you, then makes the next right thing obvious.</p></div>
        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{featureCards.map((feature, index) => <article key={feature.title} className={`group rounded-2xl border border-white/[0.08] bg-[#0f0f12] p-6 transition duration-300 hover:-translate-y-1 hover:border-white/20 ${index === 0 ? "lg:col-span-2" : ""}`}><span className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-xl">{feature.icon}</span><h3 className="mt-8 text-base font-medium tracking-tight">{feature.title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">{feature.text}</p></article>)}</div>
      </section>

      <section id="how-it-works" className="border-y border-white/[0.07] bg-[#0a0a0d] py-28 sm:py-36"><div className="mx-auto max-w-7xl px-6 lg:px-8"><div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="text-[11px] font-medium tracking-[0.14em] text-zinc-500">HOW IT WORKS</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Less sorting. More doing.</h2></div><p className="max-w-sm text-sm leading-6 text-zinc-400">Set Gravity up once, then let your daily digest do the organizing.</p></div>
        <div className="mt-14 grid gap-4 md:grid-cols-4">{["Connect your tools.", "Gravity analyzes your workspace.", "Receive a personalized daily digest.", "Focus on what matters."].map((step, index) => <div key={step} className="relative rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-6"><span className="text-4xl font-semibold tracking-tighter text-violet-400/40">0{index + 1}</span><p className="mt-10 text-base font-medium leading-6">{step}</p>{index < 3 && <span className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-[#111116] text-zinc-500 md:grid">→</span>}</div>)}</div>
      </div></section>

      <section className="mx-auto max-w-7xl px-6 py-28 sm:py-36 lg:px-8"><div className="rounded-3xl border border-white/[0.09] bg-[#0f0f12] px-6 py-14 text-center sm:px-12"><p className="text-[11px] font-medium tracking-[0.14em] text-zinc-500">CONNECTED BY DESIGN</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Everything important. One workspace.</h2><div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">{integrations.map((item) => <div key={item.name} className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-[#0b0b0e] px-3 py-5 transition duration-300 hover:-translate-y-1 hover:border-white/20"><span className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${item.color} text-sm font-bold text-slate-900`}>{item.mark}</span><span className="mt-3 text-sm font-medium text-zinc-200">{item.name}</span></div>)}</div></div>
      </section>

      <section id="privacy" className="mx-auto max-w-5xl px-6 py-12 text-center sm:py-20 lg:px-8"><div className="rounded-3xl border border-violet-400/15 bg-violet-500/[0.06] px-6 py-14 sm:px-16"><div className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-violet-300/20 bg-violet-500/20 text-violet-200">⌘</div><h2 className="mt-6 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Privacy First</h2><p className="mx-auto mt-5 max-w-xl leading-7 text-zinc-400">Gravity only accesses data you explicitly authorize. Your data is never sold or shared externally.</p><a href="/privacy" className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-5 py-3 text-sm font-medium transition hover:bg-white/[0.12]">Read Privacy Policy <ArrowUpRight /></a></div>
      </section>

      <footer className="mx-auto mt-16 flex max-w-7xl flex-col gap-6 border-t border-white/[0.07] px-6 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between lg:px-8"><div><span className="font-medium text-zinc-200">Gravity</span><span className="mx-2 text-zinc-700">/</span>Built for the Slack AI Hackathon.</div><div className="flex gap-5"><a className="transition hover:text-white" href="#privacy">Privacy Policy</a><a className="transition hover:text-white" href="https://github.com" target="_blank" rel="noreferrer">GitHub</a><a className="transition hover:text-white" href="mailto:hello@gravity.ai">Contact</a></div></footer>
    </main>
  )
}
