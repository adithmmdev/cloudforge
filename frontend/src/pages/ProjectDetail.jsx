import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Terminal, Activity, Clock, Server, Shield, Stethoscope, Search, Settings, FileText } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ProjectDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('metrics');
  
  const [deployments, setDeployments] = useState([]);
  const [latestDeployment, setLatestDeployment] = useState(null);
  
  const [metrics, setMetrics] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  const [disclosures, setDisclosures] = useState([]);
  const [shadowTests, setShadowTests] = useState([]);
  const [remediationActions, setRemediationActions] = useState([]);
  const [report, setReport] = useState(null);
  const [autonomyMode, setAutonomyMode] = useState('approve_each');

  // Fetch initial project data
  useEffect(() => {
    fetch(`/api/projects/${id}/deployments`)
      .then(r => r.json())
      .then(data => {
        setDeployments(data);
        if (data.length > 0) {
          setLatestDeployment(data[0]);
        }
      })
      .catch(console.error);
      
    fetch(`/api/projects/${id}/autonomy`)
      .then(r => r.json())
      .then(data => setAutonomyMode(data.mode))
      .catch(console.error);
  }, [id]);

  // Fetch deployment specific data
  useEffect(() => {
    if (!latestDeployment) return;
    const depId = latestDeployment.id;
    
    fetch(`/api/deployments/${depId}/diagnoses`).then(r => r.json()).then(setDiagnoses).catch(console.error);
    fetch(`/api/deployments/${depId}/disclosures`).then(r => r.json()).then(setDisclosures).catch(console.error);
    fetch(`/api/deployments/${depId}/shadow-tests`).then(r => r.json()).then(setShadowTests).catch(console.error);
    fetch(`/api/deployments/${depId}/remediation-actions`).then(r => r.json()).then(setRemediationActions).catch(console.error);
    fetch(`/api/deployments/${depId}/report`).then(r => {
      if(r.ok) return r.json();
      return null;
    }).then(setReport).catch(console.error);
    
    // WebSocket for metrics
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws/deployments/${depId}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'deployment_update' && data.metrics) {
        // Just take the first container's metrics for the chart for simplicity
        const containerNames = Object.keys(data.metrics);
        if (containerNames.length > 0) {
            const m = data.metrics[containerNames[0]];
            setMetrics(prev => {
                const newMetrics = [...prev, { time: new Date(m.timestamp).toLocaleTimeString(), cpu: m.cpu_percent, mem: m.mem_usage_mb }];
                if (newMetrics.length > 20) return newMetrics.slice(newMetrics.length - 20);
                return newMetrics;
            });
        }
      }
    };
    
    return () => ws.close();
  }, [latestDeployment]);

  const handleAutonomyChange = (mode) => {
    fetch(`/api/projects/${id}/autonomy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    }).then(() => setAutonomyMode(mode)).catch(console.error);
  };
  
  const handleApproveAction = (actionId) => {
    fetch(`/api/remediation-actions/${actionId}/approve`, { method: 'POST' })
      .then(() => alert("Action approved!"))
      .catch(console.error);
  };
  
  const handleRejectAction = (actionId) => {
    fetch(`/api/remediation-actions/${actionId}/reject`, { method: 'POST' })
      .then(() => alert("Action rejected!"))
      .catch(console.error);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <Link to="/" className="flex items-center text-blue-600 mb-6 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Link>
        
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Project {id} Details</h1>
            <div className="flex items-center space-x-2 bg-white p-2 rounded-lg shadow-sm">
                <Settings className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">Autonomy Dial:</span>
                <select value={autonomyMode} onChange={(e) => handleAutonomyChange(e.target.value)} className="text-sm border-gray-300 rounded">
                    <option value="suggest_only">Suggest Only</option>
                    <option value="approve_each">Approve Each</option>
                    <option value="full_auto">Full Auto</option>
                </select>
            </div>
        </div>
        
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
          <button onClick={() => setActiveTab('metrics')} className={`px-4 py-2 flex items-center whitespace-nowrap ${activeTab === 'metrics' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
            <Activity className="w-4 h-4 mr-2" /> Metrics
          </button>
          <button onClick={() => setActiveTab('diagnoses')} className={`px-4 py-2 flex items-center whitespace-nowrap ${activeTab === 'diagnoses' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
            <Stethoscope className="w-4 h-4 mr-2" /> Agent Reasoning
          </button>
          <button onClick={() => setActiveTab('actions')} className={`px-4 py-2 flex items-center whitespace-nowrap ${activeTab === 'actions' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
            <Shield className="w-4 h-4 mr-2" /> Remediation Actions
          </button>
          <button onClick={() => setActiveTab('shadow')} className={`px-4 py-2 flex items-center whitespace-nowrap ${activeTab === 'shadow' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
            <Search className="w-4 h-4 mr-2" /> Shadow Verification
          </button>
          <button onClick={() => setActiveTab('disclosures')} className={`px-4 py-2 flex items-center whitespace-nowrap ${activeTab === 'disclosures' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
            <Server className="w-4 h-4 mr-2" /> Disclosure Ledger
          </button>
          <button onClick={() => setActiveTab('report')} className={`px-4 py-2 flex items-center whitespace-nowrap ${activeTab === 'report' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
            <FileText className="w-4 h-4 mr-2" /> Deployment Report
          </button>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm min-h-[400px]">
          {activeTab === 'metrics' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">CPU Usage (%)</h3>
              <div className="h-64 mb-8">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="cpu" stroke="#2563eb" isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              <h3 className="text-lg font-semibold mb-4">Memory Usage (MB)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="mem" stroke="#16a34a" isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          
          {activeTab === 'diagnoses' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Agent Reasoning</h3>
              {diagnoses.length === 0 ? <p className="text-gray-500">No diagnoses found.</p> : (
                  <div className="space-y-4">
                      {diagnoses.map(d => (
                          <div key={d.id} className="p-4 border rounded-lg bg-gray-50">
                              <div className="flex justify-between items-center mb-2">
                                <span className={`px-2 py-1 text-xs font-bold rounded text-white ${d.model_tier === 'local' ? 'bg-blue-600' : 'bg-purple-600'}`}>
                                    {d.model_tier.toUpperCase()} - {d.cloud_provider}
                                </span>
                                <span className="text-sm font-mono bg-gray-200 px-2 py-1 rounded">Confidence: {(d.confidence * 100).toFixed(1)}%</span>
                              </div>
                              <p className="font-semibold text-gray-800">Action: {d.action_type}</p>
                              <pre className="text-xs bg-gray-800 text-green-400 p-2 rounded mt-2 overflow-x-auto">{JSON.stringify(d.params, null, 2)}</pre>
                              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{d.reasoning}</p>
                          </div>
                      ))}
                  </div>
              )}
            </div>
          )}
          
          {activeTab === 'actions' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Remediation Actions</h3>
              {remediationActions.length === 0 ? <p className="text-gray-500">No remediation actions found.</p> : (
                  <div className="space-y-4">
                      {remediationActions.map(a => (
                          <div key={a.id} className="p-4 border rounded-lg flex justify-between items-center bg-gray-50">
                              <div>
                                <p className="font-semibold text-gray-800">{a.action_type}</p>
                                <p className="text-sm text-gray-500">{JSON.stringify(a.params)}</p>
                                <span className={`inline-block mt-1 px-2 py-1 text-xs rounded ${a.status === 'proposed' ? 'bg-yellow-100 text-yellow-800' : a.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{a.status.toUpperCase()}</span>
                              </div>
                              {a.status === 'proposed' && autonomyMode === 'approve_each' && (
                                  <div className="space-x-2">
                                      <button onClick={() => handleApproveAction(a.id)} className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">Approve</button>
                                      <button onClick={() => handleRejectAction(a.id)} className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">Reject</button>
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
              )}
            </div>
          )}

          {activeTab === 'shadow' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Shadow Verification Tests</h3>
              {shadowTests.length === 0 ? <p className="text-gray-500">No shadow tests run yet.</p> : (
                  <div className="space-y-4">
                      {shadowTests.map(t => (
                          <div key={t.id} className={`p-4 border rounded-lg ${t.passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                              <p className="font-semibold">{t.test_name}</p>
                              <p className={`text-sm ${t.passed ? 'text-green-700' : 'text-red-700'}`}>{t.passed ? 'PASSED' : 'FAILED'}</p>
                              <pre className="text-xs mt-2 overflow-x-auto bg-gray-900 text-gray-100 p-2 rounded">{t.output}</pre>
                          </div>
                      ))}
                  </div>
              )}
            </div>
          )}

          {activeTab === 'disclosures' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Disclosure Ledger</h3>
              <p className="text-sm text-gray-500 mb-4">Log of all redacted signatures sent to third-party APIs.</p>
              {disclosures.length === 0 ? <p className="text-gray-500">No disclosures made.</p> : (
                  <div className="space-y-4">
                      {disclosures.map(d => (
                          <div key={d.id} className="p-4 border rounded-lg bg-gray-50">
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-semibold text-blue-600">{d.provider_name}</span>
                                <span className="text-xs text-gray-500">{new Date(d.timestamp).toLocaleString()}</span>
                              </div>
                              <pre className="text-xs bg-gray-900 text-blue-300 p-2 rounded overflow-x-auto">{d.redacted_signature}</pre>
                          </div>
                      ))}
                  </div>
              )}
            </div>
          )}

          {activeTab === 'report' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Deployment Report</h3>
              {!report ? <p className="text-gray-500">No report generated yet.</p> : (
                  <div className="prose max-w-none bg-white border border-gray-200 p-6 rounded-lg">
                      <pre className="whitespace-pre-wrap font-sans">{report.markdown_content}</pre>
                      <p className="text-xs text-gray-400 mt-4">Generated at: {new Date(report.generated_at).toLocaleString()}</p>
                  </div>
              )}
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
