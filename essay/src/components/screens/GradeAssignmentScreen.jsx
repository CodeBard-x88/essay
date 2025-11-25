import React, { useEffect, useState } from "react";
import {
  Upload,
  FileText,
  Send,
  Star,
  CheckCircle,
  Clock,
  User,
  BookOpen,
  AtSign,
  Hash,
  AlertTriangle,
  X
} from "lucide-react";
import { useParams } from "react-router-dom";
import { api, evaluateEssayWithAI } from "../../services/api";

const GradeAssignmentScreen = ({
  darkMode,
  authToken,
  onSaved,
  onClose,
  asDialog = false,
  assignmentIdOverride
}) => {
  const { id: routeAssignmentId } = useParams();
  const resolvedAssignmentId = assignmentIdOverride ?? routeAssignmentId ?? undefined;
  const assignmentIdDisplay = resolvedAssignmentId ?? "N/A";
  const [studentName, setStudentName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [email, setEmail] = useState("");
  const [submissionText, setSubmissionText] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [submissionType, setSubmissionType] = useState("text");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const [evaluationError, setEvaluationError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [assignment, setAssignment] = useState(null);
  const [assignmentError, setAssignmentError] = useState("");
  const [isAssignmentLoading, setIsAssignmentLoading] = useState(false);

  useEffect(() => {
    if (!authToken || !resolvedAssignmentId) return;
    let canceled = false;
    setIsAssignmentLoading(true);
    setAssignmentError("");

    api
      .getAssignment(authToken, resolvedAssignmentId)
      .then((data) => {
        if (!canceled) {
          setAssignment(data);
        }
      })
      .catch((err) => {
        if (!canceled) {
          setAssignmentError(err.message || "Unable to load assignment");
        }
      })
      .finally(() => {
        if (!canceled) {
          setIsAssignmentLoading(false);
        }
      });

    return () => {
      canceled = true;
    };
  }, [resolvedAssignmentId, authToken]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setUploadedFile(file);
      setSubmissionType("file");
    }
  };

  const handleEvaluate = async () => {
    if (!studentName.trim() || !rollNo.trim() || !email.trim()) {
      alert("Please enter student's name, roll no, and email");
      return;
    }

    if (submissionType === "text" && !submissionText.trim()) {
      alert("Please enter the submission text");
      return;
    }

    if (submissionType === "file" && !uploadedFile) {
      alert("Please upload a file");
      return;
    }

    setIsEvaluating(true);
    setEvaluationError("");

    try {
      const content = await getSubmissionContent();
      if (!content) {
        throw new Error("Submission text is empty.");
      }

      const aiResponse = await evaluateEssayWithAI({
        submissionText: content,
        studentName,
        assignmentId: resolvedAssignmentId,
      });

      const normalizedScore =
        typeof aiResponse.score === "number"
          ? aiResponse.score
          : typeof aiResponse.normalized_score === "number"
            ? aiResponse.normalized_score
            : null;

      setEvaluation({
        ...aiResponse,
        strengths: aiResponse.strengths || [],
        improvements: aiResponse.improvements || [],
        metadata: aiResponse.metadata || {},
      });

      if (normalizedScore !== null) {
        setGrade(Math.round(normalizedScore).toString());
      }

      const aiFeedback = aiResponse.feedback || aiResponse.detailedFeedback;
      if (aiFeedback) {
        setFeedback(aiFeedback);
      }
    } catch (err) {
      setEvaluationError(err.message || "Failed to evaluate submission.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const getSubmissionContent = async () => {
    if (submissionType === "text") {
      return submissionText.trim();
    }

    if (!uploadedFile) {
      throw new Error("Please upload a text file first.");
    }

    if (
      uploadedFile.type.startsWith("text/") ||
      uploadedFile.name.toLowerCase().endsWith(".txt")
    ) {
      return (await uploadedFile.text()).trim();
    }
    throw new Error("Only plain text (.txt) files are supported.");
  };

  const handleSubmitGrade = async () => {
    if (!grade || !feedback.trim()) {
      alert("Please ensure grade and feedback are provided");
      return;
    }

    if (!authToken) {
      setSaveError("You are not authenticated. Please log in again.");
      return;
    }

    setIsSaving(true);
    setSaveError("");

    try {
      const content = await getSubmissionContent();
      if (!content) {
        throw new Error("Submission text is empty.");
      }
      await api.saveEssay(authToken, {
        studentName,
        studentEmail: email,
        studentRoll: rollNo,
        title: assignment?.title || (resolvedAssignmentId ? `Assignment ${assignmentIdDisplay}` : "Ungrouped Assignment"),
        content,
        grade: Number(grade),
        feedback,
        evaluation,
        assignmentId: resolvedAssignmentId,
      });

      alert(`Grade saved for ${studentName}!`);
      onSaved?.();

      setStudentName("");
      setRollNo("");
      setEmail("");
      setSubmissionText("");
      setUploadedFile(null);
      setEvaluation(null);
      setGrade("");
      setFeedback("");
      setSubmissionType("text");
    } catch (err) {
      setSaveError(err.message || "Failed to save grade.");
    } finally {
      setIsSaving(false);
    }
  };

  const assignmentTitle =
    assignment?.title || (resolvedAssignmentId ? `Assignment #${assignmentIdDisplay}` : "Assignment");
  const dueDateDisplay = assignment?.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : "—";

  const containerClasses = asDialog
    ? `relative ${darkMode ? "bg-gray-900" : "bg-white"} rounded-2xl shadow-2xl border ${
        darkMode ? "border-gray-700" : "border-gray-200"
      } max-h-[85vh] overflow-y-auto p-5 sm:p-8`
    : "";

  const inner = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1
          className={`text-2xl sm:text-3xl font-bold ${
            darkMode ? "text-white" : "text-gray-900"
          }`}
        >
          {assignmentTitle}
        </h1>
        <div className="flex items-center gap-2">
          <Clock
            className={`w-5 h-5 ${
              darkMode ? "text-gray-400" : "text-gray-500"
            }`}
          />
          <span
            className={`text-sm ${
              darkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            Last updated: {new Date().toLocaleString()}
          </span>
        </div>
      </div>
      {assignmentError && (
        <p className="text-xs text-red-400">Assignment details: {assignmentError}</p>
      )}
      {isAssignmentLoading && (
        <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>Loading assignment info…</p>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 lg:gap-6">
        <StatCard
          label="Assignment"
          value={assignmentTitle}
          Icon={BookOpen}
          darkMode={darkMode}
          color="blue"
        />
        <StatCard
          label="Assignment ID"
          value={resolvedAssignmentId ? `#${resolvedAssignmentId}` : "N/A"}
          Icon={Hash}
          darkMode={darkMode}
          color="purple"
        />
        <StatCard
          label="Student Name"
          value={studentName || "Not Set"}
          Icon={User}
          darkMode={darkMode}
          color="green"
        />
        <StatCard
          label="Roll No"
          value={rollNo || "Not Set"}
          Icon={Hash}
          darkMode={darkMode}
          color="purple"
        />
        <StatCard
          label="Email"
          value={email || "Not Set"}
          Icon={AtSign}
          darkMode={darkMode}
          color="orange"
        />
        <StatCard
          label="Current Grade"
          value={grade ? `${grade}%` : "Pending"}
          Icon={Star}
          darkMode={darkMode}
          color="yellow"
        />
      </div>
      {assignment && (
        <div
          className={`${
            darkMode ? "bg-gray-900/50 border-gray-700" : "bg-blue-50 border-blue-100"
          } border rounded-xl p-4 text-sm flex flex-wrap gap-4`}
        >
          <div>
            <p className="font-semibold">Due Date</p>
            <p>{dueDateDisplay}</p>
          </div>
          <div>
            <p className="font-semibold">Total Marks</p>
            <p>{assignment.totalMarks}</p>
          </div>
          {assignment.attachmentName && (
            <div>
              <p className="font-semibold">Attachment</p>
              <p>{assignment.attachmentName}</p>
            </div>
          )}
        </div>
      )}

      {/* Student Submission Form */}
      <div
        className={`${
          darkMode ? "bg-gray-800" : "bg-white"
        } rounded-xl shadow-sm border ${
          darkMode ? "border-gray-700" : "border-gray-200"
        } p-6`}
      >
        <h2
          className={`text-xl font-semibold ${
            darkMode ? "text-white" : "text-gray-900"
          } mb-4`}
        >
          Student Submission Details
        </h2>

        {/* Student Name */}
        <InputField
          label="Student Name *"
          value={studentName}
          onChange={setStudentName}
          placeholder="Enter student's full name"
          darkMode={darkMode}
        />

        {/* Roll No */}
        <InputField
          label="Roll No *"
          value={rollNo}
          onChange={setRollNo}
          placeholder="Enter roll number"
          darkMode={darkMode}
        />

        {/* Email */}
        <InputField
          label="Email *"
          value={email}
          onChange={setEmail}
          placeholder="Enter student email"
          darkMode={darkMode}
          type="email"
        />

        {/* Submission Type Selector */}
        <div className="mb-6">
          <label
            className={`block text-sm font-medium mb-2 ${
              darkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Submission Type
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setSubmissionType("text")}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors font-medium ${
                submissionType === "text"
                  ? "bg-blue-500 text-white"
                  : `${
                      darkMode
                        ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`
              }`}
            >
              <FileText className="w-4 h-4 mr-2" />
              Text Submission
            </button>
            <button
              onClick={() => setSubmissionType("file")}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors font-medium ${
                submissionType === "file"
                  ? "bg-blue-500 text-white"
                  : `${
                      darkMode
                        ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`
              }`}
            >
              <Upload className="w-4 h-4 mr-2" />
              File Upload
            </button>
          </div>
        </div>

        {/* Text Submission */}
        {submissionType === "text" && (
          <div className="mb-6">
            <label
              className={`block text-sm font-medium mb-2 ${
                darkMode ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Submission Content *
            </label>
            <textarea
              value={submissionText}
              onChange={(e) => setSubmissionText(e.target.value)}
              rows={8}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical ${
                darkMode
                  ? "bg-gray-700 text-white border-gray-600"
                  : "bg-white text-gray-900 border-gray-300"
              }`}
              placeholder="Paste the student's submission text here..."
            />
          </div>
        )}

        {/* File Upload */}
        {submissionType === "file" && (
          <div className="mb-6">
            <label
              className={`block text-sm font-medium mb-2 ${
                darkMode ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Upload Submission File *
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                darkMode
                  ? "border-gray-600 hover:border-gray-500"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <Upload
                className={`w-8 h-8 mx-auto mb-2 ${
                  darkMode ? "text-gray-400" : "text-gray-500"
                }`}
              />
              <p
                className={`text-sm mb-2 ${
                  darkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Drag and drop a file here, or click to select
              </p>
              <input
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                accept=".pdf,.doc,.docx,.txt"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors inline-block font-medium"
              >
                Choose File
              </label>
              {uploadedFile && (
                <p
                  className={`text-sm mt-2 ${
                    darkMode ? "text-white" : "text-gray-900"
                  } font-medium`}
                >
                  Selected: {uploadedFile.name}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Evaluate Button */}
        <button
          onClick={handleEvaluate}
          disabled={isEvaluating}
          className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center transition-colors ${
            isEvaluating
              ? "bg-gray-400 cursor-not-allowed text-white"
              : "bg-green-500 hover:bg-green-600 text-white"
          }`}
        >
          {isEvaluating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
              Evaluating Submission...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Evaluate with AI
            </>
          )}
        </button>
      </div>

      {evaluationError && (
        <div className={`${darkMode ? 'bg-red-900/40 border-red-700 text-red-100' : 'bg-red-50 border-red-200 text-red-800'} border rounded-lg p-4 flex items-start gap-3`}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Evaluation failed</p>
            <p className="text-sm">{evaluationError}</p>
          </div>
        </div>
      )}

      {saveError && (
        <div className={`${darkMode ? 'bg-red-900/40 border-red-700 text-red-100' : 'bg-red-50 border-red-200 text-red-800'} border rounded-lg p-4 flex items-start gap-3`}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Save failed</p>
            <p className="text-sm">{saveError}</p>
          </div>
        </div>
      )}

      {/* Evaluation Results */}
      {evaluation && (
        <div
          className={`${
            darkMode ? "bg-gray-800" : "bg-white"
          } rounded-xl shadow-sm border ${
            darkMode ? "border-gray-700" : "border-gray-200"
          } p-6`}
        >
          <h2
            className={`text-xl font-semibold ${
              darkMode ? "text-white" : "text-gray-900"
            } mb-4 flex items-center`}
          >
            <Star className="w-5 h-5 mr-2 text-yellow-500" />
            AI Evaluation Results
          </h2>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3
                className={`font-medium mb-3 ${
                  darkMode ? "text-white" : "text-gray-900"
                }`}
              >
                Strengths
              </h3>
              <div className="space-y-2">
                {evaluation.strengths?.map((strength, index) => (
                  <div key={index} className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span
                      className={`text-sm ${
                        darkMode ? "text-gray-300" : "text-gray-600"
                      }`}
                    >
                      {strength}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3
                className={`font-medium mb-3 ${
                  darkMode ? "text-white" : "text-gray-900"
                }`}
              >
                Areas for Improvement
              </h3>
              <div className="space-y-2">
                {evaluation.improvements?.map((improvement, index) => (
                  <div key={index} className="flex items-start">
                    <div className="w-4 h-4 bg-orange-500 rounded-full mr-2 mt-1 flex-shrink-0 text-xs flex items-center justify-center text-white font-bold">
                      !
                    </div>
                    <span
                      className={`text-sm ${
                        darkMode ? "text-gray-300" : "text-gray-600"
                      }`}
                    >
                      {improvement}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {evaluation.metadata && Object.keys(evaluation.metadata).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <MetadataStat label="Word Count" value={evaluation.metadata.word_count} darkMode={darkMode} />
              <MetadataStat label="Sentences" value={evaluation.metadata.sentence_count} darkMode={darkMode} />
              <MetadataStat
                label="Avg Sentence"
                value={
                  typeof evaluation.metadata.avg_sentence_length === "number"
                    ? `${Math.round(evaluation.metadata.avg_sentence_length)} words`
                    : "—"
                }
                darkMode={darkMode}
              />
              <MetadataStat
                label="Lexical Diversity"
                value={
                  typeof evaluation.metadata.lexical_diversity === "number"
                    ? `${(evaluation.metadata.lexical_diversity * 100).toFixed(1)}%`
                    : "—"
                }
                darkMode={darkMode}
              />
            </div>
          )}

          <div
            className={`border-t pt-6 ${
              darkMode ? "border-gray-700" : "border-gray-200"
            }`}
          >
            <h3
              className={`font-medium mb-4 ${
                darkMode ? "text-white" : "text-gray-900"
              }`}
            >
              Final Grade & Feedback
            </h3>

            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <div className="md:col-span-1">
                <label
                  className={`block text-sm font-medium mb-2 ${
                    darkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Grade (0-100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    darkMode
                      ? "bg-gray-700 text-white border-gray-600"
                      : "bg-white text-gray-900 border-gray-300"
                  }`}
                />
              </div>
            </div>

            <div className="mb-6">
              <label
                className={`block text-sm font-medium mb-2 ${
                  darkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Detailed Feedback
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={6}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical ${
                  darkMode
                    ? "bg-gray-700 text-white border-gray-600"
                    : "bg-white text-gray-900 border-gray-300"
                }`}
                placeholder="Provide detailed feedback for the student..."
              />
            </div>

            <button
              onClick={handleSubmitGrade}
              disabled={isSaving}
              className={`w-full py-3 px-4 rounded-lg font-medium ${
                isSaving ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {isSaving ? 'Saving...' : 'Submit Grade & Feedback'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (asDialog) {
    return (
      <div className={containerClasses}>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={`absolute top-3 right-3 p-2 rounded-full ${
              darkMode ? "hover:bg-gray-800 text-gray-300" : "hover:bg-gray-100 text-gray-500"
            } transition-colors`}
          >
            <X className="w-5 h-5" />
          </button>
        )}
        {inner}
      </div>
    );
  }

  return inner;
};

// ✅ Small helper component for text inputs
const InputField = ({
  label,
  value,
  onChange,
  placeholder,
  darkMode,
  type = "text"
}) => (
  <div className="mb-6">
    <label
      className={`block text-sm font-medium mb-2 ${
        darkMode ? "text-gray-400" : "text-gray-600"
      }`}
    >
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        darkMode
          ? "bg-gray-700 text-white border-gray-600"
          : "bg-white text-gray-900 border-gray-300"
      }`}
      placeholder={placeholder}
    />
  </div>
);

const StatCard = ({ label, value, Icon: IconProp, darkMode, color }) => {
  const colorClass = {
    blue: darkMode ? "text-blue-400" : "text-blue-500",
    green: darkMode ? "text-green-400" : "text-green-500",
    yellow: darkMode ? "text-yellow-400" : "text-yellow-500",
    red: darkMode ? "text-red-400" : "text-red-500",
    purple: darkMode ? "text-purple-400" : "text-purple-500",
    orange: darkMode ? "text-orange-400" : "text-orange-500"
  }[color];

  const IconComponent = IconProp;

  const content =
    typeof value === "string" ? (
      <span className="block break-words hyphens-auto">{value}</span>
    ) : (
      value
    );

  return (
    <div
      className={`flex flex-col justify-between ${
        darkMode ? "bg-gray-800" : "bg-white"
      } p-5 rounded-xl shadow-sm border ${
        darkMode ? "border-gray-700" : "border-gray-200"
      } min-h-[130px]`}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={`text-sm font-medium ${
            darkMode ? "text-gray-400" : "text-gray-600"
          }`}
        >
          {label}
        </p>
        <IconComponent className={`w-5 h-5 flex-shrink-0 ${colorClass}`} />
      </div>
      <div
        className={`text-sm font-semibold ${
          darkMode ? "text-white" : "text-gray-900"
        } leading-snug`}
      >
        {content}
      </div>
    </div>
  );
};

const MetadataStat = ({ label, value, darkMode }) => (
  <div
    className={`${
      darkMode ? "bg-gray-900/40 border-gray-700 text-gray-100" : "bg-gray-50 border-gray-200 text-gray-700"
    } border rounded-lg p-4`}
  >
    <p className="text-xs uppercase tracking-wide opacity-75">{label}</p>
    <p className="text-xl font-semibold">{value ?? "—"}</p>
  </div>
);

export default GradeAssignmentScreen;
