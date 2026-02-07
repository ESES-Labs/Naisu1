/**
 * PoolSelector Component
 *
 * Compact pool selector with modal for swap interface
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQueryCetusPools, CetusPoolInfo } from '@/hooks/sui/useQueryCetusPools';
import { Loader2, Search, ChevronDown, Check, Droplets } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PoolSelectorProps {
  selectedPool: CetusPoolInfo | null;
  onSelectPool: (pool: CetusPoolInfo) => void;
  filterByTokens?: string[];
}

export function PoolSelector({ selectedPool, onSelectPool, filterByTokens }: PoolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: pools, isLoading } = useQueryCetusPools();

  // Filter pools
  const filteredPools = pools?.filter((pool) => {
    const matchesSearch = !searchQuery ||
      pool.coinASymbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pool.coinBSymbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pool.poolAddress.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTokens = !filterByTokens || filterByTokens.length === 0 ||
      filterByTokens.some(token =>
        pool.coinASymbol?.toUpperCase().includes(token.toUpperCase()) ||
        pool.coinBSymbol?.toUpperCase().includes(token.toUpperCase())
      );

    return matchesSearch && matchesTokens;
  }) || [];

  const handleSelect = (pool: CetusPoolInfo) => {
    onSelectPool(pool);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.05] hover:border-white/[0.15] transition-all"
      >
        {selectedPool ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center -space-x-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white ring-2 ring-[#0b0e14] z-10">
                {selectedPool.coinASymbol?.[0] || 'A'}
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white ring-2 ring-[#0b0e14]">
                {selectedPool.coinBSymbol?.[0] || 'B'}
              </div>
            </div>
            <div className="text-left">
              <div className="font-semibold text-white">
                {selectedPool.coinASymbol} / {selectedPool.coinBSymbol}
              </div>
              <div className="text-xs text-white/40">
                Fee: {(selectedPool.feeRate / 10000).toFixed(2)}%
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-white/50">
            <Droplets className="h-5 w-5" />
            <span>Select a pool</span>
          </div>
        )}
        <ChevronDown className={`h-5 w-5 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 p-4 rounded-xl bg-[#0b0e14] border border-white/[0.1] shadow-2xl z-50 max-h-[400px] flex flex-col"
            >
              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  placeholder="Search pools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/[0.03]"
                  autoFocus
                />
              </div>

              {/* Pool List */}
              <div className="overflow-y-auto space-y-2 flex-1">
                {isLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-400 mb-2" />
                    <p className="text-xs text-white/40">Loading pools...</p>
                  </div>
                ) : filteredPools.length === 0 ? (
                  <div className="text-center py-8 text-white/40 text-sm">
                    No pools found
                  </div>
                ) : (
                  filteredPools.map((pool) => (
                    <button
                      key={pool.poolAddress}
                      onClick={() => handleSelect(pool)}
                      className={`w-full p-3 rounded-lg border transition-all text-left ${selectedPool?.poolAddress === pool.poolAddress
                          ? 'border-indigo-500/50 bg-indigo-500/10'
                          : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1]'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center -space-x-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[#0b0e14] z-10">
                              {pool.coinASymbol?.[0] || 'A'}
                            </div>
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[#0b0e14]">
                              {pool.coinBSymbol?.[0] || 'B'}
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-white text-sm">
                              {pool.coinASymbol} / {pool.coinBSymbol}
                            </div>
                            <div className="text-xs text-white/40">
                              Fee: {(pool.feeRate / 10000).toFixed(2)}%
                            </div>
                          </div>
                        </div>
                        {selectedPool?.poolAddress === pool.poolAddress && (
                          <Check className="h-4 w-4 text-indigo-400" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="mt-3 pt-3 border-t border-white/[0.05] flex justify-between items-center">
                <span className="text-xs text-white/40">
                  {filteredPools.length} pools available
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="text-xs"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
