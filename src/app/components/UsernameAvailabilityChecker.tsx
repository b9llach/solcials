'use client';

import { useUsernameValidation } from '../hooks/useUsernameValidation';

export default function UsernameAvailabilityChecker() {
  const usernameValidation = useUsernameValidation();

  const getStatusColor = () => {
    const status = usernameValidation.getValidationStatus().status;
    switch (status) {
      case 'available': return 'text-green-600';
      case 'unavailable': 
      case 'error': return 'text-red-600';
      case 'checking': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    const status = usernameValidation.getValidationStatus().status;
    switch (status) {
      case 'available': return '✅';
      case 'unavailable': 
      case 'error': return '❌';
      case 'checking': return '⏳';
      default: return '';
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-lg font-semibold mb-4">Test Username Availability</h2>
      
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            type="text"
            value={usernameValidation.username}
            onChange={(e) => usernameValidation.setUsername(e.target.value)}
            placeholder="Enter a username to check..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        {usernameValidation.username && (
          <div className={`p-3 rounded-md border ${
            usernameValidation.getValidationStatus().status === 'available' ? 'bg-green-50 border-green-200' :
            usernameValidation.getValidationStatus().status === 'checking' ? 'bg-yellow-50 border-yellow-200' :
            'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center space-x-2">
              <span className="text-lg">{getStatusIcon()}</span>
              <span className={`text-sm font-medium ${getStatusColor()}`}>
                {usernameValidation.getValidationStatus().message}
              </span>
            </div>
            
            {usernameValidation.isChecking && (
              <div className="mt-2">
                <div className="animate-pulse flex space-x-1">
                  <div className="h-1 bg-yellow-400 rounded w-2"></div>
                  <div className="h-1 bg-yellow-400 rounded w-2"></div>
                  <div className="h-1 bg-yellow-400 rounded w-2"></div>
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Username must be 3-50 characters</p>
          <p>• Only letters, numbers, and underscores allowed</p>
          <p>• Case-insensitive (Alice = alice)</p>
          <p>• Real-time availability checking</p>
        </div>
        
        <button
          onClick={() => usernameValidation.recheckUsername()}
          disabled={!usernameValidation.username || usernameValidation.isChecking}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed"
        >
          {usernameValidation.isChecking ? 'Checking...' : 'Recheck Availability'}
        </button>
      </div>
    </div>
  );
} 