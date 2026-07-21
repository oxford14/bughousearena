/**
 * Payout destination methods for coin redemptions (GCash, Maya, bank).
 * Bank list mirrors common Philippine InstaPay institutions.
 */

export type PayoutMethod = "gcash" | "maya" | "bank";

export const PH_BANKS = [
  "BDO Unibank",
  "BPI",
  "Metrobank",
  "Landbank",
  "PNB",
  "Security Bank",
  "UnionBank",
  "RCBC",
  "China Bank",
  "EastWest Bank",
  "AUB",
  "PSBank",
  "Robinsons Bank",
  "GoTyme",
  "Maribank",
  "Other",
] as const;

export type PhilippineBank = (typeof PH_BANKS)[number];

/** Maps our bank labels to PayMongo / InstaPay receiving institution names. */
export const BANK_TO_INSTAPAY_NAME: Record<string, string> = {
  "BDO Unibank": "BDO Unibank, Inc.",
  BPI: "Bank of the Philippine Islands / BPI Family",
  Metrobank: "Metropolitan Bank and Trust Company",
  Landbank: "Land Bank of The Philippines",
  PNB: "Philippine National Bank",
  "Security Bank": "Security Bank Corporation",
  UnionBank: "Union Bank of the Philippines",
  RCBC: "Rizal Commercial Banking Corporation",
  "China Bank": "China Banking Corporation",
  "EastWest Bank": "East West Banking Corporation",
  AUB: "Asia United Bank Corporation",
  PSBank: "Philippine Savings Bank",
  "Robinsons Bank": "Robinsons Bank Corporation",
  GoTyme: "GoTyme Bank Corporation",
  Maribank: "MariBank Philippines, Inc.",
};

export const INSTAPAY_GCASH_NAME = "G-Xchange, Inc.";
export const INSTAPAY_MAYA_NAME = "Maya Philippines, Inc.";

export interface PayoutMethodConfig {
  value: PayoutMethod;
  label: string;
  numberLabel: string;
  nameLabel: string;
  placeholder: string;
  hint: string;
  digits?: number;
  minDigits?: number;
  maxDigits?: number;
  requiresBank: boolean;
}

export const PAYOUT_METHODS: PayoutMethodConfig[] = [
  {
    value: "gcash",
    label: "GCash",
    numberLabel: "GCash mobile number",
    nameLabel: "GCash account name",
    placeholder: "09XX XXX XXXX",
    hint: "11-digit Philippine mobile number starting with 09",
    digits: 11,
    requiresBank: false,
  },
  {
    value: "maya",
    label: "Maya",
    numberLabel: "Maya mobile number",
    nameLabel: "Maya account name",
    placeholder: "09XX XXX XXXX",
    hint: "11-digit Philippine mobile number starting with 09",
    digits: 11,
    requiresBank: false,
  },
  {
    value: "bank",
    label: "Bank account",
    numberLabel: "Account number",
    nameLabel: "Account name",
    placeholder: "Enter bank account number",
    hint: "10–12 digit account number from your bank",
    minDigits: 10,
    maxDigits: 12,
    requiresBank: true,
  },
];

export function getPayoutMethodConfig(
  method: string
): PayoutMethodConfig | undefined {
  return PAYOUT_METHODS.find((m) => m.value === method);
}

export function stripAccountDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatPayoutAccountNumber(
  method: PayoutMethod,
  raw: string
): string {
  const digits = stripAccountDigits(raw);
  const config = getPayoutMethodConfig(method);
  if (!config) return raw.trim();

  if (method === "gcash" || method === "maya") {
    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 11)}`;
  }

  return digits;
}

export function validatePayoutAccountNumber(
  method: PayoutMethod,
  accountNumber: string
): string | null {
  const config = getPayoutMethodConfig(method);
  if (!config) return "Invalid payout method.";

  const digits = stripAccountDigits(accountNumber);

  if (method === "gcash" || method === "maya") {
    if (digits.length !== (config.digits ?? 11)) {
      return `${config.numberLabel} must be exactly ${config.digits} digits.`;
    }
    if (!digits.startsWith("09")) {
      return "Philippine mobile numbers must start with 09.";
    }
    return null;
  }

  const min = config.minDigits ?? 10;
  const max = config.maxDigits ?? 12;
  if (digits.length < min || digits.length > max) {
    return `${config.numberLabel} must be ${min}-${max} digits.`;
  }
  return null;
}

export function validatePayoutBankName(
  method: PayoutMethod,
  bankName?: string | null
): string | null {
  const config = getPayoutMethodConfig(method);
  if (!config?.requiresBank) return null;
  if (!bankName?.trim()) return "Select your bank.";
  return null;
}

export function validatePayoutDestination(input: {
  method: PayoutMethod;
  accountName: string;
  accountNumber: string;
  bankName?: string | null;
}): string | null {
  if (!input.accountName.trim()) return "Account name is required.";
  const bankError = validatePayoutBankName(input.method, input.bankName);
  if (bankError) return bankError;
  return validatePayoutAccountNumber(input.method, input.accountNumber);
}

export function getDigitProgress(
  method: PayoutMethod,
  accountNumber: string
): { current: number; label: string; complete: boolean } {
  const config = getPayoutMethodConfig(method);
  const current = stripAccountDigits(accountNumber).length;
  if (!config) return { current, label: "", complete: false };

  if (config.digits) {
    return {
      current,
      label: `${current}/${config.digits}`,
      complete: current === config.digits,
    };
  }

  const min = config.minDigits ?? 10;
  const max = config.maxDigits ?? 12;
  return {
    current,
    label: `${current} (${min}-${max})`,
    complete: current >= min && current <= max,
  };
}

/** Human-readable destination for PayMongo institution matching. */
export function resolveInstapayInstitutionName(input: {
  method: PayoutMethod;
  bankName?: string | null;
}): string {
  if (input.method === "gcash") return INSTAPAY_GCASH_NAME;
  if (input.method === "maya") return INSTAPAY_MAYA_NAME;
  const bank = input.bankName?.trim() ?? "";
  return BANK_TO_INSTAPAY_NAME[bank] ?? bank;
}

export function formatPayoutMethodLabel(
  method: string | null | undefined,
  bankName?: string | null
): string {
  if (method === "maya") return "Maya";
  if (method === "bank") return bankName?.trim() ? `Bank · ${bankName}` : "Bank";
  return "GCash";
}
