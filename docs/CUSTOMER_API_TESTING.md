# Customer Details API - Testing Guide

## Quick Start

### 1. Start the Backend Server
```bash
cd Banking_System_backend
npm start
```

### 2. Test the Endpoint

**Using cURL:**
```bash
curl -X GET "http://localhost:3000/api/customer/getCustomerDetails/123456789012" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Using Postman:**
1. Method: GET
2. URL: `http://localhost:3000/api/customer/getCustomerDetails/:nic`
3. Headers:
   - `Authorization: Bearer YOUR_JWT_TOKEN`
   - `Content-Type: application/json`

**Using JavaScript (Frontend):**
```javascript
const getCustomerDetails = async (nic) => {
  try {
    const response = await fetch(
      `http://localhost:3000/api/customer/getCustomerDetails/${nic}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching customer details:', error);
    throw error;
  }
};

// Usage
getCustomerDetails('123456789012')
  .then(data => {
    console.log('Customer Data:', data);
    console.log('Total Accounts:', data.total_accounts);
    
    data.accounts.forEach(account => {
      console.log(`Account ${account.account_no}:`);
      console.log(`  Balance: ${account.summary.current_balance}`);
      console.log(`  Total Deposits: ${account.summary.transaction_totals.deposits.total_amount}`);
      console.log(`  Total Withdrawals: ${account.summary.transaction_totals.withdrawals.total_amount}`);
      console.log(`  Net Flow: ${account.summary.net_transaction_flow}`);
    });
  })
  .catch(error => console.error(error));
```

## Expected Response Structure

```json
{
  "customer_nic": "123456789012",
  "total_accounts": 1,
  "accounts": [
    {
      "account_no": "SA001",
      "role": "primary",
      "savings_balance": 50000.00,
      "savings_status": "active",
      "fixed_deposits": [
        {
          "fd_account_no": "FD001",
          "amount": 100000.00,
          "starting_date": "2024-01-01T00:00:00.000Z",
          "maturity_date": "2025-01-01T00:00:00.000Z"
        }
      ],
      "transactions": {
        "transfers_sent": [
          {
            "transaction_id": "T001",
            "amount": 5000.00,
            "receiver_account_no": "SA002",
            "transaction_done_by": "AG001",
            "transaction_date": "2024-10-01T00:00:00.000Z"
          }
        ],
        "transfers_received": [],
        "deposits": [
          {
            "transaction_id": "D001",
            "amount": 10000.00,
            "transaction_done_by": "AG001",
            "transaction_date": "2024-09-15T00:00:00.000Z"
          }
        ],
        "withdrawals": [
          {
            "transaction_id": "W001",
            "amount": 2000.00,
            "transaction_done_by": "AG001",
            "transaction_date": "2024-09-20T00:00:00.000Z"
          }
        ],
        "savings_interest": [
          {
            "payment_id": "SI001",
            "amount": 250.00,
            "transaction_done_by": "SYSTEM",
            "transaction_date": "2024-09-30T00:00:00.000Z"
          }
        ],
        "fd_interest": []
      },
      "summary": {
        "current_balance": 50000.00,
        "net_balance": 50000.00,
        "total_fd_amount": 100000.00,
        "transaction_totals": {
          "transfers_sent": {
            "count": 1,
            "total_amount": 5000.00
          },
          "transfers_received": {
            "count": 0,
            "total_amount": 0.00
          },
          "deposits": {
            "count": 1,
            "total_amount": 10000.00
          },
          "withdrawals": {
            "count": 1,
            "total_amount": 2000.00
          },
          "savings_interest": {
            "count": 1,
            "total_amount": 250.00
          },
          "fd_interest": {
            "count": 0,
            "total_amount": 0.00
          }
        },
        "net_transaction_flow": 3250.00
      }
    }
  ]
}
```

## Frontend React Component Example

```typescript
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface TransactionTotals {
  count: number;
  total_amount: number;
}

interface AccountSummary {
  current_balance: number;
  net_balance: number;
  total_fd_amount: number;
  transaction_totals: {
    transfers_sent: TransactionTotals;
    transfers_received: TransactionTotals;
    deposits: TransactionTotals;
    withdrawals: TransactionTotals;
    savings_interest: TransactionTotals;
    fd_interest: TransactionTotals;
  };
  net_transaction_flow: number;
}

interface Account {
  account_no: string;
  role: string;
  savings_balance: number;
  savings_status: string;
  fixed_deposits: any[];
  transactions: any;
  summary: AccountSummary;
}

interface CustomerDetails {
  customer_nic: string;
  total_accounts: number;
  accounts: Account[];
}

const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [customerData, setCustomerData] = useState<CustomerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCustomerDetails = async () => {
      try {
        const response = await fetch(
          `http://localhost:3000/api/customer/getCustomerDetails/${user.nic}`,
          {
            headers: {
              'Authorization': `Bearer ${user.token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch customer details');
        }

        const data = await response.json();
        setCustomerData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerDetails();
  }, [user]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!customerData) return <div>No data available</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">My Accounts</h1>
      
      <div className="grid gap-6">
        {customerData.accounts.map((account) => (
          <div key={account.account_no} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold">{account.account_no}</h2>
                <p className="text-gray-600">{account.role} account</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">
                  Rs. {account.summary.current_balance.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">Current Balance</p>
              </div>
            </div>

            {account.summary.total_fd_amount > 0 && (
              <div className="bg-blue-50 p-4 rounded mb-4">
                <p className="text-sm text-gray-600">Fixed Deposits</p>
                <p className="text-xl font-semibold text-blue-600">
                  Rs. {account.summary.total_fd_amount.toLocaleString()}
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Deposits</p>
                <p className="text-lg font-semibold text-green-600">
                  Rs. {account.summary.transaction_totals.deposits.total_amount.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  {account.summary.transaction_totals.deposits.count} transactions
                </p>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-600">Withdrawals</p>
                <p className="text-lg font-semibold text-red-600">
                  Rs. {account.summary.transaction_totals.withdrawals.total_amount.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  {account.summary.transaction_totals.withdrawals.count} transactions
                </p>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-600">Interest Earned</p>
                <p className="text-lg font-semibold text-blue-600">
                  Rs. {(
                    account.summary.transaction_totals.savings_interest.total_amount +
                    account.summary.transaction_totals.fd_interest.total_amount
                  ).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Total interest</p>
              </div>
            </div>

            <div className={`p-4 rounded ${
              account.summary.net_transaction_flow >= 0 ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <p className="text-sm text-gray-600">Net Transaction Flow</p>
              <p className={`text-xl font-bold ${
                account.summary.net_transaction_flow >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                Rs. {account.summary.net_transaction_flow.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomerDashboard;
```

## Test Cases

### Test Case 1: Customer with Single Account
- NIC: Valid customer NIC
- Expected: Single account with all transaction details

### Test Case 2: Customer with Multiple Accounts (Joint)
- NIC: Customer with joint accounts
- Expected: Multiple accounts array with separate summaries

### Test Case 3: Customer with No Transactions
- NIC: Newly created customer
- Expected: Account with zero totals and empty transaction arrays

### Test Case 4: Customer with Fixed Deposits
- NIC: Customer with FD accounts
- Expected: FD details in fixed_deposits array with totals

### Test Case 5: Invalid NIC
- NIC: Non-existent customer
- Expected: 404 error with message

## Common Issues & Solutions

### Issue 1: 401 Unauthorized
**Solution:** Ensure JWT token is valid and included in Authorization header

### Issue 2: 404 Not Found
**Solution:** Verify customer NIC exists in database

### Issue 3: Empty transactions arrays
**Solution:** This is normal if customer has no transactions yet

### Issue 4: Incorrect totals
**Solution:** Check that transactions are not duplicated in the database

## Performance Considerations

- Query includes multiple LEFT JOINs - may be slow with large datasets
- Consider adding pagination if customer has many transactions
- Transaction deduplication happens in controller - could be optimized with DISTINCT in query
