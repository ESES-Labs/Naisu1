/**
 * AI Feature
 * 
 * AI-powered chat and intent detection
 */

// Components
export { AIChat } from './components/AIChat';

// Hooks
export { useMutateAIChat } from './hooks/useMutateAIChat';

// Backward compatibility aliases
import { useMutateAIChat } from './hooks/useMutateAIChat';
export { useMutateAIChat as useAIChat };

// Types
export type { ChatRequest, ChatResponse } from './hooks/useMutateAIChat';
