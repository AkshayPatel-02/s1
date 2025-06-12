import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '@/contexts/Web3Context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { 
  Wallet, 
  TrendingUp, 
  Download, 
  Upload, 
  DollarSign,
  Eye,
  EyeOff,
  Vote,
  Users,
  Clock,
  Plus,
  RefreshCw
} from 'lucide-react';
import { Poll } from '@/contexts/Web3Context';
import { Link } from 'react-router-dom';

const UserDashboard: React.FC = () => {
  const { state, connectWallet, getUserDeposits, getPublicPolls, getPrivatePolls } = useWeb3();
  
  const [userBalance, setUserBalance] = useState<number>(0);
  const [publicContractBalance, setPublicContractBalance] = useState<number>(0);
  const [privateContractBalance, setPrivateContractBalance] = useState<number>(0);
  
  const [publicDepositAmount, setPublicDepositAmount] = useState<string>('');
  const [publicWithdrawAmount, setPublicWithdrawAmount] = useState<string>('');
  const [privateDepositAmount, setPrivateDepositAmount] = useState<string>('');
  const [privateWithdrawAmount, setPrivateWithdrawAmount] = useState<string>('');
  
  const [showBalance, setShowBalance] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [myPublicPolls, setMyPublicPolls] = useState<Poll[]>([]);
  const [myPrivatePolls, setMyPrivatePolls] = useState<Poll[]>([]);

  useEffect(() => {
    if (state.isConnected) {
      loadBalances();
      loadMyPolls();
    }
  }, [state.isConnected, state.account]);

  const loadBalances = async () => {
    if (!state.provider || !state.account || !state.publicContract || !state.privateContract) return;
    
    setIsLoading(true);
    try {
      console.log('Loading balances for account:', state.account);
      
      // Get wallet balance
      const balance = await state.provider.getBalance(state.account);
      const walletBalance = parseFloat(ethers.formatEther(balance));
      console.log('Wallet balance:', walletBalance);
      setUserBalance(walletBalance);

      // Get public contract deposits
      console.log('Getting public contract deposits');
      const publicDeposits = await getUserDeposits('public');
      console.log('Public deposits:', publicDeposits);
      setPublicContractBalance(publicDeposits);
      
      // Get private contract deposits
      console.log('Getting private contract deposits');
      const privateDeposits = await getUserDeposits('private');
      console.log('Private deposits:', privateDeposits);
      setPrivateContractBalance(privateDeposits);

    } catch (error) {
      console.error('Error loading balances:', error);
      toast({
        title: 'Error',
        description: 'Failed to load balances',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMyPolls = async () => {
    if (!state.account) return;
    
    try {
      const [publicPolls, privatePolls] = await Promise.all([
        getPublicPolls(),
        getPrivatePolls()
      ]);

      const myPublic = publicPolls.filter(poll => 
        poll.creator.toLowerCase() === state.account!.toLowerCase()
      );
      const myPrivate = privatePolls.filter(poll => 
        poll.creator.toLowerCase() === state.account!.toLowerCase()
      );

      setMyPublicPolls(myPublic);
      setMyPrivatePolls(myPrivate);
    } catch (error) {
      console.error('Error loading my polls:', error);
    }
  };

  const depositFunds = async (contractType: 'public' | 'private') => {
    if (!state.signer) {
      toast({
        title: 'Error',
        description: 'Please connect your wallet',
        variant: 'destructive',
      });
      return;
    }

    const depositAmount = contractType === 'public' ? publicDepositAmount : privateDepositAmount;
    const contract = contractType === 'public' ? state.publicContract : state.privateContract;

    if (!contract) {
      toast({
        title: 'Error',
        description: `Please connect to the ${contractType} contract`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      const tx = await contract.depositFunds({
        value: ethers.parseEther(depositAmount),
      });
      await tx.wait();

      toast({
        title: 'Deposit Successful',
        description: `Successfully deposited ${parseFloat(depositAmount).toFixed(4)} MATIC to the ${contractType} contract`,
        variant: 'success',
      });

      // Clear input and reload balances
      if (contractType === 'public') setPublicDepositAmount('');
      else setPrivateDepositAmount('');
      await loadBalances();
    } catch (error: any) {
      console.error(`Error depositing to ${contractType} contract:`, error);
      
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

  const withdrawFunds = async (contractType: 'public' | 'private') => {
    if (!state.signer) {
      toast({
        title: 'Error',
        description: 'Please connect your wallet',
        variant: 'destructive',
      });
      return;
    }

    const withdrawAmount = contractType === 'public' ? publicWithdrawAmount : privateWithdrawAmount;
    const contract = contractType === 'public' ? state.publicContract : state.privateContract;

    if (!contract) {
      toast({
        title: 'Error',
        description: `Please connect to the ${contractType} contract`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      const tx = await contract.withdrawFunds(ethers.parseEther(withdrawAmount));
      await tx.wait();

      toast({
        title: 'Withdrawal Successful',
        description: `Successfully withdrew ${parseFloat(withdrawAmount).toFixed(4)} MATIC from the ${contractType} contract`,
        variant: 'success',
      });

      // Clear input and reload balances
      if (contractType === 'public') setPublicWithdrawAmount('');
      else setPrivateWithdrawAmount('');
      await loadBalances();
    } catch (error: any) {
      console.error(`Error withdrawing from ${contractType} contract:`, error);
      
      // Create a more professional error message
      let errorMessage = 'Unable to complete withdrawal. Please try again later.';
      
      // Handle specific error cases
      if (error.message?.includes('user rejected')) {
        errorMessage = 'Transaction was declined in your wallet.';
      } else if (error.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds available for withdrawal.';
      } else if (error.message?.includes('gas')) {
        errorMessage = 'Network is congested. Please try again with adjusted gas settings.';
      }
      
      toast({
        title: 'Withdrawal Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const PollCard = ({ poll, isPrivate }: { poll: Poll; isPrivate: boolean }) => {
    const isEnded = Date.now() / 1000 > poll.endTime;
    const endDate = new Date(poll.endTime * 1000);
    const participationRate = (poll.voterCount / poll.maxVoters) * 100;

    return (
      <Card className="h-full border-l-4 border-l-primary/20 hover:border-l-primary transition-all duration-300 hover:shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base font-semibold text-gray-900 line-clamp-2">
              {poll.title}
            </CardTitle>
            <div className="flex space-x-1">
              {isPrivate && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                  Private
                </Badge>
              )}
              <Badge variant={isEnded ? "destructive" : "default"} className="text-xs">
                {isEnded ? 'Ended' : 'Active'}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
            <div className="flex items-center space-x-1">
              <Users className="w-3 h-3" />
              <span>{poll.voterCount}/{poll.maxVoters}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Vote className="w-3 h-3" />
              <span>{poll.candidateCount} candidates</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{endDate.toLocaleDateString()}</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Participation</span>
              <span>{participationRate.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className="bg-gradient-primary h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(participationRate, 100)}%` }}
              />
            </div>
          </div>

          <Link to={`/poll/${poll.id}${isPrivate ? '?type=private' : ''}`} className="block">
            <Button className="w-full btn-gradient text-sm py-2" size="sm">
              {isEnded ? 'View Results' : 'Manage Poll'}
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  };

  if (!state.isConnected) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-24 h-24 mx-auto mb-6 bg-gradient-primary rounded-full flex items-center justify-center">
            <Wallet className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-4">User Dashboard</h1>
          <p className="text-gray-600 mb-8">Please connect your wallet to view your dashboard and manage your polls.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">User Dashboard</h1>
      
      {!state.isConnected ? (
        <div className="text-center p-8">
          <p className="mb-4">Please connect your wallet to view your dashboard</p>
          <Button onClick={connectWallet}>Connect Wallet</Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Your Balances</h2>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadBalances} 
              disabled={isLoading}
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
          
          {/* Enhanced Balance Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm font-medium">
                  <span className="flex items-center space-x-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Wallet className="w-4 h-4 text-blue-600" />
                    </div>
                    <span>Wallet Balance</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBalance(!showBalance)}
                    className="h-8 w-8 p-0 hover:bg-blue-100"
                  >
                    {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-900">
                  {isLoading ? (
                    <div className="h-8 bg-blue-200 rounded animate-pulse"></div>
                  ) : showBalance ? (
                    `${userBalance.toFixed(4)} MATIC`
                  ) : (
                    '••••'
                  )}
                </div>
                <p className="text-xs text-blue-600 mt-1">Available for transactions</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center space-x-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  </div>
                  <span>Public Contract</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-900">
                  {isLoading ? (
                    <div className="h-8 bg-green-200 rounded animate-pulse"></div>
                  ) : showBalance ? (
                    `${publicContractBalance.toFixed(4)} MATIC`
                  ) : (
                    '••••'
                  )}
                </div>
                <p className="text-xs text-green-600 mt-1">Real blockchain data - funds for paying voter gas fees</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center space-x-2">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <DollarSign className="w-4 h-4 text-purple-600" />
                  </div>
                  <span>Private Contract</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-900">
                  {isLoading ? (
                    <div className="h-8 bg-purple-200 rounded animate-pulse"></div>
                  ) : showBalance ? (
                    `${privateContractBalance.toFixed(4)} MATIC`
                  ) : (
                    '••••'
                  )}
                </div>
                <p className="text-xs text-purple-600 mt-1">Real blockchain data - funds for paying voter gas fees</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="contracts" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1 rounded-lg">
              <TabsTrigger value="contracts" className="rounded-md">Contract Management</TabsTrigger>
              <TabsTrigger value="polls" className="rounded-md">My Polls</TabsTrigger>
            </TabsList>

            <TabsContent value="contracts" className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold text-blue-800 mb-2">Meta-Transaction System</h3>
                <p className="text-sm text-blue-700 mb-3">
                  ScrutinX uses meta-transactions to improve user experience. Here's how it works:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-blue-700">
                  <li>As a poll creator, you deposit MATIC to cover gas fees for your voters</li>
                  <li>When someone votes in your poll, they only sign the transaction</li>
                  <li>The gas fees are paid from your deposited funds</li>
                  <li>This allows voters to participate without paying any gas fees</li>
                </ul>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Public Contract Management */}
                <Card className="border-2 border-dashed border-green-200 hover:border-green-300 transition-colors">
                  <CardHeader className="bg-green-50 rounded-t-lg">
                    <CardTitle className="text-green-800 flex items-center space-x-2">
                      <TrendingUp className="w-5 h-5" />
                      <span>Public Contract Management</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-6">
                    <div>
                      <Label htmlFor="public-deposit" className="text-sm font-medium text-gray-700">
                        Deposit Funds for Voter Gas Fees
                      </Label>
                      <div className="flex items-center space-x-2 mt-2">
                        <Input
                          type="number"
                          id="public-deposit"
                          placeholder="0.0000"
                          step="0.0001"
                          min="0"
                          value={publicDepositAmount}
                          onChange={(e) => setPublicDepositAmount(e.target.value)}
                          className="flex-1"
                        />
                        <Button 
                          onClick={() => depositFunds('public')} 
                          disabled={isLoading || !publicDepositAmount}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Deposit
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        These funds will be used to pay gas fees when voters participate in your public polls.
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="public-withdraw" className="text-sm font-medium text-gray-700">
                        Withdraw Unused Funds
                      </Label>
                      <div className="flex items-center space-x-2 mt-2">
                        <Input
                          type="number"
                          id="public-withdraw"
                          placeholder="0.0000"
                          step="0.0001"
                          min="0"
                          value={publicWithdrawAmount}
                          onChange={(e) => setPublicWithdrawAmount(e.target.value)}
                          className="flex-1"
                        />
                        <Button 
                          onClick={() => withdrawFunds('public')} 
                          disabled={isLoading || !publicWithdrawAmount}
                          variant="outline"
                          className="border-green-600 text-green-600 hover:bg-green-50"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Withdraw
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Private Contract Management */}
                <Card className="border-2 border-dashed border-purple-200 hover:border-purple-300 transition-colors">
                  <CardHeader className="bg-purple-50 rounded-t-lg">
                    <CardTitle className="text-purple-800 flex items-center space-x-2">
                      <DollarSign className="w-5 h-5" />
                      <span>Private Contract Management</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-6">
                    <div>
                      <Label htmlFor="private-deposit" className="text-sm font-medium text-gray-700">
                        Deposit Funds for Voter Gas Fees
                      </Label>
                      <div className="flex items-center space-x-2 mt-2">
                        <Input
                          type="number"
                          id="private-deposit"
                          placeholder="0.0000"
                          step="0.0001"
                          min="0"
                          value={privateDepositAmount}
                          onChange={(e) => setPrivateDepositAmount(e.target.value)}
                          className="flex-1"
                        />
                        <Button 
                          onClick={() => depositFunds('private')} 
                          disabled={isLoading || !privateDepositAmount}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Deposit
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        These funds will be used to pay gas fees when voters participate in your private polls.
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="private-withdraw" className="text-sm font-medium text-gray-700">
                        Withdraw Unused Funds
                      </Label>
                      <div className="flex items-center space-x-2 mt-2">
                        <Input
                          type="number"
                          id="private-withdraw"
                          placeholder="0.0000"
                          step="0.0001"
                          min="0"
                          value={privateWithdrawAmount}
                          onChange={(e) => setPrivateWithdrawAmount(e.target.value)}
                          className="flex-1"
                        />
                        <Button 
                          onClick={() => withdrawFunds('private')} 
                          disabled={isLoading || !privateWithdrawAmount}
                          variant="outline"
                          className="border-purple-600 text-purple-600 hover:bg-purple-50"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Withdraw
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="polls" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold">My Created Polls</h3>
                  <p className="text-gray-600 text-sm">Manage and track your poll performance</p>
                </div>
                <Link to="/create">
                  <Button className="btn-gradient">
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Poll
                  </Button>
                </Link>
              </div>

              {/* Public Polls */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <h4 className="text-lg font-medium">Public Polls ({myPublicPolls.length})</h4>
                </div>
                {myPublicPolls.length === 0 ? (
                  <Card className="border-2 border-dashed border-gray-200">
                    <CardContent className="text-center py-8">
                      <Vote className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No public polls created yet</p>
                      <Link to="/create">
                        <Button variant="outline" className="mt-4">
                          Create Your First Public Poll
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {myPublicPolls.map((poll) => (
                      <PollCard key={`public-${poll.id}`} poll={poll} isPrivate={false} />
                    ))}
                  </div>
                )}
              </div>

              {/* Private Polls */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                  <h4 className="text-lg font-medium">Private Polls ({myPrivatePolls.length})</h4>
                </div>
                {myPrivatePolls.length === 0 ? (
                  <Card className="border-2 border-dashed border-gray-200">
                    <CardContent className="text-center py-8">
                      <Vote className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No private polls created yet</p>
                      <Link to="/create">
                        <Button variant="outline" className="mt-4">
                          Create Your First Private Poll
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {myPrivatePolls.map((poll) => (
                      <PollCard key={`private-${poll.id}`} poll={poll} isPrivate={true} />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
