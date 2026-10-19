'use strict';

const StellarSdk = require('@stellar/stellar-sdk');
const { KeyManager } = require('../keyManager');

describe('KeyManager custody and signer abstraction (Issue #22, #117)', () => {
  const sponsorKeypair = StellarSdk.Keypair.random();
  const distributionKeypair = StellarSdk.Keypair.random();

  test('registers and provides signers from configuration', () => {
    const km = new KeyManager({
      sponsorSecret: sponsorKeypair.secret(),
      distributionSecret: distributionKeypair.secret(),
    });

    const sponsorSigner = km.getSigner('sponsor');
    const distributionSigner = km.getSigner('distribution');

    expect(sponsorSigner.publicKey()).toBe(sponsorKeypair.publicKey());
    expect(distributionSigner.publicKey()).toBe(distributionKeypair.publicKey());
    expect(km.getPublicKey('sponsor')).toBe(sponsorKeypair.publicKey());
    expect(km.getPublicKey('distribution')).toBe(distributionKeypair.publicKey());
  });

  test('throws when requesting unregistered signer role', () => {
    const km = new KeyManager({});
    expect(() => km.getSigner('unknown')).toThrow("Signer for role 'unknown' is not registered");
  });

  test('signs transactions and records activity logs', () => {
    const km = new KeyManager({
      sponsorSecret: sponsorKeypair.secret(),
    });

    const account = new StellarSdk.Account(sponsorKeypair.publicKey(), '100');
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: 100,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .setTimeout(30)
      .build();

    km.sign('sponsor', tx);

    const status = km.getStatus();
    expect(status.totalActivityLogs).toBe(1);
    expect(status.signers.sponsor.publicKey).toBe(sponsorKeypair.publicKey());
  });

  test('throws informative error for KMS/Vault driver tracking it as mainnet launch gate', () => {
    const prevProvider = process.env.SIGNER_PROVIDER;
    try {
      process.env.SIGNER_PROVIDER = 'kms';
      expect(() => {
        new KeyManager({
          sponsorSecret: 'kms://arn:aws:kms:us-east-1:123456789012:key/test-sponsor',
        });
      }).toThrow(/mainnet launch gate/i);
    } finally {
      process.env.SIGNER_PROVIDER = prevProvider || 'env';
    }
  });

  test('supports dynamic zero-downtime key rotation', () => {
    const km = new KeyManager({
      sponsorSecret: sponsorKeypair.secret(),
    });

    const newKeypair = StellarSdk.Keypair.random();
    km.rotateKey('sponsor', newKeypair.secret());

    expect(km.getSigner('sponsor').publicKey()).toBe(newKeypair.publicKey());
    const status = km.getStatus();
    expect(status.signers.sponsor.publicKey).toBe(newKeypair.publicKey());
  });

  test('triggers warning and alert dispatch when velocity exceeds threshold', async () => {
    let alertDispatched = null;
    const km = new KeyManager({
      sponsorSecret: sponsorKeypair.secret(),
    });
    km.maxSignsPerMinute = 2;
    km.sendAlert = async (payload) => {
      alertDispatched = payload;
    };

    const account = new StellarSdk.Account(sponsorKeypair.publicKey(), '100');
    const makeTx = () =>
      new StellarSdk.TransactionBuilder(account, {
        fee: 100,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .setTimeout(30)
        .build();

    km.sign('sponsor', makeTx());
    km.sign('sponsor', makeTx());
    expect(alertDispatched).toBeNull();

    km.sign('sponsor', makeTx());
    expect(alertDispatched).toMatchObject({
      event: 'SIGNING_VELOCITY_ALARM',
      role: 'sponsor',
      threshold: 2,
    });
  });
});
