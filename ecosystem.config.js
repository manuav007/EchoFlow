module.exports = {
  apps: [
    {
      name: "frontend",
      script: "frontend-server.js",
      cwd: "/app",
      watch: false
    },
    {
      name: "backend",
      script: "nodeServer/index.js",
      cwd: "/app",
      watch: false
    }
  ]
};