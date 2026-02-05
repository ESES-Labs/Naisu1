/**
 * SolverList Component
 * 
 * Display list of available solvers with stats
 */

// Solver List Component
import { SOLVERS } from '../constants';

export function SolverList() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {SOLVERS.map((solver) => (
        <div
          key={solver.id}
          className="flex items-start gap-4 p-4 bg-white border rounded-lg hover:shadow-md transition-shadow"
        >
          <span className="text-3xl">{solver.icon}</span>
          <div className="flex-1">
            <h4 className="font-semibold" style={{ color: solver.color }}>
              {solver.name}
            </h4>
            <p className="text-sm text-gray-600 mt-1">
              {solver.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
