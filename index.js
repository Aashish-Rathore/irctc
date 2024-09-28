import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import connect from './database/connect.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 8080;
const database = await connect();

app.use(express.json());

// Middleware to check if the request is from an admin using an API key
const checkAdminApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ message: 'Forbidden: Invalid API Key' });
  }
  next();
};

// Middleware to authenticate users with JWT
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Register User
app.post('/register', async (req, res) => {
  const { username, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const query = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';
  await database.execute(query, [username, hashedPassword, role || 'user']);
  res.status(201).json({ message: 'User registered successfully' });
});

// Login User
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const [rows] = await database.execute('SELECT * FROM users WHERE username = ?', [username]);
  const user = rows[0];

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ message: 'Login successful', token });
});

// Add a New Train (Admin Only)
app.post('/trains', checkAdminApiKey, async (req, res) => {
  const { name, source, destination, totalSeats } = req.body;
  await database.execute('INSERT INTO trains (name, source, destination, totalSeats, availableSeats) VALUES (?, ?, ?, ?, ?)', 
  [name, source, destination, totalSeats, totalSeats]);
  res.status(201).json({ message: 'Train added successfully' });
});

// Get Seat Availability
app.get('/trains', async (req, res) => {
  const { source, destination } = req.query;
  const [rows] = await database.execute('SELECT * FROM trains WHERE source = ? AND destination = ?', [source, destination]);
  res.json(rows);
});

// Book a Seat
app.post('/book', authenticateToken, async (req, res) => {
  const { trainId, seatNumber } = req.body;

  // Check seat availability
  const [trainRows] = await database.execute('SELECT * FROM trains WHERE id = ?', [trainId]);
  const train = trainRows[0];
  if (!train || train.availableSeats <= 0) {
    return res.status(400).json({ message: 'No seats available' });
  }

  // Book the seat
  await database.execute('INSERT INTO bookings (userId, trainId, seatNumber) VALUES (?, ?, ?)', [req.user.id, trainId, seatNumber]);
  await database.execute('UPDATE trains SET availableSeats = availableSeats - 1 WHERE id = ?', [trainId]);

  res.status(201).json({ message: 'Seat booked successfully' });
});

// Get Specific Booking Details
app.get('/booking/:id', authenticateToken, async (req, res) => {
  const bookingId = req.params.id;
  const [rows] = await database.execute('SELECT * FROM bookings WHERE id = ? AND userId = ?', [bookingId, req.user.id]);
  if (rows.length === 0) {
    return res.status(404).json({ message: 'Booking not found' });
  }
  res.json(rows[0]);
});

app.listen(PORT, () => {
  console.log(`Server is running on PORT -> ${PORT}`);
});
