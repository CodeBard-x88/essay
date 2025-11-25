import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import logger from "../utils/logger.js";

const router = express.Router();
const log = logger.child("UserRoutes");

// Register
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    log.info("User registered", { userId: newUser._id, email });
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    log.error("Registration failed", { error: err.message });
    res.status(500).json({ message: "Server error" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    log.info("User logged in", { userId: user._id, email });
    res.json({ token });
  } catch (err) {
    log.error("Login failed", { error: err.message });
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
