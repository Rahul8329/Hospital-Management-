const mongoose = require("mongoose");
const Doctor = require("./models/Doctor");
const connectDB = require("./config/db");

const doctorsData = [
    { name: "Rajesh Kumar", specialization: "Cardiologist", available_times: "10:00 AM - 02:00 PM", password: "1234567890" },
    { name: "Priya Sharma", specialization: "Dermatologist", available_times: "09:00 AM - 01:00 PM", password: "1234567890" },
    { name: "Amit Patel", specialization: "Neurologist", available_times: "11:00 AM - 03:00 PM", password: "1234567890" },
    { name: "Sneha Reddy", specialization: "Pediatrician", available_times: "08:00 AM - 12:00 PM", password: "1234567890" },
    { name: "Vikram Singh", specialization: "Orthopedic Surgeon", available_times: "02:00 PM - 06:00 PM", password: "1234567890" },
    { name: "Anjali Desai", specialization: "Gynecologist", available_times: "10:30 AM - 02:30 PM", password: "1234567890" },
    { name: "Ravi Menon", specialization: "Ophthalmologist", available_times: "09:30 AM - 01:30 PM", password: "1234567890" },
    { name: "Kavita Iyer", specialization: "Psychiatrist", available_times: "03:00 PM - 07:00 PM", password: "1234567890" },
    { name: "Suresh Gupta", specialization: "General Physician", available_times: "08:00 AM - 04:00 PM", password: "1234567890" },
    { name: "Neha Joshi", specialization: "ENT Specialist", available_times: "12:00 PM - 04:00 PM", password: "1234567890" }
];

async function seed() {
    await connectDB();
    try {
        await Doctor.deleteMany({});
        
        // Use Doctor.create in a loop to ensure the pre-save hook (hashing) triggers
        for (const data of doctorsData) {
            await Doctor.create(data);
        }
        
        console.log("✅ Doctors seeded successfully into MongoDB with hashed passwords!");
        process.exit();
    } catch (err) {
        console.error("❌ Seeding failed:", err.message);
        process.exit(1);
    }
}

seed();
