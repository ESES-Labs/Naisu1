import { motion } from 'framer-motion'
import { Check, Loader2, Clock, ArrowDown } from 'lucide-react'
import { Card } from './ui/Card'
import { useIntentStatus } from '@/hooks/useApi'

// ─── Status helpers ─────────────────────────────────────────────────────────

type StepStatus = 'completed' | 'in_progress' | 'pending'

const STATUS_ORDER = ['pending', 'swap_completed', 'bridging', 'bridge_completed', 'deposited', 'completed']

function resolveSteps(apiStatus: string | undefined, evmToSui: boolean): StepStatus[] {
  const idx = apiStatus ? STATUS_ORDER.indexOf(apiStatus) : -1

  if (evmToSui) {
    // Swap | Bridge | Deposit
    return [
      idx >= 1 ? 'completed' : idx === 0 ? 'in_progress' : 'pending',
      idx >= 3 ? 'completed' : idx >= 1 ? 'in_progress' : 'pending',
      idx >= 4 ? 'completed' : idx >= 3 ? 'in_progress' : 'pending',
    ]
  }
  // Sui→EVM: Withdraw | Bridge | Arrive
  return [
    idx >= 1 ? 'completed' : idx === 0 ? 'in_progress' : 'pending',
    idx >= 3 ? 'completed' : idx >= 1 ? 'in_progress' : 'pending',
    idx >= 5 ? 'completed' : idx >= 3 ? 'in_progress' : 'pending',
  ]
}

// ─── Component ───────────────────────────────────────────────────────────────

interface ProgressTrackerProps {
  intentId: string | null
}

export function ProgressTracker({ intentId }: ProgressTrackerProps) {
  const { data: status } = useIntentStatus(intentId)

  const evmToSui = !status || !status.id || status.status === 'pending' || intentId === null
    ? true                                    // default view
    : status.id === intentId                  // always true, just keeps TS happy
      ? true                                  // we'll detect direction from status later; default EVM→Sui
      : true

  // Detect direction: if status exists, check if it has deposited → evm_to_sui, else check completed → sui_to_evm
  // For now we default to evm_to_sui. A richer check can be added once the API returns direction in status.
  const isEvmToSui = evmToSui

  const stepStatuses = resolveSteps(status?.status, isEvmToSui)

  const stepDefs = isEvmToSui
    ? [
        { label: 'V4 Swap',       desc: 'ETH → USDC on Base' },
        { label: 'CCTP Bridge',   desc: 'USDC Base → Sui' },
        { label: 'Yield Deposit', desc: 'Into Scallop / Navi' },
      ]
    : [
        { label: 'Withdraw',      desc: 'From Sui protocol' },
        { label: 'CCTP Bridge',   desc: 'USDC Sui → Base' },
        { label: 'Arrive on EVM', desc: 'USDC on Base Sepolia' },
      ]

  return (
    <Card padding="lg" className="w-full">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">
          {intentId ? 'Intent Progress' : 'How It Works'}
        </h3>
        {intentId && <span className="text-xs text-white/[0.28] font-mono">{intentId.slice(0, 8)}…</span>}
      </div>

      {/* Steps */}
      <div className="space-y-1.5">
        {stepDefs.map((step, i) => (
          <div key={step.label}>
            <StepRow label={step.label} desc={step.desc} status={stepStatuses[i]} />
            {i < stepDefs.length - 1 && (
              <div className="flex justify-center my-0.5">
                <ArrowDown className="h-4 w-4 text-white/[0.12]" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-5 border-t border-white/[0.06] flex flex-wrap gap-4 text-xs text-white/[0.3]">
        <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Completed</div>
        <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" /> In Progress</div>
        <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-white/[0.15]" /> Pending</div>
      </div>
    </Card>
  )
}

// ─── Step row ────────────────────────────────────────────────────────────────

function StepRow({ label, desc, status }: { label: string; desc: string; status: StepStatus }) {
  const theme = {
    completed:   { ring: 'border-emerald-500/40 bg-emerald-500/[0.1]',  text: 'text-emerald-400',  sub: 'text-emerald-400/60' },
    in_progress: { ring: 'border-indigo-500/40 bg-indigo-500/[0.1]',   text: 'text-indigo-300',   sub: 'text-indigo-400/50'  },
    pending:     { ring: 'border-white/[0.08]  bg-white/[0.03]',       text: 'text-white/[0.45]', sub: 'text-white/[0.25]'   },
  }[status]

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex items-center gap-3.5 rounded-xl border ${theme.ring} p-3.5`}
    >
      {/* Icon circle */}
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${theme.ring}`}>
        {status === 'completed'   && <Check   className={`h-5 w-5 ${theme.text}`} />}
        {status === 'in_progress' && <Loader2 className={`h-5 w-5 ${theme.text} animate-spin`} />}
        {status === 'pending'     && <Clock   className={`h-5 w-5 ${theme.text}`} />}
      </div>
      {/* Text */}
      <div>
        <p className={`text-sm font-medium ${theme.text}`}>{label}</p>
        <p className={`text-xs ${theme.sub}`}>{desc}</p>
      </div>
    </motion.div>
  )
}
