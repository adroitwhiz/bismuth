const timeAndDate = format => {
	switch (format) {
		case 'year':
			return new Date().getFullYear();
		case 'month':
			return new Date().getMonth() + 1;
		case 'date':
			return new Date().getDate();
		case 'day of week':
		case 'dayofweek':
			return new Date().getDay() + 1;
		case 'hour':
			return new Date().getHours();
		case 'minute':
			return new Date().getMinutes();
		case 'second':
			return new Date().getSeconds();
	}
	return 0;
};

module.exports = timeAndDate;
