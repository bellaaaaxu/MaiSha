const STORAGE_KEY = 'maisha:currency';

export interface CurrencyConfig {
  code: string;
  symbol: string;
}

const CURRENCIES: CurrencyConfig[] = [
  { code: 'CNY', symbol: '¥' },
  { code: 'CAD', symbol: 'CA$' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'JPY', symbol: '¥' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'HKD', symbol: 'HK$' },
  { code: 'TWD', symbol: 'NT$' },
  { code: 'SGD', symbol: 'S$' },
];

export function getAllCurrencies(): CurrencyConfig[] {
  return CURRENCIES;
}

function detectDefault(): CurrencyConfig {
  const lang = navigator.language?.toLowerCase() ?? '';
  if (lang.startsWith('zh-cn')) return CURRENCIES[0]; // CNY
  if (lang.includes('ca')) return CURRENCIES[1]; // CAD
  if (lang.startsWith('en-us') || lang === 'en') return CURRENCIES[2]; // USD
  if (lang.startsWith('zh-tw')) return CURRENCIES[8]; // TWD
  if (lang.startsWith('zh-hk')) return CURRENCIES[7]; // HKD
  if (lang.startsWith('ja')) return CURRENCIES[5]; // JPY
  return CURRENCIES[0]; // default CNY
}

export function getSavedCurrency(): CurrencyConfig | null {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  return CURRENCIES.find(c => c.code === saved) ?? null;
}

export function getOrDetectCurrency(): CurrencyConfig {
  return getSavedCurrency() ?? detectDefault();
}

export function saveCurrency(code: string): void {
  localStorage.setItem(STORAGE_KEY, code);
}

export function formatAmount(amount: number, currency?: CurrencyConfig): string {
  const c = currency ?? getOrDetectCurrency();
  if (c.code === 'JPY') return `${c.symbol}${Math.round(amount)}`;
  return `${c.symbol}${amount.toFixed(2)}`;
}
