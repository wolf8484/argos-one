-- Vehicle catalogue: seed expansion.
--
-- 0008 covered ~28 high-volume AU models but left several common makes (Land
-- Rover, Lexus, Jeep, most Audi/BMW/Mercedes-Benz/Holden/Suzuki models) with
-- zero variants — which the live UI shows as an empty trim dropdown, since it
-- has no fallback to the research endpoint. This closes that gap directly.

insert into public.vehicle_variants (model_id, name, engine, drivetrain, transmission)
select mdl.id, seed.name, seed.engine, seed.drivetrain, seed.transmission
from (values
  -- Land Rover Defender
  ('Land Rover','Defender','90 P300','2.0L turbo petrol','4WD','8-speed automatic'),
  ('Land Rover','Defender','110 D250','3.0L turbo-diesel','4WD','8-speed automatic'),
  ('Land Rover','Defender','110 X','3.0L turbo-diesel','4WD','8-speed automatic'),
  -- Land Rover Discovery
  ('Land Rover','Discovery','SE D300','3.0L turbo-diesel','4WD','8-speed automatic'),
  ('Land Rover','Discovery','HSE D300','3.0L turbo-diesel','4WD','8-speed automatic'),
  ('Land Rover','Discovery','S Si4','2.0L turbo petrol','4WD','8-speed automatic'),
  -- Land Rover Range Rover
  ('Land Rover','Range Rover','SE D300','3.0L turbo-diesel','4WD','8-speed automatic'),
  ('Land Rover','Range Rover','Autobiography P530','4.4L twin-turbo petrol V8','4WD','8-speed automatic'),
  -- Land Rover Range Rover Evoque
  ('Land Rover','Range Rover Evoque','S P200','2.0L turbo petrol','4WD','9-speed automatic'),
  ('Land Rover','Range Rover Evoque','R-Dynamic SE D165','2.0L turbo-diesel','4WD','9-speed automatic'),
  -- Land Rover Range Rover Sport
  ('Land Rover','Range Rover Sport','SE D300','3.0L turbo-diesel','4WD','8-speed automatic'),
  ('Land Rover','Range Rover Sport','Autobiography P530','4.4L twin-turbo petrol V8','4WD','8-speed automatic'),
  -- Lexus NX
  ('Lexus','NX','250 Luxury','2.5L petrol','FWD','automatic'),
  ('Lexus','NX','350h F Sport','2.5L hybrid','AWD','automatic'),
  ('Lexus','NX','450h+ Sports Luxury','2.5L plug-in hybrid','AWD','automatic'),
  -- Lexus RX
  ('Lexus','RX','350 Luxury','2.4L turbo petrol','AWD','8-speed automatic'),
  ('Lexus','RX','500h F Sport','2.4L turbo hybrid','AWD','automatic'),
  -- Lexus IS
  ('Lexus','IS','300 Luxury','2.0L turbo petrol','RWD','8-speed automatic'),
  ('Lexus','IS','350 F Sport','3.5L petrol','RWD','8-speed automatic'),
  -- Lexus ES
  ('Lexus','ES','300h Luxury','2.5L hybrid','FWD','automatic'),
  -- Jeep Grand Cherokee
  ('Jeep','Grand Cherokee','Night Eagle','3.6L petrol','4WD','8-speed automatic'),
  ('Jeep','Grand Cherokee','Limited','3.6L petrol','4WD','8-speed automatic'),
  ('Jeep','Grand Cherokee','Summit Reserve','3.0L turbo-diesel','4WD','8-speed automatic'),
  -- Jeep Wrangler
  ('Jeep','Wrangler','Sport S','3.6L petrol','4WD','8-speed automatic'),
  ('Jeep','Wrangler','Rubicon','2.0L turbo petrol','4WD','8-speed automatic'),
  -- Jeep Cherokee
  ('Jeep','Cherokee','Longitude','2.4L petrol','FWD','9-speed automatic'),
  ('Jeep','Cherokee','Trailhawk','2.4L petrol','4WD','9-speed automatic'),
  -- Jeep Compass
  ('Jeep','Compass','Longitude','2.4L petrol','FWD','automatic'),
  ('Jeep','Compass','Trailhawk','2.4L petrol','4WD','9-speed automatic'),
  -- Audi A3
  ('Audi','A3','35 TFSI','1.4L turbo petrol','FWD','7-speed S tronic'),
  ('Audi','A3','40 TFSI S line','2.0L turbo petrol','FWD','7-speed S tronic'),
  -- Audi A4
  ('Audi','A4','35 TFSI','2.0L turbo petrol','FWD','7-speed S tronic'),
  ('Audi','A4','45 TFSI quattro','2.0L turbo petrol','AWD','7-speed S tronic'),
  -- Audi Q3
  ('Audi','Q3','35 TFSI','1.4L turbo petrol','FWD','automatic'),
  ('Audi','Q3','40 TFSI quattro','2.0L turbo petrol','AWD','7-speed S tronic'),
  -- Audi Q5
  ('Audi','Q5','40 TDI quattro','2.0L turbo-diesel','AWD','7-speed S tronic'),
  ('Audi','Q5','45 TFSI quattro','2.0L turbo petrol','AWD','7-speed S tronic'),
  -- Audi Q7
  ('Audi','Q7','45 TDI quattro','3.0L turbo-diesel V6','AWD','8-speed automatic'),
  -- BMW 1 Series
  ('BMW','1 Series','118i','1.5L turbo petrol','FWD','7-speed DCT'),
  ('BMW','1 Series','128ti','2.0L turbo petrol','FWD','7-speed DCT'),
  -- BMW 2 Series
  ('BMW','2 Series','220i','2.0L turbo petrol','RWD','8-speed automatic'),
  -- BMW 4 Series
  ('BMW','4 Series','420i','2.0L turbo petrol','RWD','8-speed automatic'),
  ('BMW','4 Series','M440i','3.0L turbo petrol','AWD','8-speed automatic'),
  -- BMW 5 Series
  ('BMW','5 Series','520i','2.0L turbo petrol','RWD','8-speed automatic'),
  ('BMW','5 Series','530e','2.0L plug-in hybrid','RWD','8-speed automatic'),
  -- BMW X1
  ('BMW','X1','sDrive18i','1.5L turbo petrol','FWD','7-speed DCT'),
  ('BMW','X1','xDrive20i','2.0L turbo petrol','AWD','7-speed DCT'),
  -- BMW X5
  ('BMW','X5','xDrive30d','3.0L turbo-diesel','AWD','8-speed automatic'),
  ('BMW','X5','xDrive40i','3.0L turbo petrol','AWD','8-speed automatic'),
  -- Mercedes-Benz A-Class
  ('Mercedes-Benz','A-Class','A200','1.3L turbo petrol','FWD','7-speed automatic'),
  ('Mercedes-Benz','A-Class','A250 AMG Line','2.0L turbo petrol','FWD','7-speed automatic'),
  -- Mercedes-Benz C-Class
  ('Mercedes-Benz','C-Class','C200','2.0L turbo petrol','RWD','9-speed automatic'),
  ('Mercedes-Benz','C-Class','C300','2.0L turbo petrol','RWD','9-speed automatic'),
  -- Mercedes-Benz E-Class
  ('Mercedes-Benz','E-Class','E200','2.0L turbo petrol','RWD','9-speed automatic'),
  -- Mercedes-Benz GLA
  ('Mercedes-Benz','GLA','GLA200','1.3L turbo petrol','FWD','7-speed automatic'),
  -- Mercedes-Benz GLC
  ('Mercedes-Benz','GLC','GLC200','2.0L turbo petrol','AWD','9-speed automatic'),
  ('Mercedes-Benz','GLC','GLC300 4MATIC','2.0L turbo petrol','AWD','9-speed automatic'),
  -- Holden Commodore (still common in AU workshops despite discontinuation)
  ('Holden','Commodore','Evoke','3.6L petrol V6','RWD','6-speed automatic'),
  ('Holden','Commodore','SS-V','6.2L petrol V8','RWD','6-speed automatic'),
  ('Holden','Commodore','RS','2.0L turbo petrol','FWD','9-speed automatic'),
  -- Holden Colorado
  ('Holden','Colorado','LS','2.8L turbo-diesel','4WD','6-speed manual'),
  ('Holden','Colorado','LTZ','2.8L turbo-diesel','4WD','6-speed automatic'),
  -- Suzuki Swift
  ('Suzuki','Swift','GL','1.2L petrol','FWD','CVT'),
  ('Suzuki','Swift','GLX Turbo','1.0L turbo petrol','FWD','6-speed automatic'),
  ('Suzuki','Swift','Sport','1.4L turbo petrol','FWD','6-speed manual'),
  -- Suzuki Vitara
  ('Suzuki','Vitara','2WD','1.6L petrol','FWD','6-speed automatic'),
  ('Suzuki','Vitara','Turbo AllGrip','1.4L turbo petrol','AWD','6-speed automatic'),
  -- Suzuki Jimny
  ('Suzuki','Jimny','GL','1.5L petrol','4WD','5-speed manual'),
  ('Suzuki','Jimny','GLX','1.5L petrol','4WD','4-speed automatic'),
  -- Volvo XC40
  ('Volvo','XC40','B4','2.0L mild-hybrid petrol','FWD','8-speed automatic'),
  ('Volvo','XC40','Recharge','electric','AWD','1-speed automatic'),
  -- Volvo XC90
  ('Volvo','XC90','B5','2.0L mild-hybrid petrol','AWD','8-speed automatic'),
  ('Volvo','XC90','Recharge','2.0L plug-in hybrid','AWD','8-speed automatic'),
  -- Nissan Patrol
  ('Nissan','Patrol','Ti','5.6L petrol V8','4WD','7-speed automatic'),
  ('Nissan','Patrol','Ti-L','5.6L petrol V8','4WD','7-speed automatic'),
  -- Nissan Qashqai
  ('Nissan','Qashqai','ST','1.3L turbo petrol','FWD','CVT'),
  ('Nissan','Qashqai','Ti','1.3L turbo petrol','FWD','CVT'),
  -- Honda HR-V
  ('Honda','HR-V','X','1.5L petrol','FWD','CVT'),
  ('Honda','HR-V','e:HEV L','1.5L hybrid','FWD','automatic'),
  -- Subaru Impreza
  ('Subaru','Impreza','2.0i','2.0L petrol','AWD','CVT'),
  ('Subaru','Impreza','2.0i-S','2.0L petrol','AWD','CVT'),
  -- Kia Sorento
  ('Kia','Sorento','S','2.2L turbo-diesel','AWD','8-speed automatic'),
  ('Kia','Sorento','GT-Line','2.2L turbo-diesel','AWD','8-speed automatic'),
  -- Mazda CX-3
  ('Mazda','CX-3','Neo Sport','2.0L petrol','FWD','6-speed automatic'),
  ('Mazda','CX-3','Akari','2.0L petrol','AWD','6-speed automatic')
) as seed(make, model, name, engine, drivetrain, transmission)
join public.makes mk on lower(mk.name) = lower(seed.make)
join public.models mdl on mdl.make_id = mk.id and lower(mdl.name) = lower(seed.model)
on conflict do nothing;
