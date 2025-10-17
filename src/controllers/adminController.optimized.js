


// src/controllers/adminController.optimized.js
// This is an example of how to refactor controllers with new error handling

import {
  addNewAdminToLog,
  addNewAgentToLog,
  createBranch,
  branchChecker,
  searchUser
} from '../models/adminModel.js';
import { logSystemActivity } from '../models/systemModel.js';
import bcrypt from 'bcrypt';
import pool from '../../database.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';

/**
 * Add new admin - optimized version with better error handling
 */
export const addAdmin = asyncHandler(async (req, res, next) => {
  const { username, password, name, email, phone, NIC } = req.body;
  const created_by = req.user.userId;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if username already exists
    const userExists = await searchUser(client, username);
    if (userExists) {
      throw new AppError('Username already exists', 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Add admin to database
    await addNewAdminToLog(client, username, hashedPassword, name, email, phone, NIC, created_by);

    // Log system activity
    await logSystemActivity(
      client,
      'ADD_ADMIN',
      `Admin ${username} added by user ID ${created_by}`,
      created_by
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Admin added successfully',
      data: { username, name, email }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/**
 * Add new agent - optimized version
 */
export const addAgent = asyncHandler(async (req, res, next) => {
  const { username, password, name, email, phone, NIC, branch_id } = req.body;
  const created_by = req.user.userId;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if username already exists
    const userExists = await searchUser(client, username);
    if (userExists) {
      throw new AppError('Username already exists', 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Add agent to database
    await addNewAgentToLog(
      client,
      username,
      hashedPassword,
      name,
      email,
      phone,
      NIC,
      created_by,
      branch_id
    );

    // Log system activity
    await logSystemActivity(
      client,
      'ADD_AGENT',
      `Agent ${username} added by user ID ${created_by}`,
      created_by
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Agent added successfully',
      data: { username, name, email, branch_id }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/**
 * Add new branch - optimized version
 */
export const addBranch = asyncHandler(async (req, res, next) => {
  const { branch_name, branch_address, telephone_no, working_hours_start, working_hours_end } = req.body;
  const created_by = req.user.userId;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if branch name already exists
    const branchExists = await branchChecker(client, branch_name);
    if (branchExists) {
      throw new AppError('Branch name already exists', 400);
    }

    // Create branch
    await createBranch(
      client,
      branch_name,
      branch_address,
      telephone_no,
      working_hours_start,
      working_hours_end,
      created_by
    );

    // Log system activity
    await logSystemActivity(
      client,
      'ADD_BRANCH',
      `Branch ${branch_name} added by user ID ${created_by}`,
      created_by
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Branch added successfully',
      data: { branch_name, branch_address }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});
