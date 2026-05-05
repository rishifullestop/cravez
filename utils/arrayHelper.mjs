import { ObjectId } from 'mongodb';


/**
 * Converts an array of strings to an array of MongoDB ObjectIds.
 *
 * @param {string[]} arr - An array of ObjectId strings
 * @returns {ObjectId[]} - An array of valid ObjectId instances
 */
export const arrayToObject = (arr) => {
	try {
		if (!Array.isArray(arr) || arr.length === 0) return [];

		return arr.map((id) => {
			if (ObjectId.isValid(id)) {
				return new ObjectId(id);
			} else {
				throw new Error(`Invalid ObjectId: ${id}`);
			}
		});
	} catch (err) {
		console.error('ObjectId conversion error in utils/arrayHelper:', err.message);
		return arr; // fallback to original array
	}
};

export const sortByKey = (fields) => {
	return (a, b) => {
	  const comparisons = fields.map(field => {
		let dir = 1;
		if (field[0] === '-') {
		  dir = -1;
		  field = field.substring(1);
		}
  
		if (a[field] > b[field]) return dir;
		if (a[field] < b[field]) return -dir;
		return 0;
	  });
  
	  return comparisons.find(result => result !== 0) || 0;
	};
  };
