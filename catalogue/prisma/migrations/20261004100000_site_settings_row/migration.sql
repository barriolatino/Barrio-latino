-- La ligne unique des paramètres existe dès l'installation : le site ne
-- l'écrit jamais pendant l'affichage d'une page.
INSERT INTO "SiteSettings" ("id", "updatedAt") VALUES (1, NOW()) ON CONFLICT ("id") DO NOTHING;
