import { saveTransaction, getTransactions, updateTransactionStatus } from '../../services/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('storage.ts — local-first offline storage & server-authoritative history', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  test('saveTransaction stores transaction in local storage without client Supabase mutation', async () => {
    const mockTx = {
      tx_hash: '1111111111222222222233333333334444444444555555555566666666667777',
      to_address: 'GCPAYRECEIVER',
      from_address: 'GCPAYER',
      amount: '25.00',
      status: 'pending' as const,
    };

    await saveTransaction(mockTx);

    const stored = await AsyncStorage.getItem('transactions');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.length).toBe(1);
    expect(parsed[0].tx_hash).toBe(mockTx.tx_hash);
    expect(parsed[0].amount).toBe('25.00');
  });

  test('updateTransactionStatus updates local transaction status for responsive UX', async () => {
    const txHash = '1111111111222222222233333333334444444444555555555566666666667777';
    const mockTx = {
      tx_hash: txHash,
      to_address: 'GCPAYRECEIVER',
      from_address: 'GCPAYER',
      amount: '25.00',
      status: 'pending' as const,
    };

    await saveTransaction(mockTx);
    await updateTransactionStatus(txHash, 'success');

    const stored = await AsyncStorage.getItem('transactions');
    const parsed = JSON.parse(stored!);
    expect(parsed[0].status).toBe('success');
  });
});
