'use client';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const TICK = { fontSize: 12, fill: '#9c988e' };

export function OutcomeChart({ data }: { data: { subject: string; Understood: number; 'Needs Revision': number; "Didn't Understand": number }[] }) {
  return (
    <div role="img" aria-label="Stacked bar chart of assessment outcomes by subject. The same numbers are in the table below." style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -16, top: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2b2a26" />
          <XAxis dataKey="subject" tick={TICK} axisLine={{ stroke: '#403d36' }} tickLine={false} />
          <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: '#ffffff0a' }} contentStyle={{ background: '#171715', border: '1px solid #403d36', borderRadius: 6, color: '#f1eee7', fontSize: 13 }} labelStyle={{ color: '#ead6a6', fontWeight: 600 }} itemStyle={{ color: '#f1eee7' }} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#bdb8ad' }} />
          <Bar dataKey="Understood" stackId="a" fill="#86cf9f" /><Bar dataKey="Needs Revision" stackId="a" fill="#e6ae5c" /><Bar dataKey="Didn't Understand" stackId="a" fill="#ef8a84" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
