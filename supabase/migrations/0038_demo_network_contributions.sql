-- Give the two dummy network shops coverage of the demo shop's brands.
--
-- 0027 only seeded Toyota Corolla, so every BMW/Honda/Volkswagen profile in
-- the demo shop (0036) would show an empty "No shared repairs for this model
-- yet" in the middle of a client walkthrough.
--
-- The dummy shops cannot be collapsed into the demo shop: network_repair_patterns
-- filters on `c.shop_id <> target_shop` before counting, so a shop never sees
-- its own rows, and the >= 2 distinct-shop floor is what stops a single
-- contributor being identifiable. Cross-shop evidence has to come from other
-- shop ids by construction.
--
-- Same posture as 0024/0027: writes only to the aggregate table with synthetic
-- (unreferenced) job_ids, never real jobs/repair_records. This is fabricated
-- demo content, not real workshop evidence.
--
-- Both shops must report a pattern for it to clear the floor, so every fault
-- below is deliberately listed for shop A *and* shop B.

insert into public.network_repair_contributions (shop_id, make, model, system, label, job_id, symptom_text, repair_text)
values
  -- Volkswagen Golf -- carbon build-up, the classic direct-injection fault.
  ('00000000-0000-0000-0000-000000000101', 'Volkswagen', 'Golf', 'engine_fuel_air', 'Carbon build-up causing hesitation',
    '00000000-0000-0000-0000-0000000003a1',
    'Customer reported hesitation pulling away and a rough idle once warm. No fault codes stored.',
    'Intake valves heavily coked. Walnut blasted the ports and replaced the intake manifold gasket. Idle smoothed out and hesitation gone on road test.'),
  ('00000000-0000-0000-0000-000000000102', 'Volkswagen', 'Golf', 'engine_fuel_air', 'Carbon build-up causing hesitation',
    '00000000-0000-0000-0000-0000000003b1',
    'Flat spot off idle, owner said it had come on gradually over about a year.',
    'Walnut blasted intake valves and cleaned the throttle body, then reset adaptations. Power delivery restored.'),
  -- Volkswagen Golf -- DSG shudder.
  ('00000000-0000-0000-0000-000000000101', 'Volkswagen', 'Golf', 'transmission', 'DSG clutch pack shudder',
    '00000000-0000-0000-0000-0000000004a1',
    'Shudder pulling away from a standstill, worse from cold.',
    'Replaced mechatronic clutch packs and ran the DSG basic setting. Smooth engagement from cold afterwards.'),
  ('00000000-0000-0000-0000-000000000102', 'Volkswagen', 'Golf', 'transmission', 'DSG clutch pack shudder',
    '00000000-0000-0000-0000-0000000004b1',
    'Jerky low-speed shifts in stop-start traffic.',
    'Clutch packs replaced and full DSG service completed with adaptation reset. No shudder on retest.'),
  -- Honda Civic -- catalytic converter efficiency.
  ('00000000-0000-0000-0000-000000000101', 'Honda', 'Civic', 'emissions', 'Catalytic converter efficiency fault',
    '00000000-0000-0000-0000-0000000005a1',
    'Check engine light on, no drivability complaint. P0420 stored.',
    'Downstream O2 sensor reading lazy. Replaced the sensor, cleared the code and confirmed the readiness monitor passed.'),
  ('00000000-0000-0000-0000-000000000102', 'Honda', 'Civic', 'emissions', 'Catalytic converter efficiency fault',
    '00000000-0000-0000-0000-0000000005b1',
    'Check engine light plus a faint sulphur smell from the exhaust on longer runs.',
    'Converter genuinely below threshold. Replaced converter and both oxygen sensors, verified over a full drive cycle.'),
  -- Honda Civic -- misfire.
  ('00000000-0000-0000-0000-000000000101', 'Honda', 'Civic', 'ignition', 'Rough idle with cylinder misfire',
    '00000000-0000-0000-0000-0000000006a1',
    'Shaking at idle, settles once the engine warms through.',
    'Cylinder 1 coil pack tested weak. Replaced coil and plugs on that cylinder, no misfire counts after test drive.'),
  ('00000000-0000-0000-0000-000000000102', 'Honda', 'Civic', 'ignition', 'Rough idle with cylinder misfire',
    '00000000-0000-0000-0000-0000000006b1',
    'Vibration at traffic lights, intermittent check engine light.',
    'Replaced all four coils and plugs as a set given the mileage. Idle steady afterwards.'),
  -- BMW 3 Series -- coolant loss, the recurring one on these.
  ('00000000-0000-0000-0000-000000000101', 'BMW', '3 Series', 'cooling_hvac', 'Coolant loss with no visible leak',
    '00000000-0000-0000-0000-0000000007a1',
    'Coolant warning coming on every few weeks, nothing on the driveway.',
    'Pressure test showed the electric water pump weeping at the seal. Replaced pump and thermostat housing, pressure then held.'),
  ('00000000-0000-0000-0000-000000000102', 'BMW', '3 Series', 'cooling_hvac', 'Coolant loss with no visible leak',
    '00000000-0000-0000-0000-0000000007b1',
    'Owner topping up coolant regularly, no obvious leak.',
    'Hairline crack in the expansion tank. Replaced tank and cap, bled the system, no further loss.'),
  -- BMW 2 Series -- timing chain rattle.
  ('00000000-0000-0000-0000-000000000101', 'BMW', '2 Series', 'engine_fuel_air', 'Timing chain rattle on cold start',
    '00000000-0000-0000-0000-0000000008a1',
    'Rattle for a couple of seconds on cold start, quiet once running.',
    'Chain measured beyond stretch spec. Replaced chain, guides and tensioner. Silent on cold start after.'),
  ('00000000-0000-0000-0000-000000000102', 'BMW', '2 Series', 'engine_fuel_air', 'Timing chain rattle on cold start',
    '00000000-0000-0000-0000-0000000008b1',
    'Brief metallic noise first thing in the morning.',
    'Tensioner had failed; chain and guides still within spec so only the tensioner was replaced.')
on conflict (shop_id, job_id) do update
  set make = excluded.make, model = excluded.model, system = excluded.system,
      label = excluded.label, symptom_text = excluded.symptom_text,
      repair_text = excluded.repair_text;
