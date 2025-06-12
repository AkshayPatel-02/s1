import React, { useState, useEffect } from 'react';
import { alchemy } from '@/services/alchemyService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface TransactionDetailsProps {
  txHash: string;
  className?: string;
}

const TransactionDetails: React.FC<TransactionDetailsProps> = ({ txHash, className }) => {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactionDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get transaction receipt
        const receipt = await alchemy.core.getTransactionReceipt(txHash);
        
        // Get transaction details
        const tx = await alchemy.core.getTransaction(txHash);
        
        // Get block details
        const block = receipt ? await alchemy.core.getBlock(receipt.blockNumber) : null;
        
        setDetails({
          receipt,
          transaction: tx,
          block,
          confirmations: receipt?.confirmations || 0,
          status: receipt?.status === 1 ? 'success' : receipt?.status === 0 ? 'failed' : 'pending',
          timestamp: block ? new Date(block.timestamp * 1000) : null,
        });
      } catch (err: any) {
        console.error('Error fetching transaction details:', err);
        setError(err.message || 'Failed to fetch transaction details');
      } finally {
        setLoading(false);
      }
    };

    if (txHash) {
      fetchTransactionDetails();
    }
  }, [txHash]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center">
            <Clock className="w-4 h-4 mr-2" />
            Loading Transaction Details...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center text-red-500">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Error Loading Transaction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!details) return null;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center">
            {details.status === 'success' ? (
              <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
            ) : details.status === 'failed' ? (
              <AlertTriangle className="w-4 h-4 mr-2 text-red-500" />
            ) : (
              <Clock className="w-4 h-4 mr-2 text-yellow-500" />
            )}
            Transaction Details
          </div>
          <Badge variant={details.status === 'success' ? 'default' : details.status === 'failed' ? 'destructive' : 'outline'}>
            {details.status === 'success' ? 'Success' : details.status === 'failed' ? 'Failed' : 'Pending'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="font-medium">Transaction Hash:</div>
          <div className="font-mono truncate">
            <a 
              href={`https://polygonscan.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center hover:text-primary"
            >
              {txHash.slice(0, 10)}...{txHash.slice(-6)}
              <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </div>
          
          <div className="font-medium">Block:</div>
          <div>{details.receipt?.blockNumber || 'Pending'}</div>
          
          <div className="font-medium">Confirmations:</div>
          <div>{details.confirmations}</div>
          
          {details.timestamp && (
            <>
              <div className="font-medium">Timestamp:</div>
              <div>{details.timestamp.toLocaleString()}</div>
            </>
          )}
          
          <div className="font-medium">Gas Used:</div>
          <div>{details.receipt?.gasUsed?.toString() || 'N/A'}</div>
          
          <div className="font-medium">Gas Price:</div>
          <div>{details.transaction?.gasPrice ? `${(Number(details.transaction.gasPrice) / 1e9).toFixed(2)} gwei` : 'N/A'}</div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TransactionDetails; 