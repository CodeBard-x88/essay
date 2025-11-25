// models/Essay.js
import mongoose from "mongoose";

const essaySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    studentName: { type: String, required: true },
    studentEmail: { type: String, required: true },
    studentRoll: { type: String, required: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment" },
    grade: { type: Number, default: null },
    feedback: { type: String, default: "" },
    evaluation: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Essay", essaySchema);
