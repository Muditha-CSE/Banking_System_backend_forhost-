import jwt from "jsonwebtoken";
import dotenv from 'dotenv';

dotenv.config();


const SECRET_KEY =  process.env.JWT_SECRET_KEY;

const authenticateRole = (allowedRoles)=> (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: "Authorization header missing" });
    }

    jwt.verify (token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Invalid token" });
        }
        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({ message: "Access denied" });
        }
        req.user = user;
        next();
    });
};

export default { authenticateRole };