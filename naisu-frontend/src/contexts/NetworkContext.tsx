/**
 * Network Context
 * 
 * Global network state provider that wraps the app.
 * Used by NetworkSwitcher and all network-dependent components.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

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
    core: string;           // CLMM Pool Package (MVR Package ID)
    publishedAt?: string;   // Latest PublishedAt (upgraded code)
    config?: string;        // Cetus Config Package
    integrate?: string;     // Integrate Package (router)
    globalConfig?: string;  // Global Config ID
    poolsId?: string;       // Pools object ID
    globalVault?: string;   // Global vault ID
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
    intentPackage: import.meta.env.VITE_TESTNET_INTENT_PACKAGE || '0x891304702aa2fc599ce1eaf84d8cb192a393479b28cda1ebed93db8226a71da1',
    protocolAddresses: {
      deepbook: {
        package: '0x000000000000000000000000000000000000000000000000000000000000dee9',
      },
      // Cetus Testnet - From MVR: https://www.moveregistry.com/package/@cetuspackages/clmm
      // MVR Version: 5 | GitHub Tag: testnet-v0.0.2
      cetus: {
        core: '0x5372d555ac734e272659136c2a0cd3227f9b92de67c80dc11250307268af2db8',  // MVR Package ID
        publishedAt: '0x6bbdf09f9fa0baa1524080a5b8991042e95061c4e1206217279aec51ba08edf7', // Latest PublishedAt
        config: '0xf5ff7d5ba73b581bca6b4b9fa0049cd320360abd154b809f8700a8fd3cfaf7ca',
        integrate: '0x2918cf39850de6d5d94d8196dc878c8c722cd79db659318e00bff57fbb4e2ede',
        globalConfig: '0x9774e359588ead122af1c7e7f64e14ade261cfeecdb5d0eb4a5b3b4c8ab8bd3e',
        poolsId: '0x50eb61dd5928cec5ea04711a2e9b72e5237e79e9fbcd2ce3d5469dc8708e0ee2',
        globalVault: '0xf78d2ee3c312f298882cb680695e5e8c81b1d441a646caccc058006c2851ddea',
      },
    },
    supportedProtocols: ['Native Staking', 'DeepBook', 'Cetus'],
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
      // Cetus Mainnet - From SDK: https://github.com/CetusProtocol/cetus-clmm-sui-sdk/blob/main/src/config/mainnet.ts
      cetus: {
        core: import.meta.env.VITE_MAINNET_CETUS_CORE || '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb',
        config: '0x95b8d278b876cae22206131fb9724f701c9444515813042f54f0a426c9a3bc2f',
        integrate: '0x996c4d9480708fb8b92aa7acf819fb0497b5ec8e65ba06601cae2fb6db3312c3',
        globalConfig: '0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f',
        poolsId: '0xf699e7f2276f5c9a75944b37a0c5b5d9ddfd2471bf6242483b03ab2887d198d0',
        globalVault: '0xce7bceef26d3ad1f6d9b6f13a953f053e6ed3ca77907516481ce99ae8e588f2b',
      },
      deepbook: {
        package: '0x000000000000000000000000000000000000000000000000000000000000dee9',
      },
    },
    supportedProtocols: ['Cetus', 'Scallop', 'Navi', 'DeepBook', 'Native Staking'],
  },
};

interface NetworkContextValue {
  network: Network;
  config: NetworkConfig;
  setNetwork: (network: Network) => void;
  toggleNetwork: () => void;
  isTestnet: boolean;
  isMainnet: boolean;
  isProtocolAvailable: (protocol: string) => boolean;
  getTxExplorerUrl: (digest: string) => string;
  getObjectExplorerUrl: (objectId: string) => string;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  // Get initial network from localStorage or env
  const [network, setNetworkState] = useState<Network>(() => {
    const saved = localStorage.getItem('naisu-network') as Network;
    if (saved === 'mainnet' || saved === 'testnet') return saved;
    const envNetwork = import.meta.env.VITE_SUI_NETWORK as Network;
    return envNetwork === 'mainnet' ? 'mainnet' : 'testnet';
  });

  const config = useMemo(() => NETWORK_CONFIGS[network], [network]);

  const setNetwork = useCallback((newNetwork: Network) => {
    setNetworkState(newNetwork);
    localStorage.setItem('naisu-network', newNetwork);
    // Reload page to ensure all providers refresh with new network
    window.location.reload();
  }, []);

  const toggleNetwork = useCallback(() => {
    setNetwork(network === 'testnet' ? 'mainnet' : 'testnet');
  }, [network, setNetwork]);

  const isProtocolAvailable = useCallback((protocol: string): boolean => {
    return config.supportedProtocols.includes(protocol);
  }, [config.supportedProtocols]);

  const getTxExplorerUrl = useCallback((digest: string): string => {
    return `${config.explorerUrl}/tx/${digest}`;
  }, [config.explorerUrl]);

  const getObjectExplorerUrl = useCallback((objectId: string): string => {
    return `${config.explorerUrl}/object/${objectId}`;
  }, [config.explorerUrl]);

  const value = useMemo(() => ({
    network,
    config,
    setNetwork,
    toggleNetwork,
    isTestnet: network === 'testnet',
    isMainnet: network === 'mainnet',
    isProtocolAvailable,
    getTxExplorerUrl,
    getObjectExplorerUrl,
  }), [network, config, setNetwork, toggleNetwork, isProtocolAvailable, getTxExplorerUrl, getObjectExplorerUrl]);

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return context;
}

export { NETWORK_CONFIGS };
export default NetworkContext;
