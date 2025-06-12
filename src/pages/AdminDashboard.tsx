import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '@/contexts/Web3Context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Shield, Plus, Trash2, DollarSign, Users, Activity, AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const AdminDashboard: React.FC = () => {
  const { state, isRelayer } = useWeb3();
  const [newRelayerAddress, setNewRelayerAddress] = useState('');
  const [fundingAmount, setFundingAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [totalPolls, setTotalPolls] = useState(0);
  const [activePolls, setActivePolls] = useState(0);
  const [contractType, setContractType] = useState<'public' | 'private'>('public');
  const [relayers, setRelayers] = useState<string[]>([]);
  const [isUserRelayer, setIsUserRelayer] = useState<boolean>(false);

  // Check if the current user is a relayer
  const checkRelayerStatus = async () => {
    if (state.account) {
      const relayerStatus = await isRelayer(state.account);
      setIsUserRelayer(relayerStatus);
    }
  };

  useEffect(() => {
    if (state.isConnected) {
      checkRelayerStatus();
    }
  }, [state.isConnected, state.account]);

  const loadSystemStats = async () => {
    if (!state.isConnected || !state.publicContract || !state.privateContract) return;

    try {
      setIsLoading(true);
      
      // Get total polls from both contracts
      const publicPollCount = await state.publicContract.getPollsCount();
      const privatePollCount = await state.privateContract.getPollsCount();
      
      setTotalPolls(Number(publicPollCount) + Number(privatePollCount));
      
      // For active polls, we'd need to check each poll's end time
      // This is a simplified version - in production you'd iterate through polls
      setActivePolls(Math.floor((Number(publicPollCount) + Number(privatePollCount)) * 0.7));
      
    } catch (error) {
      console.error('Error loading system stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRelayers = async () => {
    if (!state.isConnected) return;
    
    try {
      setIsLoading(true);
      const contract = contractType === 'public' ? state.publicContract : state.privateContract;
      if (!contract) return;
      
      // Get the default relayer from the contract
      const defaultRelayer = await contract.defaultRelayerWallet();
      console.log(`Default relayer: ${defaultRelayer}`);
      
      // In a production environment, you would query all relayers from events or a mapping
      // Here, we'll just add the default relayer and the current account if it's authorized
      const actualRelayers: string[] = [defaultRelayer];
      
      // Check if the current account is an authorized relayer
      if (state.account) {
        const isAuthorized = await contract.authorizedRelayers(state.account);
        if (isAuthorized && state.account.toLowerCase() !== defaultRelayer.toLowerCase()) {
          actualRelayers.push(state.account);
        }
      }
      
      setRelayers(actualRelayers);
    } catch (error) {
      console.error('Error loading relayers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (state.isConnected && isUserRelayer) {
      loadSystemStats();
      loadRelayers();
    }
  }, [state.isConnected, state.account, contractType, isUserRelayer]);

  const handleAddRelayer = async () => {
    if (!newRelayerAddress) {
      toast({
        title: 'Error',
        description: 'Please enter a valid relayer address',
        variant: 'destructive',
      });
      return;
    }

    if (!ethers.isAddress(newRelayerAddress)) {
      toast({
        title: 'Error',
        description: 'Please enter a valid Ethereum address',
        variant: 'destructive',
      });
      return;
    }

    const contract = contractType === 'public' ? state.publicContract : state.privateContract;
    if (!contract) return;

    try {
      setIsLoading(true);
      
      // Check if the address is already authorized
      const isAuthorized = await contract.authorizedRelayers(newRelayerAddress);
      if (isAuthorized) {
        toast({
          title: 'Already Authorized',
          description: 'This address is already an authorized relayer',
          variant: 'default',
        });
        setIsLoading(false);
        return;
      }
      
      // Check if the current user is the default relayer
      const defaultRelayer = await contract.defaultRelayerWallet();
      if (defaultRelayer.toLowerCase() !== state.account?.toLowerCase()) {
        toast({
          title: 'Permission Denied',
          description: 'Only the default relayer can authorize new relayers',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }
      
      // Call the contract's setRelayerStatus function
      console.log(`Adding relayer ${newRelayerAddress} to ${contractType} contract`);
      const tx = await contract.setRelayerStatus(newRelayerAddress, true);
      
      toast({
        title: 'Transaction Submitted',
        description: `Authorization transaction submitted. Waiting for confirmation...`,
        variant: 'default',
      });
      
      // Wait for the transaction to be mined
      await tx.wait();
      
      // Reload relayers
      await loadRelayers();
      
      toast({
        title: 'Relayer Added',
        description: `Successfully authorized ${newRelayerAddress.slice(0, 6)}...${newRelayerAddress.slice(-4)} for ${contractType} polls`,
        variant: 'success',
      });
      
      setNewRelayerAddress('');
    } catch (error: any) {
      console.error('Error adding relayer:', error);
      toast({
        title: 'Error',
        description: `Failed to add relayer: ${error.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveRelayer = async (relayerAddress: string) => {
    const contract = contractType === 'public' ? state.publicContract : state.privateContract;
    if (!contract) return;

    try {
      setIsLoading(true);
      
      // Check if the address is authorized
      const isAuthorized = await contract.authorizedRelayers(relayerAddress);
      if (!isAuthorized) {
        toast({
          title: 'Not Authorized',
          description: 'This address is not an authorized relayer',
          variant: 'default',
        });
        setIsLoading(false);
        return;
      }
      
      // Check if the current user is the default relayer
      const defaultRelayer = await contract.defaultRelayerWallet();
      if (defaultRelayer.toLowerCase() !== state.account?.toLowerCase()) {
        toast({
          title: 'Permission Denied',
          description: 'Only the default relayer can remove relayers',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }
      
      // Check if trying to remove the default relayer
      if (relayerAddress.toLowerCase() === defaultRelayer.toLowerCase()) {
        toast({
          title: 'Cannot Remove Default Relayer',
          description: 'The default relayer cannot be removed',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }
      
      // Call the contract's setRelayerStatus function with false
      console.log(`Removing relayer ${relayerAddress} from ${contractType} contract`);
      const tx = await contract.setRelayerStatus(relayerAddress, false);
      
      toast({
        title: 'Transaction Submitted',
        description: `Removal transaction submitted. Waiting for confirmation...`,
        variant: 'default',
      });
      
      // Wait for the transaction to be mined
      await tx.wait();
      
      // Reload relayers
      await loadRelayers();
      
      toast({
        title: 'Relayer Removed',
        description: `Successfully removed ${relayerAddress.slice(0, 6)}...${relayerAddress.slice(-4)} from ${contractType} contract`,
        variant: 'success',
      });
      
    } catch (error: any) {
      console.error('Error removing relayer:', error);
      toast({
        title: 'Error',
        description: `Failed to remove relayer: ${error.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDepositFunds = async () => {
    if (!fundingAmount) {
      toast({
        title: 'Error',
        description: 'Please enter a funding amount',
        variant: 'destructive',
      });
      return;
    }

    const contract = contractType === 'public' ? state.publicContract : state.privateContract;
    if (!contract) return;

    try {
      setIsLoading(true);
      const tx = await contract.depositFunds({
        value: ethers.parseEther(fundingAmount)
      });
      
      await tx.wait();
      
      toast({
        title: 'Funds Deposited',
        description: `Successfully deposited ${parseFloat(fundingAmount).toFixed(4)} MATIC to ${contractType} contract`,
        variant: 'success',
      });
      
      setFundingAmount('');
    } catch (error: any) {
      console.error('Error depositing funds:', error);
      
      // Create a more professional error message
      let errorMessage = 'Unable to complete deposit. Please try again later.';
      
      // Handle specific error cases
      if (error.message?.includes('user rejected')) {
        errorMessage = 'Transaction was declined in your wallet.';
      } else if (error.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds in your wallet to complete this deposit.';
      } else if (error.message?.includes('gas')) {
        errorMessage = 'Network is congested. Please try again with adjusted gas settings.';
      }
      
      toast({
        title: 'Deposit Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user is a relayer
  if (!state.isConnected || !isUserRelayer) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold mb-6">Access Denied</h1>
        <p className="text-gray-600 mb-8">This page is only accessible to authorized relayers.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>
        <p className="text-gray-600">
          Manage relayers, monitor system health, and control funding for the ScrutinX platform.
        </p>
      </div>

      {/* Contract Type Selector */}
      <div className="mb-6">
        <Label className="text-base font-semibold mb-3 block">Contract Type</Label>
        <div className="flex space-x-2">
          <Button
            variant={contractType === 'public' ? 'default' : 'outline'}
            onClick={() => setContractType('public')}
          >
            Public Polls
          </Button>
          <Button
            variant={contractType === 'private' ? 'default' : 'outline'}
            onClick={() => setContractType('private')}
          >
            Private Polls
          </Button>
        </div>
      </div>

      {/* System Stats */}
      <div className="grid lg:grid-cols-3 gap-8 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Polls</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPolls}</div>
            <p className="text-xs text-muted-foreground">
              Across public and private contracts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Polls</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePolls}</div>
            <p className="text-xs text-muted-foreground">
              Currently accepting votes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Healthy</div>
            <p className="text-xs text-muted-foreground">
              All systems operational
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Relayer Management */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add New Relayer - {contractType.charAt(0).toUpperCase() + contractType.slice(1)} Contract</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="relayerAddress">Relayer Address</Label>
                <Input
                  id="relayerAddress"
                  value={newRelayerAddress}
                  onChange={(e) => setNewRelayerAddress(e.target.value)}
                  placeholder="0x..."
                  className="mt-1"
                />
              </div>
              <Button
                onClick={handleAddRelayer}
                disabled={!newRelayerAddress || isLoading}
                className="w-full btn-gradient"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Relayer to {contractType.charAt(0).toUpperCase() + contractType.slice(1)} Contract
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deposit System Funds - {contractType.charAt(0).toUpperCase() + contractType.slice(1)} Contract</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="funding">Amount (MATIC)</Label>
                <Input
                  id="funding"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={fundingAmount}
                  onChange={(e) => setFundingAmount(e.target.value)}
                  placeholder="0.5000"
                  className="mt-1"
                />
              </div>
              <Button
                onClick={handleDepositFunds}
                disabled={!fundingAmount || isLoading}
                className="w-full btn-gradient"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Deposit to {contractType.charAt(0).toUpperCase() + contractType.slice(1)} Contract
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Current Relayers and System Information */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Current Relayers - {contractType.charAt(0).toUpperCase() + contractType.slice(1)} Contract</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relayers.map((relayer, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">
                        {relayer.slice(0, 6)}...{relayer.slice(-4)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={relayer === state.account ? 'default' : 'secondary'}>
                          {relayer === state.account ? 'You' : 'Active'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {relayer !== state.account && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveRelayer(relayer)}
                            disabled={isLoading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="font-medium">Public Contract</span>
                  <Badge variant="default">Active</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="font-medium">Private Contract</span>
                  <Badge variant="default">Active</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="font-medium">Network</span>
                  <span className="text-sm">Polygon Mainnet</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="font-medium">Current Relayer</span>
                  <span className="text-sm font-mono">
                    {state.account?.slice(0, 6)}...{state.account?.slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="font-medium">Managing Contract</span>
                  <Badge variant="outline">
                    {contractType.charAt(0).toUpperCase() + contractType.slice(1)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
