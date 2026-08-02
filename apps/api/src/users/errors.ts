export class DuplicateEmailError extends Error {
    public constructor(email: string) {
        super(`An account with email ${email} already exists.`);
        this.name = 'DuplicateEmailError';
    }
}

export class ValidationError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}
