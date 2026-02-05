/**
 * Intent Feature
 * 
 * Yield intent creation and management
 */

// Components
export { IntentForm } from './components/IntentForm';
export { YieldIntentForm } from './components/YieldIntentForm';
export { StrategySelector } from './components/StrategySelector';
export { ProgressTracker } from './components/ProgressTracker';
export { IntentCard } from './components/IntentCard';

// SUI Hooks
export { useMutateYieldIntent } from './hooks/sui/useMutateYieldIntent';
export { useMutateCreateIntentApi } from './hooks/sui/useMutateCreateIntentApi';
export { useQueryIntentList } from './hooks/sui/useQueryIntentList';
export { useQueryIntentStatus } from './hooks/sui/useQueryIntentStatus';
export { useQueryStrategies } from './hooks/sui/useQueryStrategies';

// EVM Hooks
export { useMutateEvmIntent } from './hooks/evm/useMutateEvmIntent';
export { useQueryEvmUserIntents } from './hooks/evm/useQueryEvmUserIntents';
export { useTestHook } from './hooks/evm/useTestHook';

// Backward compatibility aliases
import { useMutateYieldIntent } from './hooks/sui/useMutateYieldIntent';
import { useMutateCreateIntentApi } from './hooks/sui/useMutateCreateIntentApi';
import { useQueryIntentStatus } from './hooks/sui/useQueryIntentStatus';
import { useQueryStrategies } from './hooks/sui/useQueryStrategies';
export { useMutateYieldIntent as useYieldIntent };
export { useMutateCreateIntentApi as useCreateIntentApi };
export { useQueryIntentStatus as useIntentStatus };
export { useQueryStrategies as useStrategies };

// Types
export type { 
  YieldIntent, 
  CreateIntentInput, 
  IntentReceipt, 
  Bid,
  CreateYieldIntentInput,
  YieldIntentResult
} from './types';
