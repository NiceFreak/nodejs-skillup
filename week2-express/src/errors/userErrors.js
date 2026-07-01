// name: EmailConflictError
// message: User with email xxx already exists
export class EmailConflictError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = "EmailConflictError";
        this.cause = options?.cause;
    }
}

// name: UserValidationError
// message: User Validation Error: xxx
export class UserValidationError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = "UserValidationError";
        this.cause = options?.cause;
    }
}
// name: DatabaseConnectionError
// message: Failed to connect to the database
export class DatabaseConnectionError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = "DatabaseConnectionError";
        this.cause = options?.cause;
    }
}
