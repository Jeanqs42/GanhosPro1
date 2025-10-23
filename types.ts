export interface RunRecord {
  id: string;
  date: string;
  totalEarnings: number;
  kmDriven: number;
  hoursWorked?: number;
  additionalCosts?: number;
}

export interface AppSettings {
  costPerKm: number;
}

export interface CalculationResult {
  totalEarnings: number;
  grossEarningsPerKm: number;
  grossProfit: number;
  carCost: number;
  netProfit: number;
  profitPerKm: number;
  profitPerHour: number;
  grossEarningsPerHour: number; // Novo campo
}