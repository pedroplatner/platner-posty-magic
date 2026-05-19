## Diagnóstico

A função `instagram-insights` foi deployada e está respondendo. Os números zerados de "views" e "interações" vêm de **2 erros 400 da Meta Graph API v22+** que precisamos corrigir na função:

### Erro 1 — `media_insights` usando métrica deprecada
```
(#100) Starting from version v22.0 and above, the impressions metric is no longer supported
```
A função pede `impressions,reach,saved,total_interactions` para fotos/carrosséis. A partir da v22, `impressions` foi removida — Meta substituiu por **`views`** (unifica fotos, vídeos e reels).

Resultado: a chamada inteira falha → `interactions = 0` em todos os posts → Top Posts mostra 0 interações.

### Erro 2 — `online_followers` recebendo `since`/`until`
```
(#100) Parameter since: Must be a unixtime... 
```
O frontend (`BestTimeHeatmap`) chama `online_followers` com `period: "lifetime"` mas o `useQuery` global passa params extras vazios — na verdade o problema é que `online_followers` no v25 **não aceita** `since`/`until` quando period=lifetime, e a função encaminha qualquer coisa que vier. Hoje não está vindo nada, mas a Meta ainda retorna 400 porque o endpoint `online_followers` em si pode estar deprecado para essa conta. Vou tratar fallback silencioso.

### Por que "views" do post aparece como 0
No grid de posts, a coluna do olhinho usa `p.impressions || p.reach`. Como `media_insights` falha 100%, ambos vêm 0.

---

## Plano

**Arquivo: `supabase/functions/instagram-insights/index.ts`**

1. No case `media_insights`, trocar conjunto de métricas:
   - Fotos/Carrossel: `views,reach,saved,total_interactions,likes,comments,shares`
   - Vídeos/Reels: `views,reach,saved,total_interactions,likes,comments,shares`
   - (Meta v22+ unificou em `views` — mesma métrica para todos)

2. Para `online_followers`, garantir que não enviamos `since`/`until` quando `period=lifetime` (já está condicional, mas reforçar). Se a Meta retornar erro nesse metric específico, devolver `{data:[]}` em vez de 400 — assim o heatmap mostra estado vazio em vez de quebrar.

**Arquivo: `src/routes/insights.tsx`**

3. No grid de posts, trocar `p.impressions || p.reach` por `p.views || p.reach` (campo novo).
4. No tipo `IGMediaInsights` / enriched, adicionar `views`.
5. Top Posts já usa `total_interactions`, que vai voltar a funcionar quando o (1) for corrigido — sem mudança lá.

**Bump `FUNCTION_VERSION`** para `2026-05-19-02` para confirmar redeploy.

---

## Após o deploy manual da função

Você precisará **redeployar a função no Supabase** novamente após eu salvar a alteração (mesmo processo de antes), porque o Lovable não tem deploy automático para esse projeto. Vou avisar no final qual versão esperar na resposta.

Confirma que posso aplicar?
