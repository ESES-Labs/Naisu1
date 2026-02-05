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
      <div className="p-8 text-center text-gray-500">
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
        <h3 className="text-lg font-semibold">Solver Competition</h3>
        {isBidding && (
          <span className="animate-pulse text-sm text-blue-600 font-medium">
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
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-center">
            <span className="text-2xl">🏆</span>
          </p>
          <p className="text-center font-bold text-green-700">
            {winner.solverName} wins with {formatApy(winner.apy * 100)}!
          </p>
        </div>
      )}
    </div>
  );
}

interface BidRowProps {
  bid: { solverId: string; solverName: string; apy: number };
  rank: number;
  isWinner: boolean;
  isBidding: boolean;
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
        ${isWinner ? 'bg-green-100 border-2 border-green-400' : 'bg-gray-50 border border-gray-200'}
        ${rank === 1 && isBidding ? 'animate-pulse' : ''}
      `}
    >
      {/* Progress bar background */}
      <div
        className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-blue-100 to-transparent rounded-lg transition-all duration-500"
        style={{ width: `${Math.max(20, 100 - rank * 15)}%` }}
      />

      {/* Content */}
      <div className="relative flex items-center gap-3 z-10">
        <span className="text-xl">{getRankIcon()}</span>
        <div>
          <p className="font-medium">{bid.solverName}</p>
          {rank === 1 && isBidding && (
            <p className="text-xs text-blue-600">Leading...</p>
          )}
        </div>
      </div>

      <div className="relative z-10">
        <span className={`text-xl font-bold ${rank === 1 ? 'text-green-600' : 'text-gray-700'}`}>
          {formatApy(bid.apy * 100)}
        </span>
      </div>
    </div>
  );
}
