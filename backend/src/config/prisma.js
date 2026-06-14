const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

// Create standard connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma 7 adapter
const adapter = new PrismaPg(pool);

// Initialize Prisma client with adapter
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
