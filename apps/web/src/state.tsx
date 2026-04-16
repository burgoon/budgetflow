import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Account,
  AppData,
  CashFlow,
  DateFormat,
  DEFAULT_DATE_FORMAT,
  Profile,
} from "./types";
import { loadAppData, saveAppData } from "./storage";
import { mergeAppData } from "./lib/dataExport";

interface AppContextValue {
  data: AppData;
  activeProfile: Profile | null;
  setActiveProfile: (id: string) => void;
  createProfile: (name: string) => Profile;
  updateProfile: (id: string, changes: Partial<Omit<Profile, "id" | "createdAt">>) => void;
  deleteProfile: (id: string) => void;
  createAccount: (input: Omit<Account, "id">) => Account;
  updateAccount: (id: string, changes: Partial<Omit<Account, "id" | "profileId">>) => void;
  deleteAccount: (id: string) => void;
  createCashFlow: (input: Omit<CashFlow, "id">) => CashFlow;
  updateCashFlow: (id: string, changes: Partial<Omit<CashFlow, "id" | "profileId">>) => void;
  deleteCashFlow: (id: string) => void;
  /** Wholesale replace — used by the import flow when the user picks
   *  "Replace all data". Caller is responsible for any confirmation UX. */
  replaceAllData: (data: AppData) => void;
  /** Apply the imported AppData on top of the existing one. All imported
   *  IDs are re-keyed so nothing collides with what's already there. */
  mergeImportedData: (imported: AppData) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadAppData());

  useEffect(() => {
    saveAppData(data);
  }, [data]);

  const activeProfile = useMemo<Profile | null>(
    () =>
      data.profiles.find((p) => p.id === data.activeProfileId) ?? data.profiles[0] ?? null,
    [data.profiles, data.activeProfileId],
  );

  const setActiveProfile = useCallback((id: string) => {
    setData((d) => ({ ...d, activeProfileId: id }));
  }, []);

  const createProfile = useCallback((name: string): Profile => {
    const profile: Profile = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      dateFormat: DEFAULT_DATE_FORMAT,
    };
    setData((d) => ({
      ...d,
      profiles: [...d.profiles, profile],
      activeProfileId: d.activeProfileId ?? profile.id,
    }));
    return profile;
  }, []);

  const updateProfile = useCallback(
    (id: string, changes: Partial<Omit<Profile, "id" | "createdAt">>) => {
      setData((d) => ({
        ...d,
        profiles: d.profiles.map((p) => (p.id === id ? { ...p, ...changes } : p)),
      }));
    },
    [],
  );

  const deleteProfile = useCallback((id: string) => {
    setData((d) => {
      const remaining = d.profiles.filter((p) => p.id !== id);
      return {
        ...d,
        profiles: remaining,
        accounts: d.accounts.filter((a) => a.profileId !== id),
        cashFlows: d.cashFlows.filter((c) => c.profileId !== id),
        activeProfileId:
          d.activeProfileId === id ? (remaining[0]?.id ?? null) : d.activeProfileId,
      };
    });
  }, []);

  const createAccount = useCallback((input: Omit<Account, "id">): Account => {
    const account: Account = { ...input, id: crypto.randomUUID() };
    setData((d) => ({ ...d, accounts: [...d.accounts, account] }));
    return account;
  }, []);

  const updateAccount = useCallback(
    (id: string, changes: Partial<Omit<Account, "id" | "profileId">>) => {
      setData((d) => ({
        ...d,
        accounts: d.accounts.map((a) => (a.id === id ? { ...a, ...changes } : a)),
      }));
    },
    [],
  );

  const deleteAccount = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      accounts: d.accounts.filter((a) => a.id !== id),
      cashFlows: d.cashFlows.map((c) =>
        c.accountId === id ? { ...c, accountId: null } : c,
      ),
    }));
  }, []);

  const createCashFlow = useCallback((input: Omit<CashFlow, "id">): CashFlow => {
    const cf: CashFlow = { ...input, id: crypto.randomUUID() };
    setData((d) => ({ ...d, cashFlows: [...d.cashFlows, cf] }));
    return cf;
  }, []);

  const updateCashFlow = useCallback(
    (id: string, changes: Partial<Omit<CashFlow, "id" | "profileId">>) => {
      setData((d) => ({
        ...d,
        cashFlows: d.cashFlows.map((c) => (c.id === id ? { ...c, ...changes } : c)),
      }));
    },
    [],
  );

  const deleteCashFlow = useCallback((id: string) => {
    setData((d) => ({ ...d, cashFlows: d.cashFlows.filter((c) => c.id !== id) }));
  }, []);

  const replaceAllData = useCallback((next: AppData) => {
    setData(next);
  }, []);

  const mergeImportedData = useCallback((imported: AppData) => {
    setData((d) => mergeAppData(d, imported));
  }, []);

  const value: AppContextValue = {
    data,
    activeProfile,
    setActiveProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    createAccount,
    updateAccount,
    deleteAccount,
    createCashFlow,
    updateCashFlow,
    deleteCashFlow,
    replaceAllData,
    mergeImportedData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

/**
 * Resolved date format for the active profile. Falls back to the global
 * default when the profile predates the field or no profile is active.
 */
export function useDateFormat(): DateFormat {
  const { activeProfile } = useApp();
  return activeProfile?.dateFormat ?? DEFAULT_DATE_FORMAT;
}
