import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react';
import axios from 'axios';

export default function Settings() {
  const [autonomyMode, setAutonomyMode] = useState('approve_each');

  useEffect(() => {
    // We fetch global settings if we had them, but spec says "System autonomy dial & LLM keys"
    // Since autonomy dial is usually per project, but spec says "Settings.jsx (System autonomy dial & LLM keys)"
    // We will just provide a stub for LLM keys as those are loaded via .env, 
    // but the user might want a UI to update them if the backend supports it.
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="flex items-center text-blue-600 mb-6 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Link>
        
        <div className="flex items-center mb-6">
          <SettingsIcon className="w-8 h-8 text-gray-700 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
          <h2 className="text-xl font-semibold mb-4">Default Autonomy Dial</h2>
          <p className="text-sm text-gray-500 mb-4">Set the default autonomy behavior for new projects.</p>
          <select 
            value={autonomyMode} 
            onChange={(e) => setAutonomyMode(e.target.value)} 
            className="w-full max-w-md p-2 border border-gray-300 rounded"
          >
            <option value="suggest_only">Suggest Only</option>
            <option value="approve_each">Approve Each</option>
            <option value="full_auto">Full Auto</option>
          </select>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h2 className="text-xl font-semibold mb-4">LLM API Keys</h2>
          <p className="text-sm text-gray-500 mb-4">LLM API keys are currently loaded from the backend .env file. Update the .env file and restart the backend to apply changes.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Anthropic API Key</label>
              <input type="password" value="********" disabled className="mt-1 block w-full max-w-md p-2 border border-gray-200 bg-gray-100 rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">OpenAI API Key</label>
              <input type="password" value="********" disabled className="mt-1 block w-full max-w-md p-2 border border-gray-200 bg-gray-100 rounded" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
