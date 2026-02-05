/**
 * YieldIntentForm
 * 
 * Form untuk create yield intent langsung di Sui Move contract
 * Tanpa cross-chain, deposit SUI langsung ke protocol
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useMutateYieldIntent } from '@/features/intent';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { motion } from 'framer-motion';
import { ArrowRight, Wallet, AlertCircle, Check } from 'lucide-react';

interface YieldIntentFormProps {
  onIntentCreated?: (id: string) => void;
}

const PROTOCOLS = [
  { id: 'scallop', name: 'Scallop', apy: 8.5, color: 'text-orange-400' },
  { id: 'navi', name: 'Navi', apy: 7.8, color: 'text-blue-400' },
  { id: 'any', name: 'Any Protocol', apy: 8.0, color: 'text-emerald-400' },
];

export function YieldIntentForm({ onIntentCreated }: YieldIntentFormProps) {
  const account = useCurrentAccount();
  const { mutate: createIntent, isPending, error, reset, data } = useMutateYieldIntent();

  const [amount, setAmount] = useState('');
  const [minApy, setMinApy] = useState('');
  const [deadline, setDeadline] = useState('24');
  const [selectedProtocol, setSelectedProtocol] = useState('any');

  const isConnected = !!account;
  const createdId = data?.intentId;

  const handleSubmit = async () => {
    if (!amount || !account) return;

    const protocol = PROTOCOLS.find(p => p.id === selectedProtocol);
    if (!protocol) return;

    // Auto-calculate min APY jika tidak diisi (90% dari protocol APY)
    const calculatedMinApy = parseFloat(minApy) || protocol.apy * 0.9;

    const result = await createIntent({
      amount,
      minApy: calculatedMinApy,
      deadline: parseInt(deadline) || 24,
      targetProtocol: selectedProtocol,
    });

    if (result && onIntentCreated) {
      onIntentCreated(result.intentId);
    }
  };

  const resetForm = () => {
    setAmount('');
    setMinApy('');
    setDeadline('24');
    setSelectedProtocol('any');
    reset();
  };

  // ─── Success State ──────────────────────────────────────────────────────

  if (createdId) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }} 
        animate={{ opacity: 1, scale: 1 }} 
        transition={{ duration: 0.3 }}
      >
        <Card padding="lg" className="w-full max-w-lg">
          <CardContent className="space-y-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/[0.1] border border-emerald-500/25">
              <Check className="h-7 w-7 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Yield Intent Created!</h3>
              <p className="text-sm text-white/[0.4] mt-0.5">
                Your intent is live on Sui. Solvers will compete to fulfill it.
              </p>
            </div>

            {/* Detail card */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-2.5 text-left">
              <Row label="Intent ID" value={
                <span className="font-mono text-indigo-400 text-xs">
                  {createdId.slice(0, 8)}…{createdId.slice(-6)}
                </span>
              } />
              <Row label="Amount" value={`${amount} SUI`} />
              <Row label="Min APY" value={`${minApy || 'Auto'}%`} />
              <Row label="Protocol" value={selectedProtocol.toUpperCase()} />
              <Row label="Deadline" value={`${deadline}h`} />
            </div>

            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2 text-xs text-white/[0.35]">
              <Dot color="emerald" /> Created
              <Line filled />
              <Dot color="indigo" pulse /> Awaiting Solver
              <Line />
              <Dot color="muted" /> Earning Yield
            </div>

            <Button variant="outline" fullWidth onClick={resetForm}>
              Create Another Intent
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // ─── Form ───────────────────────────────────────────────────────────────

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.5 }}
    >
      <Card padding="lg" className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-xl">
            <span className="text-white">Set Your Intent.</span>{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Let Solvers Compete.
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Amount */}
          <div>
            <Input
              label="Amount to Deposit"
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              rightElement={<span className="text-sm font-medium text-white/[0.45]">SUI</span>}
              disabled={isPending}
            />
          </div>

          {/* Min APY & Deadline Row */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Min APY"
              type="number"
              placeholder="Auto"
              value={minApy}
              onChange={(e) => setMinApy(e.target.value)}
              rightElement={<span className="text-sm text-white/[0.35]">%</span>}
              disabled={isPending}
            />
            <Input
              label="Deadline"
              type="number"
              placeholder="24"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              rightElement={<span className="text-sm text-white/[0.35]">h</span>}
              disabled={isPending}
            />
          </div>

          {/* Protocol Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/[0.55]">
              Target Protocol
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PROTOCOLS.map((protocol) => (
                <button
                  key={protocol.id}
                  onClick={() => setSelectedProtocol(protocol.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedProtocol === protocol.id
                      ? 'border-indigo-500/50 bg-indigo-500/[0.08] ring-1 ring-indigo-500/30'
                      : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]'
                  }`}
                  disabled={isPending}
                >
                  <div className={`text-sm font-semibold ${protocol.color}`}>
                    {protocol.name}
                  </div>
                  <div className="text-xs text-white/[0.4] mt-0.5">
                    {protocol.apy}% APY
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Wallet warning */}
          {!isConnected && (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3.5">
              <Wallet className="h-4 w-4 shrink-0 text-amber-400" />
              <span className="text-sm text-amber-400">
                Connect your Sui wallet to continue
              </span>
            </div>
          )}

          {/* Error */}
          {error && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="flex items-center gap-2.5 rounded-xl border border-red-500/25 bg-red-500/[0.07] p-3.5"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span className="text-sm text-red-400">{error}</span>
            </motion.div>
          )}

          {/* CTA */}
          <Button
            fullWidth 
            size="lg"
            onClick={handleSubmit}
            disabled={!isConnected || !amount || isPending}
            className="group"
          >
            {isPending ? (
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Creating Intent…
              </div>
            ) : (
              <div className="flex items-center gap-2">
                Create Yield Intent
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </div>
            )}
          </Button>

          <p className="text-xs text-center text-white/[0.25]">
            Your SUI will be locked until a solver fulfills your intent
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/[0.38]">{label}</span>
      <span className="text-white/[0.75]">{value}</span>
    </div>
  );
}

function Dot({ color, pulse }: { color: 'emerald' | 'indigo' | 'muted'; pulse?: boolean }) {
  const bg = { 
    emerald: 'bg-emerald-500', 
    indigo: 'bg-indigo-500', 
    muted: 'bg-white/[0.15]' 
  };
  return (
    <span className={`h-2.5 w-2.5 rounded-full ${bg[color]} ${pulse ? 'animate-pulse' : ''}`} />
  );
}

function Line({ filled }: { filled?: boolean }) {
  return <span className={`h-px w-5 ${filled ? 'bg-white/[0.3]' : 'bg-white/[0.1]'}`} />;
}
