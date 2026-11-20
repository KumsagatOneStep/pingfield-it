// Fixed lists for TMC acts. Text is printed on signed documents: keep it verbatim.

// Initial organizations; the list itself lives in tmc_orgs and the admin edits it on /acts.
// scripts/setup-db.mjs inserts the same strings, only into an empty table.
export const SEED_ORGS = ["ТОО «Орбита-Сервис»", "АО «Орбита Групп»", "ТОО «Орбита Логистик»"] as const;

export const TOP_DEPARTMENTS = [
  "Бухгалтерия",
  "IT-отдел",
  "Контроль качества",
  "Логистика",
  "Отдел закупок",
  "Отдел кадров",
  "Отдел продаж",
  "Охрана",
  "Производство",
  "Реклама и PR",
  "Руководство",
  "Склад",
  "Финансовый отдел",
  "Юридический отдел",
] as const;

// Subdivisions shown nested under their department in the form.
// The act prints only the subdivision's own name.
export const SUBDEPARTMENTS: Partial<Record<(typeof TOP_DEPARTMENTS)[number], readonly string[]>> = {
  "Финансовый отдел": ["Расчётный отдел", "Бухгалтерский учёт"],
};

// Every value the act may carry: departments and their subdivisions.
export const DEPARTMENTS: readonly string[] = TOP_DEPARTMENTS.flatMap((d) => [d, ...(SUBDEPARTMENTS[d] ?? [])]);

// Initial catalog; scripts/setup-db.mjs inserts the same strings.
export const SEED_ITEMS = [
  "Комплект Клавиатура + Мышь Rapoo NX2000, USB, Кол-во стандартных клавиш 104,1600",
  "USB HUB UGREEN 3.0 4 port  0.15m CM219",
  "Адаптер UGREEN USB-C - LAN RJ-45 10/100/1000 Mbps",
  "Батарея SVC AV7-12/S 12В 7Ач",
  "Блок питания 500 W",
  "Гарнитура проводная A4Tech Fstyler FH150U Black",
  "Кабель 3,5мм*1м",
  "Кабель 3,5мм*5м",
  "Кабель Dahua UTP cat 5e DH-PFM920-5EU 305м",
  "Кабель DisplayPort UGREEN 3м.",
  "Кабель HDMI 20 м",
  "Кабель SHIP UTP cat 5e D135-P 305м",
  "Кабель сетевой SHIP D135-VS Cat.5e UTP 30B PVC 305 м/б",
  "Карта бесконтактная FM11RF08-M1 Hikvision",
  "Клавиатура + Мышь XG XD-1100OUB",
  "Коммутатор TP-Link LS1008",
  "Коммутатор Tp-Link LS1008G",
  "Кулер ID-Cooling DK-01S",
  "Мышь беспроводная Rapoo M100",
  "Мышь беспроводная Rapoo M50 Plus Silent Black",
  "Мышь беспроводная Rapoo MT760L Black",
  "Мышь проводная Rapoo N100",
  "Накопитель 256GB",
  "Накопитель 480GB",
  "Переходник",
  "Проводной комплект клавиатура + мышь Rapoo X130PRO Black",
  "Разветвитель Type-C UGREEN CM219 4 Port USB 3.0",
  "Сетевая карта USB to LAN 1000Mbps Ugreen CR111",
  "Сетевая карта USB Type C to LAN 1000Mbps Ugreen CM199",
  "Сетевой фильтр SVC ZC6S-30M-USB/TypeC - 3м, 6 розеток, 1хUSB-A, 1хUSB-C, черный",
  "Сетевой фильтр SVC ZC6S-50M-USB/TypeC 5м.",
  "Сумка для ноутбука 15 6\" XG ELEMENT Prime черный",
  "Сумка для ноутбука 15 6* Defendar Life черный",
  "Сумка для ноутбука 15.6\" Portcase KCB-140BK, Black, Полиэстер",
  "Сумка для ноутбука 15\" UGREEN LP437 Gray",
  "Элемент питания AA Xiaomi ZMI AA501 Rainbow 5 (10шт в упак)",
  "Элемент питания AAA Xiaomi ZMI AA701 Rainbow 7 (10шт в упак.)",
] as const;
