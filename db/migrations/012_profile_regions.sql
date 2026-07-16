ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS region varchar(40);

UPDATE profiles
SET region = CASE
  WHEN lower(country) IN (
    'australia', 'fiji', 'kiribati', 'marshall islands', 'micronesia', 'nauru',
    'new zealand', 'palau', 'papua new guinea', 'samoa', 'solomon islands',
    'tonga', 'tuvalu', 'vanuatu'
  ) THEN 'Oceania'
  WHEN lower(country) IN (
    'canada', 'mexico', 'united states', 'united states of america', 'usa',
    'antigua and barbuda', 'bahamas', 'barbados', 'belize', 'costa rica',
    'cuba', 'dominica', 'dominican republic', 'el salvador', 'grenada',
    'guatemala', 'haiti', 'honduras', 'jamaica', 'nicaragua', 'panama',
    'saint kitts and nevis', 'saint lucia', 'saint vincent and the grenadines',
    'trinidad and tobago'
  ) THEN 'North America'
  WHEN lower(country) IN (
    'argentina', 'bolivia', 'brazil', 'chile', 'colombia', 'ecuador', 'guyana',
    'paraguay', 'peru', 'suriname', 'uruguay', 'venezuela'
  ) THEN 'South America'
  WHEN lower(country) IN (
    'algeria', 'angola', 'benin', 'botswana', 'burkina faso', 'burundi',
    'cabo verde', 'cameroon', 'central african republic', 'chad', 'comoros',
    'democratic republic of the congo', 'republic of the congo', 'djibouti',
    'egypt', 'equatorial guinea', 'eritrea', 'eswatini', 'ethiopia', 'gabon',
    'gambia', 'ghana', 'guinea', 'guinea-bissau', 'ivory coast', 'kenya',
    'lesotho', 'liberia', 'libya', 'madagascar', 'malawi', 'mali', 'mauritania',
    'mauritius', 'morocco', 'mozambique', 'namibia', 'niger', 'nigeria',
    'rwanda', 'sao tome and principe', 'senegal', 'seychelles', 'sierra leone',
    'somalia', 'south africa', 'south sudan', 'sudan', 'tanzania', 'togo',
    'tunisia', 'uganda', 'zambia', 'zimbabwe'
  ) THEN 'Africa'
  WHEN lower(country) IN (
    'bahrain', 'iran', 'iraq', 'israel', 'jordan', 'kuwait', 'lebanon', 'oman',
    'palestine', 'qatar', 'saudi arabia', 'syria', 'turkey', 'türkiye',
    'united arab emirates', 'uae', 'yemen'
  ) THEN 'Middle East'
  WHEN lower(country) IN (
    'afghanistan', 'bangladesh', 'bhutan', 'brunei', 'cambodia', 'china',
    'india', 'indonesia', 'japan', 'kazakhstan', 'kyrgyzstan', 'laos',
    'malaysia', 'maldives', 'mongolia', 'myanmar', 'nepal', 'north korea',
    'pakistan', 'philippines', 'singapore', 'south korea', 'sri lanka',
    'taiwan', 'tajikistan', 'thailand', 'timor-leste', 'turkmenistan',
    'uzbekistan', 'vietnam'
  ) THEN 'Asia'
  ELSE 'Europe'
END
WHERE region IS NULL OR region = '';

ALTER TABLE profiles
  ALTER COLUMN region SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_region_allowed'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_region_allowed
      CHECK (region IN ('Europe', 'Asia', 'Middle East', 'North America', 'South America', 'Africa', 'Oceania'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS profiles_region_idx
  ON profiles(region, review_status, updated_at DESC);
