import { useMemo } from 'react';
import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';

type Locale = 'es' | 'en';

type ContactPhoneFieldsProps = {
  countryLabel: string;
  locale: Locale;
  phoneLabel: string;
};

type CountryDialCodeOption = {
  callingCode: string;
  country: CountryCode;
  label: string;
  name: string;
};

export function ContactPhoneFields({
  countryLabel,
  locale,
  phoneLabel,
}: ContactPhoneFieldsProps) {
  const countryDialCodes = useMemo(() => getCountryDialCodeOptions(locale), [locale]);

  return (
    <div className="contact-phone-row">
      <label>
        {countryLabel}
        <select name="phone_country_code" autoComplete="tel-country-code" defaultValue="+57" required>
          {countryDialCodes.map((country) => (
            <option key={country.country} value={country.callingCode}>
              {country.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        {phoneLabel}
        <input name="phone_number" type="tel" autoComplete="tel-national" required />
      </label>
    </div>
  );
}

function getCountryDialCodeOptions(locale: Locale): CountryDialCodeOption[] {
  const displayNames = getRegionDisplayNames(locale);

  return getCountries()
    .map((country) => {
      const callingCode = `+${getCountryCallingCode(country)}`;
      const name = displayNames?.of(country) ?? country;

      return {
        callingCode,
        country,
        label: `${countryFlag(country)} ${name} (${callingCode})`,
        name,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

function getRegionDisplayNames(locale: Locale): Intl.DisplayNames | null {
  if (typeof Intl === 'undefined' || typeof Intl.DisplayNames === 'undefined') {
    return null;
  }

  return new Intl.DisplayNames([locale], { type: 'region' });
}

function countryFlag(country: CountryCode): string {
  return country
    .toUpperCase()
    .replace(/[A-Z]/gu, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)));
}
