BEGIN;

SELECT plan(2);

SELECT hasnt_column(
  'public',
  'users',
  'phone_number',
  'users no longer stores a phone number (auth is email-only, #126)'
);

SELECT has_column(
  'public',
  'users',
  'email',
  'users keeps the verified email that C-Pay IDs derive from'
);

SELECT * FROM finish();

ROLLBACK;
