// src/utils/formatDate.js
function formatDate(inputDate) {
    // Split the date string by '-' and rearrange
    const [year, month, day] = inputDate.split('-');
    return `${day}-${month}-${year}`;
}

module.exports = {formatDate};