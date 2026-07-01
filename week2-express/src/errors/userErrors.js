// name: EmailConflictError
// message: User with email xxx already exists
export class EmailConflictError extends Error {
    constructor(message) {
        super(message);
        this.name = "EmailConflictError";
    }
}
// name: ValidationError
// message: Validation Error: xxx
export class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ValidationError";
    }
}