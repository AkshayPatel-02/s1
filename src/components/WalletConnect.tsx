import React from 'react';
import { Button } from '@/components/ui/button';
import { useWeb3 } from '@/contexts/Web3Context';
import { Wallet, LogOut } from 'lucide-react';

interface WalletConnectProps {
  scrolled?: boolean;
}

const WalletConnect: React.FC<WalletConnectProps> = ({ scrolled = false }) => {
  const { state, connectWallet, disconnectWallet } = useWeb3();

  if (state.isConnected) {
    return (
      <div className="flex items-center space-x-2">
        <div className={`text-sm font-medium px-2 py-1 rounded ${
          scrolled ? 'text-gray-700' : 'text-gray-800'
        }`}>
          {state.account?.slice(0, 6)}...{state.account?.slice(-4)}
        </div>
        <Button
          onClick={disconnectWallet}
          variant="ghost"
          size="sm"
          className="text-sm font-medium text-purple-600 hover:bg-purple-50"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={connectWallet}
      disabled={state.isLoading}
      variant="outline"
      size="sm"
      className="text-sm font-medium text-purple-600 border-purple-600 hover:bg-purple-50"
    >
      {state.isLoading ? 'Connecting...' : 'Connect Wallet'}
    </Button>
  );
};

export default WalletConnect;
