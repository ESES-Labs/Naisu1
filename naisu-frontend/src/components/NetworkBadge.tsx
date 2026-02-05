/**
 * Network Badge Component
 * 
 * Simple badge showing current network (testnet/mainnet)
 * Use this in headers, cards, or anywhere network info is needed
 */

import React from 'react';
import { useNetworkConfig } from '../hooks/useNetworkConfig';

export interface NetworkBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const NetworkBadge: React.FC<NetworkBadgeProps> = ({ 
  size = 'md', 
  showLabel = true,
  className = '' 
}) => {
  const { network, isTestnet } = useNetworkConfig();

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium
        border transition-colors
        ${isTestnet 
          ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' 
          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        }
        ${sizeClasses[size]}
        ${className}
      `}
    >
      <span 
        className={`
          w-1.5 h-1.5 rounded-full
          ${isTestnet ? 'bg-yellow-400' : 'bg-emerald-400'}
        `} 
      />
      {showLabel && <span className="capitalize">{network}</span>}
    </span>
  );
};

export default NetworkBadge;
