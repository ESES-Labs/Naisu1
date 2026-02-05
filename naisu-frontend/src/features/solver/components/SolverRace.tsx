/**
 * SolverRace Component
 *
 * Animated solver competition display
 */

// Solver Race Component
import { SolverCompetition } from '../types';
import { formatApy } from '@/features/intent/utils/formatters';

interface SolverRaceProps {
  competition: SolverCompetition | null;
  isBidding: boolean;
}

export function SolverRace({ competition, isBidding }: SolverRaceProps) {
  if (!competition || competition.bids.length === 0) {
    return (
      <div className="p-8 text-center text-white/[0.4]">
        {isBidding ? (
          <div className="animate-pulse">
            <p className="text-2xl mb-2">🏁</p>
            <p>Solvers are preparing...</p>
          </div>
        ) : (
          <p>Waiting for competition to start...</p>
        )}
      </div>
    );
  }

  const sortedBids = [...competition.bids].sort((a, b) => b.apy - a.apy);
  const winner = competition.winningBid;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Solver Competition</h3>
        {isBidding && (
          <span className="animate-pulse text-sm text-indigo-400 font-medium">
            🔴 LIVE BIDDING
          </span>
        )}
      </div>

      {/* Race Track */}
      <div className="space-y-2">
        {sortedBids.map((bid, index) => (
          <BidRow
            key={bid.solverId}
            bid={bid}
            rank={index + 1}
            isWinner={winner?.solverId === bid.solverId}
            isBidding={isBidding}
          />
        ))}
      </div>

      {winner && (
        <div className="mt-4 p-4 bg-emerald-500/[0.08] border border-emerald-500/25 rounded-lg">
          <p className="text-center">
            <span className="text-2xl">🏆</span>
          </p>
          <p className="text-center font-bold text-emerald-400">
            {winner.solverName} wins with {formatApy(winner.apy * 100)}!
          </p>
        </div>
      )}
    </div>
  );
}

interface BidRowProps {
  bid: { solverId: string; solverName: string; protocol?: string; apy: number };
  rank: number;
  isWinner: boolean;
  isBidding: boolean;
}

// Helper to get protocol badge
function getProtocolBadge(protocol?: string) {
  // Infer protocol from solver name if not provided
  const proto = protocol || 'unknown';

  if (proto.toLowerCase().includes('scallop')) {
    return {
      label: 'Token-based',
      icon: '✅',
      className: 'bg-blue-500/[0.15] text-blue-300 border-blue-500/25',
      tooltip: 'Returns sSUI token (transferable)'
    };
  }

  if (proto.toLowerCase().includes('navi')) {
    return {
      label: 'Managed',
      icon: '📊',
      className: 'bg-emerald-500/[0.15] text-emerald-300 border-emerald-500/25',
      tooltip: 'Position held by solver'
    };
  }

  return {
    label: 'Protocol',
    icon: '⚡',
    className: 'bg-gray-500/[0.15] text-gray-300 border-gray-500/25',
    tooltip: 'Multi-protocol strategy'
  };
}

function BidRow({ bid, rank, isWinner, isBidding }: BidRowProps) {
  const getRankIcon = () => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `${rank}️⃣`;
    }
  };

  return (
    <div
      className={`
        relative flex items-center justify-between p-3 rounded-lg transition-all duration-300
        ${isWinner ? 'bg-emerald-500/[0.08] border-2 border-emerald-500/25' : 'border border-white/[0.08] bg-white/[0.03]'}
        ${rank === 1 && isBidding ? 'animate-pulse' : ''}
      `}
    >
      {/* Progress bar background */}
      <div
        className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-indigo-500/[0.08] to-transparent rounded-lg transition-all duration-500"
        style={{ width: `${Math.max(20, 100 - rank * 15)}%` }}
      />

      {/* Content */}
      <div className="relative flex items-center gap-3 z-10">
        <span className="text-xl">{getRankIcon()}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-white/[0.7]">{bid.solverName}</p>
            {(() => {
              const badge = getProtocolBadge(bid.protocol || bid.solverName);
              return (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${badge.className}`}
                  title={badge.tooltip}
                >
                  {badge.icon} {badge.label}
                </span>
              );
            })()}
          </div>
          {rank === 1 && isBidding && (
            <p className="text-xs text-indigo-400">Leading...</p>
          )}
        </div>
      </div>

      <div className="relative z-10">
        <span className={`text-xl font-bold ${rank === 1 ? 'text-emerald-400' : 'text-white/[0.7]'}`}>
          {formatApy(bid.apy * 100)}
        </span>
      </div>
    </div>
  );
}
