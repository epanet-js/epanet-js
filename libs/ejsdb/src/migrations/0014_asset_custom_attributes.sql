ALTER TABLE junctions ADD COLUMN custom_attributes TEXT DEFAULT NULL;
ALTER TABLE reservoirs ADD COLUMN custom_attributes TEXT DEFAULT NULL;
ALTER TABLE tanks ADD COLUMN custom_attributes TEXT DEFAULT NULL;
ALTER TABLE pipes ADD COLUMN custom_attributes TEXT DEFAULT NULL;
ALTER TABLE pumps ADD COLUMN custom_attributes TEXT DEFAULT NULL;
ALTER TABLE valves ADD COLUMN custom_attributes TEXT DEFAULT NULL;
ALTER TABLE customer_points ADD COLUMN custom_attributes TEXT DEFAULT NULL;
