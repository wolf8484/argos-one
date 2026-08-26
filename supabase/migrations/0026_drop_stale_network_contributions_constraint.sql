-- 0025's drop-constraint guessed the wrong auto-generated name (Postgres's
-- truncation differs from what was assumed), so the old
-- shop+make+model+system+label uniqueness survived alongside the new
-- shop+job uniqueness. That stale constraint rejects legitimate multiple
-- jobs sharing the same label, which is exactly what we need to allow now.
alter table public.network_repair_contributions
  drop constraint if exists network_repair_contributions_shop_id_make_model_system_labe_key;
