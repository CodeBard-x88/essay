import React from 'react';

const SettingsScreen = ({ darkMode, toggleDarkMode }) => (
  <div className="space-y-6">
    <h1 className={`text-2xl sm:text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Settings</h1>

    <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm border ${darkMode ? 'border-gray-700' : 'border-gray-200'} p-6`}>
      <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-6`}>Preferences</h3>

      <ToggleRow
        label="Dark Mode"
        description="Toggle dark mode theme"
        toggled={darkMode}
        onToggle={toggleDarkMode}
        darkMode={darkMode}
      />
      <ToggleRow
        label="Email Notifications"
        description="Receive updates on assignments"
        toggled={true}
        onToggle={() => {}}
        darkMode={darkMode}
      />
      <ToggleRow
        label="Auto-Save"
        description="Enable automatic saving of grades"
        toggled={true}
        onToggle={() => {}}
        darkMode={darkMode}
      />
    </div>
  </div>
);

const ToggleRow = ({ label, description, toggled, onToggle, darkMode }) => (
  <div className="flex items-center justify-between py-3">
    <div>
      <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{label}</h4>
      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{description}</p>
    </div>
    <button
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${toggled ? 'bg-blue-600' : 'bg-gray-200'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${toggled ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  </div>
);

export default SettingsScreen;
