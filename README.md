# JaAbriuChamado

Aplicação local para cadastro de usuários e abertura e acompanhamento de chamados de suporte. O projeto usa Node.js e SQLite.

## Requisitos

- Node.js 22.5 ou superior.
- Nenhum pacote externo é necessário; o servidor usa o módulo SQLite incluído no Node.js.

## Iniciar

1. Confira se o arquivo `.env` contém as variáveis abaixo.
2. No terminal, dentro da pasta do projeto, execute `npm start`.
3. Abra <http://localhost:3000> no navegador.

Exemplo de configuração local:

```env
PORT=3000
LOGIN_EMAIL=admin@email.com
LOGIN_PASSWORD=escolha-uma-senha-forte
ADMIN_NAME=Suporte Admin
SESSION_SECRET=use-uma-chave-aleatoria-longa
```

O servidor cria a conta administrativa na primeira inicialização, se o email ainda não estiver no banco. Alterar `LOGIN_PASSWORD` depois disso não troca a senha salva; faça a alteração pela tela de usuários.

## Como usar

- **Usuário:** crie uma conta em `/register`, entre pelo login e use **Criar chamado**. Você pode pesquisar seus chamados e editar ou excluir os que ainda estão abertos.
- **Administrador:** entre com a conta administrativa e abra **Usuários** no menu para pesquisar, editar, desativar e excluir contas. No painel de chamados, pode pesquisar, editar, excluir e mudar o status de qualquer chamado.
- **Atribuição:** ao mudar um chamado para **Em andamento**, o administrador escolhe uma conta ativa responsável. O nome do responsável aparece no chamado. Ao reabrir um chamado como **Aberto**, a atribuição é removida.

## Regras de acesso e dados

- O cadastro público sempre cria uma conta de usuário comum. Só um administrador pode conceder o perfil de administrador.
- Usuários comuns veem apenas os próprios chamados. Não podem alterar o status.
- Apenas administradores podem pesquisar e gerenciar contas e ver todos os chamados.
- Uma conta não pode excluir a si própria nem remover o último administrador ativo.
- Excluir uma conta também exclui os chamados que ela abriu. Chamados atribuídos a essa conta ficam sem responsável.
- Senhas têm no mínimo 8 caracteres e são armazenadas com hash scrypt e salt individual.
- O banco preserva os valores de status e prioridade definidos no esquema.

## Banco de dados

O SQLite fica em `database/database.sqlite`. No início, o servidor cria as tabelas, índices e a coluna de responsável se estiver atualizando uma instalação anterior. Faça backup do arquivo antes de movê-lo ou substituí-lo.

- [Diagrama ER e regras de negócio](database/REGRAS_E_DIAGRAMA.md)
- [DDL do SQLite](database/schema.sql)

## Organização do projeto

- `server.js`: rotas HTTP, autenticação, permissões e acesso ao SQLite.
- `templates/`: telas de login, cadastro, painel e gerenciamento de usuários.
- `public/css/`: estilos das telas.
- `public/js/`: comportamento dos formulários e painéis.
- `database/`: banco local, DDL e documentação do modelo.
