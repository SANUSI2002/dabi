import type { EquipmentCategory } from "@/data/equipment";

export type TelemetryParamDef = {
  key: string;
  label: string;
  unit: string;
  min: number; // plausible operating floor, used to bound the simulator
  max: number; // plausible operating ceiling
  normalMin: number;
  normalMax: number;
  warningMax?: number; // beyond normalMax but below critical
  criticalMax?: number;
  warningMin?: number; // below normalMin but above critical
  criticalMin?: number;
};

// One parameter set per monitored category. Values are illustrative reference ranges for
// simulation purposes, not a validated clinical/engineering threshold table — see the
// "not medically validated" disclosure on the Telemetry tab.
export const TELEMETRY_PARAMS: Record<EquipmentCategory, TelemetryParamDef[]> = {
  "Laboratory Analyzer": [
    { key: "throughput", label: "Throughput", unit: "tests/hr", min: 0, max: 120, normalMin: 10, normalMax: 100 },
    { key: "reagentTemp", label: "Reagent Temperature", unit: "°C", min: 0, max: 40, normalMin: 4, normalMax: 8, warningMax: 10, criticalMax: 15 },
  ],
  "Radiology Imaging": [
    { key: "tubeTemp", label: "Tube Temperature", unit: "°C", min: 15, max: 90, normalMin: 20, normalMax: 55, warningMax: 65, criticalMax: 80 },
    { key: "exposures", label: "Exposures Today", unit: "count", min: 0, max: 200, normalMin: 0, normalMax: 200 },
  ],
  "ICU Device": [
    { key: "fio2", label: "FiO2", unit: "%", min: 21, max: 100, normalMin: 21, normalMax: 60, warningMax: 80, criticalMax: 100 },
    { key: "peep", label: "PEEP", unit: "cmH2O", min: 0, max: 20, normalMin: 4, normalMax: 10, warningMax: 14, criticalMax: 18 },
    { key: "respRate", label: "Respiratory Rate", unit: "/min", min: 5, max: 40, normalMin: 12, normalMax: 20, warningMax: 28, criticalMax: 35 },
    { key: "spo2", label: "SpO2", unit: "%", min: 60, max: 100, normalMin: 94, normalMax: 100, warningMin: 90, criticalMin: 85 },
    { key: "hr", label: "Heart Rate", unit: "bpm", min: 30, max: 200, normalMin: 60, normalMax: 100, warningMax: 130, criticalMax: 160, warningMin: 50, criticalMin: 40 },
  ],
  "Theatre Equipment": [
    { key: "power", label: "Output Power", unit: "W", min: 0, max: 300, normalMin: 0, normalMax: 200, warningMax: 250, criticalMax: 290 },
  ],
  "Dialysis Equipment": [
    { key: "bloodFlow", label: "Blood Flow", unit: "mL/min", min: 0, max: 500, normalMin: 200, normalMax: 400, warningMin: 150, criticalMin: 100 },
    { key: "dialysateFlow", label: "Dialysate Flow", unit: "mL/min", min: 0, max: 1000, normalMin: 400, normalMax: 800 },
    { key: "ufRate", label: "UF Rate", unit: "mL/hr", min: 0, max: 2000, normalMin: 0, normalMax: 1000, warningMax: 1500, criticalMax: 1800 },
    { key: "conductivity", label: "Conductivity", unit: "mS/cm", min: 10, max: 16, normalMin: 13, normalMax: 15, warningMax: 15.5, criticalMax: 16 },
  ],
  "Pharmacy Cold Chain": [
    { key: "temperature", label: "Temperature", unit: "°C", min: -5, max: 20, normalMin: 2, normalMax: 8, warningMax: 10, criticalMax: 12, warningMin: 1, criticalMin: -1 },
    { key: "doorOpenSec", label: "Door Open Duration", unit: "sec", min: 0, max: 600, normalMin: 0, normalMax: 30, warningMax: 90, criticalMax: 180 },
  ],
  "Generator": [
    { key: "voltage", label: "Voltage", unit: "V", min: 180, max: 260, normalMin: 220, normalMax: 240, warningMin: 210, criticalMin: 200, warningMax: 245, criticalMax: 250 },
    { key: "frequency", label: "Frequency", unit: "Hz", min: 45, max: 55, normalMin: 49.5, normalMax: 50.5, warningMax: 51, criticalMax: 52, warningMin: 49, criticalMin: 48 },
    { key: "fuel", label: "Fuel Level", unit: "%", min: 0, max: 100, normalMin: 30, normalMax: 100, warningMin: 20, criticalMin: 10 },
    { key: "oilPressure", label: "Oil Pressure", unit: "bar", min: 0, max: 6, normalMin: 2, normalMax: 4.5, warningMin: 1.5, criticalMin: 1 },
    { key: "engineTemp", label: "Engine Temperature", unit: "°C", min: 40, max: 130, normalMin: 70, normalMax: 95, warningMax: 105, criticalMax: 115 },
  ],
  "HVAC": [
    { key: "supplyTemp", label: "Supply Temperature", unit: "°C", min: 10, max: 30, normalMin: 18, normalMax: 22, warningMax: 24, criticalMax: 27 },
    { key: "humidity", label: "Humidity", unit: "%RH", min: 20, max: 80, normalMin: 40, normalMax: 60, warningMax: 65, criticalMax: 70 },
  ],
  "Medical Gas": [
    { key: "o2Pressure", label: "Oxygen Pressure", unit: "bar", min: 0, max: 6, normalMin: 3.5, normalMax: 4.5, warningMin: 3, criticalMin: 2.5 },
    { key: "vacuumPressure", label: "Vacuum Pressure", unit: "kPa", min: -80, max: 0, normalMin: -60, normalMax: -40, warningMax: -30, criticalMax: -20 },
    { key: "tankLevel", label: "Tank Level", unit: "%", min: 0, max: 100, normalMin: 30, normalMax: 100, warningMin: 20, criticalMin: 10 },
  ],
  "Water Treatment": [
    { key: "tankLevel", label: "Tank Level", unit: "%", min: 0, max: 100, normalMin: 30, normalMax: 100, warningMin: 20, criticalMin: 10 },
    { key: "pressure", label: "Line Pressure", unit: "bar", min: 0, max: 6, normalMin: 2, normalMax: 4, warningMin: 1, criticalMin: 0.5 },
  ],
  "Solar / Inverter": [
    { key: "battery", label: "Battery", unit: "%", min: 0, max: 100, normalMin: 40, normalMax: 100, warningMin: 25, criticalMin: 10 },
    { key: "outputVoltage", label: "Output Voltage", unit: "V", min: 180, max: 260, normalMin: 220, normalMax: 240 },
  ],
  "Elevator": [
    { key: "cycles", label: "Cycles Today", unit: "count", min: 0, max: 500, normalMin: 0, normalMax: 400 },
  ],
  "Other Infrastructure": [
    { key: "status", label: "Signal", unit: "", min: 0, max: 100, normalMin: 40, normalMax: 100 },
  ],
};

export type TelemetrySeverity = "Normal" | "Warning" | "Critical";

export function severityFor(def: TelemetryParamDef, value: number): TelemetrySeverity {
  if (def.criticalMax !== undefined && value >= def.criticalMax) return "Critical";
  if (def.criticalMin !== undefined && value <= def.criticalMin) return "Critical";
  if (def.warningMax !== undefined && value >= def.warningMax) return "Warning";
  if (def.warningMin !== undefined && value <= def.warningMin) return "Warning";
  if (value > def.normalMax || value < def.normalMin) return "Warning";
  return "Normal";
}

export type TelemetryReading = { key: string; value: number; at: string; severity: TelemetrySeverity };

export type TelemetryHistoryPoint = { at: string; value: number };
