# Ja Abriu Chamado

API REST para registrar e acompanhar chamados.

## Pré-requisitos

- JDK 21 (já detectado em seu computador)

## Executar

```powershell
.\mvnw.cmd spring-boot:run
```

A API inicia em `http://localhost:8080`.

## Rotas iniciais

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/chamados` | Lista os chamados |
| GET | `/api/chamados/{id}` | Busca um chamado |
| POST | `/api/chamados` | Cria um chamado |
| PATCH | `/api/chamados/{id}/status` | Atualiza o status |

Exemplo para criar um chamado:

```json
{
  "titulo": "Computador não liga",
  "descricao": "O equipamento não dá sinal ao apertar o botão.",
  "solicitante": "Maria Silva",
  "categoria": "HARDWARE",
  "prioridade": "ALTA"
}
```

O banco H2 é apenas local, para desenvolvimento. O console fica em `http://localhost:8080/h2-console`.
