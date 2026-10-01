export type TravelMode = 'FLIGHT' | 'TRAIN' | 'ROAD' | 'BUS' | 'OTHER';
export const TRAVEL_MODES: TravelMode[] = ['FLIGHT', 'TRAIN', 'ROAD', 'BUS', 'OTHER'];
export const MODE_ICON: Record<TravelMode, string> = { FLIGHT: '✈️', TRAIN: '🚆', ROAD: '🚗', BUS: '🚌', OTHER: '🧳' };

export interface Stay {
  hotelName: string;
  address: string | null;
  mapUrl: string | null;
  roomNumber: string | null;
  roomType: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  notes: string | null;
}

export interface Travel {
  direction: 'ARRIVAL' | 'DEPARTURE';
  mode: TravelMode;
  carrier: string | null;
  reference: string | null;
  at: string;
  place: string | null;
  travellers: number;
  pickupRequested: boolean;
  pickupNote: string | null;
  enteredByGuest: boolean;
}

export interface LogisticsGuest {
  id: string;
  name: string;
  phone: string | null;
  isVip: boolean;
  dietary: string | null;
  stay: Stay | null;
  arrival: Travel | null;
  departure: Travel | null;
}

export interface LogisticsBoard {
  settings: { collectGuestTravel: boolean; timezone: string };
  summary: {
    guests: number;
    vip: number;
    dietary: number;
    withStay: number;
    arrivals: number;
    departures: number;
    pickupTravellers: number;
    dropTravellers: number;
    hotels: Array<{ hotelName: string; guests: number }>;
  };
  guests: LogisticsGuest[];
}

export interface SeatingPlan {
  function: { id: string; name: string; startsAt: string | null };
  seats: Array<{ guestId: string; tableLabel: string; seatLabel: string | null }>;
  guests: Array<{ id: string; name: string; isVip: boolean; dietary: string | null; invited: boolean; rsvp: { status: string; attendeeCount: number } | null }>;
}
