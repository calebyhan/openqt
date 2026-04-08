-- Switch invite_code to hex encoding so codes are URL-safe (no +, /, = chars).
-- 8 random bytes → 16 hex chars, e.g. "a3f9c2b10d7e4812"
ALTER TABLE public.groups
  ALTER COLUMN invite_code SET DEFAULT encode(gen_random_bytes(8), 'hex');

-- Re-roll any existing codes that contain base64-unsafe URL chars
UPDATE public.groups
  SET invite_code = encode(gen_random_bytes(8), 'hex')
  WHERE invite_code ~ '[+/=]';
