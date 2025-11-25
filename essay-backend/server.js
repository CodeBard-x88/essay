import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";

// Route imports
import userRoutes from "./routes/userRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import essayRoutes from "./routes/essayRoutes.js";
import assignmentRoutes from "./routes/assignmentRoutes.js";
import logger from "./utils/logger.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors()); // just this, nothing fancy
app.use(express.json());
app.use(
  morgan(":method :url :status :res[content-length] - :response-time ms", {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
    skip: () => process.env.NODE_ENV === "test",
  })
);

app.use(express.json());
app.use(
  morgan(":method :url :status :res[content-length] - :response-time ms", {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
    skip: () => process.env.NODE_ENV === "test",
  })
);


// Routes
app.use("/api/users", userRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/essays", essayRoutes);
app.use("/api/assignments", assignmentRoutes);

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Backend is running..." });
});

// Gracefully handle unexpected async errors
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason });
});

const PORT = process.env.PORT || 5000;
const REQUIRED_ENV_VARS = ["MONGO_URI", "JWT_SECRET"];

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    logger.error("Missing required environment variable", { key });
    process.exit(1);
  }
}

const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info("MongoDB Connected");

    app.listen(PORT, () => {
      logger.info("Server started", { port: PORT });
    });
  } catch (err) {
    logger.error("DB Connection Error", { error: err.message });
    process.exit(1);
  }
};

startServer();
