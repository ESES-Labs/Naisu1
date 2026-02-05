/**
 * Wallet Feature
 * 
 * Wallet integration and balance fetching
 */

// Components
export { WalletButton } from './components/WalletButton';
export { WalletConnect } from './components/WalletConnect';

// SUI Hooks
export { useQueryWalletBalance as useQuerySuiWalletBalance } from './hooks/sui/useQueryWalletBalance';

// EVM Hooks
export { useQueryWalletBalance as useQueryEvmWalletBalance } from './hooks/evm/useQueryWalletBalance';
