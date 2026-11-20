create table if not exists users (
  id              serial primary key,
  username        text not null unique,
  full_name       text not null default '',
  password_hash   text not null,
  role            text not null check (role in ('viewer', 'editor', 'admin')),
  active          boolean not null default true,
  failed_attempts integer not null default 0,
  locked_until    timestamptz,
  session_version integer not null default 0,
  must_change_password boolean not null default false,
  created_at      timestamptz not null default now()
);

create table if not exists printers (
  id          serial primary key,
  ip          text not null default '',
  owner       text not null,
  room        text not null default '',
  model       text not null default '',
  note        text not null default '',
  updated_at  timestamptz not null default now(),
  updated_by  integer references users(id) on delete set null
);
create index if not exists printers_ip_idx on printers (ip);

create table if not exists audit_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  user_id     integer references users(id) on delete set null,
  username    text not null,
  action      text not null,
  entity      text not null,
  entity_id   integer,
  before      jsonb,
  after       jsonb
);
create index if not exists audit_log_at_idx on audit_log (at desc);

create table if not exists login_failures (
  id  bigserial primary key,
  ip  text not null,
  at  timestamptz not null default now()
);
create index if not exists login_failures_ip_at_idx on login_failures (ip, at);
-- Failures are counted per (login, IP) and per login, whether or not the login exists.
alter table login_failures add column if not exists username text not null default '';
create index if not exists login_failures_user_ip_at_idx on login_failures (username, ip, at);

-- Акты приема-передачи ТМЦ
alter table users add column if not exists position text not null default '';
alter table users add column if not exists act_name text not null default '';

create table if not exists tmc_items (
  id          serial primary key,
  name        text not null unique,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Каталог: раздел, описание и фото позиции (фото хранится в базе, уже уменьшенным)
alter table tmc_items add column if not exists description text not null default '';
alter table tmc_items add column if not exists category text not null default '';
alter table tmc_items add column if not exists photo bytea;
alter table tmc_items add column if not exists photo_type text;
alter table tmc_items add column if not exists photo_rev int not null default 0;

-- Организации для актов ТМЦ. Акт хранит название текстом, поэтому правка и удаление
-- организации не меняют уже выпущенные акты.
create table if not exists tmc_orgs (
  id          serial primary key,
  name        text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists tmc_acts (
  id                  serial primary key,
  act_date            date not null,
  org                 text not null,
  recipient_name      text not null,
  recipient_position  text not null,
  department          text not null,
  giver_name          text not null,
  giver_position      text not null,
  note                text not null default '',
  created_by          integer references users(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists tmc_acts_created_at_idx on tmc_acts (created_at desc);

create table if not exists tmc_act_lines (
  id             serial primary key,
  act_id         integer not null references tmc_acts(id) on delete cascade,
  pos            integer not null,
  name           text not null,
  inv_number     text not null default '',
  serial_number  text not null default '',
  qty            integer not null check (qty between 1 and 9999)
);
create index if not exists tmc_act_lines_act_id_idx on tmc_act_lines (act_id);

create table if not exists cartridge_models (
  id          serial primary key,
  name        text not null unique,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists cartridge_moves (
  id          serial primary key,
  move_date   date not null,
  from_place  text not null,
  to_place    text not null,
  note        text not null default '',
  created_by  integer references users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists cartridge_moves_date_idx on cartridge_moves (move_date desc, id desc);

create table if not exists cartridge_move_lines (
  id           serial primary key,
  move_id      integer not null references cartridge_moves(id) on delete cascade,
  pos          integer not null,
  model        text not null,
  qty          integer not null default 0 check (qty between 0 and 9999),
  written_off  integer not null default 0 check (written_off between 0 and 9999)
);
create index if not exists cartridge_move_lines_move_id_idx on cartridge_move_lines (move_id);

-- Помощник IT-отдела: база решений
create table if not exists kb_articles (
  id             serial primary key,
  title          text not null,
  symptom        text not null,
  cause          text not null default '',
  prerequisites  text not null default '',
  solution       text not null,
  tags           text[] not null default '{}',
  video_url      text not null default '',
  search_head    text not null default '',
  search_body    text not null default '',
  archived       boolean not null default false,
  created_by     integer references users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_by     integer references users(id) on delete set null,
  updated_at     timestamptz not null default now()
);
create index if not exists kb_articles_list_idx on kb_articles (archived, updated_at desc);

-- article_id is null: draft upload (pasted screenshot of an unsaved article)
create table if not exists kb_attachments (
  id          serial primary key,
  article_id  integer references kb_articles(id) on delete cascade,
  kind        text not null check (kind in ('image', 'file')),
  filename    text not null,
  mime        text not null,
  size        integer not null,
  data        bytea not null,
  created_by  integer references users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists kb_attachments_article_idx on kb_attachments (article_id);
create index if not exists kb_attachments_drafts_idx on kb_attachments (created_at) where article_id is null;
