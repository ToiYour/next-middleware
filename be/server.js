import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

//  CORS
app.use(
  cors({
    origin: "http://localhost:3001",
    credentials: true,
  })
);

const ACCESS_TOKEN_SECRET =
  "!&8xx=nv-#s@kj3y$f!l61vb=5d6pb)%h%d_voa58wsdnvj5+v";
const REFRESH_TOKEN_SECRET =
  "y5s3mkgov=&p+kvfsn071o-(%%b7$8-68u%9#78u257#ii-pbs";

// Fake DB
const users = [
  {
    id: 1,
    username: "admin",
    password: bcrypt.hashSync("123456", 8),
    role: "admin",
  },
];

// Tạo token
const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, role:user?.role },
    ACCESS_TOKEN_SECRET,
    {
      expiresIn: "30",
    }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, role:user?.role },
    REFRESH_TOKEN_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

// Login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  console.log("🚀 ~ app.post ~ req.body:", req.body);
  const user = users.find((u) => u.username === username);
  if (!user) return res.status(404).json({ message: "User not found" });

  const isMatch = bcrypt.compareSync(password, user.password);
  if (!isMatch) return res.status(401).json({ message: "Wrong password" });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Lưu refreshToken vào cookie HttpOnly
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });
  res.json({ accessToken, user: { id: user.id, username: user.username } });
});

// Middleware xác thực
const authenticate = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  console.log("🚀 ~ authenticate ~ authHeader:", authHeader)
  const token = authHeader && authHeader.split(" ")[1];
  console.log("🚀 ~ authenticate ~ token:", token)

  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.log("🚀 ~ authenticate ~ error:", error)
    return res.status(403).json({ message: "Invalid token" });
  }
};

// Lấy profile
app.get("/api/profile", authenticate, (req, res) => {
  res.json({ message: "Welcome!", user: req.user });
});

// Refresh Access Token
app.post("/api/refresh-token", (req, res) => {
  const token = req.cookies.refreshToken;
  console.log("🚀 ~ app.post ~ token:", token)
  // res?.status(401)?.json({ message: "No refresh token" })
  if (!token) return res.status(401).json({ message: "No refresh token" });

  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);
    const user = users.find((u) => u.id === decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const newAccessToken = generateAccessToken(user);
    res.json({ accessToken: newAccessToken });
  } catch (error) {
    return res.status(403).json({ message: "Invalid refresh token" });
  }
});

// Khởi động server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
