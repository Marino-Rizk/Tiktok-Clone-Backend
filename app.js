const express = require('express');
const app = express();
const path = require("path");
require("dotenv").config();
const port = process.env.PORT || 3000;
const RECOMMENDATION_API_URL = process.env.RECOMMENDATION_API_URL || "http://localhost:5000";
const fileUpload = require("express-fileupload");
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
  })
);

// Middleware and routes setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Define the path to the uploads directory
const uploadsDirectory = path.join(__dirname, "uploads");

// Serve the uploads directory as static files
app.use("/uploads", express.static(uploadsDirectory));

// Make RECOMMENDATION_API_URL available globally if needed
app.locals.RECOMMENDATION_API_URL = RECOMMENDATION_API_URL;

const dashboardRouter = require("./routes/dashboardRouter");
const authRouter = require("./routes/api/v1/authRoutes");
const userRouter = require("./routes/api/v1/userRoutes");
const VideoRouter = require('./routes/api/v1/videoRoutes');

app.use("/", dashboardRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/videos",VideoRouter);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

// .env requirements for backend:
// MONGODB_URI=mongodb://localhost:27017/yourdbname
// PORT=3000
// RECOMMENDATION_API_URL=http://localhost:5000 