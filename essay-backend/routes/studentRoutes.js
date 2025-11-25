import express from "express";
import Student from "../models/Student.js";
import auth from "../middleware/auth.js";
import logger from "../utils/logger.js";

const router = express.Router();
const log = logger.child("StudentRoutes");

// Add student
router.post("/", auth, async (req, res) => {
  try {
    const { name, email, roll } = req.body;
    const existing = await Student.findOne({ $or: [{ email }, { roll }] });
    if (existing)
      return res.status(400).json({ message: "Student already exists" });

    const student = new Student({ name, email, roll });
    await student.save();
    log.info("Student added", { studentId: student._id, roll });
    res.status(201).json({ message: "Student added", student });
  } catch (err) {
    log.error("Failed to add student", { error: err.message });
    res.status(500).json({ message: "Server error" });
  }
});

// Get all students
router.get("/", auth, async (req, res) => {
  try {
    const students = await Student.find();
    log.debug("Fetched students", { count: students.length });
    res.json(students);
  } catch (err) {
    log.error("Failed to fetch students", { error: err.message });
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
