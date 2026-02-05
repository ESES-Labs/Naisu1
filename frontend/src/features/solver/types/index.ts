/**
 * Solver Feature Types
 * 
 * Type definitions for solver bots and competition
 */

export interface Solver {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface SolverBid {
  solverId: string;
  solverName: string;
  apy: number;
  timestamp: number;
  confidence: number;
}

export interface SolverCompetition {
  intentId: string;
  bids: SolverBid[];
  winningBid?: SolverBid;
  status: 'BIDDING' | 'FINISHED' | 'TIMEOUT';
  startedAt: number;
  endedAt?: number;
}

export interface SolverStats {
  solverId: string;
  totalBids: number;
  winningBids: number;
  averageApy: number;
  winRate: number;
}
