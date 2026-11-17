// Address written the way city corporation records have it:
// house / holding no., road, thana, city corporation, post code.
export const CITY_CORPORATIONS = [
  'Dhaka North City Corporation',
  'Dhaka South City Corporation',
  'Gazipur City Corporation',
  'Narayanganj City Corporation',
  'Chattogram City Corporation',
  'Cumilla City Corporation',
  'Sylhet City Corporation',
  'Rajshahi City Corporation',
  'Khulna City Corporation',
  'Barishal City Corporation',
  'Rangpur City Corporation',
  'Mymensingh City Corporation',
]

export const EMPTY_ADDRESS = { house: '', road: '', thana: '', city_corporation: '', postcode: '' }

export const addressLine = (p = {}) =>
  [p.house, p.road, p.thana, p.city_corporation, p.postcode].filter(Boolean).join(', ')
