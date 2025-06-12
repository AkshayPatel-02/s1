import React, { useState, useEffect } from 'react';
import { whitelistService } from '@/services/whitelistService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle } from 'lucide-react';

interface WhitelistedVotersProps {
  pollId: number;
}

interface VoterWithStatus {
  address: string;
  status: 'valid' | 'pending' | 'expired';
  expiryDate?: Date;
}

const WhitelistedVoters: React.FC<WhitelistedVotersProps> = ({ pollId }) => {
  const [voters, setVoters] = useState<VoterWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadVoters();
  }, [pollId]);

  const loadVoters = async () => {
    setIsLoading(true);
    console.log(`Loading voters for poll ID: ${pollId}`);
    
    try {
      // Get all whitelisted addresses
      const addresses = await whitelistService.getWhitelistedAddresses(pollId);
      console.log('Whitelisted addresses in WhitelistedVoters:', addresses);
      
      // Get all signatures
      const signatures = await whitelistService.getStoredSignatures(pollId);
      console.log('Stored signatures in WhitelistedVoters:', signatures);
      
      // Create the combined list with status
      const votersWithStatus: VoterWithStatus[] = addresses.map(address => {
        const signature = signatures.find(s => s.address.toLowerCase() === address.toLowerCase());
        
        if (!signature) {
          return { address, status: 'pending' };
        }
        
        const now = Math.floor(Date.now() / 1000);
        const status = signature.expiry > now ? 'valid' : 'expired';
        
        return {
          address,
          status,
          expiryDate: new Date(signature.expiry * 1000)
        };
      });
      
      console.log('Final voters list:', votersWithStatus);
      setVoters(votersWithStatus);
      
      // If we got no voters but we know there should be some, try to add them directly
      if (votersWithStatus.length === 0 && addresses.length > 0) {
        console.log('No voters found but addresses exist, creating voters manually');
        const manualVoters = addresses.map(address => ({
          address,
          status: 'pending' as const
        }));
        console.log('Manual voters:', manualVoters);
        setVoters(manualVoters);
      }
    } catch (error) {
      console.error('Error loading voters:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return (
          <Badge variant="default" className="flex items-center gap-1 bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3" />
            <span>Valid</span>
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="flex items-center gap-1 bg-amber-100 text-amber-800">
            <Clock className="h-3 w-3" />
            <span>Pending</span>
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            <span>Expired</span>
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Whitelisted Voters</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-200 rounded"></div>
            ))}
          </div>
        ) : voters.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            No whitelisted voters found
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {voters.map((voter) => (
              <div key={voter.address} className="flex items-center justify-between p-2 border rounded-md">
                <div className="font-mono text-sm truncate">
                  {voter.address}
                </div>
                <div className="flex items-center space-x-4">
                  {voter.expiryDate && (
                    <div className="text-xs text-gray-500">
                      {voter.status === 'expired' ? 'Expired' : 'Valid until'}: {voter.expiryDate.toLocaleDateString()}
                    </div>
                  )}
                  {getStatusBadge(voter.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WhitelistedVoters; 