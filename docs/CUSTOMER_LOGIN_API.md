# Customer Login API Documentation

## Endpoint
`POST /api/public/logincustomer`

## Description
Authenticates customers and provides a JWT token for accessing customer-specific endpoints. This endpoint is specifically designed for customer portal login and includes customer-specific information in the JWT payload.

---

## Request

### Headers
```
Content-Type: application/json
```

### Body Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| username | string | Yes | Customer's username |
| password | string | Yes | Customer's password (minimum 8 characters) |

### Example Request
```json
{
  "username": "john_doe",
  "password": "securePassword123"
}
```

---

## Response

### Success Response (200 OK)
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": 1,
    "username": "john_doe",
    "name": "John Doe",
    "email": "john.doe@email.com",
    "phone": "0771234567",
    "nic": "123456789012",
    "role": "customer"
  }
}
```

### JWT Token Payload
The JWT token contains the following claims:
```javascript
{
  userId: number,        // Customer ID
  username: string,      // Customer username
  nic: string,          // Customer NIC (for fetching account details)
  role: 'customer',     // Fixed role for authorization
  name: string,         // Customer name
  exp: number,          // Token expiration (8 hours from issue)
  iat: number           // Token issued at
}
```

### Error Responses

#### 400 Bad Request - Missing Fields
```json
{
  "message": "Username and password are required"
}
```

#### 400 Bad Request - Password Too Short
```json
{
  "message": "Password must be at least 8 characters long"
}
```

#### 401 Unauthorized - Invalid Credentials
```json
{
  "message": "Invalid username or password"
}
```

#### 403 Forbidden - Inactive Account
```json
{
  "message": "Account is inactive. Please contact your branch."
}
```

#### 500 Internal Server Error
```json
{
  "error": "An error occurred during login. Please try again."
}
```

---

## Features

### 1. **Password Validation**
- Minimum 8 characters required
- Uses bcrypt for secure password comparison

### 2. **Account Status Check**
- Verifies customer account is active (`is_active = true`)
- Prevents login for deactivated accounts

### 3. **Extended Session**
- Token valid for 8 hours (vs 1 hour for officers)
- Better UX for customer portal sessions

### 4. **Comprehensive JWT Claims**
- Includes NIC for easy access to customer details API
- Contains all essential user information
- Role claim for authorization middleware

### 5. **Activity Logging**
- Logs all login attempts to system activity log
- Records customer NIC and username

---

## Security Features

1. **Password Hashing**: Passwords stored with bcrypt
2. **JWT Authentication**: Stateless token-based auth
3. **Role-Based Access**: Token includes 'customer' role
4. **Account Status**: Checks if account is active
5. **Error Messages**: Generic messages to prevent username enumeration

---

## Integration with Customer Details API

The NIC included in the JWT token can be used directly with the customer details endpoint:

```javascript
// After login, decode token or use returned user object
const nic = user.nic; // "123456789012"

// Fetch customer account details
const response = await fetch(
  `http://localhost:3000/api/customer/getCustomerDetails/${nic}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);
```

---

## Frontend Implementation

### React Login Component Example

```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface LoginResponse {
  message: string;
  token: string;
  user: {
    userId: number;
    username: string;
    name: string;
    email: string;
    phone: string;
    nic: string;
    role: string;
  };
}

const CustomerLogin: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3000/api/public/logincustomer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data: LoginResponse = await response.json();

      if (!response.ok) {
        setError(data.message || 'Login failed');
        return;
      }

      // Store token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Redirect to customer dashboard
      navigate('/customer/dashboard');

    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Customer Login</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CustomerLogin;
```

### Auth Context Integration

```typescript
// contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  userId: number;
  username: string;
  name: string;
  email: string;
  phone: string;
  nic: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Load from localStorage on mount
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      isAuthenticated: !!token
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

---

## Testing

### Using cURL
```bash
curl -X POST http://localhost:3000/api/public/logincustomer \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "password": "securePassword123"
  }'
```

### Using Postman
1. Method: POST
2. URL: `http://localhost:3000/api/public/logincustomer`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "username": "john_doe",
  "password": "securePassword123"
}
```

### Test Scenarios

1. **Valid Login**
   - Input: Valid username and password
   - Expected: 200 OK with token and user data

2. **Invalid Password**
   - Input: Valid username, wrong password
   - Expected: 401 Unauthorized

3. **Invalid Username**
   - Input: Non-existent username
   - Expected: 401 Unauthorized

4. **Short Password**
   - Input: Password less than 8 characters
   - Expected: 400 Bad Request

5. **Inactive Account**
   - Input: Valid credentials for inactive account
   - Expected: 403 Forbidden

6. **Missing Fields**
   - Input: Empty username or password
   - Expected: 400 Bad Request

---

## Differences from Officer Login

| Feature | Customer Login | Officer Login |
|---------|---------------|---------------|
| Endpoint | `/api/public/logincustomer` | `/api/public/loginofficers` |
| Token Expiry | 8 hours | 1 hour |
| JWT Claims | Includes NIC | No NIC |
| Account Status Check | Yes (`is_active`) | No |
| User Table | `customers` | `login_authentication` |
| Role | Fixed: 'customer' | Dynamic: 'admin'/'agent' |

---

## Activity Logging

All login attempts are logged in the system activity log with:
- Event Type: `CUSTOMER_LOGIN`
- Description: `Customer {username} (NIC: {nic}) logged in`
- User ID: Customer's ID
- Timestamp: Automatic

---

## Security Recommendations

1. **HTTPS Only**: Always use HTTPS in production
2. **Rate Limiting**: Implement rate limiting to prevent brute force
3. **Token Refresh**: Consider implementing refresh tokens for extended sessions
4. **2FA**: Consider adding two-factor authentication
5. **Password Policy**: Enforce strong password requirements
6. **Session Management**: Implement logout endpoint to invalidate tokens

---

## Related Endpoints

- `GET /api/customer/getCustomerDetails/:nic` - Fetch customer account details
- `POST /api/public/loginofficers` - Login for admin/agent users

---

## Notes

- Password stored with bcrypt hashing (cost factor 10)
- JWT secret key stored in environment variable `JWT_SECRET_KEY`
- Token includes NIC for seamless integration with customer details API
- Generic error messages prevent username enumeration attacks
- Account status check prevents login for suspended accounts
