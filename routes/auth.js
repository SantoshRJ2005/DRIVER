const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { put } = require('@vercel/blob');
const router = express.Router();

const Drivers = require('../models/Driver');
const Agency = require('../models/Agency'); 


// Middleware to check if user is logged in
function isAuthenticated(req, res, next) {
    if (req.session && req.session.DriversId) {
        return next();
    }
    // FIX 1: Use res.redirect to send user to the login page route
    return res.redirect('/'); 
}

// GET / (Login Page)
router.get('/', (req, res) => {
    res.render('login', { message: '' });
});

// POST /driver-login (Handle Login Logic)
router.post('/driver-login', async (req, res) => {
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

// GET /driver-dashboard (Protected Dashboard Page)
// FIX 2: Removed the duplicate, unprotected /driver-dashboard route that was here.
router.get('/driver-dashboard', isAuthenticated, async (req, res) => {
    try {
      let driver = await Drivers.findById(req.session.DriversId).populate('agencyId');
        
        if (!driver) {
            // FIX 3: Use res.redirect here as well
            return res.redirect('/'); 
        }
        // FIX 4: Pass the variable as 'drivers' (lowercase) to match your EJS file
        res.render('driver-dashboard', { drivers: driver  }); 

    } catch (err) {
        console.error("Error fetching driver for dashboard", err);
        res.status(500).send("Error Loading your Dashboard");
    }
});


router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.redirect('/dashboard');
        res.clearCookie('connect.sid');
        res.render('login');
    });
});

module.exports = router;
