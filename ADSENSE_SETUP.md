# Configuração do Google AdSense

## Passo 1: Criar Conta no Google AdSense

1. Acesse [https://www.google.com/adsense](https://www.google.com/adsense)
2. Faça login com sua conta Google
3. Complete o processo de cadastro fornecendo:
   - URL do seu site
   - Informações de pagamento
   - Informações fiscais (CPF/CNPJ)

## Passo 2: Obter seu Código de Publisher

1. No painel do AdSense, vá em **Configurações** > **Informações da conta**
2. Localize seu **ID do editor** (formato: `ca-pub-XXXXXXXXXXXXXXXX`)
3. Copie este código

## Passo 3: Configurar no Projeto

### 3.1 Atualizar o index.html

No arquivo `index.html`, substitua `ca-pub-XXXXXXXXXXXXXXXX` pelo seu ID real:

```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-SEU_ID_AQUI"
 crossorigin="anonymous"></script>
```

### 3.2 Atualizar o componente GoogleAdSense

No arquivo `src/components/ads/GoogleAdSense.tsx`, na linha 29, substitua:

```typescript
data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" // Substitua pelo seu ID
```

## Passo 4: Criar Blocos de Anúncios

1. No painel do AdSense, vá em **Anúncios** > **Por unidade de anúncio**
2. Clique em **Criar novo bloco de anúncios**
3. Escolha o tipo (Display, In-feed, In-article, etc.)
4. Configure tamanho e comportamento
5. Copie o **data-ad-slot** gerado

## Passo 5: Configurar os Slots no Código

Substitua os valores de `adSlot` nos componentes:

### Dashboard (src/pages/Dashboard.tsx)

```typescript
// Banner horizontal
<AdSenseBanner adSlot="SEU_SLOT_BANNER" />

// Anúncio lateral
<AdSenseSidebar adSlot="SEU_SLOT_SIDEBAR" />
```

## Tipos de Anúncios Disponíveis

### 1. AdSenseBanner
Banner horizontal responsivo com opção de fechar
```typescript
<AdSenseBanner adSlot="1234567890" dismissible={true} />
```

### 2. AdSenseSidebar
Anúncio vertical para sidebars
```typescript
<AdSenseSidebar adSlot="0987654321" />
```

### 3. AdSenseDisplay
Anúncio genérico customizável
```typescript
<AdSenseDisplay 
  adSlot="1122334455"
  adFormat="rectangle"
  title="Patrocinado"
/>
```

## Formatos Disponíveis

- `auto`: Responsivo automático (recomendado)
- `fluid`: Fluido para in-feed/in-article
- `rectangle`: Retângulo fixo
- `vertical`: Vertical (skyscraper)
- `horizontal`: Horizontal (banner)

## Políticas Importantes do AdSense

⚠️ **ATENÇÃO**: Siga rigorosamente as políticas do Google AdSense:

1. **Nunca clique nos seus próprios anúncios**
2. **Não peça para outros clicarem**
3. **Não coloque anúncios em páginas com conteúdo proibido**
4. **Não manipule os anúncios com CSS escondendo elementos**
5. **Respeite o limite de 3 anúncios por página** (recomendação)

## Verificação e Aprovação

1. Após adicionar o código, aguarde 24-48h para o Google verificar
2. Você receberá um email quando o site for aprovado
3. Os anúncios começarão a aparecer automaticamente após aprovação

## Alternativas ao AdSense

Se o AdSense não aprovar seu site ou você quiser outras opções:

### Media.net
- Rede de anúncios do Yahoo/Bing
- Boa alternativa ao AdSense
- [https://www.media.net](https://www.media.net)

### PropellerAds
- Aceita tráfego brasileiro
- Vários formatos de anúncios
- [https://www.propellerads.com](https://www.propellerads.com)

### Ezoic
- Plataforma de otimização de anúncios
- Requer mínimo de tráfego
- [https://www.ezoic.com](https://www.ezoic.com)

## Monitoramento de Desempenho

Acesse regularmente o painel do AdSense para:
- Ver quantos cliques e impressões você está recebendo
- Verificar estimativa de ganhos
- Identificar páginas com melhor desempenho
- Otimizar posicionamento dos anúncios

## Suporte

- Documentação oficial: [https://support.google.com/adsense](https://support.google.com/adsense)
- Comunidade: [https://support.google.com/adsense/community](https://support.google.com/adsense/community)
