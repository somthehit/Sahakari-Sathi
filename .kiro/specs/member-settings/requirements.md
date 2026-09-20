# Requirements Document

## Introduction

Member Settings is Module 3 in the Sahakari Sathi SETUPS sequence. It manages
seven lookup/reference entity types that downstream workflows — member
registration, nominee capture, and post-approval status management — depend on.
All seven entity types share an identical base data structure and are served by
a single generic backend engine, with Member Types carrying three additional
financial fields.

The module resolves a specific design conflict present in earlier specifications:
Member Status values are **not** editable at registration time. Member status
during registration is workflow-driven (Draft → Submitted → Verified → Approved
→ Active) and is assigned automatically by the system. The Member Status setup
page in this module exclusively manages the catalog of post-approval operational
statuses (e.g. Suspend, Close, Mark Deceased) that authorised staff apply after
a member has been activated.

---

## Glossary

- **Member_Settings_Service**: The generic backend service that handles CRUD and
  reordering for all seven entity types through a single parameterised route
  pattern.
- **Lookup_Entity**: One record in any of the seven reference tables (Member
  Type, Member Category, Occupation, Education Level, Nominee Type, Relationship
  Type, Member Status).
- **Entity_Type**: The `:entityType` path segment identifying which of the seven
  tables is being operated on. Valid values: `member-types`, `member-categories`,
  `occupations`, `education-levels`, `nominee-types`, `relationship-types`,
  `member-statuses`.
- **Base_Fields**: The fields common to all seven entity types: `id`,
  `organizationId`, `code`, `name`, `nameNepali`, `description`, `isActive`,
  `sortOrder`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt`.
- **Extended_Fields**: Additional fields on Member Types only: `minShareUnits`
  (integer ≥ 0), `entranceFee` (decimal ≥ 0, NPR), `shareValuePerUnit`
  (decimal ≥ 0, NPR).
- **Usage_Count**: The number of member records that currently reference a given
  Lookup_Entity.
- **Post-Approval_Status**: A Member Status value that may be applied to a
  member only after the member's workflow state has reached `Active`.
- **Org_Admin**: A system user with the role `org_admin` for the acting
  organisation.
- **Manager**: A system user with the role `manager` for the acting
  organisation.
- **Authorised_Writer**: A user whose active role carries the
  `member_settings.create`, `member_settings.update`, or
  `member_settings.delete` permission respectively.
- **Authorised_Viewer**: A user whose active role carries the
  `member_settings.view` permission.
- **JWT_Org**: The `organizationId` extracted from the verified JWT in the
  server session — the sole authoritative source of the acting organisation's
  identity.
- **Audit_Log**: An immutable record written on every state-changing write,
  containing `organizationId`, `entityType`, `entityId`, `action`,
  `changedBy`, `timestamp`, and a JSON diff of changed fields.

---

## Requirements

### Requirement 1: Generic Lookup CRUD Engine

**User Story:** As an Org_Admin or Manager, I want a single consistent interface
for creating, reading, updating, and deactivating all seven member-settings
entity types, so that the system does not have seven divergent implementations
to maintain.

#### Acceptance Criteria

1. THE Member_Settings_Service SHALL expose the route pattern
   `GET /api/v1/member-settings/:entityType` accepting query parameters
   `search`, `page`, `limit`, and `active` for all seven Entity_Type values.
2. THE Member_Settings_Service SHALL expose `POST /api/v1/member-settings/:entityType`
   for creating a new Lookup_Entity.
3. THE Member_Settings_Service SHALL expose
   `PUT /api/v1/member-settings/:entityType/:id` for updating an existing
   Lookup_Entity.
4. THE Member_Settings_Service SHALL expose
   `DELETE /api/v1/member-settings/:entityType/:id` for deleting a
   Lookup_Entity.
5. WHEN an `:entityType` segment is not one of the seven valid Entity_Type
   values, THEN THE Member_Settings_Service SHALL return HTTP 400 with a
   descriptive error message.
6. THE Member_Settings_Service SHALL serve all seven entity types through a
   single shared controller, service class, and Zod validation schema — no
   per-entity-type duplicate route files.
7. WHEN a list request is made with `active=true`, THE Member_Settings_Service
   SHALL return only Lookup_Entities where `isActive` is `true`.
8. WHEN a list request includes a non-empty `search` parameter, THE
   Member_Settings_Service SHALL filter results to Lookup_Entities whose `name`,
   `nameNepali`, or `code` field contains the search string
   (case-insensitive).
9. THE Member_Settings_Service SHALL return list results ordered by `sortOrder`
   ascending, then `name` ascending as a tiebreaker.
10. THE Member_Settings_Service SHALL include a `usageCount` field in every
    Lookup_Entity returned by GET list and GET single endpoints, reflecting the
    current count of member records referencing that entity.

---

### Requirement 2: Base Fields Validation

**User Story:** As an Org_Admin or Manager, I want the system to enforce a
consistent, minimal set of fields on every lookup record, so that downstream
forms can rely on well-formed reference data.

#### Acceptance Criteria

1. WHEN creating a Lookup_Entity, THE Member_Settings_Service SHALL require
   `code` (1–20 characters) and `name` (1–100 characters).
2. WHEN creating a Lookup_Entity, THE Member_Settings_Service SHALL accept
   optional fields `nameNepali` (≤ 100 characters), `description`
   (≤ 500 characters), `isActive` (boolean, default `true`), and
   `sortOrder` (integer ≥ 0, default `0`).
3. WHEN saving a Lookup_Entity, THE Member_Settings_Service SHALL normalize
   the `code` value to UPPERCASE before persisting.
4. WHEN saving a Lookup_Entity, THE Member_Settings_Service SHALL enforce a
   unique constraint on `(organizationId, entityType, code)` using a
   case-insensitive comparison — duplicate codes within the same entity type
   for the same organisation SHALL be rejected with HTTP 409.
5. IF the `code` field of an existing Lookup_Entity is changed to a value that
   conflicts with another record of the same entity type in the same
   organisation, THEN THE Member_Settings_Service SHALL return HTTP 409 and
   SHALL NOT persist the change.
6. THE Member_Settings_Service SHALL persist Zod-validated data only; requests
   that fail schema validation SHALL be rejected with HTTP 422 and a
   structured error payload listing the failing fields — no partial or
   temporary persistence of invalid data is permitted at any stage of a
   multi-step operation.

---

### Requirement 3: Member Types — Extended Fields

**User Story:** As an Org_Admin, I want to configure minimum share requirements
and entrance fees per member type, so that the shares module can apply the
correct rules during share issuance without this module hard-coding business
logic.

#### Acceptance Criteria

1. WHEN creating or updating a Member Type, THE Member_Settings_Service SHALL
   accept `minShareUnits` (non-negative integer), `entranceFee` (non-negative
   decimal, NPR), and `shareValuePerUnit` (non-negative decimal, NPR) in
   addition to the Base_Fields.
2. WHEN `minShareUnits` is absent on a Member Type create request, THE
   Member_Settings_Service SHALL default `minShareUnits` to `0`.
3. WHEN `entranceFee` is absent on a Member Type create request, THE
   Member_Settings_Service SHALL default `entranceFee` to `0.00`.
4. WHEN `shareValuePerUnit` is absent on a Member Type create request, THE
   Member_Settings_Service SHALL default `shareValuePerUnit` to `0.00`.
5. THE Member_Settings_Service SHALL store Extended_Fields only on the
   `member_types` table; the six other entity type tables SHALL NOT include
   these columns.
6. WHEN reading a Member Type, THE Member_Settings_Service SHALL include
   `minShareUnits`, `entranceFee`, and `shareValuePerUnit` in the response
   payload.
7. THE Member_Settings_Service SHALL reject a `minShareUnits` value that is
   not a non-negative integer with HTTP 422.
8. THE Member_Settings_Service SHALL reject a negative `entranceFee` or
   negative `shareValuePerUnit` value with HTTP 422.

---

### Requirement 4: Organisation Isolation

**User Story:** As a system operator, I want every lookup record to be
scoped to exactly one organisation, so that no organisation can read or
modify another organisation's reference data.

#### Acceptance Criteria

1. THE Member_Settings_Service SHALL derive `organizationId` exclusively from
   the JWT_Org in the verified server session and SHALL NOT accept
   `organizationId` from the request body or query string.
2. WHEN a GET single request is made for a Lookup_Entity whose `organizationId`
   differs from the JWT_Org, THE Member_Settings_Service SHALL return HTTP 404.
3. WHEN a PUT or DELETE request is made for a Lookup_Entity whose
   `organizationId` differs from the JWT_Org, THE Member_Settings_Service SHALL
   return HTTP 403.
4. WHEN a list request is made, THE Member_Settings_Service SHALL apply a
   database-level `WHERE organization_id = :jwtOrg` filter so that records
   from other organisations are never included in the result set.
5. IF a request body contains an `organizationId` field that differs from the
   JWT_Org, THEN THE Member_Settings_Service SHALL silently discard the
   client-supplied value and use JWT_Org.

---

### Requirement 5: Role-Based Access Control

**User Story:** As an Org_Admin, I want access to member settings to be
controlled by granular permissions, so that only authorised staff can create,
modify, or delete reference data.

#### Acceptance Criteria

1. WHEN an Authorised_Viewer requests any read endpoint, THE
   Member_Settings_Service SHALL return the requested data.
2. WHEN a user without the `member_settings.view` permission requests any read
   endpoint, THE Member_Settings_Service SHALL return HTTP 403.
3. WHEN an Authorised_Writer requests a create, update, or delete endpoint, THE
   Member_Settings_Service SHALL process the request.
4. WHEN a user without the required write permission requests a create, update,
   or delete endpoint, THE Member_Settings_Service SHALL return HTTP 403.
5. THE Member_Settings_Service SHALL enforce RBAC at the Express route
   middleware layer before the controller handler executes, mirroring the
   pattern used by existing settings routes.
6. THE Frontend_Settings_UI SHALL render create, edit, and delete controls as
   visually disabled (not hidden) for users whose session lacks the
   corresponding `member_settings.*` permission; the controls SHALL remain
   visible so the user understands what actions exist, but SHALL NOT be
   interactive, enforcing RBAC on both client and server.

---

### Requirement 6: Delete Safety — Usage Count Guard

**User Story:** As an Org_Admin, I want to be prevented from deleting a lookup
value that is currently referenced by one or more member records, so that
referential integrity is maintained.

#### Acceptance Criteria

1. WHEN a DELETE request is received for a Lookup_Entity, THE
   Member_Settings_Service SHALL query the count of member records referencing
   that entity before executing the delete.
2. IF the Usage_Count of a Lookup_Entity is greater than zero, THEN THE
   Member_Settings_Service SHALL return HTTP 409 with a message stating the
   number of referencing members and SHALL NOT delete the record.
3. WHEN the Usage_Count of a Lookup_Entity is zero, THE Member_Settings_Service
   SHALL delete the record and return HTTP 200.
4. THE Member_Settings_Service SHALL include the Usage_Count in the list and
   single-record GET responses so that the Frontend_Settings_UI can display the
   count in the list view and disable the delete action when count > 0.

---

### Requirement 7: Sort Order Management

**User Story:** As an Org_Admin, I want to reorder lookup values so that
dropdowns in member registration forms present options in a meaningful,
culturally appropriate sequence.

#### Acceptance Criteria

1. THE Member_Settings_Service SHALL expose
   `PATCH /api/v1/member-settings/:entityType/reorder` accepting a JSON body
   containing an ordered array of `{ id, sortOrder }` pairs.
2. WHEN a valid reorder request is received, THE Member_Settings_Service SHALL
   update the `sortOrder` of each specified Lookup_Entity in a single
   database transaction.
3. WHEN a reorder request references an id that does not belong to the JWT_Org,
   THE Member_Settings_Service SHALL return HTTP 403 and SHALL NOT modify any
   records.
4. WHEN a reorder request contains fewer ids than the total count of active
   records for that entity type, THE Member_Settings_Service SHALL update only
   the specified records and leave unspecified records' `sortOrder` values
   unchanged.
5. WHEN a reorder request contains duplicate ids, THE Member_Settings_Service
   SHALL return HTTP 422.

---

### Requirement 8: Audit Trail

**User Story:** As an Org_Admin, I want every change to a lookup value to be
logged with the acting user, timestamp, and a field-level diff, so that I can
audit who changed what and when.

#### Acceptance Criteria

1. WHEN any create, update, or delete operation completes successfully, THE
   Member_Settings_Service SHALL write one Audit_Log record containing
   `organizationId` (from JWT_Org), `entityType`, `entityId`, `action`
   (`CREATE`, `UPDATE`, or `DELETE`), `changedBy` (user id from session),
   and `timestamp`.
2. WHEN an UPDATE operation is recorded, THE Member_Settings_Service SHALL
   include a JSON diff of the changed fields (previous value → new value) in
   the Audit_Log `details` field.
3. THE Member_Settings_Service SHALL NOT write an Audit_Log record when no
   field values changed between the incoming request and the stored record.
4. THE Member_Settings_Service SHALL write the Audit_Log record in the same
   database transaction as the data change; if the transaction rolls back,
   the Audit_Log record SHALL also be rolled back.

---

### Requirement 9: Member Status — Workflow Separation

**User Story:** As a system operator and cooperative manager, I want Member
Status at registration to be assigned automatically by the workflow engine —
not entered manually — so that there is no inconsistency between the
workflow state and the displayed status.

#### Acceptance Criteria

1. THE Member_Registration_Form SHALL display the member's current status as a
   read-only field during the registration and approval workflow (Draft →
   Submitted → Verified → Approved → Active).
2. THE Member_Registration_Form SHALL NOT present a status dropdown that
   allows staff to manually select a workflow status during registration.
3. THE Member_Settings_Service SHALL store Member Status values in the
   `member-statuses` Entity_Type table as a post-approval operational catalog
   only (e.g. Suspend, Close, Mark Deceased, Reactivate).
4. WHEN a staff member applies a post-approval status change to an Active
   member, THE Member_Settings_Service SHALL verify that the member's
   workflow state is `Active` before permitting the status change.
5. WHEN a staff member attempts to apply a post-approval status change to a
   member whose workflow state is not `Active`, THEN THE
   Member_Settings_Service SHALL return HTTP 409 with an explanatory message.
6. THE Member_Settings_UI SHALL display the Member Status setup page with a
   visible notice clarifying that these statuses apply only after member
   activation, not during registration.

---

### Requirement 10: Seed Data for Relationship Types

**User Story:** As an Org_Admin, I want standard relationship types
(Father, Mother, Spouse, Son, Daughter) to be pre-populated when a new
organisation is provisioned, so that nominee and family forms work immediately
without manual configuration.

#### Acceptance Criteria

1. WHEN a new organisation is provisioned, THE Member_Settings_Service SHALL
   seed the `relationship-types` entity with at minimum the following records:
   Father (FA), Mother (MO), Spouse (SP), Son (SO), Daughter (DA),
   Brother (BR), Sister (SI), Grandfather (GF), Grandmother (GM),
   Other (OT).
2. WHEN a new organisation is provisioned, THE Member_Settings_Service SHALL
   seed the `nominee-types` entity with at minimum: Individual (IND),
   Institution (INS), Minor (MNR).
3. WHEN a new organisation is provisioned, THE Member_Settings_Service SHALL
   seed the `member-types` entity with at minimum: Individual (IND),
   Institutional (INS), Minor (MNC), Senior Citizen (SNR).
4. THE seeded records SHALL have `isActive` set to `true` and SHALL be
   attributed to the provisioning actor in the `createdBy` field.
5. WHERE an organisation already has records for a given entity type, THE
   Member_Settings_Service SHALL NOT re-seed that entity type on
   re-provisioning or re-deployment.

> **Open Question for Stakeholder**: Should cooperative staff be able to delete
> or deactivate the standard seeded relationship types (e.g. Father, Mother)?
> If these are marked `isSystem = true` they can be locked from deletion; if
> not, a cooperative that removes "Spouse" will break nominee forms. Recommend
> adding an `isSystem` flag to seed records (mirroring the existing `roles`
> table pattern) and prohibiting deletion of system records. Awaiting
> confirmation before implementing this constraint.

---

### Requirement 11: Frontend Settings UI

**User Story:** As an Org_Admin or Manager, I want a consistent, navigable
settings UI with a dedicated sub-page per entity type, so that I can manage
all seven lookup tables from a single module without page reloads.

#### Acceptance Criteria

1. THE Frontend_Settings_UI SHALL render seven sub-pages accessible from the
   Setups navigation, one for each Entity_Type.
2. WHEN a sub-page loads, THE Frontend_Settings_UI SHALL fetch the entity list
   via `GET /api/v1/member-settings/:entityType` with `page=1` and
   `limit=50` as defaults.
3. THE Frontend_Settings_UI SHALL display, for each Lookup_Entity in a list
   view, at minimum: code, name, nameNepali (if present), isActive status,
   sortOrder, usageCount, and action buttons.
4. THE Frontend_Settings_UI SHALL display the Member Types list with the
   additional columns: minShareUnits, entranceFee (NPR), and
   shareValuePerUnit (NPR).
5. WHEN an Authorised_Writer clicks "+ Add [Entity Type]", THE
   Frontend_Settings_UI SHALL open an inline form or modal for creating a
   new Lookup_Entity.
6. WHEN an Authorised_Writer clicks the edit action on a row, THE
   Frontend_Settings_UI SHALL open a pre-populated inline form or modal for
   updating the Lookup_Entity.
7. WHEN a Lookup_Entity's usageCount is greater than zero, THE
   Frontend_Settings_UI SHALL disable the delete button for that row and
   display the usage count as a tooltip or inline label.
8. THE Frontend_Settings_UI SHALL display a Nepali transliteration hint in
   the nameNepali field using the project's existing
   `transliterateToNepali` utility as the user types the English name.
9. THE Frontend_Settings_UI SHALL use the shared Zod validation schemas
   (client-side) for inline field validation before submission, consistent
   with the ground rules from Module 1.
10. WHILE a create or update request is in-flight, THE Frontend_Settings_UI
    SHALL disable the submit button and display a loading indicator.
11. WHEN a server error response (HTTP 4xx or 5xx) is received, THE
    Frontend_Settings_UI SHALL display a toast notification with the
    server-supplied error message.

---

### Requirement 12: Shared Database Schema Pattern

**User Story:** As a developer, I want the seven member-settings tables to
follow the same schema pattern as existing lookup tables (departments,
roles), so that migrations, queries, and audits are structurally consistent.

#### Acceptance Criteria

1. THE Member_Settings_Service SHALL define the six standard entity type tables
   (`member_categories`, `occupations`, `education_levels`, `nominee_types`,
   `relationship_types`, `member_statuses`) using the Base_Fields pattern,
   following the existing `departments` table schema in `src/db/schema/auth.ts`.
2. THE Member_Settings_Service SHALL define the `member_types` table with
   Base_Fields plus the three Extended_Fields.
3. EACH of the seven tables SHALL carry a unique index on
   `(organization_id, code)` (case-insensitive via stored UPPERCASE
   normalisation).
4. EACH of the seven tables SHALL carry an index on `(organization_id,
   is_active)` to support filtered list queries.
5. THE Member_Settings_Service SHALL define all seven tables in a new file
   `src/db/schema/memberSettings.ts` and SHALL export them from
   `src/db/schema/index.ts`.
6. THE Member_Settings_Service SHALL use Drizzle ORM with the existing
   PostgreSQL client (`getDb()`) from `src/db/client`, consistent with all
   other schema files in the project.
