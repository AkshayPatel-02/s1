import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Database, HardDrive } from 'lucide-react';

interface StorageToggleProps {
  onChange?: (useFirebase: boolean) => void;
}

const StorageToggle: React.FC<StorageToggleProps> = ({ onChange }) => {
  // Get initial value from localStorage
  const initialValue = localStorage.getItem('whitelist_use_firebase');
  const initialFirebase = initialValue ? JSON.parse(initialValue) : true;
  
  const [useFirebase, setUseFirebase] = useState<boolean>(initialFirebase);
  const isInitialRender = useRef(true);

  useEffect(() => {
    // Skip the effect on initial render to prevent reload loops
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    
    // Store the preference
    localStorage.setItem('whitelist_use_firebase', JSON.stringify(useFirebase));
    
    // Notify parent component if needed
    if (onChange) {
      onChange(useFirebase);
    }
    
    // Only reload if the value actually changed
    const storedValue = localStorage.getItem('whitelist_use_firebase');
    const currentValue = storedValue ? JSON.parse(storedValue) : true;
    
    if (currentValue !== useFirebase) {
      // Reload the page to apply the change
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  }, [useFirebase, onChange]);

  const handleToggle = (value: boolean) => {
    if (value !== useFirebase) {
      setUseFirebase(value);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-500">Storage:</span>
      <Button
        variant={useFirebase ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleToggle(true)}
        className="flex items-center space-x-1"
        title="Use Firebase for storage (recommended)"
      >
        <Database className="h-4 w-4" />
        <span>Firebase</span>
      </Button>
      <Button
        variant={!useFirebase ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleToggle(false)}
        className="flex items-center space-x-1"
        title="Use localStorage for storage (offline mode)"
      >
        <HardDrive className="h-4 w-4" />
        <span>Local</span>
      </Button>
    </div>
  );
};

export default StorageToggle; 