import React from 'react';
import { FileText, Users, Award, TrendingUp, Clock, RefreshCw } from 'lucide-react';

const DashboardScreen = ({ darkMode, stats = {}, recentGrades = [], syncing = false, error = '' }) => {
  const summaryCards = [
    { label: 'Total Assignments', value: stats.totalAssignments ?? 0, Icon: FileText, color: 'blue' },
    { label: 'Students', value: stats.totalStudents ?? 0, Icon: Users, color: 'green' },
    { label: 'Avg Score', value: stats.avgScore ?? '—', Icon: Award, color: 'yellow' },
    { label: 'Pending', value: stats.pending ?? 0, Icon: TrendingUp, color: 'red' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Dashboard Overview</h1>
          {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
        </div>
        <div className="flex items-center gap-2">
          {syncing && (
            <span className="flex items-center gap-1 text-sm text-blue-400">
              <RefreshCw className="h-4 w-4 animate-spin" /> Syncing
            </span>
          )}
          <Clock className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Last updated: {new Date().toLocaleString()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {summaryCards.map((card) => (
          <StatCard key={card.label} {...card} darkMode={darkMode} />
        ))}
      </div>

      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm border ${darkMode ? 'border-gray-700' : 'border-gray-200'} p-6`}>
        <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>Recent Grades</h2>
        {recentGrades.length === 0 ? (
          <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>No grades recorded yet. Grade an assignment to see it here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`${darkMode ? 'border-gray-700' : 'border-gray-200'} border-b`}>
                  <th className={`text-left py-3 px-2 text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Student</th>
                  <th className={`text-left py-3 px-2 text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Assignment</th>
                  <th className={`text-left py-3 px-2 text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Grade</th>
                  <th className={`text-left py-3 px-2 text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentGrades.map((grade) => (
                  <tr
                    key={grade.id}
                    className={`${darkMode ? 'border-gray-700' : 'border-gray-200'} border-b hover:${darkMode ? 'bg-gray-700' : 'bg-gray-50'} transition-colors`}
                  >
                    <td className={`py-3 px-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{grade.student}</td>
                    <td className={`py-3 px-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{grade.assignment}</td>
                    <td className="py-3 px-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          grade.grade >= 90
                            ? darkMode
                              ? 'bg-green-900 text-green-200'
                              : 'bg-green-100 text-green-800'
                            : grade.grade >= 80
                            ? darkMode
                              ? 'bg-yellow-900 text-yellow-200'
                              : 'bg-yellow-100 text-yellow-800'
                            : darkMode
                            ? 'bg-red-900 text-red-200'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {grade.grade}%
                      </span>
                    </td>
                    <td className={`py-3 px-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'} text-sm`}>{grade.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, Icon, darkMode, color }) => {
  const colorClass = {
    blue: darkMode ? 'text-blue-400' : 'text-blue-500',
    green: darkMode ? 'text-green-400' : 'text-green-500',
    yellow: darkMode ? 'text-yellow-400' : 'text-yellow-500',
    red: darkMode ? 'text-red-400' : 'text-red-500',
  }[color];

  return (
    <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl shadow-sm border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{label}</p>
          <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{value}</p>
        </div>
        <Icon className={`w-8 h-8 ${colorClass}`} />
      </div>
    </div>
  );
};

export default DashboardScreen;
