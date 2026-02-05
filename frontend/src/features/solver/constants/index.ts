/**
 * Solver Constants
 */

import { Solver } from '../types';

export const SOLVERS: Solver[] = [
  {
    id: 'scallop',
    name: 'Scallop Solver',
    description: 'Optimized for Scallop protocol yields',
    icon: '🌊',
    color: '#3B82F6',
  },
  {
    id: 'navi',
    name: 'Navi Solver',
    description: 'Specialized in Navi protocol strategies',
    icon: '🧭',
    color: '#10B981',
  },
  {
    id: 'aggregator',
    name: 'Aggregator Bot',
    description: 'Cross-protocol yield optimization',
    icon: '⚡',
    color: '#F59E0B',
  },
];

export const BID_DURATION = 5000; // 5 seconds for demo
export const MAX_BIDS = 8;
