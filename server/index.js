const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Crypto = require('./models/Crypto');
const { protect } = require('./middleware/authMiddleware');

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: [
    'http://localhost:5173',
    process.env.FRONTEND_URL || 'https://mackey-kumi-crypto-app.netlify.app'
  ],
  credentials: true
}));

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coinbase_clone');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

connectDB();

// --- Auth Routes ---

const generateToken = (res, userId) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '30d',
  });

  res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: process.env.NODE_ENV === 'development' ? 'strict' : 'none',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
};

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Mackey Kumi Crypto API is running 🚀' });
});

app.post('/register', async (req, res) => {

  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      generateToken(res, user._id);
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      generateToken(res, user._id);
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/logout', (req, res) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({ message: 'Logged out successfully' });
});

// --- Profile Route ---
app.get('/profile', protect, async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
    });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

// --- Crypto Routes ---

app.get('/crypto', async (req, res) => {
  try {
    const cryptos = await Crypto.find({});
    res.json(cryptos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/crypto/gainers', async (req, res) => {
  try {
    const gainers = await Crypto.find({}).sort({ change24h: -1 });
    res.json(gainers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/crypto/new', async (req, res) => {
  try {
    const newCryptos = await Crypto.find({}).sort({ createdAt: -1 });
    res.json(newCryptos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/crypto', async (req, res) => {
  try {
    const { name, symbol, price, image, change24h } = req.body;

    const crypto = new Crypto({
      name,
      symbol,
      price,
      image,
      change24h,
    });

    const createdCrypto = await crypto.save();
    res.status(201).json(createdCrypto);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Seed some data if empty
app.get('/seed', async (req, res) => {
  try {
    await Crypto.deleteMany();
    const createdCryptos = await Crypto.insertMany([
      { name: 'Bitcoin', symbol: 'BTC', price: 65000, image: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png', change24h: 2.5 },
      { name: 'Ethereum', symbol: 'ETH', price: 3500, image: 'https://cryptologos.cc/logos/ethereum-eth-logo.png', change24h: 1.2 },
      { name: 'Tether', symbol: 'USDT', price: 1.00, image: 'https://cryptologos.cc/logos/tether-usdt-logo.png', change24h: 0.01 },
      { name: 'XRP', symbol: 'XRP', price: 0.50, image: 'https://cryptologos.cc/logos/xrp-xrp-logo.png', change24h: -0.5 },
      { name: 'BNB', symbol: 'BNB', price: 600, image: 'https://cryptologos.cc/logos/bnb-bnb-logo.png', change24h: 1.5 },
      { name: 'USDC', symbol: 'USDC', price: 1.00, image: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png', change24h: 0.00 },
    ]);
    res.json({ message: 'Data Seeded!', data: createdCryptos });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
