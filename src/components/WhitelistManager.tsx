import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '@/contexts/Web3Context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { whitelistService } from '@/services/whitelistService';
import { CONTRACT_ADDRESSES } from '@/constants/contracts';
import { Copy, Download, Upload, Trash2, Plus, RefreshCw, CheckCircle, XCircle, Clock, FileJson } from 'lucide-react';

interface WhitelistManagerProps {
  pollId: number;
  isCreator: boolean;
}

interface WhitelistAddress {
  address: string;
  signature?: string;
  expiry?: number;
  status: 'pending' | 'generated' | 'expired';
}

const WhitelistManager: React.FC<WhitelistManagerProps> = ({ pollId, isCreator }) => {
  const { state } = useWeb3();
  const [addresses, setAddresses] = useState<WhitelistAddress[]>([]);
  const [newAddress, setNewAddress] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('addresses');
  const [importData, setImportData] = useState('');
  const [expiryDays, setExpiryDays] = useState(7);
  const [filter, setFilter] = useState<'all' | 'pending' | 'generated' | 'expired'>('all');

  // Load addresses when component mounts
  useEffect(() => {
    loadAddresses();
  }, [pollId]);

  const loadAddresses = async () => {
    console.log(`Loading addresses for poll ID: ${pollId}`);
    
    // Get whitelisted addresses
    const whitelistedAddresses = await whitelistService.getWhitelistedAddresses(pollId);
    console.log('Whitelisted addresses:', whitelistedAddresses);
    
    // Get stored signatures
    const storedSignatures = await whitelistService.getStoredSignatures(pollId);
    console.log('Stored signatures:', storedSignatures);
    
    // Create the combined list
    const addressList: WhitelistAddress[] = whitelistedAddresses.map(address => {
      const signature = storedSignatures.find(s => s.address.toLowerCase() === address.toLowerCase());
      
      let status: 'pending' | 'generated' | 'expired' = 'pending';
      if (signature) {
        status = signature.expiry < Math.floor(Date.now() / 1000) ? 'expired' : 'generated';
      }
      
      return {
        address,
        signature: signature?.signature,
        expiry: signature?.expiry,
        status
      };
    });
    
    console.log('Final address list:', addressList);
    setAddresses(addressList);
  };

  const handleAddAddress = async () => {
    if (!newAddress || !ethers.isAddress(newAddress)) {
      toast({
        title: 'Invalid Address',
        description: 'Please enter a valid Ethereum address',
        variant: 'destructive',
      });
      return;
    }

    console.log(`Adding address: ${newAddress}`);

    // Check if address already exists
    if (addresses.some(a => a.address.toLowerCase() === newAddress.toLowerCase())) {
      toast({
        title: 'Duplicate Address',
        description: 'This address is already in the whitelist',
        variant: 'destructive',
      });
      return;
    }

    // Add the new address
    const newAddresses: WhitelistAddress[] = [
      ...addresses,
      { address: newAddress, status: 'pending' }
    ];
    
    console.log('New address list:', newAddresses);
    setAddresses(newAddresses);
    setNewAddress('');
    
    // Save to storage
    console.log('Saving addresses to storage');
    await saveAddresses(newAddresses);
    console.log('Addresses saved');
    
    // Reload addresses to verify they were saved
    await loadAddresses();
    
    toast({
      title: 'Address Added',
      description: 'Address has been added to the whitelist',
    });
  };

  const handleAddTestAddress = async () => {
    const testAddress = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";
    console.log(`Adding test address: ${testAddress}`);

    // Add the test address
    const newAddresses: WhitelistAddress[] = [
      ...addresses,
      { address: testAddress, status: 'pending' }
    ];
    
    console.log('New address list with test address:', newAddresses);
    setAddresses(newAddresses);
    
    // Save to storage
    console.log('Saving test address to storage');
    await saveAddresses(newAddresses);
    console.log('Test address saved');
    
    // Reload addresses to verify they were saved
    await loadAddresses();
    
    toast({
      title: 'Test Address Added',
      description: 'Test address has been added to the whitelist',
    });
  };

  const handleRemoveAddress = async (address: string) => {
    const newAddresses = addresses.filter(a => a.address !== address);
    setAddresses(newAddresses);
    
    // Save to storage
    await saveAddresses(newAddresses);
    
    toast({
      title: 'Address Removed',
      description: 'Address has been removed from the whitelist',
    });
  };

  const handleGenerateSignatures = async () => {
    if (!state.signer) {
      toast({
        title: 'Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return;
    }

    // Filter only pending addresses
    const pendingAddresses = addresses
      .filter(a => a.status === 'pending' || a.status === 'expired')
      .map(a => a.address);
    
    if (pendingAddresses.length === 0) {
      toast({
        title: 'No Pending Addresses',
        description: 'There are no pending addresses to generate signatures for',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsGenerating(true);
      
      // Generate signatures in batches of 5 to avoid UI freezing
      const batchSize = 5;
      const batches = Math.ceil(pendingAddresses.length / batchSize);
      
      for (let i = 0; i < batches; i++) {
        const batchAddresses = pendingAddresses.slice(i * batchSize, (i + 1) * batchSize);
        
        // Generate signatures for this batch
        await whitelistService.generateBatchSignatures(
          state.signer,
          pollId,
          batchAddresses,
          CONTRACT_ADDRESSES.PRIVATE_VOTING,
          state.chainId || 137,
          expiryDays
        );
        
        // Update progress
        toast({
          title: 'Generating Signatures',
          description: `Progress: ${Math.min((i + 1) * batchSize, pendingAddresses.length)} of ${pendingAddresses.length}`,
        });
      }
      
      // Reload addresses to update UI
      await loadAddresses();
      
      toast({
        title: 'Signatures Generated',
        description: `Successfully generated ${pendingAddresses.length} whitelist signatures`,
      });
    } catch (error: any) {
      console.error('Error generating signatures:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate signatures',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopySignature = async (address: string) => {
    const entry = addresses.find(a => a.address === address);
    if (!entry?.signature || !entry?.expiry) return;
    
    try {
      // Create a JSON object with all three required values
      const jsonData = {
        signature: entry.signature,
        expiry: entry.expiry,
        pollId: pollId
      };
      
      // Convert to JSON string
      const jsonString = JSON.stringify(jsonData);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(jsonString);
      
      toast({
        title: 'Copied',
        description: 'Signature copied to clipboard in JSON format with all verification data',
      });
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: 'Error',
        description: 'Failed to copy signature to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleCopyRawSignature = async (address: string) => {
    const entry = addresses.find(a => a.address === address);
    if (!entry?.signature) return;
    
    try {
      // Copy just the raw signature
      await navigator.clipboard.writeText(entry.signature);
      
      toast({
        title: 'Copied',
        description: 'Raw signature copied to clipboard',
      });
    } catch (error) {
      console.error('Failed to copy raw signature:', error);
    }
  };

  const handleExport = async () => {
    try {
      const data = await whitelistService.exportSignatures(pollId);
      
      // Create a download link
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whitelist-signatures-poll-${pollId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Exported',
        description: 'Whitelist signatures exported successfully',
      });
    } catch (error: any) {
      console.error('Error exporting signatures:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to export signatures',
        variant: 'destructive',
      });
    }
  };

  const handleImport = async () => {
    try {
      const success = await whitelistService.importSignatures(pollId, importData);
      
      if (success) {
        // Reload addresses
        await loadAddresses();
        
        // Clear import data
        setImportData('');
        
        toast({
          title: 'Imported',
          description: 'Whitelist signatures imported successfully',
        });
      } else {
        throw new Error('Failed to import signatures');
      }
    } catch (error: any) {
      console.error('Error importing signatures:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to import signatures',
        variant: 'destructive',
      });
    }
  };

  const saveAddresses = async (addressList: WhitelistAddress[]) => {
    // Extract just the addresses
    const addresses = addressList.map(a => a.address);
    
    // Get the creator's address for tracking
    const creatorAddress = state.account || undefined;
    
    console.log(`Saving ${addresses.length} addresses to storage with creator: ${creatorAddress}`);
    
    // Save to storage
    await whitelistService.setWhitelistedAddresses(pollId, addresses, creatorAddress);
    console.log('Addresses saved to storage');
  };

  const filteredAddresses = addresses.filter(address => {
    if (filter === 'all') return true;
    return address.status === filter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'generated':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'generated':
        return 'Valid';
      case 'pending':
        return 'Pending';
      case 'expired':
        return 'Expired';
      default:
        return status;
    }
  };

  const getExpiryText = (expiry?: number) => {
    if (!expiry) return 'N/A';
    
    const date = new Date(expiry * 1000);
    return date.toLocaleString();
  };

  if (!isCreator) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Whitelist Management</CardTitle>
          <CardDescription>
            Only the poll creator can manage whitelist signatures.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Whitelist Management</CardTitle>
        <CardDescription>
          Manage whitelist signatures for Poll #{pollId}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="addresses">Addresses</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>
          
          <TabsContent value="addresses" className="space-y-4">
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Enter Ethereum address"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
              />
              <Button onClick={handleAddAddress}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
              <Button onClick={handleAddTestAddress} variant="outline">
                Add Test
              </Button>
            </div>
            
            <div className="flex items-center justify-between my-4">
              <div className="flex items-center space-x-2">
                <Label>Filter:</Label>
                <select
                  className="border rounded p-1 text-sm"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="generated">Valid</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Label>Expiry (days):</Label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(parseInt(e.target.value) || 7)}
                  className="w-20"
                />
                <Button 
                  onClick={handleGenerateSignatures} 
                  disabled={isGenerating || addresses.filter(a => a.status === 'pending' || a.status === 'expired').length === 0}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Generate Signatures
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            <div className="bg-blue-50 p-3 rounded-md mb-4 text-sm text-blue-700 border border-blue-200">
              <p className="font-medium">New: Improved Signature Format</p>
              <p className="mt-1">We now provide signatures in JSON format with all verification data (signature, expiry, pollId).</p>
              <p className="mt-1">This format improves verification reliability and reduces "Not whitelisted" errors.</p>
              <p className="mt-1">
                <FileJson className="h-4 w-4 inline-block text-blue-500 mr-1" /> JSON format (recommended)
                <Copy className="h-4 w-4 inline-block ml-4 mr-1" /> Raw signature (legacy)
              </p>
            </div>
            
            <div className="border rounded-md">
              <div className="grid grid-cols-12 gap-2 p-2 font-medium bg-gray-100 rounded-t-md">
                <div className="col-span-5">Address</div>
                <div className="col-span-3">Status</div>
                <div className="col-span-3">Expiry</div>
                <div className="col-span-1">Actions</div>
              </div>
              
              <div className="divide-y">
                {filteredAddresses.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No addresses found
                  </div>
                ) : (
                  filteredAddresses.map((address) => (
                    <div key={address.address} className="grid grid-cols-12 gap-2 p-2 items-center">
                      <div className="col-span-5 font-mono text-sm truncate">
                        {address.address}
                      </div>
                      <div className="col-span-3">
                        <Badge variant={
                          address.status === 'generated' ? 'default' : 
                          address.status === 'pending' ? 'outline' : 
                          'destructive'
                        } className="flex items-center space-x-1">
                          {getStatusIcon(address.status)}
                          <span>{getStatusText(address.status)}</span>
                        </Badge>
                      </div>
                      <div className="col-span-3 text-sm">
                        {getExpiryText(address.expiry)}
                      </div>
                      <div className="col-span-1 flex space-x-1">
                        {address.signature && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleCopySignature(address.address)}
                              title="Copy JSON signature with all verification data"
                            >
                              <FileJson className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleCopyRawSignature(address.address)}
                              title="Copy raw signature only"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleRemoveAddress(address.address)}
                          title="Remove address"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="import">
            <div className="space-y-4">
              <div>
                <Label>Import JSON Data</Label>
                <Textarea
                  placeholder="Paste JSON data here..."
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  rows={10}
                />
              </div>
              
              <Button onClick={handleImport} disabled={!importData}>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="export">
            <div className="space-y-4">
              <p>
                Export all whitelist signatures for this poll as a JSON file.
                You can import this file later or share it with other administrators.
              </p>
              
              <Button onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export Signatures
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="text-sm text-gray-500">
          {addresses.length} addresses in whitelist
        </div>
        <div className="text-sm">
          <span className="font-medium">{addresses.filter(a => a.status === 'generated').length}</span> valid,{' '}
          <span className="font-medium">{addresses.filter(a => a.status === 'pending').length}</span> pending,{' '}
          <span className="font-medium">{addresses.filter(a => a.status === 'expired').length}</span> expired
        </div>
      </CardFooter>
    </Card>
  );
};

export default WhitelistManager; 