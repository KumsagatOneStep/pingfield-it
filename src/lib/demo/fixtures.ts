// Fictional demo content for the company "Орбита". Every name here is made up.
import { CONTRACTOR, HUB } from "../cartridges/constants.ts";

export const VIEWER = { username: "petrova", fullName: "Анна Петрова", actName: "Петрова А. С.", position: "Бухгалтер" };

export const CARTRIDGE_MODELS = ["HP 59A (CF259A)", "HP 85A (CE285A)", "Kyocera TK-1170", "Kyocera TK-3160", "Canon 737", "Xerox 106R02773"];

/** daysAgo is relative to the moment of the reset. Lines: [model, qty, writtenOff]. */
export type MoveFixture = { daysAgo: number; from: string; to: string; note: string; by: 1 | 2; lines: [string, number, number][] };
export const MOVES: MoveFixture[] = [
  { daysAgo: 20, from: "Склад Север", to: HUB, note: "пустые с северного склада", by: 1, lines: [["Kyocera TK-1170", 4, 0], ["HP 85A (CE285A)", 2, 0]] },
  { daysAgo: 19, from: "Склад Юг", to: HUB, note: "", by: 1, lines: [["HP 59A (CF259A)", 3, 0]] },
  { daysAgo: 18, from: HUB, to: CONTRACTOR, note: "на заправку, накладная № 41", by: 1, lines: [["Kyocera TK-1170", 4, 0], ["HP 85A (CE285A)", 2, 0], ["HP 59A (CF259A)", 3, 0]] },
  { daysAgo: 12, from: CONTRACTOR, to: HUB, note: "вернули после заправки", by: 2, lines: [["Kyocera TK-1170", 3, 1], ["HP 85A (CE285A)", 2, 0], ["HP 59A (CF259A)", 3, 0]] },
  { daysAgo: 11, from: HUB, to: "Склад Север", note: "заправленные", by: 1, lines: [["Kyocera TK-1170", 3, 0]] },
  { daysAgo: 9, from: "Филиал Восток", to: HUB, note: "", by: 1, lines: [["Canon 737", 2, 0], ["Kyocera TK-3160", 1, 0]] },
  { daysAgo: 8, from: HUB, to: CONTRACTOR, note: "Canon — ремонт чипа", by: 1, lines: [["Canon 737", 2, 0], ["Kyocera TK-3160", 1, 0]] },
  { daysAgo: 4, from: "Склад Юг", to: HUB, note: "", by: 2, lines: [["Xerox 106R02773", 2, 0], ["HP 59A (CF259A)", 1, 0]] },
  { daysAgo: 3, from: HUB, to: "Склад Юг", note: "заправленные", by: 1, lines: [["HP 59A (CF259A)", 3, 0]] },
  { daysAgo: 1, from: HUB, to: CONTRACTOR, note: "на заправку, накладная № 57", by: 1, lines: [["Xerox 106R02773", 2, 0], ["HP 59A (CF259A)", 1, 0]] },
];

/** Lines: [item name from SEED_ITEMS, inventory number, serial number, qty]. */
export type ActFixture = {
  daysAgo: number; org: string; recipientName: string; recipientPosition: string; department: string; note: string; by: 1 | 2;
  lines: [string, string, string, number][];
};
export const ACTS: ActFixture[] = [
  { daysAgo: 21, org: "АО «Орбита Групп»", recipientName: "Козлов Д. А.", recipientPosition: "Менеджер по продажам", department: "Отдел продаж", note: "новый сотрудник", by: 1,
    lines: [["Проводной комплект клавиатура + мышь Rapoo X130PRO Black", "ОР-00412", "", 1], ["Гарнитура проводная A4Tech Fstyler FH150U Black", "", "", 1]] },
  { daysAgo: 15, org: "ТОО «Орбита Логистик»", recipientName: "Сулейменов А. Б.", recipientPosition: "Кладовщик", department: "Склад", note: "", by: 1,
    lines: [["Сетевой фильтр SVC ZC6S-50M-USB/TypeC 5м.", "", "", 2], ["Мышь проводная Rapoo N100", "", "", 1]] },
  { daysAgo: 10, org: "АО «Орбита Групп»", recipientName: "Петрова А. С.", recipientPosition: "Бухгалтер", department: "Бухгалтерия", note: "замена сломанной мыши", by: 2,
    lines: [["Мышь беспроводная Rapoo M100", "ОР-00433", "", 1]] },
  { daysAgo: 6, org: "ТОО «Орбита-Сервис»", recipientName: "Ким В. Л.", recipientPosition: "Инженер", department: "Производство", note: "", by: 1,
    lines: [["Сумка для ноутбука 15\" UGREEN LP437 Gray", "", "", 1], ["Адаптер UGREEN USB-C - LAN RJ-45 10/100/1000 Mbps", "ОР-00451", "", 1], ["Накопитель 480GB", "ОР-00452", "S4X1NF0R123456", 1]] },
  { daysAgo: 2, org: "АО «Орбита Групп»", recipientName: "Нурланова Г. К.", recipientPosition: "Юрист", department: "Юридический отдел", note: "", by: 1,
    lines: [["Комплект Клавиатура + Мышь Rapoo NX2000, USB, Кол-во стандартных клавиш 104,1600", "ОР-00460", "", 1]] },
];

export type ArticleFixture = {
  daysAgo: number; title: string; symptom: string; cause: string; prerequisites: string; solution: string; tags: string[]; archived?: boolean; by: 1 | 2;
};
export const ARTICLES: ArticleFixture[] = [
  {
    daysAgo: 30, by: 1, tags: ["принтеры", "сеть"],
    title: "Принтер пропал из сети после отключения света",
    symptom: "Печать висит в очереди, принтер не пингуется по своему адресу.",
    cause: "Принтер получил другой адрес по DHCP, а на компьютерах настроен старый.",
    prerequisites: "Доступ к панели принтера, адрес из реестра Pingfield.",
    solution: "1. На панели принтера откройте **Сеть → TCP/IP** и посмотрите текущий адрес.\n2. Задайте статический адрес из реестра (маска `255.255.255.0`, шлюз `10.20.0.1`).\n3. Проверьте с компьютера: `ping 10.20.0.N`.\n4. Если адрес новый — обновите запись в реестре.",
  },
  {
    daysAgo: 25, by: 2, tags: ["принтеры"],
    title: "Полосы на печати у Kyocera",
    symptom: "Вертикальные серые полосы по всей странице.",
    cause: "Грязный коротрон или заканчивается тонер.",
    prerequisites: "",
    solution: "1. Откройте переднюю крышку и несколько раз проведите зелёной ручкой очистки коротрона.\n2. Напечатайте тестовую страницу.\n3. Не помогло — замените картридж и отметьте старый в разделе **Картриджи**.",
  },
  {
    daysAgo: 18, by: 1, tags: ["почта"],
    title: "Outlook постоянно спрашивает пароль",
    symptom: "Окно ввода пароля появляется каждые несколько минут.",
    cause: "Устаревшие сохранённые учётные данные после смены пароля.",
    prerequisites: "Пользователь знает новый пароль.",
    solution: "1. Закройте Outlook.\n2. **Панель управления → Учётные записи → Учётные данные Windows**.\n3. Удалите записи, где есть `outlook` или `office`.\n4. Запустите Outlook и войдите заново.",
  },
  {
    daysAgo: 14, by: 1, tags: ["VPN", "сеть"],
    title: "VPN подключается, но внутренние сайты не открываются",
    symptom: "Статус VPN «подключено», но портал и общие папки недоступны.",
    cause: "DNS-сервер берётся от домашнего роутера, а не от VPN.",
    prerequisites: "",
    solution: "1. Отключите и снова подключите VPN.\n2. В командной строке: `ipconfig /flushdns`.\n3. Проверьте `nslookup portal.orbita.example` — ответ должен прийти от `10.20.5.10`.\n4. Если нет — переустановите профиль VPN.",
  },
  {
    daysAgo: 9, by: 2, tags: ["1С"],
    title: "1С: «Не удалось подключиться к серверу»",
    symptom: "При запуске базы появляется ошибка подключения к серверу 1С.",
    cause: "Изменился адрес сервера или кэш списка баз устарел.",
    prerequisites: "Права локального администратора не нужны.",
    solution: "1. В окне запуска 1С выберите базу → **Изменить**.\n2. Проверьте имя сервера: `srv-1c.orbita.example`.\n3. Удалите папку `%APPDATA%\\1C\\1cv8\\` с кэшем и запустите снова.",
  },
  {
    daysAgo: 5, by: 1, tags: ["принтеры", "сеть"],
    title: "Сканирование в общую папку перестало работать",
    symptom: "МФУ пишет «Ошибка отправки» при сканировании в папку.",
    cause: "Сменили пароль учётной записи сканера.",
    prerequisites: "Пароль сервисной учётки `scan` (у руководителя IT).",
    solution: "1. Откройте веб-интерфейс МФУ по его IP из реестра.\n2. **Адресная книга → Папка сканов** → обновите пароль.\n3. Отправьте тестовый скан.",
  },
  {
    daysAgo: 40, by: 2, tags: ["почта"], archived: true,
    title: "Старая почта на POP3 (не актуально)",
    symptom: "Письма не синхронизируются между компьютером и телефоном.",
    cause: "Ящик был подключён по POP3.",
    prerequisites: "",
    solution: "Компания перешла на Exchange, инструкция больше не нужна.",
  },
];
