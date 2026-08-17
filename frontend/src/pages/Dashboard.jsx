import React from 'react';
import { Link } from 'react-router-dom';
import { Server, Activity, Plus } from 'lucide-react';

export default function Dashboard() {
  const projects = [
    { id: 1, name: 'react-sample', framework: 'React', status: 'success', url: 'http://8.8.8.8' },
    { id: 2, name: 'fastapi-sample', framework: 'FastAPI', status: 'failed', url: null },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">CloudForge Dashboard</h1>
          <Link to="/upload" className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-5 h-5 mr-2" />
            New Project
          </Link>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} to={`/project/${project.id}`} className="block p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Server className="w-8 h-8 text-blue-500 mr-3" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                    <p className="text-sm text-gray-500">{project.framework}</p>
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full ${project.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <Activity className="w-4 h-4 mr-2" />
                {project.status === 'success' ? 'Running smoothly' : 'Deployment failed'}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
