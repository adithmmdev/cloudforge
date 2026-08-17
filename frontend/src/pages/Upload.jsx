import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, UploadCloud } from 'lucide-react';

export default function Upload() {
  const navigate = useNavigate();
  const [repoUrl, setRepoUrl] = useState('');
  
  const handleDeploy = (e) => {
    e.preventDefault();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="flex items-center text-blue-600 mb-6 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Link>
        
        <div className="bg-white p-8 rounded-xl shadow-sm">
          <div className="flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-6 mx-auto">
            <UploadCloud className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Deploy New Project</h1>
          <p className="text-center text-gray-500 mb-8">Enter your Git repository URL or upload a zip file.</p>
          
          <form onSubmit={handleDeploy} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Git Repository URL</label>
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/repo"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <button type="submit" className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
              Deploy Project
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
