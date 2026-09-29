const form = document.getElementById('register-form');
const message = document.getElementById('form-message');
const button = document.getElementById('submit-btn');

// Envia o cadastro e mostra o resultado sem recarregar o formulário.
form.addEventListener('submit', async event => {
  event.preventDefault();
  message.textContent = '';
  button.disabled = true;
  button.textContent = 'Criando conta…';

  try {
    const formData = Object.fromEntries(new FormData(form));
    const response = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const result = await response.json();

    if (!response.ok) throw new Error(result.message || 'Não foi possível criar a conta.');

    message.textContent = 'Conta criada! Redirecionando para entrar…';
    message.className = 'form-message success';
    setTimeout(() => { location.href = '/login'; }, 900);
  } catch (error) {
    message.textContent = error.message || 'Não foi possível criar a conta.';
    message.className = 'form-message error';
  } finally {
    button.disabled = false;
    button.textContent = 'Criar conta';
  }
});
