import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';

export type BusinessType = 'salon' | 'spa' | 'clinic' | 'hospital' | 'gym' | 'general';

interface LabelMap {
  business: string;
  customers: string;
  services: string;
  team: string;
  appointments: string;
  storeName: string;
}

const LABEL_MAP: Record<BusinessType, LabelMap> = {
  salon: { business: 'Salon', customers: 'Clients', services: 'Services', team: 'Stylists', appointments: 'Appointments', storeName: 'Salon Name' },
  spa: { business: 'Spa', customers: 'Guests', services: 'Treatments', team: 'Therapists', appointments: 'Bookings', storeName: 'Spa Name' },
  clinic: { business: 'Clinic', customers: 'Patients', services: 'Procedures', team: 'Staff', appointments: 'Appointments', storeName: 'Clinic Name' },
  hospital: { business: 'Hospital', customers: 'Patients', services: 'Procedures', team: 'Staff', appointments: 'Appointments', storeName: 'Hospital Name' },
  gym: { business: 'Gym', customers: 'Members', services: 'Programs', team: 'Trainers', appointments: 'Sessions', storeName: 'Gym Name' },
  general: { business: 'Business', customers: 'Customers', services: 'Services', team: 'Team', appointments: 'Appointments', storeName: 'Business Name' },
};

interface BusinessTypeContextType {
  businessType: BusinessType;
  labels: LabelMap;
}

const BusinessTypeContext = createContext<BusinessTypeContextType>({
  businessType: 'salon',
  labels: LABEL_MAP.salon,
});

export const BusinessTypeProvider = ({ children }: { children: ReactNode }) => {
  const { profile } = useAuth();

  const businessType = useMemo((): BusinessType => {
    const stored = profile?.store_name?.toLowerCase() || '';
    if (stored.includes('clinic')) return 'clinic';
    if (stored.includes('hospital')) return 'hospital';
    if (stored.includes('spa')) return 'spa';
    if (stored.includes('gym') || stored.includes('fitness')) return 'gym';
    // Default to salon for Glamsup
    return 'salon';
  }, [profile?.store_name]);

  const labels = LABEL_MAP[businessType];

  return (
    <BusinessTypeContext.Provider value={{ businessType, labels }}>
      {children}
    </BusinessTypeContext.Provider>
  );
};

export const useBusinessType = () => useContext(BusinessTypeContext);
