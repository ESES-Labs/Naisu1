/**
 * AvailablePoolsList Component
 *
 * Displays available Cetus pools with filtering and selection
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQueryCetusPools, CetusPoolInfo } from '@/hooks/sui/useQueryCetusPools';
import { Loader2, Search, ExternalLink, Droplets, TrendingUp, Layers } from 'lucide-react';
import { motion } from 'framer-motion';

interface AvailablePoolsListProps {
  onSelectPool?: (pool: CetusPoolInfo) => void;
  selectedPoolAddress?: string;
  filterByTokens?: string[]; // e.g. ['SUI', 'USDC']
}

export function AvailablePoolsList({
  onSelectPool,
  selectedPoolAddress,
  filterByTokens
}: AvailablePoolsListProps) {
  const { data: pools, isLoading, error, refetch } = useQueryCetusPools();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter pools
  const filteredPools = pools?.filter((pool) => {
    // Search filter
    const matchesSearch = !searchQuery ||
      pool.coinASymbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pool.coinBSymbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pool.poolAddress.toLowerCase().includes(searchQuery.toLowerCase());

    // Token filter
    const matchesTokens = !filterByTokens || filterByTokens.length === 0 ||
      filterByTokens.some(token =>
        pool.coinASymbol?.toUpperCase().includes(token.toUpperCase()) ||
        pool.coinBSymbol?.toUpperCase().includes(token.toUpperCase())
      );

    return matchesSearch && matchesTokens;
  }) || [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-400 mb-3" />
          <p className="text-sm text-white/50">Loading available pools...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-500/20 bg-red-500/[0.05]">
        <CardContent className="p-6 text-center space-y-3">
          <p className="text-sm text-red-400">Failed to load pools</p>
          <p className="text-xs text-white/40">{(error as Error).message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="mt-2"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!pools || pools.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-white/50">No pools found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-indigo-400" />
          <span>Available Pools ({filteredPools.length})</span>
        </CardTitle>
        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              placeholder="Search by token or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
        {filteredPools.map((pool) => (
          <PoolCard
            key={pool.poolAddress}
            pool={pool}
            isSelected={pool.poolAddress === selectedPoolAddress}
            onSelect={() => onSelectPool?.(pool)}
          />
        ))}

        {filteredPools.length === 0 && (
          <div className="text-center py-8 text-white/40 text-sm">
            No pools match your search
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PoolCard({
  pool,
  isSelected,
  onSelect
}: {
  pool: CetusPoolInfo;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const feePercent = (pool.feeRate / 10000).toFixed(2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group relative rounded-lg border transition-all cursor-pointer ${isSelected
          ? 'border-indigo-500/50 bg-indigo-500/10 ring-2 ring-indigo-500/30'
          : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.15]'
        }`}
      onClick={onSelect}
    >
      <div className="p-4 space-y-3">
        {/* Token Pair */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center -space-x-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white ring-2 ring-[#0b0e14] z-10">
                {pool.coinASymbol?.[0] || 'A'}
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white ring-2 ring-[#0b0e14]">
                {pool.coinBSymbol?.[0] || 'B'}
              </div>
            </div>
            <div>
              <div className="font-semibold text-white flex items-center gap-2">
                {pool.coinASymbol} / {pool.coinBSymbol}
                {isSelected && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    SELECTED
                  </span>
                )}
              </div>
              <div className="text-xs text-white/40 font-mono">
                {pool.poolAddress.slice(0, 8)}...{pool.poolAddress.slice(-6)}
              </div>
            </div>
          </div>

          <a
            href={`https://app.cetus.zone/pool/?tab=detail&id=${pool.poolAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ExternalLink className="h-4 w-4 text-white/40 hover:text-white/70" />
          </a>
        </div>

        {/* Pool Stats */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/[0.05]">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase">
              <TrendingUp className="h-3 w-3" />
              Fee
            </div>
            <div className="text-sm font-medium text-white/80">{feePercent}%</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase">
              <Layers className="h-3 w-3" />
              Spacing
            </div>
            <div className="text-sm font-medium text-white/80">{pool.tickSpacing}</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase">
              <Droplets className="h-3 w-3" />
              Liquidity
            </div>
            <div className="text-sm font-medium text-white/80">
              {formatLiquidity(pool.liquidity)}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function formatLiquidity(liquidity: string): string {
  try {
    const num = BigInt(liquidity);
    if (num === 0n) return '0';

    // Simple formatting for display
    const str = num.toString();
    if (str.length > 12) return `${str.slice(0, -12)}T`;
    if (str.length > 9) return `${str.slice(0, -9)}B`;
    if (str.length > 6) return `${str.slice(0, -6)}M`;
    if (str.length > 3) return `${str.slice(0, -3)}K`;
    return str;
  } catch {
    return 'N/A';
  }
}
