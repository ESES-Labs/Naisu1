import { useState, useEffect, useCallback } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { usePublicClient } from 'wagmi';

export type IntentStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface SavedIntent {
    id: string; // EVM: orderId, Sui: intentId (object ID)
    type: 'EVM_TO_SUI' | 'SUI_TO_EVM';
    status: IntentStatus;
    timestamp: number;
    amountIn: string;
    tokenIn: string;
    tokenOut: string;
    txHash: string; // Creation transaction hash
    recipient: string;
}

const STORAGE_KEY = 'naisu_intent_history';
const EVM_BRIDGE_ADDRESS = '0xc7ECA6bb572aB9BFBa36F503D7c6c64b9fcFf2B4';

const ORDERS_ABI = [{
    "inputs": [{ "internalType": "uint252", "name": "", "type": "uint252" }],
    "name": "orders",
    "outputs": [
        { "internalType": "address", "name": "depositor", "type": "address" },
        { "internalType": "uint252", "name": "inputAmount", "type": "uint252" },
        { "internalType": "bytes32", "name": "recipientSui", "type": "bytes32" },
        { "internalType": "uint252", "name": "startOutputAmount", "type": "uint252" },
        { "internalType": "uint252", "name": "minOutputAmount", "type": "uint252" },
        { "internalType": "uint252", "name": "startTime", "type": "uint252" },
        { "internalType": "uint252", "name": "duration", "type": "uint252" },
        { "internalType": "enum IntentBridge.OrderStatus", "name": "status", "type": "uint8" }
    ],
    "stateMutability": "view",
    "type": "function"
}] as const;

export function useIntentHistory() {
    const [intents, setIntents] = useState<SavedIntent[]>([]);
    const suiClient = useSuiClient();
    const publicClient = usePublicClient();

    // Load from local storage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                setIntents(JSON.parse(stored));
            }
        } catch (e) {
            console.error("Failed to load intent history:", e);
        }
    }, []);

    const save = (newIntents: SavedIntent[]) => {
        setIntents(newIntents);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newIntents));
    };

    const addIntent = useCallback((intent: Omit<SavedIntent, 'timestamp' | 'status'>) => {
        const newIntent: SavedIntent = {
            ...intent,
            timestamp: Date.now(),
            status: 'PENDING'
        };

        // Prepend to list
        setIntents(prev => {
            // Avoid duplicates
            if (prev.some(i => i.id === newIntent.id)) return prev;
            const updated = [newIntent, ...prev];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
        });
    }, []);

    const updateStatus = useCallback((id: string, status: IntentStatus) => {
        setIntents(prev => {
            const updated = prev.map(item =>
                item.id === id ? { ...item, status } : item
            );
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
        });
    }, []);

    const clearHistory = useCallback(() => {
        setIntents([]);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    // Polling Logic
    useEffect(() => {
        const pendingIntents = intents.filter(i => i.status === 'PENDING');
        if (pendingIntents.length === 0) return;

        const checkStatus = async () => {
            let hasChanges = false;
            const updatedIntents = [...intents];

            await Promise.all(pendingIntents.map(async (intent) => {
                try {
                    if (intent.type === 'EVM_TO_SUI') {
                        // Check EVM Contract
                        if (!publicClient) return;
                        const data = await publicClient.readContract({
                            address: EVM_BRIDGE_ADDRESS,
                            abi: ORDERS_ABI,
                            functionName: 'orders',
                            args: [BigInt(intent.id)]
                        });
                        // status enum: 0=PENDING, 1=SETTLED, 2=REFUNDED
                        const statusEnum = data[7];
                        if (statusEnum === 1) {
                            const idx = updatedIntents.findIndex(i => i.id === intent.id);
                            if (idx !== -1) {
                                updatedIntents[idx] = { ...updatedIntents[idx], status: 'COMPLETED' };
                                hasChanges = true;
                            }
                        } else if (statusEnum === 2) {
                            const idx = updatedIntents.findIndex(i => i.id === intent.id);
                            if (idx !== -1) {
                                updatedIntents[idx] = { ...updatedIntents[idx], status: 'FAILED' };
                                hasChanges = true;
                            }
                        }
                    } else {
                        // Check Sui Object
                        // If object is deleted, it's claimed (or cancelled)
                        const obj = await suiClient.getObject({
                            id: intent.id,
                            options: { showContent: true }
                        });

                        if (obj.error && obj.error.code === 'deleted') {
                            // Claimed!
                            const idx = updatedIntents.findIndex(i => i.id === intent.id);
                            if (idx !== -1) {
                                updatedIntents[idx] = { ...updatedIntents[idx], status: 'COMPLETED' };
                                hasChanges = true;
                            }
                        } else if (obj.error && obj.error.code === 'notExists') {
                            // Might be invalid ID or not indexed yet? 
                            // If it was just created, it should exist. 
                            // If it's old, it might be pruned (unlikely on testnet so soon).
                        }
                    }
                } catch (e) {
                    console.error(`Failed to check status for ${intent.id}`, e);
                }
            }));

            if (hasChanges) {
                save(updatedIntents);
            }
        };

        const interval = setInterval(checkStatus, 5000); // 5s poll
        return () => clearInterval(interval);

    }, [intents, publicClient, suiClient]);

    return {
        intents,
        addIntent,
        updateStatus,
        clearHistory
    };
}
