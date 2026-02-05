/**
 * Network Switcher Component
 * 
 * Dropdown untuk memilih antara Testnet dan Mainnet
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Globe, ChevronDown, Server } from 'lucide-react';
import { useNetwork, Network } from '@/contexts/NetworkContext';

export interface NetworkSwitcherProps {
  className?: string;
}

export const NetworkSwitcher: React.FC<NetworkSwitcherProps> = ({ className = '' }) => {
  const { network, setNetwork, config, isTestnet, isMainnet } = useNetwork();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNetworkChange = (newNetwork: Network) => {
    if (newNetwork !== network) {
      setNetwork(newNetwork);
    }
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Main Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm
          transition-all duration-200 border
          ${isTestnet 
            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 hover:border-yellow-500/50' 
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50'
          }
        `}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center gap-1.5">
          <Globe className="w-4 h-4" />
          <span className="capitalize hidden sm:inline">{network}</span>
        </div>
        
        <div className="flex items-center gap-1.5 ml-1 pl-1.5 border-l border-white/10">
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            animate={{
              backgroundColor: isTestnet ? '#facc15' : '#10b981',
              boxShadow: isTestnet 
                ? '0 0 6px rgba(250, 204, 21, 0.5)' 
                : '0 0 6px rgba(16, 185, 129, 0.5)'
            }}
          />
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 rounded-xl border backdrop-blur-xl w-80 z-50 shadow-2xl bg-[#0a0e1a]/95 border-white/10 overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <h3 className="text-sm font-semibold text-white">Select Network</h3>
              <p className="text-xs text-white/40 mt-0.5">
                Choose between testnet and mainnet
              </p>
            </div>

            {/* Network Options */}
            <div className="p-2 space-y-1">
              {/* Testnet Option */}
              <button
                onClick={() => handleNetworkChange('testnet')}
                className={`
                  w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all
                  ${isTestnet 
                    ? 'bg-yellow-500/10 border border-yellow-500/30' 
                    : 'hover:bg-white/[0.03] border border-transparent'
                  }
                `}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isTestnet ? 'bg-yellow-500/20' : 'bg-white/5'}`}>
                  <AlertTriangle className={`w-5 h-5 ${isTestnet ? 'text-yellow-400' : 'text-white/40'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm ${isTestnet ? 'text-yellow-400' : 'text-white/70'}`}>
                      Testnet
                    </span>
                    {isTestnet && (
                      <span className="px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-medium">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">Test tokens only. No real value.</p>
                </div>
                {isTestnet && <CheckCircle2 className="w-5 h-5 text-yellow-400 flex-shrink-0" />}
              </button>

              {/* Mainnet Option */}
              <button
                onClick={() => handleNetworkChange('mainnet')}
                className={`
                  w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all
                  ${isMainnet 
                    ? 'bg-emerald-500/10 border border-emerald-500/30' 
                    : 'hover:bg-white/[0.03] border border-transparent'
                  }
                `}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isMainnet ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
                  <CheckCircle2 className={`w-5 h-5 ${isMainnet ? 'text-emerald-400' : 'text-white/40'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm ${isMainnet ? 'text-emerald-400' : 'text-white/70'}`}>
                      Mainnet
                    </span>
                    {isMainnet && (
                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">Real SUI. Real transactions.</p>
                </div>
                {isMainnet && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
              </button>
            </div>

            {/* Protocols Info */}
            <div className="px-4 py-3 border-t border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2 mb-2">
                <Server className="w-3.5 h-3.5 text-white/30" />
                <span className="text-xs text-white/40 font-medium uppercase tracking-wider">
                  Available Protocols
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {config.supportedProtocols.map((protocol) => (
                  <span
                    key={protocol}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium ${isTestnet ? 'bg-yellow-500/10 text-yellow-400/70' : 'bg-emerald-500/10 text-emerald-400/70'}`}
                  >
                    {protocol}
                  </span>
                ))}
              </div>
            </div>

            {/* RPC Info */}
            <div className="px-4 py-2 border-t border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/30">RPC</span>
                <span className="text-white/50 font-mono truncate max-w-[180px]">
                  {config.rpcUrl.replace('https://', '')}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NetworkSwitcher;
