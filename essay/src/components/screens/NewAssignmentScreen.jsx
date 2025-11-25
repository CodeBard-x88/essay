import React, { useState } from "react";
import {
  Calendar,
  FileText,
  Award,
  Upload,
  Save,
  X,
  Sparkles,
  Edit3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";

const NewAssignmentScreen = ({ darkMode, authToken, onCreated }) => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dueDate: "",
    totalMarks: "",
    file: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "file" ? files[0] : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!authToken) {
      setError("You are not authenticated. Please sign in again.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await api.createAssignment(authToken, {
        title: formData.title,
        description: formData.description,
        dueDate: formData.dueDate,
        totalMarks: Number(formData.totalMarks),
        attachmentName: formData.file ? formData.file.name : "",
      });

      setSuccess("Assignment created successfully!");
      setFormData({
        title: "",
        description: "",
        dueDate: "",
        totalMarks: "",
        file: null,
      });
      onCreated?.();
      setTimeout(() => navigate("/assignments"), 600);
    } catch (err) {
      setError(err.message || "Unable to create assignment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`min-h-screen p-6 transition-colors duration-500 ${
        darkMode
          ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
          : "bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200"
      }`}
    >
      {/* Header */}
      <div className="flex items-center mb-8">
        <Sparkles className="w-7 h-7 text-blue-500 mr-2 animate-pulse" />
        <h1
          className={`text-3xl font-bold ${
            darkMode ? "text-white" : "text-gray-900"
          }`}
        >
          Create New Assignment
        </h1>
      </div>

      {/* Form Card */}
      <form
        onSubmit={handleSubmit}
        className={`space-y-6 max-w-2xl mx-auto p-6 rounded-2xl shadow-xl ${
          darkMode
            ? "bg-gray-800/90 border border-gray-700"
            : "bg-gray-50/90 border border-gray-300"
        }`}
      >
        {(error || success) && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              error
                ? "border border-red-200 bg-red-50 text-red-700"
                : "border border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {error || success}
          </div>
        )}

        {/* Title */}
        <div>
          <label
            className={`flex items-center gap-2 text-sm font-medium mb-2 ${
              darkMode ? "text-gray-300" : "text-gray-700"
            }`}
          >
            <Edit3 className="w-5 h-5 text-blue-500" /> Assignment Title{" "}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            placeholder="Enter assignment title"
            className={`w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none ${
              darkMode
                ? "bg-gray-700 text-white border border-gray-600 placeholder-gray-400"
                : "bg-gray-100 text-gray-900 border border-gray-300 placeholder-gray-500"
            }`}
          />
        </div>

        {/* Description */}
        <div>
          <label
            className={`flex items-center gap-2 text-sm font-medium mb-2 ${
              darkMode ? "text-gray-300" : "text-gray-700"
            }`}
          >
            <FileText className="w-5 h-5 text-green-500" /> Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            placeholder="Write instructions or details..."
            className={`w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none ${
              darkMode
                ? "bg-gray-700 text-white border border-gray-600 placeholder-gray-400"
                : "bg-gray-100 text-gray-900 border border-gray-300 placeholder-gray-500"
            }`}
          />
        </div>

        {/* Due Date */}
        <div>
          <label
            className={`flex items-center gap-2 text-sm font-medium mb-2 ${
              darkMode ? "text-gray-300" : "text-gray-700"
            }`}
          >
            <Calendar className="w-5 h-5 text-purple-500" /> Due Date{" "}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="dueDate"
            value={formData.dueDate}
            onChange={handleChange}
            required
            className={`w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none ${
              darkMode
                ? "bg-gray-700 text-white border border-gray-600"
                : "bg-gray-100 text-gray-900 border border-gray-300"
            }`}
          />
        </div>

        {/* Total Marks */}
        <div>
          <label
            className={`flex items-center gap-2 text-sm font-medium mb-2 ${
              darkMode ? "text-gray-300" : "text-gray-700"
            }`}
          >
            <Award className="w-5 h-5 text-yellow-500" /> Total Marks{" "}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="totalMarks"
            value={formData.totalMarks}
            onChange={handleChange}
            required
            placeholder="Enter total marks"
            min="1"
            className={`w-full rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 outline-none ${
              darkMode
                ? "bg-gray-700 text-white border border-gray-600 placeholder-gray-400"
                : "bg-gray-100 text-gray-900 border border-gray-300 placeholder-gray-500"
            }`}
          />
        </div>

        {/* File Upload */}
        <div>
          <label
            className={`flex items-center gap-2 text-sm font-medium mb-2 ${
              darkMode ? "text-gray-300" : "text-gray-700"
            }`}
          >
            <Upload className="w-5 h-5 text-pink-500" /> Attach File (Optional)
          </label>
          <input
            type="file"
            name="file"
            onChange={handleChange}
            className={`w-full cursor-pointer rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 outline-none ${
              darkMode
                ? "bg-gray-700 text-gray-300 border border-gray-600"
                : "bg-gray-100 text-gray-700 border border-gray-300"
            }`}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg transition-colors"
          >
            <Save className="w-5 h-5" /> {isSubmitting ? "Saving..." : "Save Assignment"}
          </button>
          <button
            type="button"
            onClick={() => window.history.back()}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg transition-colors ${
              darkMode
                ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                : "bg-gray-200 hover:bg-gray-300 text-gray-700"
            }`}
          >
            <X className="w-5 h-5" /> Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewAssignmentScreen;
