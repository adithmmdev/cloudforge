import React from 'react';
import AWSSetupWizard from '../components/AWSSetupWizard';

const AWSSetup = () => {
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <AWSSetupWizard />
      </div>
    </div>
  );
};

export default AWSSetup;
