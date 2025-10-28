/**
 * Calculate travel allowances (per diem) based on country, arrival time, and departure time
 * @param {string} arrival_country - Country of arrival
 * @param {string} departure_country - Country of departure
 * @param {Date} arrival_time - Arrival date and time
 * @param {Date} departure_time - Departure date and time
 * @param {Object} country_rates - Per diem rates by country
 * @param {number} grade_multiplier - Grade multiplier (e.g., 1.30 for director)
 * @returns {Object} - Total allowance, breakdown by country, and explanations
 */
function calculateAllowance(arrival_country, departure_country, arrival_time, departure_time, country_rates, grade_multiplier = 1.0) {
  const result = {
    total_allowance_amount: 0,
    breakdown: {},
    explanations: []
  };

  // Helper function to get hour from date
  const getHour = (date) => date.getHours() + date.getMinutes() / 60;

  // Helper function to check if two dates are on the same day
  const isSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  // Helper function to determine allowances based on arrival time
  const getArrivalAllowances = (hour, isSameDayTravel, departureHour) => {
    const allowances = { breakfast: false, lunch: false, dinner: false, accommodation: false };
    
    // Same-day short transit rules (override normal rules)
    if (isSameDayTravel) {
      if (hour >= 6 && hour < 12 && departureHour < 12) {
        allowances.breakfast = true;
        return { allowances, reason: "Same-day transit: arrived 06:00-11:59, departed before 12:00 - breakfast only" };
      }
      if (hour >= 12 && hour < 18 && departureHour < 18) {
        allowances.lunch = true;
        return { allowances, reason: "Same-day transit: arrived 12:00-17:59, departed before 18:00 - lunch only" };
      }
      if (hour >= 18 && departureHour >= 18) {
        allowances.dinner = true;
        allowances.accommodation = true;
        return { allowances, reason: "Same-day transit: arrived after 18:00, departed after 18:00 - dinner and accommodation only" };
      }
    }

    // Normal arrival rules
    if (hour < 6) {
      allowances.accommodation = true;
      return { allowances, reason: "Arrived before 06:00 - accommodation only" };
    } else if (hour >= 6 && hour < 12) {
      allowances.breakfast = true;
      return { allowances, reason: "Arrived between 06:00-11:59 - breakfast only" };
    } else if (hour >= 12 && hour < 18) {
      allowances.lunch = true;
      return { allowances, reason: "Arrived between 12:00-17:59 - lunch only" };
    } else {
      allowances.dinner = true;
      allowances.accommodation = true;
      return { allowances, reason: "Arrived after 18:00 - dinner and accommodation" };
    }
  };

  // Helper function to determine allowances based on departure time
  const getDepartureAllowances = (hour) => {
    const allowances = { breakfast: false, lunch: false, dinner: false, accommodation: false };
    
    if (hour < 6) {
      allowances.accommodation = true;
      return { allowances, reason: "Departed before 06:00 - accommodation only" };
    } else if (hour >= 6 && hour < 12) {
      allowances.breakfast = true;
      return { allowances, reason: "Departed between 06:00-11:59 - breakfast only" };
    } else if (hour >= 12 && hour < 18) {
      allowances.breakfast = true;
      allowances.lunch = true;
      return { allowances, reason: "Departed between 12:00-17:59 - breakfast and lunch" };
    } else if (hour >= 18 && hour < 21) {
      allowances.dinner = true;
      return { allowances, reason: "Departed between 18:00-20:59 - dinner only" };
    } else {
      // Special rule: Departures between 9:00 PM and 11:59 PM - dinner only, no breakfast or lunch
      allowances.dinner = true;
      return { allowances, reason: "Departed between 21:00-23:59 - dinner only (no breakfast/lunch for departure day)" };
    }
  };

  // Calculate allowances for arrival country
  const arrivalHour = getHour(arrival_time);
  const departureHour = getHour(departure_time);
  const sameDayTravel = isSameDay(arrival_time, departure_time);
  const sameCountry = arrival_country === departure_country;

  if (!country_rates[arrival_country]) {
    throw new Error(`Country rates not found for ${arrival_country}`);
  }

    // Process arrival country
    const arrivalAllowance = getArrivalAllowances(arrivalHour, sameDayTravel && sameCountry, departureHour);
    
    result.breakdown[arrival_country] = {
      meals: [],
      amounts: {},
      total: 0
    };

    let arrivalTotal = 0;
    
    // Special rule: When arriving in Zimbabwe, NO allowances are calculated at all (no accommodation or other expenses)
    if (arrival_country === 'Zimbabwe') {
      result.breakdown[arrival_country].total = 0;
      result.total_allowance_amount += 0;
      result.explanations.push(`${arrival_country} (Arrival): Arrived back in Zimbabwe - no allowances calculated (allowances cut off upon arrival, accommodation and other expenses suspended)`);
    } else {
      // For non-Zimbabwe arrivals, calculate allowances normally
      const rates = country_rates[arrival_country];

      if (arrivalAllowance.allowances.breakfast) {
        result.breakdown[arrival_country].meals.push('breakfast');
        result.breakdown[arrival_country].amounts.breakfast = rates.breakfast * grade_multiplier;
        arrivalTotal += rates.breakfast * grade_multiplier;
      }
      if (arrivalAllowance.allowances.lunch) {
        result.breakdown[arrival_country].meals.push('lunch');
        result.breakdown[arrival_country].amounts.lunch = rates.lunch * grade_multiplier;
        arrivalTotal += rates.lunch * grade_multiplier;
      }
      if (arrivalAllowance.allowances.dinner) {
        result.breakdown[arrival_country].meals.push('dinner');
        result.breakdown[arrival_country].amounts.dinner = rates.dinner * grade_multiplier;
        arrivalTotal += rates.dinner * grade_multiplier;
      }
      if (arrivalAllowance.allowances.accommodation) {
        result.breakdown[arrival_country].meals.push('accommodation');
        result.breakdown[arrival_country].amounts.accommodation = rates.accommodation * grade_multiplier;
        arrivalTotal += rates.accommodation * grade_multiplier;
      }
      
      // Calculate other expenses (10% of total allowance for the day)
      const mealsCount = (arrivalAllowance.allowances.breakfast ? 1 : 0) + 
                         (arrivalAllowance.allowances.lunch ? 1 : 0) + 
                         (arrivalAllowance.allowances.dinner ? 1 : 0);
      if (mealsCount > 0) {
        const otherExpenses = arrivalTotal * 0.1; // 10% of current total
        result.breakdown[arrival_country].amounts.other = otherExpenses;
        arrivalTotal += otherExpenses;
      }

      result.breakdown[arrival_country].total = arrivalTotal;
      result.total_allowance_amount += arrivalTotal;
      result.explanations.push(`${arrival_country} (Arrival): ${arrivalAllowance.reason}`);
    }

  // Process departure country (if different from arrival country)
  if (!sameCountry) {
    if (!country_rates[departure_country]) {
      throw new Error(`Country rates not found for ${departure_country}`);
    }

    const departureAllowance = getDepartureAllowances(departureHour);
    
    result.breakdown[departure_country] = {
      meals: [],
      amounts: {},
      total: 0
    };

    let departureTotal = 0;
    
    // Special rule: When departing from Zimbabwe going to another country, use destination country rates
    // But when arriving in Zimbabwe (coming back home), use the departure country rates (where traveler is coming from)
    const depRates = (departure_country === 'Zimbabwe') ? country_rates[arrival_country] : country_rates[departure_country];
    
    // Special rule for return to Zimbabwe: When arriving in Zimbabwe, use departure country rates for all travel allowances
    // This means the traveler gets allowances for the journey back home, but nothing upon arrival
    const useDepartureRates = (arrival_country === 'Zimbabwe');
    const actualRates = useDepartureRates ? country_rates[departure_country] : depRates;

    // Prevent overlapping allowances - check if meals already covered by arrival country (only for non-Zimbabwe arrivals)
    const alreadyCovered = (arrival_country === 'Zimbabwe') ? [] : result.breakdown[arrival_country].meals;

    // Special handling based on Zimbabwe scenarios
    if (arrival_country === 'Zimbabwe') {
      // Coming back to Zimbabwe - calculate travel allowances using departure country rates
      if (departureAllowance.allowances.breakfast) {
        result.breakdown[departure_country].meals.push('breakfast');
        result.breakdown[departure_country].amounts.breakfast = actualRates.breakfast * grade_multiplier;
        departureTotal += actualRates.breakfast * grade_multiplier;
      }
      if (departureAllowance.allowances.lunch) {
        result.breakdown[departure_country].meals.push('lunch');
        result.breakdown[departure_country].amounts.lunch = actualRates.lunch * grade_multiplier;
        departureTotal += actualRates.lunch * grade_multiplier;
      }
      if (departureAllowance.allowances.dinner) {
        result.breakdown[departure_country].meals.push('dinner');
        result.breakdown[departure_country].amounts.dinner = actualRates.dinner * grade_multiplier;
        departureTotal += actualRates.dinner * grade_multiplier;
      }
      if (departureAllowance.allowances.accommodation) {
        result.breakdown[departure_country].meals.push('accommodation');
        result.breakdown[departure_country].amounts.accommodation = actualRates.accommodation * grade_multiplier;
        departureTotal += actualRates.accommodation * grade_multiplier;
      }
    } else if (departure_country === 'Zimbabwe') {
      // Leaving Zimbabwe going abroad - use destination country rates
      if (departureAllowance.allowances.breakfast) {
        result.breakdown[departure_country].meals.push('breakfast');
        result.breakdown[departure_country].amounts.breakfast = depRates.breakfast * grade_multiplier;
        departureTotal += depRates.breakfast * grade_multiplier;
      }
      if (departureAllowance.allowances.lunch) {
        result.breakdown[departure_country].meals.push('lunch');
        result.breakdown[departure_country].amounts.lunch = depRates.lunch * grade_multiplier;
        departureTotal += depRates.lunch * grade_multiplier;
      }
      if (departureAllowance.allowances.dinner) {
        result.breakdown[departure_country].meals.push('dinner');
        result.breakdown[departure_country].amounts.dinner = depRates.dinner * grade_multiplier;
        departureTotal += depRates.dinner * grade_multiplier;
      }
      if (departureAllowance.allowances.accommodation) {
        result.breakdown[departure_country].meals.push('accommodation');
        result.breakdown[departure_country].amounts.accommodation = depRates.accommodation * grade_multiplier;
        departureTotal += depRates.accommodation * grade_multiplier;
      }
    } else {
      // Normal logic for non-Zimbabwe departures - prevent overlapping allowances
      if (departureAllowance.allowances.breakfast && !alreadyCovered.includes('breakfast')) {
        result.breakdown[departure_country].meals.push('breakfast');
        result.breakdown[departure_country].amounts.breakfast = depRates.breakfast * grade_multiplier;
        departureTotal += depRates.breakfast * grade_multiplier;
      }
      if (departureAllowance.allowances.lunch && !alreadyCovered.includes('lunch')) {
        result.breakdown[departure_country].meals.push('lunch');
        result.breakdown[departure_country].amounts.lunch = depRates.lunch * grade_multiplier;
        departureTotal += depRates.lunch * grade_multiplier;
      }
      if (departureAllowance.allowances.dinner && !alreadyCovered.includes('dinner')) {
        result.breakdown[departure_country].meals.push('dinner');
        result.breakdown[departure_country].amounts.dinner = depRates.dinner * grade_multiplier;
        departureTotal += depRates.dinner * grade_multiplier;
      }
      if (departureAllowance.allowances.accommodation && !alreadyCovered.includes('accommodation')) {
        result.breakdown[departure_country].meals.push('accommodation');
        result.breakdown[departure_country].amounts.accommodation = depRates.accommodation * grade_multiplier;
        departureTotal += depRates.accommodation * grade_multiplier;
      }
    }
    
    // Calculate other expenses (10% of total allowance for the day)
    let depMealsCount = 0;
    if (arrival_country === 'Zimbabwe' || departure_country === 'Zimbabwe') {
      // For Zimbabwe scenarios (either arriving or departing), count all eligible meals
      depMealsCount = (departureAllowance.allowances.breakfast ? 1 : 0) + 
                      (departureAllowance.allowances.lunch ? 1 : 0) + 
                      (departureAllowance.allowances.dinner ? 1 : 0);
    } else {
      // For non-Zimbabwe departures, prevent overlapping meals
      depMealsCount = (departureAllowance.allowances.breakfast && !alreadyCovered.includes('breakfast') ? 1 : 0) + 
                      (departureAllowance.allowances.lunch && !alreadyCovered.includes('lunch') ? 1 : 0) + 
                      (departureAllowance.allowances.dinner && !alreadyCovered.includes('dinner') ? 1 : 0);
    }
    
    if (depMealsCount > 0) {
      const otherExpenses = departureTotal * 0.1; // 10% of current total
      result.breakdown[departure_country].amounts.other = otherExpenses;
      departureTotal += otherExpenses;
    }

    result.breakdown[departure_country].total = departureTotal;
    result.total_allowance_amount += departureTotal;
    
    let departureExplanation = `${departure_country} (Departure): ${departureAllowance.reason}`;
    if (arrival_country === 'Zimbabwe') {
      departureExplanation += ` - Using departure country rates (returning to Zimbabwe, allowances cut off upon arrival)`;
    } else if (departure_country === 'Zimbabwe') {
      departureExplanation += ` - Using destination country rates`;
    }
    result.explanations.push(departureExplanation);
  }

  return result;
}

// Country DSA rates (in US$) - meal-based structure
// Structure: { full_day_rate, breakfast_rate, lunch_rate, dinner_rate, accommodation_rate }
const countryRates = {
    'Afghanistan': { full_day: 260, breakfast: 26, lunch: 39, dinner: 39, accommodation: 130 },
    'Albania': { full_day: 220, breakfast: 22, lunch: 33, dinner: 33, accommodation: 110 },
    'Algeria': { full_day: 370, breakfast: 37, lunch: 55.5, dinner: 55.5, accommodation: 185 },
    'Andorra': { full_day: 200, breakfast: 20, lunch: 30, dinner: 30, accommodation: 100 },
    'Angola': { full_day: 420, breakfast: 42, lunch: 63, dinner: 63, accommodation: 210 },
    'Anguilla': { full_day: 530, breakfast: 53, lunch: 79.5, dinner: 79.5, accommodation: 265 },
    'Antigua and Barbuda': { full_day: 420, breakfast: 42, lunch: 63, dinner: 63, accommodation: 210 },
    'Argentina': { full_day: 270, breakfast: 27, lunch: 40.5, dinner: 40.5, accommodation: 135 },
    'Armenia': { full_day: 300, breakfast: 30, lunch: 45, dinner: 45, accommodation: 150 },
    'Aruba': { full_day: 390, breakfast: 39, lunch: 58.5, dinner: 58.5, accommodation: 195 },
    'Australia': { full_day: 360, breakfast: 36, lunch: 54, dinner: 54, accommodation: 180 },
    'Austria': { full_day: 340, breakfast: 34, lunch: 51, dinner: 51, accommodation: 170 },
    'Azerbaijan': { full_day: 320, breakfast: 32, lunch: 48, dinner: 48, accommodation: 160 },
    'Bahamas': { full_day: 450, breakfast: 45, lunch: 67.5, dinner: 67.5, accommodation: 225 },
    'Bahrain': { full_day: 440, breakfast: 44, lunch: 66, dinner: 66, accommodation: 220 },
    'Bangladesh': { full_day: 240, breakfast: 24, lunch: 36, dinner: 36, accommodation: 120 },
    'Barbados': { full_day: 560, breakfast: 56, lunch: 84, dinner: 84, accommodation: 280 },
    'Belarus': { full_day: 230, breakfast: 23, lunch: 34.5, dinner: 34.5, accommodation: 115 },
    'Belgium': { full_day: 390, breakfast: 39, lunch: 58.5, dinner: 58.5, accommodation: 195 },
    'Belize': { full_day: 360, breakfast: 36, lunch: 54, dinner: 54, accommodation: 180 },
    'Benin': { full_day: 220, breakfast: 22, lunch: 33, dinner: 33, accommodation: 110 },
    'Bhutan': { full_day: 240, breakfast: 24, lunch: 36, dinner: 36, accommodation: 120 },
    'Bolivia': { full_day: 220, breakfast: 22, lunch: 33, dinner: 33, accommodation: 110 },
    'Bosnia and Herzegovina': { full_day: 220, breakfast: 22, lunch: 33, dinner: 33, accommodation: 110 },
    'Botswana': { full_day: 290, breakfast: 29, lunch: 43.5, dinner: 43.5, accommodation: 145 },
    'Brazil': { full_day: 260, breakfast: 26, lunch: 39, dinner: 39, accommodation: 130 },
    'British Virgin Islands': { full_day: 370, breakfast: 37, lunch: 55.5, dinner: 55.5, accommodation: 185 },
    'Brunei': { full_day: 220, breakfast: 22, lunch: 33, dinner: 33, accommodation: 110 },
    'Bulgaria': { full_day: 260, breakfast: 26, lunch: 39, dinner: 39, accommodation: 130 },
    'Burkina Faso': { full_day: 250, breakfast: 25, lunch: 37.5, dinner: 37.5, accommodation: 125 },
    'Burundi': { full_day: 260, breakfast: 26, lunch: 39, dinner: 39, accommodation: 130 },
    'Cambodia': { full_day: 310, breakfast: 31, lunch: 46.5, dinner: 46.5, accommodation: 155 },
    'Cameroon': { full_day: 250, breakfast: 25, lunch: 37.5, dinner: 37.5, accommodation: 125 },
    'Canada': { full_day: 380, breakfast: 38, lunch: 57, dinner: 57, accommodation: 190 },
    'Cape Verde': { full_day: 220, breakfast: 22, lunch: 33, dinner: 33, accommodation: 110 },
    'Cayman Islands': { full_day: 420, breakfast: 42, lunch: 63, dinner: 63, accommodation: 210 },
    'Central African Rep.': { full_day: 270, breakfast: 27, lunch: 40.5, dinner: 40.5, accommodation: 135 },
    'Chad': { full_day: 220, breakfast: 22, lunch: 33, dinner: 33, accommodation: 110 },
    'Chile': { full_day: 350, breakfast: 35, lunch: 52.5, dinner: 52.5, accommodation: 175 },
    'China': { full_day: 240, breakfast: 24, lunch: 36, dinner: 36, accommodation: 120 },
    'China, Hong Kong': { full_day: 270, breakfast: 27, lunch: 40.5, dinner: 40.5, accommodation: 135 },
    'China, Macau': { full_day: 200, breakfast: 20, lunch: 30, dinner: 30, accommodation: 100 },
    'Colombia': { full_day: 220, breakfast: 22, lunch: 33, dinner: 33, accommodation: 110 },
    'Comoros': { full_day: 250, breakfast: 25, lunch: 37.5, dinner: 37.5, accommodation: 125 },
    'Congo': { full_day: 320, breakfast: 32, lunch: 48, dinner: 48, accommodation: 160 },
    'Congo, Dem. Rep.': { full_day: 310, breakfast: 31, lunch: 46.5, dinner: 46.5, accommodation: 155 },
    'Costa Rica': { full_day: 290, breakfast: 29, lunch: 43.5, dinner: 43.5, accommodation: 145 },
    'Cote d\'Ivoire': { full_day: 280, breakfast: 28, lunch: 42, dinner: 42, accommodation: 140 },
    'Croatia': { full_day: 310, breakfast: 31, lunch: 46.5, dinner: 46.5, accommodation: 155 },
    'Cuba': { full_day: 280, breakfast: 28, lunch: 42, dinner: 42, accommodation: 140 },
    'Curacao': { full_day: 340, breakfast: 34, lunch: 51, dinner: 51, accommodation: 170 },
    'Cyprus': { full_day: 260, breakfast: 26, lunch: 39, dinner: 39, accommodation: 130 },
    'Czech Republic': { full_day: 280, breakfast: 28, lunch: 42, dinner: 42, accommodation: 140 },
    'Denmark': { full_day: 420, breakfast: 42, lunch: 63, dinner: 63, accommodation: 210 },
    'Djibouti': { full_day: 290, breakfast: 29, lunch: 43.5, dinner: 43.5, accommodation: 145 },
    'Dominica': { full_day: 440, breakfast: 44, lunch: 66, dinner: 66, accommodation: 220 },
    'Dominican Republic': { full_day: 280, breakfast: 28, lunch: 42, dinner: 42, accommodation: 140 },
    'Ecuador': { full_day: 270, breakfast: 27, lunch: 40.5, dinner: 40.5, accommodation: 135 },
    'Egypt': { full_day: 290, breakfast: 29, lunch: 43.5, dinner: 43.5, accommodation: 145 },
    'El Salvador': { full_day: 240, breakfast: 24, lunch: 36, dinner: 36, accommodation: 120 },
    'Equatorial Guinea': { full_day: 340, breakfast: 34, lunch: 51, dinner: 51, accommodation: 170 },
    'Eritrea': { full_day: 250, breakfast: 25, lunch: 37.5, dinner: 37.5, accommodation: 125 },
    'Estonia': { full_day: 280, breakfast: 28, lunch: 42, dinner: 42, accommodation: 140 },
    'Eswatini': { full_day: 180, breakfast: 18, lunch: 27, dinner: 27, accommodation: 90 },
    'Ethiopia': { full_day: 280, breakfast: 28, lunch: 42, dinner: 42, accommodation: 140 },
    'Fiji': { full_day: 370, breakfast: 37, lunch: 55.5, dinner: 55.5, accommodation: 185 },
    'Finland': { full_day: 330, breakfast: 33, lunch: 49.5, dinner: 49.5, accommodation: 165 },
    'France': { full_day: 380, breakfast: 38, lunch: 57, dinner: 57, accommodation: 190 },
    'Gabon': { full_day: 350, breakfast: 35, lunch: 52.5, dinner: 52.5, accommodation: 175 },
    'Gambia': { full_day: 270, breakfast: 27, lunch: 40.5, dinner: 40.5, accommodation: 135 },
    'Georgia': { full_day: 270, breakfast: 27, lunch: 40.5, dinner: 40.5, accommodation: 135 },
    'Germany': { full_day: 330, breakfast: 33, lunch: 49.5, dinner: 49.5, accommodation: 165 },
    'Ghana': { full_day: 410, breakfast: 41, lunch: 61.5, dinner: 61.5, accommodation: 205 },
    'Gibraltar': { full_day: 220, breakfast: 22, lunch: 33, dinner: 33, accommodation: 110 },
    'Greece': { full_day: 240, breakfast: 24, lunch: 36, dinner: 36, accommodation: 120 },
    'Grenada': { full_day: 270, breakfast: 27, lunch: 40.5, dinner: 40.5, accommodation: 135 },
    'Guam': { full_day: 290, breakfast: 29, lunch: 43.5, dinner: 43.5, accommodation: 145 },
    'Guatemala': { full_day: 240, breakfast: 24, lunch: 36, dinner: 36, accommodation: 120 },
    'Guinea': { full_day: 300, breakfast: 30, lunch: 45, dinner: 45, accommodation: 150 },
    'Guinea Bissau': { full_day: 220, breakfast: 22, lunch: 33, dinner: 33, accommodation: 110 },
    'Guyana': { full_day: 250, breakfast: 25, lunch: 37.5, dinner: 37.5, accommodation: 125 },
    'Haiti': { full_day: 300, breakfast: 30, lunch: 45, dinner: 45, accommodation: 150 },
    'Honduras': { full_day: 220, breakfast: 22, lunch: 33, dinner: 33, accommodation: 110 },
    'Hungary': { full_day: 250, breakfast: 25, lunch: 37.5, dinner: 37.5, accommodation: 125 },
    'Iceland': { full_day: 340, breakfast: 34, lunch: 51, dinner: 51, accommodation: 170 },
    'India': { full_day: 330, breakfast: 33, lunch: 49.5, dinner: 49.5, accommodation: 165 },
    'Indonesia': { full_day: 280, breakfast: 28, lunch: 42, dinner: 42, accommodation: 140 },
    'Iran': { full_day: 230, breakfast: 23, lunch: 34.5, dinner: 34.5, accommodation: 115 },
    'Iraq': { full_day: 290, breakfast: 29, lunch: 43.5, dinner: 43.5, accommodation: 145 },
    'Ireland': { full_day: 350, breakfast: 35, lunch: 52.5, dinner: 52.5, accommodation: 175 },
    'Israel': { full_day: 400, breakfast: 40, lunch: 60, dinner: 60, accommodation: 200 },
    'Italy': { full_day: 320, breakfast: 32, lunch: 48, dinner: 48, accommodation: 160 },
    'Jamaica': { full_day: 360, breakfast: 36, lunch: 54, dinner: 54, accommodation: 180 },
    'Japan': { full_day: 340, breakfast: 34, lunch: 51, dinner: 51, accommodation: 170 },
    'Jerusalem': { full_day: 430, breakfast: 43, lunch: 64.5, dinner: 64.5, accommodation: 215 },
    'Jordan': { full_day: 320, breakfast: 32, lunch: 48, dinner: 48, accommodation: 160 },
    'Kazakhstan': { full_day: 220, breakfast: 22, lunch: 33, dinner: 33, accommodation: 110 },
    'Kenya': { full_day: 310, breakfast: 31, lunch: 46.5, dinner: 46.5, accommodation: 155 },
    'Kiribati': { full_day: 140, breakfast: 14, lunch: 21, dinner: 21, accommodation: 70 },
    'North Korea': { full_day: 260, breakfast: 26, lunch: 39, dinner: 39, accommodation: 130 },
    'South Korea': { full_day: 440, breakfast: 44, lunch: 66, dinner: 66, accommodation: 220 },
    'Kuwait': { full_day: 510, breakfast: 51, lunch: 76.5, dinner: 76.5, accommodation: 255 },
    'Kyrgyzstan': { full_day: 250, breakfast: 25, lunch: 37.5, dinner: 37.5, accommodation: 125 },
    'Lao Peo': { full_day: 210, breakfast: 21, lunch: 31.5, dinner: 31.5, accommodation: 105 },
    'Latvia': { full_day: 260, breakfast: 26, lunch: 39, dinner: 39, accommodation: 130 },
    'Lebanon': { full_day: 360, breakfast: 36, lunch: 54, dinner: 54, accommodation: 180 },
    'Lesotho': { full_day: 280, breakfast: 28, lunch: 42, dinner: 42, accommodation: 140 },
    'Liberia': { full_day: 300, breakfast: 30, lunch: 45, dinner: 45, accommodation: 150 },
    'Libya': { full_day: 300, breakfast: 30, lunch: 45, dinner: 45, accommodation: 150 },
    'Lithuania': { full_day: 240, breakfast: 24, lunch: 36, dinner: 36, accommodation: 120 },
    'Luxembourg': { full_day: 290, breakfast: 29, lunch: 43.5, dinner: 43.5, accommodation: 145 },
    'Madagascar': { full_day: 320, breakfast: 32, lunch: 48, dinner: 48, accommodation: 160 },
    'Malawi': { full_day: 260, breakfast: 26, lunch: 39, dinner: 39, accommodation: 130 },
    'Malaysia': { full_day: 220, breakfast: 22, lunch: 33, dinner: 33, accommodation: 110 },
    'Maldives': { full_day: 350, breakfast: 35, lunch: 52.5, dinner: 52.5, accommodation: 175 },
    'Mali': { full_day: 310, breakfast: 31, lunch: 46.5, dinner: 46.5, accommodation: 155 },
    'Malta': { full_day: 300, breakfast: 30, lunch: 45, dinner: 45, accommodation: 150 },
    'Marshall Islands': { full_day: 270, breakfast: 27, lunch: 40.5, dinner: 40.5, accommodation: 135 },
    'Mauritania': { full_day: 250, breakfast: 25, lunch: 37.5, dinner: 37.5, accommodation: 125 },
    'Mauritius': { full_day: 280, breakfast: 28, lunch: 42, dinner: 42, accommodation: 140 },
    'Mexico': { full_day: 410, breakfast: 41, lunch: 61.5, dinner: 61.5, accommodation: 205 },
    'Micronesia': { full_day: 270, breakfast: 27, lunch: 40.5, dinner: 40.5, accommodation: 135 },
    'Moldova': { full_day: 240, breakfast: 24, lunch: 36, dinner: 36, accommodation: 120 },
    'Monaco': { full_day: 360, breakfast: 36, lunch: 54, dinner: 54, accommodation: 180 },
    'Mongolia': { full_day: 220, breakfast: 22, lunch: 33, dinner: 33, accommodation: 110 },
    'Montenegro': { full_day: 340, breakfast: 34, lunch: 51, dinner: 51, accommodation: 170 },
    'Morocco': { full_day: 320, breakfast: 32, lunch: 48, dinner: 48, accommodation: 160 },
    'Mozambique': { full_day: 300, breakfast: 30, lunch: 45, dinner: 45, accommodation: 150 },
    'Myanmar': { full_day: 190, breakfast: 19, lunch: 28.5, dinner: 28.5, accommodation: 95 },
    'Namibia': { full_day: 290, breakfast: 29, lunch: 43.5, dinner: 43.5, accommodation: 145 },
    'Nauru': { full_day: 230, breakfast: 23, lunch: 34.5, dinner: 34.5, accommodation: 115 },
    'Nepal': { full_day: 290, breakfast: 29, lunch: 43.5, dinner: 43.5, accommodation: 145 },
    'Netherlands': { full_day: 330, breakfast: 33, lunch: 49.5, dinner: 49.5, accommodation: 165 },
    'New Zealand': { full_day: 350, breakfast: 35, lunch: 52.5, dinner: 52.5, accommodation: 175 },
    'Nicaragua': { full_day: 220, breakfast: 22, lunch: 33, dinner: 33, accommodation: 110 },
    'Niger': { full_day: 260, breakfast: 26, lunch: 39, dinner: 39, accommodation: 130 },
    'Nigeria': { full_day: 280, breakfast: 28, lunch: 42, dinner: 42, accommodation: 140 },
    'Niue': { full_day: 330, breakfast: 33, lunch: 49.5, dinner: 49.5, accommodation: 165 },
    'Norway': { full_day: 400, breakfast: 40, lunch: 60, dinner: 60, accommodation: 200 },
    'Oman': { full_day: 330, breakfast: 33, lunch: 49.5, dinner: 49.5, accommodation: 165 },
    'Pakistan': { full_day: 270, breakfast: 27, lunch: 40.5, dinner: 40.5, accommodation: 135 },
    'Palau': { full_day: 320, breakfast: 32, lunch: 48, dinner: 48, accommodation: 160 },
    'Palestine': { full_day: 280, breakfast: 28, lunch: 42, dinner: 42, accommodation: 140 },
    'Panama': { full_day: 260, breakfast: 26, lunch: 39, dinner: 39, accommodation: 130 },
    'Papua New Guinea': { full_day: 310, breakfast: 31, lunch: 46.5, dinner: 46.5, accommodation: 155 },
    'Paraguay': { full_day: 260, breakfast: 26, lunch: 39, dinner: 39, accommodation: 130 },
    'Peru': { full_day: 280, breakfast: 28, lunch: 42, dinner: 42, accommodation: 140 },
    'Philippines': { full_day: 280, breakfast: 28, lunch: 42, dinner: 42, accommodation: 140 },
    'Poland': { full_day: 280, breakfast: 28, lunch: 42, dinner: 42, accommodation: 140 },
    'Portugal': { full_day: 340, breakfast: 34, lunch: 51, dinner: 51, accommodation: 170 },
    'Qatar': { full_day: 400, breakfast: 40, lunch: 60, dinner: 60, accommodation: 200 },
    'Romania': { full_day: 260, breakfast: 26, lunch: 39, dinner: 39, accommodation: 130 },
    'Russian Federation': { full_day: 360, breakfast: 36, lunch: 54, dinner: 54, accommodation: 180 },
    'Rwanda': { full_day: 270, breakfast: 27, lunch: 40.5, dinner: 40.5, accommodation: 135 },
    'Saint Maarteen': { full_day: 300, breakfast: 30, lunch: 45, dinner: 45, accommodation: 150 },
    'Saint Lucia': { full_day: 470, breakfast: 47, lunch: 70.5, dinner: 70.5, accommodation: 235 },
    'Saint Kitts and Nevis': { full_day: 430, breakfast: 43, lunch: 64.5, dinner: 64.5, accommodation: 215 },
    'Saint Vincent-Grenadines': { full_day: 470, breakfast: 47, lunch: 70.5, dinner: 70.5, accommodation: 235 },
    'Samoa': { full_day: 300, breakfast: 30, lunch: 45, dinner: 45, accommodation: 150 },
    'San Marino': { full_day: 260, breakfast: 26, lunch: 39, dinner: 39, accommodation: 130 },
    'Sao Tome and Principe': { full_day: 340, breakfast: 34, lunch: 51, dinner: 51, accommodation: 170 },
    'Saudi Arabia': { full_day: 480, breakfast: 48, lunch: 72, dinner: 72, accommodation: 240 },
    'Senegal': { full_day: 310, breakfast: 31, lunch: 46.5, dinner: 46.5, accommodation: 155 },
    'Serbia': { full_day: 220, breakfast: 22, lunch: 33, dinner: 33, accommodation: 110 },
    'Seychelles': { full_day: 330, breakfast: 33, lunch: 49.5, dinner: 49.5, accommodation: 165 },
    'Sierra Leone': { full_day: 290, breakfast: 29, lunch: 43.5, dinner: 43.5, accommodation: 145 },
    'Singapore': { full_day: 440, breakfast: 44, lunch: 66, dinner: 66, accommodation: 220 },
    'Slovak Republic': { full_day: 280, breakfast: 28, lunch: 42, dinner: 42, accommodation: 140 },
    'Slovenia': { full_day: 310, breakfast: 31, lunch: 46.5, dinner: 46.5, accommodation: 155 },
    'Solomon Islands': { full_day: 350, breakfast: 35, lunch: 52.5, dinner: 52.5, accommodation: 175 },
    'Somalia': { full_day: 240, breakfast: 24, lunch: 36, dinner: 36, accommodation: 120 },
    'South Africa': { full_day: 270, breakfast: 27, lunch: 40.5, dinner: 40.5, accommodation: 135 },
    'South Sudan': { full_day: 210, breakfast: 21, lunch: 31.5, dinner: 31.5, accommodation: 105 },
    'Spain': { full_day: 290, breakfast: 29, lunch: 43.5, dinner: 43.5, accommodation: 145 },
    'Sri Lanka': { full_day: 240, breakfast: 24, lunch: 36, dinner: 36, accommodation: 120 },
    'Sudan': { full_day: 260, breakfast: 26, lunch: 39, dinner: 39, accommodation: 130 },
    'Suriname': { full_day: 220, breakfast: 22, lunch: 33, dinner: 33, accommodation: 110 },
    'Sweden': { full_day: 390, breakfast: 39, lunch: 58.5, dinner: 58.5, accommodation: 195 },
    'Switzerland': { full_day: 430, breakfast: 43, lunch: 64.5, dinner: 64.5, accommodation: 215 },
    'Syrian Arabic Republic': { full_day: 240, breakfast: 24, lunch: 36, dinner: 36, accommodation: 120 },
    'Taiwan': { full_day: 340, breakfast: 34, lunch: 51, dinner: 51, accommodation: 170 },
    'Tajikistan': { full_day: 180, breakfast: 18, lunch: 27, dinner: 27, accommodation: 90 },
    'Tanzania': { full_day: 260, breakfast: 26, lunch: 39, dinner: 39, accommodation: 130 },
    'Thailand': { full_day: 260, breakfast: 26, lunch: 39, dinner: 39, accommodation: 130 },
    'The Republic of North Macedonia': { full_day: 170, breakfast: 17, lunch: 25.5, dinner: 25.5, accommodation: 85 },
    'Timor-Leste': { full_day: 210, breakfast: 21, lunch: 31.5, dinner: 31.5, accommodation: 105 },
    'Togo': { full_day: 280, breakfast: 28, lunch: 42, dinner: 42, accommodation: 140 },
    'Tokelau': { full_day: 130, breakfast: 13, lunch: 19.5, dinner: 19.5, accommodation: 65 },
    'Trinidad and Tobago': { full_day: 380, breakfast: 38, lunch: 57, dinner: 57, accommodation: 190 },
    'Tunisia': { full_day: 260, breakfast: 26, lunch: 39, dinner: 39, accommodation: 130 },
    'Turkey': { full_day: 260, breakfast: 26, lunch: 39, dinner: 39, accommodation: 130 },
    'Turkmenistan': { full_day: 260, breakfast: 26, lunch: 39, dinner: 39, accommodation: 130 },
    'Turks and Caicos Islands': { full_day: 540, breakfast: 54, lunch: 81, dinner: 81, accommodation: 270 },
    'Tuvalu': { full_day: 220, breakfast: 22, lunch: 33, dinner: 33, accommodation: 110 },
    'Uganda': { full_day: 280, breakfast: 28, lunch: 42, dinner: 42, accommodation: 140 },
    'Ukraine': { full_day: 290, breakfast: 29, lunch: 43.5, dinner: 43.5, accommodation: 145 },
    'United Arab Emirates': { full_day: 420, breakfast: 42, lunch: 63, dinner: 63, accommodation: 210 },
    'United Kingdom': { full_day: 390, breakfast: 39, lunch: 58.5, dinner: 58.5, accommodation: 195 },
    'Uruguay': { full_day: 250, breakfast: 25, lunch: 37.5, dinner: 37.5, accommodation: 125 },
    'USA': { full_day: 460, breakfast: 46, lunch: 69, dinner: 69, accommodation: 230 },
    'Uzbekistan': { full_day: 180, breakfast: 18, lunch: 27, dinner: 27, accommodation: 90 },
    'Vanuatu': { full_day: 330, breakfast: 33, lunch: 49.5, dinner: 49.5, accommodation: 165 },
    'Virgin Islands': { full_day: 500, breakfast: 50, lunch: 75, dinner: 75, accommodation: 250 },
    'Vietnam': { full_day: 260, breakfast: 26, lunch: 39, dinner: 39, accommodation: 130 },
    'Western Sahara': { full_day: 160, breakfast: 16, lunch: 24, dinner: 24, accommodation: 80 },
    'Yemen': { full_day: 290, breakfast: 29, lunch: 43.5, dinner: 43.5, accommodation: 145 },
    'Zambia': { full_day: 240, breakfast: 24, lunch: 36, dinner: 36, accommodation: 120 },
    'Zimbabwe': { full_day: 0, breakfast: 0, lunch: 0, dinner: 0, accommodation: 0 }
};

// Flight duration database (in hours) - approximate average flight times
const flightDurations = {
    'United Kingdom-USA': 8, 'USA-United Kingdom': 7,
    'United Kingdom-France': 1.5, 'France-United Kingdom': 1.5,
    'United Kingdom-Germany': 2, 'Germany-United Kingdom': 2,
    'United Kingdom-Spain': 2.5, 'Spain-United Kingdom': 2.5,
    'United Kingdom-Italy': 2.5, 'Italy-United Kingdom': 2.5,
    'United Kingdom-Netherlands': 1.5, 'Netherlands-United Kingdom': 1.5,
    'United Kingdom-Belgium': 1.5, 'Belgium-United Kingdom': 1.5,
    'USA-France': 9, 'France-USA': 9,
    'USA-Germany': 9.5, 'Germany-USA': 9.5,
    'USA-Spain': 9, 'Spain-USA': 9,
    'USA-Italy': 10, 'Italy-USA': 10,
    'USA-Netherlands': 8.5, 'Netherlands-USA': 8.5,
    'USA-Belgium': 8.5, 'Belgium-USA': 8.5,
    'France-Germany': 1.5, 'Germany-France': 1.5,
    'France-Spain': 2, 'Spain-France': 2,
    'France-Italy': 1.5, 'Italy-France': 1.5,
    'France-Netherlands': 1.5, 'Netherlands-France': 1.5,
    'France-Belgium': 1, 'Belgium-France': 1,
    'Germany-Spain': 2.5, 'Spain-Germany': 2.5,
    'Germany-Italy': 1.5, 'Italy-Germany': 1.5,
    'Germany-Netherlands': 1.5, 'Netherlands-Germany': 1.5,
    'Germany-Belgium': 1.5, 'Belgium-Germany': 1.5,
    'Spain-Italy': 2, 'Italy-Spain': 2,
    'Spain-Netherlands': 2.5, 'Netherlands-Spain': 2.5,
    'Spain-Belgium': 2, 'Belgium-Spain': 2,
    'Italy-Netherlands': 2, 'Netherlands-Italy': 2,
    'Italy-Belgium': 2, 'Belgium-Italy': 2,
    'Netherlands-Belgium': 0.5, 'Belgium-Netherlands': 0.5,
    // African routes
    'South Africa-United Kingdom': 11, 'United Kingdom-South Africa': 11,
    'South Africa-USA': 15, 'USA-South Africa': 15,
    'Zimbabwe-South Africa': 2, 'South Africa-Zimbabwe': 2,
    'Zimbabwe-United Kingdom': 10, 'United Kingdom-Zimbabwe': 10,
    'Kenya-United Kingdom': 9, 'United Kingdom-Kenya': 9,
    'Ethiopia-United Kingdom': 7, 'United Kingdom-Ethiopia': 7
};

// Grade multipliers for daily allowance (times per diem base rate)
const gradeMultipliers = {
    'minister': 1.50,
    'accounting': 1.45,
    'accounting_non': 1.40,
    'chief_director': 1.35,
    'director': 1.30,
    'deputy_director': 1.25,
    'officer': 1.00
};

// Representation allowance percentages
const representationPercentages = {
    'minister': 10.0,
    'accounting': 9.5,
    'accounting_non': 8.5,
    'chief_director': 8.0,
    'director': 7.5,
    'deputy_director': 5.0,
    'officer': 0.0
};

// DSA component percentages
const dsaComponents = {
    accommodation: 50,
    lunch: 15,
    dinner: 15,
    breakfast: 10,
    other: 10
};

function getFlightDuration(from, to) {
    if (from === to) return 0;
    const key = `${from}-${to}`;
    return flightDurations[key] || 3; // Default to 3 hours if route not found
}

function formatHours(hours) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`; // 24-hour format: displays total hours (can be > 24)
}

// Meal eligibility functions based on Zimbabwe Government DSA rules
function isBreakfastEligible(departureTime, arrivalTime, isOvernightTravel) {
    const depHour = departureTime.getHours();
    const arrHour = arrivalTime.getHours();
    const sameDay = departureTime.toDateString() === arrivalTime.toDateString();
    
    // Departure before 07:00 - eligible
    if (depHour < 7) return true;
    
    // Arrival before 06:00 after overnight - eligible
    if (!sameDay && arrHour < 6) return true;
    
    return false;
}

function isLunchEligible(departureTime, arrivalTime) {
    const depHour = departureTime.getHours();
    const arrHour = arrivalTime.getHours();
    
    // If departing between 07:00-11:59 and still traveling during 12:00-14:00
    if (depHour >= 7 && depHour < 12) {
        // Check if journey extends into lunch period
        if (arrHour >= 12 || (arrHour < 12 && arrivalTime > departureTime)) {
            // Check if actually traveling during 12:00-14:00
            const lunchStart = new Date(departureTime);
            lunchStart.setHours(12, 0, 0, 0);
            const lunchEnd = new Date(departureTime);
            lunchEnd.setHours(14, 0, 0, 0);
            
            if (arrivalTime >= lunchStart && departureTime < lunchEnd) {
                return true;
            }
        }
    }
    
    // Arrival during 12:00-14:00 - eligible
    if (arrHour >= 12 && arrHour < 14) return true;
    if (arrHour == 14 && arrivalTime.getMinutes() == 0) return true;
    
    return false;
}

function isDinnerEligible(departureTime, arrivalTime) {
    const depHour = departureTime.getHours();
    const arrHour = arrivalTime.getHours();
    
    // If still away after 18:00 (6 p.m.)
    if (arrHour >= 18 || arrHour < 6) return true;
    
    // Check if traveling during dinner period (18:00-20:00)
    const dinnerStart = new Date(departureTime);
    dinnerStart.setHours(18, 0, 0, 0);
    const dinnerEnd = new Date(departureTime);
    dinnerEnd.setHours(20, 0, 0, 0);
    
    if (arrivalTime >= dinnerStart && departureTime < dinnerEnd) {
        return true;
    }
    
    return false;
}

function isAccommodationEligible(departureTime, arrivalTime) {
    // Still away after midnight (00:00)
    const depDate = departureTime.toDateString();
    const arrDate = arrivalTime.toDateString();
    
    // If arrival is on a different day, accommodation is eligible
    return depDate !== arrDate;
}

// Calculate DSA for destination stay where full days get all meals
function calculateDestinationDSA(arrivalTime, departureTime, perDiemRate, gradeMultiplier) {
    const dailyAllowance = perDiemRate * gradeMultiplier;
    let breakdown = {
        breakfast: 0,
        lunch: 0,
        dinner: 0,
        accommodation: 0,
        other: 0,
        breakfastCount: 0,
        lunchCount: 0,
        dinnerCount: 0,
        nightCount: 0
    };
    
    // Count complete 24-hour periods (full days)
    const stayMs = departureTime - arrivalTime;
    const stayHours = stayMs / (1000 * 60 * 60);
    const fullDays = Math.floor(stayHours / 24);
    
    // For each full day at destination, all meals are eligible
    if (fullDays > 0) {
        breakdown.breakfast = (dailyAllowance * dsaComponents.breakfast / 100) * fullDays;
        breakdown.lunch = (dailyAllowance * dsaComponents.lunch / 100) * fullDays;
        breakdown.dinner = (dailyAllowance * dsaComponents.dinner / 100) * fullDays;
        breakdown.accommodation = (dailyAllowance * dsaComponents.accommodation / 100) * fullDays;
        breakdown.other = (dailyAllowance * dsaComponents.other / 100) * fullDays;
        breakdown.breakfastCount = fullDays;
        breakdown.lunchCount = fullDays;
        breakdown.dinnerCount = fullDays;
        breakdown.nightCount = fullDays;
    }
    
    // Handle partial day at start (arrival day) and end (departure day)
    const arrivalDate = new Date(arrivalTime);
    arrivalDate.setHours(0, 0, 0, 0);
    const firstFullDayStart = new Date(arrivalDate);
    firstFullDayStart.setDate(firstFullDayStart.getDate() + 1);
    
    const departureDate = new Date(departureTime);
    departureDate.setHours(0, 0, 0, 0);
    
    // Partial arrival day (if arrival is not on same day as first full day)
    if (arrivalTime < firstFullDayStart && fullDays >= 0) {
        const arrivalHour = arrivalTime.getHours();
        // Check which meals are still available on arrival day
        if (arrivalHour < 12) { // Arrived before lunch
            breakdown.lunch += (dailyAllowance * dsaComponents.lunch / 100);
            breakdown.lunchCount++;
        }
        if (arrivalHour < 18) { // Arrived before dinner
            breakdown.dinner += (dailyAllowance * dsaComponents.dinner / 100);
            breakdown.dinnerCount++;
        }
        // Always get accommodation for arrival night if staying overnight
        if (fullDays > 0 || departureTime.toDateString() !== arrivalTime.toDateString()) {
            breakdown.accommodation += (dailyAllowance * dsaComponents.accommodation / 100);
            breakdown.nightCount++;
        }
    }
    
    // Partial departure day (if departure is not at midnight)
    const lastFullDayEnd = new Date(departureDate);
    if (departureTime > lastFullDayEnd && fullDays >= 0) {
        const departureHour = departureTime.getHours();
        // Check which meals can be claimed on departure day
        if (departureHour >= 7) { // Stayed past breakfast time
            breakdown.breakfast += (dailyAllowance * dsaComponents.breakfast / 100);
            breakdown.breakfastCount++;
        }
        if (departureHour >= 14) { // Stayed past lunch time
            breakdown.lunch += (dailyAllowance * dsaComponents.lunch / 100);
            breakdown.lunchCount++;
        }
    }
    
    const totalDSA = breakdown.breakfast + breakdown.lunch + breakdown.dinner + breakdown.accommodation + breakdown.other;
    return { totalDSA, breakdown };
}

// Calculate DSA for travel segment - uses the country rate based on WHERE you are WHEN the meal time occurs
function calculateTravelDSA(departureTime, arrivalTime, departureCountryRate, destinationCountryRate, gradeMultiplier) {
    const departureDailyAllowance = departureCountryRate * gradeMultiplier;
    const destinationDailyAllowance = destinationCountryRate * gradeMultiplier;
    let totalDSA = 0;
    let breakdown = {
        breakfast: 0,
        lunch: 0,
        dinner: 0,
        accommodation: 0,
        other: 0,
        breakfastCount: 0,
        lunchCount: 0,
        dinnerCount: 0,
        nightCount: 0
    };
    
    const isOvernight = departureTime.toDateString() !== arrivalTime.toDateString();
    const depHour = departureTime.getHours();
    const depMin = departureTime.getMinutes();
    const arrHour = arrivalTime.getHours();
    const arrMin = arrivalTime.getMinutes();
    
    // Define meal time windows
    const breakfastStart = new Date(departureTime);
    breakfastStart.setHours(6, 0, 0, 0);
    const breakfastEnd = new Date(departureTime);
    breakfastEnd.setHours(9, 0, 0, 0);
    
    const lunchStart = new Date(departureTime);
    lunchStart.setHours(12, 0, 0, 0);
    const lunchEnd = new Date(departureTime);
    lunchEnd.setHours(14, 0, 0, 0);
    
    const dinnerStart = new Date(departureTime);
    dinnerStart.setHours(18, 0, 0, 0);
    const dinnerEnd = new Date(departureTime);
    dinnerEnd.setHours(20, 0, 0, 0);
    
    // BREAKFAST (6:00-9:00)
    // Use per diem based on where you are DURING breakfast time
    if (depHour < 7) {
        // Depart before 07:00 - eligible for breakfast in DEPARTURE country
        breakdown.breakfast += (departureDailyAllowance * dsaComponents.breakfast) / 100;
        breakdown.breakfastCount++;
    } else if (departureTime < breakfastEnd && arrivalTime > breakfastStart) {
        // You are traveling during breakfast time (6:00-9:00)
        if (arrivalTime < breakfastEnd) {
            // Arrive BEFORE breakfast ends - you have breakfast in DESTINATION country
            breakdown.breakfast += (destinationDailyAllowance * dsaComponents.breakfast) / 100;
            breakdown.breakfastCount++;
        } else {
            // Arrive AFTER breakfast ends - you had breakfast in DEPARTURE country (while traveling)
            breakdown.breakfast += (departureDailyAllowance * dsaComponents.breakfast) / 100;
            breakdown.breakfastCount++;
        }
    } else if (isOvernight && arrHour < 12) {
        // Overnight travel, arrive before lunch next day - breakfast in DESTINATION country
        breakdown.breakfast += (destinationDailyAllowance * dsaComponents.breakfast) / 100;
        breakdown.breakfastCount++;
    }
    
    // LUNCH (12:00-14:00)
    // Use per diem based on where you are DURING lunch time
    if (departureTime < lunchEnd && arrivalTime > lunchStart) {
        // You are traveling during lunch time (12:00-14:00)
        if (arrivalTime < lunchEnd) {
            // Arrive BEFORE lunch ends - you have lunch in DESTINATION country
            breakdown.lunch += (destinationDailyAllowance * dsaComponents.lunch) / 100;
            breakdown.lunchCount++;
        } else {
            // Arrive AFTER lunch ends - you had lunch in DEPARTURE country (while traveling)
            breakdown.lunch += (departureDailyAllowance * dsaComponents.lunch) / 100;
            breakdown.lunchCount++;
        }
    }
    
    // DINNER (18:00-20:00)
    // Use per diem based on where you are DURING dinner time
    if (departureTime < dinnerEnd && arrivalTime > dinnerStart) {
        // You are traveling during dinner time (18:00-20:00)
        if (arrivalTime < dinnerEnd) {
            // Arrive BEFORE dinner ends - you have dinner in DESTINATION country
            breakdown.dinner += (destinationDailyAllowance * dsaComponents.dinner) / 100;
            breakdown.dinnerCount++;
        } else {
            // Arrive AFTER dinner ends
            if (arrivalTime.toDateString() === departureTime.toDateString()) {
                // Same day - you have dinner in DESTINATION country (already arrived)
                breakdown.dinner += (destinationDailyAllowance * dsaComponents.dinner) / 100;
                breakdown.dinnerCount++;
            } else {
                // Different day - you had dinner in DEPARTURE country (while traveling on departure day)
                breakdown.dinner += (departureDailyAllowance * dsaComponents.dinner) / 100;
                breakdown.dinnerCount++;
            }
        }
    } else if (isOvernight && arrHour >= 18) {
        // Overnight, arrive during/after dinner time on arrival day - dinner in DESTINATION country
        breakdown.dinner += (destinationDailyAllowance * dsaComponents.dinner) / 100;
        breakdown.dinnerCount++;
    }
    
    // ACCOMMODATION
    // If overnight travel, where do you spend the night?
    if (isOvernight) {
        // You spend the night either in transit or at destination
        // Use DESTINATION rate (you're heading to/at destination)
        breakdown.accommodation += (destinationDailyAllowance * dsaComponents.accommodation) / 100;
        breakdown.nightCount++;
    }
    
    // Other expenses - based on average of both countries
    const avgDailyAllowance = (departureDailyAllowance + destinationDailyAllowance) / 2;
    const daysWithMeals = Math.ceil((breakdown.breakfastCount + breakdown.lunchCount + breakdown.dinnerCount) / 3);
    breakdown.other = (avgDailyAllowance * dsaComponents.other / 100) * daysWithMeals;
    
    totalDSA = breakdown.breakfast + breakdown.lunch + breakdown.dinner + breakdown.accommodation + breakdown.other;
    
    return { totalDSA, breakdown };
}

// Calculate DSA for a journey segment using meal-based eligibility (legacy - for layovers)
function calculateSegmentDSA(departureTime, arrivalTime, perDiemRate, gradeMultiplier) {
    const dailyAllowance = perDiemRate * gradeMultiplier;
    let totalDSA = 0;
    let breakdown = {
        breakfast: 0,
        lunch: 0,
        dinner: 0,
        accommodation: 0,
        other: 0,
        breakfastCount: 0,
        lunchCount: 0,
        dinnerCount: 0,
        nightCount: 0
    };
    
    // Check if this is overnight travel
    const isOvernight = departureTime.toDateString() !== arrivalTime.toDateString();
    
    // Calculate number of nights (for multi-day trips)
    const startDate = new Date(departureTime);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(arrivalTime);
    endDate.setHours(0, 0, 0, 0);
    const nightCount = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    // For each day of the journey
    let currentDate = new Date(departureTime);
    let dayCount = 0;
    
    while (currentDate <= arrivalTime && dayCount < 100) { // Safety limit
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);
        
        const effectiveStart = dayCount === 0 ? departureTime : dayStart;
        const effectiveEnd = currentDate.toDateString() === arrivalTime.toDateString() ? arrivalTime : dayEnd;
        
        // Check breakfast eligibility for this day
        if (dayCount === 0 && isBreakfastEligible(effectiveStart, effectiveEnd, isOvernight)) {
            breakdown.breakfast += (dailyAllowance * dsaComponents.breakfast) / 100;
            breakdown.breakfastCount++;
        } else if (dayCount > 0 && effectiveEnd.getHours() >= 6) {
            // Subsequent days - breakfast eligible if still traveling after 06:00
            breakdown.breakfast += (dailyAllowance * dsaComponents.breakfast) / 100;
            breakdown.breakfastCount++;
        }
        
        // Check lunch eligibility for this day
        if (isLunchEligible(effectiveStart, effectiveEnd)) {
            breakdown.lunch += (dailyAllowance * dsaComponents.lunch) / 100;
            breakdown.lunchCount++;
        }
        
        // Check dinner eligibility for this day  
        if (isDinnerEligible(effectiveStart, effectiveEnd)) {
            breakdown.dinner += (dailyAllowance * dsaComponents.dinner) / 100;
            breakdown.dinnerCount++;
        }
        
        // Check accommodation - if not the last day, accommodation eligible
        if (currentDate.toDateString() !== arrivalTime.toDateString()) {
            breakdown.accommodation += (dailyAllowance * dsaComponents.accommodation) / 100;
            breakdown.nightCount++;
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
        dayCount++;
    }
    
    // Other expenses - 10% per day with any eligible meal
    const daysWithMeals = Math.ceil((breakdown.breakfastCount + breakdown.lunchCount + breakdown.dinnerCount) / 3);
    breakdown.other = (dailyAllowance * dsaComponents.other / 100) * daysWithMeals;
    
    totalDSA = breakdown.breakfast + breakdown.lunch + breakdown.dinner + breakdown.accommodation + breakdown.other;
    
    return { totalDSA, breakdown };
}

function calculate() {
    // Get input values
    const grade = document.getElementById('grade').value;
    const purpose = document.getElementById('purpose').value.trim();
    const startDate = new Date(document.getElementById('departureDate-0').value);
    const fundingSource = document.getElementById('fundingSource').value;

    // Get all outbound routes with dates
    const allDepartures = document.querySelectorAll('.departure-select');
    const allDestinations = document.querySelectorAll('.destination-select');
    const allDepartureDates = document.querySelectorAll('.departure-date');
    const allArrivalDates = document.querySelectorAll('.arrival-date');
    
    let routes = [];
    allDepartures.forEach((depSelect, index) => {
        const dep = depSelect.value;
        const dest = allDestinations[index].value;
        const depDate = allDepartureDates[index].value;
        const arrDate = allArrivalDates[index].value;
        if (dep && dest && depDate && arrDate) {
            routes.push({ 
                from: dep, 
                to: dest,
                departureDate: new Date(depDate),
                arrivalDate: new Date(arrDate)
            });
        }
    });
    
    // Get all return journey routes with dates
    const allReturnDepartures = document.querySelectorAll('.return-departure-select');
    const allReturnDestinations = document.querySelectorAll('.return-destination-select');
    const allReturnDepartureDates = document.querySelectorAll('.return-departure-date');
    const allReturnArrivalDates = document.querySelectorAll('.return-arrival-date');
    
    let returnRoutes = [];
    allReturnDepartures.forEach((depSelect, index) => {
        const dep = depSelect.value;
        const dest = allReturnDestinations[index].value;
        const depDate = allReturnDepartureDates[index].value;
        const arrDate = allReturnArrivalDates[index].value;
        if (dep && dest && depDate && arrDate) {
            returnRoutes.push({ 
                from: dep, 
                to: dest,
                departureDate: new Date(depDate),
                arrivalDate: new Date(arrDate)
            });
        }
    });

    // Validation
    if (!grade) {
        alert('Please select an official grade');
        return;
    }

    if (!purpose) {
        alert('Please enter the purpose of the journey');
        return;
    }

    if (routes.length === 0) {
        alert('Please complete all fields for at least one outbound route');
        return;
    }
    
    if (returnRoutes.length === 0) {
        alert('Please complete all fields for at least one return route');
        return;
    }
    
    // Get the last return arrival date as the end date
    const endDate = returnRoutes[returnRoutes.length - 1].arrivalDate;

    if (startDate >= endDate) {
        alert('Return date must be after departure date');
        return;
    }

    // Calculate DSA using meal-based eligibility
    const gradeMultiplier = gradeMultipliers[grade];
    let totalDSA = 0;
    let totalBreakfast = 0, totalLunch = 0, totalDinner = 0, totalAccommodation = 0, totalOther = 0;
    let breakfastCount = 0, lunchCount = 0, dinnerCount = 0, nightCount = 0;
    
    // Track outbound journey - meal-based DSA
    let totalOutboundHours = 0;
    let currentTime = new Date(startDate);
    
    for (let i = 0; i < routes.length; i++) {
        const legDepartureTime = routes[i].departureDate;
        const legArrivalTime = routes[i].arrivalDate;
        const legDurationMs = legArrivalTime - legDepartureTime;
        const legHours = legDurationMs / (1000 * 60 * 60);
        
        totalOutboundHours += legHours;
        
        // Calculate DSA for this leg using calculateAllowance with dynamic country rates
        const legDeparturePerDiem = countryRates[routes[i].from].full_day;
        const legDestinationPerDiem = countryRates[routes[i].to].full_day;
        const legResult = calculateAllowance(routes[i].from, routes[i].to, legDepartureTime, legArrivalTime, countryRates, gradeMultiplier);
        
        totalDSA += legResult.total_allowance_amount;
        // Extract meal amounts from breakdown by country
        Object.keys(legResult.breakdown).forEach(country => {
            const countryBreakdown = legResult.breakdown[country];
            totalBreakfast += countryBreakdown.amounts.breakfast || 0;
            totalLunch += countryBreakdown.amounts.lunch || 0;
            totalDinner += countryBreakdown.amounts.dinner || 0;
            totalAccommodation += countryBreakdown.amounts.accommodation || 0;
            totalOther += countryBreakdown.amounts.other || 0;
            // Count meals
            if (countryBreakdown.meals.includes('breakfast')) breakfastCount++;
            if (countryBreakdown.meals.includes('lunch')) lunchCount++;
            if (countryBreakdown.meals.includes('dinner')) dinnerCount++;
            if (countryBreakdown.meals.includes('accommodation')) nightCount++;
        });
        
        currentTime = legArrivalTime;
        
        // If there's a next route, calculate layover DSA
        if (i < routes.length - 1) {
            const nextDepartureTime = routes[i + 1].departureDate;
            const layoverMs = nextDepartureTime - legArrivalTime;
            const layoverHours = layoverMs / (1000 * 60 * 60);
            
            // Special rule: If arriving in Zimbabwe, NO layover allowances are calculated
            if (routes[i].to !== 'Zimbabwe') {
                // During layover, use the current destination country's rate
                const layoverResult = calculateSegmentDSA(legArrivalTime, nextDepartureTime, countryRates[routes[i].to].full_day, gradeMultiplier);
                
                totalDSA += layoverResult.totalDSA;
                totalBreakfast += layoverResult.breakdown.breakfast;
                totalLunch += layoverResult.breakdown.lunch;
                totalDinner += layoverResult.breakdown.dinner;
                totalAccommodation += layoverResult.breakdown.accommodation;
                totalOther += layoverResult.breakdown.other;
                breakfastCount += layoverResult.breakdown.breakfastCount;
                lunchCount += layoverResult.breakdown.lunchCount;
                dinnerCount += layoverResult.breakdown.dinnerCount;
                nightCount += layoverResult.breakdown.nightCount;
            }
            
            totalOutboundHours += layoverHours;
            currentTime = nextDepartureTime;
        }
    }
    
    // Calculate DSA for time at final destination
    const lastDestination = routes[routes.length - 1].to;
    const destinationPerDiem = countryRates[lastDestination].full_day;
    const returnStartTime = returnRoutes[0].departureDate;
    
    const timeAtDestinationMs = returnStartTime - currentTime;
    const timeAtDestinationHours = Math.max(0, timeAtDestinationMs / (1000 * 60 * 60));
    
    // Calculate meal-based DSA for destination stay (full days get all meals)
    const destinationResult = calculateDestinationDSA(currentTime, returnStartTime, destinationPerDiem, gradeMultiplier);
    
    totalDSA += destinationResult.totalDSA;
    totalBreakfast += destinationResult.breakdown.breakfast;
    totalLunch += destinationResult.breakdown.lunch;
    totalDinner += destinationResult.breakdown.dinner;
    totalAccommodation += destinationResult.breakdown.accommodation;
    totalOther += destinationResult.breakdown.other;
    breakfastCount += destinationResult.breakdown.breakfastCount;
    lunchCount += destinationResult.breakdown.lunchCount;
    dinnerCount += destinationResult.breakdown.dinnerCount;
    nightCount += destinationResult.breakdown.nightCount;
    
    const daysAtDestination = timeAtDestinationHours / 24;
    
    // Track return journey - DSA based on destination country of each leg
    let totalReturnHours = 0;
    currentTime = returnStartTime;
    
    for (let i = 0; i < returnRoutes.length; i++) {
        const legDepartureTime = returnRoutes[i].departureDate;
        const legArrivalTime = returnRoutes[i].arrivalDate;
        const legDurationMs = legArrivalTime - legDepartureTime;
        const legHours = legDurationMs / (1000 * 60 * 60);
        
        totalReturnHours += legHours;
        
        // Calculate DSA for this return leg using calculateAllowance with dynamic country rates
        // Note: calculateAllowance automatically returns 0 allowances when arriving in Zimbabwe
        const legDeparturePerDiem = countryRates[returnRoutes[i].from].full_day;
        const legDestinationPerDiem = countryRates[returnRoutes[i].to].full_day;
        const legResult = calculateAllowance(returnRoutes[i].from, returnRoutes[i].to, legDepartureTime, legArrivalTime, countryRates, gradeMultiplier);
        
        totalDSA += legResult.total_allowance_amount;
        // Extract meal amounts from breakdown by country
        Object.keys(legResult.breakdown).forEach(country => {
            const countryBreakdown = legResult.breakdown[country];
            totalBreakfast += countryBreakdown.amounts.breakfast || 0;
            totalLunch += countryBreakdown.amounts.lunch || 0;
            totalDinner += countryBreakdown.amounts.dinner || 0;
            totalAccommodation += countryBreakdown.amounts.accommodation || 0;
            totalOther += countryBreakdown.amounts.other || 0;
            // Count meals
            if (countryBreakdown.meals.includes('breakfast')) breakfastCount++;
            if (countryBreakdown.meals.includes('lunch')) lunchCount++;
            if (countryBreakdown.meals.includes('dinner')) dinnerCount++;
            if (countryBreakdown.meals.includes('accommodation')) nightCount++;
        });
        
        currentTime = legArrivalTime;
        
        // If there's a next return route, calculate layover DSA
        if (i < returnRoutes.length - 1) {
            const nextDepartureTime = returnRoutes[i + 1].departureDate;
            const layoverMs = nextDepartureTime - legArrivalTime;
            const layoverHours = layoverMs / (1000 * 60 * 60);
            
            // Special rule: If arriving in Zimbabwe, NO layover allowances are calculated
            if (returnRoutes[i].to !== 'Zimbabwe') {
                // During layover, use the current destination country's rate
                const layoverResult = calculateSegmentDSA(legArrivalTime, nextDepartureTime, countryRates[returnRoutes[i].to].full_day, gradeMultiplier);
                
                totalDSA += layoverResult.totalDSA;
                totalBreakfast += layoverResult.breakdown.breakfast;
                totalLunch += layoverResult.breakdown.lunch;
                totalDinner += layoverResult.breakdown.dinner;
                totalAccommodation += layoverResult.breakdown.accommodation;
                totalOther += layoverResult.breakdown.other;
                breakfastCount += layoverResult.breakdown.breakfastCount;
                lunchCount += layoverResult.breakdown.lunchCount;
                dinnerCount += layoverResult.breakdown.dinnerCount;
                nightCount += layoverResult.breakdown.nightCount;
            }
            
            totalReturnHours += layoverHours;
            currentTime = nextDepartureTime;
        }
    }
    
    
    // Calculate total duration
    const totalDurationMs = endDate - startDate;
    const totalDurationHours = totalDurationMs / (1000 * 60 * 60);
    const totalDurationDays = totalDurationHours / 24;
    const totalDaysForDSA = totalDurationDays; // Use exact decimal days
    
    // For display purposes
    const fullDaysAtDestination = Math.floor(daysAtDestination);
    const fullDaysTotal = totalDSA;
    const travelDSA = 0; // All DSA is now included in fullDaysTotal
    const travelDays = 0; // For backward compatibility with display
    
    // Collect all unique countries visited for display
    let countriesVisited = new Set();
    routes.forEach(route => {
        countriesVisited.add(route.from);
        countriesVisited.add(route.to);
    });
    returnRoutes.forEach(route => {
        countriesVisited.add(route.from);
        countriesVisited.add(route.to);
    });
    
    // Calculate average per diem for representation allowance (weighted by time in each country)
    let totalRepresentation = 0;
    
    // For display - we already have the actual totals calculated with correct per diems
    // Just show the destination per diem as reference
    const destinationDailyAllowance = destinationPerDiem * gradeMultiplier;
    
    // Calculate representation allowance based on actual time in each location
    // This is complex, so we'll use a simplified approach: average of all countries weighted by DSA
    let representationAllowance = 0;
    if (representationPercentages[grade]) {
        const representationPercentage = representationPercentages[grade];
        // Calculate based on total DSA proportion
        const avgPerDiemFromTotal = totalDSA / (totalDaysForDSA * gradeMultiplier);
        representationAllowance = (avgPerDiemFromTotal * representationPercentage / 100) * totalDaysForDSA;
    }

    // Calculate supplementary allowance for external funding
    let supplementaryAllowance = 0;
    if (fundingSource === 'external') {
        const daysToCount = Math.min(totalDaysForDSA, 30); // Max 30 days
        supplementaryAllowance = daysToCount * 50; // US$50 per day
    }

    // Calculate total payment
    let totalPayment = fullDaysTotal + travelDSA + representationAllowance;
    if (fundingSource === 'external') {
        totalPayment += supplementaryAllowance;
    }

    // Display results
    document.getElementById('purposeDisplay').textContent = purpose;
    document.getElementById('totalDuration').textContent = `${totalDurationDays.toFixed(2)} days (${formatHours(totalDurationHours)})`;
    document.getElementById('outboundTravel').textContent = formatHours(totalOutboundHours);
    document.getElementById('returnTravel').textContent = formatHours(totalReturnHours);
    document.getElementById('fullDays').textContent = `${fullDaysAtDestination} days`;

    // DSA Breakdown (actual totals claimed)
    document.getElementById('accommodation').textContent = `US$${totalAccommodation.toFixed(2)} (${nightCount} nights)`;
    document.getElementById('lunch').textContent = `US$${totalLunch.toFixed(2)} (${lunchCount} meals)`;
    document.getElementById('dinner').textContent = `US$${totalDinner.toFixed(2)} (${dinnerCount} meals)`;
    document.getElementById('breakfast').textContent = `US$${totalBreakfast.toFixed(2)} (${breakfastCount} meals)`;
    document.getElementById('otherExpenses').textContent = `US$${totalOther.toFixed(2)}`;

    // Show that multiple per diems were used
    const multipleCountries = countriesVisited.size > 1;
    if (multipleCountries) {
        document.getElementById('dailyAllowance').textContent = `Multiple rates used (${countriesVisited.size} countries)`;
    } else {
        document.getElementById('dailyAllowance').textContent = `US$${destinationDailyAllowance.toFixed(2)} (${destinationPerDiem} × ${gradeMultiplier})`;
    }
    document.getElementById('fullDaysTotal').textContent = `US$${fullDaysTotal.toFixed(2)} (Total DSA calculated per country per diem)`;

    // Representation allowance UI removed; value remains included in totals

    // Show/hide supplementary allowance
    if (fundingSource === 'external') {
        document.getElementById('supplementarySection').style.display = 'block';
        const daysToCount = Math.min(totalDaysForDSA, 30);
        document.getElementById('supplementaryAllowance').textContent = `US$${supplementaryAllowance.toFixed(2)} (${daysToCount.toFixed(2)} days)`;
    } else {
        document.getElementById('supplementarySection').style.display = 'none';
    }

    document.getElementById('totalPayment').value = totalPayment.toFixed(2);

    // Build per-country totals from calculated components
    const countryTotalsMap = new Map();
    function addCountryTotals(country, amounts) {
        if (!country) return;
        if (!countryTotalsMap.has(country)) {
            countryTotalsMap.set(country, { breakfast: 0, lunch: 0, dinner: 0, accommodation: 0, other: 0, total: 0 });
        }
        const entry = countryTotalsMap.get(country);
        entry.breakfast += (amounts.breakfast || 0);
        entry.lunch += (amounts.lunch || 0);
        entry.dinner += (amounts.dinner || 0);
        entry.accommodation += (amounts.accommodation || 0);
        entry.other += (amounts.other || 0);
        entry.total = entry.breakfast + entry.lunch + entry.dinner + entry.accommodation + entry.other;
    }

    // Recompute per-country totals using detailed breakdowns
    routes.forEach(route => {
        const res = calculateAllowance(route.from, route.to, route.departureDate, route.arrivalDate, countryRates, gradeMultiplier);
        Object.keys(res.breakdown).forEach(c => addCountryTotals(c, res.breakdown[c].amounts));
    });
    for (let i = 0; i < routes.length - 1; i++) {
        if (routes[i].to !== 'Zimbabwe') {
            const lay = calculateSegmentDSA(routes[i].arrivalDate, routes[i + 1].departureDate, countryRates[routes[i].to].full_day, gradeMultiplier);
            addCountryTotals(routes[i].to, lay.breakdown);
        }
    }
    if (routes.length > 0) {
        const destCountry = routes[routes.length - 1].to;
        const destStay = calculateDestinationDSA(currentTime, returnRoutes[0].departureDate, countryRates[destCountry].full_day, gradeMultiplier);
        addCountryTotals(destCountry, destStay.breakdown);
    }
    returnRoutes.forEach(route => {
        const res = calculateAllowance(route.from, route.to, route.departureDate, route.arrivalDate, countryRates, gradeMultiplier);
        Object.keys(res.breakdown).forEach(c => addCountryTotals(c, res.breakdown[c].amounts));
    });
    for (let i = 0; i < returnRoutes.length - 1; i++) {
        if (returnRoutes[i].to !== 'Zimbabwe') {
            const lay = calculateSegmentDSA(returnRoutes[i].arrivalDate, returnRoutes[i + 1].departureDate, countryRates[returnRoutes[i].to].full_day, gradeMultiplier);
            addCountryTotals(returnRoutes[i].to, lay.breakdown);
        }
    }

    // Country breakdown UI intentionally not rendered

    // Generate day-by-day breakdown
    generateDayByDayBreakdown(startDate, endDate, routes, returnRoutes, destinationPerDiem, gradeMultiplier, grade, fundingSource);

    // Show results
    document.getElementById('results').style.display = 'block';
    
    // Smooth scroll to results
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Reset form function
function resetForm() {
    // Reset all input fields
    document.getElementById('grade').value = '';
    document.getElementById('purpose').value = '';
    
    // Clear all country selects and dates
    document.querySelectorAll('.departure-select').forEach(select => select.value = '');
    document.querySelectorAll('.destination-select').forEach(select => select.value = '');
    document.querySelectorAll('.departure-date').forEach(input => input.value = '');
    document.querySelectorAll('.arrival-date').forEach(input => input.value = '');
    document.querySelectorAll('.return-departure-select').forEach(select => select.value = '');
    document.querySelectorAll('.return-destination-select').forEach(select => select.value = '');
    document.querySelectorAll('.return-departure-date').forEach(input => input.value = '');
    document.querySelectorAll('.return-arrival-date').forEach(input => input.value = '');
    
    // Remove all extra outbound route sections (keep only first one)
    const allRoutes = document.querySelectorAll('#routesContainer .route-section');
    allRoutes.forEach((route, index) => {
        if (index > 0) {
            route.remove();
        }
    });
    
    // Remove all extra return route sections (keep only first one)
    const allReturnRoutes = document.querySelectorAll('#returnRoutesContainer .route-section');
    allReturnRoutes.forEach((route, index) => {
        if (index > 0) {
            route.remove();
        }
    });
    
    // Reset counters
    routeCounter = 1;
    returnRouteCounter = 1;
    
    document.getElementById('fundingSource').value = 'government';
    
    // Hide supplementary note
    document.getElementById('supplementaryNote').style.display = 'none';
    
    // Hide results section
    document.getElementById('results').style.display = 'none';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Counter for routes
let routeCounter = 1;
let returnRouteCounter = 1;

// Add new route
function addRoute() {
    const container = document.getElementById('routesContainer');
    const routeId = routeCounter++;
    const routeNumber = routeId + 1;
    
    // Create new route section
    const routeDiv = document.createElement('div');
    routeDiv.className = 'route-section';
    routeDiv.setAttribute('data-route-id', routeId);
    
    // Get all countries for dropdowns
    const countries = Object.keys(countryRates).sort();
    
    // Create dropdown options
    let countryOptions = '<option value="">Select Country</option>';
    countries.forEach(country => {
        countryOptions += `<option value="${country}">${country}</option>`;
    });
    
    routeDiv.innerHTML = `
        <h3 class="route-title">Route ${routeNumber}</h3>
        <button type="button" class="btn-remove-route" onclick="removeRoute(${routeId})" title="Remove this route">
            ×
        </button>
        <div class="form-group">
            <label for="departure-${routeId}">Departure Country:</label>
            <select id="departure-${routeId}" class="departure-select">
                ${countryOptions}
            </select>
        </div>
        <div class="form-group">
            <label for="destination-${routeId}">Destination Country:</label>
            <select id="destination-${routeId}" class="destination-select">
                ${countryOptions}
            </select>
        </div>
        <div class="form-group">
            <label for="perDiem-${routeId}">Per Diem Rate for Destination Country (US$):</label>
            <input type="number" id="perDiem-${routeId}" class="per-diem-display" placeholder="0" step="0.01" min="0" readonly>
            <small>DSA will be calculated based on this rate</small>
        </div>
        <div class="form-group">
            <label for="departureDate-${routeId}">Departure Date & Time:</label>
            <input type="datetime-local" id="departureDate-${routeId}" class="departure-date">
        </div>
        <div class="form-group">
            <label for="arrivalDate-${routeId}">Arrival Date & Time:</label>
            <input type="datetime-local" id="arrivalDate-${routeId}" class="arrival-date">
        </div>
    `;
    
    container.appendChild(routeDiv);
    
    // Add change listener for the new destination dropdown to update per diem
    const newDestSelect = document.getElementById(`destination-${routeId}`);
    newDestSelect.addEventListener('change', function() {
        updateRoutePerDiem(routeId);
    });
    
    // Initialize per diem field to 0
    document.getElementById(`perDiem-${routeId}`).value = '0';
    
    // Set default dates for new route (current time + 3 days)
    const now = new Date();
    const future = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
    document.getElementById(`departureDate-${routeId}`).value = formatDateTime(now);
    document.getElementById(`arrivalDate-${routeId}`).value = formatDateTime(future);
}

// Remove route
function removeRoute(routeId) {
    const routeDiv = document.querySelector(`.route-section[data-route-id="${routeId}"]`);
    if (routeDiv) {
        routeDiv.remove();
        
        // Renumber remaining routes
        const allRoutes = document.querySelectorAll('#routesContainer .route-section');
        allRoutes.forEach((route, index) => {
            const title = route.querySelector('.route-title');
            if (title) {
                title.textContent = `Route ${index + 1}`;
            }
        });
    }
}

// Add new return route
function addReturnRoute() {
    const container = document.getElementById('returnRoutesContainer');
    const routeId = returnRouteCounter++;
    const routeNumber = routeId + 1;
    
    // Create new route section
    const routeDiv = document.createElement('div');
    routeDiv.className = 'route-section';
    routeDiv.setAttribute('data-return-route-id', routeId);
    
    // Get all countries for dropdowns
    const countries = Object.keys(countryRates).sort();
    
    // Create dropdown options
    let countryOptions = '<option value="">Select Country</option>';
    countries.forEach(country => {
        countryOptions += `<option value="${country}">${country}</option>`;
    });
    
    routeDiv.innerHTML = `
        <h3 class="route-title">Return Route ${routeNumber}</h3>
        <button type="button" class="btn-remove-route" onclick="removeReturnRoute(${routeId})" title="Remove this route">
            ×
        </button>
        <div class="form-group">
            <label for="returnDeparture-${routeId}">Return Departure Country:</label>
            <select id="returnDeparture-${routeId}" class="return-departure-select">
                ${countryOptions}
            </select>
        </div>
        <div class="form-group">
            <label for="returnDestination-${routeId}">Return Destination Country:</label>
            <select id="returnDestination-${routeId}" class="return-destination-select">
                ${countryOptions}
            </select>
        </div>
        <div class="form-group">
            <label for="returnPerDiem-${routeId}">Per Diem Rate for Destination Country (US$):</label>
            <input type="number" id="returnPerDiem-${routeId}" class="return-per-diem-display" placeholder="0" step="0.01" min="0" readonly>
            <small>DSA will be calculated based on this rate</small>
        </div>
        <div class="form-group">
            <label for="returnDepartureDate-${routeId}">Return Departure Date & Time:</label>
            <input type="datetime-local" id="returnDepartureDate-${routeId}" class="return-departure-date">
        </div>
        <div class="form-group">
            <label for="returnArrivalDate-${routeId}">Return Arrival Date & Time:</label>
            <input type="datetime-local" id="returnArrivalDate-${routeId}" class="return-arrival-date">
        </div>
    `;
    
    container.appendChild(routeDiv);
    
    // Add change listener for the new return destination dropdown to update per diem
    const newReturnDestSelect = document.getElementById(`returnDestination-${routeId}`);
    newReturnDestSelect.addEventListener('change', function() {
        updateReturnRoutePerDiem(routeId);
    });
    
    // Initialize per diem field to 0
    document.getElementById(`returnPerDiem-${routeId}`).value = '0';
    
    // Set default dates for new route (current time + 6 days)
    const now = new Date();
    const future = new Date(now.getTime() + (6 * 24 * 60 * 60 * 1000));
    document.getElementById(`returnDepartureDate-${routeId}`).value = formatDateTime(now);
    document.getElementById(`returnArrivalDate-${routeId}`).value = formatDateTime(future);
}

// Remove return route
function removeReturnRoute(routeId) {
    const routeDiv = document.querySelector(`.route-section[data-return-route-id="${routeId}"]`);
    if (routeDiv) {
        routeDiv.remove();
        
        // Renumber remaining return routes
        const allReturnRoutes = document.querySelectorAll('#returnRoutesContainer .route-section');
        allReturnRoutes.forEach((route, index) => {
            const title = route.querySelector('.route-title');
            if (title) {
                title.textContent = `Return Route ${index + 1}`;
            }
        });
    }
}

// Format date for datetime-local input
function formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Update per diem for a specific outbound route
function updateRoutePerDiem(routeId) {
    const destinationSelect = document.getElementById(`destination-${routeId}`);
    const perDiemField = document.getElementById(`perDiem-${routeId}`);
    
    if (destinationSelect && perDiemField) {
        const destinationCountry = destinationSelect.value;
        if (destinationCountry && countryRates[destinationCountry]) {
            perDiemField.value = countryRates[destinationCountry].full_day;
        } else {
            perDiemField.value = '0';
        }
    }
}

// Update per diem for a specific return route
function updateReturnRoutePerDiem(routeId) {
    const returnDestinationSelect = document.getElementById(`returnDestination-${routeId}`);
    const returnPerDiemField = document.getElementById(`returnPerDiem-${routeId}`);
    
    if (returnDestinationSelect && returnPerDiemField) {
        const returnDestinationCountry = returnDestinationSelect.value;
        if (returnDestinationCountry && countryRates[returnDestinationCountry]) {
            returnPerDiemField.value = countryRates[returnDestinationCountry].full_day;
        } else {
            returnPerDiemField.value = '0';
        }
    }
}

// Increment time function
function incrementTime(fieldId, hours) {
    const field = document.getElementById(fieldId);
    
    // Check if field has a value
    if (!field.value) {
        alert('Please set a date and time first');
        return;
    }
    
    // Get current date from field
    const currentDate = new Date(field.value);
    
    // Add hours (in milliseconds)
    currentDate.setTime(currentDate.getTime() + (hours * 60 * 60 * 1000));
    
    // Format back to datetime-local format
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const hoursStr = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    
    field.value = `${year}-${month}-${day}T${hoursStr}:${minutes}`;
}

// Generate country breakdown
// Country breakdown generator removed

// Generate day-by-day breakdown
function generateDayByDayBreakdown(startDate, endDate, routes, returnRoutes, perDiemRate, gradeMultiplier, grade, fundingSource) {
    const container = document.getElementById('dayByDayBreakdown');
    const totalsList = document.getElementById('dailyTotalsList');
    container.innerHTML = ''; // Clear previous content
    if (totalsList) totalsList.innerHTML = '';
    let runningDailyTotal = 0;
    
    // Build a timeline of all events
    let timeline = [];
    
    // Add outbound routes
    routes.forEach((route, index) => {
        timeline.push({
            type: 'travel_start',
            time: route.departureDate,
            location: route.from,
            destination: route.to,
            routeIndex: index,
            leg: 'outbound',
            perDiem: countryRates[route.from]
        });
        timeline.push({
            type: 'travel_end',
            time: route.arrivalDate,
            location: route.to,
            from: route.from,
            routeIndex: index,
            leg: 'outbound',
            perDiem: countryRates[route.to]
        });
    });
    
    // Add return routes
    returnRoutes.forEach((route, index) => {
        timeline.push({
            type: 'travel_start',
            time: route.departureDate,
            location: route.from,
            destination: route.to,
            routeIndex: index,
            leg: 'return',
            perDiem: countryRates[route.from]
        });
        timeline.push({
            type: 'travel_end',
            time: route.arrivalDate,
            location: route.to,
            from: route.from,
            routeIndex: index,
            leg: 'return',
            perDiem: countryRates[route.to]
        });
    });
    
    // Sort timeline by time
    timeline.sort((a, b) => a.time - b.time);
    
    // Iterate through each day
    let currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    let dayCounter = 1;
    
    while (currentDate <= endDate) {
        const nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + 1);
        
        // Determine location, status, and per diem rate for this day
        let dayStatus = 'destination'; // Can be: 'outbound_travel', 'destination', 'return_travel'
        let currentLocation = routes[routes.length - 1].to; // Default to final destination
        let currentPerDiem = (countryRates[currentLocation] ? countryRates[currentLocation].full_day : null) || perDiemRate; // Get per diem for current location
        
        // Find what's happening on this day and update location/per diem
        for (let event of timeline) {
            if (event.time >= currentDate && event.time < nextDate) {
                if (event.type === 'travel_start') {
                    dayStatus = event.leg === 'outbound' ? 'outbound_travel' : 'return_travel';
                    currentLocation = event.location;
                    currentPerDiem = event.perDiem ? event.perDiem.full_day : perDiemRate;
                } else if (event.type === 'travel_end') {
                    currentLocation = event.location;
                    currentPerDiem = event.perDiem ? event.perDiem.full_day : perDiemRate;
                }
            }
        }
        
        // Special handling for Zimbabwe rules on first and last days
        // On departure day leaving Zimbabwe, use destination country per diem
        if (currentDate.toDateString() === startDate.toDateString() && routes.length > 0) {
            if (routes[0].from === 'Zimbabwe' && countryRates[routes[0].to]) {
                currentPerDiem = countryRates[routes[0].to].full_day;
            }
        }
        // On final arrival day to Zimbabwe, use departure country per diem for eligible meals
        if (currentDate.toDateString() === endDate.toDateString() && returnRoutes.length > 0) {
            const lastReturn = returnRoutes[returnRoutes.length - 1];
            if (lastReturn.to === 'Zimbabwe' && countryRates[lastReturn.from]) {
                currentPerDiem = countryRates[lastReturn.from].full_day;
            }
        }

        // Calculate component rates based on the possibly adjusted per diem
        const dailyAllowance = currentPerDiem * gradeMultiplier;
        const accommodationRate = (dailyAllowance * dsaComponents.accommodation) / 100;
        const lunchRate = (dailyAllowance * dsaComponents.lunch) / 100;
        const dinnerRate = (dailyAllowance * dsaComponents.dinner) / 100;
        const breakfastRate = (dailyAllowance * dsaComponents.breakfast) / 100;
        const otherRate = (dailyAllowance * dsaComponents.other) / 100;
        
        // Calculate allowances for this specific day
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);
        
        let allowances = {
            breakfast: { eligible: false, amount: 0 },
            lunch: { eligible: false, amount: 0 },
            dinner: { eligible: false, amount: 0 },
            accommodation: { eligible: false, amount: 0 },
            other: { eligible: false, amount: 0 },
            supplementary: { eligible: false, amount: 0 },
            representation: { eligible: false, amount: 0 }
        };
        
        // Check if this is the first day (departure day)
        if (currentDate.toDateString() === startDate.toDateString()) {
            const depHour = startDate.getHours();
            const departingFromZimbabwe = routes.length > 0 && routes[0].from === 'Zimbabwe';

            if (departingFromZimbabwe) {
                // DSA starts at departure. A meal is eligible only if departure occurs BEFORE that meal's start window.
                // Breakfast (06:00)
                if (depHour < 6) {
                    allowances.breakfast = { eligible: true, amount: breakfastRate };
                }
                // Lunch (12:00)
                if (depHour < 12) {
                    allowances.lunch = { eligible: true, amount: lunchRate };
                }
                // Dinner (18:00)
                if (depHour < 18) {
                    allowances.dinner = { eligible: true, amount: dinnerRate };
                }
            } else {
                // Non-Zimbabwe departure: keep previous simplified rules based on time of day
                if (depHour < 6) {
                    allowances.accommodation = { eligible: true, amount: accommodationRate };
                } else if (depHour >= 6 && depHour < 12) {
                    allowances.breakfast = { eligible: true, amount: breakfastRate };
                } else if (depHour >= 12 && depHour < 18) {
                    allowances.breakfast = { eligible: true, amount: breakfastRate };
                    allowances.lunch = { eligible: true, amount: lunchRate };
                } else if (depHour >= 18) {
                    allowances.dinner = { eligible: true, amount: dinnerRate };
                }
            }

            // Accommodation if overnight travel (not same day arrival back home)
            if (currentDate.toDateString() !== endDate.toDateString()) {
                allowances.accommodation = { eligible: true, amount: accommodationRate };
            }

            // Other expenses apply on departure day
            allowances.other = { eligible: true, amount: otherRate };
        }
        // Check if this is the last day (arrival home day)
        else if (currentDate.toDateString() === endDate.toDateString()) {
            const arrHour = endDate.getHours();
            const arrivingToZimbabwe = returnRoutes.length > 0 && returnRoutes[returnRoutes.length - 1].to === 'Zimbabwe';
            
            if (arrivingToZimbabwe) {
                // On final arrival to Zimbabwe: award meals only if still traveling during the meal window before arrival
                // Determine the start of the final travel segment (last return leg departure)
                const lastReturn = returnRoutes[returnRoutes.length - 1];
                const travelStart = lastReturn ? lastReturn.departureDate : null;

                // Define windows on the arrival day
                const makeWindow = (hStart, mStart, hEnd, mEnd) => {
                    const ws = new Date(endDate); ws.setHours(hStart, mStart, 0, 0);
                    const we = new Date(endDate); we.setHours(hEnd, mEnd, 0, 0);
                    return [ws, we];
                };
                const [bStart, bEnd] = makeWindow(6, 0, 9, 0);
                const [lStart, lEnd] = makeWindow(12, 0, 14, 0);
                const [dStart, dEnd] = makeWindow(18, 0, 20, 0);

                const overlaps = (start, end, winStart, winEnd) => start < winEnd && end > winStart;
                const inTransitOverlap = (winStart, winEnd) => travelStart && overlaps(travelStart, endDate, winStart, winEnd);

                // Only mark meal eligible if actually in transit during that window
                if (inTransitOverlap(bStart, bEnd)) {
                    allowances.breakfast = { eligible: true, amount: breakfastRate };
                } else {
                    allowances.breakfast = { eligible: false, amount: 0 };
                }
                if (inTransitOverlap(lStart, lEnd)) {
                    allowances.lunch = { eligible: true, amount: lunchRate };
                } else {
                    allowances.lunch = { eligible: false, amount: 0 };
                }
                if (inTransitOverlap(dStart, dEnd)) {
                    allowances.dinner = { eligible: true, amount: dinnerRate };
                } else {
                    allowances.dinner = { eligible: false, amount: 0 };
                }

                // Exclude accommodation and other on final arrival day to Zimbabwe
                allowances.accommodation = { eligible: false, amount: 0 };
                allowances.other = { eligible: false, amount: 0 };
            } else {
                // Non-Zimbabwe arrivals: meals may apply based on arrival time; no accommodation
                if (arrHour >= 7) {
                    allowances.breakfast = { eligible: true, amount: breakfastRate };
                }
                if (arrHour >= 14) {
                    allowances.lunch = { eligible: true, amount: lunchRate };
                }
                if (arrHour >= 18) {
                    allowances.dinner = { eligible: true, amount: dinnerRate };
                }
                allowances.accommodation = { eligible: false, amount: 0 };
                const mealsEligible = (allowances.breakfast.eligible ? 1 : 0) + (allowances.lunch.eligible ? 1 : 0) + (allowances.dinner.eligible ? 1 : 0);
                if (mealsEligible > 0) {
                    allowances.other = { eligible: true, amount: otherRate };
                }
            }
        }
        // Full days at destination or during travel
        else {
            // All meals eligible for full days
            allowances.breakfast = { eligible: true, amount: breakfastRate };
            allowances.lunch = { eligible: true, amount: lunchRate };
            allowances.dinner = { eligible: true, amount: dinnerRate };
            allowances.accommodation = { eligible: true, amount: accommodationRate };
            allowances.other = { eligible: true, amount: otherRate };
        }
        
        // Supplementary allowance for external funding
        if (fundingSource === 'external' && dayCounter <= 30) {
            allowances.supplementary = { eligible: true, amount: 50 };
        }
        
        // Representation allowance applies only while at destination (not during outbound/return travel, not in Zimbabwe)
        if (representationPercentages[grade] > 0 && dayStatus === 'destination' && currentLocation !== 'Zimbabwe') {
            const repPercentage = representationPercentages[grade];
            const repAmount = (currentPerDiem * repPercentage / 100);
            allowances.representation = { eligible: true, amount: repAmount };
        }
        
        // Calculate day total (include representation; exclude supplementary)
        let dayTotal = 0;
        let earnedBreakdown = [];
        Object.keys(allowances).forEach(key => {
            if (key === 'supplementary') return;
            if (allowances[key].eligible) {
                dayTotal += allowances[key].amount;
                earnedBreakdown.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: US$${allowances[key].amount.toFixed(2)}`);
            }
        });
        
        // Create day item HTML
        const dayItem = document.createElement('div');
        dayItem.className = 'day-item';
        
        const statusEmoji = dayStatus === 'outbound_travel' ? '✈️ Outbound Travel' : 
                           dayStatus === 'return_travel' ? '✈️ Return Travel' : 
                           '📍 At Destination';
        
        // Format date as dd/mm/yyyy
        const day = String(currentDate.getDate()).padStart(2, '0');
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const year = currentDate.getFullYear();
        const formattedDate = `${day}/${month}/${year}`;
        
        const gradeMultiplierText = (() => {
            switch (grade) {
                case 'minister': return '1.50 × per diem base rate';
                case 'accounting': return '1.45 × per diem base rate';
                case 'accounting_non': return '1.40 × per diem base rate';
                case 'chief_director': return '1.35 × per diem base rate';
                case 'director': return '1.30 × per diem base rate';
                case 'deputy_director': return '1.25 × per diem base rate';
                default: return '1.00 × per diem base rate';
            }
        })();

        const repPercent = representationPercentages[grade] || 0;
        dayItem.innerHTML = `
            <div class="day-header">
                <span class="day-number">DAY ${dayCounter} - ${formattedDate}</span>
            </div>
            <div class="day-location">${statusEmoji} - ${currentLocation}</div>
            <div class="day-allowances">
                <div class="allowance-item ${allowances.breakfast.eligible ? 'eligible' : 'not-eligible'}">
                    <span class="allowance-label">🍳 Breakfast:</span>
                    <span class="allowance-value">${allowances.breakfast.eligible ? 'US$' + allowances.breakfast.amount.toFixed(2) : 'Not Eligible'}</span>
                </div>
                <div class="allowance-item ${allowances.lunch.eligible ? 'eligible' : 'not-eligible'}">
                    <span class="allowance-label">🍴 Lunch:</span>
                    <span class="allowance-value">${allowances.lunch.eligible ? 'US$' + allowances.lunch.amount.toFixed(2) : 'Not Eligible'}</span>
                </div>
                <div class="allowance-item ${allowances.dinner.eligible ? 'eligible' : 'not-eligible'}">
                    <span class="allowance-label">🍽️ Dinner:</span>
                    <span class="allowance-value">${allowances.dinner.eligible ? 'US$' + allowances.dinner.amount.toFixed(2) : 'Not Eligible'}</span>
                </div>
                <div class="allowance-item ${allowances.accommodation.eligible ? 'eligible' : 'not-eligible'}">
                    <span class="allowance-label">🏨 Accommodation:</span>
                    <span class="allowance-value">${allowances.accommodation.eligible ? 'US$' + allowances.accommodation.amount.toFixed(2) : 'Not Eligible'}</span>
                </div>
                <div class="allowance-item ${allowances.other.eligible ? 'eligible' : 'not-eligible'}">
                    <span class="allowance-label">💼 Other Expenses:</span>
                    <span class="allowance-value">${allowances.other.eligible ? 'US$' + allowances.other.amount.toFixed(2) : 'Not Eligible'}</span>
                </div>
            </div>
            <div class="day-total">
                <span>Daily Total Earned:</span>
                <span>US$${dayTotal.toFixed(2)}</span>
            </div>
            <div class="rate-note">Rate used: ${gradeMultiplierText} (grade multiplier ${gradeMultiplier.toFixed(2)})</div>
            ${allowances.representation && allowances.representation.eligible ? `
            <div class=\"rate-note\">Representation: US$${allowances.representation.amount.toFixed(2)} (${repPercent}% of base rate) — included in daily total</div>
            ` : ''}
        `;
        
        container.appendChild(dayItem);

        // Append compact total line
        if (totalsList) {
            const row = document.createElement('div');
            row.className = 'totals-row';
            row.innerHTML = `<span>Day ${dayCounter}</span><span>US$${dayTotal.toFixed(2)}</span>`;
            totalsList.appendChild(row);
        }
        runningDailyTotal += dayTotal;
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
        dayCounter++;
    }
    // Append grand total of all days
    if (totalsList) {
        const totalRow = document.createElement('div');
        totalRow.className = 'totals-row';
        totalRow.style.fontWeight = '700';
        totalRow.innerHTML = `<span>Total (Day 1–${dayCounter - 1})</span><span>US$${runningDailyTotal.toFixed(2)}</span>`;
        totalsList.appendChild(totalRow);
    }
}

// Print to PDF function
function printToPDF() {
    window.print();
    
    // Reset everything after printing
    setTimeout(() => {
        resetForm();
    }, 500); // Small delay to ensure print dialog closes first
}

// Set default dates (today to 3 days from now)
window.addEventListener('DOMContentLoaded', () => {
    // Populate country dropdowns for first pair
    const countries = Object.keys(countryRates).sort();
    const departureSelect = document.getElementById('departure-0');
    const destinationSelect = document.getElementById('destination-0');
    const returnDepartureSelect = document.getElementById('returnDeparture-0');
    const returnDestinationSelect = document.getElementById('returnDestination-0');
    
    countries.forEach(country => {
        const option1 = document.createElement('option');
        option1.value = country;
        option1.textContent = country;
        departureSelect.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = country;
        option2.textContent = country;
        destinationSelect.appendChild(option2);
        
        const option3 = document.createElement('option');
        option3.value = country;
        option3.textContent = country;
        returnDepartureSelect.appendChild(option3);
        
        const option4 = document.createElement('option');
        option4.value = country;
        option4.textContent = country;
        returnDestinationSelect.appendChild(option4);
    });
    
    // Add event listeners for initial route per diem updates
    destinationSelect.addEventListener('change', function() {
        updateRoutePerDiem(0);
    });
    
    returnDestinationSelect.addEventListener('change', function() {
        updateReturnRoutePerDiem(0);
    });
    
    // Initialize per diem fields to 0
    document.getElementById('perDiem-0').value = '0';
    document.getElementById('returnPerDiem-0').value = '0';
    
    const now = new Date();
    const futureDate = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
    const returnDepartDate = new Date(now.getTime() + (6 * 24 * 60 * 60 * 1000)); // 6 days later
    const returnArrivalDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days later

    document.getElementById('departureDate-0').value = formatDateTime(now);
    document.getElementById('arrivalDate-0').value = formatDateTime(futureDate);
    document.getElementById('returnDepartureDate-0').value = formatDateTime(returnDepartDate);
    document.getElementById('returnArrivalDate-0').value = formatDateTime(returnArrivalDate);

    // Show/hide supplementary note based on funding source
    document.getElementById('fundingSource').addEventListener('change', function() {
        if (this.value === 'external') {
            document.getElementById('supplementaryNote').style.display = 'block';
        } else {
            document.getElementById('supplementaryNote').style.display = 'none';
        }
    });
});
