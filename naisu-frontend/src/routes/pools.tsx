/**
 * Cetus Pools Page
 *
 * Browse and explore available Cetus CLMM pools
 */

import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { AvailablePoolsList } from '@/components/cetus/AvailablePoolsList';
import { CetusPoolInfo } from '@/hooks/sui/useQueryCetusPools';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Copy, CheckCircle2, Droplets, ArrowRight } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/pools')({
  component: PoolsPage,
});

function PoolsPage() {
  const navigate = useNavigate();
  const [selectedPool, setSelectedPool] = useState<CetusPoolInfo | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl min-h-screen">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <Droplets className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Cetus Pools</h1>
            <p className="text-white/50">Explore available liquidity pools</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: '/test-cetus' })}
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Test Swap
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Pools List */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2"
        >
          <AvailablePoolsList
            onSelectPool={setSelectedPool}
            selectedPoolAddress={selectedPool?.poolAddress}
          />
        </motion.div>

        {/* Right: Pool Details */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-1"
        >
          {selectedPool ? (
            <Card className="sticky top-6">
              <CardContent className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    Pool Details
                  </h3>
                  <p className="text-sm text-white/50">
                    Selected pool information
                  </p>
                </div>

                {/* Token Pair */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-white/[0.03] border border-white/[0.08]">
                    <div className="flex items-center -space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm font-bold text-white ring-2 ring-[#0b0e14] z-10">
                        {selectedPool.coinASymbol?.[0] || 'A'}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold text-white ring-2 ring-[#0b0e14]">
                        {selectedPool.coinBSymbol?.[0] || 'B'}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-white">
                        {selectedPool.coinASymbol} / {selectedPool.coinBSymbol}
                      </div>
                      <div className="text-xs text-white/40">
                        Trading Pair
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pool Address */}
                <div className="space-y-2">
                  <label className="text-xs text-white/50 uppercase tracking-wider">
                    Pool Address
                  </label>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.08]">
                    <code className="flex-1 text-xs font-mono text-white/70 break-all">
                      {selectedPool.poolAddress}
                    </code>
                    <button
                      onClick={() => handleCopy(selectedPool.poolAddress, 'pool')}
                      className="shrink-0 p-1.5 rounded hover:bg-white/[0.05] transition-colors"
                    >
                      {copiedField === 'pool' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4 text-white/40" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Coin Type A */}
                <div className="space-y-2">
                  <label className="text-xs text-white/50 uppercase tracking-wider">
                    Coin Type A ({selectedPool.coinASymbol})
                  </label>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.08]">
                    <code className="flex-1 text-xs font-mono text-white/70 break-all">
                      {selectedPool.coinTypeA}
                    </code>
                    <button
                      onClick={() => handleCopy(selectedPool.coinTypeA, 'coinA')}
                      className="shrink-0 p-1.5 rounded hover:bg-white/[0.05] transition-colors"
                    >
                      {copiedField === 'coinA' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4 text-white/40" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Coin Type B */}
                <div className="space-y-2">
                  <label className="text-xs text-white/50 uppercase tracking-wider">
                    Coin Type B ({selectedPool.coinBSymbol})
                  </label>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.08]">
                    <code className="flex-1 text-xs font-mono text-white/70 break-all">
                      {selectedPool.coinTypeB}
                    </code>
                    <button
                      onClick={() => handleCopy(selectedPool.coinTypeB, 'coinB')}
                      className="shrink-0 p-1.5 rounded hover:bg-white/[0.05] transition-colors"
                    >
                      {copiedField === 'coinB' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4 text-white/40" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/[0.08]">
                  <div className="p-3 rounded-lg bg-white/[0.03]">
                    <div className="text-xs text-white/40 mb-1">Fee Rate</div>
                    <div className="text-lg font-semibold text-white">
                      {(selectedPool.feeRate / 10000).toFixed(2)}%
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.03]">
                    <div className="text-xs text-white/40 mb-1">Tick Spacing</div>
                    <div className="text-lg font-semibold text-white">
                      {selectedPool.tickSpacing}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.03] col-span-2">
                    <div className="text-xs text-white/40 mb-1">Current Tick</div>
                    <div className="text-lg font-semibold text-white font-mono">
                      {selectedPool.currentTickIndex}
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <Button
                  fullWidth
                  onClick={() => {
                    navigate({
                      to: '/test-cetus',
                      search: { poolId: selectedPool.poolAddress }
                    });
                  }}
                  className="mt-4"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Use This Pool
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Droplets className="h-12 w-12 text-white/20 mx-auto mb-4" />
                <p className="text-sm text-white/40">
                  Select a pool to view details
                </p>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}
