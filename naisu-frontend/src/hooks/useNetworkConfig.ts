/**
 * Network Configuration Hook
 * 
 * Manages network state (testnet/mainnet) and provides correct
 * contract addresses based on the selected network.
 */

import { useState, useMemo, useCallback } from 'react';

export type Network = 'testnet' | 'mainnet';

export interface ProtocolAddresses {
  scallop?: {
    package: string;
    market: string;
    version?: string;
  };
  navi?: {
    package: string;
    storage: string;
  };
  cetus?: {
    core: string;
    factory: string;
  };
  deepbook?: {
    package: string;
  };
}

export interface NetworkConfig {
  network: Network;
  rpcUrl: string;
  explorerUrl: string;
  intentPackage: string;
  protocolAddresses: ProtocolAddresses;
  supportedProtocols: string[];
}

const NETWORK_CONFIGS: Record<Network, NetworkConfig> = {
  testnet: {
    network: 'testnet',
    rpcUrl: import.meta.env.VITE_TESTNET_RPC_URL || 'https://fullnode.testnet.sui.io:443',
    explorerUrl: import.meta.env.VITE_TESTNET_EXPLORER || 'https://suiscan.xyz/testnet',
    intentPackage: import.meta.env.VITE_TESTNET_INTENT_PACKAGE || '0xa3a26135f436323ea0fe00330fbdcd188f2c07bf33a5ee4c49aa736cea88a71f',
    protocolAddresses: {
      deepbook: {
        package: '0x000000000000000000000000000000000000000000000000000000000000dee9',
      },
    },
    supportedProtocols: ['Native Staking', 'DeepBook'],
  },
  mainnet: {
    network: 'mainnet',
    rpcUrl: import.meta.env.VITE_MAINNET_RPC_URL || 'https://fullnode.mainnet.sui.io:443',
    explorerUrl: import.meta.env.VITE_MAINNET_EXPLORER || 'https://suiscan.xyz/mainnet',
    intentPackage: import.meta.env.VITE_MAINNET_INTENT_PACKAGE || '',
    protocolAddresses: {
      scallop: {
        package: import.meta.env.VITE_MAINNET_SCALLOP_PACKAGE || '0xd384ded6b9e7f4d2c4c9007b0291ef88fbfed8e709bce83d2da69de2d79d013d',
        market: import.meta.env.VITE_MAINNET_SCALLOP_MARKET || '0xa757975255146dc9686aa823b7838b507f315d704f428cbadad2f4ea061939d9',
      },
      navi: {
        package: import.meta.env.VITE_MAINNET_NAVI_PACKAGE || '0xee0041239b89564ce870a7dec5ddc5d114367ab94a1137e90aa0633cb76518e0',
        storage: import.meta.env.VITE_MAINNET_NAVI_STORAGE || '0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe',
      },
      cetus: {
        core: import.meta.env.VITE_MAINNET_CETUS_CORE || '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb',
        factory: import.meta.env.VITE_MAINNET_CETUS_FACTORY || '0x25ebb9a7c50eb17b3fa9c5a30fb8b5ad8f97caaf4928943acbcff7153dfee5e3',
      },
      deepbook: {
        package: '0x000000000000000000000000000000000000000000000000000000000000dee9',
      },
    },
    supportedProtocols: ['Cetus', 'Scallop', 'Navi', 'DeepBook', 'Native Staking'],
  },
};

export function useNetworkConfig() {
  // Get initial network from env or default to testnet
  const [network, setNetwork] = useState<Network>(() => {
    const envNetwork = import.meta.env.VITE_SUI_NETWORK as Network;
    return envNetwork === 'mainnet' ? 'mainnet' : 'testnet';
  });

  const config = useMemo(() => NETWORK_CONFIGS[network], [network]);

  const switchNetwork = useCallback((newNetwork: Network) => {
    setNetwork(newNetwork);
    // Optionally persist to localStorage
    localStorage.setItem('naisu-network', newNetwork);
  }, []);

  const toggleNetwork = useCallback(() => {
    setNetwork(prev => {
      const newNetwork = prev === 'testnet' ? 'mainnet' : 'testnet';
      localStorage.setItem('naisu-network', newNetwork);
      return newNetwork;
    });
  }, []);

  // Check if a protocol is available on current network
  const isProtocolAvailable = useCallback((protocol: string): boolean => {
    return config.supportedProtocols.includes(protocol);
  }, [config.supportedProtocols]);

  // Get explorer URL for a transaction
  const getTxExplorerUrl = useCallback((digest: string): string => {
    return `${config.explorerUrl}/tx/${digest}`;
  }, [config.explorerUrl]);

  // Get explorer URL for an object
  const getObjectExplorerUrl = useCallback((objectId: string): string => {
    return `${config.explorerUrl}/object/${objectId}`;
  }, [config.explorerUrl]);

  return {
    network,
    config,
    switchNetwork,
    toggleNetwork,
    isProtocolAvailable,
    getTxExplorerUrl,
    getObjectExplorerUrl,
    isTestnet: network === 'testnet',
    isMainnet: network === 'mainnet',
  };
}

export default useNetworkConfig;
