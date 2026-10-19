jest.mock('react', () => ({
  useState: (initialValue: unknown) => [initialValue, jest.fn()],
  useRef: (initialValue: unknown) => ({ current: initialValue }),
}));

jest.mock('../../utils/biometric', () => ({
  getAuthenticatedWallet: jest.fn(),
}));
jest.mock('../../utils/cpayId', () => ({
  formatWalletFingerprint: jest.fn(() => 'G...TEST'),
}));
jest.mock('../../services/blockchain', () => ({
  transferTokens: jest.fn(),
}));
jest.mock('../../services/storage', () => ({
  saveTransaction: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../utils/alert', () => ({
  AlertManager: { alert: jest.fn() },
}));
jest.mock('../../utils/paymentFailure', () => ({
  getPaymentFailureCopy: jest.fn(() => ({
    errorMessage: 'Payment failed',
    errorReason: 'Try again',
    errorCode: 'NETWORK_ERROR',
    category: 'retryable',
  })),
}));

import { getAuthenticatedWallet } from '../../utils/biometric';
import { transferTokens } from '../../services/blockchain';
import { AlertManager } from '../../utils/alert';
import { usePaymentSubmission } from '../../hooks/usePaymentSubmission';

const mockedGetWallet = getAuthenticatedWallet as jest.Mock;
const mockedTransfer = transferTokens as jest.Mock;
const mockedAlert = AlertManager.alert as jest.Mock;

const createSubmission = () => {
  const navigation = { replace: jest.fn() };
  const getOrCreateIntent = jest.fn(() => 'retryable-intent-key');
  const clearIntent = jest.fn();
  const onReviewClose = jest.fn();
  const submission = usePaymentSubmission({
    navigation,
    amount: '12.50',
    recipientAddress: 'GRECIPIENT',
    recipientName: 'Recipient',
    recipientCPayId: 'recipient@cpay',
    walletAddress: 'GSENDER',
    note: 'Thanks',
    getOrCreateIntent,
    clearIntent,
  });
  return { ...submission, navigation, getOrCreateIntent, clearIntent, onReviewClose };
};

describe('usePaymentSubmission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetWallet.mockResolvedValue('unlocked-wallet');
    mockedTransfer.mockResolvedValue('transaction-hash');
  });

  test('routes through processing to success and submits with the intent key', async () => {
    const { executePayment, navigation, clearIntent, onReviewClose } = createSubmission();

    await executePayment(onReviewClose);

    expect(onReviewClose).toHaveBeenCalledTimes(1);
    expect(mockedTransfer).toHaveBeenCalledWith('unlocked-wallet', 'GRECIPIENT', '12.50', {
      note: 'Thanks',
      idempotencyKey: 'retryable-intent-key',
    });
    expect(navigation.replace.mock.calls.map(([screen]) => screen)).toEqual([
      'PaymentProcessing',
      'PaymentSuccess',
    ]);
    expect(clearIntent).toHaveBeenCalledTimes(1);
  });

  test('cancelled authentication alerts and does not navigate or clear the intent', async () => {
    mockedGetWallet.mockResolvedValueOnce(null);
    const { executePayment, navigation, clearIntent, onReviewClose } = createSubmission();

    await executePayment(onReviewClose);

    expect(onReviewClose).toHaveBeenCalledTimes(1);
    expect(mockedAlert).toHaveBeenCalledWith('Authentication Failed', 'Transaction cancelled');
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(clearIntent).not.toHaveBeenCalled();
    expect(mockedTransfer).not.toHaveBeenCalled();
  });

  test('routes failures to PaymentFailure with the reusable intent key', async () => {
    mockedTransfer.mockRejectedValueOnce(new Error('network unavailable'));
    const { executePayment, navigation, clearIntent, onReviewClose } = createSubmission();

    await executePayment(onReviewClose);

    expect(navigation.replace.mock.calls.map(([screen]) => screen)).toEqual([
      'PaymentProcessing',
      'PaymentFailure',
    ]);
    expect(navigation.replace).toHaveBeenLastCalledWith('PaymentFailure', expect.objectContaining({
      category: 'retryable',
      idempotencyKey: 'retryable-intent-key',
    }));
    expect(clearIntent).not.toHaveBeenCalled();
  });
});
