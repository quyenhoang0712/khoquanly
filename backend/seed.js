const Role = require("./models/Role");
const User = require("./models/User");

const seedDefaults = async () => {
  await Role.updateOne(
    { name: "admin" },
    { $setOnInsert: { name: "admin", description: "System administrator" } },
    { upsert: true }
  );
  await Role.updateOne(
    { name: "user" },
    { $setOnInsert: { name: "user", description: "Employee" } },
    { upsert: true }
  );

  const adminEmail = process.env.ADMIN_EMAIL || "admin@warehouse.com";

  await User.updateOne(
    { email: adminEmail },
    {
      $set: {
        name: "Admin",
        email: adminEmail,
        password: process.env.ADMIN_PASSWORD || "admin123",
        role: "admin",
        hourlyRate: 30000,
        active: true,
      },
    },
    { upsert: true }
  );
};

module.exports = seedDefaults;
