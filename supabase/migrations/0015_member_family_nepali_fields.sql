-- 0015: Automatic Nepali transliteration companion columns for member family names.
-- Each English family/nominee/guardian name gains a Devanagari counterpart that is
-- auto-filled by the client-side Roman → Devanagari transliteration engine when the
-- organization has "Enable Automatic Nepali Name Transliteration" enabled.

ALTER TABLE member_family
  ADD COLUMN IF NOT EXISTS father_name_nepali text,
  ADD COLUMN IF NOT EXISTS mother_name_nepali text,
  ADD COLUMN IF NOT EXISTS grandfather_name_nepali text,
  ADD COLUMN IF NOT EXISTS spouse_name_nepali text,
  ADD COLUMN IF NOT EXISTS guardian_name_nepali text,
  ADD COLUMN IF NOT EXISTS nominee_name_nepali text;
