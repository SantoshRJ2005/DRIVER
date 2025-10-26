// --- IMPORTS ---
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { put } = require('@vercel/blob');
const router = express.Router();
const nodemailer = require('nodemailer');
const cors = require('cors');
const Drivers = require('../models/Driver');
const Agency = require('../models/Agency');
const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicles');
const OTP = require('../models/OTP');
const bodyParser = require('body-parser');
const fs = require("fs");
const rateLimit = require('express-rate-limit');
require("dotenv").config();


// --- NODEMAILER TRANSPORTER ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use STARTTLS
    auth: {
        user: process.env.USER,
        pass: process.env.PASS
    },
    tls: {
        rejectUnauthorized: false
    },
    debug: true,
    logger: true
});

// Verify email configuration on startup
transporter.verify(function (error, success) {
    if (error) {
        console.log('❌ Email transporter verification failed:', error);
    } else {
        console.log('✅ Email server is ready to send messages');
    }
});


// --- AUTHENTICATION MIDDLEWARE ---
function isAuthenticated(req, res, next) {
    if (req.session && req.session.DriversId) {
        return next();
    }
    return res.redirect('/'); // Redirect to login
}

// --- DRIVER ROUTES ---

// GET / (Login Page)
router.get('/', (req, res) => {
    res.render('login', { message: '' });
});

// POST /driver-login
router.post('/driver-login', async (req, res) => {
    // ... [NO CHANGES TO THIS ROUTE] ...
    const { email, password } = req.body;
    try {
        let user = await Drivers.findOne({ email: email });
        if (!user) {
            return res.render('login', { message: 'Invalid Credentials' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('login', { message: 'Invalid Credentials' });
        }
        req.session.DriversId = user._id;
        req.session.DriverName = user.fullName || 'NA';
        req.session.DriverEmail = user.email;
        res.redirect('/driver-dashboard');
    } catch (err) {
        console.error(err);
        res.render('login', { message: 'Server Error', err: err });
    }
});

// GET /driver-dashboard
router.get('/driver-dashboard', isAuthenticated, async (req, res) => {
    // ... [NO CHANGES TO THIS ROUTE] ...
    try {
        let driver = await Drivers.findById(req.session.DriversId).populate('agencyId');
        if (!driver) {
            return res.redirect('/');
        }
        res.render('driver-dashboard', { drivers: driver });
    } catch (err) {
        console.error("Error fetching driver for dashboard", err);
        res.status(500).send("Error Loading your Dashboard");
    }
});

// GET /driver-rides
router.get('/driver-rides', isAuthenticated, async (req, res) => {
    // ... [NO CHANGES TO THIS ROUTE] ...
    try {
        console.log('Logged-in Driver ID:', req.session.DriversId);
        const driverObjectId = new mongoose.Types.ObjectId(req.session.DriversId);
        let allRides = await Booking.find({ driverID: driverObjectId })
            .populate('agencyId', 'agencyName')
            .populate('vehicleId','vehicle_name')
            .sort({ createdAt: -1 });
        console.log('Rides found in database:', allRides.length); 
        res.render('driver-rides', { rides: allRides });
    } catch (err) {
        console.error("Error fetching driver for rides", err);
        res.status(500).send("Error Loading your rides");
    }
});


// --- OTP ROUTES ---

// Rate limiting for OTP
const otpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { success: false, message: 'Too many OTP requests. Please try again after an hour.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// POST /start-ride (Send OTP)
// This route is now correct. It's called by 'fetch' and returns JSON.
router.post('/start-ride', otpLimiter, async (req, res) => {
    console.log(`start ride route`);
    try {
        const { email, name } = req.body;

        // Validation (from our last fix)
        if (!email || !name) {
            console.error('Bad Request: Email or name not provided in /start-ride');
            return res.status(400).json({ 
                success: false, 
                message: 'Customer email and name are required to send an OTP.' 
            });
        }
        
        await OTP.deleteMany({ email }); // Clear old OTPs
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await OTP.create({ email, otp });

        console.log(`📩 OTP for ${email}: ${otp} (valid 3 min)`);

        // Send professional HTML email
        await transporter.sendMail({
            from: process.env.USER || 'sharingyatra@gmail.com',
            to: email,
            subject: 'Action Required: Your Sharing Yatra Start-Ride Code',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2 style="color: #0056b3;">Sharing Yatra - Ride Verification</h2>
                    <p>Dear ${name},</p> 
                    <p>Please use the following One-Time Password (OTP) to begin your ride. This code is valid for 3 minutes.</p>
                    <h1 style="font-size: 36px; text-align: center; letter-spacing: 3px; color: #111; background-color: #f4f4f4; padding: 15px 0; border-radius: 5px;">
                        ${otp}
                    </h1>
                    <p style="font-weight: bold; color: #D9534F;">
                        Share this OTP with your Driver Partner to start the ride.
                    </p>
                    <p>For your security, do not share this code with anyone else.</p>
                    <hr style="border: 0; border-top: 1px solid #eee;">
                    <p style="font-size: 0.9em; color: #777;">
                        Thank you,<br>
                        The Sharing Yatra Team<br>
                        Happy Journey
                    </p>
                </div>
            `
        });

        res.json({ success: true, message: 'OTP sent successfully' });
    } catch (err) {
        console.error('Error sending OTP:', err);
        res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
});

// --- [NEW] VERIFY OTP ROUTE ---
router.post('/verify-otp', isAuthenticated, async (req, res) => {
    console.log('Verify OTP route hit');
    try {
        const { bookingId, otp } = req.body;

        // 1. Basic Validation
        if (!bookingId || !otp) {
            return res.status(400).json({ success: false, message: 'Booking ID and OTP are required.' });
        }
        
        // 2. Find the booking to get the customer's email
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found.' });
        }
        
        const customerEmail = booking.customerEmail;
        if (!customerEmail) {
            return res.status(400).json({ success: false, message: 'Customer email not found for this booking.' });
        }

        // 3. Find the OTP in the database
        // We check for both the email AND the OTP
        const savedOtp = await OTP.findOne({
            email: customerEmail,
            otp: otp
        });

        // 4. Check if OTP is valid
        if (!savedOtp) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP. Please try again.' });
        }

        // 5. SUCCESS! Update the ride status
        // We set it to 'Confirmed' to match your 'status-confirmed' CSS
        await Booking.findByIdAndUpdate(bookingId, {
            status: 'Confirmed'
        });

        // 6. Delete the used OTP
        await OTP.deleteOne({ _id: savedOtp._id });

        // 7. Send success response
        res.json({ success: true, message: 'Ride Started Successfully!' });

    } catch (err) {
        console.error('Error verifying OTP:', err);
        res.status(500).json({ success: false, message: 'Server error during OTP verification.' });
    }
});


// --- LOGOUT ROUTE ---
router.get('/logout', (req, res) => {
    // ... [NO CHANGES TO THIS ROUTE] ...
    req.session.destroy(err => {
        if (err) return res.redirect('/driver-dashboard');
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

module.exports = router;