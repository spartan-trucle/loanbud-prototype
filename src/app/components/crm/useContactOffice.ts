import { useMemo } from "react";
import { useAppData } from "@/app/contexts/AppDataContext";
import type { Company, Contact } from "@/app/types";

/**
 * Resolves the Company acting as this contact's office, so the caller can hide the
 * whole section when there is none — frontend-hub gates on `!!office` the same way.
 *
 * Lives outside the component file so that file exports only components (the repo's
 * react-refresh lint rule runs at zero warnings).
 */
export function useContactOffice(contact: Contact): Company | undefined {
  const { companies } = useAppData();

  return useMemo(() => {
    if (contact.officeCompanyId) {
      return companies.find((c) => c.id === contact.officeCompanyId);
    }
    // Seeded contacts predate the explicit pointer: fall back to the partner company
    // that names this contact as its primary contact.
    return companies.find(
      (c) => c.companyType === "Partner" && c.primaryContactId === contact.id,
    );
  }, [companies, contact.officeCompanyId, contact.id]);
}
