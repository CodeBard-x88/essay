import express from "express";
import Assignment from "../models/Assignment.js";
import auth from "../middleware/auth.js";
import logger from "../utils/logger.js";

const router = express.Router();
const log = logger.child("AssignmentRoutes");

// Create assignment
router.post("/", auth, async (req, res) => {
  try {
    const { title, description, dueDate, totalMarks, instructions, attachmentName } = req.body;

    if (!title || !dueDate || !totalMarks) {
      return res.status(400).json({ message: "Title, due date, and total marks are required" });
    }

    const assignment = await Assignment.create({
      title,
      description,
      dueDate,
      totalMarks,
      instructions,
      attachmentName,
    });

    log.info("Assignment created", { assignmentId: assignment._id, title });
    res.status(201).json(assignment);
  } catch (err) {
    log.error("Assignment create error", { error: err.message });
    res.status(500).json({ message: "Server error" });
  }
});

// List assignments
router.get("/", auth, async (_req, res) => {
  try {
    const assignments = await Assignment.find().sort({ createdAt: -1 });
    log.debug("Fetched assignments", { count: assignments.length });
    res.json(assignments);
  } catch (err) {
    log.error("Assignment list error", { error: err.message });
    res.status(500).json({ message: "Server error" });
  }
});

// Get single assignment
router.get("/:id", auth, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      log.warn("Assignment not found", { assignmentId: req.params.id });
      return res.status(404).json({ message: "Assignment not found" });
    }
    res.json(assignment);
  } catch (err) {
    log.error("Assignment fetch error", { error: err.message, assignmentId: req.params.id });
    res.status(500).json({ message: "Server error" });
  }
});

export default router;

