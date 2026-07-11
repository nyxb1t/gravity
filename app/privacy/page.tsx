import Link from "next/link"

const ArrowUpRight = () => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
    <path d="M5 15 15 5M7 5h8v8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const policySections = [
  {
    number: "01",
    title: "Information We Access",
    intro: "Gravity only accesses information needed to create your personalized workspace digest, and only after you authorize an integration.",
    items: [
      "Slack workspace metadata, plus the messages and channels you explicitly authorize.",
      "GitHub pull requests, issues, review status, and repository activity you connect.",
      "Notion pages and databases you choose to make available to Gravity.",
      "Google Calendar event titles, timing, attendees, and availability that you authorize.",
    ],
  },
  {
    number: "02",
    title: "How We Use Data",
    intro: "Gravity uses connected data solely to generate personalized workspace insights, prioritize important work, and provide contextual recommendations. This lets us surface relevant updates, pending work, and scheduling conflicts in one place.",
    items: [
      "Create your daily digest and highlight items that may need attention.",
      "Provide context across your connected work tools.",
      "Maintain, secure, and improve the Gravity service.",
    ],
  },
  {
    number: "03",
    title: "Third-Party Integrations",
    intro: "Gravity connects to Slack, GitHub, Notion, and Google Calendar through their authorized APIs. Each connection is governed by the permissions you approve and the applicable provider's own privacy terms.",
    items: [
      "We request the narrowest practical set of permissions for each integration.",
      "Gravity does not post, edit, or delete content in connected tools unless you explicitly request that action.",
      "You can review or revoke access from the connected provider at any time.",
    ],
  },
  {
    number: "04",
    title: "Data Storage",
    intro: "Gravity only stores the minimum information necessary to provide its services. We use reasonable technical and organizational safeguards to protect connected data and access credentials.",
    items: [
      "We never sell personal data or share it with advertisers.",
      "Access credentials are used only to maintain the integrations you authorize.",
      "We retain information only for as long as it is needed to provide Gravity or meet legal obligations.",
    ],
  },
  {
    number: "05",
    title: "User Control",
    intro: "You stay in control of your connected workspace. You may disconnect integrations or revoke permissions at any time through the respective providers.",
    items: [
      "Remove an integration to stop future access to that provider's data.",
      "Request access, correction, or deletion of your information by contacting us.",
      "Choose which workspaces, repositories, pages, and calendars to connect.",
    ],
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#08080b] text-white selection:bg-violet-500/40">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Gravity home">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-violet-600"><span className="h-3 w-3 rounded-full border-2 border-white/90" /></span>
          <span className="text-lg font-semibold tracking-tight">Gravity</span>
        </Link>
        <div className="hidden items-center gap-7 text-sm text-zinc-400 md:flex">
          <Link className="transition hover:text-white" href="/#features">Features</Link>
          <Link className="transition hover:text-white" href="/#how-it-works">How it Works</Link>
          <Link className="text-white" href="/privacy">Privacy</Link>
          <a className="flex items-center gap-1 transition hover:text-white" href="https://github.com" target="_blank" rel="noreferrer">GitHub <ArrowUpRight /></a>
        </div>
        <Link href="/" className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.08]">Back to Home</Link>
      </nav>

      <section className="mx-auto max-w-3xl px-6 pb-28 pt-20 sm:pb-36 sm:pt-28 lg:px-8">
        <div className="text-center">
          <p className="text-[11px] font-medium tracking-[0.14em] text-zinc-500">TRUST &amp; TRANSPARENCY</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Privacy Policy</h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty leading-7 text-zinc-400">How Gravity handles the workspace data you choose to connect.</p>
          <p className="mt-4 text-sm text-zinc-600">Last updated: July 12, 2026</p>
        </div>

        <div className="mt-14 rounded-3xl border border-white/[0.09] bg-[#0f0f12] p-6 sm:p-10">
          <div className="border-b border-white/[0.08] pb-8">
            <h2 className="text-xl font-medium tracking-tight">Our commitment</h2>
            <p className="mt-3 leading-7 text-zinc-400">Gravity is built to help you understand your work, not to monetize your information. We collect and use data only as described in this policy and only to provide the Gravity experience you request.</p>
          </div>

          <div className="divide-y divide-white/[0.08]">
            {policySections.map((section) => (
              <section key={section.title} className="py-9 first:pt-8 last:pb-0">
                <div className="flex gap-4 sm:gap-6">
                  <span className="mt-1 text-xs font-medium text-violet-300">{section.number}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-medium tracking-tight">{section.title}</h2>
                    <p className="mt-3 leading-7 text-zinc-400">{section.intro}</p>
                    <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-400">
                      {section.items.map((item) => <li key={item} className="flex gap-3"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-violet-400" />{item}</li>)}
                    </ul>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>

      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-6 border-t border-white/[0.07] px-6 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between lg:px-8"><div><span className="font-medium text-zinc-200">Gravity</span><span className="mx-2 text-zinc-700">/</span>Built for the Slack AI Hackathon.</div><div className="flex gap-5"><Link className="text-zinc-300 transition hover:text-white" href="/privacy">Privacy Policy</Link><a className="transition hover:text-white" href="https://github.com" target="_blank" rel="noreferrer">GitHub</a><a className="transition hover:text-white" href="mailto:hello@gravity.ai">Contact</a></div></footer>
    </main>
  )
}
