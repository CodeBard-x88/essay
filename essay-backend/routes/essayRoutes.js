import express from "express";
import Essay from "../models/Essay.js";
import Student from "../models/Student.js";
import Assignment from "../models/Assignment.js";
import auth from "../middleware/auth.js";
import logger from "../utils/logger.js";

const router = express.Router();
const log = logger.child("EssayRoutes");

// Create or update an essay submission
router.post("/", auth, async (req, res) => {
  try {
    const {
      studentName,
      studentEmail,
      studentRoll,
      title,
      content,
      grade,
      feedback,
      evaluation,
      assignmentId,
    } = req.body;

    if (!studentName || !studentEmail || !studentRoll || !title || !content) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let student = await Student.findOne({ roll: studentRoll });
    if (!student) {
      student = await Student.create({ name: studentName, email: studentEmail, roll: studentRoll });
      log.info("Student auto-created for essay", { studentId: student._id, roll: studentRoll });
    } else if (student.name !== studentName || student.email !== studentEmail) {
      student.name = studentName;
      student.email = studentEmail;
      await student.save();
      log.debug("Student metadata updated from essay submission", { studentId: student._id });
    }

    let assignment = null;
    if (assignmentId) {
      assignment = await Assignment.findById(assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
    }

    const essay = await Essay.create({
      student: student._id,
      studentName,
      studentEmail,
      studentRoll,
      title,
      content,
      assignment: assignment ? assignment._id : undefined,
      grade: typeof grade === "number" ? grade : null,
      feedback: feedback ?? "",
      evaluation: evaluation ?? null,
    });

    log.info("Essay saved", { essayId: essay._id, studentRoll });
    res.status(201).json({ message: "Essay saved", essay });
  } catch (err) {
    log.error("Essay save failed", { error: err.message });
    res.status(500).json({ message: "Server error" });
  }
});

// Get all essays (most recent first)
router.get("/", auth, async (_req, res) => {
  try {
    const essays = await Essay.find().sort({ createdAt: -1 }).populate("assignment");
    log.debug("Fetched essays", { count: essays.length });
    res.json(essays);
  } catch (err) {
    log.error("Essay list failed", { error: err.message });
    res.status(500).json({ message: "Server error" });
  }
});

// Get essays by student roll
router.get("/student/:roll", auth, async (req, res) => {
  try {
    const essays = await Essay.find({ studentRoll: req.params.roll }).sort({ createdAt: -1 }).populate("assignment");
    log.debug("Fetched essays for student", { roll: req.params.roll, count: essays.length });
    res.json(essays);
  } catch (err) {
    log.error("Essay fetch by student failed", { error: err.message, roll: req.params.roll });
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
