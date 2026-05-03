const express = require("express");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const session = require("express-session");
const { default: MongoStore } = require("connect-mongo");
const bcrypt = require("bcryptjs");

// — Config
const connectDB = require("./config/db");

// — Models
const Patient = require("./models/Patient");
const Doctor = require("./models/Doctor");
const Appointment = require("./models/Appointment");

// — Connect to MongoDB
connectDB();

// — App Setup
const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// — Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// — Session middleware (stored in MongoDB)
app.use(
    session({
        secret: "hospital_secret_key_change_in_production",
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hospital_db",
            collectionName: "sessions",
        }),
        cookie: {
            maxAge: 1000 * 60 * 60 * 24, // 1 day
            httpOnly: true,
        },
    })
);

// ─────────────────────────────────────────────
//  AUTH MIDDLEWARE
// ─────────────────────────────────────────────

function requirePatientLogin(req, res, next) {
    if (!req.session.patientId) {
        return res.redirect("/patient-login");
    }
    next();
}

function requireDoctorLogin(req, res, next) {
    if (!req.session.doctorId) {
        return res.redirect("/doctor-login");
    }
    next();
}

// ─────────────────────────────────────────────
//  ROUTES
// ─────────────────────────────────────────────

app.get("/", (req, res) => {
    res.render("home");
});

// ─────────────────────────────────────────────
//  DOCTORS
// ─────────────────────────────────────────────

app.get("/doctors", async (req, res) => {
    try {
        const doctors = await Doctor.find({});
        res.render("doctors", { doctors });
    } catch (err) {
        console.error("❌ Error fetching doctors:", err.message);
        res.status(500).send("Failed to fetch doctors. Please try again later.");
    }
});

// ─────────────────────────────────────────────
//  PATIENT REGISTRATION
// ─────────────────────────────────────────────

app.get("/register", (req, res) => {
    res.render("patient", { message: null, error: null, patientUID: null });
});

app.post("/register", async (req, res) => {
    try {
        const { name, contact, age, health_conditions, password } = req.body;

        if (!name || !contact || !age || !password) {
            return res.status(400).render("patient", {
                message: null,
                error: "Name, contact, age, and password are required fields.",
                patientUID: null,
            });
        }

        const existing = await Patient.findOne({ contact });
        if (existing) {
            return res.status(400).render("patient", {
                message: null,
                error: "Mobile number is already registered.",
                patientUID: null,
            });
        }

        const patient = new Patient({
            name,
            contact,
            age,
            health_conditions: health_conditions || "None",
            password
        });

        await patient.save();

        return res.render("patient", {
            message: `Registration successful! Your Patient ID is ${patient.patientUID}`,
            error: null,
            patientUID: patient.patientUID,
        });
    } catch (err) {
        console.error("❌ Patient registration error:", err.message);
        return res.status(400).render("patient", {
            message: null,
            error: "Registration failed. Please try again.",
            patientUID: null,
        });
    }
});

// ─────────────────────────────────────────────
//  PATIENT LOGIN / LOGOUT
// ─────────────────────────────────────────────

app.get("/patient-login", (req, res) => {
    if (req.session.patientId) {
        return res.redirect("/patient-dashboard");
    }
    res.render("patient-login", {
        error: null,
        success: null,
        prefillUID: req.query.uid || "",
    });
});

app.post("/patient-login", async (req, res) => {
    try {
        const { patientUID, password } = req.body;

        if (!patientUID || !password) {
            return res.render("patient-login", {
                error: "Patient ID (or mobile number) and password are required.",
                success: null,
                prefillUID: patientUID || "",
            });
        }

        const identifier = patientUID.trim();
        const patient = await Patient.findOne({
            $or: [
                { patientUID: identifier.toUpperCase() },
                { contact: identifier }
            ]
        });

        if (!patient) {
            return res.render("patient-login", {
                error: "No patient found with that ID or mobile number.",
                success: null,
                prefillUID: patientUID,
            });
        }

        const isMatch = await patient.comparePassword(password);
        if (!isMatch) {
            return res.render("patient-login", {
                error: "Incorrect password. Please try again.",
                success: null,
                prefillUID: patientUID,
            });
        }

        req.session.patientId = patient._id.toString();
        req.session.patientUID = patient.patientUID;

        return res.redirect("/patient-dashboard");
    } catch (err) {
        console.error("❌ Login error:", err.message);
        return res.render("patient-login", {
            error: "Login failed. Please try again.",
            success: null,
            prefillUID: "",
        });
    }
});

app.post("/patient-logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
});

// ─────────────────────────────────────────────
//  DOCTOR LOGIN / LOGOUT
// ─────────────────────────────────────────────

app.get("/doctor-login", async (req, res) => {
    if (req.session.doctorId) {
        return res.redirect("/doctor-dashboard");
    }
    try {
        const doctors = await Doctor.find({});
        res.render("doctor-login", { error: null, message: null, doctors });
    } catch (err) {
        res.status(500).send("Server Error");
    }
});

app.post("/doctor-login", async (req, res) => {
    try {
        const { doctor_id, password } = req.body;
        const doctors = await Doctor.find({});

        if (!doctor_id || !password) {
            return res.render("doctor-login", { error: "Both fields are required.", message: null, doctors });
        }

        const doctor = await Doctor.findById(doctor_id);
        if (!doctor) {
            return res.render("doctor-login", { error: "Doctor not found.", message: null, doctors });
        }

        const isMatch = await doctor.comparePassword(password);
        if (!isMatch) {
            return res.render("doctor-login", { error: "Incorrect password.", message: null, doctors });
        }

        req.session.doctorId = doctor._id.toString();
        res.redirect("/doctor-dashboard");
    } catch (err) {
        console.error(err);
        res.status(500).send("Login failed.");
    }
});

app.post("/doctor-logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
});

// ─────────────────────────────────────────────
//  DOCTOR DASHBOARD
// ─────────────────────────────────────────────

app.get("/doctor-dashboard", requireDoctorLogin, async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.session.doctorId);
        if (!doctor) {
            req.session.destroy();
            return res.redirect("/doctor-login");
        }

        const appointments = await Appointment.find({ doctor_id: req.session.doctorId })
            .populate("patient_id", "name patientUID contact")
            .sort({ appointment_date: 1 });

        const flash_success = req.session.flash_success || null;
        const flash_error = req.session.flash_error || null;
        delete req.session.flash_success;
        delete req.session.flash_error;

        res.render("doctor-dashboard", { doctor, appointments, flash_success, flash_error });
    } catch (err) {
        console.error(err);
        res.status(500).send("Dashboard Error");
    }
});

app.post("/appointments/doctor-update/:id", requireDoctorLogin, async (req, res) => {
    try {
        const { id } = req.params;
        const { action, appointment_date, appointment_time } = req.body;

        const appointment = await Appointment.findById(id);
        if (!appointment) {
            req.session.flash_error = "Appointment not found.";
            return res.redirect("/doctor-dashboard");
        }

        if (appointment.doctor_id.toString() !== req.session.doctorId) {
            req.session.flash_error = "Unauthorized action.";
            return res.redirect("/doctor-dashboard");
        }

        if (action === "approve") {
            appointment.status = "Confirmed";
            await appointment.save();
            req.session.flash_success = "Appointment Confirmed successfully.";
        } else if (action === "change_time") {
            if (!appointment_date || !appointment_time) {
                req.session.flash_error = "Date and time are required to reschedule.";
                return res.redirect("/doctor-dashboard");
            }
            appointment.appointment_date = new Date(appointment_date);
            appointment.appointment_time = appointment_time;
            appointment.status = "Confirmed";
            await appointment.save();
            req.session.flash_success = "Appointment rescheduled and confirmed.";
        } else if (action === "reject") {
            appointment.status = "Cancelled";
            await appointment.save();
            req.session.flash_success = "Appointment Rejected.";
        }

        res.redirect("/doctor-dashboard");
    } catch (err) {
        console.error(err);
        req.session.flash_error = "Failed to update appointment.";
        res.redirect("/doctor-dashboard");
    }
});

// ─────────────────────────────────────────────
//  PATIENT DASHBOARD
// ─────────────────────────────────────────────

app.get("/patient-dashboard", requirePatientLogin, async (req, res) => {
    try {
        const patient = await Patient.findById(req.session.patientId);
        if (!patient) {
            req.session.destroy();
            return res.redirect("/patient-login");
        }

        const appointments = await Appointment.find({ patient_id: patient._id })
            .populate("doctor_id", "name specialization")
            .sort({ appointment_date: 1 });

        const flash_success = req.session.flash_success || null;
        const flash_error = req.session.flash_error || null;
        delete req.session.flash_success;
        delete req.session.flash_error;

        res.render("patient-dashboard", { patient, appointments, flash_success, flash_error });
    } catch (err) {
        console.error("❌ Dashboard error:", err.message);
        res.status(500).send("Failed to load dashboard. Please try again.");
    }
});

// ─────────────────────────────────────────────
//  APPOINTMENTS (CREATE)
// ─────────────────────────────────────────────

app.get("/appointments", async (req, res) => {
    try {
        const doctors = await Doctor.find({});
        res.render("index", {
            message: null,
            error: null,
            prefillPatientUID: req.session.patientUID || null,
            isLoggedIn: !!req.session.patientId,
            doctors,
        });
    } catch (err) {
        console.error("❌ Error loading appointments page:", err.message);
        res.status(500).send("Failed to load page.");
    }
});

app.post("/appointments", async (req, res) => {
    try {
        const { patient_id, password, doctor_id, appointment_date, appointment_time, problem_description } = req.body;
        const doctors = await Doctor.find({});
        const isLoggedIn = !!req.session.patientId;

        if (!patient_id || !doctor_id || !appointment_date || !appointment_time || (!isLoggedIn && !password)) {
            return res.status(400).render("index", {
                message: null,
                error: "All fields are required to book an appointment.",
                prefillPatientUID: req.session.patientUID || patient_id || null,
                isLoggedIn, doctors,
            });
        }

        const identifier = patient_id.trim();
        const patient = await Patient.findOne({
            $or: [
                { patientUID: identifier.toUpperCase() },
                { contact: identifier }
            ]
        });

        if (!patient) {
            return res.status(404).render("index", {
                message: null,
                error: `No patient found with ID or Mobile Number: ${patient_id}`,
                prefillPatientUID: req.session.patientUID || patient_id || null,
                isLoggedIn, doctors,
            });
        }

        if (isLoggedIn) {
            if (patient._id.toString() !== req.session.patientId) {
                return res.status(403).render("index", {
                    message: null,
                    error: "You can only book appointments for yourself. Please check your Patient ID.",
                    prefillPatientUID: req.session.patientUID || null,
                    isLoggedIn, doctors,
                });
            }
        } else {
            const isMatch = await patient.comparePassword(password);
            if (!isMatch) {
                return res.status(401).render("index", {
                    message: null,
                    error: "Incorrect password. Please try again.",
                    prefillPatientUID: patient_id,
                    isLoggedIn, doctors,
                });
            }
        }

        const doctor = await Doctor.findById(doctor_id);
        if (!doctor) {
            return res.status(404).render("index", {
                message: null,
                error: "Selected doctor not found. Please try again.",
                prefillPatientUID: req.session.patientUID || patient_id || null,
                isLoggedIn, doctors,
            });
        }

        const appointment = new Appointment({
            patient_id: patient._id,
            doctor_id: doctor._id,
            appointment_date: new Date(appointment_date),
            appointment_time,
            problem_description: problem_description || "None provided",
        });

        await appointment.save();

        if (req.session.patientId) {
            req.session.flash_success = "Appointment booked successfully!";
            return res.redirect("/patient-dashboard");
        }

        return res.render("index", {
            message: "✅ Appointment booked successfully!",
            error: null,
            prefillPatientUID: req.session.patientUID || null,
            isLoggedIn, doctors,
        });
    } catch (err) {
        console.error("❌ Appointment booking error:", err.message);
        const doctors = await Doctor.find({});
        return res.status(500).render("index", {
            message: null,
            error: "Appointment booking failed. Please try again.",
            prefillPatientUID: req.session.patientUID || null,
            isLoggedIn: !!req.session.patientId,
            doctors,
        });
    }
});

// ─────────────────────────────────────────────
//  EDIT APPOINTMENT
// ─────────────────────────────────────────────

app.get("/appointments/edit/:id", requirePatientLogin, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id).populate("doctor_id", "name specialization");
        if (!appointment) {
            req.session.flash_error = "Appointment not found.";
            return res.redirect("/patient-dashboard");
        }
        if (appointment.patient_id.toString() !== req.session.patientId) {
            req.session.flash_error = "Access denied.";
            return res.redirect("/patient-dashboard");
        }
        if (appointment.status !== "Pending") {
            req.session.flash_error = "Only Pending appointments can be edited.";
            return res.redirect("/patient-dashboard");
        }

        res.render("edit-appointment", { appointment, error: null });
    } catch (err) {
        res.redirect("/patient-dashboard");
    }
});

app.post("/appointments/edit/:id", requirePatientLogin, async (req, res) => {
    try {
        const { appointment_date, appointment_time } = req.body;
        const appointment = await Appointment.findById(req.params.id);

        if (!appointment) {
            req.session.flash_error = "Appointment not found.";
            return res.redirect("/patient-dashboard");
        }
        if (appointment.patient_id.toString() !== req.session.patientId) {
            req.session.flash_error = "Access denied.";
            return res.redirect("/patient-dashboard");
        }
        if (appointment.status !== "Pending") {
            req.session.flash_error = "Only Pending appointments can be edited.";
            return res.redirect("/patient-dashboard");
        }

        if (!appointment_date || !appointment_time) {
            req.session.flash_error = "Date and time are required.";
            return res.redirect(`/appointments/edit/${req.params.id}`);
        }

        appointment.appointment_date = new Date(appointment_date);
        appointment.appointment_time = appointment_time;
        await appointment.save();

        req.session.flash_success = "Appointment updated successfully!";
        res.redirect("/patient-dashboard");
    } catch (err) {
        req.session.flash_error = "Failed to update appointment. Please try again.";
        res.redirect("/patient-dashboard");
    }
});

// ─────────────────────────────────────────────
//  DELETE APPOINTMENT
// ─────────────────────────────────────────────

app.post("/appointments/delete/:id", requirePatientLogin, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) {
            req.session.flash_error = "Appointment not found.";
            return res.redirect("/patient-dashboard");
        }
        if (appointment.patient_id.toString() !== req.session.patientId) {
            req.session.flash_error = "Access denied.";
            return res.redirect("/patient-dashboard");
        }

        await Appointment.findByIdAndDelete(req.params.id);
        req.session.flash_success = "Appointment deleted successfully.";
        res.redirect("/patient-dashboard");
    } catch (err) {
        req.session.flash_error = "Failed to delete appointment.";
        res.redirect("/patient-dashboard");
    }
});

// ─────────────────────────────────────────────
//  GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────

app.use((req, res) => {
    res.status(404).render("home");
});

app.use((err, req, res, next) => {
    console.error("🔥 Unhandled Error:", err.stack);
    res.status(500).send("Something went wrong. Please try again later.");
});

// ─────────────────────────────────────────────
//  START SERVER
// ─────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});