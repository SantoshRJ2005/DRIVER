const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGO_URI,          // <-- FIX: Was 'monogUrl'
        collectionName: 'session'   // <-- FIX: Was 'CollectionName'
    }),
    cookie: {                       // <-- FIX: Was 'cookie{' (missing colon)
        maxAge: 1000 * 60 * 60 * 24 // <-- FIX: Was 'maxage'
    }
}));

app.use('/', authRoutes); // <-- FIX: Removed the extra dot

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("Database connected");
        app.listen(PORT, () => {
            console.log(`http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error(`DB Error `, err);
        process.exit(1);
    });