import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    dueDate: { type: Date, required: true },
    totalMarks: { type: Number, required: true },
    instructions: { type: String, default: "" },
    attachmentName: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Assignment", assignmentSchema);

