import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Terminal, Activity, Clock, Server } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ProjectDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('metrics');

  const mockMetrics = [
    { time: '10:00', cpu: 2.5, mem: 120 },
    { time: '10:05', cpu: 3.8, mem: 125 },
    { time: '10:10', cpu: 1.2, mem: 122 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <Link to="/" className="flex items-center text-blue-600 mb-6 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Link>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Project {id} Details</h1>
        
        <div className="flex border-b border-gray-200 mb-6">
          <button onClick={() => setActiveTab('timeline')} className={`px-4 py-2 flex items-center ${activeTab === 'timeline' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
            <Clock className="w-4 h-4 mr-2" /> Timeline
          </button>
          <button onClick={() => setActiveTab('logs')} className={`px-4 py-2 flex items-center ${activeTab === 'logs' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
            <Terminal className="w-4 h-4 mr-2" /> Logs
          </button>
          <button onClick={() => setActiveTab('metrics')} className={`px-4 py-2 flex items-center ${activeTab === 'metrics' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
            <Activity className="w-4 h-4 mr-2" /> Metrics
          </button>
          <button onClick={() => setActiveTab('services')} className={`px-4 py-2 flex items-center ${activeTab === 'services' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
            <Server className="w-4 h-4 mr-2" /> Services
          </button>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm min-h-[400px]">
          {activeTab === 'metrics' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">CPU Usage (%)</h3>
              <div className="h-64 mb-8">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mockMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="cpu" stroke="#2563eb" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              <h3 className="text-lg font-semibold mb-4">Memory Usage (MB)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mockMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="mem" stroke="#16a34a" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          
          {activeTab === 'timeline' && (
            <div>
              <ul className="space-y-4">
                <li className="flex items-center text-sm text-gray-600"><div className="w-2 h-2 rounded-full bg-green-500 mr-3" /> Deployed successfully at 10:15 AM</li>
                <li className="flex items-center text-sm text-gray-600"><div className="w-2 h-2 rounded-full bg-blue-500 mr-3" /> Build completed at 10:14 AM</li>
                <li className="flex items-center text-sm text-gray-600"><div className="w-2 h-2 rounded-full bg-blue-500 mr-3" /> Provisioned EC2 instance at 10:10 AM</li>
              </ul>
            </div>
          )}
          
          {activeTab === 'logs' && (
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm h-64 overflow-y-auto">
              [10:14:02] Starting container proj_1_1...<br/>
              [10:14:03] Server running on port 80...
            </div>
          )}
          
          {activeTab === 'services' && (
            <div className="space-y-4">
              <div className="p-4 border border-gray-200 rounded-lg flex justify-between items-center">
                <span className="font-semibold text-gray-800">client (proj_1_client)</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Running</span>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg flex justify-between items-center">
                <span className="font-semibold text-gray-800">server (proj_1_server)</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Running</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
