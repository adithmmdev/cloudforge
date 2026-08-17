import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Server, CheckCircle, Loader2, XCircle } from 'lucide-react';

const AWSSetupWizard = () => {
  const [status, setStatus] = useState('idle'); // idle, running, complete, failed
  const [logs, setLogs] = useState([]);
  const [cidr, setCidr] = useState('0.0.0.0/0');
  const wsRef = useRef(null);

  useEffect(() => {
    // Check initial status
    axios.get('http://localhost:8000/api/aws/setup/status')
      .then(res => {
        if (res.data.status === 'running') {
          setStatus('running');
          connectWebSocket();
        } else if (res.data.status === 'complete') {
          setStatus('complete');
        } else if (res.data.status === 'failed') {
          setStatus('failed');
        }
      })
      .catch(err => console.error("Error fetching status:", err));

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const connectWebSocket = () => {
    if (wsRef.current) return;
    const ws = new WebSocket('ws://localhost:8000/api/aws/ws');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLogs(prev => [...prev, data]);
      if (data.step === 'complete') {
        setStatus('complete');
        ws.close();
      } else if (data.step === 'error') {
        setStatus('failed');
        ws.close();
      }
    };
    
    ws.onclose = () => {
      wsRef.current = null;
    };
    
    wsRef.current = ws;
  };

  const handleStartSetup = async () => {
    setStatus('running');
    setLogs([]);
    try {
      await axios.post('http://localhost:8000/api/aws/setup', {
        allowed_ssh_cidr: cidr
      });
      connectWebSocket();
    } catch (err) {
      console.error(err);
      setStatus('failed');
      setLogs([{ step: 'error', message: 'Failed to start setup process' }]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center space-x-3 mb-6">
        <Server className="w-8 h-8 text-blue-600" />
        <h2 className="text-2xl font-semibold text-gray-800">AWS Infrastructure Setup</h2>
      </div>
      
      {status === 'idle' && (
        <div className="space-y-4">
          <p className="text-gray-600">
            CloudForge needs to provision baseline AWS resources (VPC, Security Group, Key Pair) before deploying projects.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Allowed SSH CIDR
            </label>
            <input 
              type="text" 
              value={cidr} 
              onChange={e => setCidr(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.0.0.0/0"
            />
            <p className="text-sm text-gray-500 mt-1">
              For security, restrict this to your IP if possible (e.g., 203.0.113.5/32).
            </p>
          </div>
          <button 
            onClick={handleStartSetup}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 font-medium transition-colors"
          >
            Start Automated Setup
          </button>
        </div>
      )}

      {status === 'running' && (
        <div className="space-y-4">
          <div className="flex items-center space-x-3 text-blue-600 font-medium">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Provisioning AWS Resources...</span>
          </div>
          <div className="bg-gray-900 rounded-md p-4 h-64 overflow-y-auto font-mono text-sm text-gray-300">
            {logs.length === 0 ? "Connecting..." : logs.map((log, idx) => (
              <div key={idx} className="mb-1">
                <span className="text-blue-400">[{log.step}]</span> {log.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {status === 'complete' && (
        <div className="text-center py-8">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">Setup Complete</h3>
          <p className="text-gray-600">
            AWS resources are ready. You can now deploy projects.
          </p>
        </div>
      )}

      {status === 'failed' && (
        <div className="space-y-4">
          <div className="flex items-center space-x-3 text-red-600 font-medium">
            <XCircle className="w-5 h-5" />
            <span>Setup Failed</span>
          </div>
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 font-mono text-sm">
            {logs.length > 0 ? logs[logs.length - 1].message : 'Unknown error occurred'}
          </div>
          <button 
            onClick={() => setStatus('idle')}
            className="bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 font-medium mt-4"
          >
            Retry Setup
          </button>
        </div>
      )}
    </div>
  );
};

export default AWSSetupWizard;
