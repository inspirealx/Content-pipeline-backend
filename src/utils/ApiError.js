// src/utils/ApiError.js
class ApiError extends Error {
    constructor(message, statusCode, code = null, userMessage = null, field = null, details = {}) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        this.code = code;
        this.userMessage = userMessage || message;
        this.field = field;
        this.details = details;

        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            success: false,
            error: {
                code: this.code,
                message: this.message,
                userMessage: this.userMessage,
                ...(this.field && { field: this.field }),
                ...(Object.keys(this.details).length > 0 && { details: this.details })
            }
        };
    }
}

module.exports = ApiError;
