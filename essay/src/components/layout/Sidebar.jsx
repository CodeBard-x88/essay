import React from 'react';
import { BookOpen, Sun, Moon, LogOut, X } from 'lucide-react';

const Sidebar = ({
  darkMode, toggleDarkMode, handleLogout, setCurrentScreen,
  sidebarOpen, setSidebarOpen, currentScreen, sidebarItems
}) => (
  <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-64 ${darkMode ? 'bg-gray-900' : 'bg-white'} border-r ${darkMode ? 'border-gray-700' : 'border-gray-200'} transition-transform duration-300`}>
    <div className="flex items-center justify-between p-4 lg:justify-center">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 ${darkMode ? 'bg-blue-600' : 'bg-blue-500'} rounded-lg flex items-center justify-center`}>
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <span className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>GradePro</span>
      </div>
      <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 rounded-lg">
        <X className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
      </button>
    </div>
    <nav className="mt-8 px-4">
      <ul className="space-y-2">
        {sidebarItems.map(({ id, label, icon: Icon }) => (
          <li key={id}>
            <button
              onClick={() => {
                setCurrentScreen(id);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${
                currentScreen === id
                  ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600')
                  : (darkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100')
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
    <div className="absolute bottom-4 left-4 right-4 flex justify-between">
      <button onClick={toggleDarkMode} className={`p-2 rounded-lg ${darkMode ? 'bg-gray-800 text-yellow-400' : 'bg-gray-100 text-gray-600'}`}>
        {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
      <button onClick={handleLogout} className={`p-2 rounded-lg ${darkMode ? 'bg-gray-800 text-red-400' : 'bg-gray-100 text-red-600'}`}>
        <LogOut className="w-5 h-5" />
      </button>
    </div>
  </div>
);

export default Sidebar;
