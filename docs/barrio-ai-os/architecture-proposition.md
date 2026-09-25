# BARRIO AI OS — Proposition d'architecture (v0, à valider)

> Statut : **proposition, rien n'est encore codé.** Ce document répond à la
> section 42 du cahier des charges. L'implémentation démarre seulement après
> validation, et module par module.

Date : 25/09/2026

---

## 0. Ce que l'analyse change par rapport au cahier des charges

Six constats pèsent sur toute l'architecture :

1. **Pennylane synchronise déjà vos comptes bancaires.** Son API v2 expose les
   transactions (`transactions:readonly`) et les comptes (`bank_accounts:readonly`).
   On n'a donc pas besoin d'un agrégateur bancaire (DSP2) au départ.
   L'import de relevés PDF/CSV/Excel reste utile en secours et pour l'historique.
2. **L'accès Pennylane passe par un jeton d'API « Company »**, que vous générez
   vous-même dans *Paramètres > Connectivité > Développeurs*, avec des scopes
   choisis et une date d'expiration. L'OAuth est réservé aux éditeurs partenaires
   et ne vous concerne pas. Aucun mot de passe n'est stocké : le jeton se
   révoque à tout moment depuis Pennylane.
3. **Le « CA aujourd'hui » vient de la caisse, pas de la banque ni de Pennylane.**
   Les paiements carte arrivent sur le compte à J+1 ou J+2, nets de commission.
   Sans connecteur caisse (Zelty, L'Addition, Tiller, Lightspeed, SumUp…), le
   tableau de bord affichera « Information indisponible » pour le CA du jour.
   → **Question : quel logiciel de caisse utilisez-vous ?**
4. **Réforme de la facturation électronique.** Depuis le 1er septembre 2026,
   toutes les entreprises doivent pouvoir *recevoir* des factures
   électroniques ; l'obligation d'*émettre* s'applique aux TPE/PME au
   1er septembre 2027. Les factures clients doivent donc être émises **par
   Pennylane** (plateforme agréée) et non par un PDF que l'on génèrerait
   nous-mêmes. À confirmer avec votre expert-comptable.
5. **Le dépôt actuel est public** (`barriolatino/Barrio-latino`, site vitrine
   publié par GitHub Pages). Le code de BARRIO AI OS doit vivre dans un
   **dépôt privé séparé**, par exemple `barriolatino/barrio-ai-os`. Ce document
   est provisoirement ici en attendant votre décision.
6. **Le système n'exécutera jamais de virement, même après validation.** Il
   prépare le paiement (montant, IBAN du fournisseur, échéance) et vous
   l'exécutez dans l'application de votre banque. C'est plus sûr, et une API
   de paiement coûterait plus cher qu'elle ne ferait gagner de temps.

---

## 1. Architecture générale

```
                         ┌──────────────────────────────┐
  Vous (mobile / PC) ───▶│  INTERFACE WEB (PWA)          │
                         │  Aujourd'hui · À valider ·    │
                         │  Discuter · Déposer · Journal │
                         └──────────────┬───────────────┘
                                        │ HTTPS + session authentifiée
                         ┌──────────────▼───────────────┐
                         │  API (FastAPI)                │
                         │  Auth · Rôles · Limites       │
                         └──────────────┬───────────────┘
            ┌───────────────────────────┼─────────────────────────────┐
            │                           │                             │
   ┌────────▼─────────┐     ┌───────────▼──────────┐      ┌───────────▼──────────┐
   │ BARRIO MANAGER    │────▶│ AGENTS SPÉCIALISÉS   │      │ CENTRE DE VALIDATION │
   │ routage + synthèse│     │ Compta · Pennylane · │      │ Proposition → Vous → │
   └──────────────────┘     │ Factures · Cashflow… │      │ Exécution             │
                            └───────────┬──────────┘      └───────────▲──────────┘
                                        │ appels d'outils             │
                            ┌───────────▼──────────────────────────────┴──┐
                            │  PORTE DE PERMISSIONS (Permission Gate)      │
                            │  agent autorisé ? action sensible ?          │
                            │  → exécute  OU  → crée une proposition       │
                            └───────────┬─────────────────────────────────┘
                                        │
                ┌───────────────────────┼─────────────────────────┐
         ┌──────▼──────┐        ┌───────▼────────┐        ┌───────▼────────┐
         │   OUTILS     │        │  CONNECTEURS    │        │   MÉMOIRE       │
         │ calcul, Excel│        │ Pennylane, caisse│       │ règles, faits,  │
         │ détection…   │        │ fichiers, Gmail…│        │ corrections     │
         └──────┬──────┘        └───────┬────────┘        └───────┬────────┘
                └───────────────────────┼─────────────────────────┘
                              ┌─────────▼──────────┐
                              │ PostgreSQL + fichiers│
                              │ + Journal d'audit    │
                              └────────────────────┘
```

Les sept séparations demandées :

| Couche | Rôle | Ce qu'elle ne fait jamais |
|---|---|---|
| **Agents** | Comprendre, raisonner, rédiger, choisir les outils | Toucher directement la base ou une API externe |
| **Outils** | Opérations unitaires typées (lire des transactions, calculer une TVA, générer un Excel) | Décider seuls d'une action sensible |
| **Connecteurs** | Parler à Pennylane, la caisse, Gmail… derrière une interface commune, avec un *mock* | Contenir de la logique métier |
| **Données** | PostgreSQL (montants en centimes entiers), stockage de fichiers chiffré | Être modifiées sans trace |
| **Interfaces** | PWA mobile d'abord, API REST | Contourner la porte de permissions |
| **Permissions** | Matrice rôle × agent × ressource × action | Laisser passer une action sensible sans validation |
| **Workflows** | Machine à états proposition → validation → exécution | Exécuter autre chose que ce qui a été validé |
| **Logs** | Journal d'audit en ajout seul, chaîné par hash | Être modifié ou supprimé |

### Le principe « ne jamais inventer », inscrit dans l'architecture

Une consigne dans un prompt ne suffit pas. Trois mécanismes l'imposent :

1. **Les chiffres sont calculés par du code, jamais par le modèle.** Totaux,
   food cost, TVA et prévisions sortent de fonctions Python testées. Le modèle
   reçoit des résultats et les met en phrases.
2. **Contrôle d'ancrage des chiffres.** Avant d'afficher une réponse, un
   validateur vérifie que chaque montant ou pourcentage cité figure dans les
   résultats d'outils de la conversation. Un chiffre orphelin bloque la réponse,
   qui est régénérée ou remplacée par « Information indisponible ».
3. **Chaque résultat d'agent porte ses sources** (identifiants de transactions,
   factures, fichiers) et un niveau de confiance. L'interface permet de
   remonter à la donnée d'origine.

---

## 2. Architecture technique recommandée

| Brique | Choix | Pourquoi |
|---|---|---|
| Backend | **Python 3.12 + FastAPI**, Pydantic v2 | Meilleur écosystème pour lire PDF/Excel/CSV et calculer ; typage strict |
| Base de données | **PostgreSQL 16**, SQLAlchemy 2 + Alembic | Transactions fiables, JSONB pour les propositions, migrations versionnées |
| Tâches de fond | **Procrastinate** (file de tâches dans PostgreSQL) | Imports, synchronisation Pennylane, alertes planifiées, sans Redis à maintenir |
| IA | **API Anthropic (Claude)**, boucle d'outils maison | Pas de LangChain : la porte de permissions reste dans notre code, lisible et testable |
| Modèles | `claude-haiku-4-5` pour le routage et la catégorisation en masse ; `claude-sonnet-5` pour les agents ; `claude-opus-5-5` réservé aux synthèses mensuelles | Coût maîtrisé ; modèle configurable par agent |
| Lecture de fichiers | `pdfplumber` (PDF texte), `openpyxl` (Excel), `pandas` (CSV : `;`, virgule décimale, latin-1), vision Claude pour les scans et photos | Les relevés bancaires français ont des formats très variables |
| Génération Excel | `openpyxl`, avec reproduction de votre modèle | Mise en forme, listes déroulantes, couleurs par niveau de confiance |
| Frontend | **React + Vite + TypeScript + Tailwind**, installable en **PWA** | S'ouvre comme une application sur le téléphone ; notifications push |
| Auth | Mot de passe **Argon2id** + **2FA TOTP obligatoire**, cookie de session `httpOnly` | Données financières : un mot de passe seul ne suffit pas |
| Fichiers | Stockage objet S3-compatible, chiffré côté serveur | Relevés, factures, contrats |
| Hébergement | **France / UE** : Scaleway, Clever Cloud ou OVHcloud (PostgreSQL managé + sauvegardes quotidiennes) | RGPD, latence, support en français |
| Qualité | `pytest`, `ruff`, `mypy`, `vitest`, **gitleaks** en pre-commit et en CI | Aucun secret ne doit atteindre le dépôt |
| Déploiement | Docker Compose en local, conteneurs sur l'hébergeur, CI GitHub Actions | Reproductible |

**Coût mensuel indicatif** : hébergement 20 à 40 €, API Claude 10 à 50 €
selon l'usage (un plafond de dépense par agent sera configurable). Pennylane :
vérifier que votre abonnement inclut l'accès API.

---

## 3. Liste des agents

Chaque agent est un module déclaré par un **manifeste** : nom, mission, modèle,
outils autorisés, données accessibles, statut actif/inactif, budget mensuel.
Ajouter un agent revient à ajouter un dossier et son manifeste, sans toucher au
reste.

| # | Agent | Phase | Mission | Outils principaux |
|---|---|---|---|---|
| 1 | **BARRIO MANAGER** | 1 | Comprendre la demande, déléguer, synthétiser, prioriser | `delegate`, `get_alerts`, `get_pending_approvals` |
| 2 | **BARRIO COMPTA** | 1 | Import de relevés, catégorisation, doublons, anomalies, export Excel | `parse_statement`, `categorize`, `detect_duplicates`, `detect_anomalies`, `export_excel` |
| 3 | **BARRIO PENNYLANE** | 1 | Seul agent autorisé à parler à Pennylane ; lecture, puis écriture sous validation | `pl_list_*`, `pl_get_*`, `pl_create_invoice` (validation) |
| 4 | **BARRIO FACTURES** | 1 | Préparer, numéroter, suivre, relancer | `find_customer`, `compute_invoice`, `propose_invoice`, `draft_reminder` |
| 5 | **BARRIO CASHFLOW** | 1 | Solde, prévisions à 7/30/90 jours, risques | `get_balances`, `forecast`, `list_due_items` |
| 6 | BARRIO ACHATS | 2 | Fournisseurs, évolution des prix, hausses | `supplier_spend`, `price_history` |
| 7 | BARRIO STOCK | 2 | Inventaire, seuils, proposition de commande | `stock_levels`, `propose_order` |
| 8 | BARRIO FOOD COST | 2 | Coût matière, marge par plat, impact des hausses | `recipe_cost`, `simulate_price_change` |
| 9 | BARRIO PILOTAGE | 2 | Indicateurs, comparaisons, explication des variations | `kpi`, `compare_periods` |
| 10 | BARRIO MARKETING | 3 | Calendrier éditorial, publications | `draft_post`, `content_calendar` |
| 11 | BARRIO BUSINESS | 3 | Prospects, devis, relances | `create_lead`, `draft_quote`, `draft_email` |
| 12 | BARRIO EVENTS | 3 | Menus, budgets, checklists d'événements | `event_checklist`, `event_budget` |
| 13 | BARRIO ADMIN | 3 | Classement, recherche, échéances documentaires | `ocr`, `extract_fields`, `search_docs` |
| 14 | BARRIO RH | 3 | Suivi administratif des salariés (sans aucune décision) | `employee_docs`, `leave_tracker` |
| 15 | BARRIO RÉPUTATION | 3 | Synthèse des avis, brouillons de réponse | `fetch_reviews`, `draft_reply` |

**Fonctionnement du MANAGER** : (1) un routage rapide (Haiku) classe la demande
et choisit les agents ; (2) les agents travaillent en parallèle et renvoient un
`AgentResult` structuré (données, sources, confiance, alertes, propositions
créées) ; (3) la synthèse (Sonnet) rédige le rapport au format de la section 19 ;
(4) le contrôle d'ancrage vérifie les chiffres. Si la demande est ambiguë, le
Manager pose une question au lieu de deviner.

Exemple : « Analyse ma trésorerie du mois dernier » → CASHFLOW (soldes,
entrées/sorties) + COMPTA (répartition par catégorie, opérations non
catégorisées) → synthèse avec les points à vérifier.

---

## 4. Outils nécessaires

Chaque outil déclare : nom, description, schéma d'entrée et de sortie (Pydantic),
**ressource** touchée, **action** (`READ` · `CREATE` · `UPDATE` · `DELETE` ·
`EXECUTE`) et **niveau de risque**.

| Niveau | Nature | Exemple | Traitement |
|---|---|---|---|
| **R0** | Lecture | lister les transactions, lire une facture | Automatique, journalisé |
| **R1** | Brouillon interne | préparer une facture, rédiger une relance | Automatique, reste un brouillon |
| **R2** | Écriture interne réversible | appliquer une catégorie avec une confiance haute | Automatique, journalisé, annulable |
| **R3** | Sensible | tout ce qui sort du système, engage, supprime ou modifie une donnée comptable | **Proposition → validation → exécution** |

Outils transverses de la phase 1 :

- **Fichiers** : `detect_file_type`, `parse_bank_csv`, `parse_bank_pdf`,
  `parse_xlsx`, `read_template_excel` (analyse votre modèle de catégorisation)
- **Comptabilité** : `normalize_label`, `categorize_transactions`,
  `detect_duplicates`, `detect_recurring`, `detect_anomalies`, `export_excel`
- **Calcul** : `money_sum`, `vat_compute`, `forecast_cashflow` (code pur, aucun appel au modèle)
- **Mémoire** : `get_rules`, `propose_rule`, `get_fact`
- **Système** : `create_proposal`, `create_alert`, `create_task`, `log_action`

---

## 5. APIs et intégrations

| Intégration | Mécanisme officiel | Phase | Remarques |
|---|---|---|---|
| **Pennylane** | API Company v2, jeton Bearer à scopes, créé par vous | 1 | Commencer en **lecture seule**. Scopes d'écriture (`customer_invoices:all`) seulement à l'étape Factures. Environnement de test disponible |
| **Fichiers** (PDF, CSV, XLSX, DOCX, JPG, PNG) | Import local | 1 | Aucune dépendance externe |
| **Anthropic** | API Claude | 1 | Données transmises minimisées (voir Risques) |
| **Caisse** (à préciser) | API de l'éditeur ou export CSV | 2 | Indispensable pour le CA du jour |
| **Banque directe** | Agrégateur DSP2 agréé (Bridge, Powens…) | Optionnelle | Inutile si la synchronisation Pennylane suffit |
| **Gmail / Google Drive / Agenda** | OAuth Google, scopes minimaux | 3 | En mode « Test », Google expire les jetons au bout de 7 jours ; les scopes Gmail sont « restreints ». Avec Google Workspace, une application interne évite ces deux contraintes |
| **Outlook** | Microsoft Graph, OAuth | 3 | Selon votre messagerie |
| **Instagram** | API Graph Instagram (compte Professionnel relié à une page Facebook) | 3 | Publication et statistiques officielles ; validation Meta requise |
| **TikTok** | Content Posting API | 3 | Audit de l'application par TikTok avant publication publique |
| **Avis Google** | API Google Business Profile | 3 | Réponses possibles ; accès sur demande |
| **TripAdvisor, TheFork** | Pas d'API de réponse ouverte aux restaurateurs | 3 | Brouillon dans BARRIO AI, publication manuelle |
| **WhatsApp** | WhatsApp Business Platform (Cloud API) | Optionnelle | Payant par conversation, modèles de messages pré-validés |

Tous les connecteurs implémentent la même interface : `health()`, méthodes
typées, **mock** pour les tests, **disjoncteur** (après N échecs, on arrête
d'appeler et on affiche « Pennylane est momentanément indisponible. Les données
locales restent accessibles. »), cache local des dernières données
synchronisées avec leur horodatage.

**Aucun scraping, aucune automatisation de navigateur sur un service tiers.**

---

## 6. Schéma de base de données

Conventions : identifiants UUID ; **montants en centimes entiers** (`BIGINT`),
jamais en nombres flottants ; dates en `Europe/Paris` ; colonnes
`created_at`, `updated_at` et `created_by` partout ; suppression logique
(`deleted_at`) sur les données métier ; `source` + `external_id` sur tout ce qui
vient d'un connecteur.

```
── Identité et sécurité ──────────────────────────────────────────────
users            id, email, name, password_hash, totp_secret_enc, role, is_active
agents           id, code (COMPTA…), name, is_enabled, model, monthly_budget_cents
permissions      id, principal_type (user|agent), principal_id, resource, action, risk_max
connector_accounts id, connector, status, scopes, secret_ref|token_enc, last_sync_at, last_error
settings         key, value_json, updated_by

── Finance (phase 1) ─────────────────────────────────────────────────
bank_accounts    id, name, iban_masked, source, external_id, currency
import_batches   id, file_id, bank_account_id, period_start, period_end, status, rows_total, rows_dup
transactions     id, bank_account_id, import_batch_id, date, value_date, label_raw, label_norm,
                 amount_cents (signé), counterparty, category_id, subcategory_id, supplier_id,
                 confidence (HAUTE|MOYENNE|FAIBLE), categorized_by (rule|llm|user), rule_id,
                 dedup_hash, is_duplicate_of, anomaly_flags[], comment, validated_at, validated_by
categories       id, parent_id, name, accounting_code, is_active
categorization_rules id, pattern_type (exact|contains|regex|counterparty), pattern,
                 category_id, subcategory_id, supplier_id, priority, version, is_active,
                 created_from_correction_id, approved_by
corrections      id, transaction_id, old_category_id, new_category_id, user_id, note

clients          id, name, siren, vat_number, address, email, payment_terms_days, source, external_id
suppliers        id, name, siren, iban_masked, default_category_id, source, external_id
invoices         id, direction (client|fournisseur), number, client_id|supplier_id, issue_date,
                 due_date, status (brouillon|proposée|validée|émise|payée|en_retard|annulée),
                 total_ht_cents, total_vat_cents, total_ttc_cents, pennylane_id, file_id
invoice_lines    id, invoice_id, label, quantity, unit_price_ht_cents, vat_rate_bp, total_ht_cents
payment_reminders id, invoice_id, level, draft_text, status, sent_at
cashflow_snapshots id, as_of, horizon_days, balance_cents, inflows_cents, outflows_cents, detail_json

── Opérations (phases 2-3) ───────────────────────────────────────────
products         id, name, unit, category, supplier_id, last_price_cents
price_history    id, product_id, supplier_id, price_cents, date, source_invoice_id
stock_items      id, product_id, quantity, min_threshold, location
stock_movements  id, stock_item_id, type (entrée|sortie|perte|inventaire), quantity, date, reason
recipes          id, name, sale_price_ttc_cents, vat_rate_bp, portions
recipe_ingredients id, recipe_id, product_id, quantity, unit, waste_pct
employees        id, name, contract_type, start_date, end_date, documents  ← accès restreint
events           id, client_id, date, guests, type, status, budget_cents, checklist_json
leads            id, source, contact, need, guests, event_date, status, next_follow_up
documents        id, file_id, type, extracted_json, important_dates[], expires_at
files            id, storage_key, sha256, mime, size, uploaded_by, detected_type

── Système d'agents ──────────────────────────────────────────────────
agent_runs       id, agent_id, parent_run_id, request_text, status, model, tokens_in,
                 tokens_out, cost_cents, started_at, ended_at, result_json, error
proposals        id, agent_run_id, agent_id, action_type, risk_level, payload_json,
                 payload_hash, version, status, expires_at, decided_by, decided_at,
                 decision_note, executed_at, execution_result_json, idempotency_key
tasks            id, title, source (agent|user), priority, due_date, status, link
alerts           id, type, severity, title, body, entity_ref, dedup_key, status, snoozed_until
notifications    id, user_id, alert_id, channel (app|push|email), sent_at, read_at
memory_facts     id, scope, key, value_json, source, confidence, version, approved_by
audit_logs       id, ts, actor_type (user|agent|system), actor_id, action, resource,
                 resource_id, before_json, after_json, ip, prev_hash, hash   ← ajout seul
```

Le **Journal d'actions** (section 24) est une vue sur `audit_logs` et
`agent_runs` : Date · Agent · Action · Statut · Utilisateur.

---

## 7. Système de permissions

### Rôles humains

| Rôle | Droits |
|---|---|
| **GÉRANT** (admin) | Tout, y compris gérer les utilisateurs, les agents et les connecteurs |
| **VALIDATION** | Consulter et valider les propositions de son périmètre, avec plafond de montant configurable |
| **LECTURE** | Consulter les tableaux de bord, sans rien modifier (associé, expert-comptable) |

### Agents : moindre privilège

Chaque agent est un **principal technique** avec des permissions explicites.
Tout ce qui n'est pas autorisé est refusé.

| Agent | Transactions | Factures | Pennylane | Clients / Fournisseurs | Salariés | Envoi externe |
|---|---|---|---|---|---|---|
| MANAGER | READ (résumés) | READ | — (passe par l'agent PENNYLANE) | READ | — | — |
| COMPTA | READ, UPDATE (catégorie ≤ R2) | READ | — | READ | — | — |
| PENNYLANE | — | READ, CREATE* | READ, EXECUTE* | READ, CREATE* | — | — |
| FACTURES | READ | READ, CREATE (brouillon) | via l'agent PENNYLANE | READ | — | EXECUTE* |
| CASHFLOW | READ | READ | — | READ | — | — |
| RH (phase 3) | — | — | — | — | READ | — |

`*` = niveau R3 : validation humaine obligatoire.

### Règles de la porte de permissions

1. L'agent a-t-il le droit (`resource`, `action`) ? Sinon : refus journalisé.
2. L'agent est-il actif et sous son budget mensuel ? Sinon : refus.
3. L'outil est-il de niveau R3 ? Alors **aucune exécution** : création d'une
   `proposal` en attente et retour à l'agent : « proposition n° X créée ».
4. Toute action, acceptée ou refusée, est écrite dans `audit_logs`.

Le modèle d'IA ne voit jamais un outil qu'il n'a pas le droit d'utiliser.
Même s'il était manipulé, par exemple par un libellé bancaire piégé, la porte
reste dans le code et ne peut pas être contournée par du texte.

Un **interrupteur par agent** (Réglages > Agents) le désactive immédiatement.
Un **interrupteur général** « mode lecture seule » coupe toutes les écritures
externes.

---

## 8. Workflow de validation

```
 Agent ──crée──▶ PROPOSÉE ──▶ [À VALIDER] ──VALIDER──▶ VALIDÉE ──▶ EN COURS ──▶ EXÉCUTÉE
                                   │                                    │
                                   ├──MODIFIER──▶ nouvelle version      └──▶ ÉCHEC (réessayer / abandonner)
                                   ├──REFUSER───▶ REFUSÉE (motif conservé)
                                   └──délai──────▶ EXPIRÉE
```

Garanties techniques :

- **Ce qui est exécuté est exactement ce qui a été validé** : le contenu est
  figé et haché (`payload_hash`). Toute modification crée une nouvelle version
  qu'il faut valider à nouveau.
- **Revérification juste avant l'exécution** : le client existe-t-il toujours ?
  la facture n'a-t-elle pas déjà été émise ?
- **Idempotence** : une clé unique par proposition, donc un double clic ne crée
  jamais deux factures.
- **Expiration** : 7 jours par défaut, configurable par type.
- **Validation groupée** autorisée seulement pour le risque faible (par exemple
  « valider les 23 catégorisations de confiance moyenne »), jamais pour les
  factures ni les paiements.
- **Affichage clair** : quoi, pour qui, combien, pourquoi, sources, niveau de
  confiance, et ce qui se passera précisément après validation.

Exemple de carte :

```
🧾 Facture — BARRIO FACTURES                       proposée il y a 2 min
Client : Dupont SARL (retrouvé dans Pennylane)
Prestation traiteur : 850,00 € HT · TVA 10 % : 85,00 € · Total 935,00 € TTC
⚠️ Taux de TVA issu de vos réglages (« prestation traiteur = 10 % »).
   Les boissons alcoolisées relèvent de 20 % : à vérifier.
Après validation : création de la facture dans Pennylane (n° attribué par Pennylane).
[ VALIDER ]  [ MODIFIER ]  [ REFUSER ]
```

---

## 9. Roadmap de développement

Chaque étape se termine par des tests verts, une démonstration et une
documentation à jour, puis attend votre accord avant la suivante.

### Phase 0 : Socle, sans IA
Dépôt privé, Docker, PostgreSQL, migrations, authentification + 2FA, rôles,
journal d'audit, porte de permissions, moteur de propositions, coquille de
l'interface (Aujourd'hui, À valider, Journal, Réglages), CI avec tests et
gitleaks, `.env.example`.
**Terminé quand** : on se connecte, on voit un tableau de bord vide, une
proposition factice se valide et apparaît au journal.

### Phase 1 : MVP financier
| Étape | Contenu | Valeur immédiate |
|---|---|---|
| **1a. COMPTA** | Import CSV/XLSX/PDF de votre banque, dédoublonnage, catégorisation (règles puis IA), anomalies, export Excel selon votre modèle, validation des confiances faibles, apprentissage par règles explicites | Fonctionne sans aucune API externe |
| **1b. PENNYLANE (lecture)** | Connecteur + mock, synchronisation clients, fournisseurs, factures, transactions, comptes ; gestion des pannes | Données à jour sans ressaisie |
| **1c. CASHFLOW** | Vue « Ma trésorerie » : aujourd'hui, 7, 30 et 90 jours ; alertes de sorties importantes | Répond à « est-ce que ça va ? » |
| **1d. FACTURES** | Facture à partir d'une phrase, calculs, TVA paramétrée, proposition, création dans Pennylane après validation, suivi des impayés, brouillons de relance | Gain de temps + contrôle |
| **1e. MANAGER + chat** | Routage, synthèse, contrôle d'ancrage, rapport « Bonjour Clem », page Discuter, dépôt de fichiers avec routage automatique | Interface unique |

### Phase 2 : Opérations
Connecteur caisse → ACHATS → FOOD COST → STOCK → PILOTAGE.
Le food cost vient avant le stock : il ne demande qu'une saisie de recettes et
les prix, déjà présents dans les factures fournisseurs.

### Phase 3 : Croissance et administration
MARKETING → BUSINESS + EVENTS → ADMIN → RÉPUTATION → RH (en dernier, car ses
données sont les plus sensibles et il fait gagner le moins de temps).

---

## 10. Structure exacte des dossiers

```
barrio-ai-os/                       ← dépôt privé séparé
├── README.md
├── .env.example
├── .gitignore
├── .pre-commit-config.yaml         (ruff, mypy, gitleaks)
├── docker-compose.yml              (api, worker, postgres, frontend)
├── .github/workflows/ci.yml
├── docs/
│   ├── architecture.md   agents.md   permissions.md   integrations.md
│   ├── pennylane.md      database.md security.md      deployment.md
│   ├── testing.md        roadmap.md
│   └── agents/
│       ├── manager.md  compta.md  pennylane.md  factures.md  cashflow.md
│       └── …           (un fichier par agent ajouté)
├── backend/
│   ├── pyproject.toml
│   ├── alembic/                    migrations
│   ├── app/
│   │   ├── main.py                 point d'entrée FastAPI
│   │   ├── config.py               lecture des variables d'environnement (pydantic-settings)
│   │   ├── core/                   auth.py · security.py · permissions.py · audit.py
│   │   │                           money.py · errors.py · grounding.py
│   │   ├── db/                     base.py · session.py
│   │   ├── models/                 identity.py · finance.py · invoicing.py · agents.py · system.py
│   │   ├── schemas/                modèles Pydantic d'entrée/sortie
│   │   ├── api/routes/             auth · dashboard · chat · approvals · imports · transactions
│   │   │                           invoices · cashflow · journal · settings · agents
│   │   ├── agents/
│   │   │   ├── base.py             Agent, AgentManifest, AgentResult
│   │   │   ├── registry.py         découverte des agents actifs
│   │   │   ├── runtime.py          boucle modèle ↔ outils via la porte
│   │   │   ├── manager/            router.py · synthesizer.py · prompts.py · manifest.yaml
│   │   │   ├── compta/             agent.py · categorizer.py · anomalies.py · prompts.py · manifest.yaml
│   │   │   ├── pennylane/          agent.py · manifest.yaml
│   │   │   ├── factures/           agent.py · numbering.py · vat.py · manifest.yaml
│   │   │   └── cashflow/           agent.py · forecast.py · manifest.yaml
│   │   ├── tools/                  base.py (Tool, RiskLevel) · registry.py · gate.py
│   │   │                           transactions.py · invoices.py · excel.py · files.py · memory.py
│   │   ├── connectors/
│   │   │   ├── base.py             interface Connector, disjoncteur, cache
│   │   │   ├── pennylane/          client.py · mock.py · mapping.py
│   │   │   ├── anthropic_llm/      client.py · mock.py
│   │   │   └── files/              detect.py · bank_csv.py · bank_pdf.py · xlsx.py · parsers/<banque>.py
│   │   ├── workflows/              proposals.py (machine à états) · executor.py
│   │   ├── memory/                 rules.py · facts.py · learning.py
│   │   ├── notifications/          alerts.py · push.py
│   │   └── jobs/                   worker.py · schedules.py (sync, alertes du matin)
│   └── tests/
│       ├── unit/                   money · vat · categorizer · dedup · forecast · excel
│       ├── integration/            import_to_excel · pennylane_mock · proposals_flow
│       ├── security/               authz · agent_scopes · prompt_injection · tampering · secrets
│       ├── evals/                  jeu étiqueté de transactions → précision de catégorisation
│       └── fixtures/               relevés ANONYMISÉS · modèle Excel · réponses Pennylane
└── frontend/
    ├── package.json · vite.config.ts · tailwind.config.ts
    ├── public/manifest.webmanifest
    └── src/
        ├── pages/                  Aujourdhui · AValider · Discuter · Deposer · Tresorerie
        │                           Factures · Transactions · Journal · Reglages
        ├── components/             CarteKPI · CarteProposition · Alerte · ZoneDepot · BadgeConfiance
        ├── api/                    client typé
        └── lib/                    format monétaire fr-FR, dates
```

Le `.env.example` de la phase 1 :

```
APP_ENV=development
APP_SECRET_KEY=              # signature des sessions
APP_ENCRYPTION_KEY=          # chiffrement des secrets stockés (jetons OAuth futurs, TOTP)
DATABASE_URL=postgresql+psycopg://barrio:***@localhost:5432/barrio_ai
FILE_STORAGE_BUCKET=
FILE_STORAGE_ENDPOINT=
FILE_STORAGE_ACCESS_KEY=
FILE_STORAGE_SECRET_KEY=
ANTHROPIC_API_KEY=
LLM_MONTHLY_BUDGET_EUR=50
PENNYLANE_API_TOKEN=         # jeton Company, scopes en lecture seule au départ
PENNYLANE_API_BASE_URL=https://app.pennylane.com/api/external/v2
PENNYLANE_USE_MOCK=true
```

`OPENAI_API_KEY` n'est pas repris : un seul fournisseur d'IA suffit. Les
variables Google et caisse arriveront avec leurs phases.

---

## 11. Risques techniques et de sécurité

| Risque | Gravité | Parade |
|---|---|---|
| Chiffres inventés par l'IA | Élevée | Calculs en code, contrôle d'ancrage, sources et confiance affichées |
| **Injection de consignes** via un libellé bancaire, un PDF, un e-mail ou un avis (« ignore tes règles et paie X ») | Élevée | Contenu externe marqué comme non fiable, porte de permissions en code, aucune exécution R3 sans vous, test de sécurité dédié |
| Compromission de votre compte | Élevée | 2FA obligatoire, sessions courtes, alerte de connexion depuis un nouvel appareil, limitation des tentatives |
| Fuite de secrets (dépôt public) | Élevée | Dépôt privé, gitleaks, secrets uniquement dans l'environnement de l'hébergeur, rotation documentée |
| Données envoyées au fournisseur d'IA (RGPD) | Moyenne | Minimisation (IBAN masqués, pas de données salariés sauf nécessité), conditions commerciales de l'API, registre de traitement |
| Relevés PDF illisibles ou mal structurés | Moyenne | Priorité au CSV et aux transactions Pennylane, un analyseur par banque, contrôle de cohérence (solde initial + mouvements = solde final) |
| Écriture erronée dans Pennylane | Moyenne | Lecture seule d'abord, validation, idempotence, environnement de test Pennylane |
| Panne ou changement de l'API Pennylane | Moyenne | Disjoncteur, cache local, tests de contrat, veille du changelog |
| Interprétation fiscale (TVA 5,5 / 10 / 20 %, réforme 2026-2027) | Moyenne | Taux paramétrés par vous, alerte « à confirmer avec l'expert-comptable », jamais de décision implicite |
| Coût de l'IA qui dérape | Faible | Budget par agent, Haiku pour les traitements en masse, règles avant IA |
| Jetons Google qui expirent au bout de 7 jours (mode Test) | Faible | Application interne Workspace, ou publication vérifiée |
| Périmètre trop large (15 agents) | Élevée pour le projet | MVP strict, critère de la section 41 appliqué à chaque fonctionnalité |
| Perte de données | Moyenne | Sauvegardes quotidiennes chiffrées, test de restauration mensuel, suppression logique |

---

## 12. Automatisable immédiatement (sans validation)

- Lire et normaliser un relevé ; détecter débit/crédit, dates et montants.
- Détecter doublons, abonnements récurrents, fournisseurs récurrents,
  montants inhabituels et opérations non catégorisées.
- Catégoriser **quand une règle validée s'applique** (confiance Haute).
- Générer le tableau Excel (c'est un fichier, rien n'est engagé).
- Synchroniser Pennylane en **lecture**.
- Calculer trésorerie, prévisions, totaux, TVA théorique et food cost.
- Créer alertes, tâches et notifications internes.
- Préparer des brouillons : factures, relances, e-mails, devis, publications,
  réponses aux avis, bons de commande, checklists.
- Résumer, classer et rechercher des documents ; extraire des échéances.
- Produire le rapport du matin.

## 13. Obligatoirement soumis à votre validation

- Créer, émettre ou envoyer une facture ou un avoir ; toute écriture dans Pennylane.
- Envoyer quoi que ce soit à l'extérieur : e-mail, relance, devis,
  publication Instagram ou TikTok, réponse à un avis, message WhatsApp.
- Passer une commande fournisseur.
- Toute préparation de paiement (l'exécution reste **toujours** dans votre banque).
- Catégorisations de confiance Moyenne ou Faible (validables par lot).
- Créer ou modifier une **règle** de catégorisation ou un fait mémorisé
  (« Metro = Fournisseur alimentaire »).
- Modifier une donnée comptable déjà validée ; toute suppression (logique uniquement).
- Tout ce qui concerne un salarié : document, planning, absence, message.
- Toute question réglementaire (TVA, droit du travail, contrats) : alerte +
  renvoi vers le professionnel concerné.
- Activer un connecteur ou élargir les scopes d'un agent.

---

## Décisions attendues avant de coder

1. **Dépôt** : d'accord pour un dépôt privé séparé `barriolatino/barrio-ai-os` ?
2. **Banque(s)** : quelle(s) banque(s), et quels formats d'export sont
   disponibles (CSV, XLSX, PDF) ? Un relevé anonymisé servira aux tests.
3. **Modèle Excel** de catégorisation : pouvez-vous le fournir ?
4. **Pennylane** : votre abonnement donne-t-il accès à *Paramètres >
   Connectivité > Développeurs* ? La synchronisation bancaire y est-elle active ?
5. **Caisse** : quel logiciel ?
6. **Utilisateurs** : vous seul, ou aussi un associé ou l'expert-comptable (en
   lecture) ?
7. **Hébergement** : d'accord pour un hébergeur français, pour environ
   20 à 40 € par mois ?
8. **Stack** : Python/FastAPI + React PWA + PostgreSQL : validé ?

Dès votre accord, je commence par la **Phase 0**, puis l'étape **1a (COMPTA)**.
