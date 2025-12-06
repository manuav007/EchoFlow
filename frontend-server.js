const express = require("express");
const path = require("path");
const app = express();

app.use(express.static(path.join(__dirname)));  // serve HTML, CSS, JS

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// IMPORTANT: Allow external access on EC2
app.listen(3000, "0.0.0.0", () => {
  console.log("Frontend running on http://0.0.0.0:3000");
});
