import React, { useState, useMemo } from 'react';
import { Filter, Search, X, User, Mail, Calendar, FileText, Award, Clock, Eye } from 'lucide-react';

const StudentsScreen = ({ darkMode, students = [], syncing = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [filters, setFilters] = useState({
    gradeRange: 'all',
    assignmentRange: 'all',
    sortBy: 'name'
  });

  // Filter and search logic
  const filteredStudents = useMemo(() => {
    let filtered = students.filter(student => {
      const matchesSearch = 
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesGradeRange = 
        filters.gradeRange === 'all' ||
        (filters.gradeRange === 'excellent' && student.avgGrade >= 90) ||
        (filters.gradeRange === 'good' && student.avgGrade >= 80 && student.avgGrade < 90) ||
        (filters.gradeRange === 'needs-improvement' && student.avgGrade < 80);

      const matchesAssignmentRange = 
        filters.assignmentRange === 'all' ||
        (filters.assignmentRange === 'high' && student.assignments >= 5) ||
        (filters.assignmentRange === 'medium' && student.assignments >= 3 && student.assignments < 5) ||
        (filters.assignmentRange === 'low' && student.assignments < 3);

      return matchesSearch && matchesGradeRange && matchesAssignmentRange;
    });

    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'grade':
          return b.avgGrade - a.avgGrade;
        case 'assignments':
          return b.assignments - a.assignments;
        default:
          return 0;
      }
    });

    return filtered;
  }, [students, searchTerm, filters]);

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      gradeRange: 'all',
      assignmentRange: 'all',
      sortBy: 'name'
    });
    setSearchTerm('');
  };

  const handleViewDetails = (student) => {
    setSelectedStudent(student);
  };

  const closeModal = () => {
    setSelectedStudent(null);
  };

  const hasActiveFilters = searchTerm || filters.gradeRange !== 'all' || filters.assignmentRange !== 'all' || filters.sortBy !== 'name';

  const getGradeColor = (grade) => {
    if (typeof grade !== 'number' || Number.isNaN(grade)) {
      return darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600';
    }
    if (grade >= 90) return darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800';
    if (grade >= 80) return darkMode ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-800';
    return darkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Students</h1>
          {syncing && <p className="text-sm text-blue-400">Syncing latest submissions...</p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className={`w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-10 pr-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors relative ${
              showFilters 
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' 
                : `${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`
            }`}
          >
            <Filter className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            {hasActiveFilters && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
            )}
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm border ${darkMode ? 'border-gray-700' : 'border-gray-200'} p-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Grade Range</label>
                <select
                  value={filters.gradeRange}
                  onChange={(e) => handleFilterChange('gradeRange', e.target.value)}
                  className={`w-full p-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:ring-2 focus:ring-blue-500`}
                >
                  <option value="all">All Grades</option>
                  <option value="excellent">Excellent (90%+)</option>
                  <option value="good">Good (80-89%)</option>
                  <option value="needs-improvement">Needs Improvement (&lt;80%)</option>
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Assignment Count</label>
                <select
                  value={filters.assignmentRange}
                  onChange={(e) => handleFilterChange('assignmentRange', e.target.value)}
                  className={`w-full p-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:ring-2 focus:ring-blue-500`}
                >
                  <option value="all">All Counts</option>
                  <option value="high">High Activity (5+)</option>
                  <option value="medium">Medium Activity (3-4)</option>
                  <option value="low">Low Activity (1-2)</option>
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Sort By</label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  className={`w-full p-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:ring-2 focus:ring-blue-500`}
                >
                  <option value="name">Name (A-Z)</option>
                  <option value="grade">Grade (High-Low)</option>
                  <option value="assignments">Assignments (High-Low)</option>
                </select>
              </div>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  darkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results Summary */}
      <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
        Showing {filteredStudents.length} of {students.length} students
        {searchTerm && <span> matching "{searchTerm}"</span>}
      </div>

      {/* Students Table */}
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`${darkMode ? 'bg-gray-750' : 'bg-gray-50'}`}>
              <tr>
                <th className={`text-left py-4 px-6 text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Student</th>
                <th className={`text-left py-4 px-6 text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Email</th>
                <th className={`text-left py-4 px-6 text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Assignments</th>
                <th className={`text-left py-4 px-6 text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Avg Grade</th>
                <th className={`text-left py-4 px-6 text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`py-8 px-6 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {students.length === 0 ? 'No students found. Save a graded assignment to create student profiles automatically.' : 'No students match your criteria.'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className={`hover:${darkMode ? 'bg-gray-750' : 'bg-gray-50'} transition-colors`}>
                    <td className={`py-4 px-6 ${darkMode ? 'text-white' : 'text-gray-900'} font-medium`}>{student.name}</td>
                    <td className={`py-4 px-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{student.email}</td>
                    <td className={`py-4 px-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{student.assignments}</td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getGradeColor(student.avgGrade)}`}>
                        {student.avgGrade}%
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button 
                        onClick={() => handleViewDetails(student)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Details Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto`}>
            {/* Modal Header */}
            <div className={`sticky top-0 ${darkMode ? 'bg-gray-800' : 'bg-white'} border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} p-6`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full ${darkMode ? 'bg-blue-600' : 'bg-blue-500'} flex items-center justify-center`}>
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {selectedStudent.name}
                    </h2>
                    <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      Student Profile & Assignments
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
                >
                  <X className={`w-6 h-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Student Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Email</span>
                  </div>
                  <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{selectedStudent.email}</p>
                </div>
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Enrolled</span>
                  </div>
                  <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{selectedStudent.enrolledDate}</p>
                </div>
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Last Active</span>
                  </div>
                  <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {selectedStudent.lastActive || '—'}
                  </p>
                </div>
              </div>

              {/* Performance Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Award className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Average Grade</span>
                  </div>
                  <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{selectedStudent.avgGrade}%</p>
                </div>
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Assignments Submitted</span>
                  </div>
                  <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{selectedStudent.assignments}</p>
                </div>
              </div>

              {/* Assignments List */}
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Submitted Assignments
                </h3>
                <div className="space-y-3">
                  {(selectedStudent.submittedAssignments || []).map((assignment) => (
                    <div
                      key={assignment.id}
                      className={`p-4 rounded-lg border ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-white'}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            {assignment.title}
                          </h4>
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Submitted: {assignment.submittedDate}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getGradeColor(assignment.grade)}`}>
                            {assignment.grade}%
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            assignment.status === 'Graded' 
                              ? darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'
                              : darkMode ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {assignment.status}
                          </span>
                        </div>
                      </div>
                      <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'} italic`}>
                        "{assignment.feedback}"
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentsScreen;