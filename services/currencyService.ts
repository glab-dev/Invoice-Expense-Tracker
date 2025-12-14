
import { CURRENCY_RATES } from '../constants';

/**
 * Converts an amount from a source currency to CAD.
 * This is a mock service. In a real app, you would fetch this from an API like ExchangeRate-API.
 * @param amount The amount in the source currency.
 * @param fromCurrency The 3-letter code of the source currency (e.g., 'USD').
 * @param date The date of the transaction (ignored in mock, but needed for real API).
 * @returns A promise that resolves to the amount in CAD.
 */
export const convertToCAD = async (amount: number, fromCurrency: string, date: string): Promise<number> => {
  console.log(`Converting ${amount} ${fromCurrency} to CAD for date ${date}`);
  const rate = CURRENCY_RATES[fromCurrency.toUpperCase()];
  
  if (!rate) {
    // If currency is unknown, assume it's already CAD or return the original amount
    return amount;
  }
  
  return Promise.resolve(amount * rate);
};
