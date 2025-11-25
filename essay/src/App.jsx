import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Auth
import LoginScreen from './components/auth/LoginScreen';
import RegisterScreen from './components/auth/RegisterScreen';
import ForgotPasswordScreen from './components/auth/ForgotPasswordScreen';

// Layout
import MainLayout from './components/layout/MainLayout';

// Screens
import DashboardScreen from './components/screens/DashboardScreen';
import AssignmentsScreen from './components/screens/AssignmentsScreen';
import StudentsScreen from './components/screens/StudentsScreen';
import AnalyticsScreen from './components/screens/AnalyticsScreen';
import SettingsScreen from './components/screens/SettingsScreen';
import NewAssignmentScreen from './components/screens/NewAssignmentScreen';
import GradeAssignmentScreen from './components/screens/GradeAssignmentScreen';
import { api } from './services/api';

const TOKEN_KEY = 'essay_auth_token';

const App = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [students, setStudents] = useState([]);
  const [essays, setEssays] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dataError, setDataError] = useState('');

  const isAuthenticated = Boolean(authToken);

  const fetchDashboardData = useCallback(
    async (tokenOverride) => {
      const token = tokenOverride || authToken;
      if (!token) return;
      setIsSyncing(true);
      try {
        const [studentsResponse, essaysResponse, assignmentsResponse] = await Promise.all([
          api.fetchStudents(token),
          api.fetchEssays(token),
          api.fetchAssignments(token),
        ]);
        setStudents(studentsResponse);
        setEssays(essaysResponse);
        setAssignments(assignmentsResponse);
        setDataError('');
      } catch (err) {
        setDataError(err.message || 'Unable to sync data');
      } finally {
        setIsSyncing(false);
      }
    },
    [authToken]
  );

  useEffect(() => {
    if (authToken) {
      fetchDashboardData(authToken);
    } else {
      setStudents([]);
      setEssays([]);
      setAssignments([]);
    }
  }, [authToken, fetchDashboardData]);

  const handleLogin = async (credentials) => {
    const { token } = await api.login(credentials);
    localStorage.setItem(TOKEN_KEY, token);
    setAuthToken(token);
    await fetchDashboardData(token);
    return true;
  };

  const handleRegister = async (form) => {
    await api.register(form);
    return true;
  };

  const handleForgotPassword = (e, email) => {
    e.preventDefault();
    if (email) {
      alert(`📩 Reset link sent to ${email}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    setStudents([]);
    setEssays([]);
    setAssignments([]);
  };

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  const dashboardStats = useMemo(() => buildDashboardStats(students, assignments, essays), [students, assignments, essays]);
  const recentGrades = useMemo(() => buildRecentGrades(essays), [essays]);
  const studentProfiles = useMemo(() => buildStudentProfiles(students, essays), [students, essays]);
  const assignmentCards = useMemo(() => buildAssignmentsData(assignments, essays), [assignments, essays]);

  const handleEssaySaved = () => {
    fetchDashboardData();
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" />
            ) : (
              <LoginScreen
                darkMode={darkMode}
                toggleDarkMode={toggleDarkMode}
                loginForm={loginForm}
                setLoginForm={setLoginForm}
                handleLogin={handleLogin}
              />
            )
          }
        />

        <Route
          path="/register"
          element={
            isAuthenticated ? (
              <Navigate to="/" />
            ) : (
              <RegisterScreen
                darkMode={darkMode}
                toggleDarkMode={toggleDarkMode}
                handleRegister={handleRegister}
              />
            )
          }
        />

        <Route
          path="/forgot-password"
          element={
            isAuthenticated ? (
              <Navigate to="/" />
            ) : (
              <ForgotPasswordScreen
                darkMode={darkMode}
                toggleDarkMode={toggleDarkMode}
                handleForgotPassword={handleForgotPassword}
              />
            )
          }
        />

        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <MainLayout darkMode={darkMode} toggleDarkMode={toggleDarkMode} handleLogout={handleLogout}>
                <Routes>
                  <Route
                    path="/"
                    element={
                      <DashboardScreen
                        darkMode={darkMode}
                        stats={dashboardStats}
                        recentGrades={recentGrades}
                        syncing={isSyncing}
                        error={dataError}
                      />
                    }
                  />
                  <Route
                    path="/assignments"
                    element={
                      <AssignmentsScreen
                        darkMode={darkMode}
                        assignments={assignmentCards}
                        syncing={isSyncing}
                        authToken={authToken}
                        onRefresh={() => fetchDashboardData()}
                      />
                    }
                  />
                  <Route
                    path="/assignments/new"
                    element={
                      <NewAssignmentScreen
                        darkMode={darkMode}
                        authToken={authToken}
                        onCreated={() => fetchDashboardData()}
                      />
                    }
                  />
                  <Route
                    path="/assignments/:id/grade"
                    element={
                      <GradeAssignmentScreen
                        darkMode={darkMode}
                        authToken={authToken}
                        onSaved={handleEssaySaved}
                      />
                    }
                  />
                  <Route
                    path="/students"
                    element={<StudentsScreen darkMode={darkMode} students={studentProfiles} syncing={isSyncing} />}
                  />
                  <Route path="/analytics" element={<AnalyticsScreen darkMode={darkMode} essays={essays} syncing={isSyncing} />} />
                  <Route path="/settings" element={<SettingsScreen darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
                </Routes>
              </MainLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </Router>
  );
};

function buildDashboardStats(students = [], assignments = [], essays = []) {
  const graded = essays.filter((essay) => typeof essay.grade === 'number');
  const avgScore =
    graded.length > 0
      ? `${(graded.reduce((sum, essay) => sum + (essay.grade || 0), 0) / graded.length).toFixed(1)}%`
      : '—';

  return {
    totalAssignments: assignments.length,
    totalStudents: students.length,
    avgScore,
    pending: essays.length - graded.length,
  };
}

function buildRecentGrades(essays = []) {
  return essays
    .filter((essay) => typeof essay.grade === 'number')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
    .map((essay) => ({
      id: essay._id,
      student: essay.studentName,
      assignment: essay.title,
      grade: Math.round(essay.grade ?? 0),
      date: new Date(essay.createdAt).toLocaleString(),
    }));
}

function buildStudentProfiles(students = [], essays = []) {
  return students.map((student) => {
    const studentEssays = essays.filter((essay) => essay.studentRoll === student.roll);
    const sortedEssays = [...studentEssays].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const graded = sortedEssays.filter((essay) => typeof essay.grade === 'number');
    const avgGrade =
      graded.length > 0
        ? Math.round(graded.reduce((sum, essay) => sum + (essay.grade || 0), 0) / graded.length)
        : 0;

    return {
      id: student._id,
      name: student.name,
      email: student.email,
      assignments: sortedEssays.length,
      avgGrade,
      enrolledDate: student.createdAt ? new Date(student.createdAt).toLocaleDateString() : '—',
      lastActive: sortedEssays[0]?.createdAt ? new Date(sortedEssays[0].createdAt).toLocaleDateString() : '—',
      submittedAssignments: sortedEssays.map((essay) => ({
        id: essay._id,
        title: essay.title,
        submittedDate: new Date(essay.createdAt).toLocaleDateString(),
        grade: essay.grade ?? 'N/A',
        status: typeof essay.grade === 'number' ? 'Graded' : 'Pending',
        feedback: essay.feedback || 'No feedback yet',
      })),
    };
  });
}

function buildAssignmentsData(assignments = [], essays = []) {
  return assignments.map((assignment) => {
    const relatedEssays = essays.filter((essay) => {
      if (essay.assignment && essay.assignment._id) {
        return essay.assignment._id === assignment._id;
      }
      return essay.assignment === assignment._id || essay.assignmentId === assignment._id || essay.title === assignment.title;
    });

    const graded = relatedEssays.filter((essay) => typeof essay.grade === 'number');
    const avgScore =
      graded.length > 0
        ? Math.round(graded.reduce((sum, essay) => sum + (essay.grade || 0), 0) / graded.length)
        : null;

    return {
      id: assignment._id,
      title: assignment.title,
      description: assignment.description,
      dueDate: assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : '—',
      totalMarks: assignment.totalMarks,
      submissions: relatedEssays.length,
      graded: graded.length,
      avgScore,
      createdAt: assignment.createdAt,
      attachmentName: assignment.attachmentName,
      submissionsDetails: relatedEssays.map((essay) => ({
        id: essay._id,
        studentName: essay.studentName,
        studentEmail: essay.studentEmail,
        studentRoll: essay.studentRoll,
        grade: essay.grade,
        feedback: essay.feedback,
        createdAt: essay.createdAt,
      })),
    };
  });
}

export default App;
