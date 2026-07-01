// name: EmailConflictError
// message: User with email xxx already exists
export class EmailConflictError extends Error {
    constructor(message) {
        super(message);
        this.name = "EmailConflictError";
    }
}

// name: UserValidationError
// message: User Validation Error: xxx
export class UserValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "UserValidationError";
    }
}
