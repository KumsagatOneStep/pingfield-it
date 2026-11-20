// Places cartridges move between. Stored as text in cartridge_moves: keep the spelling.
export const HUB = "Головной офис";
export const CONTRACTOR = "Сервис-партнёр";
export const OBJECTS = ["Склад Север", "Склад Юг", "Филиал Восток"] as const;
export const PLACES: readonly string[] = [HUB, ...OBJECTS, CONTRACTOR];

export const MAX_MOVE_LINES = 20;
