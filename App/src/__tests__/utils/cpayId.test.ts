/**
 * Unit tests for cpayId utility functions.
 * These cover pure synchronous functions only; async DB-dependent helpers are excluded.
 */

import {
  generateCPayId,
  getWalletFingerprint,
  isValidCPayId,
  extractLast4FromCPayId,
} from '../../utils/cpayId';

// Fixed wallet address used across tests
const WALLET_A = 'GBGJS2UIEF2DYN3L67P2A7X62M4WK72JGTF7ABCOQL75UYHMWYLFRI4S';
const WALLET_B = 'GAKUELFFUKSAJMTECN2SVXDRJOUJXDE27OPTD57SA65KJ6AU32SXKF27';

describe('getWalletFingerprint', () => {
  test('returns a lowercase alphanumeric string of the requested length', () => {
    const fp = getWalletFingerprint(WALLET_A);
    expect(fp).toMatch(/^[a-z0-9]+$/);
    expect(fp.length).toBe(6);
  });

  test('is deterministic — same wallet always produces the same fingerprint', () => {
    expect(getWalletFingerprint(WALLET_A)).toBe(getWalletFingerprint(WALLET_A));
  });

  test('is case-insensitive — upper and lower-case wallet produce the same fingerprint', () => {
    expect(getWalletFingerprint(WALLET_A.toLowerCase())).toBe(
      getWalletFingerprint(WALLET_A.toUpperCase())
    );
  });

  test('different wallets produce different fingerprints', () => {
    expect(getWalletFingerprint(WALLET_A)).not.toBe(getWalletFingerprint(WALLET_B));
  });

  test('respects a custom length argument', () => {
    expect(getWalletFingerprint(WALLET_A, 4)).toHaveLength(4);
    expect(getWalletFingerprint(WALLET_A, 8)).toHaveLength(8);
  });
});

describe('generateCPayId', () => {
  test('creates expected format: handle@cpay<suffix>', () => {
    const id = generateCPayId('soumen0818@gmail.com', WALLET_A);
    expect(id).toMatch(/^[a-z0-9._-]+@cpay[a-z0-9]+$/);
  });

  test('uses the email local-part as the handle', () => {
    const id = generateCPayId('alice@example.com', WALLET_A);
    expect(id.startsWith('alice@cpay')).toBe(true);
  });

  test('strips email plus-tags from the handle', () => {
    const id = generateCPayId('alice+test@example.com', WALLET_A);
    expect(id.startsWith('alice@cpay')).toBe(true);
  });

  test('strips special characters from the handle except . _ -', () => {
    const id = generateCPayId('alice!#$@example.com', WALLET_A);
    expect(id.startsWith('alice@cpay')).toBe(true);
  });

  test('truncates overly long handles to 20 characters', () => {
    const longEmail = 'averylongemailhandle1234567890@example.com';
    const id = generateCPayId(longEmail, WALLET_A);
    const handle = id.split('@cpay')[0];
    expect(handle.length).toBeLessThanOrEqual(20);
  });

  test('falls back to "user" when the email local part is too short', () => {
    const id = generateCPayId('ab@example.com', WALLET_A);
    expect(id.startsWith('user@cpay')).toBe(true);
  });

  test('falls back to "user" for a non-email identifier (auth is email-only)', () => {
    const id = generateCPayId('+919876543210', WALLET_A);
    expect(id.startsWith('user@cpay')).toBe(true);
  });

  test('falls back to "user" when identifier is empty', () => {
    const id = generateCPayId('', WALLET_A);
    expect(id.startsWith('user@cpay')).toBe(true);
  });

  test('is deterministic — same inputs always produce the same ID', () => {
    const id1 = generateCPayId('test@example.com', WALLET_A);
    const id2 = generateCPayId('test@example.com', WALLET_A);
    expect(id1).toBe(id2);
  });

  test('different wallets produce different IDs for the same email', () => {
    const id1 = generateCPayId('test@example.com', WALLET_A);
    const id2 = generateCPayId('test@example.com', WALLET_B);
    expect(id1).not.toBe(id2);
  });
});

describe('isValidCPayId', () => {
  test('accepts a properly formed C-Pay ID', () => {
    expect(isValidCPayId('alice@cpayk8f3qz')).toBe(true);
    expect(isValidCPayId('soumen0818@cpayk8f3qz')).toBe(true);
  });

  test('accepts IDs with dots, underscores, and hyphens in the handle', () => {
    expect(isValidCPayId('first.last@cpayk8f3qz')).toBe(true);
    expect(isValidCPayId('user_name@cpayk8f3qz')).toBe(true);
    expect(isValidCPayId('user-name@cpayk8f3qz')).toBe(true);
  });

  test('rejects IDs without the @cpay separator', () => {
    expect(isValidCPayId('alice@gmail.com')).toBe(false);
    expect(isValidCPayId('alicecpayk8f3qz')).toBe(false);
  });

  test('rejects IDs where the handle is shorter than 3 characters', () => {
    expect(isValidCPayId('ab@cpayk8f3')).toBe(false);
  });

  test('rejects IDs where the suffix is shorter than 4 characters', () => {
    expect(isValidCPayId('alice@cpayab')).toBe(false);
  });

  test('rejects empty string', () => {
    expect(isValidCPayId('')).toBe(false);
  });

  test('rejects plain Stellar account IDs', () => {
    expect(isValidCPayId(WALLET_A)).toBe(false);
  });
});

describe('extractLast4FromCPayId', () => {
  test('extracts the suffix from a valid C-Pay ID', () => {
    const id = 'alice@cpayk8f3qz';
    expect(extractLast4FromCPayId(id)).toBe('k8f3qz');
  });

  test('returns null for a non-C-Pay ID string', () => {
    expect(extractLast4FromCPayId('alice@gmail.com')).toBeNull();
    expect(extractLast4FromCPayId('')).toBeNull();
  });
});
