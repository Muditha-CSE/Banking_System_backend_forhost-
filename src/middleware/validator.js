// src/middleware/validator.js

import { AppError } from './errorHandler.js';

/**
 * Validation rules and helper functions
 */
export const validate = {
  // NIC validation
  nic: (value) => {
    if (!value) return false;
    const length = value.length;
    if (length === 12) return /^\d{12}$/.test(value);
    if (length === 10) return /^\d{9}[VvXx]$/.test(value);
    return false;
  },

  // Phone validation (Sri Lankan format)
  phone: (value) => {
    if (!value) return false;
    // 10 digits starting with 0
    if (/^0\d{9}$/.test(value)) return true;
    // +94 followed by 9 digits
    if (/^\+94\d{9}$/.test(value)) return true;
    return false;
  },

  // Email validation
  email: (value) => {
    if (!value) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  },

  // Password validation
  password: (value) => {
    return value && value.length >= 8;
  },

  // Required field validation
  required: (value) => {
    return value !== undefined && value !== null && value !== '';
  },

  // Numeric validation
  numeric: (value) => {
    return !isNaN(parseFloat(value)) && isFinite(value);
  },

  // Positive number validation
  positiveNumber: (value) => {
    return validate.numeric(value) && parseFloat(value) > 0;
  }
};

/**
 * Validation middleware factory
 */
export const validateRequest = (schema) => {
  return (req, res, next) => {
    const errors = [];
    const data = { ...req.body, ...req.params, ...req.query };

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];

      // Check if required
      if (rules.required && !validate.required(value)) {
        errors.push(`${field} is required`);
        continue;
      }

      // Skip other validations if field is not required and empty
      if (!rules.required && !validate.required(value)) {
        continue;
      }

      // Check specific validations
      if (rules.type === 'nic' && !validate.nic(value)) {
        errors.push(`${field} must be a valid NIC (12 digits or 9 digits + V)`);
      }

      if (rules.type === 'phone' && !validate.phone(value)) {
        errors.push(`${field} must be a valid phone number`);
      }

      if (rules.type === 'email' && !validate.email(value)) {
        errors.push(`${field} must be a valid email address`);
      }

      if (rules.type === 'password' && !validate.password(value)) {
        errors.push(`${field} must be at least 8 characters long`);
      }

      if (rules.min && value.length < rules.min) {
        errors.push(`${field} must be at least ${rules.min} characters`);
      }

      if (rules.max && value.length > rules.max) {
        errors.push(`${field} must be at most ${rules.max} characters`);
      }

      if (rules.minValue && parseFloat(value) < rules.minValue) {
        errors.push(`${field} must be at least ${rules.minValue}`);
      }

      if (rules.maxValue && parseFloat(value) > rules.maxValue) {
        errors.push(`${field} must be at most ${rules.maxValue}`);
      }

      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(rules.message || `${field} has invalid format`);
      }

      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      return next(new AppError(errors.join('; '), 400));
    }

    next();
  };
};

/**
 * Common validation schemas
 */
export const schemas = {
  addAdmin: {
    username: { required: true, min: 3, max: 50 },
    password: { required: true, type: 'password' },
    name: { required: true, min: 2, max: 100 },
    email: { required: true, type: 'email' },
    phone: { required: true, type: 'phone' },
    NIC: { required: true, type: 'nic' }
  },

  addAgent: {
    username: { required: true, min: 3, max: 50 },
    password: { required: true, type: 'password' },
    name: { required: true, min: 2, max: 100 },
    email: { required: true, type: 'email' },
    phone: { required: true, type: 'phone' },
    NIC: { required: true, type: 'nic' },
    branch_id: { required: true }
  },

  addBranch: {
    branch_name: { required: true, min: 2, max: 100 },
    branch_address: { required: true, min: 5, max: 255 },
    telephone_no: { required: true, type: 'phone' },
    working_hours_start: { required: true },
    working_hours_end: { required: true }
  },

  addCustomer: {
    username: { required: true, min: 3, max: 50 },
    password: { required: true, type: 'password' },
    name: { required: true, min: 2, max: 100 },
    email: { required: true, type: 'email' },
    phone: { required: true, type: 'phone' },
    NIC: { required: true, type: 'nic' },
    gender: { required: true, enum: ['male', 'female'] },
    address: { required: true, min: 5, max: 255 },
    DOB: { required: true }
  },

  login: {
    username: { required: true },
    password: { required: true }
  },

  transaction: {
    account_no: { required: true },
    amount: { required: true, minValue: 0.01 },
    customer_nic: { required: true, type: 'nic' }
  }
};
