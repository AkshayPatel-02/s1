import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import WalletConnect from './WalletConnect';
import { useWeb3 } from '@/contexts/Web3Context';
import { toast } from '@/hooks/use-toast';

const Header: React.FC = () => {
  const { state, isRelayer } = useWeb3();
  const [isUserRelayer, setIsUserRelayer] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [prevRelayerStatus, setPrevRelayerStatus] = useState(false);

  // Check if the user is a relayer when the account changes
  useEffect(() => {
    const checkRelayerStatus = async () => {
      if (state.account) {
        const relayerStatus = await isRelayer(state.account);
        
        // Show notification when relayer status changes to true
        if (relayerStatus && !prevRelayerStatus) {
          toast({
            title: 'Admin Access Granted',
            description: 'You have connected with a relayer wallet. Admin features are now available.',
            variant: 'default',
            duration: 5000,
          });
        }
        
        setIsUserRelayer(relayerStatus);
        setPrevRelayerStatus(relayerStatus);
      } else {
        setIsUserRelayer(false);
        setPrevRelayerStatus(false);
      }
    };

    checkRelayerStatus();
  }, [state.account, state.isConnected, isRelayer]);

  // Track scroll position to add background when scrolled
  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 20;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial scroll position
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [scrolled]);

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-white/80 backdrop-blur-sm shadow-sm' : ''
    }`}>
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <div className="flex items-center">
              <img 
                src="/ScrutinX.png" 
                alt="ScrutinX Logo" 
                className="w-10 h-10 mr-3 object-contain"
              />
              <h1 className="text-2xl font-bold text-purple-600">
                ScrutinX
              </h1>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-10">
            <Link 
              to="/" 
              className={`transition-all text-sm font-medium relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 hover:after:w-full after:bg-purple-600 after:transition-all ${
                scrolled ? 'text-gray-700 hover:text-purple-600' : 'text-gray-800 hover:text-purple-600'
              }`}
            >
              Home
            </Link>
            <Link 
              to="/polls" 
              className={`transition-all text-sm font-medium relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 hover:after:w-full after:bg-purple-600 after:transition-all ${
                scrolled ? 'text-gray-700 hover:text-purple-600' : 'text-gray-800 hover:text-purple-600'
              }`}
            >
              Public Polls
            </Link>
            <Link 
              to="/private-polls" 
              className={`transition-all text-sm font-medium relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 hover:after:w-full after:bg-purple-600 after:transition-all ${
                scrolled ? 'text-gray-700 hover:text-purple-600' : 'text-gray-800 hover:text-purple-600'
              }`}
            >
              Private Polls
            </Link>
            <Link 
              to="/create" 
              className={`transition-all text-sm font-medium relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 hover:after:w-full after:bg-purple-600 after:transition-all ${
                scrolled ? 'text-gray-700 hover:text-purple-600' : 'text-gray-800 hover:text-purple-600'
              }`}
            >
              Create Poll
            </Link>
            <Link 
              to="/dashboard" 
              className={`transition-all text-sm font-medium relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 hover:after:w-full after:bg-purple-600 after:transition-all ${
                scrolled ? 'text-gray-700 hover:text-purple-600' : 'text-gray-800 hover:text-purple-600'
              }`}
            >
              Dashboard
            </Link>
            {isUserRelayer && (
              <Link 
                to="/admin" 
                className={`transition-all text-sm font-medium relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 hover:after:w-full after:bg-purple-600 after:transition-all ${
                  scrolled ? 'text-gray-700 hover:text-purple-600' : 'text-gray-800 hover:text-purple-600'
                }`}
              >
                Admin
              </Link>
            )}
          </nav>

          <WalletConnect scrolled={scrolled} />
        </div>
      </div>
    </header>
  );
};

export default Header;
