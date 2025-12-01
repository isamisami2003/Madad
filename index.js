const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const connectDB = require("./config/db.js");
const setupSocket = require("./socket.js");
const routes = require("./routes");
const socketAuth = require("./middlewares/socketAuth");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

connectDB();

io.use(socketAuth);

setupSocket(io);

app.use("/api", routes);
app.use('/uploads', express.static('uploads'));
app.use('/patientFiles', express.static('patientFiles'));
app.use('/doctorFiles', express.static('doctorFiles'));
app.use('/image', express.static('image'));


app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({ message: "Internal Server Error" });
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});