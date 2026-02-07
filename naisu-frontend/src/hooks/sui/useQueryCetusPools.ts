/**
 * useQueryCetusPools Hook
 *
 * Fetches available Cetus CLMM pools for the current network
 */

import { useQuery } from '@tanstack/react-query';
// import { CetusClmmSDK } from '@cetusprotocol/cetus-sui-clmm-sdk';
import { useNetworkConfig } from '@/hooks/useNetworkConfig';

export const queryKeyCetusPools = (network?: string) => ['cetus-pools', network];

export interface CetusPoolInfo {
  poolAddress: string;
  poolType: string;
  coinTypeA: string;
  coinTypeB: string;
  coinASymbol?: string;
  coinBSymbol?: string;
  currentSqrtPrice: string;
  currentTickIndex: number;
  feeRate: number;
  liquidity: string;
  tickSpacing: number;
}

export function useQueryCetusPools() {
  const { config } = useNetworkConfig();

  return useQuery({
    queryKey: queryKeyCetusPools(config.network),
    queryFn: async (): Promise<CetusPoolInfo[]> => {
      try {
        // For now, use direct SuiClient approach instead of SDK
        // The SDK requires complex initialization with all package IDs
        console.log('🔍 Fetching Cetus pools via registry for network:', config.network);

        // Use the registry approach from list-registry-pools.ts
        const { SuiClient } = await import('@mysten/sui/client');
        const client = new SuiClient({
          url: config.network === 'mainnet'
            ? 'https://fullnode.mainnet.sui.io:443'
            : 'https://fullnode.testnet.sui.io:443'
        });

        // Testnet pool registry (from Cetus config)
        const poolsRegistryId = config.network === 'mainnet'
          ? '0xc3ad1d87f61c0a2ca89a4d85c2cf75506cf83ea296e102a8c241228f8fe9d8ae' // mainnet
          : '0xd28736923703342b4752f5ed8c2f2a5c0cb2336c30e1fed42b387234ce8408ec'; // testnet

        const pools: CetusPoolInfo[] = [];
        let cursor: string | null | undefined = null;
        let pageCount = 0;
        const maxPages = 10; // Limit to prevent too many requests

        while (pageCount < maxPages) {
          pageCount++;
          const res = await client.getDynamicFields({
            parentId: poolsRegistryId,
            cursor,
            limit: 50
          });

          if (res.data.length === 0) break;

          cursor = res.nextCursor;

          // Get field objects
          const fieldIds = res.data.map(item => item.objectId);
          const fieldObjects = await client.multiGetObjects({
            ids: fieldIds,
            options: { showContent: true, showType: true }
          });

          // Extract pool addresses
          const poolAddresses: string[] = [];
          for (const obj of fieldObjects) {
            if (obj.data?.content?.dataType === 'moveObject') {
              const fields = (obj.data.content as any).fields;
              if (fields?.value?.fields?.pool_address) {
                poolAddresses.push(fields.value.fields.pool_address);
              }
            }
          }

          // Fetch actual pool data
          if (poolAddresses.length > 0) {
            const poolObjects = await client.multiGetObjects({
              ids: poolAddresses,
              options: { showType: true, showContent: true }
            });

            for (const poolObj of poolObjects) {
              if (poolObj.data?.type && poolObj.data?.content) {
                const poolType = poolObj.data.type;
                // Extract coin types from pool type
                // Format: PackageId::pool::Pool<CoinTypeA, CoinTypeB>
                const match = poolType.match(/<(.+?),\s*(.+?)>/);
                if (match) {
                  const [, coinTypeA, coinTypeB] = match;
                  const content = poolObj.data.content as any;

                  pools.push({
                    poolAddress: poolObj.data.objectId!,
                    poolType,
                    coinTypeA,
                    coinTypeB,
                    coinASymbol: extractSymbolFromType(coinTypeA),
                    coinBSymbol: extractSymbolFromType(coinTypeB),
                    currentSqrtPrice: content.fields?.current_sqrt_price || '0',
                    currentTickIndex: content.fields?.current_tick_index?.fields?.bits || 0,
                    feeRate: content.fields?.fee_rate || 0,
                    liquidity: content.fields?.liquidity || '0',
                    tickSpacing: content.fields?.tick_spacing || 0,
                  });
                }
              }
            }
          }

          if (!res.hasNextPage) break;
        }

        console.log('✅ Found', pools.length, 'pools');
        return pools;
      } catch (error) {
        console.error('❌ Failed to fetch Cetus pools:', error);
        throw error;
      }
    },
    staleTime: 60 * 1000, // 1 minute
    refetchOnMount: true,
    retry: 2,
  });
}

// Helper to extract symbol from coin type
function extractSymbolFromType(coinType: string): string {
  try {
    // Pattern: 0x...::module::TYPE
    const parts = coinType.split('::');
    if (parts.length >= 3) {
      return parts[parts.length - 1].toUpperCase();
    }
    return coinType.slice(0, 10) + '...';
  } catch {
    return 'UNKNOWN';
  }
}
