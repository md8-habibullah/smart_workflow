// Every test file gets a fresh in-memory database seeded with demo data.
process.env.NODE_ENV = 'test';
process.env.DB_FILE = ':memory:';
process.env.BCRYPT_ROUNDS = '4';
process.env.JWT_SECRET = 'test_secret_key_that_is_long_enough_123';
// Uploaded files go to a throw-away directory outside the project.
process.env.UPLOAD_DIR = `${process.env.TEMP || process.env.TMPDIR || '/tmp'}/swta-test-uploads`;
