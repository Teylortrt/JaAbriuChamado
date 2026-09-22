document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const emailError = document.getElementById('email-error');
  const passwordError = document.getElementById('password-error');
  const formMessage = document.getElementById('form-message');
  const submitBtn = document.getElementById('submit-btn');
  const togglePasswordBtn = document.getElementById('toggle-password');

  // Mostrar / ocultar senha
  togglePasswordBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
  });

  function validateEmail(value) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(value.trim());
  }

  function setFieldError(input, errorEl, message) {
    input.classList.toggle('input-invalid', Boolean(message));
    errorEl.textContent = message || '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formMessage.textContent = '';
    formMessage.className = 'form-message';

    let hasError = false;

    if (!validateEmail(emailInput.value)) {
      setFieldError(emailInput, emailError, 'Informe um email válido.');
      hasError = true;
    } else {
      setFieldError(emailInput, emailError, '');
    }

    if (!passwordInput.value || passwordInput.value.length < 6) {
      setFieldError(passwordInput, passwordError, 'A senha deve ter pelo menos 6 caracteres.');
      hasError = true;
    } else {
      setFieldError(passwordInput, passwordError, '');
    }

    if (hasError) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Entrando...';

    try {
      // Troque essa URL pela rota do seu backend (ex: /login ou /api/auth/login)
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.value.trim(),
          password: passwordInput.value,
          remember: document.getElementById('remember').checked
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Credenciais inválidas.');
      }

      formMessage.textContent = data.message || 'Login realizado com sucesso!';
      formMessage.classList.add('success');

      window.setTimeout(() => {
        window.location.href = '/dashboard';
      }, 500);

    } catch (err) {
      formMessage.textContent = err.message || 'Não foi possível entrar. Tente novamente.';
      formMessage.classList.add('error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Entrar';
    }
  });
});
