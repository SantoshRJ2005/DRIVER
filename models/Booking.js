const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    customerName: { type: String },
    customerEmail: { type: String },
    mobile: { type: String },
    from: { type: String },
    pickupAddress: { type: String },
    to: { type: String },
    date: { type: Date },
    time: { type: String },
    requestDate: { type: Date, default: Date.now },
    status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
    
    // This links to the agency who gets the request
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency' },
        vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicles' },

    // These are added on approval
    driverName: { type: String },
    fare: { type: String }
    
}, { timestamps: true });

module.exports = mongoose.model("Booking", bookingSchema);