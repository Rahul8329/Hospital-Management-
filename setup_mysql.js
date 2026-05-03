const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function setup() {
    console.log("Starting MySQL Database Setup...");

    try {
        // Connect without database to create it first
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
        });

        await connection.query(`CREATE DATABASE IF NOT EXISTS hospital_db;`);
        console.log("✅ Database 'hospital_db' checked/created.");
        
        await connection.changeUser({ database: 'hospital_db' });

        // Patients Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS patients (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                contact VARCHAR(20) NOT NULL UNIQUE,
                age INT NOT NULL,
                health_conditions VARCHAR(255),
                patientUID VARCHAR(20) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ Patients table created.");

        // Doctors Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS doctors (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                specialization VARCHAR(100) NOT NULL,
                available_times VARCHAR(200) NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ Doctors table created.");

        // Appointments Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS appointments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                patient_id INT NOT NULL,
                doctor_id INT NOT NULL,
                appointment_date DATE NOT NULL,
                appointment_time VARCHAR(10) NOT NULL,
                problem_description TEXT,
                status ENUM('Pending', 'Confirmed', 'Cancelled', 'Completed') DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
                FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
            );
        `);
        console.log("✅ Appointments table created.");

        // Check if doctors are already seeded
        const [rows] = await connection.query(`SELECT COUNT(*) as count FROM doctors`);
        if (rows[0].count === 0) {
            console.log("Seeding 10 Indian Doctors...");
            const defaultPassword = await bcrypt.hash('1234567890', 12);
            
            const doctorsData = [
                ["Rajesh Kumar", "Cardiologist", "10:00 AM - 02:00 PM", defaultPassword],
                ["Priya Sharma", "Dermatologist", "09:00 AM - 01:00 PM", defaultPassword],
                ["Amit Patel", "Neurologist", "11:00 AM - 03:00 PM", defaultPassword],
                ["Sneha Reddy", "Pediatrician", "08:00 AM - 12:00 PM", defaultPassword],
                ["Vikram Singh", "Orthopedic Surgeon", "02:00 PM - 06:00 PM", defaultPassword],
                ["Anjali Desai", "Gynecologist", "10:30 AM - 02:30 PM", defaultPassword],
                ["Ravi Menon", "Ophthalmologist", "09:30 AM - 01:30 PM", defaultPassword],
                ["Kavita Iyer", "Psychiatrist", "03:00 PM - 07:00 PM", defaultPassword],
                ["Suresh Gupta", "General Physician", "08:00 AM - 04:00 PM", defaultPassword],
                ["Neha Joshi", "ENT Specialist", "12:00 PM - 04:00 PM", defaultPassword]
            ];

            const sql = "INSERT INTO doctors (name, specialization, available_times, password) VALUES ?";
            await connection.query(sql, [doctorsData]);
            console.log("✅ Doctors seeded successfully.");
        } else {
            console.log("✅ Doctors already seeded.");
        }

        await connection.end();
        console.log("Setup complete. You can now use MySQL Workbench to view the 'hospital_db' database!");
        process.exit();
    } catch (err) {
        console.error("❌ Setup failed:", err);
        process.exit(1);
    }
}

setup();
