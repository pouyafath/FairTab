import { formatMoney } from '@/domain';

/** The text to send someone so they pay you back (FairTab's Interac e-Transfer message for CAD). */
export function paymentRequestMessage(amount: number, currency: string, recipientName: string, groupName: string) {
  const formatted = formatMoney(amount, currency, 'en-CA');
  return currency === 'CAD'
    ? `Please send ${formatted} to ${recipientName} via Interac e-Transfer for ${groupName} expenses.`
    : `Please send ${formatted} to ${recipientName} for ${groupName} expenses.`;
}
