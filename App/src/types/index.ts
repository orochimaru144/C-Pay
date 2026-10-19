export interface Transaction {
  id?: string;
  user_id?: string;
  tx_hash: string;
  to_address: string;
  amount: string;
  status: 'pending' | 'success' | 'failed';
  created_at?: string;
}

export interface QRPaymentData {
  type: 'cryptopay';
  recipient: string;
  amount?: string;
  name?: string;
}
