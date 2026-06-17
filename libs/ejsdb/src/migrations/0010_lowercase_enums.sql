-- Normalize enum-like values to lowercase to match the model representation.
-- chemical_source_type was persisted as the uppercase INP keyword
-- (CONCEN/MASS/FLOWPACED/SETPOINT); the model now stores it lowercase and only
-- uppercases when building the INP. mixing_model is normalized defensively:
-- it has always been written lowercase, but it had no enum validation for a
-- period, so any stray uppercase value is corrected here too.

UPDATE junctions  SET chemical_source_type = LOWER(chemical_source_type) WHERE chemical_source_type IS NOT NULL;
UPDATE reservoirs SET chemical_source_type = LOWER(chemical_source_type) WHERE chemical_source_type IS NOT NULL;
UPDATE tanks      SET chemical_source_type = LOWER(chemical_source_type) WHERE chemical_source_type IS NOT NULL;

UPDATE tanks      SET mixing_model = LOWER(mixing_model) WHERE mixing_model IS NOT NULL;
