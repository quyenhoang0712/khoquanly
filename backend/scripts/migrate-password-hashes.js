require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/User");
const { hashPassword, isHashedPassword } = require("../utils/password");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/warehouse-management";

const run = async () => {
  await mongoose.connect(MONGO_URI);

  const users = await User.find({}).select("_id email password");
  let migrated = 0;

  for (const user of users) {
    if (isHashedPassword(user.password)) continue;
    user.password = hashPassword(user.password);
    await user.save();
    migrated += 1;
  }

  console.log(`Password hash migration complete. Migrated ${migrated}/${users.length} users.`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
});
