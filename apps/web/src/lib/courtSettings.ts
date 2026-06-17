const SETTINGS_KEY = "haff-court-settings";

export type CourtSetting = { enabled: boolean; openingTime: string; closingTime: string };
export type CourtSettings = Record<string, CourtSetting>;

export const DEFAULT_COURT_SETTING: CourtSetting = {
  enabled: true,
  openingTime: "06:00",
  closingTime: "22:00"
};

export const getCourtSettings = (): CourtSettings => {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
  } catch {
    return {};
  }
};

export const saveCourtSettings = (settings: CourtSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const getCourtSetting = (courtId: string): CourtSetting =>
  getCourtSettings()[courtId] ?? DEFAULT_COURT_SETTING;

export const updateCourtSetting = (courtId: string, patch: Partial<CourtSetting>) => {
  const next = { ...getCourtSettings(), [courtId]: { ...getCourtSetting(courtId), ...patch } };
  saveCourtSettings(next);
  return next;
};
