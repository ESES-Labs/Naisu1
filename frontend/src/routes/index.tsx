import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { IntentForm } from '@/components/IntentForm'
import { ProgressTracker } from '@/components/ProgressTracker'
import { AnimatePresence, motion } from 'framer-motion'
import { Zap, Shield, Globe, TrendingUp, Activity, Bot, Coins } from 'lucide-react'
import { AIChat } from '@/components/AIChat'
import { SuiBridge } from '@/components/SuiBridge'

export const Route = createFileRoute('/')({
  component: HomePage,
} as any)

function HomePage() {
  const [activeIntentId, setActiveIntentId] = useState<string | null>(null)
  const [mode, setMode] = useState<'manual' | 'ai' | 'bridge'>('manual')

  return (
    <div className="mx-auto max-w-6xl">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="mb-8 text-center"
      >
        {/* Live badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-1.5 mb-5">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm text-emerald-400 font-medium">Live on Base Sepolia</span>
        </div>

        <h1 className="mb-4 text-5xl font-bold tracking-tighter text-white sm:text-6xl lg:text-7xl leading-none">
          One Intent.
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Any Chain.
          </span>
        </h1>
        <p className="mx-auto max-w-xl text-base text-white/45 leading-relaxed">
          Express what you want. Naisu handles the swap, bridge, and yield deposit — automatically across EVM and Sui.
        </p>
      </motion.div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="mb-14 flex flex-wrap items-center justify-center gap-4 sm:gap-7"
      >
        <Stat icon={Activity} label="Volume" value="$2.4M" />
        <div className="h-3.5 w-px bg-white/[0.12]" />
        <Stat icon={Globe} label="Chains" value="5" />
        <div className="h-3.5 w-px bg-white/[0.12]" />
        <Stat icon={TrendingUp} label="Best APY" value="12%" />
        <div className="h-3.5 w-px bg-white/[0.12]" />
        <Stat icon={Zap} label="Protocols" value="4" />
      </motion.div>

      {/* Mode Switcher */}
      <div className="flex justify-center mb-10">
        <div className="bg-white/[0.05] p-1 rounded-xl border border-white/[0.05] flex gap-1">
          <ModeButton active={mode === 'manual'} onClick={() => setMode('manual')} icon={Zap}>Intent</ModeButton>
          <ModeButton active={mode === 'bridge'} onClick={() => setMode('bridge')} icon={Coins}>Bridge</ModeButton>
          <ModeButton active={mode === 'ai'} onClick={() => setMode('ai')} icon={Bot}>AI Agent</ModeButton>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex items-start justify-center h-full">
          <AnimatePresence mode="wait">
            {mode === 'manual' && (
              <motion.div key="manual" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="w-full max-w-lg">
                <IntentForm onIntentCreated={setActiveIntentId} />
              </motion.div>
            )}
            {mode === 'bridge' && (
              <motion.div key="bridge" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full max-w-lg">
                <SuiBridge />
              </motion.div>
            )}
            {mode === 'ai' && (
              <motion.div key="ai" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-lg h-[600px]">
                <AIChat onIntentFound={(intent) => {
                  console.log("AI Intent:", intent);
                  setMode('manual');
                }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-start justify-center">
          <ProgressTracker intentId={activeIntentId} />
        </div>
      </div>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mt-18 grid gap-4 sm:grid-cols-3"
        style={{ marginTop: '4.5rem' }}
      >
        <Feature icon={Zap} title="One-Click Migration" desc="Express your intent once. Swaps, bridges, and deposits handled for you." />
        <Feature icon={Shield} title="Non-Custodial" desc="You sign every step. No private keys on our side, ever." />
        <Feature icon={Globe} title="Cross-Chain" desc="EVM ↔ Sui via Wormhole CCTP. Native USDC, zero wrapping." />
      </motion.div>

      {/* Protocol logos */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.55 }}
        className="mt-14 text-center"
      >
        <p className="mb-5 text-xs font-medium uppercase tracking-widest text-white/[0.22]">Powered by</p>
        <div className="flex flex-wrap items-center justify-center gap-7">
          {['Uniswap V4', 'Wormhole', 'Scallop', 'Navi', 'Sui'].map((n) => (
            <div key={n} className="flex items-center gap-2 text-white/[0.28] hover:text-white/50 transition-colors">
              <div className="h-7 w-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-xs font-bold text-white/50">{n[0]}</div>
              <span className="text-sm font-medium">{n}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Stat({ icon: Icon, label, value }: { icon: typeof Zap; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-white/[0.25]" />
      <span className="text-sm text-white/[0.35]">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  )
}

function Feature({ icon: Icon, title, desc }: { icon: typeof Zap; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 text-center hover:border-white/[0.14] transition-colors">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/[0.12] border border-indigo-500/[0.2]">
        <Icon className="h-5 w-5 text-indigo-400" />
      </div>
      <h3 className="mb-1.5 text-sm font-semibold text-white">{title}</h3>
      <p className="text-xs text-white/[0.38] leading-relaxed">{desc}</p>
    </div>
  )
}

function ModeButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: any; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all
        ${active ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'}
      `}
    >
      <Icon className={`h-4 w-4 ${active ? 'text-white' : 'currentColor'}`} />
      {children}
    </button>
  )
}
