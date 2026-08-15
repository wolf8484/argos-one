-- Vehicle catalogue: richer trim/spec options + research-backed enrichment.
--
-- Builds on 0007_vehicle_variants. Each vehicle_variants row is one concrete
-- configuration (trim + engine + drivetrain + transmission). The UI derives the
-- available options per field from these rows: one distinct value → auto-fill,
-- several → a dropdown.

-- 1) Allow a trim to have several spec combinations in the SHARED catalogue
--    (e.g. an "SR5" offered as manual OR automatic). Exact duplicates are still
--    prevented. The per-shop unique index from 0007 is left unchanged so the
--    catalog POST's per-shop lookup stays single-row.
drop index if exists public.vehicle_variants_shared_model_name_unique;
create unique index if not exists vehicle_variants_shared_model_spec_unique
  on public.vehicle_variants (
    model_id,
    lower(name),
    lower(coalesce(engine, '')),
    lower(coalesce(drivetrain, '')),
    lower(coalesce(transmission, ''))
  ) where shop_id is null;

-- 2) Controlled shared write. The seed and the research route contribute to the
--    shared (shop_id null) catalogue. Rather than open a broad RLS insert policy
--    on shared rows, expose a SECURITY DEFINER helper that only ever writes a
--    shared, non-custom row and de-dupes.
create or replace function public.add_shared_variant(
  p_model_id uuid,
  p_name text,
  p_engine text default null,
  p_drivetrain text default null,
  p_transmission text default null,
  p_year_start int default null,
  p_year_end int default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_model_id is null or coalesce(trim(p_name), '') = '' then
    return;
  end if;
  insert into public.vehicle_variants
    (model_id, shop_id, name, engine, drivetrain, transmission, year_start, year_end, is_custom)
  values
    (p_model_id, null, trim(p_name),
     nullif(trim(coalesce(p_engine, '')), ''),
     nullif(trim(coalesce(p_drivetrain, '')), ''),
     nullif(trim(coalesce(p_transmission, '')), ''),
     p_year_start, p_year_end, false)
  on conflict do nothing;
end;
$$;

grant execute on function public.add_shared_variant(uuid, text, text, text, text, int, int)
  to anon, authenticated;

-- 3) Expanded Australian seed. Broad, common configurations for high-volume
--    models. A VIN decode, the research route, or a technician can still add or
--    override anything. Utes intentionally include manual + auto rows for the
--    same trim to exercise the "multiple options → dropdown" behaviour.
insert into public.vehicle_variants (model_id, name, engine, drivetrain, transmission)
select mdl.id, seed.name, seed.engine, seed.drivetrain, seed.transmission
from (values
  -- Toyota HiLux
  ('Toyota','HiLux','Workmate','2.7L petrol','RWD','6-speed automatic'),
  ('Toyota','HiLux','SR','2.8L turbo-diesel','4WD','6-speed manual'),
  ('Toyota','HiLux','SR','2.8L turbo-diesel','4WD','6-speed automatic'),
  ('Toyota','HiLux','SR5','2.8L turbo-diesel','4WD','6-speed manual'),
  ('Toyota','HiLux','SR5','2.8L turbo-diesel','4WD','6-speed automatic'),
  ('Toyota','HiLux','Rogue','2.8L turbo-diesel','4WD','6-speed automatic'),
  -- Toyota Corolla
  ('Toyota','Corolla','Ascent Sport','2.0L petrol','FWD','CVT'),
  ('Toyota','Corolla','Ascent Sport Hybrid','1.8L hybrid','FWD','CVT'),
  ('Toyota','Corolla','SX','2.0L petrol','FWD','CVT'),
  ('Toyota','Corolla','ZR Hybrid','1.8L hybrid','FWD','CVT'),
  -- Toyota RAV4
  ('Toyota','RAV4','GX','2.0L petrol','FWD','CVT'),
  ('Toyota','RAV4','GXL Hybrid','2.5L hybrid','FWD','CVT'),
  ('Toyota','RAV4','Cruiser Hybrid','2.5L hybrid','AWD','CVT'),
  ('Toyota','RAV4','Edge','2.5L petrol','AWD','8-speed automatic'),
  -- Toyota Camry
  ('Toyota','Camry','Ascent Hybrid','2.5L hybrid','FWD','CVT'),
  ('Toyota','Camry','SL Hybrid','2.5L hybrid','FWD','CVT'),
  -- Toyota LandCruiser
  ('Toyota','LandCruiser','GX','3.3L turbo-diesel V6','4WD','10-speed automatic'),
  ('Toyota','LandCruiser','Sahara','3.3L turbo-diesel V6','4WD','10-speed automatic'),
  -- Toyota Prado
  ('Toyota','Prado','GXL','2.8L turbo-diesel','4WD','8-speed automatic'),
  ('Toyota','Prado','Kakadu','2.8L turbo-diesel','4WD','8-speed automatic'),
  -- Ford Ranger
  ('Ford','Ranger','XL','2.0L bi-turbo diesel','4WD','10-speed automatic'),
  ('Ford','Ranger','XLT','2.0L bi-turbo diesel','4WD','10-speed automatic'),
  ('Ford','Ranger','Sport','3.0L V6 turbo-diesel','4WD','10-speed automatic'),
  ('Ford','Ranger','Wildtrak','3.0L V6 turbo-diesel','4WD','10-speed automatic'),
  ('Ford','Ranger','Raptor','3.0L V6 twin-turbo petrol','4WD','10-speed automatic'),
  -- Ford Everest
  ('Ford','Everest','Ambiente','2.0L bi-turbo diesel','RWD','10-speed automatic'),
  ('Ford','Everest','Trend','2.0L bi-turbo diesel','4WD','10-speed automatic'),
  ('Ford','Everest','Sport','3.0L V6 turbo-diesel','4WD','10-speed automatic'),
  -- Mazda CX-5
  ('Mazda','CX-5','Maxx','2.0L petrol','FWD','6-speed automatic'),
  ('Mazda','CX-5','Maxx Sport','2.5L petrol','AWD','6-speed automatic'),
  ('Mazda','CX-5','GT SP','2.5L turbo petrol','AWD','6-speed automatic'),
  ('Mazda','CX-5','Akera','2.2L turbo-diesel','AWD','6-speed automatic'),
  -- Mazda3
  ('Mazda','Mazda3','G20 Pure','2.0L petrol','FWD','6-speed automatic'),
  ('Mazda','Mazda3','G20 Pure','2.0L petrol','FWD','6-speed manual'),
  ('Mazda','Mazda3','G25 Evolve','2.5L petrol','FWD','6-speed automatic'),
  ('Mazda','Mazda3','G25 Astina','2.5L petrol','FWD','6-speed automatic'),
  -- Mazda BT-50
  ('Mazda','BT-50','XT','1.9L turbo-diesel','4WD','6-speed automatic'),
  ('Mazda','BT-50','GT','3.0L turbo-diesel','4WD','6-speed automatic'),
  -- Hyundai i30
  ('Hyundai','i30','Active','2.0L petrol','FWD','6-speed automatic'),
  ('Hyundai','i30','N Line','1.6L turbo petrol','FWD','7-speed DCT'),
  ('Hyundai','i30','N','2.0L turbo petrol','FWD','6-speed manual'),
  ('Hyundai','i30','N','2.0L turbo petrol','FWD','8-speed DCT'),
  -- Hyundai Tucson
  ('Hyundai','Tucson','Base','2.0L petrol','FWD','6-speed automatic'),
  ('Hyundai','Tucson','Elite','1.6L turbo petrol','AWD','7-speed DCT'),
  ('Hyundai','Tucson','Highlander','1.6L turbo-diesel','AWD','7-speed DCT'),
  -- Hyundai Kona
  ('Hyundai','Kona','Base','2.0L petrol','FWD','CVT'),
  ('Hyundai','Kona','N Line','1.6L turbo petrol','AWD','8-speed automatic'),
  -- Kia Cerato
  ('Kia','Cerato','S','2.0L petrol','FWD','6-speed automatic'),
  ('Kia','Cerato','Sport','2.0L petrol','FWD','6-speed automatic'),
  ('Kia','Cerato','GT','1.6L turbo petrol','FWD','7-speed DCT'),
  -- Kia Sportage
  ('Kia','Sportage','S','2.0L petrol','FWD','6-speed automatic'),
  ('Kia','Sportage','SX','1.6L turbo petrol','AWD','7-speed DCT'),
  ('Kia','Sportage','GT-Line','1.6L turbo-diesel','AWD','7-speed DCT'),
  -- Kia Seltos
  ('Kia','Seltos','S','2.0L petrol','FWD','CVT'),
  ('Kia','Seltos','GT-Line','1.6L turbo petrol','AWD','7-speed DCT'),
  -- Mitsubishi Triton
  ('Mitsubishi','Triton','GLX','2.4L turbo-diesel','4WD','6-speed manual'),
  ('Mitsubishi','Triton','GLX','2.4L turbo-diesel','4WD','6-speed automatic'),
  ('Mitsubishi','Triton','GLS','2.4L turbo-diesel','4WD','6-speed automatic'),
  ('Mitsubishi','Triton','GSR','2.4L turbo-diesel','4WD','6-speed automatic'),
  -- Mitsubishi Outlander
  ('Mitsubishi','Outlander','ES','2.5L petrol','FWD','CVT'),
  ('Mitsubishi','Outlander','Aspire','2.5L petrol','AWD','CVT'),
  ('Mitsubishi','Outlander','Exceed PHEV','2.4L plug-in hybrid','AWD','1-speed automatic'),
  -- Isuzu D-Max
  ('Isuzu','D-Max','SX','3.0L turbo-diesel','4WD','6-speed manual'),
  ('Isuzu','D-Max','SX','3.0L turbo-diesel','4WD','6-speed automatic'),
  ('Isuzu','D-Max','LS-U','3.0L turbo-diesel','4WD','6-speed automatic'),
  ('Isuzu','D-Max','X-Terrain','3.0L turbo-diesel','4WD','6-speed automatic'),
  -- Isuzu MU-X
  ('Isuzu','MU-X','LS-M','3.0L turbo-diesel','4WD','6-speed automatic'),
  ('Isuzu','MU-X','LS-T','3.0L turbo-diesel','4WD','6-speed automatic'),
  -- Nissan Navara
  ('Nissan','Navara','SL','2.3L twin-turbo diesel','4WD','6-speed manual'),
  ('Nissan','Navara','ST','2.3L twin-turbo diesel','4WD','7-speed automatic'),
  ('Nissan','Navara','PRO-4X','2.3L twin-turbo diesel','4WD','7-speed automatic'),
  -- Nissan X-Trail
  ('Nissan','X-Trail','ST','2.5L petrol','FWD','CVT'),
  ('Nissan','X-Trail','ST-L','2.5L petrol','AWD','CVT'),
  ('Nissan','X-Trail','Ti-L e-POWER','1.5L hybrid','AWD','1-speed automatic'),
  -- Volkswagen Tiguan
  ('Volkswagen','Tiguan','110TSI Life','1.4L turbo petrol','FWD','6-speed DSG'),
  ('Volkswagen','Tiguan','132TSI Elegance','2.0L turbo petrol','AWD','7-speed DSG'),
  ('Volkswagen','Tiguan','162TSI R-Line','2.0L turbo petrol','AWD','7-speed DSG'),
  -- Volkswagen Amarok
  ('Volkswagen','Amarok','Core','2.0L bi-turbo diesel','4WD','10-speed automatic'),
  ('Volkswagen','Amarok','Style','3.0L V6 turbo-diesel','4WD','10-speed automatic'),
  ('Volkswagen','Amarok','Aventura','3.0L V6 turbo-diesel','4WD','10-speed automatic'),
  -- Subaru Forester
  ('Subaru','Forester','2.5i','2.5L petrol','AWD','CVT'),
  ('Subaru','Forester','2.5i-L','2.5L petrol','AWD','CVT'),
  ('Subaru','Forester','Hybrid S','2.0L hybrid','AWD','CVT'),
  -- Subaru Outback
  ('Subaru','Outback','AWD','2.5L petrol','AWD','CVT'),
  ('Subaru','Outback','AWD Touring','2.4L turbo petrol','AWD','CVT'),
  -- Subaru WRX
  ('Subaru','WRX','AWD','2.4L turbo petrol','AWD','6-speed manual'),
  ('Subaru','WRX','RS','2.4L turbo petrol','AWD','8-speed CVT'),
  -- Honda Civic
  ('Honda','Civic','VTi-L','1.5L turbo petrol','FWD','CVT'),
  ('Honda','Civic','VTi-LX','1.5L turbo petrol','FWD','CVT'),
  ('Honda','Civic','Type R','2.0L turbo petrol','FWD','6-speed manual'),
  -- Honda CR-V
  ('Honda','CR-V','VTi 7','1.5L turbo petrol','FWD','CVT'),
  ('Honda','CR-V','VTi L AWD','1.5L turbo petrol','AWD','CVT'),
  -- MG ZS
  ('MG','ZS','Excite','1.5L petrol','FWD','4-speed automatic'),
  ('MG','ZS','Essence','1.3L turbo petrol','FWD','6-speed automatic'),
  ('MG','ZS','Excite EV','electric','FWD','1-speed automatic'),
  -- MG 3
  ('MG','MG3','Core','1.5L petrol','FWD','CVT'),
  ('MG','MG3','Excite','1.5L petrol','FWD','CVT'),
  -- Tesla Model 3
  ('Tesla','Model 3','RWD','electric','RWD','1-speed automatic'),
  ('Tesla','Model 3','Long Range','electric','AWD','1-speed automatic'),
  ('Tesla','Model 3','Performance','electric','AWD','1-speed automatic'),
  -- Tesla Model Y
  ('Tesla','Model Y','RWD','electric','RWD','1-speed automatic'),
  ('Tesla','Model Y','Long Range','electric','AWD','1-speed automatic'),
  -- Volvo XC60 / V60 (Volvo already partly present via other work)
  ('Volvo','XC60','B5','2.0L mild-hybrid petrol','AWD','8-speed automatic'),
  ('Volvo','XC60','Recharge','2.0L plug-in hybrid','AWD','8-speed automatic'),
  ('Volvo','V60','B5','2.0L mild-hybrid petrol','AWD','8-speed automatic')
) as seed(make, model, name, engine, drivetrain, transmission)
join public.makes mk on lower(mk.name) = lower(seed.make)
join public.models mdl on mdl.make_id = mk.id and lower(mdl.name) = lower(seed.model)
on conflict do nothing;
