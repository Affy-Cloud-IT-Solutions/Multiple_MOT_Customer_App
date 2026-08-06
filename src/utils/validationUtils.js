 
export const validateFirstName = (firstName) => {
  const sanitized = firstName.replace(/[^A-Za-z]/g, '');
  if (!sanitized.trim()) return { error: 'First name is required.', value: sanitized };
  if (!/^[A-Za-z]+$/.test(sanitized)) return { error: 'First name must contain only letters.', value: sanitized };
  return { error: '', value: sanitized };
};

export const validateLastName = (lastName) => {
  const sanitized = lastName.replace(/[^A-Za-z]/g, '');
  if (!sanitized.trim()) return { error: 'Last name is required.', value: sanitized };
  if (!/^[A-Za-z]+$/.test(sanitized)) return { error: 'Last name must contain only letters.', value: sanitized };
  return { error: '', value: sanitized };
};

export const validatePhoneNumber = (phoneNumber) => {
  const sanitized = phoneNumber.replace(/[^0-9]/g, '');
  if (!sanitized.trim()) return { error: 'Phone number is required.', value: sanitized };
  if (!/^\d{10}$/.test(sanitized)) return { error: 'Phone number must be 10 digits only.', value: sanitized };
  return { error: '', value: sanitized };
};

export const validateEmail = (email) => {
  const sanitized = email.trim(); // no special sanitization
  if (!sanitized) return { error: 'Email is required.', value: sanitized };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized)) return { error: 'Enter a valid email address.', value: sanitized };
  return { error: '', value: sanitized };
};

export const validatePassword = (password) => {
  const sanitized = password.trim(); // no special sanitization
  if (!sanitized) return { error: 'Password is required.', value: sanitized };
  return { error: '', value: sanitized };
};
