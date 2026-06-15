INSERT INTO "ShippingCostEntry"
("id", "countryCode", "countryName", "cd1OnlyCost", "cdPackageCost", "vinylCost", "vinylIncludesCds", "effectiveFrom", "notes", "createdAt", "updatedAt")
VALUES
(gen_random_uuid()::text, 'NL', 'Netherlands', 2.80, 4.40, 7.40, true, '2026-06-13', 'New shipping logic: vinyl includes CDs', NOW(), NOW()),
(gen_random_uuid()::text, 'DE', 'Germany', NULL, 3.75, 6.75, true, '2026-06-13', 'New shipping logic: vinyl includes CDs', NOW(), NOW()),
(gen_random_uuid()::text, 'BE', 'Belgium', NULL, 4.95, 8.75, true, '2026-06-13', 'New shipping logic: vinyl includes CDs', NOW(), NOW()),
(gen_random_uuid()::text, 'CH', 'Switzerland', NULL, 4.95, 9.75, true, '2026-06-13', 'New shipping logic: vinyl includes CDs', NOW(), NOW());
