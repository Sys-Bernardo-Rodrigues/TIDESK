# Configuração do Zabbix 7.4.5 para Integração com TIDESK via Webhook

Este guia explica como configurar o Zabbix 7.4.5 para enviar eventos e alertas automaticamente para o TIDESK através de webhooks, criando tickets automaticamente no sistema.

## Pré-requisitos

- Zabbix 7.4.5 instalado e configurado
- Acesso administrativo ao Zabbix
- Webhook criado no TIDESK (veja a seção "Criar Webhook no TIDESK" abaixo)
- URL do webhook e Secret Key (se configurado)

## Passo 1: Criar Webhook no TIDESK

1. Acesse o TIDESK e vá para `/create/webhooks`
2. Clique em "Novo Webhook"
3. Preencha os campos:
   - **Nome**: Ex: "Zabbix Alerts"
   - **Descrição**: Ex: "Webhook para receber alertas do Zabbix"
   - **Prioridade**: Selecione a prioridade padrão (Média, Alta, etc.)
   - **Categoria**: (Opcional) Selecione uma categoria
   - **Atribuir a**: (Opcional) Selecione um usuário para receber os tickets
   - **Status**: Ativo
4. Clique em "Criar Webhook"
5. **Copie a URL do webhook** e a **Secret Key**:
   - **URL**: Clique no botão de copiar (ícone de cópia) ao lado da URL do webhook
   - **Secret Key**: Clique no botão de copiar (ícone de cópia) ao lado da Secret Key
   - Os botões ficam verdes por 2 segundos após copiar, confirmando que foi copiado

A URL será no formato:
```
https://seu-dominio.com/api/webhooks/receive/{webhook_url}
```

**Dica**: Use os botões de copiar no TIDESK para garantir que a URL e a Secret Key sejam copiadas corretamente, sem erros de digitação.

## Passo 2: Configurar Media Type no Zabbix

1. Acesse o Zabbix como administrador
2. Vá em **Administration** → **Media types**
3. Clique em **Create media type**
4. Configure os seguintes campos:

### Aba "Media type"
- **Name**: `TIDESK Webhook`
- **Type**: `Webhook`
- **Description**: `Envia alertas do Zabbix para o TIDESK via webhook`

### Aba "Parameters"
Adicione os seguintes parâmetros:

| Name | Value |
|------|-------|
| `url` | Substitua `{URL_DO_WEBHOOK}` pela URL completa do webhook do TIDESK (ex: `https://seu-dominio.com/api/webhooks/receive/abc123def456...`) |
| `httpProxy` | (deixe vazio, a menos que use proxy) |

**Importante**: A URL deve ser a URL completa copiada do TIDESK, incluindo o protocolo (https://) e o caminho completo.

### Aba "Script"
Cole o seguinte script JavaScript:

```javascript
try {
    // Obter informações do alerta
    var alert = JSON.parse(value);
    var event = alert.event;
    
    // Função para converter severidade do Zabbix
    function getSeverity(severity) {
        var severityMap = {
            '0': 'Not classified',
            '1': 'Information',
            '2': 'Warning',
            '3': 'Average',
            '4': 'High',
            '5': 'Disaster'
        };
        return severityMap[severity] || 'Not classified';
    }
    
    // Construir título do ticket
    var title = event.name || 'Alerta Zabbix';
    if (event.hostname) {
        title = '[' + event.hostname + '] ' + title;
    }
    
    // Construir descrição detalhada
    var description = '';
    if (event.message) {
        description = event.message;
    } else if (event.description) {
        description = event.description;
    } else {
        description = 'Alerta recebido do Zabbix';
    }
    
    // Adicionar informações adicionais
    description += '\n\n--- Detalhes do Alerta ---\n';
    if (event.hostname) description += 'Host: ' + event.hostname + '\n';
    if (event.host) description += 'Host IP: ' + event.host + '\n';
    if (event.item) description += 'Item: ' + event.item + '\n';
    if (event.value) description += 'Valor: ' + event.value + '\n';
    description += 'Severidade: ' + getSeverity(event.severity) + '\n';
    description += 'Status: ' + (event.status === '0' ? 'PROBLEM' : 'RESOLVED') + '\n';
    if (event.id) description += 'Event ID: ' + event.id + '\n';
    if (event.triggerid) description += 'Trigger ID: ' + event.triggerid + '\n';
    
    // Construir payload no formato esperado pelo TIDESK
    var payload = {
        alert: {
            name: title,
            message: description,
            severity: getSeverity(event.severity),
            host: event.host || 'N/A',
            hostname: event.hostname || 'N/A',
            item: event.item || 'N/A',
            value: event.value || 'N/A',
            timestamp: event.timestamp || Math.floor(Date.now() / 1000),
            event_id: event.id,
            trigger_id: event.triggerid,
            status: event.status === '0' ? 'PROBLEM' : 'RESOLVED'
        },
        event: {
            name: title,
            description: description,
            host: event.host || 'N/A',
            hostname: event.hostname || 'N/A'
        },
        zabbix: {
            version: '7.4.5',
            event_id: event.id,
            trigger_id: event.triggerid
        }
    };
    
    // Preparar requisição
    var request = new HttpRequest();
    request.addHeader('Content-Type: application/json');
    
    // Adicionar Secret Key se configurada
    // Descomente a linha abaixo e substitua {SUA_SECRET_KEY} pela secret key copiada do TIDESK
    // request.addHeader('x-webhook-secret: {SUA_SECRET_KEY}');
    
    // Enviar requisição
    var response = request.post(params.url, JSON.stringify(payload));
    
    // Verificar resposta
    if (response.getStatus() !== 200) {
        throw 'HTTP Status: ' + response.getStatus() + ', Response: ' + response.getBody();
    }
    
    var result = JSON.parse(response.getBody());
    
    // Retornar resultado
    return JSON.stringify({
        status: 'success',
        ticket_id: result.ticket_id || 'N/A',
        ticket_number: result.ticket_number || 'N/A',
        message: result.message || 'Ticket criado com sucesso'
    });
    
} catch (error) {
    // Em caso de erro, retornar informações do erro
    return JSON.stringify({
        status: 'error',
        error: error.toString()
    });
}
```

### Aba "Options"
- **Timeout**: `30s`
- **Retry attempts**: `3`
- **Retry interval**: `60s`

5. Clique em **Add** para salvar

## Passo 3: Configurar Ação (Action) no Zabbix

1. Vá em **Configuration** → **Actions**
2. Selecione **Trigger actions** (ou crie uma nova)
3. Clique em **Create action** (ou edite uma existente)

### Aba "Action"
- **Name**: `Enviar para TIDESK`
- **Conditions**: Configure as condições desejadas (ex: Severity >= High)

### Aba "Operations"
1. Clique em **New** na seção "Operations"
2. Configure:
   - **Send to users**: Selecione os usuários ou grupos
   - **Send only to**: `TIDESK Webhook` (o media type criado anteriormente)
   - **Subject**: `{TRIGGER.NAME}`
   - **Message**: 
```
Alerta: {TRIGGER.NAME}
Host: {HOST.NAME}
Severidade: {TRIGGER.SEVERITY}
Status: {TRIGGER.STATUS}
Descrição: {TRIGGER.DESCRIPTION}
Valor: {ITEM.VALUE}
```

3. Clique em **Add**

### Aba "Recovery operations" (Opcional)
Para enviar notificações quando o problema for resolvido:

1. Clique em **New** na seção "Recovery operations"
2. Configure da mesma forma que as operations normais
3. Clique em **Add**

4. Clique em **Add** para salvar a ação

## Passo 4: Atualizar URL do Webhook no Media Type

Após criar o webhook no TIDESK, você precisa atualizar a URL no Media Type:

1. Vá em **Administration** → **Media types**
2. Clique em **TIDESK Webhook**
3. Na aba **Parameters**, atualize o campo `url` com a URL completa do webhook:
   - No TIDESK, copie a URL completa do webhook (clique no botão de copiar ao lado da URL)
   - Cole a URL completa no campo `url` do parâmetro
   - Exemplo: `https://seu-dominio.com/api/webhooks/receive/abc123def456789...`
4. Se você configurou uma Secret Key no TIDESK:
   - No TIDESK, copie a Secret Key completa (clique no botão de copiar ao lado da Secret Key)
   - No script do Media Type, descomente a linha:
     ```javascript
     request.addHeader('x-webhook-secret: {SUA_SECRET_KEY}');
     ```
   - Substitua `{SUA_SECRET_KEY}` pela secret key real copiada do TIDESK
   - Exemplo: `request.addHeader('x-webhook-secret: abc123def456789...');`
5. Clique em **Update**

## Passo 5: Testar a Integração

### Teste via TIDESK (Recomendado)

1. No TIDESK, vá para a página do webhook criado (`/create/webhooks`)
2. Clique no botão **Testar** (ícone de envio)
3. Isso enviará um payload de teste e criará um ticket automaticamente
4. Verifique se o ticket foi criado com sucesso

### Teste Manual via Zabbix

1. Vá em **Monitoring** → **Problems**
2. Crie um problema de teste ou aguarde um alerta real
3. Verifique se o ticket foi criado no TIDESK
4. O ticket deve aparecer na lista de tickets com as informações do alerta do Zabbix

### Verificar Logs no TIDESK

1. No TIDESK, vá para a página do webhook
2. Clique no botão **Logs** (ícone de olho)
3. Verifique se há chamadas registradas:
   - **Sucesso** (verde): Ticket criado com sucesso
   - **Erro** (vermelho): Houve algum problema
4. Em caso de erro, os logs mostrarão:
   - Código de resposta HTTP
   - Mensagem de erro
   - Payload enviado (clique em "Ver payload" para expandir)

### Verificar Logs no Zabbix

1. Vá em **Reports** → **Action log**
2. Filtre por "TIDESK Webhook"
3. Verifique se as ações foram executadas com sucesso
4. Em caso de erro, verifique a mensagem de erro exibida

## Formato do Payload

O TIDESK aceita diferentes formatos de payload. O script acima envia no formato:

```json
{
  "alert": {
    "name": "Nome do Alerta",
    "message": "Mensagem do alerta",
    "severity": "High",
    "host": "servidor.example.com",
    "hostname": "servidor",
    "item": "CPU Usage",
    "value": "95%",
    "timestamp": 1234567890,
    "event_id": "12345",
    "trigger_id": "67890",
    "status": "PROBLEM"
  },
  "event": {
    "name": "Nome do Evento",
    "description": "Descrição do evento",
    "host": "servidor.example.com",
    "hostname": "servidor"
  },
  "zabbix": {
    "version": "7.4.5",
    "event_id": "12345",
    "trigger_id": "67890"
  }
}
```

## Mapeamento de Severidade

O TIDESK mapeia a severidade do Zabbix para prioridades de tickets:

| Severidade Zabbix | Prioridade TIDESK |
|-------------------|-------------------|
| Disaster (5)      | Urgente           |
| High (4)          | Alta              |
| Average (3)       | Média             |
| Warning (2)       | Baixa             |
| Information (1)   | Baixa             |
| Not classified (0)| Baixa            |

## Troubleshooting

### Webhook não está recebendo eventos

1. Verifique se o webhook está **Ativo** no TIDESK
2. Verifique se a URL está correta no Media Type do Zabbix
3. Verifique os logs do webhook no TIDESK
4. Verifique se o Zabbix consegue acessar a URL do webhook (teste de conectividade)

### Secret Key não está funcionando

1. Verifique se a Secret Key está correta no script do Media Type
2. Verifique se o header está sendo enviado corretamente
3. Verifique os logs do webhook para ver se há erro de autenticação

### Tickets não estão sendo criados

1. Verifique os logs do webhook no TIDESK
2. Verifique se o payload está no formato correto
3. Verifique se há erros no console do Zabbix
4. Verifique se o usuário criador do webhook tem permissões adequadas

### Erro 404 - Webhook não encontrado

1. Verifique se a URL está completa e correta
2. Verifique se o `webhook_url` está correto (é o hash gerado, não o ID)
3. Verifique se o webhook está ativo no TIDESK

## Exemplo de Script Simplificado (Alternativo)

Se o script acima não funcionar, você pode usar esta versão simplificada:

```javascript
var payload = {
    title: value,
    description: value,
    message: value
};

var request = new HttpRequest();
request.addHeader('Content-Type: application/json');
// request.addHeader('x-webhook-secret: {SUA_SECRET_KEY}');

var response = request.post(params.url, JSON.stringify(payload));

return JSON.stringify({
    status: response.getStatus(),
    body: response.getBody()
});
```

## Exemplos de Uso

### Exemplo 1: Alertas de CPU Alta

Quando o Zabbix detectar CPU acima de 90%, o TIDESK criará um ticket com:
- **Título**: `[servidor.example.com] CPU usage is above 90%`
- **Descrição**: Inclui host, valor atual, severidade, etc.
- **Prioridade**: Alta (se severidade for High no Zabbix)

### Exemplo 2: Disco Cheio

Quando o Zabbix detectar disco cheio, o TIDESK criará um ticket com:
- **Título**: `[servidor.example.com] Disk space is low`
- **Descrição**: Inclui informações sobre o disco, espaço disponível, etc.
- **Prioridade**: Urgente (se severidade for Disaster no Zabbix)

### Exemplo 3: Serviço Indisponível

Quando o Zabbix detectar que um serviço está down, o TIDESK criará um ticket com:
- **Título**: `[servidor.example.com] Service is down`
- **Descrição**: Inclui informações sobre o serviço, tempo de indisponibilidade, etc.
- **Prioridade**: Baseada na severidade configurada no Zabbix

## Dicas e Boas Práticas

1. **Teste sempre após configurar**: Use o botão "Testar" no TIDESK para verificar se a integração está funcionando
2. **Monitore os logs**: Verifique regularmente os logs do webhook para identificar problemas
3. **Configure prioridades adequadas**: Ajuste as prioridades no webhook do TIDESK conforme a criticidade dos alertas
4. **Use categorias**: Configure categorias no TIDESK para organizar melhor os tickets criados via webhook
5. **Atribua responsáveis**: Configure um usuário padrão para receber os tickets criados via webhook
6. **Secret Key**: Use sempre uma Secret Key para maior segurança
7. **Filtros no Zabbix**: Configure condições nas Actions do Zabbix para enviar apenas alertas importantes

## Suporte

Para mais informações sobre webhooks no TIDESK, consulte a documentação do sistema ou entre em contato com o suporte.

## Changelog

- **2026-01-23**: Documentação inicial criada para Zabbix 7.4.5
