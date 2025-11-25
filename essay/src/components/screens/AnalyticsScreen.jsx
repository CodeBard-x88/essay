import React, { useMemo } from 'react';
import { BarChart2, PieChart, CalendarDays, Activity } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Pie, PieChart as RePieChart, Cell,
  LineChart, Line,
  AreaChart, Area
} from 'recharts';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b'];

const AnalyticsScreen = ({ darkMode, essays = [], syncing = false }) => {
  const { barData, pieData, lineData, areaData } = useMemo(() => buildAnalyticsData(essays), [essays]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className={`text-2xl sm:text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Analytics</h1>
        {syncing && <span className="text-sm text-blue-400">Updating charts...</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartCard title="Assignment Score Distribution" Icon={BarChart2} darkMode={darkMode}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <XAxis dataKey="name" stroke={darkMode ? '#ccc' : '#000'} />
              <YAxis stroke={darkMode ? '#ccc' : '#000'} />
              <Tooltip />
              <Bar dataKey="score" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Students by Grade Bracket" Icon={PieChart} darkMode={darkMode}>
          <ResponsiveContainer width="100%" height={200}>
            <RePieChart>
              <Pie data={pieData} dataKey="value" outerRadius={70} label>
                {pieData.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </RePieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Submission Trends (7d)" Icon={CalendarDays} darkMode={darkMode}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={lineData}>
              <XAxis dataKey="date" stroke={darkMode ? '#ccc' : '#000'} />
              <YAxis stroke={darkMode ? '#ccc' : '#000'} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="submissions" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Engagement Momentum" Icon={Activity} darkMode={darkMode}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={areaData}>
              <XAxis dataKey="time" stroke={darkMode ? '#ccc' : '#000'} />
              <YAxis stroke={darkMode ? '#ccc' : '#000'} />
              <Tooltip />
              <Area type="monotone" dataKey="interactions" stroke="#6366f1" fill="#c7d2fe" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      {essays.length === 0 && (
        <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>
          No analytics yet. Add a graded assignment to populate these charts.
        </p>
      )}
    </div>
  );
};

const ChartCard = ({ title, Icon, darkMode, children }) => (
  <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm border ${darkMode ? 'border-gray-700' : 'border-gray-200'} p-6`}>
    <div className="flex items-center gap-2 mb-4">
      <Icon className={`w-5 h-5 ${darkMode ? 'text-blue-400' : 'text-blue-500'}`} />
      <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
    </div>
    {children}
  </div>
);

function buildAnalyticsData(essays) {
  const graded = essays.filter((essay) => typeof essay.grade === 'number');
  const barData = graded.slice(0, 6).map((essay) => ({
    name: essay.title.slice(0, 12),
    score: essay.grade,
  }));

  const buckets = { '90-100%': 0, '80-89%': 0, '<80%': 0 };
  graded.forEach((essay) => {
    if (essay.grade >= 90) buckets['90-100%'] += 1;
    else if (essay.grade >= 80) buckets['80-89%'] += 1;
    else buckets['<80%'] += 1;
  });
  const pieData = Object.entries(buckets)
    .map(([name, value]) => ({ name, value }))
    .filter((entry) => entry.value > 0);

  const last7Days = [...Array(7)].map((_, idx) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - idx));
    const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { date: key, count: 0 };
  });
  graded.forEach((essay) => {
    const essayDate = new Date(essay.createdAt);
    const diff = Math.floor((Date.now() - essayDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 6) {
      const index = 6 - diff;
      last7Days[index].count += 1;
    }
  });
  const lineData = last7Days.map((day) => ({ date: day.date, submissions: day.count }));

  let cumulative = 0;
  const areaData = lineData.map((day) => {
    cumulative += day.submissions;
    return { time: day.date, interactions: cumulative };
  });

  return {
    barData: barData.length ? barData : [{ name: 'No Data', score: 0 }],
    pieData: pieData.length ? pieData : [{ name: 'No Data', value: 1 }],
    lineData,
    areaData,
  };
}

export default AnalyticsScreen;
