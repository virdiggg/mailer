const moment = require('moment');

const phoneNumberFormatter = (phone, countryCode) => {
  // 1. Menghilangkan karakter selain angka
  let formatted = phone.replace(/\D/g, '');

  // 2. Menghilangkan karakter +
  if (formatted.startsWith('+')) {
    formatted = formatted.substr(1);
  }

  // 3. Menghilangkan angka 0 di depan (prefix)
  //    Kemudian diganti dengan 62
  if (formatted.startsWith('0')) {
    formatted = countryCode + formatted.substr(1);
  }

  if (!formatted.endsWith('@c.us')) {
    formatted += '@c.us';
  }

  return formatted;
}

const parseTime = (locale, time) => {
  locale = locale.replace("_", "-");
  // di js, timestamp harus dikali 1000
  let timestamp = time * 1000;
  return moment(timestamp).format('YYYY-MM-DD HH:mm');
}

const br2nl = async (message) => {
  // let formatted = message.replace(/\<br \/\>/gi,'\\n');
  let formatted = await message.replace(/<\s*\/?br\s*[\/]?>/gi,'\\n');
  // Includes <br>, <BR>, <br />, </br>
  return formatted;
}

module.exports = {
  phoneNumberFormatter,
  parseTime,
  br2nl,
}