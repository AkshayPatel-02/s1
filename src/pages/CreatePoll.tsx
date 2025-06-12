import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeb3 } from '@/contexts/Web3Context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Plus, X, ArrowLeft, ArrowRight, Clock, Users, FileText, Lock, Upload, Edit } from 'lucide-react';

interface PollFormData {
  title: string;
  isPrivate: boolean;
  candidates: string[];
  durationHours: number;
  maxVoters: number;
  whitelist: string[];
  fundingAmount: number;
}

const CreatePoll: React.FC = () => {
  const navigate = useNavigate();
  const { createPoll, state } = useWeb3();
  const [currentStep, setCurrentStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [whitelistMode, setWhitelistMode] = useState<'upload' | 'manual'>('manual');

  const [formData, setFormData] = useState<PollFormData>({
    title: '',
    isPrivate: false,
    candidates: ['', ''],
    durationHours: 24,
    maxVoters: 1000,
    whitelist: [],
    fundingAmount: 0.1,
  });

  const steps = [
    { number: 1, title: 'Poll Info', icon: FileText },
    { number: 2, title: 'Candidates', icon: Users },
    { number: 3, title: 'Settings', icon: Clock },
    { number: 4, title: 'Review & Deploy', icon: ArrowRight },
  ];

  const addCandidate = () => {
    if (formData.candidates.length < 10) {
      setFormData(prev => ({
        ...prev,
        candidates: [...prev.candidates, '']
      }));
    }
  };

  const removeCandidate = (index: number) => {
    if (formData.candidates.length > 2) {
      setFormData(prev => ({
        ...prev,
        candidates: prev.candidates.filter((_, i) => i !== index)
      }));
    }
  };

  const updateCandidate = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      candidates: prev.candidates.map((candidate, i) => 
        i === index ? value : candidate
      )
    }));
  };

  const handleWhitelistUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const addresses = content.split('\n').map(line => line.trim()).filter(line => line);
        setFormData(prev => ({ ...prev, whitelist: addresses }));
        toast({
          title: 'Whitelist Uploaded',
          description: `${addresses.length} addresses loaded successfully`,
        });
      };
      reader.readAsText(file);
    }
  };

  const handleManualWhitelistChange = (value: string) => {
    const addresses = value.split('\n').map(line => line.trim()).filter(line => line);
    setFormData(prev => ({ ...prev, whitelist: addresses }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.title.trim() !== '';
      case 2:
        return formData.candidates.every(c => c.trim() !== '') && formData.candidates.length >= 2;
      case 3:
        return formData.durationHours > 0 && formData.maxVoters > 0 && 
               (!formData.isPrivate || formData.whitelist.length > 0);
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleCreatePoll = async () => {
    if (!state.isConnected) {
      toast({
        title: 'Error',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsCreating(true);

      // Create the poll first
      const pollDataToSubmit = {
        ...formData,
        whitelist: formData.isPrivate ? formData.whitelist : []
      };

      await createPoll(pollDataToSubmit);
      
      // For private polls, store whitelist addresses in local storage after successful creation
      if (formData.isPrivate && formData.whitelist.length > 0) {
        try {
          // Get the newly created poll ID (count - 1)
          const pollCount = await state.privateContract?.getPollsCount();
          const newPollId = Number(pollCount) - 1;
          
          // Normalize addresses to lowercase
          const normalizedWhitelist = formData.whitelist.map(addr => addr.toLowerCase());
          console.log('Storing whitelist for poll', newPollId, ':', normalizedWhitelist);
          
          // Store whitelist with the correct poll ID
          const whitelistKey = `whitelist_poll_${newPollId}`;
          console.log('Storing with key:', whitelistKey);
          localStorage.setItem(whitelistKey, JSON.stringify(normalizedWhitelist));
          
          // Also store the creator's address in the whitelist
          if (state.account) {
            const updatedWhitelist = [...normalizedWhitelist, state.account.toLowerCase()];
            localStorage.setItem(whitelistKey, JSON.stringify(updatedWhitelist));
            console.log('Updated whitelist with creator:', updatedWhitelist);
          }
        } catch (storageError) {
          console.error('Error storing whitelist:', storageError);
          // Don't throw here, as the poll was created successfully
        }
      }
      
      toast({
        title: 'Poll Created',
        description: 'Your poll has been created successfully!',
      });
      navigate('/polls');
    } catch (error) {
      console.error('Error creating poll:', error);
      
      // Create a more professional error message
      let errorMessage = 'Unable to create poll. Please try again later.';
      
      // Handle specific error cases
      if (error.message?.includes('user rejected') || error.code === 'ACTION_REJECTED') {
        errorMessage = 'Transaction cancelled. You declined the transaction in your wallet.';
      } else if (error.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds in your wallet to create this poll.';
      } else if (error.message?.includes('gas')) {
        errorMessage = 'Network is congested. Please try again with adjusted gas settings.';
      }
      
      toast({
        title: 'Poll Creation Cancelled',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (!state.isConnected) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold mb-6">Create Poll</h1>
        <p className="text-gray-600 mb-8">Please connect your wallet to create a poll.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          
          <h1 className="text-3xl font-bold mb-4">Create New Poll</h1>
          
          {/* Step Indicator */}
          <div className="flex items-center justify-between mb-8">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  currentStep >= step.number
                    ? 'bg-primary border-primary text-white'
                    : 'border-gray-300 text-gray-400'
                }`}>
                  <step.icon className="w-5 h-5" />
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${
                    currentStep >= step.number ? 'text-primary' : 'text-gray-400'
                  }`}>
                    Step {step.number}
                  </p>
                  <p className={`text-xs ${
                    currentStep >= step.number ? 'text-gray-900' : 'text-gray-400'
                  }`}>
                    {step.title}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 ml-6 ${
                    currentStep > step.number ? 'bg-primary' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {steps[currentStep - 1].title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Step 1: Poll Info */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <Label htmlFor="title">Poll Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter poll title..."
                    className="mt-1"
                  />
                </div>

                <div className="flex items-center space-x-3">
                  <Switch
                    id="private"
                    checked={formData.isPrivate}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPrivate: checked }))}
                  />
                  <Label htmlFor="private" className="flex items-center space-x-2">
                    <Lock className="w-4 h-4" />
                    <span>Private Poll (Whitelist Only)</span>
                  </Label>
                </div>
              </div>
            )}

            {/* Step 2: Candidates */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <Label>Poll Candidates *</Label>
                  <div className="space-y-3 mt-2">
                    {formData.candidates.map((candidate, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Input
                          value={candidate}
                          onChange={(e) => updateCandidate(index, e.target.value)}
                          placeholder={`Candidate ${index + 1}...`}
                        />
                        {formData.candidates.length > 2 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeCandidate(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {formData.candidates.length < 10 && (
                    <Button
                      variant="outline"
                      onClick={addCandidate}
                      className="mt-3"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Candidate
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Settings */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <Label htmlFor="duration">Duration (Hours) *</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.durationHours}
                    onChange={(e) => setFormData(prev => ({ ...prev, durationHours: parseInt(e.target.value) || 0 }))}
                    placeholder="24"
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="maxVoters">Maximum Voters *</Label>
                  <Input
                    id="maxVoters"
                    type="number"
                    value={formData.maxVoters}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxVoters: parseInt(e.target.value) || 0 }))}
                    placeholder="1000"
                    className="mt-1"
                  />
                </div>

                {formData.isPrivate && (
                  <div>
                    <Label>Whitelist *</Label>
                    <div className="space-y-4 mt-2">
                      {/* Whitelist Mode Toggle */}
                      <div className="flex space-x-2">
                        <Button
                          type="button"
                          variant={whitelistMode === 'manual' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setWhitelistMode('manual')}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Manual Entry
                        </Button>
                        <Button
                          type="button"
                          variant={whitelistMode === 'upload' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setWhitelistMode('upload')}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload CSV
                        </Button>
                      </div>

                      {/* Manual Entry Mode */}
                      {whitelistMode === 'manual' && (
                        <div>
                          <Textarea
                            placeholder="Enter wallet addresses (one per line)&#10;0x742d35Cc6634C0532925a3b8D32F4Fb38c8e8638&#10;0x8ba1f109551bD432803012645Hac136c654321"
                            value={formData.whitelist.join('\n')}
                            onChange={(e) => handleManualWhitelistChange(e.target.value)}
                            className="min-h-[120px]"
                          />
                          <p className="text-sm text-gray-500 mt-1">
                            Enter one wallet address per line
                          </p>
                        </div>
                      )}

                      {/* Upload Mode */}
                      {whitelistMode === 'upload' && (
                        <div>
                          <input
                            id="whitelist"
                            type="file"
                            accept=".csv,.txt"
                            onChange={handleWhitelistUpload}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/80"
                          />
                          <p className="text-sm text-gray-500 mt-1">
                            Upload a CSV or TXT file with one address per line
                          </p>
                        </div>
                      )}

                      {formData.whitelist.length > 0 && (
                        <p className="text-sm text-green-600">
                          {formData.whitelist.length} addresses loaded
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                <div>
                  <Label htmlFor="funding">Funding Amount (MATIC) *</Label>
                  <Input
                    id="funding"
                    type="number"
                    step="0.01"
                    value={formData.fundingAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, fundingAmount: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.1"
                    className="mt-1"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    This will cover gas costs for voters through our relayer network
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">{formData.title}</h3>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Badge variant={formData.isPrivate ? "secondary" : "default"}>
                      {formData.isPrivate ? 'Private' : 'Public'}
                    </Badge>
                    <Badge variant="outline">
                      {formData.candidates.length} Candidates
                    </Badge>
                    <Badge variant="outline">
                      {formData.durationHours}h Duration
                    </Badge>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Poll Candidates:</h4>
                    <ul className="space-y-1">
                      {formData.candidates.map((candidate, index) => (
                        <li key={index} className="text-sm text-gray-600">
                          {index + 1}. {candidate}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Max Voters:</span> {formData.maxVoters}
                    </div>
                    <div>
                      <span className="font-medium">Funding:</span> {formData.fundingAmount} MATIC
                    </div>
                  </div>

                  {formData.isPrivate && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Whitelist Addresses ({formData.whitelist.length}):</h4>
                      <div className="max-h-40 overflow-y-auto bg-gray-50 rounded-md p-3">
                        {formData.whitelist.map((address, index) => (
                          <div key={index} className="text-sm text-gray-600 font-mono mb-1">
                            {index + 1}. {address}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
              
              {currentStep < 4 ? (
                <Button
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  disabled={!canProceed()}
                  className="btn-gradient"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleCreatePoll}
                  disabled={isCreating || !canProceed()}
                  className="btn-gradient"
                >
                  {isCreating ? 'Creating Poll...' : 'Create Poll'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreatePoll;
