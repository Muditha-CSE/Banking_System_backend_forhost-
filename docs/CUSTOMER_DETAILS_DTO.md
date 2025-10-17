# Customer Details API - DTO Documentation

## Endpoint
`GET /api/customer/details/:nic`

## Response Structure

### Top Level
```json
{
  "customer_nic": "string",
  "total_accounts": "number",
  "accounts": [AccountDTO]
}
```

### AccountDTO Structure
```json
{
  "account_no": "string",
  "role": "primary | secondary",
  "savings_balance": "number",
  "savings_status": "string",
  "fixed_deposits": [FixedDepositDTO],
  "transactions": {
    "transfers_sent": [TransferDTO],
    "transfers_received": [TransferDTO],
    "deposits": [DepositDTO],
    "withdrawals": [WithdrawalDTO],
    "savings_interest": [InterestDTO],
    "fd_interest": [InterestDTO]
  },
  "summary": {
    "current_balance": "number",
    "net_balance": "number",
    "total_fd_amount": "number",
    "transaction_totals": {
      "transfers_sent": {
        "count": "number",
        "total_amount": "number"
      },
      "transfers_received": {
        "count": "number",
        "total_amount": "number"
      },
      "deposits": {
        "count": "number",
        "total_amount": "number"
      },
      "withdrawals": {
        "count": "number",
        "total_amount": "number"
      },
      "savings_interest": {
        "count": "number",
        "total_amount": "number"
      },
      "fd_interest": {
        "count": "number",
        "total_amount": "number"
      }
    },
    "net_transaction_flow": "number"
  }
}
```

## Transaction Categories

### 1. Transfers Sent
Account-to-account transfers where this account is the sender (money going out).

### 2. Transfers Received
Account-to-account transfers where this account is the receiver (money coming in).

### 3. Deposits
Cash deposits made to this account (money coming in).

### 4. Withdrawals
Cash withdrawals from this account (money going out).

### 5. Savings Interest
Interest payments credited to the savings account.

### 6. FD Interest
Interest payments from linked fixed deposit accounts.

## Computed Fields

### current_balance
The current balance in the savings account as stored in the database.

### net_balance
Currently equals current_balance. Can be enhanced to include pending transactions.

### total_fd_amount
Sum of all fixed deposit amounts linked to this account.

### net_transaction_flow
Calculated as:
```
deposits + transfers_received + savings_interest + fd_interest 
- withdrawals - transfers_sent
```

This represents the net change from all transactions (excluding the initial deposit).

## Example Response

```json
{
  "customer_nic": "123456789012",
  "total_accounts": 2,
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
          "starting_date": "2024-01-01",
          "maturity_date": "2025-01-01"
        }
      ],
      "transactions": {
        "transfers_sent": [
          {
            "transaction_id": "T001",
            "amount": 5000.00,
            "receiver_account_no": "SA002",
            "transaction_done_by": "AG001",
            "transaction_date": "2024-10-01"
          }
        ],
        "transfers_received": [],
        "deposits": [
          {
            "transaction_id": "D001",
            "amount": 10000.00,
            "transaction_done_by": "AG001",
            "transaction_date": "2024-09-15"
          }
        ],
        "withdrawals": [
          {
            "transaction_id": "W001",
            "amount": 2000.00,
            "transaction_done_by": "AG001",
            "transaction_date": "2024-09-20"
          }
        ],
        "savings_interest": [
          {
            "payment_id": "SI001",
            "amount": 250.00,
            "transaction_done_by": "SYSTEM",
            "transaction_date": "2024-09-30"
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

## Usage in Frontend

The frontend can use this DTO to:

1. **Display Account Overview**: Show current balance, total FDs, and account status
2. **Transaction History**: Display all transactions categorized by type
3. **Financial Summary**: Show totals for each transaction category
4. **Analytics**: Calculate metrics like:
   - Total money in vs out
   - Interest earned
   - Transfer activity
   - Account health indicators

## Implementation Notes

- All monetary values are rounded to 2 decimal places
- Transactions are deduplicated by their IDs
- Empty arrays are returned if no transactions exist in a category
- The controller handles multiple accounts per customer (joint accounts)
- Fixed deposits are linked to savings accounts
