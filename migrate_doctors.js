const mongoose = require("mongoose");
const Doctor = require("./models/Doctor");
const connectDB = require("./config/db");
const bcrypt = require("bcryptjs");

async function migrate() {
    await connectDB();
    try {
        const doctors = await Doctor.find({});
        for (let doc of doctors) {
            if (!doc.password) {
                // By updating via Mongoose save(), the pre-save hook will hash it.
                // But wait, the schema requires it now, so save() works perfectly.
                doc.password = "1234567890";
                await doc.save();
                console.log(`Updated password for ${doc.name}`);
            }
        }
        console.log("Migration complete.");
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

migrate();
