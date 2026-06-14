require("dotenv").config();
const app = require("./app");
const prisma = require("./config/prisma");

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`🚀 Splitwise Clone Backend Running on Port ${PORT}`);
  console.log(`🌱 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`=============================================`);
});

// Graceful shutdown logic
const gracefulShutdown = async (signal) => {
  console.log(`\n📬 Received ${signal}. Initiating graceful shutdown...`);
  
  server.close(async () => {
    console.log("🛡️  HTTP server closed.");
    try {
      await prisma.$disconnect();
      console.log("🔌 Database connections disconnected cleanly.");
      process.exit(0);
    } catch (error) {
      console.error("❌ Error while disconnecting database client:", error);
      process.exit(1);
    }
  });

  // Timeout backup to avoid hanging process
  setTimeout(() => {
    console.error("⚠️ Graceful shutdown timed out. Forcing termination...");
    process.exit(1);
  }, 10000);
};

// Listen for termination signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
