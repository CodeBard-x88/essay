import React, { useState } from 'react';
import Sidebar from './Sidebar';
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart,
  Settings
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const MainLayout = ({ children, darkMode, toggleDarkMode, handleLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const sidebarItems = [
    { id: '/', label: 'Dashboard', icon: LayoutDashboard },
    { id: '/assignments', label: 'Assignments', icon: FileText },
    { id: '/students', label: 'Students', icon: Users },
    { id: '/analytics', label: 'Analytics', icon: BarChart },
    { id: '/settings', label: 'Settings', icon: Settings },
  ];

  const setCurrentScreen = (screen) => {
    navigate(screen);
  };

  return (
    <div className={`min-h-screen flex ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <Sidebar
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        handleLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        currentScreen={location.pathname}
        setCurrentScreen={setCurrentScreen}
        sidebarItems={sidebarItems}
      />
      <div className="flex-1 p-4 sm:p-6 lg:p-8">
        {children}
      </div>
    </div>
  );
};

export default MainLayout;