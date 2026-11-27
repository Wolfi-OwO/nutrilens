// Imported first by a test file that signs in more often than the real login limit allows (10 per window). The limit is
// read when the config module loads, so this has to run before anything that imports it.
process.env['LOGIN_RATE_LIMIT_MAX'] = '1000';
