# Customer Portal Integration Guide

## Overview
This guide shows how to integrate the Customer Login API with the Customer Details API to create a complete customer portal experience.

---

## Architecture Flow

```
1. Customer Login
   └─> POST /api/public/logincustomer
       └─> Returns JWT with NIC claim
           └─> Store token in localStorage/context

2. Fetch Customer Details
   └─> GET /api/customer/getCustomerDetails/:nic
       └─> Use NIC from JWT payload
       └─> Include token in Authorization header
           └─> Display account information

3. Protected Routes
   └─> All customer routes require JWT token
       └─> Middleware validates token and role
```

---

## Complete Integration Example

### Step 1: Login Flow

```typescript
// services/authService.ts
export const loginCustomer = async (username: string, password: string) => {
  const response = await fetch('http://localhost:3000/api/public/logincustomer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return await response.json();
};
```

### Step 2: Fetch Customer Data

```typescript
// services/customerService.ts
export const getCustomerDetails = async (nic: string, token: string) => {
  const response = await fetch(
    `http://localhost:3000/api/customer/getCustomerDetails/${nic}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch customer details');
  }

  return await response.json();
};
```

### Step 3: Complete Dashboard Component

```typescript
// components/CustomerDashboard.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getCustomerDetails } from '../services/customerService';

interface CustomerData {
  customer_nic: string;
  total_accounts: number;
  accounts: Array<{
    account_no: string;
    role: string;
    savings_balance: number;
    savings_status: string;
    fixed_deposits: any[];
    transactions: any;
    summary: {
      current_balance: number;
      net_balance: number;
      total_fd_amount: number;
      transaction_totals: any;
      net_transaction_flow: number;
    };
  }>;
}

const CustomerDashboard: React.FC = () => {
  const { user, token } = useAuth();
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !token) return;

      try {
        const data = await getCustomerDetails(user.nic, token);
        setCustomerData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading your account details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (!customerData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>No account data available</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome, {user?.name}
              </h1>
              <p className="text-gray-600">NIC: {customerData.customer_nic}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Total Accounts</p>
              <p className="text-2xl font-bold">{customerData.total_accounts}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid gap-6">
          {customerData.accounts.map((account) => (
            <div key={account.account_no} className="bg-white rounded-lg shadow-lg p-6">
              {/* Account Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {account.account_no}
                  </h2>
                  <div className="flex gap-2 mt-2">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {account.role}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      account.savings_status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {account.savings_status}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Current Balance</p>
                  <p className="text-3xl font-bold text-green-600">
                    Rs. {account.summary.current_balance.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Fixed Deposits */}
              {account.summary.total_fd_amount > 0 && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-600">Fixed Deposits</p>
                      <p className="text-xl font-semibold text-blue-600">
                        Rs. {account.summary.total_fd_amount.toLocaleString()}
                      </p>
                    </div>
                    <button className="text-blue-600 hover:text-blue-800 text-sm">
                      View Details →
                    </button>
                  </div>
                </div>
              )}

              {/* Transaction Summary Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Deposits</p>
                  <p className="text-xl font-bold text-green-600">
                    Rs. {account.summary.transaction_totals.deposits.total_amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {account.summary.transaction_totals.deposits.count} transactions
                  </p>
                </div>

                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-gray-600">Withdrawals</p>
                  <p className="text-xl font-bold text-red-600">
                    Rs. {account.summary.transaction_totals.withdrawals.total_amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {account.summary.transaction_totals.withdrawals.count} transactions
                  </p>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">Transfers Sent</p>
                  <p className="text-xl font-bold text-purple-600">
                    Rs. {account.summary.transaction_totals.transfers_sent.total_amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {account.summary.transaction_totals.transfers_sent.count} transactions
                  </p>
                </div>

                <div className="p-4 bg-indigo-50 rounded-lg">
                  <p className="text-sm text-gray-600">Transfers Received</p>
                  <p className="text-xl font-bold text-indigo-600">
                    Rs. {account.summary.transaction_totals.transfers_received.total_amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {account.summary.transaction_totals.transfers_received.count} transactions
                  </p>
                </div>

                <div className="p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-gray-600">Interest Earned</p>
                  <p className="text-xl font-bold text-yellow-600">
                    Rs. {(
                      account.summary.transaction_totals.savings_interest.total_amount +
                      account.summary.transaction_totals.fd_interest.total_amount
                    ).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Total interest</p>
                </div>

                <div className={`p-4 rounded-lg ${
                  account.summary.net_transaction_flow >= 0 
                    ? 'bg-green-50' 
                    : 'bg-red-50'
                }`}>
                  <p className="text-sm text-gray-600">Net Flow</p>
                  <p className={`text-xl font-bold ${
                    account.summary.net_transaction_flow >= 0 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    Rs. {account.summary.net_transaction_flow.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {account.summary.net_transaction_flow >= 0 ? 'Net gain' : 'Net loss'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                  View Transactions
                </button>
                <button className="flex-1 bg-gray-600 text-white py-2 rounded hover:bg-gray-700">
                  Download Statement
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default CustomerDashboard;
```

---

## Protected Route Setup

```typescript
// components/ProtectedRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles = ['customer'] 
}) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
```

---

## App Router Setup

```typescript
// App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import CustomerLogin from './components/CustomerLogin';
import CustomerDashboard from './components/CustomerDashboard';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<CustomerLogin />} />
          
          <Route
            path="/customer/dashboard"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <CustomerDashboard />
              </ProtectedRoute>
            }
          />
          
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
```

---

## API Call Sequence Diagram

```
Customer                Frontend                Backend
   |                       |                       |
   |-- Enter Credentials ->|                       |
   |                       |-- POST /logincustomer ->
   |                       |                       |
   |                       |<- Token + User Data --|
   |<- Show Dashboard -----|                       |
   |                       |-- GET /getCustomerDetails/:nic ->
   |                       |    (with Bearer token)
   |                       |                       |
   |                       |<- Account Details ----|
   |<- Display Accounts ---|                       |
```

---

## Error Handling

```typescript
// utils/errorHandler.ts
export const handleApiError = (error: any) => {
  if (error.response) {
    // Server responded with error status
    switch (error.response.status) {
      case 401:
        // Unauthorized - redirect to login
        localStorage.clear();
        window.location.href = '/login';
        break;
      case 403:
        return 'Account is inactive. Please contact your branch.';
      case 404:
        return 'Resource not found.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return error.response.data.message || 'An error occurred';
    }
  } else if (error.request) {
    // Request made but no response
    return 'Network error. Please check your connection.';
  } else {
    return error.message;
  }
};
```

---

## Testing Checklist

- [ ] Customer can login with valid credentials
- [ ] JWT token is stored in localStorage
- [ ] Token includes NIC claim
- [ ] Dashboard loads with customer details
- [ ] All accounts are displayed
- [ ] Transaction totals are correct
- [ ] Net flow calculation is accurate
- [ ] Invalid login shows error message
- [ ] Inactive account cannot login
- [ ] Token expiry redirects to login
- [ ] Protected routes require authentication
- [ ] Logout clears token and redirects

---

## Performance Optimization

1. **Lazy Loading**: Load dashboard components on demand
2. **Caching**: Cache customer details for 5 minutes
3. **Pagination**: Paginate transaction lists if needed
4. **Debouncing**: Debounce API calls
5. **Loading States**: Show skeletons during data fetch

---

## Security Best Practices

1. **Token Storage**: Use httpOnly cookies in production (more secure than localStorage)
2. **Token Refresh**: Implement refresh token mechanism
3. **HTTPS Only**: Always use HTTPS in production
4. **Input Validation**: Validate all inputs on frontend and backend
5. **Rate Limiting**: Implement rate limiting on login endpoint
6. **CORS**: Configure CORS properly for production

---

## Complete Flow Summary

1. **Login** → Customer enters username/password
2. **Authenticate** → Backend validates and returns JWT with NIC
3. **Store** → Frontend stores token and user data
4. **Redirect** → Navigate to customer dashboard
5. **Fetch** → Load customer details using NIC from token
6. **Display** → Show all accounts and transaction summaries
7. **Interact** → Customer views details, downloads statements, etc.
8. **Logout** → Clear token and redirect to login

---

## Next Steps

1. Implement transaction history view
2. Add statement download functionality
3. Create fund transfer feature
4. Add notification system
5. Implement profile management
6. Add transaction search/filter
7. Create analytics dashboard
8. Add mobile responsive design
