/**
 * useSolverCompetition Hook
 * 
 * Hook for managing solver competition state
 * Can be used with real solvers or mocked for demo
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SolverBid, SolverCompetition } from '../types';
import { SOLVERS } from '../constants';

interface UseSolverCompetitionProps {
  intentId: string;
  minApy: number;
  marketApy: number;
  enabled?: boolean;
  mockMode?: boolean;
}

interface UseSolverCompetitionReturn {
  competition: SolverCompetition | null;
  isBidding: boolean;
  winner: SolverBid | null;
}

export function useSolverCompetition({
  intentId,
  minApy,
  marketApy,
  enabled = true,
  mockMode = true,
}: UseSolverCompetitionProps): UseSolverCompetitionReturn {
  const [competition, setCompetition] = useState<SolverCompetition | null>(null);
  const [isBidding, setIsBidding] = useState(false);
  const [winner, setWinner] = useState<SolverBid | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const generateMockBid = useCallback((solverId: string, solverName: string): SolverBid => {
    // Generate realistic bid based on market conditions
    const solverProfit = 0.2 + Math.random() * 0.3; // 0.2% - 0.5% profit
    const bidApy = marketApy - solverProfit;

    return {
      solverId,
      solverName,
      apy: Math.round(bidApy * 100) / 100,
      timestamp: Date.now(),
      confidence: 0.8 + Math.random() * 0.2,
    };
  }, [marketApy, minApy]);

  const startCompetition = useCallback(() => {
    if (!enabled) return;

    setIsBidding(true);
    setWinner(null);
    
    const newCompetition: SolverCompetition = {
      intentId,
      bids: [],
      status: 'BIDDING',
      startedAt: Date.now(),
    };
    setCompetition(newCompetition);

    if (mockMode) {
      // Mock bidding sequence
      let bidCount = 0;
      const maxBids = 5 + Math.floor(Math.random() * 5); // 5-10 bids

      intervalRef.current = setInterval(() => {
        setCompetition((prev) => {
          if (!prev) return null;

          const randomSolver = SOLVERS[Math.floor(Math.random() * SOLVERS.length)];
          const newBid = generateMockBid(randomSolver.id, randomSolver.name);

          // Check if this solver already bid
          const existingBidIndex = prev.bids.findIndex(b => b.solverId === randomSolver.id);
          let updatedBids;

          if (existingBidIndex >= 0) {
            // Update existing bid with better rate
            updatedBids = [...prev.bids];
            if (newBid.apy > updatedBids[existingBidIndex].apy) {
              updatedBids[existingBidIndex] = newBid;
            }
          } else {
            updatedBids = [...prev.bids, newBid];
          }

          bidCount++;

          // Check if competition should end
          if (bidCount >= maxBids) {
            const winner = updatedBids.reduce((best, current) => 
              current.apy > best.apy ? current : best
            );
            setWinner(winner);
            setIsBidding(false);
            if (intervalRef.current) clearInterval(intervalRef.current);

            return {
              ...prev,
              bids: updatedBids,
              winningBid: winner,
              status: 'FINISHED',
              endedAt: Date.now(),
            };
          }

          return {
            ...prev,
            bids: updatedBids,
          };
        });
      }, 800 + Math.random() * 1200); // Random interval 0.8-2s
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, generateMockBid, intentId, mockMode]);

  useEffect(() => {
    const cleanup = startCompetition();
    return cleanup;
  }, [startCompetition]);

  return {
    competition,
    isBidding,
    winner,
  };
}
