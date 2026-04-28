INSERT INTO "ShippingCostEntry"
("id", "countryCode", "countryName", "cd1OnlyCost", "cdPackageCost", "vinylCost", "vinylIncludesCds", "effectiveFrom", "notes", "createdAt", "updatedAt")
VALUES
(gen_random_uuid()::text, 'NL', 'Netherlands', 2.80, 4.40, 7.40, false, '2026-02-12', 'Baseline shipping table, vinyl ships separately', NOW(), NOW()),
(gen_random_uuid()::text, 'DE', 'Germany', NULL, 3.60, 7.30, false, '2026-02-12', 'Baseline shipping table, vinyl ships separately', NOW(), NOW()),
(gen_random_uuid()::text, 'BE', 'Belgium', NULL, 4.95, 8.20, false, '2026-02-12', 'Baseline shipping table, vinyl ships separately', NOW(), NOW()),
(gen_random_uuid()::text, 'CH', 'Switzerland', NULL, 4.95, 9.75, false, '2026-02-12', 'Baseline shipping table, vinyl ships separately', NOW(), NOW()),
(gen_random_uuid()::text, 'FR', 'France', NULL, 4.00, 8.00, false, '2026-02-12', 'Baseline shipping table, vinyl ships separately', NOW(), NOW()),
(gen_random_uuid()::text, 'LU', 'Luxembourg', NULL, 4.35, 8.60, false, '2026-02-12', 'Baseline shipping table, vinyl ships separately', NOW(), NOW()),
(gen_random_uuid()::text, 'DK', 'Denmark', NULL, 4.90, 9.90, false, '2026-02-12', 'Baseline shipping table, vinyl ships separately', NOW(), NOW()),
(gen_random_uuid()::text, 'GB', 'UK', NULL, 3.80, 8.60, false, '2026-02-12', 'Baseline shipping table, vinyl ships separately', NOW(), NOW()),
(gen_random_uuid()::text, 'FI', 'Finland', NULL, 4.05, 9.75, false, '2026-02-12', 'Baseline shipping table, vinyl ships separately', NOW(), NOW()),
(gen_random_uuid()::text, 'IE', 'Ireland', NULL, 4.50, 9.50, false, '2026-02-12', 'Baseline shipping table, vinyl ships separately', NOW(), NOW()),
(gen_random_uuid()::text, 'IT', 'Italy', NULL, 4.45, 8.75, false, '2026-02-12', 'Baseline shipping table, vinyl ships separately', NOW(), NOW()),
(gen_random_uuid()::text, 'NO', 'Norway', NULL, 5.00, 11.00, false, '2026-02-12', 'Baseline shipping table, vinyl ships separately', NOW(), NOW()),
(gen_random_uuid()::text, 'AT', 'Austria', NULL, 3.90, 9.25, false, '2026-02-12', 'Baseline shipping table, vinyl ships separately', NOW(), NOW()),
(gen_random_uuid()::text, 'PL', 'Poland', NULL, 4.00, 9.25, false, '2026-02-12', 'Baseline shipping table, vinyl ships separately', NOW(), NOW()),
(gen_random_uuid()::text, 'PT', 'Portugal', NULL, 3.75, 9.00, false, '2026-02-12', 'Baseline shipping table, vinyl ships separately', NOW(), NOW()),
(gen_random_uuid()::text, 'ES', 'Spain', NULL, 3.75, 9.00, false, '2026-02-12', 'Baseline shipping table, vinyl ships separately', NOW(), NOW()),
(gen_random_uuid()::text, 'SE', 'Sweden', NULL, 4.75, 9.75, false, '2026-02-12', 'Baseline shipping table, vinyl ships separately', NOW(), NOW());
