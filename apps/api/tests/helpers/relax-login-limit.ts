// Imported first by tests that log in more than the production limit allows per window;
// config reads this once, at import.
process.env.LOGIN_RATE_LIMIT_MAX ??= '500';
