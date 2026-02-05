/**
 * Bridge Feature
 * 
 * Cross-chain bridging functionality
 */

// Components
export { SuiBridge } from './components/SuiBridge';

// SUI Hooks
export { useMutateBridge } from './hooks/sui/useMutateBridge';
export { useQueryAttestation } from './hooks/sui/useQueryAttestation';

// Backward compatibility aliases
import { useMutateBridge } from './hooks/sui/useMutateBridge';
import { useQueryAttestation } from './hooks/sui/useQueryAttestation';
export { useMutateBridge as useInitBridge };
export { useQueryAttestation as usePollAttestation };
