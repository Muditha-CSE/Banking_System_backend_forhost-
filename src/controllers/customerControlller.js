import { customerDetails, checkAccounts } from '../models/customerModel.js';

import pool from '../../database.js';

const getCustomerDetails = async (req, res) => {
    const { nic } = req.params;
    console.log('Fetching customer details for NIC:', nic);
    console.log('User from token:', req.user);
    try {
        const checkaccounts = await checkAccounts(pool, nic);
        console.log('Check accounts result:', checkaccounts);
        if (!checkaccounts || checkaccounts.length === 0) {
            console.log('No accounts found for this customer');
            return res.status(404).json({ message: 'No accounts found for this customer' });
        }
        const rawData = await customerDetails(pool, nic);

        if (!rawData || rawData.length === 0) {
            return res.status(404).json({ message: 'No accounts found for this customer' });
        }

        // Group data by account_no to aggregate transactions
        const accountsMap = new Map();

        rawData.forEach(row => {
            const accountNo = row.account_no;
            
            if (!accountsMap.has(accountNo)) {
                accountsMap.set(accountNo, {
                    account_no: accountNo,
                    role: row.role,
                    savings_balance: parseFloat(row.savings_balance) || 0,
                    savings_status: row.savings_status,
                    fixed_deposits: [],
                    transactions: {
                        transfers_sent: [],
                        transfers_received: [],
                        deposits: [],
                        withdrawals: [],
                        savings_interest: [],
                        fd_interest: []
                    }
                });
            }

            const account = accountsMap.get(accountNo);

            // Add fixed deposit if exists
            if (row.fd_account_no && !account.fixed_deposits.find(fd => fd.fd_account_no === row.fd_account_no)) {
                account.fixed_deposits.push({
                    fd_account_no: row.fd_account_no,
                    amount: parseFloat(row.fd_amount) || 0,
                    starting_date: row.fd_start_date,
                    maturity_date: row.fd_maturity_date,
                    status: row.fd_status,
                    last_interest_date: row.fd_last_interest_date,
                    plan: {
                        fd_plan_id: row.fd_plan_id,
                        name: row.fd_plan_name,
                        duration_months: row.fd_duration_months,
                        interest_rate: parseFloat(row.fd_interest_rate) || 0
                    }
                });
            }

            // Add transfer sent
            if (row.transfer_sent_id && !account.transactions.transfers_sent.find(t => t.transaction_id === row.transfer_sent_id)) {
                account.transactions.transfers_sent.push({
                    transaction_id: row.transfer_sent_id,
                    amount: parseFloat(row.transfer_sent_amount) || 0,
                    receiver_account_no: row.transfer_sent_to,
                    transaction_done_by: row.transfer_sent_by,
                    transaction_date: row.transfer_sent_date
                });
            }

            // Add transfer received
            if (row.transfer_received_id && !account.transactions.transfers_received.find(t => t.transaction_id === row.transfer_received_id)) {
                account.transactions.transfers_received.push({
                    transaction_id: row.transfer_received_id,
                    amount: parseFloat(row.transfer_received_amount) || 0,
                    sender_account_no: row.transfer_received_from,
                    transaction_done_by: row.transfer_received_by,
                    transaction_date: row.transfer_received_date
                });
            }

            // Add deposit
            if (row.deposit_id && !account.transactions.deposits.find(t => t.transaction_id === row.deposit_id)) {
                account.transactions.deposits.push({
                    transaction_id: row.deposit_id,
                    amount: parseFloat(row.deposit_amount) || 0,
                    transaction_done_by: row.deposit_by,
                    transaction_date: row.deposit_date
                });
            }

            // Add withdrawal
            if (row.withdraw_id && !account.transactions.withdrawals.find(t => t.transaction_id === row.withdraw_id)) {
                account.transactions.withdrawals.push({
                    transaction_id: row.withdraw_id,
                    amount: parseFloat(row.withdraw_amount) || 0,
                    transaction_done_by: row.withdraw_by,
                    transaction_date: row.withdraw_date
                });
            }

            // Add savings interest
            if (row.savings_interest_id && !account.transactions.savings_interest.find(t => t.payment_id === row.savings_interest_id)) {
                account.transactions.savings_interest.push({
                    payment_id: row.savings_interest_id,
                    amount: parseFloat(row.savings_interest_amount) || 0,
                    transaction_done_by: row.savings_interest_by,
                    transaction_date: row.savings_interest_date
                });
            }

            // Add FD interest
            if (row.fd_interest_id && !account.transactions.fd_interest.find(t => t.payment_id === row.fd_interest_id)) {
                account.transactions.fd_interest.push({
                    payment_id: row.fd_interest_id,
                    amount: parseFloat(row.fd_interest_amount) || 0,
                    transaction_done_by: row.fd_interest_by,
                    transaction_date: row.fd_interest_date
                });
            }
        });

        // Compute aggregates for each account
        const accountsWithAggregates = Array.from(accountsMap.values()).map(account => {
            // Calculate totals for each transaction category
            const totalTransfersSent = account.transactions.transfers_sent.reduce((sum, t) => sum + t.amount, 0);
            const totalTransfersReceived = account.transactions.transfers_received.reduce((sum, t) => sum + t.amount, 0);
            const totalDeposits = account.transactions.deposits.reduce((sum, t) => sum + t.amount, 0);
            const totalWithdrawals = account.transactions.withdrawals.reduce((sum, t) => sum + t.amount, 0);
            const totalSavingsInterest = account.transactions.savings_interest.reduce((sum, t) => sum + t.amount, 0);
            const totalFdInterest = account.transactions.fd_interest.reduce((sum, t) => sum + t.amount, 0);
            
            // Calculate total FD amount
            const totalFdAmount = account.fixed_deposits.reduce((sum, fd) => sum + fd.amount, 0);

            // Net balance calculation:
            // Current balance + all incoming (deposits, transfers received, interest) - all outgoing (withdrawals, transfers sent)
            const netBalance = account.savings_balance;
            
            // Alternative comprehensive net calculation from transactions:
            const calculatedNet = totalDeposits + totalTransfersReceived + totalSavingsInterest + totalFdInterest 
                                  - totalWithdrawals - totalTransfersSent;

            return {
                ...account,
                summary: {
                    current_balance: parseFloat(account.savings_balance.toFixed(2)),
                    net_balance: parseFloat(netBalance.toFixed(2)),
                    total_fd_amount: parseFloat(totalFdAmount.toFixed(2)),
                    transaction_totals: {
                        transfers_sent: {
                            count: account.transactions.transfers_sent.length,
                            total_amount: parseFloat(totalTransfersSent.toFixed(2))
                        },
                        transfers_received: {
                            count: account.transactions.transfers_received.length,
                            total_amount: parseFloat(totalTransfersReceived.toFixed(2))
                        },
                        deposits: {
                            count: account.transactions.deposits.length,
                            total_amount: parseFloat(totalDeposits.toFixed(2))
                        },
                        withdrawals: {
                            count: account.transactions.withdrawals.length,
                            total_amount: parseFloat(totalWithdrawals.toFixed(2))
                        },
                        savings_interest: {
                            count: account.transactions.savings_interest.length,
                            total_amount: parseFloat(totalSavingsInterest.toFixed(2))
                        },
                        fd_interest: {
                            count: account.transactions.fd_interest.length,
                            total_amount: parseFloat(totalFdInterest.toFixed(2))
                        }
                    },
                    net_transaction_flow: parseFloat(calculatedNet.toFixed(2))
                }
            };
        });

        // Return comprehensive customer DTO
        return res.status(200).json({
            customer_nic: nic,
            total_accounts: accountsWithAggregates.length,
            accounts: accountsWithAggregates
        });

    } catch (err) {
        console.error('Error fetching customer details:', err);
        return res.status(500).json({ error: err.message });
    }
};

export default { getCustomerDetails };