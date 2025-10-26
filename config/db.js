const mongoose = require('mongoose');

// The options object is removed, and the .catch is fixed
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Mongoose Connected"))
    .catch(err => console.log("Error in MONGOOSE", err)); // <-- Fixed: no semicolon, added dot

module.exports = mongoose;