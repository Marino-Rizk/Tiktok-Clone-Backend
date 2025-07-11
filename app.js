const express = require('express');
const app = express();
const path = require("path");
require("dotenv").config();
const port = process.env.PORT || 3000;
const fileUpload = require("express-fileupload");

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

// Import routes
const mainRoutes = require('./routes/mainRoutes');
app.use('/', mainRoutes);
const errorRoutes = require("./routes/errorRoutes");

app.use("/", dashboardRouter);
app.use("/api/v1/auth", authRouter);

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
}); 