import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";

import Student from "../models/Student.js";
import Assignment from "../models/Assignment.js";
import Essay from "../models/Essay.js";
import User from "../models/User.js";

dotenv.config();

const sampleUser = {
  email: "admin@example.com",
  password: "password123",
};

const sampleStudents = [
  { name: "Aisha Khan", email: "aisha.khan@example.com", roll: "ENG-101" },
  { name: "Bilal Ahmed", email: "bilal.ahmed@example.com", roll: "ENG-102" },
  { name: "Sara Iqbal", email: "sara.iqbal@example.com", roll: "ENG-103" },
];

const sampleAssignments = [
  {
    title: "Renewable Energy Essay",
    description: "Discuss the role of renewable energy in shaping smart cities.",
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    totalMarks: 100,
    instructions: "1,000 words minimum. Cite at least two real-world projects.",
    attachmentName: "renewable-energy-guidelines.pdf",
  },
  {
    title: "AI in Education",
    description: "Explain how artificial intelligence can improve student outcomes.",
    dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    totalMarks: 100,
    instructions: "Focus on accessibility and personalized learning paths.",
    attachmentName: "ai-education-outline.docx",
  },
];

const sampleEssays = [
  {
    studentRoll: "ENG-101",
    title: "Smart Cities and Solar Grids",
    content:
      "Solar grids allow modern cities to decentralize their energy needs. By analyzing demand curves, planners can store peak energy...",
    grade: 92,
    feedback: "Excellent coverage of both policy and technical impact.",
    assignmentTitle: "Renewable Energy Essay",
  },
  {
    studentRoll: "ENG-102",
    title: "Wind Power for Coastal Towns",
    content:
      "Coastal regions can harness predictable wind patterns to stabilize grids. Community-owned turbines also improve local participation...",
    grade: 84,
    feedback: "Great examples; consider adding maintenance challenges.",
    assignmentTitle: "Renewable Energy Essay",
  },
  {
    studentRoll: "ENG-103",
    title: "AI Tutors in Classrooms",
    content:
      "AI tutors provide real-time insights on comprehension gaps. By flagging students who linger on specific topics, teachers can intervene faster...",
    grade: 88,
    feedback: "Strong argument. Include ethical considerations next time.",
    assignmentTitle: "AI in Education",
  },
];

const withLog = (message, meta) => {
  if (meta) {
    console.log(`${message}:`, meta);
  } else {
    console.log(message);
  }
};

const seed = async () => {
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI is not set. Please configure .env before seeding.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  withLog("✅ Connected to MongoDB");

  try {
    const existingUser = await User.findOne({ email: sampleUser.email });
    if (!existingUser) {
      const hashedPassword = await bcrypt.hash(sampleUser.password, 10);
      await User.create({ email: sampleUser.email, password: hashedPassword });
      withLog("👤 Created sample admin user", { email: sampleUser.email, password: sampleUser.password });
    } else {
      withLog("ℹ️ Sample admin user already exists", { email: sampleUser.email });
    }

    const studentDocs = {};
    for (const student of sampleStudents) {
      const doc = await Student.findOneAndUpdate(
        { roll: student.roll },
        student,
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      studentDocs[student.roll] = doc;
    }
    withLog("🎓 Seeded students", { count: Object.keys(studentDocs).length });

    const assignmentDocs = {};
    for (const assignment of sampleAssignments) {
      const doc = await Assignment.findOneAndUpdate(
        { title: assignment.title },
        assignment,
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      assignmentDocs[assignment.title] = doc;
    }
    withLog("📘 Seeded assignments", { count: Object.keys(assignmentDocs).length });

    let essaysCreated = 0;
    for (const essay of sampleEssays) {
      const studentDoc = studentDocs[essay.studentRoll];
      const assignmentDoc = assignmentDocs[essay.assignmentTitle];

      if (!studentDoc || !assignmentDoc) continue;

      const existingEssay = await Essay.findOne({
        student: studentDoc._id,
        assignment: assignmentDoc._id,
        title: essay.title,
      });

      if (existingEssay) {
        continue;
      }

      await Essay.create({
        student: studentDoc._id,
        studentName: studentDoc.name,
        studentEmail: studentDoc.email,
        studentRoll: studentDoc.roll,
        title: essay.title,
        content: essay.content,
        assignment: assignmentDoc._id,
        grade: essay.grade,
        feedback: essay.feedback,
      });
      essaysCreated += 1;
    }
    withLog("✏️ Seeded essays", { count: essaysCreated });

    withLog("✅ Seeding complete. You can now log in with the sample admin account.");
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seed();

