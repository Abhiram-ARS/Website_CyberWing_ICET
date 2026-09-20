const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxip0yzNQrVZ71zi7YQ_qOrMr9NS6-hHuFImVzh1j8ge3sAIBG85JuVmWeyyPtrGu8vYw/exec';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.contact-form');

  if (!form) {
    return;
  }

  const nameInput = document.getElementById('contact-name');
  const contactInput = document.getElementById('contact-phone-email');
  const submitButton = form.querySelector('button[type="submit"]');

  function isValidMobileNumber(value) {
    const normalized = value.replace(/\s+/g, '').replace(/[-()]/g, '');
    return /^\d{10,15}$/.test(normalized);
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = nameInput?.value.trim() || '';
    const contact = contactInput?.value.trim() || '';

    if (!name || !contact) {
      alert('Please enter both your name and phone number or email.');
      return;
    }

    const isValidContact = isValidMobileNumber(contact) || isValidEmail(contact);
    if (!isValidContact) {
      alert('Please enter a valid mobile number (10-15 digits) or a valid email address.');
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Sending...';
    }

    try {
      const formData = new URLSearchParams({
        name,
        contact,
      });

      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: formData.toString(),
      });

      form.reset();
      alert('Thank you! Your request has been submitted.');
    } catch (error) {
      console.error('Contact form submission failed:', error);
      alert('There was an issue sending your request. Please try again.');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit';
      }
    }
  });
});
