# Member Setups Guide — यी सेटअपहरू कसरी काम गर्छन्, कसरी सदस्यलाई नियन्त्रण गर्छन्

यो दस्तावेज **Sahakari Sathi** को "Member Settings" (Module 3) अन्तर्गतका master data क्याटालगहरू के हुन्, के-के
लागि प्रयोग हुन्छन्, र कसरी सदस्य (member) लाई नियन्त्रण गर्छन् भन्ने बुझाउनको लागि हो।

---

## 1. सिंहावलोकन — ८ वटा क्याटालग

Member Setup मा **७ वटा lookup क्याटालग + १ वटा Groups** हुन्छन्। सबै **organization-wise** (multi-tenant) छन् —
अर्थात् हरेक सहकारी/organization ले आफ्नै मात्र सेटअप देख्छ, अर्को संस्थाको देख्दैन र प्रयोग गर्न पनि पाउँदैन।

| क्याटालग | DB तालिका | के लागि? | सदस्यलाई कसरी छुन्छ? |
|---|---|---|---|
| **Member Type** | `member_types` | सदस्यको "किसिम" (सामान्य/संस्थापक/संस्थागत...) | `members.membership_type` — शेयर आवश्यकता + प्रवेश शुल्क निर्धारण गर्छ |
| **Member Category** | `member_categories` | प्रशासनिक वर्ग (साधारण/ज्येष्ठ नागरिक/अपाङ्ग...) | `members.member_category` — रिपोर्टिङ र नीति लागू गर्न |
| **Occupation** | `occupations` | पेशा | `member_kyc_profiles.occupation` (आर्थिक प्रोफाइल) |
| **Education Level** | `education_levels` | शैक्षिक योग्यता | सदस्य दर्तामा शिक्षा स्तर छान्न |
| **Nominee Type** | `nominee_types` | नामसारीको किसिम | सदस्यको नामसारी वर्गीकरण |
| **Relationship Type** | `relationship_types` | नामसारी/परिवार सम्बन्ध (बुबा, आमा, श्रीमान्...) | `member_family.nominee_relation` |
| **Member Status** | `member_statuses` | स्वीकृति पछिको परिचालन स्थिति (active/dormant...) | `members.status` (पछि) |
| **Groups** | `groups` | परिचालन/सामुदायिक समूह | (भविष्यमा) `members.group_id` |

> **मुख्य सिद्धान्त:** यी सबै **नियन्त्रण-पात्रो (lookup/reference)** हुन् — डाटा पुन: प्रयोग गर्ने "विकल्पहरू"।
> सदस्य दर्ता, शेयर खाता, बचत खाता, र रिपोर्ट सबैले यिनैबाट छानेर प्रयोग गर्छन्, ताकि सबैतिर एउटै
> मापदण्ड (standardization) रहोस्।

---

## 2. सबै क्याटालगको एउटै "कंकाल" (साझा संरचना)

हरेक क्याटालगको तालिका उस्तै छ (डेटाबेस), र हरेक फारम उस्तै देखिन्छ (UI)। यही नै भविष्यमा
Member Registration, Auto Share Account, Auto Saving Account, र reporting सँग सफा integration को आधार हो।

```
Code → Name → Nepali Name → Description → [specialized fields] → Sort Order → Active → Actions
```

### साझा फिल्डहरू (हरेक क्याटालगमा)
| फिल्ड | विवरण |
|---|---|
| `id` | UUID primary key |
| `organization_id` | **सधैं JWT बाटै** लिइन्छ, client बाट कहिल्यै मान्निँदैन (tenant scoping) |
| `code` | छोटो कोड, **UPPERCASE** मा भण्डारण; `(organization_id, code)` मा unique |
| `name` | अंग्रेजी/रोमन नाम (अनिवार्य) |
| `name_nepali` | नेपाली नाम (auto-transliteration, म्यानुअल सम्पादनमा नमेटिने) |
| `description` | ऐच्छिक विवरण (max 500 अक्षर) |
| `is_active` | Active/Inactive — **Inactive गरेपछि नयाँ छनोटमा देखिँदैन**, तर पुराना सदस्यको डाटा अछुतो रहन्छ |
| `sort_order` | प्रदर्शन क्रम (सानो पहिले) |
| `is_system` | System रेकर्ड — **मेटाउन सकिँदैन** (400 error) |
| `created_by / updated_by / created_at / updated_at` | अडिट ट्रेल |

### मात्र Member Type ले थप ३ फिल्ड बोक्छ (specialized)
| फिल्ड | के लागि? |
|---|---|
| `min_share_units` | यो किसिमको सदस्यले **न्यूनतम कति शेयर** राख्नैपर्छ |
| `entrance_fee` | **प्रवेश शुल्क** (NPR) |
| `share_value_per_unit` | **प्रति शेयर मूल्य** (NPR) |

यी तीनले नै **Auto Share Account** खोल्दा कति शेयर/पैसा लिने भन्ने नियन्त्रण गर्छन्।
अन्य ६ क्याटालगमा यो section देखिँदैन — त्यही भएर फारम **"generic" नभई "specialized + uniform"** हुन्छ।

---

## 3. हरेक क्याटालगको उपयोग र "नियन्त्रण" कसरी गर्छ

### 3.1 Member Type (सदस्य किसिम)
- **के हो:** सदस्यको सबैभन्दा आधारभूत वर्गीकरण।
- **नियन्त्रण गर्ने कुरा:**
  - यो सदस्यले कति शेयर राख्नुपर्ने हो (`min_share_units`),
  - प्रवेशमा कति शुल्क तिर्नुपर्ने (`entrance_fee`),
  - प्रति शेयर मूल्य कति (`share_value_per_unit`)।
- **फ्लो:** Setup मा "Individual Member" बनाउँदा `minShareUnits = 5, entranceFee = 1000, shareValuePerUnit = 100`
  → सदस्य दर्तामा "Individual Member" छान्दा **Auto Share Account** ले ५ शेयर × रु.१०० = रु.५०० + रु.१,००० प्रवेश शुल्क
  स्वतः गणना गर्छ।
- **हालको जडान:** `members.membership_type` (DB enum) सँग usage count हेरिन्छ।

### 3.2 Member Category (सदस्य वर्ग)
- **के हो:** प्रशासनिक समूह — ज्येष्ठ नागरिक, अपाङ्ग, कर्मचारी, सञ्चालक, साधारण आदि।
- **नियन्त्रण गर्ने कुरा:** रिपोर्टिङ (कति ज्येष्ठ नागरिक सदस्य छन्?), नीति/छुट (सेवा शुल्क, ब्याज दर भिन्नता),
  वर्ग-विशेष योजना।
- **हालको जडान:** `members.member_category` (DB enum) सँग usage count हेरिन्छ।

### 3.3 Occupation (पेशा)
- **के हो:** सदस्यको पेशा (किसान, शिक्षक, व्यवसायी...)।
- **प्रयोग:** सदस्यको KYC आर्थिक प्रोफाइल (`member_kyc_profiles.occupation`) — जोखिम मूल्यांकन (risk profiling),
  sector-wise रिपोर्ट।
- **हालको जडान:** `member_kyc_profiles.occupation` सँग usage count हेरिन्छ।

### 3.4 Education Level (शिक्षा)
- **के हो:** शैक्षिक योग्यता (SLC, +2, स्नातक, स्नातकोत्तर...)।
- **प्रयोग:** सदस्य दर्ताको शिक्षा फिल्डको विकल्प; शैक्षिक स्थिति रिपोर्ट।

### 3.5 Nominee Type (नामसारी किसिम)
- **के हो:** नामसारीको प्रकार (आफन्त, जीवनसाथी, छोरा/छोरी...)।
- **प्रयोग:** नामसारी वर्गीकरण र नामसारी-सम्बन्धित नियम (नामसारी प्रतिशत, कागजात आवश्यकता)।

### 3.6 Relationship Type (सम्बन्ध)
- **के हो:** परिवार/नामसारी सम्बन्ध — बुबा, आमा, श्रीमान्/श्रीमती, दाजु/भाइ, काका...
- **नियन्त्रण:** `member_family.nominee_relation` — नामसारीको सम्बन्ध मान्य सम्बन्धबाट मात्र छानिन्छ।
- **हालको जडान:** `member_family.nominee_relation` सँग usage count हेरिन्छ (join गरेर `members` माथि)।

### 3.7 Member Status (सदस्य स्थिति)
- **के हो:** स्वीकृत सदस्यमा मात्र लागू हुने **परिचालन** स्थिति (सक्रिय, निष्क्रिय, स्थगित, कालोसूची...)।
- **नियन्त्रण:** कुन स्थितिको सदस्यले सेवा पाउँछ/पाउँदैन, खाता सञ्चालन अनुमति, रिपोर्ट फिल्टर।
- **नोट:** दर्ता-क्रमका स्थिति (Draft → Pending → Approved) छुट्टै workflow हुन्; यो क्याटालग **पछिको** परिचालन स्थितिको लागि हो।

### 3.8 Groups (समूह)
- **के हो:** सदस्यहरूको परिचालन/सामुदायिक समूह, आफ्नै बैठक तालिका (महिनाको दिन, समय, स्थान),
  सभापति, सम्पर्क व्यक्ति, क्षमता सहित।
- **नियन्त्रण:** (भविष्यमा) `members.group_id` — सदस्यलाई समूहमा जोड्ने। अहिले समूह स्वतन्त्र CRUD हो,
  ० सदस्यको समूह पनि बनाउन सकिन्छ।

---

## 4. Backend — फ्लो (API)

सबै क्याटालग एकै generic controller बाट चल्छन्: `MemberSettingController.ts`।

```
GET    /member-settings/:entityType          → सूची (search, active filter, usageCount सहित)
GET    /member-settings/:entityType/:id      → एक रेकर्ड
POST   /member-settings/:entityType          → सिर्जना (201)
PUT    /member-settings/:entityType/:id      → अद्यावधिक
DELETE /member-settings/:entityType/:id      → मेटाउने (system रेकर्ड/प्रयोगमा भए 400/409)
POST   /member-settings/:entityType/reorder  → क्रम मिलाउने (transaction)
```

- **entityType:** `member-types | member-categories | occupations | education-levels | nominee-types | relationship-types | member-statuses`
- **Groups** आफ्नै block मा: `GET/POST/PUT/DELETE /groups[/:id]`
- **RBAC:** पढ्न — `org_admin, manager, member_service` (र अर्को १ रोल); लेख्न/मेट्न — **`org_admin` मात्र**।
- **Tenant scoping:** `organization_id` **कहिल्यै request body बाट मानिँदैन** — verified JWT को `req.user.organizationId` बाट आउँछ।
  अर्को organization को रेकर्ड id दिए 403/404 फर्किन्छ।
- **Duplication:** `code` UPPERCASE normalize → `(organization_id, code)` unique index ले रोक्छ; code वा name
  दोहोरिए 409।
- **Audit:** हरेक create/update/delete ले अडिट row लेख्छ (`Create Member Type`, `Update Member Category`, ...)
  — update मा old→new diff snapshot सहित।
- **Usage counts:** सूचीमा हरेक रेकर्डसँग `usageCount` आउँछ — त्यो रेकर्ड **हाल कति सदस्यमा प्रयोग भइरहेको** छ भन्ने
  गणना, तालिका/क्याटालग अनुसार फरक फिल्डमा हेरिन्छ:

| entityType | usage कहाँ गनिन्छ |
|---|---|
| `member-types` | `members.membership_type` |
| `member-categories` | `members.member_category` |
| `occupations` | `member_kyc_profiles.occupation` |
| `relationship-types` | `member_family.nominee_relation` (JOIN `members` गरेर org-scope) |

---

## 5. Frontend — फ्लो (UI)

```
MegaMenu "Member Settings" (८ वटा entry)
   │
   ├── SetupMemberSettingsView (entityType prop बाट ७ क्याटालग)
   │      ├── AdminSetupSearchFilterBar → search + active filter
   │      ├── तालिका (code, name, नेपाली, description, [member-type मा Min Share/Entrance/Share Value],
   │      │      Sort Order, Active/Inactive badge, Usage, Edit/Delete)
   │      └── MasterDataFormModal (सबैको एउटै फारम)
   │            Code* → Name* → Name (Nepali) → Description → [Share & Fee Requirements (member-type मा मात्र)]
   │            → Sort Order → Active toggle → Cancel / Save
   │
   └── GroupsView (छुट्टै, आफ्नै add/edit/delete मोडल)
```

- **एउटै फारम सबैतिर:** `MasterDataFormModal` ले layout enforce गर्छ → "Member Type generic नहोस्, तर सबैको
  overall structure उस्तै होस्" भन्ने requirement यहीबाट पूरा हुन्छ।
- **Transliteration:** "Name" टाइप गर्दा organization को सेटिङ अनुसार "Name (Nepali)" स्वतः भरिन्छ; म्यानुअल
  नेपाली सम्पादन गरेपछि auto-fill बन्द हुन्छ (लेखेको नमेटिँदैन)।
- **Inactive रेकर्ड:** प्रदर्शनमै देखिन्छ तर नयाँ छनोटमा अगाडि आउँदैन — पुरानो सदस्यको इतिहास सुरक्षित रहन्छ।

---

## 6. समग्र data flow — "सेटअप कसरी सदस्यलाई नियन्त्रण गर्छ"

```
[१] Setups: org_admin ले क्याटालग भर्छ
      Member Type: General (minShare=1, fee=500, shareValue=100), Founder (minShare=10, fee=5000, ...)
      Category: Regular, Senior Citizen ...
      Occupation: Farming, Teaching ...   (किनभने सबै organization-wise, अर्को सहकारीको देखिँदैन)

             │  POST /member-settings/:entityType   (JWT→org, audit row)

[२] Member Registration (भविष्यको पूर्ण wiring)
      सदस्य दर्ता गर्दा यी क्याटालगकै विकल्पबाट छानिन्छ:
        membership_type ← member_types  (Active मात्र)
        member_category ← member_categories
        occupation      ← occupations   (KYC)
        education       ← education_levels
        nominee relation← relationship_types (family)
        nominee type    ← nominee_types

             │  CREATE /members  (+ member_kyc_profiles, member_family)

[३] Auto Share / Saving Account (भविष्य)
      Member Type बाट auto-default:
        शेयर एकाइ   = min_share_units × share_value_per_unit
        प्रवेश शुल्क = entrance_fee
        बचत योजना   = category/type अनुसार चयन

[४] Reporting
      Category/Type/Occupation/Status अनुसार फिल्टर र समूहीकरण →
      "ज्येष्ठ नागरिक कति?", "किसान सदस्य कति?", "कुन स्थिति कति सदस्य?"

[५] सफा integration का नियमहरू
      - usageCount देखाइन्छ → प्रयोगमा रहेको मास्टर मेट्दा सचेत गराइन्छ
      - code/name दोहोर्याउन नपाइने (unique per org)
      - Inactive गर्न सकिने तर मेट्न नहुने (इतिहास जोगाउन)
      - System रेकर्ड कहिल्यै मेटिँदैन
```

---

## 7. हालको अवस्था (wired) vs भविष्य (full integration)

| क्षेत्र | हाल | भविष्य |
|---|---|---|
| `members.membership_type` / `member_category` | DB enum (hardcoded) | `member_types` / `member_categories` बाट छनोट + usage |
| Registration occupation / nomineeRelation dropdown | hardcoded विकल्प | यी क्याटालगबाटै |
| `members.group_id` | छैन | Groups बाट सदस्य-समूह जोडिने |
| Auto Share Account | बनाइएको छैन | Member Type का minShareUnits/entranceFee/shareValuePerUnit बाट auto-default |
| Auto Saving Account | बनाइएको छैन | Category/Type अनुसार योजना |

यसले सुनिश्चित गर्छ: **एक पटक सेटअप → सबैतिर एउटै डाटा, एउटै नियम, सफा रिपोर्ट।**

---

## 8. सान्दर्भिक फाइलहरू

| फाइल | भूमिका |
|---|---|
| `src/db/schema/memberSettings.ts` | ७ क्याटालगका तालिका परिभाषा |
| `src/db/schema/groups.ts` | Groups तालिका |
| `src/api/controllers/MemberSettingController.ts` | generic CRUD + usage count + audit |
| `src/api/controllers/GroupController.ts` | Groups CRUD |
| `src/api/routes/index.ts` | `/member-settings/*` र `/groups` routes + RBAC |
| `src/api/schemas/memberSetting.ts` | entityType validation |
| `src/api/services/MemberSettingsService.ts` | usage/gating हेल्पर |
| `src/components/admin_setups/SetupMemberSettingsView.tsx` | ७ क्याटालगको साझा list/detail UI |
| `src/components/admin_setups/MasterDataFormModal.tsx` | सबैको एउटै standardized फारम |
| `src/components/admin_setups/GroupsView.tsx` | Groups UI |
| `src/db/schema/members.ts` | `members`, `member_kyc_profiles`, `member_family` (usage target) |
