import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Timeline({ data }) {
  if (!data || data.length === 0) {
    return <div className="p-4 text-gray-500">No timeline data available.</div>;
  }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Line type="stepAfter" dataKey="statusValue" stroke="#2563eb" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
