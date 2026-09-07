export const HOTELS = [
  { id: "com.br", label: "Brasil / Portugal", flag: "🇧🇷" },
  { id: "com", label: "Internacional", flag: "🌍" },
  { id: "es", label: "Espanha", flag: "🇪🇸" },
  { id: "de", label: "Alemanha", flag: "🇩🇪" },
  { id: "fi", label: "Finlândia", flag: "🇫🇮" },
  { id: "fr", label: "França", flag: "🇫🇷" },
  { id: "it", label: "Itália", flag: "🇮🇹" },
  { id: "nl", label: "Holanda", flag: "🇳🇱" },
  { id: "com.tr", label: "Turquia", flag: "🇹🇷" },
] as const;

export type HotelId = (typeof HOTELS)[number]["id"];

export const DEFAULT_HOTEL: HotelId = "com.br";

export function hotelBaseUrl(hotel: string) {
  return `https://www.habbo.${hotel || DEFAULT_HOTEL}`;
}

export type AvatarOptions = {
  action?: string;
  direction?: number;
  headDirection?: number;
  gesture?: string;
  size?: "s" | "m" | "l";
  headOnly?: boolean;
  hotel?: string;
};

/** Habbo Imaging URL built from a nickname. */
export function avatarUrlByName(username: string, options: AvatarOptions = {}) {
  const {
    action = "std",
    direction = 2,
    headDirection = 2,
    gesture = "sml",
    size = "l",
    headOnly = false,
    hotel = DEFAULT_HOTEL,
  } = options;

  const params = new URLSearchParams({
    user: username,
    action,
    direction: String(direction),
    head_direction: String(headDirection),
    gesture,
    size,
  });
  if (headOnly) params.set("headonly", "1");

  return `${hotelBaseUrl(hotel)}/habbo-imaging/avatarimage?${params.toString()}`;
}

/** Habbo Imaging URL built from a stored figure string (look). */
export function avatarUrlByFigure(figure: string, options: AvatarOptions = {}) {
  const {
    action = "std",
    direction = 2,
    headDirection = 2,
    gesture = "sml",
    size = "l",
    headOnly = false,
    hotel = DEFAULT_HOTEL,
  } = options;

  const params = new URLSearchParams({
    figure,
    action,
    direction: String(direction),
    head_direction: String(headDirection),
    gesture,
    size,
  });
  if (headOnly) params.set("headonly", "1");

  return `${hotelBaseUrl(hotel)}/habbo-imaging/avatarimage?${params.toString()}`;
}

export const REACTIONS = [
  { type: "like", label: "Curti", icon: "👍" },
  { type: "bobba", label: "Bobba", icon: "🥤" },
  { type: "duck", label: "Pato", icon: "🦆" },
  { type: "diamond", label: "Diamante", icon: "💎" },
  { type: "lol", label: "Risada", icon: "😂" },
] as const;

export type ReactionType = (typeof REACTIONS)[number]["type"];

export function formatDateTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function timeAgo(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const diff = Math.round((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "agora mesmo";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `há ${Math.floor(diff / 86400)} d`;
  return formatDateTime(date);
}
