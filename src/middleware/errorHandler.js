// src/middleware/errorHandler.js

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware
 * Catches all errors and sends standardized error responses
 */
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  // Log error for debugging (in production, use a proper logger like Winston)
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', {
      message: error.message,
      stack: err.stack,
      statusCode: error.statusCode
    });
  }

  // PostgreSQL unique constraint error
  if (err.code === '23505') {
    const field = err.detail?.match(/Key \(([^)]+)\)/)?.[1] || 'field';
    error = new AppError(`Duplicate value for ${field}. Please use another value.`, 400);
  }

  // PostgreSQL foreign key constraint error
  if (err.code === '23503') {
    error = new AppError('Invalid reference to related record.', 400);
  }

  // PostgreSQL not null constraint error
  if (err.code === '23502') {
    const field = err.column || 'field';
    error = new AppError(`${field} is required.`, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token. Please log in again.', 401);
  }

  if (err.name === 'TokenExpiredError') {
    error = new AppError('Your token has expired. Please log in again.', 401);
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    error = new AppError(`Validation error: ${messages.join(', ')}`, 400);
  }

  // Send error response
  const response = {
    success: false,
    error: error.message || 'Internal server error',
    statusCode: error.statusCode
  };

  // Include stack trace in development mode
  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.stack = err.stack;
  }

  res.status(error.statusCode).json(response);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 error handler for undefined routes
 */
export const notFound = (req, res, next) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};
