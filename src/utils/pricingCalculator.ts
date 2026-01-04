import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, format } from 'date-fns';

export interface PricingBreakdown {
  totalHours: number;
  freeHours: number;
  chargeableHours: number;
  baseCharge: number; // ₹10/hour after free hours
  isFreeDayEligible: boolean;
  isFreeDayUsed: boolean;
  totalAmount: number;
}

export interface PenaltyBreakdown {
  overstayHours: number;
  penaltyAmount: number; // ₹30/hour for overstay
  baseAmount: number;
  totalWithPenalty: number;
}

const FREE_HOURS_PER_DAY = 4;
const HOURLY_RATE = 10; // ₹10 per hour after free hours
const PENALTY_RATE = 30; // ₹30 per hour for overstay

export async function checkFreeDayEligibility(
  vehicleId: string,
  userId: string,
  bookingDate: Date
): Promise<{ eligible: boolean; used: boolean }> {
  const weekStart = startOfWeek(bookingDate, { weekStartsOn: 1 }); // Monday
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  const { data } = await supabase
    .from('vehicle_free_day_usage')
    .select('id')
    .eq('vehicle_id', vehicleId)
    .eq('week_start', weekStartStr)
    .maybeSingle();

  return {
    eligible: true,
    used: !!data,
  };
}

export async function markFreeDayUsed(
  vehicleId: string,
  userId: string,
  bookingDate: Date,
  bookingId?: string
): Promise<boolean> {
  const weekStart = startOfWeek(bookingDate, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  const { error } = await supabase.from('vehicle_free_day_usage').insert({
    vehicle_id: vehicleId,
    user_id: userId,
    week_start: weekStartStr,
    booking_id: bookingId,
  });

  return !error;
}

export function calculateBookingPrice(
  durationHours: number,
  useFreeDayBenefit: boolean = false
): PricingBreakdown {
  // Free hours apply per day (first 4 hours free)
  const freeHours = Math.min(durationHours, FREE_HOURS_PER_DAY);
  
  // If using free day benefit, entire day is free
  if (useFreeDayBenefit) {
    return {
      totalHours: durationHours,
      freeHours: durationHours,
      chargeableHours: 0,
      baseCharge: 0,
      isFreeDayEligible: true,
      isFreeDayUsed: true,
      totalAmount: 0,
    };
  }

  const chargeableHours = Math.max(0, durationHours - FREE_HOURS_PER_DAY);
  const baseCharge = chargeableHours * HOURLY_RATE;

  return {
    totalHours: durationHours,
    freeHours: FREE_HOURS_PER_DAY,
    chargeableHours,
    baseCharge,
    isFreeDayEligible: false,
    isFreeDayUsed: false,
    totalAmount: baseCharge,
  };
}

export function calculatePenalty(
  bookedHours: number,
  actualHours: number,
  originalAmount: number
): PenaltyBreakdown {
  const overstayHours = Math.max(0, actualHours - bookedHours);
  const penaltyAmount = overstayHours * PENALTY_RATE;

  return {
    overstayHours,
    penaltyAmount,
    baseAmount: originalAmount,
    totalWithPenalty: originalAmount + penaltyAmount,
  };
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(0)}`;
}

export const PRICING_INFO = {
  FREE_HOURS_PER_DAY,
  HOURLY_RATE,
  PENALTY_RATE,
};
