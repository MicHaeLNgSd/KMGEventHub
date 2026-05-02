export const formatPhoneInput = (value) => {
  const newValue1 = (value === "" || value.length < 3) ? "+38" : value;
  const newValue2 = newValue1.startsWith('+38') ? newValue1 : '+38' + newValue1;
  const newValue3 = newValue2.replace(/[\s()-]/g, '');
  return newValue3;
};
