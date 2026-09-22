# JaAbriuChamado
sem banco de dados por enquanto

## Requisitos

- [Node.js](https://nodejs.org/) 18 ou superior.

## Como executar

No diretório do projeto, execute:

```bash
npm start
```

Depois, abra [http://localhost:3000]

## Configuração de credenciais

As credenciais ficam no arquivo `.env`, que não é enviado ao Git. Edite-o para alterar o email ou senha de login:

```env
LOGIN_EMAIL=admin@email.com
LOGIN_PASSWORD=sua-senha
SESSION_SECRET=uma-chave-longa-e-aleatoria
```

Caso o arquivo não exista, copie `.env.example` para `.env` e preencha os valores.

## Acesso às páginas

O painel `/dashboard` exige uma sessão criada pelo login. Sem ela, o servidor redireciona automaticamente para `/login`. Use o menu do administrador e a opção **Sair** para encerrar a sessão.

## Estrutura

```text
templates/login.html  Página de login
public/css/stely.css  Estilos da página
public/js/login.js    Validação e envio do formulário
server.js             Servidor HTTP e rota de autenticação local
.env                  Credenciais locais (não versionado)
```
